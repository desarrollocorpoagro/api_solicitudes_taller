import { Request, Response } from 'express';
import { Op } from 'sequelize';
import { SolicitudRepuesto, SolicitudExterno, CatalogoRepuesto, OrdenServicio } from '../models';
import { ErpService } from '../services/erp.service';
import { logger } from '../utils/logger';
import { getTenantContext, getAuthorizedPlatesForTenant } from '../utils/tenantHelper';

export class AprobacionesController {
  /**
   * Obtiene la bandeja unificada de solicitudes de repuestos y servicios externos para revisión del Gerente de Taller.
   */
  static async getBandejaAprobaciones(req: Request, res: Response) {
    try {
      const { ordenId } = req.query;
      const where: any = {};
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

      const repuestos = await SolicitudRepuesto.findAll({ where, order: [['createdAt', 'DESC']] });
      const externos = await SolicitudExterno.findAll({ where, order: [['createdAt', 'DESC']] });

      const items = [
        ...repuestos.map((r: any) => ({
          id: r.id,
          tipo: 'repuesto',
          ordenId: r.ordenId,
          otId: r.otId,
          nombre: `${r.desc} × ${r.cant}`,
          codigo: r.cod,
          descripcion: r.desc,
          cantidad: r.cant,
          monto: Number(r.costoTotal),
          stock: r.stockActual,
          motivo: r.motivo,
          estadoAprobacion: r.estadoAprobacion,
          estadoEntrega: r.estadoEntrega,
          requiereEscalamiento: r.requiereEscalamiento,
          almacen: r.almacen,
          esGarantia: false,
          ordenOrigenGarantia: null,
          createdAt: r.createdAt,
        })),
        ...externos.map((x: any) => ({
          id: x.id,
          tipo: 'externo',
          ordenId: x.ordenId,
          otId: x.otId,
          nombre: `${x.descripcion} · ${x.proveedor}`,
          codigo: 'SRV-EXT',
          descripcion: x.descripcion,
          proveedor: x.proveedor,
          monto: Number(x.costoEfectivo),
          costoCotizado: Number(x.costoCotizado),
          esGarantia: x.conGarantia,
          ordenOrigenGarantia: x.ordenOrigenGarantia,
          estadoAprobacion: x.estadoAprobacion,
          requiereEscalamiento: x.requiereEscalamiento,
          createdAt: x.createdAt,
        })),
      ];

      return res.json({
        success: true,
        umbralEscalamiento: 500.0,
        count: items.length,
        data: items,
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Aprueba o rechaza una solicitud específica.
   */
  static async procesarAprobacion(req: Request, res: Response) {
    try {
      const { tipo, id } = req.params;
      const { accion } = req.body; // 'APROBAR' | 'RECHAZAR'
      const aprobadoPor = req.user?.email || 'Gerente de Taller';

      if (tipo === 'repuesto') {
        const solicitud = await SolicitudRepuesto.findByPk(id);
        if (!solicitud) return res.status(404).json({ success: false, error: 'Solicitud de repuesto no encontrada.' });

        if (accion === 'APROBAR') {
          solicitud.estadoAprobacion = 'Aprobada';
          solicitud.aprobadoPor = aprobadoPor;
          solicitud.fechaAprobacion = new Date();

          // Verificar stock actual en catálogo
          const articulo = await CatalogoRepuesto.findOne({ where: { cod: solicitud.cod } });
          const stockDisponible = articulo ? articulo.stock : 0;
          solicitud.stockActual = stockDisponible;

          if (stockDisponible >= solicitud.cant) {
            solicitud.estadoEntrega = 'Por entregar';
          } else {
            // Sin stock suficiente -> Marcar Backorder y generar requisición ERP
            solicitud.estadoEntrega = 'Backorder';
            const numReq = await ErpService.generatePurchaseRequisition(solicitud.cod, solicitud.cant, solicitud.ordenId);
            solicitud.numRequisicionERP = numReq;
          }
        } else {
          solicitud.estadoAprobacion = 'Rechazada';
        }

        await solicitud.save();
        logger.info(`[AprobacionesController] Solicitud de repuesto ${id} ${solicitud.estadoAprobacion}`);

        return res.json({
          success: true,
          message: `Solicitud de repuesto ${solicitud.estadoAprobacion.toLowerCase()} exitosamente.`,
          data: solicitud,
        });
      } else if (tipo === 'externo') {
        const solicitud = await SolicitudExterno.findByPk(id);
        if (!solicitud) return res.status(404).json({ success: false, error: 'Solicitud de servicio externo no encontrada.' });

        solicitud.estadoAprobacion = accion === 'APROBAR' ? 'Aprobada' : 'Rechazada';
        solicitud.aprobadoPor = aprobadoPor;
        solicitud.fechaAprobacion = new Date();

        await solicitud.save();
        logger.info(`[AprobacionesController] Solicitud externa ${id} ${solicitud.estadoAprobacion}`);

        return res.json({
          success: true,
          message: `Solicitud de servicio externo ${solicitud.estadoAprobacion.toLowerCase()} exitosamente.`,
          data: solicitud,
        });
      }

      return res.status(400).json({ success: false, error: 'Tipo de solicitud inválido.' });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }
}

export default AprobacionesController;
