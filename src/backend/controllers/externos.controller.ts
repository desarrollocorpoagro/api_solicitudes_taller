import { Request, Response } from 'express';
import { SolicitudExterno, OrdenServicio, OrdenArea } from '../models';
import { EmailService } from '../services/email.service';
import { logger } from '../utils/logger';

export class ExternosController {
  /**
   * Agrega una solicitud de servicio externo a una orden de área.
   */
  static async createSolicitud(req: Request, res: Response) {
    try {
      const { id: ordenId } = req.params;
      const { otId, proveedor, descripcion, conGarantia, ordenOrigenGarantia, costoCotizado } = req.body;

      const orden = await OrdenServicio.findByPk(ordenId);
      if (!orden) return res.status(404).json({ success: false, error: 'Orden de servicio no encontrada.' });

      const area = await OrdenArea.findOne({ where: { id: otId, ordenId } });
      if (!area) return res.status(404).json({ success: false, error: 'Orden de área no encontrada.' });

      const isGarantia = Boolean(conGarantia);
      const costo = isGarantia ? 0.0 : parseFloat(costoCotizado || '0');
      const requiereEscalamiento = costo > 500;

      const solicitud = await SolicitudExterno.create({
        ordenId,
        otId,
        proveedor,
        descripcion,
        conGarantia: isGarantia,
        ordenOrigenGarantia: isGarantia ? ordenOrigenGarantia : undefined,
        costoCotizado: parseFloat(costoCotizado || '0'),
        costoEfectivo: costo,
        estadoAprobacion: 'Pendiente',
        requiereEscalamiento,
      });

      if (requiereEscalamiento) {
        EmailService.notifyEscalamientoFlota(descripcion, costo, ordenId, otId);
      }

      logger.info(`[ExternosController] Solicitud de servicio externo creada: ${descripcion} (${proveedor}) para ${ordenId}`);

      return res.status(201).json({
        success: true,
        message: 'Solicitud de servicio externo agregada.',
        data: solicitud,
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Anula una solicitud de servicio externo.
   */
  static async deleteSolicitud(req: Request, res: Response) {
    try {
      const { id: ordenId, extId } = req.params;

      const solicitud = await SolicitudExterno.findOne({ where: { id: extId, ordenId } });
      if (!solicitud) return res.status(404).json({ success: false, error: 'Solicitud externa no encontrada.' });

      await solicitud.destroy();
      logger.info(`[ExternosController] Solicitud de servicio externo ${extId} anulada.`);

      return res.json({
        success: true,
        message: 'Solicitud de servicio externo anulada.',
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }
}

export default ExternosController;
