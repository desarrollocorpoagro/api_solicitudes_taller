import { Request, Response } from 'express';
import { Op } from 'sequelize';
import { Gasto } from '../models/Gasto.model';
import { OrdenServicio, SolicitudRepuesto } from '../models';
import { backfillGastosForOpenOrders, ensureLocalGastoForSolicitud, syncGastosToMssql } from '../services/gastos.service';
import { logger } from '../utils/logger';

export class GastosController {
  /**
   * Lista los gastos locales. Por defecto devuelve los pendientes de sincronización.
   */
  static async list(_req: Request, res: Response) {
    try {
      const { synced, ordenId, limit } = _req.query;
      const where: any = {};
      if (synced === 'true') where.syncedToMssql = true;
      if (synced === 'false') where.syncedToMssql = false;
      if (ordenId) where.ordenId = String(ordenId);

      const rows = await Gasto.findAll({
        where,
        order: [['id', 'DESC']],
        limit: Math.min(parseInt(String(limit ?? '100'), 10) || 100, 500),
      });
      return res.json({ success: true, count: rows.length, data: rows });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Re-genera (idempotente) el gasto local de una solicitud específica.
   */
  static async regenerateForSolicitud(req: Request, res: Response) {
    try {
      const { solicitudId } = req.params;
      const solicitud = await SolicitudRepuesto.findByPk(solicitudId);
      if (!solicitud) {
        return res.status(404).json({ success: false, error: 'Solicitud no encontrada.' });
      }
      const gasto = await ensureLocalGastoForSolicitud(solicitud, {
        usuario: req.user?.email,
        nota: 'Regeneración manual vía API',
      });
      if (!gasto) {
        return res.status(409).json({
          success: false,
          error: 'La orden está cerrada o el artículo no existe en vw_flota_articulos; no se generó gasto.',
        });
      }
      return res.json({ success: true, data: gasto });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Recorre todas las solicitudes y asegura un gasto local por cada una,
   * excepto en órdenes cerradas.
   */
  static async backfill(_req: Request, res: Response) {
    try {
      const summary = await backfillGastosForOpenOrders();
      return res.json({ success: true, ...summary });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Empuja los gastos pendientes hacia MSSQL Profit AD_TRANS (dbo.gastos).
   */
  static async syncToMssql(req: Request, res: Response) {
    try {
      const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : undefined;
      const report = await syncGastosToMssql({ limit });
      return res.json({ success: report.failed === 0, ...report });
    } catch (err: any) {
      logger.error(`[GastosController] syncToMssql error: ${err.message}`);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Diagnóstico rápido: conteos por estado de sincronización.
   */
  static async stats(_req: Request, res: Response) {
    try {
      const [pending, synced, total] = await Promise.all([
        Gasto.count({ where: { syncedToMssql: false } }),
        Gasto.count({ where: { syncedToMssql: true } }),
        Gasto.count(),
      ]);
      const ordenesAbiertas = await OrdenServicio.count({ where: { estado: { [Op.ne]: 'Cerrada' } } });
      return res.json({
        success: true,
        data: { total, pending, synced, ordenesAbiertas },
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
}

export default GastosController;
