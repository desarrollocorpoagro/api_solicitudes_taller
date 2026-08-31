import { Request, Response } from 'express';
import { SyncService } from '../services/sync.service';
import { logger } from '../utils/logger';

export class SyncController {
  /**
   * Obtiene el estado actual de sincronización y conectividad con MSSQL Server
   */
  public static async getStatus(req: Request, res: Response): Promise<Response> {
    try {
      const status = await SyncService.getSyncStatus();
      return res.json({
        success: true,
        data: status,
      });
    } catch (error: any) {
      logger.error(`[SyncController] Error obteniendo estado de sincronización: ${error.message}`);
      return res.status(500).json({
        success: false,
        error: 'Error consultando estado de sincronización.',
        details: error.message,
      });
    }
  }

  /**
   * Dispara manualmente una sincronización bidireccional inmediata
   */
  public static async triggerSync(req: Request, res: Response): Promise<Response> {
    try {
      const forced = req.body?.forced === true;
      const result = await SyncService.runBidirectionalSync(forced);
      return res.json({
        success: result.success,
        data: result,
      });
    } catch (error: any) {
      logger.error(`[SyncController] Error ejecutando sincronización: ${error.message}`);
      return res.status(500).json({
        success: false,
        error: 'Error al ejecutar sincronización.',
        details: error.message,
      });
    }
  }

  /**
   * Obtiene la cola de operaciones registradas localmente
   */
  public static async getQueue(req: Request, res: Response): Promise<Response> {
    try {
      const limit = parseInt(String(req.query.limit || '50'), 10);
      const items = await SyncService.getQueueItems(limit);
      return res.json({
        success: true,
        count: items.length,
        data: items,
      });
    } catch (error: any) {
      logger.error(`[SyncController] Error listando cola de sincronización: ${error.message}`);
      return res.status(500).json({
        success: false,
        error: 'Error listando cola de sincronización.',
        details: error.message,
      });
    }
  }

  /**
   * Reintenta las operaciones fallidas
   */
  public static async retryFailed(req: Request, res: Response): Promise<Response> {
    try {
      const result = await SyncService.retryFailed();
      return res.json({
        success: true,
        message: `${result.resetCount} operaciones fallidas fueron re-encoladas para sincronización.`,
        data: result,
      });
    } catch (error: any) {
      logger.error(`[SyncController] Error reintentando fallidos: ${error.message}`);
      return res.status(500).json({
        success: false,
        error: 'Error reintentando operaciones fallidas.',
        details: error.message,
      });
    }
  }

  /**
   * Alterna el modo de desconexión simulada para pruebas offline-first
   */
  public static async toggleSimulatedOffline(req: Request, res: Response): Promise<Response> {
    try {
      const simulate = Boolean(req.body?.simulate);
      const currentSimulated = SyncService.toggleSimulatedOffline(simulate);
      const status = await SyncService.getSyncStatus();
      return res.json({
        success: true,
        message: simulate
          ? 'Modo Offline Simulado activado: Las operaciones se guardarán exclusivamente en BD Local.'
          : 'Modo Offline Simulado desactivado: Se ha restablecido el enlace y se ejecutará sincronización automática.',
        data: status,
      });
    } catch (error: any) {
      logger.error(`[SyncController] Error alternando modo offline simulado: ${error.message}`);
      return res.status(500).json({
        success: false,
        error: 'Error alternando modo offline.',
        details: error.message,
      });
    }
  }
}

export default SyncController;
