import { Request, Response } from 'express';
import { Op } from 'sequelize';
import {
  OrdenServicio,
  OrdenArea,
  SolicitudRepuesto,
  SolicitudExterno,
  Multimedia,
  Company,
  FlotaOrdenServicioProfit,
  OrdenAuditLog,
} from '../models';
import { EmailService } from '../services/email.service';
import { SyncService } from '../services/sync.service';
import { AuditService } from '../services/audit.service';
import { logger } from '../utils/logger';
import { getTenantContext, getAuthorizedPlatesForTenant } from '../utils/tenantHelper';
import { findUnidadByPlaca } from '../utils/flotaLookup';

export class OrdenController {
  /**
   * Genera un identificador único de orden de servicio con formato OS-YYYY-XXXXX.
   */
  private static async generateOrdenId(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await OrdenServicio.count();
    const seq = String(count + 1).padStart(5, '0');
    return `OS-${year}-${seq}`;
  }

  /**
   * Calcula los totales dinámicos de repuestos, mano de obra y servicios externos.
   */
  public static calculateTotals(orden: any) {
    const reps = orden.solicitudesRepuesto || [];
    const ots = orden.ordenesArea || [];
    const exts = orden.solicitudesExterno || [];

    // Solo repuestos aprobados se imputan al costo
    const totalRepuestos = reps
      .filter((r: any) => r.estadoAprobacion === 'Aprobada')
      .reduce((acc: number, r: any) => acc + Number(r.costoTotal || 0), 0);

    // Mano de obra de todas las órdenes de área
    const totalManoObra = ots.reduce((acc: number, o: any) => acc + Number(o.costoManoObra || 0), 0);

    // Servicios externos aprobados
    const totalExternos = exts
      .filter((x: any) => x.estadoAprobacion === 'Aprobada')
      .reduce((acc: number, x: any) => acc + Number(x.costoEfectivo || 0), 0);

    const serviciosGarantia = exts.filter((x: any) => x.conGarantia).length;
    const totalGeneral = parseFloat((totalRepuestos + totalManoObra + totalExternos).toFixed(2));

    return {
      totalRepuestos: parseFloat(totalRepuestos.toFixed(2)),
      totalManoObra: parseFloat(totalManoObra.toFixed(2)),
      totalExternos: parseFloat(totalExternos.toFixed(2)),
      serviciosGarantia,
      totalGeneral,
    };
  }

  /**
   * Valida los criterios necesarios para autorizar el cierre formal de la orden.
   */
  public static validateCierre(orden: any, unidad: any) {
    const pendientes: string[] = [];

    if (!unidad) {
      pendientes.push('Falta identificar la unidad vehicular en el maestro de flota.');
    }

    if (!orden.sintomas || !orden.sintomas.trim()) {
      pendientes.push('Falta registrar los síntomas reportados.');
    }

    const ots = orden.ordenesArea || [];
    if (ots.length === 0) {
      pendientes.push('No hay órdenes de área abiertas. Debe abrir al menos una.');
    }

    const otsAbiertas = ots.filter((o: any) => o.estado === 'abierta');
    if (otsAbiertas.length > 0) {
      pendientes.push(
        `${otsAbiertas.length} orden(es) de área sin cerrar: ${otsAbiertas.map((o: any) => o.id).join(', ')}.`
      );
    }

    const reps = orden.solicitudesRepuesto || [];
    const exts = orden.solicitudesExterno || [];

    const solicitudesPendientes = [...reps, ...exts].filter((s: any) => s.estadoAprobacion === 'Pendiente').length;
    if (solicitudesPendientes > 0) {
      pendientes.push(`${solicitudesPendientes} solicitud(es) sin aprobación del gerente de taller.`);
    }

    const repuestosSinEntregar = reps.filter(
      (r: any) => r.estadoAprobacion === 'Aprobada' && r.estadoEntrega !== 'Entregado'
    ).length;
    if (repuestosSinEntregar > 0) {
      pendientes.push(`${repuestosSinEntregar} repuesto(s) aprobados sin entregar por almacén.`);
    }

    if (orden.esReincidencia && !orden.motivoReincidencia) {
      pendientes.push('Falta indicar el motivo de la reincidencia detectada.');
    }

    const otsSinHoras = ots.filter((o: any) => Number(o.horas) <= 0);
    if (otsSinHoras.length > 0) {
      pendientes.push('Hay órdenes de área sin horas de mano de obra registradas.');
    }

    return {
      puedeCerrar: pendientes.length === 0,
      bloqueos: pendientes,
    };
  }

  /**
   * Apertura de una nueva Orden de Servicio de Taller.
   */
  static async createOrden(req: Request, res: Response) {
    try {
      const {
        placa,
        km,
        recibidoPor,
        entregadoPor,
        sintomas,
        esReincidencia,
        osAnterior,
        motivoReincidencia,
      } = req.body;

      const cleanPlaca = placa.toUpperCase().trim();
      const tenant = await getTenantContext(req);

      const unidad = await findUnidadByPlaca(cleanPlaca);

      if (!unidad) {
        return res.status(404).json({
          success: false,
          error: `Placa ${cleanPlaca} no encontrada en el maestro de flota. Registre la unidad antes de aperturar la orden.`,
        });
      }

      // Validar que la unidad pertenece a la empresa activa
      if (tenant) {
        const matchesId = unidad.companyId && unidad.companyId === tenant.companyId;
        const matchesName = unidad.empresa && unidad.empresa.toLowerCase() === tenant.companyName.toLowerCase();
        if (!matchesId && !matchesName) {
          return res.status(403).json({
            success: false,
            error: `Acceso denegado: No puede aperturar una orden para la unidad ${cleanPlaca} (${unidad.empresa}) desde la empresa activa (${tenant.companyName}).`,
            code: 'TENANT_ISOLATION_VIOLATION',
          });
        }
      }

      // Actualizar kilometraje en maestro de flota si es mayor
      if (km > unidad.km) {
        unidad.km = km;
        await unidad.save();
      }

      const id = await OrdenController.generateOrdenId();
      const effectiveTenantId = tenant ? tenant.companyId : (req.tenantId || unidad.companyId);

      const nuevaOrden = await OrdenServicio.create({
        id,
        tenantId: effectiveTenantId,
        placa: unidad.placa,
        km,
        recibidoPor,
        entregadoPor,
        sintomas,
        fotosCount: 0,
        esReincidencia: esReincidencia || Boolean(unidad.historialOsAnterior),
        osAnterior: osAnterior || unidad.historialOsAnterior,
        motivoReincidencia,
        estado: 'Abierta',
        fechaApertura: new Date(),
        totalRepuestos: 0,
        totalManoObra: 0,
        totalExternos: 0,
        totalGeneral: 0,
      });

      // Guardar y sincronizar simultáneamente en MSSQL Profit Plus (ad_trans.dbo.flota_ordenes_servicio)
      let syncedToMssql = false;
      try {
        await FlotaOrdenServicioProfit.create({
          nro_orden: String(nuevaOrden.id).trim().toUpperCase(),
          Placa: String(nuevaOrden.placa).trim().toUpperCase(),
          km_horometro: parseFloat(String(nuevaOrden.km)) || 0,
          recibido_por: String(nuevaOrden.recibidoPor).trim(),
          entregado_por: nuevaOrden.entregadoPor ? String(nuevaOrden.entregadoPor).trim() : null,
          fec_apertura: nuevaOrden.fechaApertura || new Date(),
          fec_cierre: null,
          sintomas_reportados: String(nuevaOrden.sintomas).trim(),
          es_reincidencia: Boolean(nuevaOrden.esReincidencia),
          nro_orden_anterior: nuevaOrden.osAnterior ? String(nuevaOrden.osAnterior).trim() : null,
          motivo_reincidencia: nuevaOrden.motivoReincidencia ? String(nuevaOrden.motivoReincidencia).trim() : null,
          fotos_adjuntas: 0,
          estatus: 'ABIERTA',
          costo_repuestos: 0.0,
          costo_mano_obra: 0.0,
          costo_servicios_ext: 0.0,
          costo_total: 0.0,
          recibe_conforme: null,
          hora_apertura: new Date(),
          hora_cierre: null,
        });
        syncedToMssql = true;
        logger.info(`[OrdenController] Orden ${nuevaOrden.id} guardada exitosamente en BD Local y en MSSQL (ad_trans.dbo.flota_ordenes_servicio)`);
      } catch (mssqlErr: any) {
        logger.warn(`[OrdenController] Encolando orden ${nuevaOrden.id} para sincronización diferida con MSSQL: ${mssqlErr.message}`);
        await SyncService.enqueueOperation({
          entityType: 'ORDEN_SERVICIO',
          entityId: nuevaOrden.id,
          operation: 'CREATE',
          payload: nuevaOrden.toJSON(),
          companyId: tenant?.companyId,
        });
      }

      // Registrar en bitácora de auditoría
      await AuditService.recordLog({
        ordenId: nuevaOrden.id,
        action: 'APERTURA_ORDEN',
        fieldName: 'id',
        newValue: nuevaOrden.id,
        description: `Apertura formal de la Orden de Servicio ${nuevaOrden.id} para la unidad ${nuevaOrden.placa} (${unidad.empresa}). Km: ${km}, Recibido por: ${recibidoPor}, Entregado por: ${entregadoPor || 'No indicado'}.${nuevaOrden.esReincidencia ? ` [Reincidencia de ${nuevaOrden.osAnterior}]` : ''}`,
        req,
      });

      // Disparar notificación por correo
      EmailService.notifyOrdenApertura(
        nuevaOrden.id,
        nuevaOrden.placa,
        nuevaOrden.sintomas,
        nuevaOrden.esReincidencia,
        unidad.empresa
      );

      logger.info(`[OrdenController] Nueva orden de servicio creada: ${nuevaOrden.id} para unidad ${nuevaOrden.placa} [Empresa: ${unidad.empresa}]`);

      return res.status(201).json({
        success: true,
        message: 'Orden de servicio aperturada exitosamente.',
        data: nuevaOrden,
        unidad,
        syncedToMssql,
      });
    } catch (error: any) {
      logger.error(`[OrdenController] Error al aperturar orden: ${error.message}`);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Obtiene la lista de órdenes de servicio registradas para la empresa activa.
   */
  static async getAllOrdenes(req: Request, res: Response) {
    try {
      const { estado, placa } = req.query;
      const where: any = {};

      if (estado) where.estado = estado;
      if (placa) where.placa = (placa as string).toUpperCase().trim();

      // Aplicar filtro estricto por tenant/empresa activa
      const tenant = await getTenantContext(req);
      if (tenant) {
        const authorizedPlates = await getAuthorizedPlatesForTenant(req);
        where[Op.or] = [
          { tenantId: tenant.companyId },
          { placa: { [Op.in]: authorizedPlates } },
        ];
      }

      const ordenes = await OrdenServicio.findAll({
        where,
        include: [
          { model: OrdenArea, as: 'ordenesArea' },
          { model: SolicitudRepuesto, as: 'solicitudesRepuesto' },
          { model: SolicitudExterno, as: 'solicitudesExterno' },
        ],
        order: [['createdAt', 'DESC']],
      });

      return res.json({
        success: true,
        count: ordenes.length,
        data: ordenes,
        activeCompany: tenant ? tenant.companyName : undefined,
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Obtiene el detalle completo de una orden de servicio con liquidación y validaciones de cierre.
   */
  static async getOrdenById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const orden = await OrdenServicio.findByPk(id, {
        include: [
          { model: OrdenArea, as: 'ordenesArea' },
          { model: SolicitudRepuesto, as: 'solicitudesRepuesto' },
          { model: SolicitudExterno, as: 'solicitudesExterno' },
          { model: Multimedia, as: 'archivosMultimedia' },
        ],
      });

      if (!orden) {
        return res.status(404).json({ success: false, error: 'Orden de servicio no encontrada.' });
      }

      const unidad = await findUnidadByPlaca(orden.placa);

      // Validar pertenencia a la empresa activa
      // Bypass: ADMIN global puede consultar órdenes de cualquier tenant.
      const tenant = await getTenantContext(req);
      const isAdminGlobal = req.user?.role?.toUpperCase() === 'ADMIN';
      if (tenant && !isAdminGlobal) {
        const matchesTenantId = orden.tenantId && orden.tenantId === tenant.companyId;
        const matchesVehicleCompany = unidad && (unidad.empresa && unidad.empresa.toLowerCase() === tenant.companyName.toLowerCase());

        if (!matchesTenantId && !matchesVehicleCompany) {
          return res.status(403).json({
            success: false,
            error: `Acceso restringido: La orden ${id} corresponde a otra empresa y no está disponible para ${tenant.companyName}.`,
            code: 'TENANT_ISOLATION_VIOLATION',
          });
        }
      }

      const totales = OrdenController.calculateTotals(orden);
      const validacionCierre = OrdenController.validateCierre(orden, unidad);

      return res.json({
        success: true,
        data: orden,
        unidad,
        liquidacion: {
          ...totales,
          empresaImputada: unidad ? unidad.empresa : 'Sin asignar',
          centroCosto: unidad ? unidad.cc : 'N/A',
        },
        validacionCierre,
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Realiza el cierre formal de la orden de servicio tras superar las validaciones de negocio.
   */
  static async cerrarOrden(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { fechaEntrega, recibeConforme } = req.body;

      const orden = await OrdenServicio.findByPk(id, {
        include: [
          { model: OrdenArea, as: 'ordenesArea' },
          { model: SolicitudRepuesto, as: 'solicitudesRepuesto' },
          { model: SolicitudExterno, as: 'solicitudesExterno' },
        ],
      });

      if (!orden) {
        return res.status(404).json({ success: false, error: 'Orden de servicio no encontrada.' });
      }

      const unidad = await findUnidadByPlaca(orden.placa);

      // Validar aislamiento multi-tenant
      // Bypass: ADMIN global puede cerrar órdenes de cualquier tenant.
      const tenant = await getTenantContext(req);
      const isAdminGlobal = req.user?.role?.toUpperCase() === 'ADMIN';
      if (tenant && !isAdminGlobal) {
        const matchesTenantId = orden.tenantId && orden.tenantId === tenant.companyId;
        const matchesVehicleCompany = unidad && (unidad.empresa && unidad.empresa.toLowerCase() === tenant.companyName.toLowerCase());
        if (!matchesTenantId && !matchesVehicleCompany) {
          return res.status(403).json({
            success: false,
            error: `Acceso denegado: No puede cerrar la orden ${id} desde ${tenant.companyName}.`,
            code: 'TENANT_ISOLATION_VIOLATION',
          });
        }
      }

      if (orden.estado === 'Cerrada') {
        return res.status(400).json({ success: false, error: 'La orden ya se encuentra cerrada.' });
      }

      const validacion = OrdenController.validateCierre(orden, unidad);

      if (!validacion.puedeCerrar) {
        return res.status(400).json({
          success: false,
          error: 'No se puede cerrar la orden debido a validaciones pendientes.',
          bloqueos: validacion.bloqueos,
        });
      }

      const totales = OrdenController.calculateTotals(orden);

      orden.estado = 'Cerrada';
      orden.fechaEntrega = fechaEntrega ? new Date(fechaEntrega) : new Date();
      orden.recibeConforme = recibeConforme;
      orden.totalRepuestos = totales.totalRepuestos;
      orden.totalManoObra = totales.totalManoObra;
      orden.totalExternos = totales.totalExternos;
      orden.totalGeneral = totales.totalGeneral;

      await orden.save();

      // Sincronizar cierre en MSSQL Profit Plus (ad_trans.dbo.flota_ordenes_servicio)
      try {
        const profitOrden = await FlotaOrdenServicioProfit.findOne({ where: { nro_orden: orden.id } });
        if (profitOrden) {
          profitOrden.estatus = 'CERRADA';
          profitOrden.fec_cierre = orden.fechaEntrega || new Date();
          profitOrden.recibe_conforme = recibeConforme ? String(recibeConforme).trim() : null;
          profitOrden.costo_repuestos = totales.totalRepuestos;
          profitOrden.costo_mano_obra = totales.totalManoObra;
          profitOrden.costo_servicios_ext = totales.totalExternos;
          profitOrden.costo_total = totales.totalGeneral;
          profitOrden.hora_cierre = new Date();
          await profitOrden.save();
          logger.info(`[OrdenController] Cierre de orden ${orden.id} sincronizado en MSSQL AD_TRANS`);
        } else {
          await SyncService.enqueueOperation({
            entityType: 'ORDEN_SERVICIO',
            entityId: orden.id,
            operation: 'UPDATE',
            payload: orden.toJSON(),
            companyId: tenant?.companyId,
          });
        }
      } catch (mssqlCloseErr: any) {
        logger.warn(`[OrdenController] Encolando cierre de orden ${orden.id} para sincronización diferida con MSSQL: ${mssqlCloseErr.message}`);
        await SyncService.enqueueOperation({
          entityType: 'ORDEN_SERVICIO',
          entityId: orden.id,
          operation: 'UPDATE',
          payload: orden.toJSON(),
          companyId: tenant?.companyId,
        });
      }

      // Si la unidad tuvo reparación mayor, actualizar historial para futuras reincidencias
      if (unidad) {
        unidad.historialOsAnterior = orden.id;
        unidad.historialDias = 0;
        unidad.historialArea = (orden.ordenesArea && orden.ordenesArea[0]?.area) || 'Taller General';
        await unidad.save();
      }

      // Registrar auditoría de cierre formal
      await AuditService.recordLog({
        ordenId: orden.id,
        action: 'CIERRE_ORDEN',
        fieldName: 'estado',
        previousValue: 'En Proceso',
        newValue: 'Cerrada',
        description: `Cierre formal y liquidación de Orden ${orden.id}. Monto Total: $${totales.totalGeneral} (Repuestos: $${totales.totalRepuestos}, MO: $${totales.totalManoObra}, Externos: $${totales.totalExternos}). Recibe Conforme: ${recibeConforme || 'Conforme'}. Fecha Entrega: ${orden.fechaEntrega?.toISOString() || new Date().toISOString()}`,
        req,
      });

      logger.info(`[OrdenController] Orden de servicio ${orden.id} cerrada satisfactoriamente con liquidación total: $${totales.totalGeneral}`);

      return res.json({
        success: true,
        message: 'Orden de servicio cerrada exitosamente. Liquidación emitida y conciliada con el ERP.',
        data: orden,
        liquidacion: totales,
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Actualiza datos generales de una Orden de Servicio existente y registra auditoría por cada campo modificado.
   */
  static async updateOrden(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { km, sintomas, recibidoPor, entregadoPor, motivoReincidencia } = req.body;

      const orden = await OrdenServicio.findByPk(id);
      if (!orden) {
        return res.status(404).json({ success: false, error: 'Orden de servicio no encontrada.' });
      }

      // Bypass: ADMIN global puede modificar órdenes de cualquier tenant.
      const tenant = await getTenantContext(req);
      const isAdminGlobal = req.user?.role?.toUpperCase() === 'ADMIN';
      if (tenant && !isAdminGlobal && orden.tenantId && orden.tenantId !== tenant.companyId) {
        return res.status(403).json({
          success: false,
          error: `Acceso denegado: No puede modificar la orden ${id} desde otra empresa.`,
          code: 'TENANT_ISOLATION_VIOLATION',
        });
      }

      if (orden.estado === 'Cerrada') {
        return res.status(400).json({
          success: false,
          error: 'No se pueden modificar datos de una orden de servicio que ya ha sido cerrada.',
        });
      }

      const labelMap: Record<string, string> = {
        km: 'Kilometraje / Horómetro',
        sintomas: 'Síntomas Reportados',
        recibidoPor: 'Recibido por (Mecánico)',
        entregadoPor: 'Entregado por (Conductor)',
        motivoReincidencia: 'Motivo de Reincidencia',
      };

      const fieldsToCheck: Array<'km' | 'sintomas' | 'recibidoPor' | 'entregadoPor' | 'motivoReincidencia'> = [
        'km',
        'sintomas',
        'recibidoPor',
        'entregadoPor',
        'motivoReincidencia',
      ];

      for (const field of fieldsToCheck) {
        if (req.body[field] !== undefined) {
          const oldVal = (orden as any)[field];
          const newVal = req.body[field];

          // Si hay cambio real
          if (String(oldVal || '') !== String(newVal || '')) {
            (orden as any)[field] = newVal;
            await AuditService.recordLog({
              ordenId: orden.id,
              action: 'MODIFICACION_CAMPO',
              fieldName: field,
              previousValue: oldVal,
              newValue: newVal,
              description: `Actualización de "${labelMap[field]}": anterior "${oldVal || '(vacío)'}" → nuevo "${newVal || '(vacío)'}"`,
              req,
            });
          }
        }
      }

      await orden.save();

      return res.json({
        success: true,
        message: 'Orden de servicio actualizada exitosamente.',
        data: orden,
      });
    } catch (error: any) {
      logger.error(`[OrdenController] Error actualizando orden: ${error.message}`);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Obtiene la bitácora completa de auditoría para una orden de servicio con filtros opcionales.
   */
  static async getAuditoriaByOrdenId(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { action, otId, fieldName, userRole, search } = req.query;

      const orden = await OrdenServicio.findByPk(id);
      if (!orden) {
        return res.status(404).json({ success: false, error: 'Orden de servicio no encontrada.' });
      }

      const where: any = { ordenId: id };

      if (action) where.action = action;
      if (otId) where.otId = otId;
      if (fieldName) where.fieldName = fieldName;
      if (userRole) where.userRole = userRole;

      if (search) {
        const s = `%${search}%`;
        where[Op.or] = [
          { description: { [Op.like]: s } },
          { userName: { [Op.like]: s } },
          { userEmail: { [Op.like]: s } },
          { fieldName: { [Op.like]: s } },
          { action: { [Op.like]: s } },
        ];
      }

      const logs = await OrdenAuditLog.findAll({
        where,
        order: [['createdAt', 'DESC']],
      });

      // Estadísticas de auditoría
      const stats = {
        totalRegistros: logs.length,
        usuariosInvolucrados: Array.from(new Set(logs.map(l => l.userName))),
        acciones: logs.reduce((acc: Record<string, number>, curr) => {
          acc[curr.action] = (acc[curr.action] || 0) + 1;
          return acc;
        }, {}),
      };

      return res.json({
        success: true,
        ordenId: id,
        count: logs.length,
        stats,
        data: logs,
      });
    } catch (error: any) {
      logger.error(`[OrdenController] Error obteniendo auditoría de orden: ${error.message}`);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Agrega una nota técnica u observación manual al historial de auditoría de la orden.
   */
  static async addManualAuditNote(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { nota, otId, categoria } = req.body;

      if (!nota || !nota.trim()) {
        return res.status(400).json({ success: false, error: 'Debe ingresar el contenido de la observación o nota técnica.' });
      }

      const orden = await OrdenServicio.findByPk(id);
      if (!orden) {
        return res.status(404).json({ success: false, error: 'Orden de servicio no encontrada.' });
      }

      const auditRecord = await AuditService.recordLog({
        ordenId: id,
        otId: otId || null,
        action: 'OBSERVACION_TECNICA',
        fieldName: categoria || 'nota_auditoria',
        newValue: nota.trim(),
        description: `Nota Técnica / Observación: ${nota.trim()}`,
        req,
      });

      return res.status(201).json({
        success: true,
        message: 'Nota u observación registrada en el historial de auditoría.',
        data: auditRecord,
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }
}

export default OrdenController;
