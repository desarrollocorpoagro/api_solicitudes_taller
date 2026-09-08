import { Request, Response } from 'express';
import { SolicitudRepuesto, CatalogoRepuesto, OrdenServicio, OrdenArea } from '../models';
import { EmailService } from '../services/email.service';
import { AuditService } from '../services/audit.service';
import { ErpService } from '../services/erp.service';
import { logger } from '../utils/logger';
import { profitMirrorSequelize } from '../config/profitDb';
import { whereTrimCod } from '../utils/trimWhere';

export class RepuestosController {
  /**
   * Resuelve un artículo desde el catálogo espejo de Profit (vw_flota_articulos),
   * la misma fuente que alimenta la UI (GET /api/v1/catalogo). Si un código válido
   * aún no se sincronizó a CatalogoRepuesto, lo registra automáticamente
   * (self-healing) y devuelve el registro local con los datos de costo/stock.
   */
  private static async resolveArticuloDesdeMirror(cod: string): Promise<CatalogoRepuesto | null> {
    const [rows]: any = await profitMirrorSequelize.query(
      `SELECT TRIM(codigo_profit) AS cod, TRIM(nombre_producto) AS descr,
              costo, codigo_subalmacen, sub_almacen, almacen, categoria, stock_act
       FROM vw_flota_articulos
       WHERE LTRIM(RTRIM(codigo_profit)) = LTRIM(RTRIM(?))`,
      { replacements: [cod] }
    );
    const filas: any[] = rows ?? [];
    if (!filas.length) return null;

    // Agrupar por subalmacén igual que CatalogoController.getCatalogo:
    // stock solo suma el subalmacén '01'; el '00' es stock central.
    let stock = 0;
    let tieneSubCentral = false;
    for (const row of filas) {
      const sub = String(row.codigo_subalmacen ?? '').trim();
      if (sub === '00' || sub === '0') {
        tieneSubCentral = true;
      } else {
        stock += Number(row.stock_act ?? 0);
      }
    }

    const codLimpio = String(rows[0].cod ?? '').trim();
    const primerFila = filas[0];
    const [articulo, created] = await CatalogoRepuesto.findOrCreate({
      where: { cod: codLimpio },
      defaults: {
        cod: codLimpio,
        desc: String(primerFila.descr ?? '').trim(),
        categoria: primerFila.categoria || 'General',
        stock,
        costo: Number(primerFila.costo ?? 0),
        almacen: tieneSubCentral && stock === 0 ? '00' : String(primerFila.almacen ?? primerFila.sub_almacen ?? 'ALM-01').trim(),
      },
    });
    if (!created) {
      articulo.stock = stock;
      articulo.costo = Number(primerFila.costo ?? articulo.costo);
      articulo.almacen = tieneSubCentral && stock === 0 ? '00' : articulo.almacen;
      await articulo.save();
    }

    logger.info(`[RepuestosController] Artículo ${codLimpio} resuelto desde el espejo Profit (${created ? 'registrado' : 'actualizado'}) y vinculado al catálogo local.`);
    return articulo;
  }
  /**
   * Agrega una solicitud de repuesto para una orden de área específica.
   */
  static async createSolicitud(req: Request, res: Response) {
    try {
      const { id: ordenId } = req.params;
      const { otId, cod, cant, motivo } = req.body;

      const orden = await OrdenServicio.findByPk(ordenId);
      if (!orden) return res.status(404).json({ success: false, error: 'Orden de servicio no encontrada.' });

      const area = await OrdenArea.findOne({ where: { id: otId, ordenId } });
      if (!area) return res.status(404).json({ success: false, error: 'Orden de área no encontrada.' });

      let articulo = await CatalogoRepuesto.findOne({
        where: whereTrimCod(cod),
      });
      if (!articulo) {
        // El código puede ser válido en Profit pero aún no estar sincronizado al
        // catálogo local (CatalogoRepuesto). Se resuelve desde la vista espejo
        // vw_flota_articulos que alimenta la UI y se registra automáticamente.
        articulo = await RepuestosController.resolveArticuloDesdeMirror(cod ?? '');
        if (!articulo) {
          return res.status(404).json({ success: false, error: `Artículo no encontrado en el catálogo de repuestos: ${cod}` });
        }
      }
      if (articulo.almacen === '00') {
        return res.status(400).json({ success: false, error: 'El artículo tiene codigo_subalmacen=00, debe solicitar traslado al central.' });
      }

      const cantidad = parseInt(cant, 10);
      const costoUnitario = parseFloat(Number(articulo.costo).toFixed(2));
      const costoTotal = parseFloat((cantidad * costoUnitario).toFixed(2));
      const requiereEscalamiento = costoTotal > 5000;

      // Aprobación automática: la solicitud nace aprobada según el stock disponible.
      const aprobadoPor = (req as any).user?.email || 'Aprobación automática';
      const stockSuficiente = Number(articulo.stock) >= cantidad;
      let numRequisicionERP: string | undefined;
      if (!stockSuficiente) {
        numRequisicionERP = await ErpService.generatePurchaseRequisition(articulo.cod.trim(), cantidad, ordenId);
      }

      const solicitud = await SolicitudRepuesto.create({
        ordenId,
        placa: String(orden.placa).trim().toUpperCase(),
        otId,
        cod: articulo.cod.trim(),
        desc: articulo.desc.trim(),
        cant: cantidad,
        costoUnitario,
        costoTotal,
        stockActual: articulo.stock,
        motivo: motivo || '',
        estadoAprobacion: 'Aprobada',
        estadoEntrega: stockSuficiente ? 'Por entregar' : 'Backorder',
        almacen: articulo.almacen || '01',
        aprobadoPor,
        fechaAprobacion: new Date(),
        numRequisicionERP: numRequisicionERP || undefined,
        requiereEscalamiento,
      });

      // Si supera el umbral, notificar al responsable de flota
      if (requiereEscalamiento) {
        EmailService.notifyEscalamientoFlota(articulo.desc, costoTotal, ordenId, otId);
      }

      // Registrar auditoría
      await AuditService.recordLog({
        ordenId,
        otId,
        action: 'SOLICITUD_REPUESTO',
        fieldName: 'repuesto',
        newValue: `${articulo.cod} (${cantidad} unid)`,
        description: `Solicitud de repuesto ${articulo.cod} ("${articulo.desc}") × ${cantidad} unid. Costo estimado: $${costoTotal} ($${costoUnitario}/u). Motivo: "${motivo || 'Requerimiento técnico'}"`,
        req,
      });

      logger.info(`[RepuestosController] Solicitud de repuesto creada y aprobada automáticamente: ${articulo.cod} x ${cantidad} para ${ordenId} (${otId})`);

      return res.status(201).json({
        success: true,
        message: 'Solicitud de repuesto agregada y aprobada automáticamente.',
        data: solicitud,
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Anula una solicitud de repuesto.
   */
  static async deleteSolicitud(req: Request, res: Response) {
    try {
      const { id: ordenId, repId } = req.params;

      const solicitud = await SolicitudRepuesto.findOne({ where: { id: repId, ordenId } });
      if (!solicitud) return res.status(404).json({ success: false, error: 'Solicitud de repuesto no encontrada.' });

      if (solicitud.estadoEntrega === 'Entregado') {
        return res.status(400).json({
          success: false,
          error: 'No se puede anular un repuesto que ya ha sido despachado y entregado por almacén.',
        });
      }

      const repDesc = `${solicitud.cod} - ${solicitud.desc} x ${solicitud.cant}`;
      const otId = solicitud.otId;
      await solicitud.destroy();

      await AuditService.recordLog({
        ordenId,
        otId,
        action: 'ANULACION_REPUESTO',
        fieldName: 'repuesto',
        previousValue: repDesc,
        newValue: null,
        description: `Anulación de solicitud de repuesto: ${repDesc}`,
        req,
      });

      logger.info(`[RepuestosController] Solicitud de repuesto ${repId} anulada.`);

      return res.json({
        success: true,
        message: 'Solicitud de repuesto anulada con éxito.',
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }
}

export default RepuestosController;
