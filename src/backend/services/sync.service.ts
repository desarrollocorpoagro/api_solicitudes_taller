import { Op } from 'sequelize';
import {
  SyncQueue,
  OrdenServicio,
  FlotaOrdenServicioProfit,
  CatalogoRepuesto,
  VwFlotaArticulos,
  MecanicosProfit,
  Company,
  OrdenArea,
  SolicitudRepuesto,
  SolicitudExterno,
} from '../models';
import { profitSequelize, getProfitConnectionStatus } from '../config/profitDb';
import { logger } from '../utils/logger';

export interface SyncStatusReport {
  isOnline: boolean;
  mode: 'ONLINE' | 'OFFLINE_AUTONOMOUS';
  isSimulatedOffline: boolean;
  pendingCount: number;
  syncedCount: number;
  failedCount: number;
  lastSyncAt: Date | null;
  lastCheckAt: Date | null;
  latencyMs: number;
  server: string;
  database: string;
  dialect: string;
  fallback: boolean;
  isSyncRunning: boolean;
}

export interface SyncRunResult {
  success: boolean;
  outboundSynced: number;
  outboundFailed: number;
  inboundSynced: number;
  pendingRemaining: number;
  durationMs: number;
  isOnline: boolean;
  message: string;
  timestamp: string;
}

export class SyncService {
  private static isOnline = true;
  private static isSimulatedOffline = false;
  private static lastCheckAt: Date | null = null;
  private static lastSyncAt: Date | null = null;
  private static isSyncRunning = false;
  private static timer: NodeJS.Timeout | null = null;
  private static lastLatencyMs = 0;

  /**
   * Verifica el estado de conectividad con MSSQL Server (Profit Plus / AD_TRANS)
   */
  public static async checkConnectivity(): Promise<boolean> {
    this.lastCheckAt = new Date();

    if (this.isSimulatedOffline) {
      this.isOnline = false;
      return false;
    }

    const status = await getProfitConnectionStatus();
    this.lastLatencyMs = status.latencyMs || 0;
    const wasOffline = !this.isOnline;
    this.isOnline = status.connected;

    if (wasOffline && this.isOnline) {
      logger.info(`[SyncService] 🟢 Enlace con Microsoft SQL Server (${status.server}/${status.database}) restablecido. Iniciando sincronización automática de operaciones pendientes...`);
      // Disparar sincronización inmediata al reconectar
      this.runBidirectionalSync().catch((err) => {
        logger.error(`[SyncService] Error en sincronización post-reconexión: ${err.message}`);
      });
    }

    return this.isOnline;
  }

  /**
   * Registra una operación en la cola de sincronización local (Offline-First)
   */
  public static async enqueueOperation(params: {
    entityType: 'ORDEN_SERVICIO' | 'ORDEN_AREA' | 'SOLICITUD_REPUESTO' | 'SOLICITUD_EXTERNO' | 'MAESTRO_FLOTA' | 'CATALOGO_REPUESTO';
    entityId: string;
    operation: 'CREATE' | 'UPDATE' | 'DELETE' | 'STATUS_CHANGE';
    payload: any;
    source?: string;
    companyId?: string | null;
  }): Promise<SyncQueue> {
    const serializedPayload = typeof params.payload === 'string' ? params.payload : JSON.stringify(params.payload);

    const queueItem = await SyncQueue.create({
      entityType: params.entityType,
      entityId: params.entityId,
      operation: params.operation,
      payload: serializedPayload,
      status: 'PENDING',
      retryCount: 0,
      maxRetries: 5,
      source: params.source || 'LOCAL_NODE',
      companyId: params.companyId || null,
    });

    logger.info(`[SyncService] 📥 Operación [${params.operation}] para [${params.entityType} ${params.entityId}] almacenada localmente en cola.`);

    // Si estamos en línea y no hay sincronización en curso, intentar sincronizar de inmediato
    if (this.isOnline && !this.isSimulatedOffline && !this.isSyncRunning) {
      this.processSingleQueueItem(queueItem).catch((err) => {
        logger.warn(`[SyncService] No se pudo sincronizar de inmediato (${err.message}). Permanecerá en cola para el próximo ciclo.`);
      });
    }

    return queueItem;
  }

  /**
   * Ejecuta el proceso completo de sincronización bidireccional:
   * 1. Outbound: Envía operaciones registradas fuera de línea hacia MSSQL (Profit Plus)
   * 2. Inbound: Descarga y actualiza cambios pendientes desde MSSQL hacia la BD Local
   */
  public static async runBidirectionalSync(forced = false): Promise<SyncRunResult> {
    if (this.isSyncRunning) {
      if (forced) {
        // Esperar brevemente a que el ciclo en curso culmine
        let waited = 0;
        while (this.isSyncRunning && waited < 2000) {
          await new Promise((r) => setTimeout(r, 100));
          waited += 100;
        }
        if (this.isSyncRunning) {
          return {
            success: true,
            outboundSynced: 0,
            outboundFailed: 0,
            inboundSynced: 0,
            pendingRemaining: await this.getPendingCount(),
            durationMs: 0,
            isOnline: this.isOnline,
            message: 'Sincronización en curso finalizada.',
            timestamp: new Date().toISOString(),
          };
        }
      } else {
        return {
          success: false,
          outboundSynced: 0,
          outboundFailed: 0,
          inboundSynced: 0,
          pendingRemaining: await this.getPendingCount(),
          durationMs: 0,
          isOnline: this.isOnline,
          message: 'Un ciclo de sincronización ya se encuentra en ejecución.',
          timestamp: new Date().toISOString(),
        };
      }
    }

    const startTime = Date.now();
    this.isSyncRunning = true;

    try {
      // 1. Validar conectividad con MSSQL
      const reachable = await this.checkConnectivity();
      if (!reachable && !forced) {
        const pending = await this.getPendingCount();
        return {
          success: false,
          outboundSynced: 0,
          outboundFailed: 0,
          inboundSynced: 0,
          pendingRemaining: pending,
          durationMs: Date.now() - startTime,
          isOnline: false,
          message: 'Sin enlace con MSSQL Server. Operando en modo local autónomo (offline-first).',
          timestamp: new Date().toISOString(),
        };
      }

      logger.info(`[SyncService] 🔄 Iniciando sincronización bidireccional (Local <-> MSSQL Profit Plus)...`);

      // 2. Outbound Sync: Procesar operaciones locales pendientes
      const pendingItems = await SyncQueue.findAll({
        where: {
          status: { [Op.in]: ['PENDING', 'FAILED'] },
          retryCount: { [Op.lt]: 5 },
        },
        order: [['createdAt', 'ASC']],
      });

      let outboundSynced = 0;
      let outboundFailed = 0;

      for (const item of pendingItems) {
        const success = await this.processSingleQueueItem(item);
        if (success) {
          outboundSynced++;
        } else {
          outboundFailed++;
        }
      }

      // 3. Inbound Sync: Descargar y actualizar datos maestros y órdenes desde MSSQL
      let inboundSynced = 0;
      try {
        inboundSynced = await this.syncInboundFromMssql();
      } catch (inboundErr: any) {
        logger.warn(`[SyncService] Advertencia en descarga Inbound desde MSSQL: ${inboundErr.message}`);
      }

      this.lastSyncAt = new Date();
      const remainingPending = await this.getPendingCount();
      const duration = Date.now() - startTime;

      logger.info(
        `[SyncService] ✅ Sincronización completada en ${duration}ms. Salida enviada: ${outboundSynced}, Fallidas: ${outboundFailed}, Entrada actualizada: ${inboundSynced}, Pendientes restantes: ${remainingPending}`
      );

      return {
        success: true,
        outboundSynced,
        outboundFailed,
        inboundSynced,
        pendingRemaining: remainingPending,
        durationMs: duration,
        isOnline: this.isOnline,
        message: `Sincronización completada exitosamente (${outboundSynced} enviadas, ${inboundSynced} recibidas).`,
        timestamp: this.lastSyncAt.toISOString(),
      };
    } catch (error: any) {
      logger.error(`[SyncService] Error crítico durante la sincronización: ${error.message}`);
      return {
        success: false,
        outboundSynced: 0,
        outboundFailed: 0,
        inboundSynced: 0,
        pendingRemaining: await this.getPendingCount(),
        durationMs: Date.now() - startTime,
        isOnline: this.isOnline,
        message: `Error de sincronización: ${error.message}`,
        timestamp: new Date().toISOString(),
      };
    } finally {
      this.isSyncRunning = false;
    }
  }

  /**
   * Procesa un registro individual de la cola de sincronización
   */
  private static async processSingleQueueItem(item: SyncQueue): Promise<boolean> {
    item.status = 'SYNCING';
    item.lastAttemptAt = new Date();
    await item.save();

    try {
      if (item.entityType === 'ORDEN_SERVICIO') {
        await this.syncOrdenServicioOutbound(item.entityId, item.payload);
      } else if (item.entityType === 'ORDEN_AREA') {
        await this.syncOrdenAreaOutbound(item.entityId, item.payload);
      } else if (item.entityType === 'SOLICITUD_REPUESTO') {
        await this.syncSolicitudRepuestoOutbound(item.entityId, item.payload);
      }

      item.status = 'SYNCED';
      item.syncedAt = new Date();
      item.lastError = null;
      await item.save();
      logger.info(`[SyncService]  Item [${item.entityType} ${item.entityId}] sincronizado exitosamente con MSSQL.`);
      return true;
    } catch (err: any) {
      item.retryCount += 1;
      item.lastError = err.message || String(err);
      item.status = item.retryCount >= item.maxRetries ? 'FAILED' : 'PENDING';
      await item.save();
      logger.warn(`[SyncService]  Error sincronizando [${item.entityType} ${item.entityId}] (Intento ${item.retryCount}/${item.maxRetries}): ${item.lastError}`);
      return false;
    }
  }

  /**
   * Sincroniza una Orden de Servicio Local hacia MSSQL (ad_trans.dbo.flota_ordenes_servicio)
   */
  private static async syncOrdenServicioOutbound(ordenId: string, payloadStr: string): Promise<void> {
    const localOrden = await OrdenServicio.findByPk(ordenId);
    let payloadData: any = {};
    try {
      payloadData = JSON.parse(payloadStr);
    } catch {
      payloadData = {};
    }

    const nroOrden = String(ordenId).trim().toUpperCase();
    const placa = (localOrden?.placa || payloadData.placa || 'SIN-PLACA').trim().toUpperCase();
    const km = parseFloat(String(localOrden?.km ?? payloadData.km ?? 0)) || 0;
    const recibidoPor = String(localOrden?.recibidoPor || payloadData.recibidoPor || 'MEC-001').trim();
    const entregadoPor = localOrden?.entregadoPor || payloadData.entregadoPor ? String(localOrden?.entregadoPor || payloadData.entregadoPor).trim() : null;
    const sintomas = String(localOrden?.sintomas || payloadData.sintomas || '').trim();
    const esReincidencia = Boolean(localOrden?.esReincidencia ?? payloadData.esReincidencia);
    const osAnterior = localOrden?.osAnterior || payloadData.osAnterior ? String(localOrden?.osAnterior || payloadData.osAnterior).trim() : null;
    const motivoReincidencia = localOrden?.motivoReincidencia || payloadData.motivoReincidencia ? String(localOrden?.motivoReincidencia || payloadData.motivoReincidencia).trim() : null;
    const estado = localOrden?.estado || payloadData.estado || 'Abierta';
    const estatusProfit = estado === 'Cerrada' ? 'CERRADA' : 'ABIERTA';

    const costoRep = parseFloat(String(localOrden?.totalRepuestos ?? payloadData.totalRepuestos ?? 0)) || 0;
    const costoMo = parseFloat(String(localOrden?.totalManoObra ?? payloadData.totalManoObra ?? 0)) || 0;
    const costoExt = parseFloat(String(localOrden?.totalExternos ?? payloadData.totalExternos ?? 0)) || 0;
    const costoTot = parseFloat(String(localOrden?.totalGeneral ?? payloadData.totalGeneral ?? 0)) || 0;

    const fechaApertura = localOrden?.fechaApertura || (payloadData.fechaApertura ? new Date(payloadData.fechaApertura) : new Date());
    const fechaCierre = localOrden?.fechaEntrega ? new Date(localOrden.fechaEntrega) : payloadData.fechaEntrega ? new Date(payloadData.fechaEntrega) : null;
    const recibeConforme = localOrden?.recibeConforme || payloadData.recibeConforme || null;

    // Buscar si ya existe en Profit Plus MSSQL
    const [profitRecord, created] = await FlotaOrdenServicioProfit.findOrCreate({
      where: { nro_orden: nroOrden },
      defaults: {
        nro_orden: nroOrden,
        Placa: placa,
        km_horometro: km,
        recibido_por: recibidoPor,
        entregado_por: entregadoPor,
        fec_apertura: fechaApertura,
        fec_cierre: fechaCierre,
        sintomas_reportados: sintomas,
        es_reincidencia: esReincidencia,
        nro_orden_anterior: osAnterior,
        motivo_reincidencia: motivoReincidencia,
        fotos_adjuntas: localOrden?.fotosCount || 0,
        estatus: estatusProfit,
        costo_repuestos: costoRep,
        costo_mano_obra: costoMo,
        costo_servicios_ext: costoExt,
        costo_total: costoTot,
        recibe_conforme: recibeConforme,
        hora_apertura: fechaApertura,
        hora_cierre: fechaCierre,
      },
    });

    if (!created && profitRecord) {
      // Actualizar registro existente
      profitRecord.Placa = placa;
      profitRecord.km_horometro = km;
      profitRecord.recibido_por = recibidoPor;
      profitRecord.entregado_por = entregadoPor;
      profitRecord.sintomas_reportados = sintomas;
      profitRecord.es_reincidencia = esReincidencia;
      profitRecord.nro_orden_anterior = osAnterior;
      profitRecord.motivo_reincidencia = motivoReincidencia;
      profitRecord.estatus = estatusProfit;
      profitRecord.costo_repuestos = costoRep;
      profitRecord.costo_mano_obra = costoMo;
      profitRecord.costo_servicios_ext = costoExt;
      profitRecord.costo_total = costoTot;
      profitRecord.recibe_conforme = recibeConforme;
      if (fechaCierre) {
        profitRecord.fec_cierre = fechaCierre;
        profitRecord.hora_cierre = fechaCierre;
      }
      await profitRecord.save();
    }
  }

  /**
   * Sincroniza una Orden de Área hacia MSSQL
   */
  private static async syncOrdenAreaOutbound(areaId: string, payloadStr: string): Promise<void> {
    const area = await OrdenArea.findByPk(areaId);
    if (!area) return;
    // Si la orden principal existe en MSSQL, actualizar totales
    const profitOrden = await FlotaOrdenServicioProfit.findOne({ where: { nro_orden: area.ordenId } });
    if (profitOrden) {
      const orden = await OrdenServicio.findByPk(area.ordenId);
      if (orden) {
        profitOrden.costo_mano_obra = orden.totalManoObra;
        profitOrden.costo_total = orden.totalGeneral;
        await profitOrden.save();
      }
    }
  }

  /**
   * Sincroniza Solicitudes de Repuesto hacia MSSQL
   */
  private static async syncSolicitudRepuestoOutbound(solicitudId: string, payloadStr: string): Promise<void> {
    const solicitud = await SolicitudRepuesto.findByPk(solicitudId);
    if (!solicitud) return;
    const profitOrden = await FlotaOrdenServicioProfit.findOne({ where: { nro_orden: solicitud.ordenId } });
    if (profitOrden) {
      const orden = await OrdenServicio.findByPk(solicitud.ordenId);
      if (orden) {
        profitOrden.costo_repuestos = orden.totalRepuestos;
        profitOrden.costo_total = orden.totalGeneral;
        await profitOrden.save();
      }
    }
  }

  /**
   * Sincronización Inbound: Descarga y actualiza catálogos y órdenes desde MSSQL hacia la BD Local
   */
  private static async syncInboundFromMssql(): Promise<number> {
    let count = 0;

    // 1. Sincronizar artículos de vw_flota_articulos hacia CatalogoRepuesto local
    try {
      const articulosProfit = await VwFlotaArticulos.findAll({ limit: 100 });
      for (const art of articulosProfit) {
        const [repuesto, created] = await CatalogoRepuesto.findOrCreate({
          where: { cod: art.codigo_profit },
          defaults: {
            cod: art.codigo_profit,
            desc: art.nombre_producto,
            categoria: art.categoria || 'General',
            stock: Math.floor(art.stock_act || 0),
            costo: art.costo || 0,
            almacen: art.almacen || 'ALM-01',
          },
        });

        if (!created && repuesto) {
          repuesto.stock = Math.floor(art.stock_act || 0);
          repuesto.costo = art.costo || 0;
          await repuesto.save();
        }
        count++;
      }
    } catch (artErr: any) {
      logger.warn(`[SyncService] Error sincronizando catálogo de artículos: ${artErr.message}`);
    }

    // 2. Sincronizar órdenes que hayan sido cerradas o modificadas directamente en Profit MSSQL
    try {
      const profitOrders = await FlotaOrdenServicioProfit.findAll({ limit: 50 });
      const defaultCompany = await Company.findOne();
      const defaultTenantId = defaultCompany?.id || '11111111-1111-1111-1111-111111111111';

      for (const po of profitOrders) {
        const localOrden = await OrdenServicio.findByPk(po.nro_orden);
        if (!localOrden) {
          await OrdenServicio.create({
            id: po.nro_orden,
            tenantId: defaultTenantId,
            placa: po.Placa,
            km: po.km_horometro,
            recibidoPor: po.recibido_por,
            entregadoPor: po.entregado_por || '',
            sintomas: po.sintomas_reportados,
            fotosCount: po.fotos_adjuntas || 0,
            esReincidencia: Boolean(po.es_reincidencia),
            osAnterior: po.nro_orden_anterior || undefined,
            motivoReincidencia: po.motivo_reincidencia || undefined,
            estado: po.estatus === 'CERRADA' ? 'Cerrada' : 'Abierta',
            fechaApertura: po.fec_apertura || new Date(),
            fechaEntrega: po.fec_cierre || undefined,
            recibeConforme: po.recibe_conforme || undefined,
            totalRepuestos: po.costo_repuestos || 0,
            totalManoObra: po.costo_mano_obra || 0,
            totalExternos: po.costo_servicios_ext || 0,
            totalGeneral: po.costo_total || 0,
          });
          count++;
        } else if (po.estatus === 'CERRADA' && localOrden.estado !== 'Cerrada') {
          localOrden.estado = 'Cerrada';
          localOrden.fechaEntrega = po.fec_cierre || new Date();
          localOrden.recibeConforme = po.recibe_conforme || localOrden.recibeConforme;
          localOrden.totalGeneral = po.costo_total || localOrden.totalGeneral;
          await localOrden.save();
          count++;
        }
      }
    } catch (orderErr: any) {
      logger.warn(`[SyncService] Error sincronizando órdenes desde MSSQL: ${orderErr.message}`);
    }

    return count;
  }

  /**
   * Obtiene la cantidad de operaciones pendientes en cola
   */
  public static async getPendingCount(): Promise<number> {
    try {
      return await SyncQueue.count({
        where: {
          status: { [Op.in]: ['PENDING', 'FAILED'] },
        },
      });
    } catch {
      return 0;
    }
  }

  /**
   * Obtiene el reporte completo del estado de sincronización
   */
  public static async getSyncStatus(): Promise<SyncStatusReport> {
    const pendingCount = await this.getPendingCount();
    const syncedCount = await SyncQueue.count({ where: { status: 'SYNCED' } }).catch(() => 0);
    const failedCount = await SyncQueue.count({ where: { status: 'FAILED' } }).catch(() => 0);

    const profitConn = await getProfitConnectionStatus();
    const effectiveOnline = this.isSimulatedOffline ? false : profitConn.connected;

    return {
      isOnline: effectiveOnline,
      mode: effectiveOnline ? 'ONLINE' : 'OFFLINE_AUTONOMOUS',
      isSimulatedOffline: this.isSimulatedOffline,
      pendingCount,
      syncedCount,
      failedCount,
      lastSyncAt: this.lastSyncAt,
      lastCheckAt: this.lastCheckAt || new Date(),
      latencyMs: profitConn.latencyMs || 0,
      server: profitConn.server,
      database: profitConn.database,
      dialect: profitConn.dialect,
      fallback: profitConn.fallback,
      isSyncRunning: this.isSyncRunning,
    };
  }

  /**
   * Obtiene elementos del registro de sincronización
   */
  public static async getQueueItems(limit = 50): Promise<SyncQueue[]> {
    return await SyncQueue.findAll({
      order: [['createdAt', 'DESC']],
      limit,
    });
  }

  /**
   * Reintenta operaciones fallidas
   */
  public static async retryFailed(): Promise<{ resetCount: number }> {
    const [resetCount] = await SyncQueue.update(
      { status: 'PENDING', retryCount: 0, lastError: null },
      { where: { status: 'FAILED' } }
    );
    if (resetCount > 0) {
      this.runBidirectionalSync().catch(() => {});
    }
    return { resetCount };
  }

  /**
   * Alterna el modo de desconexión simulada para pruebas de campo offline-first
   */
  public static toggleSimulatedOffline(simulate: boolean): boolean {
    this.isSimulatedOffline = simulate;
    this.isOnline = !simulate;
    logger.info(`[SyncService] Modo de red cambiado a: ${simulate ? '🟠 DESCONECTADO (Offline-First Simulado)' : '🟢 EN LÍNEA (MSSQL Conectado)'}`);
    if (!simulate) {
      this.runBidirectionalSync().catch(() => {});
    }
    return this.isSimulatedOffline;
  }

  /**
   * Inicia el verificador periódico de conectividad y sincronización en segundo plano
   */
  public static startBackgroundSync(intervalMs = 15000): void {
    if (this.timer) {
      clearInterval(this.timer);
    }

    logger.info(`[SyncService] ⏱️ Iniciando servicio de sincronización periódica cada ${intervalMs / 1000}s`);

    // Ejecutar primera verificación y sincronización inmediata
    this.checkConnectivity()
      .then((online) => {
        if (online) this.runBidirectionalSync().catch(() => {});
      })
      .catch(() => {});

    this.timer = setInterval(async () => {
      try {
        const isConnected = await this.checkConnectivity();
        if (isConnected) {
          const pending = await this.getPendingCount();
          if (pending > 0) {
            await this.runBidirectionalSync();
          }
        }
      } catch (err: any) {
        logger.debug(`[SyncService Background] Error en ciclo periódico: ${err.message}`);
      }
    }, intervalMs);

    if (this.timer.unref) {
      this.timer.unref();
    }
  }

  /**
   * Detiene el ciclo en segundo plano
   */
  public static stopBackgroundSync(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      logger.info('[SyncService] Servicio de sincronización periódica detenido.');
    }
  }
}

export default SyncService;
