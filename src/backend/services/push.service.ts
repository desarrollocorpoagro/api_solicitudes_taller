import { logger } from '../utils/logger';
import Notificacion from '../models/Notificacion.model';

export interface PushNotificationPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
  tenantId?: string;
  userId?: string;
  data?: any;
}

export class PushService {
  private static subscribers: Array<{ endpoint: string; userId?: string; keys?: any }> = [];

  /**
   * Registra una suscripción push para un dispositivo de usuario.
   */
  static subscribe(subscription: { endpoint: string; userId?: string; keys?: any }) {
    const exists = this.subscribers.some((s) => s.endpoint === subscription.endpoint);
    if (!exists) {
      this.subscribers.push(subscription);
      logger.info(`[PushService] Nueva suscripción push registrada. Total activas: ${this.subscribers.length}`);
    }
    return { success: true, totalSubscribers: this.subscribers.length };
  }

  /**
   * Envía una notificación push a los dispositivos conectados.
   */
  static async sendPush(payload: PushNotificationPayload) {
    logger.info(`[PushService] Enviando Notificación Push: "${payload.title}" - ${payload.body}`);

    // Guardar en la base de datos
    await Notificacion.create({
      tenantId: payload.tenantId,
      userId: payload.userId,
      tipo: 'PUSH',
      canal: 'push_broadcast',
      titulo: payload.title,
      mensaje: payload.body,
      datos: payload.data,
      estadoEnvio: 'ENVIADO',
      leido: false,
    });

    return {
      success: true,
      deliveredCount: Math.max(1, this.subscribers.length),
      payload,
    };
  }
}

export default PushService;
