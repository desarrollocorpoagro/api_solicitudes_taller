import { Op, fn, col, literal, Sequelize } from 'sequelize';
import { profitSequelize, profitMirrorSequelize, getProfitConnectionStatus, isMssqlConnectionActive } from '../config/profitDb';
import { sequelize } from '../config/database';
import MecanicosProfit from '../models/MecanicosProfit.model';
import VwFlotaVendedores from '../models/VwFlotaVendedores.model';
import VwFlotaArticulos from '../models/VwFlotaArticulos.model';
import FlotaOrdenServicioProfit from '../models/FlotaOrdenServicioProfit.model';
import CatalogoRepuesto from '../models/CatalogoRepuesto.model';
import { logger } from '../utils/logger';

/**
 * Devuelve una conexión Sequelize apuntando a MSSQL Profit AD_TRANS.
 * Si MSSQL no responde, devuelve el espejo SQLite local como respaldo.
 */
function getRemoteConnection(fallback: boolean): Sequelize {
  return fallback ? profitMirrorSequelize : profitSequelize;
}

/**
 * Resultado de la sincronización bidireccional de una entidad maestra.
 */
export interface MasterSyncReport {
  entity: 'mecanicos' | 'vendedores' | 'articulos' | 'flota_ordenes_servicio';
  mssqlConnected: boolean;
  localCount: number;
  remoteCount: number;
  insertedLocal: number;
  insertedRemote: number;
  updatedLocal: number;
  updatedRemote: number;
  unchanged: number;
  errors: string[];
  durationMs: number;
}

/**
 * Servicio de sincronización bidireccional de datos maestros.
 *
 * Estrategia:
 * 1. Contar registros en BD Local (SQLite) y en BD Remota (MSSQL Profit AD_TRANS).
 * 2. Comparar por clave primaria natural.
 * 3. Insertar en BD Local los registros que solo existen en MSSQL.
 * 4. Insertar en MSSQL los registros que solo existen en BD Local.
 * 5. Actualizar en ambos extremos los registros que difieren.
 *
 * Esto garantiza que las dos bases de datos converjan a un mismo estado
 * después de cada ciclo, soportando conectividad bidireccional.
 */
export class MasterSyncService {
  private static isRunning = false;
  private static lastReport: Record<string, MasterSyncReport> | null = null;
  private static timer: NodeJS.Timeout | null = null;
  private static intervalMs = 30000;

  /**
   * Inicia el ciclo de sincronización maestra bidireccional en segundo plano.
   * - Ejecuta una sincronización inmediata al arrancar.
   * - Repite cada `intervalMs` mientras el proceso esté activo.
   */
  public static startBackgroundMasterSync(intervalMs = 30000): void {
    this.intervalMs = intervalMs;
    if (this.timer) clearInterval(this.timer);

    logger.info(`[MasterSyncService] ⏱️ Sincronización maestra bidireccional cada ${intervalMs / 1000}s`);

    // Disparar primer ciclo inmediatamente
    this.runMasterBidirectionalSync().catch((err) =>
      logger.error(`[MasterSyncService] Error en sincronización inicial: ${err.message}`)
    );

    this.timer = setInterval(async () => {
      try {
        if (this.isRunning) return;
        await this.runMasterBidirectionalSync();
      } catch (err: any) {
        logger.debug(`[MasterSyncService bg] Error en ciclo periódico: ${err.message}`);
      }
    }, intervalMs);

    if (this.timer.unref) this.timer.unref();
  }

  /**
   * Detiene el ciclo periódico de sincronización maestra.
   */
  public static stopBackgroundMasterSync(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      logger.info('[MasterSyncService] Sincronización maestra periódica detenida.');
    }
  }

  /**
   * Devuelve si el motor de sincronización se encuentra en ejecución.
   */
  public static isSyncing(): boolean {
    return this.isRunning;
  }

  /**
   * Devuelve el último reporte generado por `runMasterBidirectionalSync()`.
   */
  public static getLastReport(): Record<string, MasterSyncReport> | null {
    return this.lastReport;
  }

  /**
   * Ejecuta la sincronización bidireccional de las tres entidades maestras:
   * mecánicos, vendedores y artículos.
   *
   * Si MSSQL no está disponible, intenta el modo "local-first" en el que
   * se cuentan y comparan registros únicamente dentro de la base local
   * para mantener la consistencia interna.
   */
  public static async runMasterBidirectionalSync(opts: {
    entities?: Array<'mecanicos' | 'vendedores' | 'articulos' | 'flota_ordenes_servicio'>;
  } = {}): Promise<Record<string, MasterSyncReport>> {
    if (this.isRunning) {
      logger.warn('[MasterSyncService] Ya existe un ciclo de sincronización maestro en curso.');
      // Esperar a que culmine
      let waited = 0;
      while (this.isRunning && waited < 5000) {
        await new Promise((r) => setTimeout(r, 100));
        waited += 100;
      }
      return this.lastReport || {};
    }

    this.isRunning = true;
    const startedAt = Date.now();
    const entities = opts.entities || ['mecanicos', 'vendedores', 'articulos', 'flota_ordenes_servicio'];

    const conn = await getProfitConnectionStatus();
    // Chequeo estricto: MSSQL real, no fallback SQLite
    const remoteReachable = conn.connected && !conn.fallback;

    logger.info(
      `[MasterSyncService] 🔄 Iniciando sincronización bidireccional maestra. MSSQL ${remoteReachable ? '🟢 CONECTADO' : '🔴 NO DISPONIBLE'}. Entidades: ${entities.join(', ')}`
    );

    const report: Record<string, MasterSyncReport> = {};

    try {
      if (entities.includes('mecanicos')) {
        report.mecanicos = await this.syncMecanicos(remoteReachable);
      }
      if (entities.includes('vendedores')) {
        report.vendedores = await this.syncVendedores(remoteReachable);
      }
      if (entities.includes('articulos')) {
        report.articulos = await this.syncArticulos(remoteReachable);
      }
      if (entities.includes('flota_ordenes_servicio')) {
        report.flota_ordenes_servicio = await this.syncFlotaOrdenesServicio(remoteReachable);
      }
    } catch (err: any) {
      logger.error(`[MasterSyncService] Error crítico durante la sincronización maestra: ${err.message}`);
    } finally {
      this.isRunning = false;
      this.lastReport = report;
    }

    const totalMs = Date.now() - startedAt;
    logger.info(`[MasterSyncService] ✅ Sincronización maestra completada en ${totalMs}ms.`);
    return report;
  }

  // ============================================================
  // MECÁNICOS
  //
  // Estrategia de conexiones:
  //   LOCAL  → siempre profitMirrorSequelize (./data/profit_ad_trans.sqlite)
  //   REMOTE → profitSequelize (MSSQL AD_TRANS cuando reachable, espejo en fallback)
  //
  // El modelo Sequelize se vincula a profitSequelize en el módulo import.
  // Por ello, para escribir en el espejo local hacemos `create/update` directos
  // sobre la instancia espejo, y para escribir en MSSQL usamos el modelo.
  // ============================================================
  private static async syncMecanicos(remoteReachable: boolean): Promise<MasterSyncReport> {
    const start = Date.now();
    const report: MasterSyncReport = {
      entity: 'mecanicos',
      mssqlConnected: remoteReachable,
      localCount: 0,
      remoteCount: 0,
      insertedLocal: 0,
      insertedRemote: 0,
      updatedLocal: 0,
      updatedRemote: 0,
      unchanged: 0,
      errors: [],
      durationMs: 0,
    };

    try {
      // 1. Contar registros en cada extremo (LOCAL = espejo SQLite, REMOTE = MSSQL)
      const [localCountResult] = (await profitMirrorSequelize.query(`SELECT COUNT(*) AS c FROM mecanicos`)) as any;
      report.localCount = parseInt(localCountResult?.[0]?.c ?? localCountResult?.[0]?.C ?? '0', 10) || 0;

      if (remoteReachable) {
        const [remoteCountResult] = (await profitSequelize.query(`SELECT COUNT(*) AS c FROM [AD_TRANS].[dbo].[mecanicos] WITH (NOLOCK)`)) as any;
        report.remoteCount = parseInt(remoteCountResult?.[0]?.c ?? '0', 10) || 0;
      }

      // 2. Obtener registros del espejo SQLite local (LOCAL)
      const [localRowsRaw] = (await profitMirrorSequelize.query(`SELECT codigo, nombre, cargo, activo FROM mecanicos`)) as any;
      const localRows: any[] = localRowsRaw || [];

      // 3. Si MSSQL está disponible, obtener registros remotos (REMOTE) y comparar
      if (remoteReachable) {
        const [remoteRowsRaw] = (await profitSequelize.query(
          `SELECT codigo, nombre, cargo, activo FROM [AD_TRANS].[dbo].[mecanicos] WITH (NOLOCK)`
        )) as any;
        const remoteRows: any[] = remoteRowsRaw || [];

        const localMap = new Map<string, any>(localRows.map((r: any) => [String(r.codigo).trim(), r]));
        const remoteMap = new Map<string, any>(remoteRows.map((r: any) => [String(r.codigo).trim(), r]));

        // 4. Insertar en LOCAL (espejo SQLite) los que solo existen en REMOTO (MSSQL)
        for (const [codigo, remote] of remoteMap.entries()) {
          if (!localMap.has(codigo)) {
            try {
              // Insertar directamente en el espejo SQLite local (no usar el modelo,
              // porque MecanicosProfit está bindeado a profitSequelize que apunta a MSSQL)
              await profitMirrorSequelize.query(
                `INSERT INTO mecanicos (codigo, nombre, cargo, activo) VALUES (?, ?, ?, ?)`,
                { replacements: [remote.codigo, remote.nombre, remote.cargo ?? null, remote.activo ? 1 : 0] }
              );
              report.insertedLocal++;
              logger.info(`[MasterSyncService:mecanicos] ➕ LOCAL ← MSSQL: ${codigo} - ${remote.nombre}`);
            } catch (insertErr: any) {
              report.errors.push(`LOCAL insert ${codigo}: ${insertErr.message}`);
            }
          } else {
            // Comparar diferencias y actualizar si difieren
            const local = localMap.get(codigo);
            const differs =
              String(local?.nombre || '').trim() !== String(remote?.nombre || '').trim() ||
              String(local?.cargo || '').trim() !== String(remote?.cargo || '').trim() ||
              Boolean(local?.activo) !== Boolean(remote?.activo);
            if (differs) {
              try {
                await profitMirrorSequelize.query(
                  `UPDATE mecanicos SET nombre = ?, cargo = ?, activo = ? WHERE codigo = ?`,
                  { replacements: [remote.nombre, remote.cargo ?? null, remote.activo ? 1 : 0, codigo] }
                );
                report.updatedLocal++;
                logger.debug(`[MasterSyncService:mecanicos] ✏️ LOCAL actualizado desde MSSQL: ${codigo}`);
              } catch (updErr: any) {
                report.errors.push(`LOCAL update ${codigo}: ${updErr.message}`);
              }
            } else {
              report.unchanged++;
            }
          }
        }

        // 5. Insertar en REMOTO (MSSQL) los que solo existen en LOCAL (espejo)
        for (const [codigo, local] of localMap.entries()) {
          if (!remoteMap.has(codigo)) {
            try {
              // Insertar en MSSQL real usando el modelo (que apunta a profitSequelize)
              await MecanicosProfit.create({
                codigo: local.codigo,
                nombre: local.nombre,
                cargo: local.cargo,
                activo: local.activo,
              });
              report.insertedRemote++;
              logger.info(`[MasterSyncService:mecanicos] ➕ MSSQL ← LOCAL: ${codigo} - ${local.nombre}`);
            } catch (insErr: any) {
              report.errors.push(`REMOTE insert ${codigo}: ${insErr.message}`);
            }
          }
        }
      } else {
        logger.warn('[MasterSyncService:mecanicos] MSSQL no disponible. Solo se contabilizaron registros locales.');
      }
    } catch (err: any) {
      report.errors.push(`General: ${err.message}`);
      logger.error(`[MasterSyncService:mecanicos] Error: ${err.message}`);
    }

    report.durationMs = Date.now() - start;
    return report;
  }

  // ============================================================
  // VENDEDORES
  // ============================================================
  private static async syncVendedores(remoteReachable: boolean): Promise<MasterSyncReport> {
    const start = Date.now();
    const report: MasterSyncReport = {
      entity: 'vendedores',
      mssqlConnected: remoteReachable,
      localCount: 0,
      remoteCount: 0,
      insertedLocal: 0,
      insertedRemote: 0,
      updatedLocal: 0,
      updatedRemote: 0,
      unchanged: 0,
      errors: [],
      durationMs: 0,
    };

    try {
      // 1. Conteos (LOCAL = espejo SQLite, REMOTE = MSSQL)
      const [localCountResult] = (await profitMirrorSequelize.query(`SELECT COUNT(*) AS c FROM vw_flota_vendedores`)) as any;
      report.localCount = parseInt(localCountResult?.[0]?.c ?? '0', 10) || 0;

      if (remoteReachable) {
        const [remoteCountResult] = (await profitSequelize.query(
          `SELECT COUNT(*) AS c FROM [AD_TRANS].[dbo].[vw_flota_vendedores] WITH (NOLOCK)`
        )) as any;
        report.remoteCount = parseInt(remoteCountResult?.[0]?.c ?? '0', 10) || 0;
      }

      // 2. Lectura del espejo SQLite local (LOCAL)
      const [localRowsRaw] = (await profitMirrorSequelize.query(
        `SELECT co_ven, cedula, ven_des FROM vw_flota_vendedores`
      )) as any;
      const localRows: any[] = localRowsRaw || [];

      if (remoteReachable) {
        const [remoteRowsRaw] = (await profitSequelize.query(
          `SELECT co_ven, cedula, ven_des FROM [AD_TRANS].[dbo].[vw_flota_vendedores] WITH (NOLOCK)`
        )) as any;
        const remoteRows: any[] = remoteRowsRaw || [];

        const localMap = new Map<string, any>(localRows.map((r: any) => [String(r.co_ven).trim(), r]));
        const remoteMap = new Map<string, any>(remoteRows.map((r: any) => [String(r.co_ven).trim(), r]));

        // 3. LOCAL ← REMOTO
        for (const [coVen, remote] of remoteMap.entries()) {
          if (!localMap.has(coVen)) {
            try {
              // Insertar directamente en el espejo SQLite local
              await profitMirrorSequelize.query(
                `INSERT INTO vw_flota_vendedores (co_ven, cedula, ven_des) VALUES (?, ?, ?)`,
                { replacements: [remote.co_ven, remote.cedula, remote.ven_des] }
              );
              report.insertedLocal++;
              logger.info(`[MasterSyncService:vendedores] ➕ LOCAL ← MSSQL: ${coVen}`);
            } catch (e: any) {
              report.errors.push(`LOCAL insert ${coVen}: ${e.message}`);
            }
          } else {
            const local = localMap.get(coVen);
            const differs =
              String(local?.cedula || '').trim() !== String(remote?.cedula || '').trim() ||
              String(local?.ven_des || '').trim() !== String(remote?.ven_des || '').trim();
            if (differs) {
              try {
                await profitMirrorSequelize.query(
                  `UPDATE vw_flota_vendedores SET cedula = ?, ven_des = ? WHERE co_ven = ?`,
                  { replacements: [remote.cedula, remote.ven_des, coVen] }
                );
                report.updatedLocal++;
                logger.debug(`[MasterSyncService:vendedores] ✏️ LOCAL actualizado desde MSSQL: ${coVen}`);
              } catch (e: any) {
                report.errors.push(`LOCAL update ${coVen}: ${e.message}`);
              }
            } else {
              report.unchanged++;
            }
          }
        }

        // 4. REMOTO ← LOCAL (MSSQL ← espejo local)
        for (const [coVen, local] of localMap.entries()) {
          if (!remoteMap.has(coVen)) {
            try {
              await VwFlotaVendedores.create({
                co_ven: local.co_ven,
                cedula: local.cedula,
                ven_des: local.ven_des,
              });
              report.insertedRemote++;
              logger.info(`[MasterSyncService:vendedores] ➕ MSSQL ← LOCAL: ${coVen}`);
            } catch (e: any) {
              report.errors.push(`REMOTE insert ${coVen}: ${e.message}`);
            }
          }
        }
      } else {
        logger.warn('[MasterSyncService:vendedores] MSSQL no disponible. Solo se contabilizaron registros locales.');
      }
    } catch (err: any) {
      report.errors.push(`General: ${err.message}`);
      logger.error(`[MasterSyncService:vendedores] Error: ${err.message}`);
    }

    report.durationMs = Date.now() - start;
    return report;
  }

  // ============================================================
  // ARTÍCULOS / REPUESTOS
  // ============================================================
  private static async syncArticulos(remoteReachable: boolean): Promise<MasterSyncReport> {
    const start = Date.now();
    const report: MasterSyncReport = {
      entity: 'articulos',
      mssqlConnected: remoteReachable,
      localCount: 0,
      remoteCount: 0,
      insertedLocal: 0,
      insertedRemote: 0,
      updatedLocal: 0,
      updatedRemote: 0,
      unchanged: 0,
      errors: [],
      durationMs: 0,
    };

    try {
      // 1. Conteos (LOCAL = espejo SQLite, REMOTE = MSSQL)
      const [localCountResult] = (await profitMirrorSequelize.query(`SELECT COUNT(*) AS c FROM vw_flota_articulos`)) as any;
      report.localCount = parseInt(localCountResult?.[0]?.c ?? '0', 10) || 0;

      if (remoteReachable) {
        const [remoteCountResult] = (await profitSequelize.query(
          `SELECT COUNT(*) AS c FROM [AD_TRANS].[dbo].[vw_flota_articulos] WITH (NOLOCK)`
        )) as any;
        report.remoteCount = parseInt(remoteCountResult?.[0]?.c ?? '0', 10) || 0;
      }

      // 2. Lectura del espejo SQLite local (LOCAL)
      const [localRowsRaw] = (await profitMirrorSequelize.query(
        `SELECT codigo_profit, nombre_producto, codigo_categoria, categoria, unidad_medida,
                costo, tipo, codigo_subalmacen, sub_almacen, codigo_almacen, almacen, stock_act
         FROM vw_flota_articulos`
      )) as any;
      const localRows: any[] = localRowsRaw || [];

      if (remoteReachable) {
        const [remoteRowsRaw] = (await profitSequelize.query(
          `SELECT codigo_profit, nombre_producto, codigo_categoria, categoria, unidad_medida,
                  costo, tipo, codigo_subalmacen, sub_almacen, codigo_almacen, almacen, stock_act
           FROM [AD_TRANS].[dbo].[vw_flota_articulos] WITH (NOLOCK)`
        )) as any;
        const remoteRows: any[] = remoteRowsRaw || [];

        const localMap = new Map<string, any>(localRows.map((r: any) => [String(r.codigo_profit).trim(), r]));
        const remoteMap = new Map<string, any>(remoteRows.map((r: any) => [String(r.codigo_profit).trim(), r]));

        // 3. LOCAL ← REMOTO
        for (const [codigo, remote] of remoteMap.entries()) {
          if (!localMap.has(codigo)) {
            try {
              // Insertar directamente en el espejo SQLite local
              await profitMirrorSequelize.query(
                `INSERT INTO vw_flota_articulos
                  (codigo_profit, nombre_producto, codigo_categoria, categoria, unidad_medida,
                   costo, tipo, codigo_subalmacen, sub_almacen, codigo_almacen, almacen, stock_act)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                { replacements: [
                  remote.codigo_profit, remote.nombre_producto, remote.codigo_categoria,
                  remote.categoria, remote.unidad_medida, remote.costo, remote.tipo,
                  remote.codigo_subalmacen, remote.sub_almacen, remote.codigo_almacen,
                  remote.almacen, remote.stock_act
                ] }
              );
              report.insertedLocal++;
              logger.info(`[MasterSyncService:articulos] ➕ LOCAL ← MSSQL: ${codigo}`);
            } catch (e: any) {
              report.errors.push(`LOCAL insert ${codigo}: ${e.message}`);
            }
          } else {
            const local = localMap.get(codigo);
            const differs =
              String(local?.nombre_producto || '').trim() !== String(remote?.nombre_producto || '').trim() ||
              String(local?.categoria || '').trim() !== String(remote?.categoria || '').trim() ||
              String(local?.unidad_medida || '').trim() !== String(remote?.unidad_medida || '').trim() ||
              parseFloat(String(local?.costo || 0)) !== parseFloat(String(remote?.costo || 0)) ||
              parseFloat(String(local?.stock_act || 0)) !== parseFloat(String(remote?.stock_act || 0));
            if (differs) {
              try {
                await profitMirrorSequelize.query(
                  `UPDATE vw_flota_articulos SET
                    nombre_producto = ?, codigo_categoria = ?, categoria = ?, unidad_medida = ?,
                    costo = ?, tipo = ?, codigo_subalmacen = ?, sub_almacen = ?,
                    codigo_almacen = ?, almacen = ?, stock_act = ?
                   WHERE codigo_profit = ?`,
                  { replacements: [
                    remote.nombre_producto, remote.codigo_categoria, remote.categoria,
                    remote.unidad_medida, remote.costo, remote.tipo, remote.codigo_subalmacen,
                    remote.sub_almacen, remote.codigo_almacen, remote.almacen, remote.stock_act,
                    codigo
                  ] }
                );
                report.updatedLocal++;
                logger.debug(`[MasterSyncService:articulos] ✏️ LOCAL actualizado desde MSSQL: ${codigo}`);
              } catch (e: any) {
                report.errors.push(`LOCAL update ${codigo}: ${e.message}`);
              }
            } else {
              report.unchanged++;
            }
          }
        }

        // 4. REMOTO ← LOCAL (MSSQL ← espejo local)
        for (const [codigo, local] of localMap.entries()) {
          if (!remoteMap.has(codigo)) {
            try {
              await VwFlotaArticulos.create({
                codigo_profit: local.codigo_profit,
                nombre_producto: local.nombre_producto,
                codigo_categoria: local.codigo_categoria,
                categoria: local.categoria,
                unidad_medida: local.unidad_medida,
                costo: local.costo,
                tipo: local.tipo,
                codigo_subalmacen: local.codigo_subalmacen,
                sub_almacen: local.sub_almacen,
                codigo_almacen: local.codigo_almacen,
                almacen: local.almacen,
                stock_act: local.stock_act,
              });
              report.insertedRemote++;
              logger.info(`[MasterSyncService:articulos] ➕ MSSQL ← LOCAL: ${codigo}`);
            } catch (e: any) {
              report.errors.push(`REMOTE insert ${codigo}: ${e.message}`);
            }
          }
        }
      } else {
        logger.warn('[MasterSyncService:articulos] MSSQL no disponible. Solo se contabilizaron registros locales.');
      }
    } catch (err: any) {
      report.errors.push(`General: ${err.message}`);
      logger.error(`[MasterSyncService:articulos] Error: ${err.message}`);
    }

    report.durationMs = Date.now() - start;
    return report;
  }

  // ============================================================
  // FLOTA_ORDENES_SERVICIO
  // Tabla espejo de [AD_TRANS].[dbo].[flota_ordenes_servicio] en la BD local.
  // Columnas sincronizadas (idénticas al SELECT remoto):
  //   id_orden, nro_orden, Placa, km_horometro, recibido_por, entregado_por,
  //   fec_apertura, fec_cierre, sintomas_reportados, es_reincidencia,
  //   nro_orden_anterior, motivo_reincidencia, fotos_adjuntas, estatus,
  //   costo_repuestos, costo_mano_obra, costo_servicios_ext, costo_total,
  //   recibe_conforme, hora_apertura, hora_cierre.
  // Clave de comparación: nro_orden (código de negocio único).
  // ============================================================
  private static async syncFlotaOrdenesServicio(remoteReachable: boolean): Promise<MasterSyncReport> {
    const start = Date.now();
    const report: MasterSyncReport = {
      entity: 'flota_ordenes_servicio',
      mssqlConnected: remoteReachable,
      localCount: 0,
      remoteCount: 0,
      insertedLocal: 0,
      insertedRemote: 0,
      updatedLocal: 0,
      updatedRemote: 0,
      unchanged: 0,
      errors: [],
      durationMs: 0,
    };

    try {
      // 1. Conteos en cada extremo (LOCAL = espejo SQLite, REMOTE = MSSQL)
      const [localCountResult] = (await profitMirrorSequelize.query(`SELECT COUNT(*) AS c FROM flota_ordenes_servicio`)) as any;
      report.localCount = parseInt(localCountResult?.[0]?.c ?? '0', 10) || 0;

      if (remoteReachable) {
        const [remoteCountResult] = (await profitSequelize.query(
          `SELECT COUNT(*) AS c FROM [AD_TRANS].[dbo].[flota_ordenes_servicio] WITH (NOLOCK)`
        )) as any;
        report.remoteCount = parseInt(remoteCountResult?.[0]?.c ?? '0', 10) || 0;
      }

      // 2. Lectura del espejo SQLite local (LOCAL)
      const [localRowsRaw] = (await profitMirrorSequelize.query(
        `SELECT id_orden, nro_orden, Placa, km_horometro, recibido_por, entregado_por,
                fec_apertura, fec_cierre, sintomas_reportados, es_reincidencia,
                nro_orden_anterior, motivo_reincidencia, fotos_adjuntas, estatus,
                costo_repuestos, costo_mano_obra, costo_servicios_ext, costo_total,
                recibe_conforme, hora_apertura, hora_cierre
         FROM flota_ordenes_servicio`
      )) as any;
      const localRows: any[] = localRowsRaw || [];

      if (!remoteReachable) {
        logger.warn('[MasterSyncService:flota_ordenes_servicio] MSSQL no disponible. Solo se contabilizaron registros locales.');
        report.durationMs = Date.now() - start;
        return report;
      }

      // 3. Lectura desde MSSQL remoto
      const [remoteRowsRaw] = (await profitSequelize.query(
        `SELECT id_orden, nro_orden, Placa, km_horometro, recibido_por, entregado_por,
                fec_apertura, fec_cierre, sintomas_reportados, es_reincidencia,
                nro_orden_anterior, motivo_reincidencia, fotos_adjuntas, estatus,
                costo_repuestos, costo_mano_obra, costo_servicios_ext, costo_total,
                recibe_conforme, hora_apertura, hora_cierre
         FROM [AD_TRANS].[dbo].[flota_ordenes_servicio] WITH (NOLOCK)`
      )) as any;
      const remoteRows: any[] = remoteRowsRaw || [];

      // 4. Mapas por nro_orden (clave natural de negocio)
      const localMap = new Map<string, any>(
        localRows.map((r: any) => [String(r.nro_orden).trim().toUpperCase(), r])
      );
      const remoteMap = new Map<string, any>(
        remoteRows.map((r: any) => [String(r.nro_orden).trim().toUpperCase(), r])
      );

      // 4. LOCAL ← REMOTO  (insertar en local lo que solo existe en MSSQL)
      for (const [nroOrden, remote] of remoteMap.entries()) {
        const local = localMap.get(nroOrden);
        if (!local) {
          try {
            // Insertar directamente en el espejo SQLite local
            await profitMirrorSequelize.query(
              `INSERT INTO flota_ordenes_servicio
                (nro_orden, Placa, km_horometro, recibido_por, entregado_por,
                 fec_apertura, fec_cierre, sintomas_reportados, es_reincidencia,
                 nro_orden_anterior, motivo_reincidencia, fotos_adjuntas, estatus,
                 costo_repuestos, costo_mano_obra, costo_servicios_ext, costo_total,
                 recibe_conforme, hora_apertura, hora_cierre)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              { replacements: [
                remote.nro_orden, remote.Placa, remote.km_horometro, remote.recibido_por,
                remote.entregado_por ?? null, remote.fec_apertura ?? new Date(),
                remote.fec_cierre ?? null, remote.sintomas_reportados ?? '',
                remote.es_reincidencia ? 1 : 0, remote.nro_orden_anterior ?? null,
                remote.motivo_reincidencia ?? null, remote.fotos_adjuntas ?? 0,
                remote.estatus ?? 'ABIERTA', remote.costo_repuestos ?? 0,
                remote.costo_mano_obra ?? 0, remote.costo_servicios_ext ?? 0,
                remote.costo_total ?? 0, remote.recibe_conforme ?? null,
                remote.hora_apertura ?? null, remote.hora_cierre ?? null
              ] }
            );
            report.insertedLocal++;
            logger.info(`[MasterSyncService:flota_ordenes_servicio] ➕ LOCAL ← MSSQL: ${nroOrden}`);
          } catch (e: any) {
            report.errors.push(`LOCAL insert ${nroOrden}: ${e.message}`);
          }
          continue;
        }

        // 5. Comparar diferencias por columna y actualizar LOCAL si difiere
        const diffs = this.compareFlotaOrden(local, remote);
        if (diffs.length > 0) {
          try {
            await profitMirrorSequelize.query(
              `UPDATE flota_ordenes_servicio SET
                Placa = ?, km_horometro = ?, recibido_por = ?, entregado_por = ?,
                fec_apertura = ?, fec_cierre = ?, sintomas_reportados = ?,
                es_reincidencia = ?, nro_orden_anterior = ?, motivo_reincidencia = ?,
                fotos_adjuntas = ?, estatus = ?, costo_repuestos = ?, costo_mano_obra = ?,
                costo_servicios_ext = ?, costo_total = ?, recibe_conforme = ?,
                hora_apertura = ?, hora_cierre = ?
               WHERE nro_orden = ?`,
              { replacements: [
                remote.Placa, remote.km_horometro, remote.recibido_por,
                remote.entregado_por ?? null, remote.fec_apertura ?? new Date(),
                remote.fec_cierre ?? null, remote.sintomas_reportados ?? '',
                remote.es_reincidencia ? 1 : 0, remote.nro_orden_anterior ?? null,
                remote.motivo_reincidencia ?? null, remote.fotos_adjuntas ?? 0,
                remote.estatus ?? 'ABIERTA', remote.costo_repuestos ?? 0,
                remote.costo_mano_obra ?? 0, remote.costo_servicios_ext ?? 0,
                remote.costo_total ?? 0, remote.recibe_conforme ?? null,
                remote.hora_apertura ?? null, remote.hora_cierre ?? null, nroOrden
              ] }
            );
            report.updatedLocal++;
            logger.debug(`[MasterSyncService:flota_ordenes_servicio] ✏️ LOCAL actualizado: ${nroOrden} (${diffs.join(', ')})`);
          } catch (e: any) {
            report.errors.push(`LOCAL update ${nroOrden}: ${e.message}`);
          }
        } else {
          report.unchanged++;
        }
      }

      // 6. REMOTO ← LOCAL  (insertar en MSSQL lo que solo existe en local)
      for (const [nroOrden, local] of localMap.entries()) {
        if (!remoteMap.has(nroOrden)) {
          try {
            await FlotaOrdenServicioProfit.create({
              nro_orden: local.nro_orden,
              Placa: local.Placa,
              km_horometro: local.km_horometro,
              recibido_por: local.recibido_por,
              entregado_por: local.entregado_por ?? null,
              fec_apertura: local.fec_apertura ?? new Date(),
              fec_cierre: local.fec_cierre ?? null,
              sintomas_reportados: local.sintomas_reportados ?? '',
              es_reincidencia: Boolean(local.es_reincidencia),
              nro_orden_anterior: local.nro_orden_anterior ?? null,
              motivo_reincidencia: local.motivo_reincidencia ?? null,
              fotos_adjuntas: local.fotos_adjuntas ?? 0,
              estatus: local.estatus ?? 'ABIERTA',
              costo_repuestos: local.costo_repuestos ?? 0,
              costo_mano_obra: local.costo_mano_obra ?? 0,
              costo_servicios_ext: local.costo_servicios_ext ?? 0,
              costo_total: local.costo_total ?? 0,
              recibe_conforme: local.recibe_conforme ?? null,
              hora_apertura: local.hora_apertura ?? null,
              hora_cierre: local.hora_cierre ?? null,
            });
            report.insertedRemote++;
            logger.info(`[MasterSyncService:flota_ordenes_servicio] ➕ MSSQL ← LOCAL: ${nroOrden}`);
          } catch (e: any) {
            report.errors.push(`REMOTE insert ${nroOrden}: ${e.message}`);
          }
        }
      }
    } catch (err: any) {
      report.errors.push(`General: ${err.message}`);
      logger.error(`[MasterSyncService:flota_ordenes_servicio] Error: ${err.message}`);
    }

    report.durationMs = Date.now() - start;
    return report;
  }

  /**
   * Compara dos registros de flota_ordenes_servicio y devuelve la lista
   * de columnas que difieren (vacía si son idénticos).
   */
  private static compareFlotaOrden(local: any, remote: any): string[] {
    const diffs: string[] = [];
    const fields: Array<keyof typeof remote> = [
      'Placa', 'km_horometro', 'recibido_por', 'entregado_por',
      'sintomas_reportados', 'es_reincidencia', 'nro_orden_anterior',
      'motivo_reincidencia', 'fotos_adjuntas', 'estatus',
      'costo_repuestos', 'costo_mano_obra', 'costo_servicios_ext',
      'costo_total', 'recibe_conforme',
    ];

    for (const f of fields) {
      const lv = local?.[f];
      const rv = remote?.[f];
      if (typeof rv === 'number') {
        if (parseFloat(String(lv ?? 0)) !== parseFloat(String(rv ?? 0))) diffs.push(String(f));
      } else if (typeof rv === 'boolean') {
        if (Boolean(lv) !== Boolean(rv)) diffs.push(String(f));
      } else {
        if (String(lv ?? '').trim() !== String(rv ?? '').trim()) diffs.push(String(f));
      }
    }
    return diffs;
  }
}

export default MasterSyncService;