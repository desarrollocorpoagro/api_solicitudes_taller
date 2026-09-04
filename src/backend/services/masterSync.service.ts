import { Op, fn, col, literal, Sequelize } from 'sequelize';
import { profitSequelize, profitMirrorSequelize, getProfitConnectionStatus, isMssqlConnectionActive } from '../config/profitDb';
import { sequelize } from '../config/database';
import MecanicosProfit from '../models/MecanicosProfit.model';
import VwFlotaVendedores from '../models/VwFlotaVendedores.model';
import VwFlotaArticulos from '../models/VwFlotaArticulos.model';
import FlotaOrdenServicioProfit from '../models/FlotaOrdenServicioProfit.model';
import CatalogoRepuesto from '../models/CatalogoRepuesto.model';
import FlotaVehicular from '../models/FlotaVehicular.model';
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
  entity: 'mecanicos' | 'vendedores' | 'articulos' | 'flota_ordenes_servicio' | 'flota_vehiculos';
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

  private static asText(value: any, fallback = ''): string {
    if (value === null || value === undefined) return fallback;
    const normalized = String(value).trim();
    return normalized.length > 0 ? normalized : fallback;
  }

  private static asNumber(value: any, fallback = 0): number {
    if (value === null || value === undefined || value === '') return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  private static asBooleanInt(value: any): number {
    if (value === null || value === undefined || value === '') return 0;
    if (typeof value === 'boolean') return value ? 1 : 0;
    const normalized = String(value).trim().toLowerCase();
    if (['1', 'true', 'y', 'yes', 's', 'si'].includes(normalized)) return 1;
    if (['0', 'false', 'n', 'no'].includes(normalized)) return 0;
    return Number(value) ? 1 : 0;
  }

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
    entities?: Array<'mecanicos' | 'vendedores' | 'articulos' | 'flota_ordenes_servicio' | 'flota_vehiculos'>;
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
    const entities = opts.entities || ['mecanicos', 'vendedores', 'articulos', 'flota_ordenes_servicio', 'flota_vehiculos'];

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
      if (entities.includes('flota_vehiculos')) {
        report.flota_vehiculos = await this.syncFlotaVehiculos(remoteReachable);
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
                {
                  replacements: [
                    this.asText(remote.codigo, 'SIN_CODIGO'),
                    this.asText(remote.nombre, 'SIN NOMBRE'),
                    this.asText(remote.cargo, ''),
                    this.asBooleanInt(remote.activo),
                  ],
                }
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
                  {
                    replacements: [
                      this.asText(remote.nombre, 'SIN NOMBRE'),
                      this.asText(remote.cargo, ''),
                      this.asBooleanInt(remote.activo),
                      codigo,
                    ],
                  }
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
                {
                  replacements: [
                    this.asText(remote.co_ven, 'SIN_CODIGO'),
                    this.asText(remote.cedula, ''),
                    this.asText(remote.ven_des, 'SIN NOMBRE'),
                  ],
                }
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
                  {
                    replacements: [
                      this.asText(remote.cedula, ''),
                      this.asText(remote.ven_des, 'SIN NOMBRE'),
                      coVen,
                    ],
                  }
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
  // FLOTA VEHICULAR
  // ============================================================
  private static async syncFlotaVehiculos(remoteReachable: boolean): Promise<MasterSyncReport> {
    const start = Date.now();
    const report: MasterSyncReport = {
      entity: 'flota_vehiculos',
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
      const localTableExists = await profitMirrorSequelize.query(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='flota_vehiculos'"
      );
      if (!localTableExists?.[0]?.length) {
        await profitMirrorSequelize.query(`
          CREATE TABLE IF NOT EXISTS flota_vehiculos (
            codigo TEXT,
            Placa TEXT PRIMARY KEY,
            placa_anterior TEXT,
            Empresa_Propietaria TEXT,
            fec_adquisicion TEXT,
            Marca TEXT,
            Modelo TEXT,
            color TEXT,
            Año INTEGER,
            clase TEXT,
            Tipo TEXT,
            Carga_max_kg REAL,
            Carga_max_lts REAL,
            Serial_carroceria1 TEXT,
            Serial_carroceria2 TEXT,
            Serial_Motor TEXT,
            Uso TEXT,
            Estatus_operatividad TEXT,
            Observaciones TEXT,
            cant_cauchos_vehiculo INTEGER,
            medida_caucho_vehiculo TEXT,
            km_actual REAL,
            tipo_bateria1 TEXT,
            serial_bateria1 TEXT,
            fec_garantia_bateria1 TEXT,
            tipo_bateria2 TEXT,
            serial_bateria2 TEXT,
            fec_garantia_bateria2 TEXT,
            contrato_seguro TEXT,
            empresa_seguro TEXT,
            fec_venc_seguro TEXT,
            fec_venc_trimestres TEXT,
            nro_ROTC TEXT,
            fec_venc_ROTC TEXT,
            nro_RACDA TEXT,
            fec_venc_RACDA TEXT,
            nro_gps1 TEXT,
            nro_gps2 TEXT,
            nro_ejes INTEGER,
            calibracion TEXT,
            venc_calibrac TEXT,
            tara REAL,
            funcion TEXT,
            division TEXT,
            activo INTEGER DEFAULT 1
          );
        `);
      }

      const [localCountResult] = (await profitMirrorSequelize.query(`SELECT COUNT(*) AS c FROM flota_vehiculos`)) as any;
      report.localCount = parseInt(localCountResult?.[0]?.c ?? '0', 10) || 0;

      if (remoteReachable) {
        const remoteTableCheck = await profitSequelize.query(
          `SELECT TOP 1 * FROM [INFORMATION_SCHEMA].[TABLES] WHERE TABLE_NAME IN ('flota_vehiculos', 'flota_vehicular')`
        );
        if (remoteTableCheck?.[0]?.length) {
          const tableMeta = remoteTableCheck[0][0] as { TABLE_NAME?: string };
          const tableName = tableMeta.TABLE_NAME;
          if (!tableName) {
            throw new Error('No se pudo determinar el nombre de la tabla remota de flota vehicular.');
          }
          const [remoteCountResult] = (await profitSequelize.query(`SELECT COUNT(*) AS c FROM [AD_TRANS].[dbo].[${tableName}] WITH (NOLOCK)`)) as any;
          report.remoteCount = parseInt(remoteCountResult?.[0]?.c ?? '0', 10) || 0;

          const [remoteRowsRaw] = (await profitSequelize.query(
            `SELECT * FROM [AD_TRANS].[dbo].[${tableName}] WITH (NOLOCK)`
          )) as any;
          const remoteRows = remoteRowsRaw || [];
          const [localRowsRaw] = (await profitMirrorSequelize.query(`SELECT * FROM flota_vehiculos`)) as any;
          const localRows = localRowsRaw || [];
          const localMap = new Map<string, any>(localRows.map((r: any) => [String(r.Placa ?? r.placa).trim(), r]));
          const remoteMap = new Map<string, any>(remoteRows.map((r: any) => [String(r.Placa ?? r.placa).trim(), r]));

          for (const [placa, remote] of remoteMap.entries()) {
            const flotaColumns: Array<[string, () => any]> = [
              ['codigo', () => this.asText(remote.codigo, '')],
              ['Placa', () => this.asText(remote.Placa ?? remote.placa ?? placa, 'SIN_PLACA')],
              ['placa_anterior', () => this.asText(remote.placa_anterior, '')],
              ['Empresa_Propietaria', () => this.asText(remote.Empresa_Propietaria, '')],
              ['fec_adquisicion', () => remote.fec_adquisicion ?? null],
              ['Marca', () => this.asText(remote.Marca, '')],
              ['Modelo', () => this.asText(remote.Modelo, '')],
              ['color', () => this.asText(remote.color, '')],
              ['Año', () => this.asNumber(remote.Año, 0)],
              ['clase', () => this.asText(remote.clase, '')],
              ['Tipo', () => this.asText(remote.Tipo, '')],
              ['Carga_max_kg', () => this.asNumber(remote.Carga_max_kg, 0)],
              ['Carga_max_lts', () => this.asNumber(remote.Carga_max_lts, 0)],
              ['Serial_carroceria1', () => this.asText(remote.Serial_carroceria1, '')],
              ['Serial_carroceria2', () => this.asText(remote.Serial_carroceria2, '')],
              ['Serial_Motor', () => this.asText(remote.Serial_Motor, '')],
              ['Uso', () => this.asText(remote.Uso, '')],
              ['Estatus_operatividad', () => this.asText(remote.Estatus_operatividad, '')],
              ['Observaciones', () => this.asText(remote.Observaciones, '')],
              ['cant_cauchos_vehiculo', () => this.asNumber(remote.cant_cauchos_vehiculo, 0)],
              ['medida_caucho_vehiculo', () => this.asText(remote.medida_caucho_vehiculo, '')],
              ['km_actual', () => this.asNumber(remote.km_actual, 0)],
              ['tipo_bateria1', () => this.asText(remote.tipo_bateria1, '')],
              ['serial_bateria1', () => this.asText(remote.serial_bateria1, '')],
              ['fec_garantia_bateria1', () => remote.fec_garantia_bateria1 ?? null],
              ['tipo_bateria2', () => this.asText(remote.tipo_bateria2, '')],
              ['serial_bateria2', () => this.asText(remote.serial_bateria2, '')],
              ['fec_garantia_bateria2', () => remote.fec_garantia_bateria2 ?? null],
              ['contrato_seguro', () => this.asText(remote.contrato_seguro, '')],
              ['empresa_seguro', () => this.asText(remote.empresa_seguro, '')],
              ['fec_venc_seguro', () => remote.fec_venc_seguro ?? null],
              ['fec_venc_trimestres', () => remote.fec_venc_trimestres ?? null],
              ['nro_ROTC', () => this.asText(remote.nro_ROTC, '')],
              ['fec_venc_ROTC', () => remote.fec_venc_ROTC ?? null],
              ['nro_RACDA', () => this.asText(remote.nro_RACDA, '')],
              ['fec_venc_RACDA', () => remote.fec_venc_RACDA ?? null],
              ['nro_gps1', () => this.asText(remote.nro_gps1, '')],
              ['nro_gps2', () => this.asText(remote.nro_gps2, '')],
              ['nro_ejes', () => this.asNumber(remote.nro_ejes, 0)],
              ['calibracion', () => this.asText(remote.calibracion, '')],
              ['venc_calibrac', () => remote.venc_calibrac ?? null],
              ['tara', () => this.asNumber(remote.tara, 0)],
              ['funcion', () => this.asText(remote.funcion, '')],
              ['division', () => this.asText(remote.division, '')],
              ['activo', () => this.asBooleanInt(remote.activo)],
            ];

            if (!localMap.has(placa)) {
              try {
                const colsSql = flotaColumns.map((c) => c[0]).join(', ');
                const placeholdersSql = flotaColumns.map(() => '?').join(', ');
                const values = flotaColumns.map((c) => c[1]());
                await profitMirrorSequelize.query(
                  `INSERT INTO flota_vehiculos (${colsSql}) VALUES (${placeholdersSql})`,
                  { replacements: values }
                );
                report.insertedLocal++;
              } catch (e: any) {
                report.errors.push(`LOCAL insert ${placa}: ${e.message}`);
              }
            } else {
              const local = localMap.get(placa);
              const differs = JSON.stringify({
                codigo: local?.codigo ?? null,
                placa_anterior: local?.placa_anterior ?? null,
                Empresa_Propietaria: local?.Empresa_Propietaria ?? null,
                Marca: local?.Marca ?? null,
                Modelo: local?.Modelo ?? null,
                color: local?.color ?? null,
                Año: local?.Año ?? null,
                clase: local?.clase ?? null,
                Tipo: local?.Tipo ?? null,
                Carga_max_kg: local?.Carga_max_kg ?? null,
                Carga_max_lts: local?.Carga_max_lts ?? null,
                km_actual: local?.km_actual ?? null,
                activo: local?.activo ?? null,
              }) !== JSON.stringify({
                codigo: remote?.codigo ?? null,
                placa_anterior: remote?.placa_anterior ?? null,
                Empresa_Propietaria: remote?.Empresa_Propietaria ?? null,
                Marca: remote?.Marca ?? null,
                Modelo: remote?.Modelo ?? null,
                color: remote?.color ?? null,
                Año: remote?.Año ?? null,
                clase: remote?.clase ?? null,
                Tipo: remote?.Tipo ?? null,
                Carga_max_kg: remote?.Carga_max_kg ?? null,
                Carga_max_lts: remote?.Carga_max_lts ?? null,
                km_actual: remote?.km_actual ?? null,
                activo: remote?.activo ?? null,
              });
              if (differs) {
                try {
                  await profitMirrorSequelize.query(
                    `UPDATE flota_vehiculos SET codigo = ?, placa_anterior = ?, Empresa_Propietaria = ?, fec_adquisicion = ?, Marca = ?, Modelo = ?, color = ?, Año = ?, clase = ?, Tipo = ?, Carga_max_kg = ?, Carga_max_lts = ?, Serial_carroceria1 = ?, Serial_carroceria2 = ?, Serial_Motor = ?, Uso = ?, Estatus_operatividad = ?, Observaciones = ?, cant_cauchos_vehiculo = ?, medida_caucho_vehiculo = ?, km_actual = ?, tipo_bateria1 = ?, serial_bateria1 = ?, fec_garantia_bateria1 = ?, tipo_bateria2 = ?, serial_bateria2 = ?, fec_garantia_bateria2 = ?, contrato_seguro = ?, empresa_seguro = ?, fec_venc_seguro = ?, fec_venc_trimestres = ?, nro_ROTC = ?, fec_venc_ROTC = ?, nro_RACDA = ?, fec_venc_RACDA = ?, nro_gps1 = ?, nro_gps2 = ?, nro_ejes = ?, calibracion = ?, venc_calibrac = ?, tara = ?, funcion = ?, division = ?, activo = ? WHERE Placa = ?`,
                    { replacements: [
                      remote.codigo ?? null,
                      remote.placa_anterior ?? null,
                      remote.Empresa_Propietaria ?? null,
                      remote.fec_adquisicion ?? null,
                      remote.Marca ?? null,
                      remote.Modelo ?? null,
                      remote.color ?? null,
                      remote.Año ?? null,
                      remote.clase ?? null,
                      remote.Tipo ?? null,
                      remote.Carga_max_kg ?? null,
                      remote.Carga_max_lts ?? null,
                      remote.Serial_carroceria1 ?? null,
                      remote.Serial_carroceria2 ?? null,
                      remote.Serial_Motor ?? null,
                      remote.Uso ?? null,
                      remote.Estatus_operatividad ?? null,
                      remote.Observaciones ?? null,
                      remote.cant_cauchos_vehiculo ?? null,
                      remote.medida_caucho_vehiculo ?? null,
                      remote.km_actual ?? null,
                      remote.tipo_bateria1 ?? null,
                      remote.serial_bateria1 ?? null,
                      remote.fec_garantia_bateria1 ?? null,
                      remote.tipo_bateria2 ?? null,
                      remote.serial_bateria2 ?? null,
                      remote.fec_garantia_bateria2 ?? null,
                      remote.contrato_seguro ?? null,
                      remote.empresa_seguro ?? null,
                      remote.fec_venc_seguro ?? null,
                      remote.fec_venc_trimestres ?? null,
                      remote.nro_ROTC ?? null,
                      remote.fec_venc_ROTC ?? null,
                      remote.nro_RACDA ?? null,
                      remote.fec_venc_RACDA ?? null,
                      remote.nro_gps1 ?? null,
                      remote.nro_gps2 ?? null,
                      remote.nro_ejes ?? null,
                      remote.calibracion ?? null,
                      remote.venc_calibrac ?? null,
                      remote.tara ?? null,
                      remote.funcion ?? null,
                      remote.division ?? null,
                      remote.activo ?? 1,
                      placa,
                    ] }
                  );
                  report.updatedLocal++;
                } catch (e: any) {
                  report.errors.push(`LOCAL update ${placa}: ${e.message}`);
                }
              } else {
                report.unchanged++;
              }
            }
          }
        }
      }
    } catch (err: any) {
      report.errors.push(`General: ${err.message}`);
      logger.error(`[MasterSyncService:flota_vehiculos] Error: ${err.message}`);
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
                this.asText(remote.nro_orden, 'SIN_ORDEN'),
                this.asText(remote.Placa, 'SIN_PLACA'),
                this.asNumber(remote.km_horometro, 0),
                this.asText(remote.recibido_por, 'DESCONOCIDO'),
                this.asText(remote.entregado_por, ''),
                remote.fec_apertura ?? new Date(),
                remote.fec_cierre ?? null,
                this.asText(remote.sintomas_reportados, 'SIN SINTOMAS'),
                this.asBooleanInt(remote.es_reincidencia),
                this.asText(remote.nro_orden_anterior, ''),
                this.asText(remote.motivo_reincidencia, ''),
                this.asNumber(remote.fotos_adjuntas, 0),
                this.asText(remote.estatus, 'ABIERTA'),
                this.asNumber(remote.costo_repuestos, 0),
                this.asNumber(remote.costo_mano_obra, 0),
                this.asNumber(remote.costo_servicios_ext, 0),
                this.asNumber(remote.costo_total, 0),
                this.asText(remote.recibe_conforme, ''),
                remote.hora_apertura ?? null,
                remote.hora_cierre ?? null,
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
                this.asText(remote.Placa, 'SIN_PLACA'),
                this.asNumber(remote.km_horometro, 0),
                this.asText(remote.recibido_por, 'DESCONOCIDO'),
                this.asText(remote.entregado_por, ''),
                remote.fec_apertura ?? new Date(),
                remote.fec_cierre ?? null,
                this.asText(remote.sintomas_reportados, 'SIN SINTOMAS'),
                this.asBooleanInt(remote.es_reincidencia),
                this.asText(remote.nro_orden_anterior, ''),
                this.asText(remote.motivo_reincidencia, ''),
                this.asNumber(remote.fotos_adjuntas, 0),
                this.asText(remote.estatus, 'ABIERTA'),
                this.asNumber(remote.costo_repuestos, 0),
                this.asNumber(remote.costo_mano_obra, 0),
                this.asNumber(remote.costo_servicios_ext, 0),
                this.asNumber(remote.costo_total, 0),
                this.asText(remote.recibe_conforme, ''),
                remote.hora_apertura ?? null,
                remote.hora_cierre ?? null,
                nroOrden,
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