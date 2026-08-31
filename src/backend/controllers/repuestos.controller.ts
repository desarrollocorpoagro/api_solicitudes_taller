import { Request, Response } from 'express';
import { SolicitudRepuesto, CatalogoRepuesto, OrdenServicio, OrdenArea } from '../models';
import { EmailService } from '../services/email.service';
import { AuditService } from '../services/audit.service';
import { logger } from '../utils/logger';

export class RepuestosController {
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

      const articulo = await CatalogoRepuesto.findOne({ where: { cod: cod.toUpperCase().trim() } });
      if (!articulo) {
        return res.status(404).json({ success: false, error: 'Artículo no encontrado en el catálogo de repuestos.' });
      }

      const cantidad = parseInt(cant, 10);
      const costoUnitario = parseFloat(Number(articulo.costo).toFixed(2));
      const costoTotal = parseFloat((cantidad * costoUnitario).toFixed(2));
      const requiereEscalamiento = costoTotal > 500;

      const solicitud = await SolicitudRepuesto.create({
        ordenId,
        otId,
        cod: articulo.cod,
        desc: articulo.desc,
        cant: cantidad,
        costoUnitario,
        costoTotal,
        stockActual: articulo.stock,
        motivo: motivo || '',
        estadoAprobacion: 'Pendiente',
        estadoEntrega: 'Por entregar',
        almacen: articulo.almacen || 'TLL-01',
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

      logger.info(`[RepuestosController] Solicitud de repuesto creada: ${articulo.cod} x ${cantidad} para ${ordenId} (${otId})`);

      return res.status(201).json({
        success: true,
        message: 'Solicitud de repuesto agregada.',
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
