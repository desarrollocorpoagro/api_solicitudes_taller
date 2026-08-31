import { Request } from 'express';
import { OrdenAuditLog, User } from '../models';
import { logger } from '../utils/logger';

export interface AuditLogInput {
  ordenId: string;
  otId?: string | null;
  action: string;
  fieldName?: string;
  previousValue?: any;
  newValue?: any;
  description: string;
  req?: Request;
  userId?: string | null;
  userName?: string;
  userEmail?: string;
  userRole?: string;
  ipAddress?: string | null;
}

export class AuditService {
  /**
   * Extrae la información de identidad del usuario a partir de la petición o credenciales.
   */
  public static async resolveUserContext(req?: Request, fallback?: { userId?: string | null; userName?: string; userEmail?: string; userRole?: string }) {
    if (req?.user) {
      const u = req.user;
      let userName = u.email ? u.email.split('@')[0] : 'Usuario';
      
      // Buscar nombre completo en la BD si existe userId
      if (u.userId) {
        try {
          const dbUser = await User.findByPk(u.userId);
          if (dbUser && dbUser.fullName) {
            userName = dbUser.fullName;
          }
        } catch {
          // Utilizar el nombre derivado del token si la BD no responde
        }
      }

      const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

      return {
        userId: u.userId || null,
        userName,
        userEmail: u.email || 'usuario@empresasanluis.com',
        userRole: u.role || 'OPERATIVO',
        ipAddress: clientIp.replace('::ffff:', ''),
      };
    }

    return {
      userId: fallback?.userId || null,
      userName: fallback?.userName || 'Ing. Carlos Mendoza',
      userEmail: fallback?.userEmail || 'carlos.mendoza@empresasanluis.com',
      userRole: fallback?.userRole || 'GERENTE_TALLER',
      ipAddress: '127.0.0.1',
    };
  }

  /**
   * Formatea un valor a cadena de texto amigable para auditoría.
   */
  private static serializeValue(val: any): string | null {
    if (val === undefined || val === null) return null;
    if (typeof val === 'object') {
      if (val instanceof Date) return val.toISOString();
      return JSON.stringify(val);
    }
    return String(val);
  }

  /**
   * Registra una entrada de auditoría en la bitácora de trazabilidad de la orden.
   */
  public static async recordLog(input: AuditLogInput): Promise<OrdenAuditLog | null> {
    try {
      const userCtx = await this.resolveUserContext(input.req, {
        userId: input.userId,
        userName: input.userName,
        userEmail: input.userEmail,
        userRole: input.userRole,
      });

      const prevStr = this.serializeValue(input.previousValue);
      const nextStr = this.serializeValue(input.newValue);

      const auditRecord = await OrdenAuditLog.create({
        ordenId: input.ordenId,
        otId: input.otId || null,
        action: input.action,
        fieldName: input.fieldName || 'general',
        previousValue: prevStr,
        newValue: nextStr,
        description: input.description,
        userId: userCtx.userId,
        userName: userCtx.userName,
        userEmail: userCtx.userEmail,
        userRole: userCtx.userRole,
        ipAddress: input.ipAddress || userCtx.ipAddress,
      });

      logger.info(
        `[AuditService] 📜 [${auditRecord.action}] OT: ${auditRecord.ordenId} | Campo: ${auditRecord.fieldName} | Usuario: ${auditRecord.userName} (${auditRecord.userRole})`
      );

      return auditRecord;
    } catch (err: any) {
      logger.error(`[AuditService] Error registrando auditoría en orden ${input.ordenId}: ${err.message}`);
      return null;
    }
  }

  /**
   * Compara dos objetos y registra automáticamente auditorías por cada campo modificado.
   */
  public static async recordObjectDiff(
    ordenId: string,
    otId: string | null,
    oldObj: Record<string, any>,
    newObj: Record<string, any>,
    req?: Request,
    labelsMap?: Record<string, string>
  ) {
    const changes: Array<{ field: string; prev: any; next: any }> = [];

    for (const key of Object.keys(newObj)) {
      if (oldObj[key] !== undefined && oldObj[key] !== newObj[key]) {
        changes.push({
          field: key,
          prev: oldObj[key],
          next: newObj[key],
        });
      }
    }

    for (const ch of changes) {
      const label = labelsMap?.[ch.field] || ch.field;
      await this.recordLog({
        ordenId,
        otId,
        action: 'MODIFICACION_CAMPO',
        fieldName: ch.field,
        previousValue: ch.prev,
        newValue: ch.next,
        description: `Modificación de ${label}: de "${ch.prev || '(vacío)'}" a "${ch.next || '(vacío)'}"`,
        req,
      });
    }

    return changes;
  }

  /**
   * Obtiene la bitácora completa de auditoría para una orden.
   */
  public static async getAuditTrail(ordenId: string) {
    return OrdenAuditLog.findAll({
      where: { ordenId },
      order: [['createdAt', 'DESC']],
    });
  }

  /**
   * Aliases convenientes
   */
  public static async log(input: {
    ordenId: string;
    otId?: string | null;
    action: string;
    fieldName?: string;
    previousValue?: any;
    newValue?: any;
    description: string;
    user?: { id?: number | string; fullName?: string; email?: string; role?: string };
    ipAddress?: string;
  }) {
    return this.recordLog({
      ordenId: input.ordenId,
      otId: input.otId,
      action: input.action,
      fieldName: input.fieldName,
      previousValue: input.previousValue,
      newValue: input.newValue,
      description: input.description,
      userId: input.user?.id ? String(input.user.id) : undefined,
      userName: input.user?.fullName,
      userEmail: input.user?.email,
      userRole: input.user?.role,
      ipAddress: input.ipAddress,
    });
  }

  public static async logObjectChanges(input: {
    ordenId: string;
    otId?: string | null;
    oldObject: Record<string, any>;
    newObject: Record<string, any>;
    trackedFields?: string[];
    user?: { id?: number | string; fullName?: string; email?: string; role?: string };
  }) {
    const fieldsToTrack = input.trackedFields || Object.keys(input.newObject);
    const filteredOld: Record<string, any> = {};
    const filteredNew: Record<string, any> = {};

    for (const f of fieldsToTrack) {
      if (input.oldObject[f] !== undefined) filteredOld[f] = input.oldObject[f];
      if (input.newObject[f] !== undefined) filteredNew[f] = input.newObject[f];
    }

    const changes: Array<{ field: string; prev: any; next: any }> = [];
    for (const key of Object.keys(filteredNew)) {
      if (filteredOld[key] !== undefined && filteredOld[key] !== filteredNew[key]) {
        changes.push({ field: key, prev: filteredOld[key], next: filteredNew[key] });
        await this.log({
          ordenId: input.ordenId,
          otId: input.otId,
          action: 'MODIFICACION_CAMPO',
          fieldName: key,
          previousValue: filteredOld[key],
          newValue: filteredNew[key],
          description: `Cambio en campo ${key}: "${filteredOld[key]}" -> "${filteredNew[key]}"`,
          user: input.user,
        });
      }
    }

    return changes;
  }
}
