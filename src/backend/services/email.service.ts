import { logger } from '../utils/logger';
import Notificacion from '../models/Notificacion.model';

export interface EmailPayload {
  to: string;
  subject: string;
  htmlContent: string;
  tenantId?: string;
  userId?: string;
  canal?: string;
  metadata?: any;
}

export class EmailService {
  /**
   * Envía un correo electrónico transaccional y guarda la traza en la base de datos.
   */
  static async sendEmail(payload: EmailPayload): Promise<{ success: boolean; messageId: string }> {
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    try {
      logger.info(`[EmailService] Simulando envío de email a: ${payload.to} | Asunto: "${payload.subject}" [ID: ${messageId}]`);

      // Registro de la notificación en base de datos
      await Notificacion.create({
        tenantId: payload.tenantId,
        userId: payload.userId,
        destinatarioEmail: payload.to,
        tipo: 'EMAIL',
        canal: payload.canal || 'orden_servicio',
        titulo: payload.subject,
        mensaje: payload.htmlContent.replace(/<[^>]*>?/gm, '').substring(0, 300),
        datos: { ...payload.metadata, messageId },
        estadoEnvio: 'ENVIADO',
        leido: false,
      });

      return { success: true, messageId };
    } catch (error: any) {
      logger.error(`[EmailService] Error al registrar notificación de email: ${error.message}`);
      return { success: false, messageId };
    }
  }

  /**
   * Notificación para el Gerente de Taller y Responsable de Flota cuando se abre una orden o se detecta reincidencia.
   */
  static async notifyOrdenApertura(ordenId: string, placa: string, sintomas: string, esReincidencia: boolean, empresa: string) {
    const subject = esReincidencia
      ? `🚨 [ALERTA REINCIDENCIA] Orden ${ordenId} — Placa ${placa}`
      : `📋 [Nueva Orden de Servicio] ${ordenId} — Unidad ${placa}`;

    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #003366; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #003366; color: #ffffff; padding: 16px; text-align: center;">
          <h2 style="margin: 0; color: #95C800;">GRUPO SAN LUIS — TALLER</h2>
          <p style="margin: 4px 0 0 0; font-size: 14px;">Notificación de Apertura de Orden</p>
        </div>
        <div style="padding: 20px; color: #12232E;">
          <p><strong>Número de Orden:</strong> ${ordenId}</p>
          <p><strong>Placa / Unidad:</strong> ${placa} (${empresa})</p>
          <p><strong>Síntomas Reportados:</strong> ${sintomas}</p>
          ${
            esReincidencia
              ? '<div style="background-color: #FBEAE8; border-left: 4px solid #C0342B; padding: 10px; margin: 10px 0; color: #8E2620;"><strong>Atención:</strong> Se ha detectado una reincidencia técnica en esta unidad. Se requiere revisión prioritaria.</div>'
              : ''
          }
        </div>
      </div>
    `;

    return this.sendEmail({
      to: 'gerente.taller@empresasanluis.com',
      subject,
      htmlContent: html,
      canal: 'apertura_orden',
      metadata: { ordenId, placa, esReincidencia },
    });
  }

  /**
   * Notificación de escalamiento cuando un repuesto o servicio supera el umbral configurado ($500).
   */
  static async notifyEscalamientoFlota(itemNombre: string, monto: number, ordenId: string, otId: string) {
    const subject = `⚠️ [ESCALAMIENTO REQUERIDO] Solicitud > $500 en Orden ${ordenId}`;
    const html = `
      <div style="font-family: sans-serif; padding: 20px; border: 1px solid #D18700;">
        <h3 style="color: #003366;">Aprobación de Flota Requerida</h3>
        <p>El ítem <strong>${itemNombre}</strong> en la orden <strong>${ordenId} (${otId})</strong> tiene un costo de <strong>$${monto.toFixed(
      2
    )}</strong>, superando el umbral de $500.00.</p>
        <p>Por favor ingrese al panel web para otorgar la firma de autorización.</p>
      </div>
    `;

    return this.sendEmail({
      to: 'flota@empresasanluis.com',
      subject,
      htmlContent: html,
      canal: 'escalamiento_flota',
      metadata: { itemNombre, monto, ordenId, otId },
    });
  }
}

export default EmailService;
