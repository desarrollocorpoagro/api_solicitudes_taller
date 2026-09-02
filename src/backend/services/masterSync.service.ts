import { Op, fn, col, literal, Sequelize, QueryTypes } from 'sequelize';
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
      let waited = 0;
      while (this.isRunning && waited < 5000) {
        await new Promise((r) => setTimeout(r, 100));
        waited += 100;
      }
      return this.lastReport || {};
    }

    this.isRunning = true;
    const startedAt = Date.now();
    const entities = opts.entities && opts.entities.length > 0 ? opts.entities : ['mecanicos', 'vendedores', 'articulos'];

    const conn = await getProfitConnectionStatus();
    const remoteReachable = conn.connected && !conn.fallback;

    logger.info(
      `[MasterSyncService] 🔄 Iniciando sincronización bidireccional. MSSQL ${remoteReachable ? '🟢 CONECTADO' : '🔴 NO DISPONIBLE'}. Entidades: ${entities.join(', ')}`
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
    logger.info(`[MasterSyncService] ✅ Sincronización completada en ${totalMs}ms.`);
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

    const normalizeText = (value: unknown): string => String(value ?? '').trim();
    const normalizeBool = (value: unknown): boolean => {
      if (typeof value === 'boolean') return value;
      if (typeof value === 'number') return value === 1;
      if (typeof value === 'string') return value.toLowerCase() === 'true' || value === '1';
      return false;
    };
    const hasMechanicDifference = (left: any, right: any): boolean => {
      return (
        normalizeText(left?.nombre) !== normalizeText(right?.nombre) ||
        normalizeText(left?.cargo) !== normalizeText(right?.cargo) ||
        normalizeBool(left?.activo) !== normalizeBool(right?.activo)
      );
    };

    try {
      const [localCountResult] = (await profitMirrorSequelize.query(`SELECT COUNT(*) AS c FROM mecanicos`)) as any;
      report.localCount = parseInt(localCountResult?.[0]?.c ?? localCountResult?.[0]?.C ?? '0', 10) || 0;

      if (!remoteReachable) {
        logger.warn('[MasterSyncService:mecanicos] MSSQL no disponible. Solo se contabilizaron registros locales.');
        report.durationMs = Date.now() - start;
        return report;
      }

      const [remoteCountResult] = (await profitSequelize.query(
        `SELECT COUNT(*) AS c FROM [AD_TRANS].[dbo].[mecanicos] WITH (NOLOCK)`
      )) as any;
      report.remoteCount = parseInt(remoteCountResult?.[0]?.c ?? '0', 10) || 0;

      const [localRowsRaw] = (await profitMirrorSequelize.query(
        `SELECT codigo, nombre, cargo, activo FROM mecanicos`
      )) as any;
      const localRows: any[] = Array.isArray(localRowsRaw) ? localRowsRaw : [];

      const [remoteRowsRaw] = (await profitSequelize.query(
        `SELECT codigo, nombre, cargo, activo FROM [AD_TRANS].[dbo].[mecanicos] WITH (NOLOCK)`
      )) as any;
      const remoteRows: any[] = Array.isArray(remoteRowsRaw) ? remoteRowsRaw : [];

      const localMap = new Map<string, any>(localRows.map((row: any) => [String(row.codigo ?? '').trim(), row]));
      const remoteMap = new Map<string, any>(remoteRows.map((row: any) => [String(row.codigo ?? '').trim(), row]));

      for (const [codigo, remoteRow] of remoteMap.entries()) {
        if (!localMap.has(codigo)) {
          try {
            await profitMirrorSequelize.query(
              `INSERT INTO mecanicos (codigo, nombre, cargo, activo) VALUES (?, ?, ?, ?)`,
              {
                replacements: [
                  codigo,
                  normalizeText(remoteRow.nombre),
                  remoteRow.cargo ?? null,
                  normalizeBool(remoteRow.activo) ? 1 : 0,
                ],
                type: QueryTypes.INSERT,
              }
            );
            report.insertedLocal++;
            logger.info(`[MasterSyncService:mecanicos] ➕ LOCAL ← MSSQL: ${codigo} - ${normalizeText(remoteRow.nombre)}`);
          } catch (insertErr: any) {
            report.errors.push(`LOCAL insert ${codigo}: ${insertErr.message}`);
          }
          continue;
        }

        const localRow = localMap.get(codigo)!;
        if (hasMechanicDifference(localRow, remoteRow)) {
          try {
            await profitMirrorSequelize.query(
              `UPDATE mecanicos SET nombre = ?, cargo = ?, activo = ? WHERE codigo = ?`,
              {
                replacements: [
                  normalizeText(remoteRow.nombre),
                  remoteRow.cargo ?? null,
                  normalizeBool(remoteRow.activo) ? 1 : 0,
                  codigo,
                ],
                type: QueryTypes.UPDATE,
              }
            );
            report.updatedLocal++;
            logger.debug(`[MasterSyncService:mecanicos] ✏️ LOCAL actualizado desde MSSQL: ${codigo}`);
          } catch (updErr: any) {
            report.errors.push(`LOCAL update ${codigo}: ${updErr.message}`);
          }

          try {
            await profitSequelize.query(
              `UPDATE [AD_TRANS].[dbo].[mecanicos] SET nombre = ?, cargo = ?, activo = ? WHERE codigo = ?`,
              {
                replacements: [
                  normalizeText(localRow.nombre),
                  localRow.cargo ?? null,
                  normalizeBool(localRow.activo) ? 1 : 0,
                  codigo,
                ],
                type: QueryTypes.UPDATE,
              }
            );
            report.updatedRemote++;
            logger.debug(`[MasterSyncService:mecanicos] ✏️ REMOTE actualizado desde LOCAL: ${codigo}`);
          } catch (updRemoteErr: any) {
            report.errors.push(`REMOTE update ${codigo}: ${updRemoteErr.message}`);
          }
        } else {
          report.unchanged++;
        }
      }

      for (const [codigo, localRow] of localMap.entries()) {
        if (!remoteMap.has(codigo)) {
          try {
            await profitSequelize.query(
              `INSERT INTO [AD_TRANS].[dbo].[mecanicos] (codigo, nombre, cargo, activo) VALUES (?, ?, ?, ?)`,
              {
                replacements: [
                  codigo,
                  normalizeText(localRow.nombre),
                  localRow.cargo ?? null,
                  normalizeBool(localRow.activo) ? 1 : 0,
                ],
                type: QueryTypes.INSERT,
              }
            );
            report.insertedRemote++;
            logger.info(`[MasterSyncService:mecanicos] ➕ MSSQL ← LOCAL: ${codigo} - ${normalizeText(localRow.nombre)}`);
          } catch (insErr: any) {
            report.errors.push(`REMOTE insert ${codigo}: ${insErr.message}`);
          }
        }
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

    const normalizeText = (value: unknown): string => String(value ?? '').trim();
    const hasVendorDifference = (left: any, right: any): boolean => {
      return (
        normalizeText(left?.cedula) !== normalizeText(right?.cedula) ||
        normalizeText(left?.ven_des) !== normalizeText(right?.ven_des)
      );
    };

    try {
      const [localCountResult] = (await profitMirrorSequelize.query(`SELECT COUNT(*) AS c FROM vw_flota_vendedores`)) as any;
      report.localCount = parseInt(localCountResult?.[0]?.c ?? localCountResult?.[0]?.C ?? '0', 10) || 0;

      if (!remoteReachable) {
        logger.warn('[MasterSyncService:vendedores] MSSQL no disponible. Solo se contabilizaron registros locales.');
        report.durationMs = Date.now() - start;
        return report;
      }

      const [remoteCountResult] = (await profitSequelize.query(
        `SELECT COUNT(*) AS c FROM [AD_TRANS].[dbo].[vw_flota_vendedores] WITH (NOLOCK)`
      )) as any;
      report.remoteCount = parseInt(remoteCountResult?.[0]?.c ?? '0', 10) || 0;

      const [localRowsRaw] = (await profitMirrorSequelize.query(
        `SELECT co_ven, cedula, ven_des FROM vw_flota_vendedores`
      )) as any;
      const localRows: any[] = Array.isArray(localRowsRaw) ? localRowsRaw : [];

      const [remoteRowsRaw] = (await profitSequelize.query(
        `SELECT co_ven, cedula, ven_des FROM [AD_TRANS].[dbo].[vw_flota_vendedores] WITH (NOLOCK)`
      )) as any;
      const remoteRows: any[] = Array.isArray(remoteRowsRaw) ? remoteRowsRaw : [];

      const localMap = new Map<string, any>(localRows.map((row: any) => [String(row.co_ven ?? '').trim(), row]));
      const remoteMap = new Map<string, any>(remoteRows.map((row: any) => [String(row.co_ven ?? '').trim(), row]));

      for (const [coVen, remoteRow] of remoteMap.entries()) {
        if (!localMap.has(coVen)) {
          try {
            await profitMirrorSequelize.query(
              `INSERT INTO vw_flota_vendedores (co_ven, cedula, ven_des) VALUES (?, ?, ?)`,
              {
                replacements: [coVen, normalizeText(remoteRow.cedula), normalizeText(remoteRow.ven_des)],
                type: QueryTypes.INSERT,
              }
            );
            report.insertedLocal++;
            logger.info(`[MasterSyncService:vendedores] ➕ LOCAL ← MSSQL: ${coVen} - ${normalizeText(remoteRow.ven_des)}`);
          } catch (e: any) {
            report.errors.push(`LOCAL insert ${coVen}: ${e.message}`);
          }
          continue;
        }

        const localRow = localMap.get(coVen)!;
        if (hasVendorDifference(localRow, remoteRow)) {
          try {
            await profitMirrorSequelize.query(
              `UPDATE vw_flota_vendedores SET cedula = ?, ven_des = ? WHERE co_ven = ?`,
              {
                replacements: [normalizeText(remoteRow.cedula), normalizeText(remoteRow.ven_des), coVen],
                type: QueryTypes.UPDATE,
              }
            );
            report.updatedLocal++;
            logger.debug(`[MasterSyncService:vendedores] ✏️ LOCAL actualizado desde MSSQL: ${coVen}`);
          } catch (e: any) {
            report.errors.push(`LOCAL update ${coVen}: ${e.message}`);
          }

          try {
            await profitSequelize.query(
              `UPDATE [AD_TRANS].[dbo].[vw_flota_vendedores] SET cedula = ?, ven_des = ? WHERE co_ven = ?`,
              {
                replacements: [normalizeText(localRow.cedula), normalizeText(localRow.ven_des), coVen],
                type: QueryTypes.UPDATE,
              }
            );
            report.updatedRemote++;
            logger.debug(`[MasterSyncService:vendedores] ✏️ REMOTE actualizado desde LOCAL: ${coVen}`);
          } catch (e: any) {
            report.errors.push(`REMOTE update ${coVen}: ${e.message}`);
          }
        } else {
          report.unchanged++;
        }
      }

      for (const [coVen, localRow] of localMap.entries()) {
        if (!remoteMap.has(coVen)) {
          try {
            await profitSequelize.query(
              `INSERT INTO [AD_TRANS].[dbo].[vw_flota_vendedores] (co_ven, cedula, ven_des) VALUES (?, ?, ?)`,
              {
                replacements: [coVen, normalizeText(localRow.cedula), normalizeText(localRow.ven_des)],
                type: QueryTypes.INSERT,
              }
            );
            report.insertedRemote++;
            logger.info(`[MasterSyncService:vendedores] ➕ MSSQL ← LOCAL: ${coVen} - ${normalizeText(localRow.ven_des)}`);
          } catch (e: any) {
            report.errors.push(`REMOTE insert ${coVen}: ${e.message}`);
          }
        }
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

    const normalizeText = (value: unknown): string => String(value ?? '').trim();
    const normalizeNumber = (value: unknown): number => {
      const num = Number(value);
      return Number.isFinite(num) ? num : 0;
    };
    const hasArticleDifference = (left: any, right: any): boolean => {
      return (
        normalizeText(left?.nombre_producto) !== normalizeText(right?.nombre_producto) ||
        normalizeText(left?.categoria) !== normalizeText(right?.categoria) ||
        normalizeText(left?.unidad_medida) !== normalizeText(right?.unidad_medida) ||
        normalizeNumber(left?.costo) !== normalizeNumber(right?.costo) ||
        normalizeNumber(left?.stock_act) !== normalizeNumber(right?.stock_act)
      );
    };

    try {
      const [localCountResult] = (await profitMirrorSequelize.query(`SELECT COUNT(*) AS c FROM vw_flota_articulos`)) as any;
      report.localCount = parseInt(localCountResult?.[0]?.c ?? localCountResult?.[0]?.C ?? '0', 10) || 0;

      if (!remoteReachable) {
        logger.warn('[MasterSyncService:articulos] MSSQL no disponible. Solo se contabilizaron registros locales.');
        report.durationMs = Date.now() - start;
        return report;
      }

      const [remoteCountResult] = (await profitSequelize.query(
        `SELECT COUNT(*) AS c FROM [AD_TRANS].[dbo].[vw_flota_articulos] WITH (NOLOCK)`
      )) as any;
      report.remoteCount = parseInt(remoteCountResult?.[0]?.c ?? '0', 10) || 0;

      const [localRowsRaw] = (await profitMirrorSequelize.query(
        `SELECT codigo_profit, nombre_producto, codigo_categoria, categoria, unidad_medida,
                costo, tipo, codigo_subalmacen, sub_almacen, codigo_almacen, almacen, stock_act
         FROM vw_flota_articulos`
      )) as any;
      const localRows: any[] = Array.isArray(localRowsRaw) ? localRowsRaw : [];

      const [remoteRowsRaw] = (await profitSequelize.query(
        `SELECT codigo_profit, nombre_producto, codigo_categoria, categoria, unidad_medida,
                costo, tipo, codigo_subalmacen, sub_almacen, codigo_almacen, almacen, stock_act
         FROM [AD_TRANS].[dbo].[vw_flota_articulos] WITH (NOLOCK)`
      )) as any;
      const remoteRows: any[] = Array.isArray(remoteRowsRaw) ? remoteRowsRaw : [];

      const localMap = new Map<string, any>(localRows.map((row: any) => [String(row.codigo_profit ?? '').trim(), row]));
      const remoteMap = new Map<string, any>(remoteRows.map((row: any) => [String(row.codigo_profit ?? '').trim(), row]));

      for (const [codigo, remoteRow] of remoteMap.entries()) {
        if (!localMap.has(codigo)) {
          try {
            await profitMirrorSequelize.query(
              `INSERT INTO vw_flota_articulos (
                codigo_profit, nombre_producto, codigo_categoria, categoria, unidad_medida,
                costo, tipo, codigo_subalmacen, sub_almacen, codigo_almacen, almacen, stock_act
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              {
                replacements: [
                  codigo,
                  normalizeText(remoteRow.nombre_producto),
                  normalizeText(remoteRow.codigo_categoria),
                  normalizeText(remoteRow.categoria),
                  normalizeText(remoteRow.unidad_medida),
                  normalizeNumber(remoteRow.costo),
                  normalizeText(remoteRow.tipo),
                  normalizeText(remoteRow.codigo_subalmacen),
                  normalizeText(remoteRow.sub_almacen),
                  normalizeText(remoteRow.codigo_almacen),
                  normalizeText(remoteRow.almacen),
                  normalizeNumber(remoteRow.stock_act),
                ],
                type: QueryTypes.INSERT,
              }
            );
            report.insertedLocal++;
            logger.info(`[MasterSyncService:articulos] ➕ LOCAL ← MSSQL: ${codigo} - ${normalizeText(remoteRow.nombre_producto)}`);
          } catch (e: any) {
            report.errors.push(`LOCAL insert ${codigo}: ${e.message}`);
          }
          continue;
        }

        const localRow = localMap.get(codigo)!;
        if (hasArticleDifference(localRow, remoteRow)) {
          try {
            await profitMirrorSequelize.query(
              `UPDATE vw_flota_articulos SET
                nombre_producto = ?, codigo_categoria = ?, categoria = ?, unidad_medida = ?,
                costo = ?, tipo = ?, codigo_subalmacen = ?, sub_almacen = ?, codigo_almacen = ?,
                almacen = ?, stock_act = ?
               WHERE codigo_profit = ?`,
              {
                replacements: [
                  normalizeText(remoteRow.nombre_producto),
                  normalizeText(remoteRow.codigo_categoria),
                  normalizeText(remoteRow.categoria),
                  normalizeText(remoteRow.unidad_medida),
                  normalizeNumber(remoteRow.costo),
                  normalizeText(remoteRow.tipo),
                  normalizeText(remoteRow.codigo_subalmacen),
                  normalizeText(remoteRow.sub_almacen),
                  normalizeText(remoteRow.codigo_almacen),
                  normalizeText(remoteRow.almacen),
                  normalizeNumber(remoteRow.stock_act),
                  codigo,
                ],
                type: QueryTypes.UPDATE,
              }
            );
            report.updatedLocal++;
            logger.debug(`[MasterSyncService:articulos] ✏️ LOCAL actualizado desde MSSQL: ${codigo}`);
          } catch (e: any) {
            report.errors.push(`LOCAL update ${codigo}: ${e.message}`);
          }

          try {
            await profitSequelize.query(
              `UPDATE [AD_TRANS].[dbo].[vw_flota_articulos] SET
                nombre_producto = ?, codigo_categoria = ?, categoria = ?, unidad_medida = ?,
                costo = ?, tipo = ?, codigo_subalmacen = ?, sub_almacen = ?, codigo_almacen = ?,
                almacen = ?, stock_act = ?
               WHERE codigo_profit = ?`,
              {
                replacements: [
                  normalizeText(localRow.nombre_producto),
                  normalizeText(localRow.codigo_categoria),
                  normalizeText(localRow.categoria),
                  normalizeText(localRow.unidad_medida),
                  normalizeNumber(localRow.costo),
                  normalizeText(localRow.tipo),
                  normalizeText(localRow.codigo_subalmacen),
                  normalizeText(localRow.sub_almacen),
                  normalizeText(localRow.codigo_almacen),
                  normalizeText(localRow.almacen),
                  normalizeNumber(localRow.stock_act),
                  codigo,
                ],
                type: QueryTypes.UPDATE,
              }
            );
            report.updatedRemote++;
            logger.debug(`[MasterSyncService:articulos] ✏️ REMOTE actualizado desde LOCAL: ${codigo}`);
          } catch (e: any) {
            report.errors.push(`REMOTE update ${codigo}: ${e.message}`);
          }
        } else {
          report.unchanged++;
        }
      }

      for (const [codigo, localRow] of localMap.entries()) {
        if (!remoteMap.has(codigo)) {
          try {
            await profitSequelize.query(
              `INSERT INTO [AD_TRANS].[dbo].[vw_flota_articulos] (
                codigo_profit, nombre_producto, codigo_categoria, categoria, unidad_medida,
                costo, tipo, codigo_subalmacen, sub_almacen, codigo_almacen, almacen, stock_act
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              {
                replacements: [
                  codigo,
                  normalizeText(localRow.nombre_producto),
                  normalizeText(localRow.codigo_categoria),
                  normalizeText(localRow.categoria),
                  normalizeText(localRow.unidad_medida),
                  normalizeNumber(localRow.costo),
                  normalizeText(localRow.tipo),
                  normalizeText(localRow.codigo_subalmacen),
                  normalizeText(localRow.sub_almacen),
                  normalizeText(localRow.codigo_almacen),
                  normalizeText(localRow.almacen),
                  normalizeNumber(localRow.stock_act),
                ],
                type: QueryTypes.INSERT,
              }
            );
            report.insertedRemote++;
            logger.info(`[MasterSyncService:articulos] ➕ MSSQL ← LOCAL: ${codigo} - ${normalizeText(localRow.nombre_producto)}`);
          } catch (e: any) {
            report.errors.push(`REMOTE insert ${codigo}: ${e.message}`);
          }
        }
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
            await FlotaOrdenServicioProfit.create({
              nro_orden: remote.nro_orden,
              Placa: remote.Placa,
              km_horometro: remote.km_horometro,
              recibido_por: remote.recibido_por,
              entregado_por: remote.entregado_por ?? null,
              fec_apertura: remote.fec_apertura ?? new Date(),
              fec_cierre: remote.fec_cierre ?? null,
              sintomas_reportados: remote.sintomas_reportados ?? '',
              es_reincidencia: Boolean(remote.es_reincidencia),
              nro_orden_anterior: remote.nro_orden_anterior ?? null,
              motivo_reincidencia: remote.motivo_reincidencia ?? null,
              fotos_adjuntas: remote.fotos_adjuntas ?? 0,
              estatus: remote.estatus ?? 'ABIERTA',
              costo_repuestos: remote.costo_repuestos ?? 0,
              costo_mano_obra: remote.costo_mano_obra ?? 0,
              costo_servicios_ext: remote.costo_servicios_ext ?? 0,
              costo_total: remote.costo_total ?? 0,
              recibe_conforme: remote.recibe_conforme ?? null,
              hora_apertura: remote.hora_apertura ?? null,
              hora_cierre: remote.hora_cierre ?? null,
            });
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
            await FlotaOrdenServicioProfit.update(
              {
                Placa: remote.Placa,
                km_horometro: remote.km_horometro,
                recibido_por: remote.recibido_por,
                entregado_por: remote.entregado_por ?? null,
                fec_apertura: remote.fec_apertura ?? new Date(),
                fec_cierre: remote.fec_cierre ?? null,
                sintomas_reportados: remote.sintomas_reportados ?? '',
                es_reincidencia: Boolean(remote.es_reincidencia),
                nro_orden_anterior: remote.nro_orden_anterior ?? null,
                motivo_reincidencia: remote.motivo_reincidencia ?? null,
                fotos_adjuntas: remote.fotos_adjuntas ?? 0,
                estatus: remote.estatus ?? 'ABIERTA',
                costo_repuestos: remote.costo_repuestos ?? 0,
                costo_mano_obra: remote.costo_mano_obra ?? 0,
                costo_servicios_ext: remote.costo_servicios_ext ?? 0,
                costo_total: remote.costo_total ?? 0,
                recibe_conforme: remote.recibe_conforme ?? null,
                hora_apertura: remote.hora_apertura ?? null,
                hora_cierre: remote.hora_cierre ?? null,
              },
              { where: { nro_orden: nroOrden } }
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