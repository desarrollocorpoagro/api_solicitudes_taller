import { Request, Response } from 'express';
import { Op } from 'sequelize';
import { Gasto, GastoOrigen } from '../models/Gasto.model';
import { OrdenServicio, SolicitudRepuesto, SolicitudExterno } from '../models';
import {
  backfillGastosForOpenOrders,
  defaultCliente,
  ensureLocalGastoForSolicitud,
  ensureLocalGastoForRepuesto,
  ensureLocalGastoForExterno,
  syncGastosToMssql,
  syncOneGastoToMssql,
  validateGastoDraft,
  resolveFlotaOrdenId,
} from '../services/gastos.service';
import { logger } from '../utils/logger';

export class GastosController {
  /**
   * Lista los gastos locales con filtros opcionales:
   *   - synced=true|false  (alias retrocompatible; equivale a estado_sincronizacion)
   *   - estado=PENDIENTE|ENVIADO|ERROR
   *   - tipo_origen=REPUESTO|EXTERNO
   *   - ordenId=...
   *   - id_origen_referencia=...
   *   - limit (default 100, max 500)
   */
  static async list(_req: Request, res: Response) {
    try {
      const { synced, estado, tipo_origen, ordenId, id_origen_referencia, limit } = _req.query;
      const where: any = {};
      if (estado) where.estado_sincronizacion = String(estado);
      if (synced === 'true') where.syncedToMssql = true;
      else if (synced === 'false') where.syncedToMssql = false;
      if (tipo_origen) where.tipo_origen = String(tipo_origen);
      if (ordenId) where.ordenId = String(ordenId);
      if (id_origen_referencia) where.id_origen_referencia = String(id_origen_referencia);

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
   * Crea/actualiza un gasto local manualmente (POST /gastos).
   * Valida el payload antes de persistir y dispara sync inmediato por evento.
   */
  static async create(req: Request, res: Response) {
    try {
      const draft = req.body ?? {};
      const validation = validateGastoDraft(draft);
      if (!validation.ok) {
        return res.status(400).json({ success: false, error: 'Validación fallida', details: validation.errors });
      }

      const orden = await OrdenServicio.findByPk(String(draft.ordenId));
      const placa = String(draft.placa ?? orden?.placa ?? '').trim().toUpperCase();
      if (!placa) {
        return res.status(400).json({ success: false, error: 'La placa es obligatoria para registrar un gasto.' });
      }

      // Si el cliente no envió monto, intentar derivarlo
      const monto = Number(draft.monto ?? draft.costo_total_calculado ?? 0);

      // Si el origen es AREA, REPUESTO o EXTERNO, llamar a la función
      // tipada correspondiente para mantener las reglas de negocio
      // (cálculo de monto, derivación de datos espejo, etc.).
      let gasto: any;
      if (draft.tipo_origen === 'REPUESTO' && draft.id_origen_referencia) {
        const s = await SolicitudRepuesto.findByPk(draft.id_origen_referencia);
        if (!s) return res.status(404).json({ success: false, error: 'SolicitudRepuesto no encontrada.' });
        gasto = await ensureLocalGastoForRepuesto(s, {
          usuario: draft.usuario ?? req.user?.email,
          nota: draft.nota,
        });
      } else if (draft.tipo_origen === 'EXTERNO' && draft.id_origen_referencia) {
        const s = await SolicitudExterno.findByPk(draft.id_origen_referencia);
        if (!s) return res.status(404).json({ success: false, error: 'SolicitudExterno no encontrada.' });
        gasto = await ensureLocalGastoForExterno(s, { usuario: draft.usuario ?? req.user?.email });
      } else {
        // Fallback: inserción directa con el draft
        gasto = await Gasto.create({
          tipo_origen: draft.tipo_origen as GastoOrigen,
          id_origen_referencia: draft.id_origen_referencia,
          ordenId: draft.ordenId,
          codigo_articulo: draft.codigo_articulo ?? null,
          codigo_subalmacen: String(draft.codigo_subalmacen ?? '').trim() || '01',
          co_prov: String(draft.co_prov ?? '').trim() || 'GEN',
          co_cli: defaultCliente(draft.co_cli),
          cantidad: Number(draft.cantidad ?? 0),
          unidad: draft.unidad ?? null,
          horas_trabajadas: Number(draft.horas_trabajadas ?? 0),
          costo_unitario: Number(draft.costo_unitario ?? 0),
          costo_total_calculado: monto,
          monto,
          fecha_actividad: draft.fecha_actividad ? new Date(draft.fecha_actividad) : new Date(),
          placa,
          id_ordenser: await resolveFlotaOrdenId(String(draft.ordenId)),
          usuario: draft.usuario ?? req.user?.email ?? '',
          nota: draft.nota ?? '',
          estado_sincronizacion: 'PENDIENTE',
        } as any);
      }

      if (!gasto) {
        return res.status(409).json({
          success: false,
          error: 'La orden está cerrada o el origen no se pudo resolver; no se creó gasto.',
        });
      }

      // Disparar sync por evento (no bloquea la respuesta si falla)
      syncOneGastoToMssql(gasto.id).catch((err) =>
        logger.warn(`[GastosController] syncOneGastoToMssql async error: ${err.message}`)
      );

      return res.json({ success: true, data: gasto });
    } catch (err: any) {
      logger.error(`[GastosController] create error: ${err.message}`);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Re-genera (idempotente) el gasto local de una solicitud específica.
   * Compatibilidad retrocompatible: /gastos/regenerate/:solicitudId
   * Para SolicitudRepuesto — se aceptan también los ids de SolicitudExterno
   * (la lógica se infiere del tipo de origen).
   */
  static async regenerate(req: Request, res: Response) {
    try {
      const { id: referenciaId } = req.params;
      const { tipo } = req.query; // opcional: REPUESTO | EXTERNO

      // Intentar deducir el tipo probando las dos tablas
      let gasto: any = null;
      if (!gasto && (tipo === 'REPUESTO' || !tipo)) {
        const s = await SolicitudRepuesto.findByPk(referenciaId);
        if (s) gasto = await ensureLocalGastoForRepuesto(s, {
          usuario: req.user?.email,
          nota: 'Regeneración manual vía API',
        });
      }
      if (!gasto && (tipo === 'EXTERNO' || !tipo)) {
        const s = await SolicitudExterno.findByPk(referenciaId);
        if (s) gasto = await ensureLocalGastoForExterno(s, { usuario: req.user?.email });
      }
      if (!gasto) {
        return res.status(404).json({
          success: false,
          error: 'No se encontró la referencia en SolicitudRepuesto ni SolicitudExterno.',
        });
      }
      // Sync por evento
      syncOneGastoToMssql(gasto.id).catch((err) =>
        logger.warn(`[GastosController] regenerate sync async error: ${err.message}`)
      );
      return res.json({ success: true, data: gasto });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /** Compatibilidad retrocompatible: /gastos/regenerate/:solicitudId (repuesto) */
  static async regenerateForSolicitud(req: Request, res: Response) {
    req.params.id = req.params.solicitudId;
    return GastosController.regenerate(req, res);
  }

  /**
   * Recorre todas las solicitudes y áreas de órdenes aún no cerradas,
   * garantizando un Gasto local por cada una.
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
   *   - Por defecto: sólo PENDIENTE.
   *   - ?incluirErroneos=true: incluye ERROR también (reintenta las fallidas).
   */
  static async syncToMssql(req: Request, res: Response) {
    try {
      const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : undefined;
      const incluirErroneos = req.query.incluirErroneos === 'true';
      const report = await syncGastosToMssql({ limit, incluirErroneos });
      return res.json({ success: report.failed === 0, ...report });
    } catch (err: any) {
      logger.error(`[GastosController] syncToMssql error: ${err.message}`);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Sincroniza un solo gasto (por evento). Útil desde el frontend tras
   * crear/actualizar un gasto.
   */
  static async syncOne(req: Request, res: Response) {
    try {
      const id = parseInt(String(req.params.id), 10);
      if (Number.isNaN(id)) {
        return res.status(400).json({ success: false, error: 'id inválido.' });
      }
      const report = await syncOneGastoToMssql(id);
      return res.json({ success: report.failed === 0, ...report });
    } catch (err: any) {
      logger.error(`[GastosController] syncOne error: ${err.message}`);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  /**
   * Diagnóstico: conteos por estado, total, monto agregado por tipo_origen.
   */
  static async stats(_req: Request, res: Response) {
    try {
      const [pendiente, enviado, error, total] = await Promise.all([
        Gasto.count({ where: { estado_sincronizacion: 'PENDIENTE' } }),
        Gasto.count({ where: { estado_sincronizacion: 'ENVIADO' } }),
        Gasto.count({ where: { estado_sincronizacion: 'ERROR' } }),
        Gasto.count(),
      ]);
      // Sumar monto por tipo_origen
      const [rows]: any = await Gasto.sequelize?.query(
        `SELECT tipo_origen, COUNT(*) AS n, COALESCE(SUM(monto), 0) AS total
           FROM gastos GROUP BY tipo_origen`
      ) ?? [[]];
      const porTipo = (rows || []).map((r: any) => ({
        tipo_origen: r.tipo_origen,
        n: Number(r.n),
        total: Number(r.total),
      }));
      const ordenesAbiertas = await OrdenServicio.count({
        where: { estado: { [Op.ne]: 'Cerrada' } },
      });
      return res.json({
        success: true,
        data: { total, pendiente, enviado, error, ordenesAbiertas, porTipo },
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
}

export default GastosController;
