import { Request, Response } from 'express';
import { MasterSyncService } from '../services/masterSync.service';
import { logger } from '../utils/logger';

export class MasterSyncController {
  /**
   * @route POST /api/v1/profit/sync/master
   * @desc Ejecuta la sincronización bidireccional de datos maestros entre la BD local
   *       y la base remota MSSQL (Profit Plus AD_TRANS). Compara conteos, identifica
   *       registros faltantes en cada extremo y los inserta automáticamente.
   */
  public static async runMasterSync(req: Request, res: Response): Promise<Response> {
    try {
      const entitiesRaw = (req.body?.entities as string[] | string | undefined) || ['mecanicos', 'vendedores', 'articulos'];
      const validEntities: Array<'mecanicos' | 'vendedores' | 'articulos' | 'flota_ordenes_servicio'> = [
        'mecanicos',
        'vendedores',
        'articulos',
        'flota_ordenes_servicio',
      ];
      const entities = Array.isArray(entitiesRaw)
        ? entitiesRaw.filter((e): e is 'mecanicos' | 'vendedores' | 'articulos' | 'flota_ordenes_servicio' =>
            validEntities.includes(e as 'mecanicos' | 'vendedores' | 'articulos' | 'flota_ordenes_servicio')
          )
        : validEntities;

      logger.info(`[MasterSyncController] Solicitud de sincronización bidireccional. Entidades: ${entities.join(', ')}`);
      const report = await MasterSyncService.runMasterBidirectionalSync({ entities });

      return res.json({
        success: true,
        timestamp: new Date().toISOString(),
        entidades: entities,
        reporte: report,
        resumen: {
          totalInsertLocal: Object.values(report).reduce((acc, r) => acc + r.insertedLocal, 0),
          totalInsertRemote: Object.values(report).reduce((acc, r) => acc + r.insertedRemote, 0),
          totalUpdateLocal: Object.values(report).reduce((acc, r) => acc + r.updatedLocal, 0),
          totalUpdateRemote: Object.values(report).reduce((acc, r) => acc + r.updatedRemote, 0),
          totalErrors: Object.values(report).reduce((acc, r) => acc + r.errors.length, 0),
        },
      });
    } catch (error: any) {
      logger.error(`[MasterSyncController] Error al ejecutar sincronización maestra: ${error.message}`);
      return res.status(500).json({
        success: false,
        error: 'Error al ejecutar la sincronización bidireccional',
        details: error.message,
      });
    }
  }

  /**
   * @route GET /api/v1/profit/sync/master/last-report
   * @desc Devuelve el último reporte de sincronización maestra ejecutado.
   */
  public static async getLastReport(_req: Request, res: Response): Promise<Response> {
    const last = MasterSyncService.getLastReport();
    if (!last) {
      return res.status(404).json({
        success: false,
        error: 'Aún no se ha ejecutado ninguna sincronización maestra.',
      });
    }
    return res.json({
      success: true,
      timestamp: new Date().toISOString(),
      reporte: last,
    });
  }

  /**
   * @route GET /api/v1/profit/sync/master/status
   * @desc Devuelve el estado actual del motor de sincronización maestra.
   */
  public static async getStatus(_req: Request, res: Response): Promise<Response> {
    return res.json({
      success: true,
      isRunning: MasterSyncService.isSyncing(),
      hasReport: MasterSyncService.getLastReport() !== null,
      timestamp: new Date().toISOString(),
    });
  }
}

export default MasterSyncController;