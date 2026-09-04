import { Op } from 'sequelize';
import { sequelize, SolicitudRepuesto, OrdenServicio } from '../models';
import { profitMirrorSequelize, profitSequelize, isMssqlConnectionActive } from '../config/profitDb';
import { Gasto } from '../models/Gasto.model';
import { logger } from '../utils/logger';

export interface GastoDraft {
  ordenId: string;
  solicitudId: string;
  codigo_articulo: string;
  co_prov?: string;
  cantidad: number;
  horas_trabajadas?: number;
  fecha_actividad?: Date;
  usuario?: string;
  nota?: string;
  co_cli?: string;
}

interface ArticuloEspejo {
  codigo_profit?: string | null;
  unidad_medida?: string | null;
  costo?: number | null;
  codigo_subalmacen?: string | null;
}

/**
 * Busca los datos espejo del artículo (`vw_flota_articulos`) por `codigo_profit`.
 * Devuelve null si la fila no existe para que el caller decida cómo continuar.
 */
export async function findArticuloEspejo(codigoArticulo: string): Promise<ArticuloEspejo | null> {
  const [rows]: any = await profitMirrorSequelize.query(
    `SELECT codigo_profit, unidad_medida, costo, codigo_subalmacen
     FROM vw_flota_articulos
     WHERE LTRIM(RTRIM(codigo_profit)) = LTRIM(RTRIM(?))
     LIMIT 1`,
    { replacements: [codigoArticulo] }
  );
  return rows?.[0] ?? null;
}

function calcTotal(cantidad: number, costo: number, horas: number): number {
  if (horas > 0) {
    return Number((horas * costo).toFixed(4));
  }
  return Number((cantidad * costo).toFixed(4));
}

/**
 * Garantiza que exista un `Gasto` local asociado a la solicitud de repuesto,
 * siempre que la orden padre NO esté en estado `Cerrada`. Si ya existe (por
 * una re-sincronización o reintento), se actualiza con los nuevos valores.
 */
export async function ensureLocalGastoForSolicitud(
  solicitud: SolicitudRepuesto,
  opts: { usuario?: string; nota?: string } = {}
): Promise<Gasto | null> {
  const orden = await OrdenServicio.findByPk(solicitud.ordenId);
  if (!orden) {
    logger.warn(`[GastosService] Orden ${solicitud.ordenId} no encontrada, gasto omitido.`);
    return null;
  }

  if (orden.estado === 'Cerrada') {
    logger.debug(`[GastosService] Orden ${orden.id} cerrada, no se genera gasto.`);
    return null;
  }

  const articulo = await findArticuloEspejo(solicitud.cod);
  if (!articulo) {
    logger.warn(
      `[GastosService] Artículo ${solicitud.cod} no encontrado en vw_flota_articulos; gasto omitido.`
    );
    return null;
  }

  const cantidad = Number(solicitud.cant ?? 0);
  const horas = 0; // Por defecto, se sobreescribe en una fase posterior
  const costoUnitario = Number(articulo.costo ?? solicitud.costoUnitario ?? 0);
  const total = calcTotal(cantidad, costoUnitario, horas);

  // Resolver la placa vehicular desde la orden padre (validada contra flota_vehiculos).
  // Queda en blanco por defecto si la orden no tiene placa asignada.
  const placa = (orden.placa ?? '').toString().trim();

  const [gasto, created] = await Gasto.findOrCreate({
    where: { solicitudId: solicitud.id },
    defaults: {
      ordenId: solicitud.ordenId,
      solicitudId: solicitud.id,
      codigo_articulo: solicitud.cod,
      codigo_subalmacen: articulo.codigo_subalmacen ?? null,
      co_cli: opts.nota ?? null,
      co_prov: 'GEN',
      fecha_actividad: new Date(),
      cantidad,
      unidad: articulo.unidad_medida ?? null,
      horas_trabajadas: horas,
      costo_unitario: costoUnitario,
      costo_total_calculado: total,
      usuario: opts.usuario ?? '',
      nota: opts.nota ?? '',
      fecha_create: new Date(),
      placa,
      syncedToMssql: false,
    },
  });

  if (!created) {
    gasto.codigo_articulo = solicitud.cod;
    gasto.codigo_subalmacen = articulo.codigo_subalmacen ?? gasto.codigo_subalmacen;
    gasto.cantidad = cantidad;
    gasto.unidad = articulo.unidad_medida ?? gasto.unidad;
    gasto.horas_trabajadas = horas;
    gasto.costo_unitario = costoUnitario;
    gasto.costo_total_calculado = total;
    gasto.fecha_actividad = new Date();
    gasto.placa = placa || gasto.placa || '';
    gasto.syncedToMssql = false;
    gasto.mssqlError = null;
    await gasto.save();
  }

  return gasto;
}

export interface SyncReport {
  attempted: number;
  inserted: number;
  failed: number;
  errors: string[];
  durationMs: number;
}

/**
 * Empuja a MSSQL Profit AD_TRANS los gastos locales pendientes.
 * Si MSSQL no está disponible, registra el error por fila para reintento.
 *
 * Estrategia:
 *  1. Espera activamente a que MSSQL responda (ping + retry exponencial acotado).
 *  2. Asegura que la tabla `dbo.gastos` exista (DDL idempotente).
 *  3. Descubre las columnas reales de `dbo.gastos` vía INFORMATION_SCHEMA.COLUMNS
 *     para no fallar si el esquema real tiene una forma distinta.
 *  4. Hace un upsert idempotente sobre la clave natural
 *     (codigo_articulo) usando `MERGE` cuando es MSSQL
 *     y `INSERT ... ON CONFLICT` cuando es SQLite (modo fallback).
 */
export async function syncGastosToMssql(opts: { limit?: number } = {}): Promise<SyncReport> {
  const startedAt = Date.now();
  const report: SyncReport = {
    attempted: 0,
    inserted: 0,
    failed: 0,
    errors: [],
    durationMs: 0,
  };

  // 0. Esperar a que MSSQL esté realmente disponible. Si el servidor se recuperó
  //    pero isMssqlConnectionActive() aún devuelve true mientras las queries
  //    fallan por timeout, seguimos reintentando con backoff acotado.
  const ready = await waitForMssqlReady(20_000, 1_000);
  if (!ready) {
    report.errors.push('MSSQL Profit no responde tras 20s; sincronización omitida (se reintentará en el próximo ciclo).');
    report.durationMs = Date.now() - startedAt;
    logger.warn(`[GastosService] MSSQL no responde aún; omitiendo ciclo.`);
    return report;
  }

  // 1. Garantizar la tabla una sola vez por ciclo, no por fila.
  try {
    await ensureMssqlGastosTable();
  } catch (err: any) {
    report.errors.push(`ensureMssqlGastosTable: ${err?.message ?? err}`);
    report.durationMs = Date.now() - startedAt;
    logger.error(`[GastosService] No se pudo preparar dbo.gastos en MSSQL: ${err?.message ?? err}`);
    return report;
  }

  // 2. Descubrir columnas reales para evitar INSERT sobre columnas inexistentes.
  let mssqlColumns: Set<string>;
  let mergeKeys: string[];
  try {
    const cols = await introspectMssqlGastosColumns();
    mssqlColumns = cols;
    // Columnas que usaremos como clave natural del upsert (omitimos si no existen en MSSQL).
    mergeKeys = ['ordenId', 'solicitudId', 'codigo_articulo'].filter((k) => mssqlColumns.has(k));
    if (mergeKeys.length === 0) {
      // Si no hay ninguna clave natural, caemos a INSERT sin deduplicar.
      mergeKeys = [];
    }
  } catch (err: any) {
    report.errors.push(`introspectMssqlGastosColumns: ${err?.message ?? err}`);
    report.durationMs = Date.now() - startedAt;
    logger.error(`[GastosService] No se pudo leer INFORMATION_SCHEMA.COLUMNS: ${err?.message ?? err}`);
    return report;
  }

  // 3. Columnas que vamos a insertar/actualizar: intersección entre las del modelo
  //    y las existentes en MSSQL. Excluimos columnas locales de control de sync.
  const localWriteable = [
    'codigo_articulo',
    'codigo_subalmacen',
    'co_cli',
    'co_prov',
    'fecha_actividad',
    'cantidad',
    'unidad',
    'horas_trabajadas',
    'costo_unitario',
    'costo_total_calculado',
    'usuario',
    'nota',
    'fecha_create',
    'ordenId',
    'solicitudId',
    'placa',
  ];
  const writeableCols = localWriteable.filter((c) => mssqlColumns.has(c));

  if (writeableCols.length === 0) {
    report.errors.push(
      `La tabla dbo.gastos en MSSQL no contiene ninguna columna escribible conocida (${localWriteable.join(', ')}).`
    );
    report.durationMs = Date.now() - startedAt;
    logger.error(
      `[GastosService] dbo.gastos sin columnas compatibles con el modelo local; nada que sincronizar.`
    );
    return report;
  }

  // 4. Leer pendientes.
  const pending = await Gasto.findAll({
    where: { syncedToMssql: false },
    order: [['id', 'ASC']],
    limit: opts.limit ?? 500,
  });

  if (pending.length === 0) {
    report.durationMs = Date.now() - startedAt;
    return report;
  }

  logger.info(
    `[GastosService] Sync MSSQL: pendientes=${pending.length} cols_escribibles=${writeableCols.length} claves_upsert=[${mergeKeys.join(',') || 'ninguna'}]`
  );

  for (const gasto of pending) {
    report.attempted++;
    try {
      // Reintento por fila: si el INSERT falla por una caída transitoria del
      // servidor, esperamos a que vuelva y reintentamos antes de marcar error.
      await upsertWithRetry(gasto, writeableCols, mergeKeys);
      gasto.syncedToMssql = true;
      gasto.mssqlSyncedAt = new Date();
      gasto.mssqlError = null;
      await gasto.save();
      report.inserted++;
    } catch (err: any) {
      report.failed++;
      const msg = err?.message ?? String(err);
      report.errors.push(`gasto ${gasto.id}: ${msg}`);
      logger.warn(`[GastosService] gasto ${gasto.id} falló: ${msg.slice(0, 200)}`);
      gasto.mssqlError = msg.slice(0, 480);
      await gasto.save();
    }
  }

  report.durationMs = Date.now() - startedAt;
  logger.info(
    `[GastosService] Sync MSSQL: attempted=${report.attempted} inserted=${report.inserted} failed=${report.failed} (${report.durationMs}ms)`
  );
  return report;
}

/**
 * Lee las columnas reales de `dbo.gastos` desde INFORMATION_SCHEMA.COLUMNS.
 * Devuelve un Set en minúsculas para lookups case-insensitive.
 */
async function introspectMssqlGastosColumns(): Promise<Set<string>> {
  const [rows]: any = await profitSequelize.query(
    `SELECT LOWER(COLUMN_NAME) AS name
       FROM [INFORMATION_SCHEMA].[COLUMNS]
      WHERE TABLE_NAME = 'gastos'`
  );
  const out = new Set<string>();
  for (const r of rows ?? []) {
    if (r?.name) out.add(String(r.name));
  }
  return out;
}

/**
 * Hace ping a MSSQL ejecutando una query trivial. Devuelve `true` en cuanto
 * responde, `false` si se agotó el timeout total.
 */
async function pingMssql(): Promise<boolean> {
  try {
    await profitSequelize.query('SELECT 1 AS ok');
    return true;
  } catch {
    return false;
  }
}

/**
 * Espera a que MSSQL responda con reintentos. Backoff lineal corto: empezamos
 * en `initialDelayMs` y vamos subiendo hasta `maxDelayMs`. Se rinde cuando se
 * agota `totalTimeoutMs`.
 */
async function waitForMssqlReady(totalTimeoutMs: number, initialDelayMs: number): Promise<boolean> {
  const deadline = Date.now() + totalTimeoutMs;
  let delay = initialDelayMs;
  const maxDelay = 4_000;
  let attempt = 0;
  while (Date.now() < deadline) {
    attempt++;
    if (await pingMssql()) return true;
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay + 500, maxDelay);
  }
  if (attempt > 0) {
    logger.warn(`[GastosService] MSSQL no respondió tras ${attempt} intentos en ${totalTimeoutMs}ms.`);
  }
  return false;
}

/**
 * Serializa un valor a un formato aceptable por MSSQL `datetime`.
 * MSSQL acepta el formato simple `'YYYY-MM-DD HH:MM:SS[.fff]'` cuando se pasa
 * como parámetro. ODBC canónico (`{ts '...'}`) NO funciona con Sequelize mssql.
 * Sequelize mssql pasa `Date` como ISO-8601 con 'T' y 'Z', que MSSQL rechaza.
 * Esta función normaliza todos los casos al formato simple UTC.
 */
function toMssqlDateTime(v: any): string | null {
  if (v === null || v === undefined) return null;
  let d: Date | null = null;
  if (v instanceof Date) {
    d = v;
  } else if (typeof v === 'string') {
    const trimmed = v.trim();
    // Si ya viene en formato simple, devolver tal cual.
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d{1,7})?$/.test(trimmed)) {
      return trimmed;
    }
    // ISO-8601 → parsear y reformatear
    const parsed = new Date(trimmed);
    d = isNaN(parsed.getTime()) ? null : parsed;
  }
  if (!d || isNaN(d.getTime())) return null;
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  const y = d.getUTCFullYear();
  const mo = pad(d.getUTCMonth() + 1);
  const day = pad(d.getUTCDate());
  const h = pad(d.getUTCHours());
  const mi = pad(d.getUTCMinutes());
  const s = pad(d.getUTCSeconds());
  const ms = pad(d.getUTCMilliseconds(), 3);
  return `${y}-${mo}-${day} ${h}:${mi}:${s}.${ms}`;
}

/**
 * Construye y ejecuta la sentencia de upsert idempotente.
 * - Si MSSQL soporta MERGE (dialecto mssql) → usa MERGE con la clave natural.
 * - Si está en modo fallback SQLite → usa INSERT ... ON CONFLICT.
 * - Si no hay claves naturales → hace un INSERT simple (no idempotente).
 */
async function upsertGastoToMssql(
  gasto: Gasto,
  writeableCols: string[],
  mergeKeys: string[]
): Promise<void> {
  const dialect = (profitSequelize.getDialect() || '').toLowerCase();
  // Columnas que se serializan como datetime MSSQL. Cualquier otra se envía tal cual.
  const dateCols = new Set(['fecha_actividad', 'fecha_create']);
  const valuesByCol: Record<string, any> = {
    codigo_articulo: gasto.codigo_articulo ?? null,
    codigo_subalmacen: gasto.codigo_subalmacen ?? null,
    co_cli: gasto.co_cli ?? null,
    co_prov: gasto.co_prov ?? 'GEN',
    fecha_actividad: gasto.fecha_actividad ?? new Date(),
    cantidad: gasto.cantidad ?? 0,
    unidad: gasto.unidad ?? null,
    horas_trabajadas: gasto.horas_trabajadas ?? 0,
    costo_unitario: gasto.costo_unitario ?? 0,
    costo_total_calculado: gasto.costo_total_calculado ?? 0,
    usuario: gasto.usuario ?? '',
    nota: gasto.nota ?? '',
    fecha_create: gasto.fecha_create ?? new Date(),
    ordenId: gasto.ordenId ?? null,
    solicitudId: gasto.solicitudId ?? null,
    placa: gasto.placa ?? '',
  };

  const values = writeableCols.map((c) =>
    dateCols.has(c) ? toMssqlDateTime(valuesByCol[c]) : valuesByCol[c] ?? null
  );

  // ── Modo MSSQL: MERGE para idempotencia ────────────────────────────────
  if (dialect === 'mssql' && mergeKeys.length > 0) {
    const colList = writeableCols.map((c) => `[${c}]`).join(', ');
    const placeholderList = writeableCols.map(() => '?').join(', ');
    const onClause = mergeKeys.map((k) => `t.[${k}] = s.[${k}]`).join(' AND ');

    const updateAssignments = writeableCols
      .filter((c) => !mergeKeys.includes(c))
      .map((c) => `t.[${c}] = s.[${c}]`)
      .join(', ');

    // Si solo hay claves y ninguna columna actualizable, hacemos solo MATCH → noop.
    const whenMatched = updateAssignments
      ? `WHEN MATCHED THEN UPDATE SET ${updateAssignments}`
      : `WHEN MATCHED THEN DELETE`;

    const sql = `
      MERGE INTO [dbo].[gastos] WITH (HOLDLOCK) AS t
      USING (SELECT ${placeholderList}) AS s (${colList})
        ON ${onClause}
      ${whenMatched}
      WHEN NOT MATCHED THEN
        INSERT (${colList}) VALUES (${placeholderList});
    `;
    // Sequelize mssql requiere un único set de replacements por query. Pasamos los
    // valores dos veces: una para el USING source y otra para el INSERT.
    const flat = [...values, ...values];
    await profitSequelize.query(sql, { replacements: flat });
    return;
  }

  // ── Modo SQLite (fallback offline): INSERT ... ON CONFLICT ─────────────
  if (dialect === 'sqlite' && mergeKeys.length > 0) {
    const colList = writeableCols.map((c) => `"${c}"`).join(', ');
    const placeholderList = writeableCols.map(() => '?').join(', ');
    const conflictTarget = mergeKeys.map((c) => `"${c}"`).join(', ');
    const updateAssignments = writeableCols
      .filter((c) => !mergeKeys.includes(c))
      .map((c) => `"${c}" = excluded."${c}"`)
      .join(', ');

    const sql = `
      INSERT INTO gastos (${colList})
      VALUES (${placeholderList})
      ON CONFLICT(${conflictTarget}) DO ${updateAssignments ? 'UPDATE SET ' + updateAssignments : 'NOTHING'};
    `;
    await profitSequelize.query(sql, { replacements: values });
    return;
  }

  // ── Fallback final: INSERT simple (no idempotente) ─────────────────────
  const colList = writeableCols.map((c) => `[${c}]`).join(', ');
  const placeholderList = writeableCols.map(() => '?').join(', ');
  await profitSequelize.query(
    `INSERT INTO dbo.gastos (${colList}) VALUES (${placeholderList})`,
    { replacements: values }
  );
}

/**
 * Envuelve `upsertGastoToMssql` con un loop de reintentos que **espera a que
 * MSSQL vuelva** si la query falla por un error de conexión transitorio
 * (ECONNRESET, ESOCKET, ETIMEDOUT, ESERVER, LoginError). Para errores
 * definitivos (Invalid column, conversion, etc.) NO reintenta: falla rápido.
 */
async function upsertWithRetry(
  gasto: Gasto,
  writeableCols: string[],
  mergeKeys: string[],
  maxAttempts = 5
): Promise<void> {
  const transientHints = [
    'Failed to connect',
    'ECONNRESET',
    'ETIMEDOUT',
    'ESOCKET',
    'ESERVER',
    'ConnectionError',
    'ECONNREFUSED',
    'EHOSTUNREACH',
    'LoginError',
    'socket hang up',
    'getaddrinfo',
  ];
  const isTransient = (msg: string) =>
    transientHints.some((h) => msg.toLowerCase().includes(h.toLowerCase()));

  let delay = 1_000;
  let lastErr: any;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await upsertGastoToMssql(gasto, writeableCols, mergeKeys);
      if (attempt > 1) {
        logger.info(
          `[GastosService] gasto ${gasto.id} sincronizado tras ${attempt} intentos.`
        );
      }
      return;
    } catch (err: any) {
      lastErr = err;
      const msg = err?.message ?? String(err);
      if (!isTransient(msg) || attempt === maxAttempts) {
        throw err;
      }
      logger.warn(
        `[GastosService] gasto ${gasto.id} intento ${attempt} falló (transitorio): ${msg.slice(0, 160)}; reintento en ${delay}ms`
      );
      await new Promise((r) => setTimeout(r, delay));
      // Antes del próximo reintento, esperamos a que MSSQL vuelva a responder
      // para no martillarlo si está caído.
      await waitForMssqlReady(15_000, 500);
      delay = Math.min(delay * 2, 8_000);
    }
  }
  throw lastErr;
}

let gastosTableEnsured = false;
async function ensureMssqlGastosTable(): Promise<void> {
  if (gastosTableEnsured) return;
  // Sequelize mssql no soporta varios statements en la misma query, así que
  // primero verificamos existencia y luego, si hace falta, creamos.
  const [exists]: any = await profitSequelize.query(
    `SELECT TOP 1 1 AS ok FROM [INFORMATION_SCHEMA].[TABLES] WHERE TABLE_NAME = 'gastos'`
  );
  if (exists && exists.length > 0) {
    gastosTableEnsured = true;
    return;
  }
  await profitSequelize.query(
    `CREATE TABLE dbo.gastos (
      codigo_articulo        VARCHAR(30) NULL,
      codigo_subalmacen      VARCHAR(30) NULL,
      co_cli                 VARCHAR(30) NULL,
      co_prov                VARCHAR(30) NULL,
      fecha_actividad        DATETIME NOT NULL CONSTRAINT DF_gastos_fecha_actividad DEFAULT GETDATE(),
      cantidad               DECIMAL(18, 4) NULL,
      unidad                 VARCHAR(10) NULL,
      horas_trabajadas       DECIMAL(18, 2) NULL,
      costo_unitario         DECIMAL(18, 4) NULL,
      costo_total_calculado  DECIMAL(18, 4) NULL,
      usuario                VARCHAR(50) NULL,
      nota                   VARCHAR(500) NULL,
      fecha_create           DATETIME NOT NULL CONSTRAINT DF_gastos_fecha_create DEFAULT GETDATE()
    )`
  );
  gastosTableEnsured = true;
}

/**
 * Garantiza que todas las solicitudes de repuesto de órdenes aún no cerradas
 * tengan un gasto local. Útil al migrar bases de datos o tras restaurar copias.
 */
export async function backfillGastosForOpenOrders(): Promise<{ processed: number; created: number; updated: number; skipped: number }> {
  const solicitudes = await SolicitudRepuesto.findAll({
    include: [{ model: OrdenServicio, as: 'orden' }],
  });
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const s of solicitudes as any[]) {
    if (!s.orden || s.orden.estado === 'Cerrada') {
      skipped++;
      continue;
    }
    const before = await Gasto.findOne({ where: { solicitudId: s.id } });
    const gasto = await ensureLocalGastoForSolicitud(s);
    if (!gasto) {
      skipped++;
      continue;
    }
    if (before && before.id === gasto.id) updated++;
    else created++;
  }

  return { processed: solicitudes.length, created, updated, skipped };
}

export default {
  findArticuloEspejo,
  ensureLocalGastoForSolicitud,
  syncGastosToMssql,
  backfillGastosForOpenOrders,
};

void sequelize;
