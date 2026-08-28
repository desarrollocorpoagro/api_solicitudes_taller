import { Request, Response } from 'express';
import { Notificacion } from '../models';
import { EmailService } from '../services/email.service';
import { PushService } from '../services/push.service';
import { logger } from '../utils/logger';

export class NotificacionesController {
  /**
   * Obtiene la lista de notificaciones registradas en el sistema.
   */
  static async getNotificaciones(req: Request, res: Response) {
    try {
      const { tipo, canal } = req.query;
      const where: any = {};
      if (tipo) where.tipo = tipo;
      if (canal) where.canal = canal;

      const notificaciones = await Notificacion.findAll({
        where,
        order: [['createdAt', 'DESC']],
        limit: 50,
      });

      return res.json({
        success: true,
        count: notificaciones.length,
        data: notificaciones,
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Envía una notificación manual por correo electrónico o push.
   */
  static async sendNotification(req: Request, res: Response) {
    try {
      const { tipo, destinatarioEmail, titulo, mensaje, canal, datos } = req.body;

      if (tipo === 'EMAIL') {
        const result = await EmailService.sendEmail({
          to: destinatarioEmail || 'usuario@empresasanluis.com',
          subject: titulo,
          htmlContent: `<p>${mensaje}</p>`,
          canal: canal || 'manual',
          metadata: datos,
        });
        return res.json({ success: true, message: 'Correo enviado y registrado.', data: result });
      } else if (tipo === 'PUSH') {
        const result = await PushService.sendPush({
          title: titulo,
          body: mensaje,
          data: datos,
        });
        return res.json({ success: true, message: 'Notificación push emitida.', data: result });
      }

      const notif = await Notificacion.create({
        tipo: tipo || 'SISTEMA',
        canal: canal || 'sistema',
        destinatarioEmail,
        titulo,
        mensaje,
        datos,
        estadoEnvio: 'ENVIADO',
      });

      return res.status(201).json({ success: true, data: notif });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Suscribe un cliente al servicio de notificaciones Push.
   */
  static async subscribePush(req: Request, res: Response) {
    try {
      const { endpoint, keys } = req.body;
      const result = PushService.subscribe({
        endpoint,
        userId: req.user?.userId,
        keys,
      });
      return res.json({ success: true, message: 'Suscripción push registrada.', data: result });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Marca una notificación como leída.
   */
  static async markAsRead(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const notif = await Notificacion.findByPk(id);
      if (!notif) return res.status(404).json({ success: false, error: 'Notificación no encontrada.' });

      notif.leido = true;
      await notif.save();
      return res.json({ success: true, message: 'Notificación marcada como leída.' });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }
}

export default NotificacionesController;
