import { Request, Response } from 'express';
import { Op } from 'sequelize';
import { SolicitudRepuesto, CatalogoRepuesto, OrdenServicio } from '../models';
import { ErpService } from '../services/erp.service';
import { AuditService } from '../services/audit.service';
import { logger } from '../utils/logger';
import { getTenantContext, getAuthorizedPlatesForTenant } from '../utils/tenantHelper';

export class AlmacenController {
  /**
   * Obtiene la lista de repuestos aprobados que están pendientes de despacho en almacén para la empresa activa.
   */
  static async getDespachosPendientes(req: Request, res: Response) {
    try {
      const { ordenId } = req.query;
      const where: any = { estadoAprobacion: 'Aprobada' };
      
      if (ordenId) {
        where.ordenId = ordenId;
      } else {
        const tenant = await getTenantContext(req);
        if (tenant) {
          const authorizedPlates = await getAuthorizedPlatesForTenant(req);
          const tenantOrders = await OrdenServicio.findAll({
            where: {
              [Op.or]: [
                { tenantId: tenant.companyId },
                { placa: { [Op.in]: authorizedPlates } },
              ],
            },
            attributes: ['id'],
          });
          const orderIds = tenantOrders.map((o) => o.id);
          where.ordenId = { [Op.in]: orderIds };
        }
      }

      const items = await SolicitudRepuesto.findAll({
        where,
        order: [['createdAt', 'DESC']],
      });

      return res.json({
        success: true,
        count: items.length,
        data: items,
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Confirma el despacho físico de un repuesto, actualiza inventario y genera ajuste ERP.
   */
  static async confirmarDespacho(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const despachadoPor = req.user?.email || 'Almacenista TLL-01';

      const solicitud = await SolicitudRepuesto.findByPk(id);
      if (!solicitud) return res.status(404).json({ success: false, error: 'Solicitud no encontrada.' });

      if (solicitud.estadoAprobacion !== 'Aprobada') {
        return res.status(400).json({
          success: false,
          error: 'No se puede despachar un repuesto que no ha sido aprobado por el Gerente de Taller.',
        });
      }

      if (solicitud.estadoEntrega === 'Entregado') {
        return res.status(400).json({ success: false, error: 'El repuesto ya ha sido despachado previamente.' });
      }

      // Actualizar existencias en catálogo
      const articulo = await CatalogoRepuesto.findOne({ where: { cod: solicitud.cod } });
      if (articulo) {
        if (articulo.stock < solicitud.cant) {
          return res.status(400).json({
            success: false,
            error: `Existencia insuficiente en almacén (${articulo.stock} disponibles para requerimiento de ${solicitud.cant}). Se requiere recepción previa de compra.`,
          });
        }
        articulo.stock = Math.max(0, articulo.stock - solicitud.cant);
        await articulo.save();
      }

      // Generar movimiento de salida conciliado en ERP Profit Plus
      const numMovimiento = await ErpService.generateInventoryAdjustment(solicitud.cod, solicitud.cant, solicitud.ordenId);

      solicitud.estadoEntrega = 'Entregado';
      solicitud.numMovimientoERP = numMovimiento;
      solicitud.despachadoPor = despachadoPor;
      solicitud.fechaDespacho = new Date();
      await solicitud.save();

      // Registrar auditoría de entrega física en almacén
      await AuditService.recordLog({
        ordenId: solicitud.ordenId,
        otId: solicitud.otId,
        action: 'DESPACHO_REPUESTO',
        fieldName: 'estadoEntrega',
        previousValue: 'Por entregar',
        newValue: 'Entregado',
        description: `Despacho de almacén: Entrega física de ${solicitud.cod} ("${solicitud.desc}") × ${solicitud.cant} unid. Conciliación ERP: Movimiento #${numMovimiento}. Despachador: ${despachadoPor}`,
        req,
      });

      logger.info(`[AlmacenController] Despacho confirmado para repuesto ${solicitud.cod} (Movimiento: ${numMovimiento})`);

      return res.json({
        success: true,
        message: `Despacho de repuesto confirmado. Movimiento de inventario ${numMovimiento} conciliado con el ERP.`,
        data: solicitud,
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }
}

export default AlmacenController;
