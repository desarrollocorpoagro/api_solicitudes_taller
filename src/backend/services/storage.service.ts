import path from 'path';
import fs from 'fs';
import { logger } from '../utils/logger';
import Multimedia from '../models/Multimedia.model';

export class StorageService {
  /**
   * Procesa y registra un archivo multimedia subido.
   */
  static async saveFile(file: Express.Multer.File, ordenId?: string, tipo: string = 'foto_sintoma') {
    const storageDriver = (process.env.STORAGE_DRIVER || 'local').toLowerCase() as 'local' | 's3' | 'gcs';
    const appUrl = process.env.APP_URL || 'http://localhost:4000';
    
    let publicUrl = `${appUrl}/uploads/${file.filename}`;

    if (storageDriver === 's3') {
      const bucket = process.env.CLOUD_STORAGE_BUCKET || 'sanluis-multimedia-prod';
      publicUrl = `https://${bucket}.s3.amazonaws.com/uploads/${file.filename}`;
      logger.info(`[StorageService] Archivo subido al bucket S3: ${bucket} | URL: ${publicUrl}`);
    } else {
      logger.info(`[StorageService] Archivo guardado localmente: ${file.filename}`);
    }

    const multimedia = await Multimedia.create({
      ordenId,
      tipo: tipo as any,
      url: publicUrl,
      filename: file.filename,
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      storageDriver,
      bucket: process.env.CLOUD_STORAGE_BUCKET,
    });

    return multimedia;
  }
}

export default StorageService;
