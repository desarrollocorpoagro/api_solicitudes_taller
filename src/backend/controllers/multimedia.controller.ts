import { Request, Response } from 'express';
import { StorageService } from '../services/storage.service';
import { Multimedia, OrdenServicio } from '../models';
import { logger } from '../utils/logger';

export class MultimediaController {
  /**
   * Sube un archivo fotográfico o documento para adjuntar a una orden de servicio o inspección.
   */
  static async uploadFile(req: Request, res: Response) {
    try {
      const file = req.file;
      const { ordenId, tipo } = req.body;

      if (!file) {
        return res.status(400).json({ success: false, error: 'No se ha proporcionado ningún archivo para subir.' });
      }

      const multimedia = await StorageService.saveFile(file, ordenId, tipo || 'foto_sintoma');

      // Si viene con ordenId, incrementar el contador de fotos en la orden
      if (ordenId) {
        const orden = await OrdenServicio.findByPk(ordenId);
        if (orden) {
          orden.fotosCount = (orden.fotosCount || 0) + 1;
          await orden.save();
        }
      }

      logger.info(`[MultimediaController] Archivo subido exitosamente: ${file.originalname} -> ${multimedia.url}`);

      return res.status(201).json({
        success: true,
        message: 'Archivo multimedia subido y registrado exitosamente.',
        data: multimedia,
      });
    } catch (error: any) {
      logger.error(`[MultimediaController] Error al subir archivo: ${error.message}`);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Obtiene los archivos multimedia asociados a una orden.
   */
  static async getFilesByOrden(req: Request, res: Response) {
    try {
      const { ordenId } = req.params;
      const files = await Multimedia.findAll({ where: { ordenId } });
      return res.json({ success: true, count: files.length, data: files });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }
}

export default MultimediaController;
