/**
 * gastos.service.ts
 *
 * Servicio de gastos locales con sincronización a MSSQL Profit Plus.
 *
 * Tres orígenes de captura:
 *   1. AREA       → ensureLocalGastoForArea(ordenArea)        — mano de obra
 *   2. REPUESTO   → ensureLocalGastoForRepuesto(solicitud)  — repuestos aprobados/despachados
 *   3. EXTERNO    → ensureLocalGastoForExterno(solicitud)   — servicios externos aprobados
 *
 * Cada origen setea `tipo_origen` e `id_origen_referencia`. La `idempotency_key`
 * se deriva automáticamente como `${tipo_origen}:${id_origen_referencia}`,
 * lo que permite UPSERT idempotente en MSSQL sin duplicar filas en reconexiones.
 *
 * Estados de sincronización (campo `estado_sincronizacion`):
 *   - PENDIENTE: aún no enviado a MSSQL
 *   - ENVIADO:   confirmado en MSSQL (con `mssqlSyncedAt`)
 *   - ERROR:     último intento falló (mensaje en `mssqlError`, contador en
 *                `intentos_sincronizacion`); reintento automático en el próximo ciclo.
 *
 * Reglas de validación:
 *   - Si la orden padre está `Cerrada`, no se generan gastos nuevos (mantiene auditoría).
 *   - El monto se calcula en `beforeSave` pero también se acepta fijado manualmente.
 *   - La placa del vehículo se extrae siempre de la orden padre.
 *
 * Flujo de sincronización (syncGastosToMssql):
 *   1. Espera a que MSSQL responda (ping + backoff 20s).
 *   2. Asegura que la tabla `dbo.gastos` exista.
 *   3. Descubre columnas reales (introspección) → UPSERT sólo con intersección.
 *   4. Lee filas con `estado_sincronizacion='PENDIENTE'` (o `ERROR` con reintentos).
 *   5. Por cada fila: MERGE/ON CONFLICT en MSSQL con `idempotency_key` como clave
 *      de deduplicación. Si la operación es exitosa, marca `ENVIADO` +
 *      `mssqlSyncedAt`; si falla, marca `ERROR` + `intentos_sincronizacion++`.
 *   6. Reintentos automáticos con backoff exponencial para errores transitorios.
 */

import { Op } from 'sequelize';
import {
  sequelize,
  SolicitudRepuesto,
  SolicitudExterno,
  OrdenServicio,
  OrdenArea,
} from '../models';
import {
  profitMirrorSequelize,
  profitSequelize,
  isMssqlConnectionActive,
} from '../config/profitDb';
import { Gasto, GastoOrigen } from '../models/Gasto.model';
import { logger } from '../utils/logger';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos públicos
// ─────────────────────────────────────────────────────────────────────────────

export interface SyncReport {
  attempted: number;
  inserted: number;
  updated: number;
  failed: number;
  errors: string[];
  durationMs: number;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Catálogo espejo (vw_flota_articulos)
// ─────────────────────────────────────────────────────────────────────────────

interface ArticuloEspejo {
  codigo_profit?: string | null;
  unidad_medida?: string | null;
  costo?: number | null;
  codigo_subalmacen?: string | null;
}

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

export async function resolveFlotaOrdenId(ordenId: string): Promise<number | null> {
  const [rows]: any = await profitMirrorSequelize.query(
    `SELECT id_orden FROM flota_ordenes_servicio
     WHERE UPPER(TRIM(nro_orden)) = UPPER(TRIM(?))
     LIMIT 1`,
    { replacements: [ordenId] }
  );
  const mirrorId = Number(rows?.[0]?.id_orden);
  if (Number.isInteger(mirrorId) && mirrorId > 0) return mirrorId;

  try {
    const table = profitSequelize.getDialect() === 'mssql'
      ? '[AD_TRANS].[dbo].[flota_ordenes_servicio]'
      : 'flota_ordenes_servicio';
    const [remoteRows]: any = await profitSequelize.query(
      `SELECT id_orden FROM ${table}
       WHERE UPPER(LTRIM(RTRIM(nro_orden))) = UPPER(LTRIM(RTRIM(?)))`,
      { replacements: [ordenId] }
    );
    const remoteId = Number(remoteRows?.[0]?.id_orden);
    return Number.isInteger(remoteId) && remoteId > 0 ? remoteId : null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Reglas de validación
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Valida un payload de gasto antes de persistirlo localmente.
 * Devuelve { ok: true } si pasa todas las reglas, o { ok: false, errors }
 * con la lista de mensajes legibles para el usuario.
 */
export function validateGastoDraft(draft: {
  ordenId?: string | null;
  id_origen_referencia?: string | null;
  tipo_origen?: GastoOrigen | null;
  monto?: number | null;
  fecha_actividad?: Date | null;
}): ValidationResult {
  const errors: string[] = [];
  if (!draft.ordenId || draft.ordenId.trim() === '') {
    errors.push('El campo ordenId es obligatorio.');
  }
  if (!draft.id_origen_referencia || draft.id_origen_referencia.trim() === '') {
    errors.push('El campo id_origen_referencia es obligatorio.');
  }
  if (!draft.tipo_origen || !['AREA', 'REPUESTO', 'EXTERNO'].includes(draft.tipo_origen)) {
    errors.push('El campo tipo_origen debe ser AREA, REPUESTO o EXTERNO.');
  }
  if (draft.monto !== undefined && draft.monto !== null && Number(draft.monto) < 0) {
    errors.push('El monto no puede ser negativo.');
  }
  if (draft.fecha_actividad && isNaN(new Date(draft.fecha_actividad).getTime())) {
    errors.push('La fecha_actividad no es válida.');
  }
  return { ok: errors.length === 0, errors };
}

// ─────────────────────────────────────────────────────────────────────────────
// Captura: helper de bajo nivel
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Inserta o actualiza un gasto local para la clave (tipo_origen, id_origen_referencia).
 * Usa `idempotency_key` para deduplicación dentro de la misma BD local.
 *
 * Si la orden padre está `Cerrada`, devuelve `null` sin modificar nada
 * (mantiene la auditoría histórica).
 */
async function upsertGastoLocal(params: {
  tipo_origen: GastoOrigen;
  id_origen_referencia: string;
  ordenId: string;
  codigo_articulo?: string | null;
  codigo_subalmacen?: string | null;
  co_prov?: string | null;
  co_cli?: string | null;
  cantidad?: number;
  unidad?: string | null;
  horas_trabajadas?: number;
  costo_unitario?: number;
  monto: number;
  fecha_actividad?: Date;
  placa?: string;
  usuario?: string;
  nota?: string;
}): Promise<Gasto | null> {
  // Regla de negocio: no generar gastos sobre órdenes cerradas.
  const orden = await OrdenServicio.findByPk(params.ordenId);
  if (!orden) {
    logger.warn(`[GastosService] Orden ${params.ordenId} no encontrada; gasto omitido.`);
    return null;
  }
  if (orden.estado === 'Cerrada') {
    logger.debug(`[GastosService] Orden ${params.ordenId} cerrada; gasto omitido.`);
    return null;
  }

  // Resolver placa desde la orden (siempre que esté presente).
  const placa = (params.placa ?? orden.placa ?? '').toString().trim().toUpperCase();
  if (!placa) {
    logger.warn(`[GastosService] Orden ${params.ordenId} sin placa; gasto omitido.`);
    return null;
  }

  // Buscar existente por idempotency_key (= tipo_origen:id_origen_referencia)
  const idempotencyKey = `${params.tipo_origen}:${params.id_origen_referencia}`;
  const idOrdenser = await resolveFlotaOrdenId(params.ordenId);
  const existente = await Gasto.findOne({ where: { idempotency_key: idempotencyKey } });

  if (existente) {
    existente.codigo_articulo = params.codigo_articulo ?? existente.codigo_articulo;
    existente.codigo_subalmacen = params.codigo_subalmacen?.trim() || existente.codigo_subalmacen?.trim() || '01';
    existente.co_prov = params.co_prov ?? existente.co_prov;
    existente.co_cli = params.co_cli ?? existente.co_cli;
    existente.cantidad = params.cantidad ?? existente.cantidad;
    existente.unidad = params.unidad ?? existente.unidad;
    existente.horas_trabajadas = params.horas_trabajadas ?? existente.horas_trabajadas;
    existente.costo_unitario = params.costo_unitario ?? existente.costo_unitario;
    existente.costo_total_calculado = params.monto;
    existente.monto = params.monto;
    existente.id_ordenser = idOrdenser;
    existente.fecha_actividad = params.fecha_actividad ?? new Date();
    existente.placa = placa || existente.placa || '';
    existente.usuario = params.usuario ?? existente.usuario;
    existente.nota = params.nota ?? existente.nota;
    // Si el monto cambió, hay que reintentar sync.
    existente.estado_sincronizacion = 'PENDIENTE';
    existente.syncedToMssql = false;
    existente.mssqlError = null;
    await existente.save();
    return existente;
  }

  return await Gasto.create({
    tipo_origen: params.tipo_origen,
    id_origen_referencia: params.id_origen_referencia,
    idempotency_key: idempotencyKey,
    ordenId: params.ordenId,
    codigo_articulo: params.codigo_articulo ?? null,
    codigo_subalmacen: params.codigo_subalmacen?.trim() || '01',
    co_prov: params.co_prov ?? 'GEN',
    co_cli: params.co_cli ?? null,
    cantidad: params.cantidad ?? 0,
    unidad: params.unidad ?? null,
    horas_trabajadas: params.horas_trabajadas ?? 0,
    costo_unitario: params.costo_unitario ?? 0,
    costo_total_calculado: params.monto,
    monto: params.monto,
    fecha_actividad: params.fecha_actividad ?? new Date(),
    placa,
    usuario: params.usuario ?? '',
    nota: params.nota ?? '',
    fecha_create: new Date(),
    id_ordenser: idOrdenser,
    estado_sincronizacion: 'PENDIENTE',
    syncedToMssql: false,
    intentos_sincronizacion: 0,
  } as any);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Captura desde OrdenArea (mano de obra)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Garantiza que exista un Gasto local para una OrdenArea (mano de obra).
 * El monto se calcula como `horas * tarifaHora`. Si la OrdenArea cambia
 * (horas/tarifa), se actualiza el gasto existente y se re-marcarará PENDIENTE.
 */
export async function ensureLocalGastoForArea(ordenArea: OrdenArea): Promise<Gasto | null> {
  const horas = Number(ordenArea.horas ?? 0);
  const tarifa = Number(ordenArea.tarifaHora ?? 0);
  const monto = Number((horas * tarifa).toFixed(4));

  if (horas <= 0 || monto <= 0) {
    logger.debug(`[GastosService] OrdenArea ${ordenArea.id} sin horas/tarifa válidas; gasto omitido.`);
    return null;
  }

  return upsertGastoLocal({
    tipo_origen: 'AREA',
    id_origen_referencia: ordenArea.id,
    ordenId: ordenArea.ordenId,
    cantidad: 1,
    horas_trabajadas: horas,
    costo_unitario: tarifa,
    monto,
    nota: `Mano de obra área "${ordenArea.area}" — ${ordenArea.mecanico || 's/m'}`,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Captura desde SolicitudRepuesto
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Garantiza que exista un Gasto local para una SolicitudRepuesto.
 * Se invoca:
 *   - Al crearse la solicitud (afterCreate hook).
 *   - Al aprobarse (estadoAprobacion → Aprobada): si cambia el costo, se actualiza.
 *   - Al despacharse (estadoEntrega → Entregado): se re-marcarará PENDIENTE si hubo cambios.
 */
export async function ensureLocalGastoForRepuesto(
  solicitud: SolicitudRepuesto,
  opts: { usuario?: string; nota?: string } = {}
): Promise<Gasto | null> {
  if (!solicitud.ordenId) return null;
  const orden = await OrdenServicio.findByPk(solicitud.ordenId);
  if (!orden) return null;
  if (orden.estado === 'Cerrada') return null;

  // Resolver datos espejo del artículo (codigo_subalmacen, unidad_medida, costo)
  const articulo = await findArticuloEspejo(solicitud.cod);
  if (!articulo) {
    logger.warn(
      `[GastosService] Artículo ${solicitud.cod} no encontrado en vw_flota_articulos; gasto omitido.`
    );
    return null;
  }

  const cantidad = Number(solicitud.cant ?? 0);
  const costoUnitario = Number(articulo.costo ?? solicitud.costoUnitario ?? 0);
  const monto = Number((cantidad * costoUnitario).toFixed(4));

  return upsertGastoLocal({
    tipo_origen: 'REPUESTO',
    id_origen_referencia: solicitud.id,
    ordenId: solicitud.ordenId,
    codigo_articulo: solicitud.cod,
    codigo_subalmacen: articulo.codigo_subalmacen?.trim() || '01',
    co_cli: opts.nota ?? null,
    co_prov: 'GEN',
    cantidad,
    unidad: articulo.unidad_medida ?? null,
    horas_trabajadas: 0,
    costo_unitario: costoUnitario,
    monto,
    usuario: opts.usuario,
    nota: opts.nota ?? `Repuesto ${solicitud.cod} (${solicitud.desc || ''})`,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Captura desde SolicitudExterno
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Garantiza que exista un Gasto local para una SolicitudExterno.
 * Se invoca al aprobarse (estadoAprobacion → Aprobada).
 * Para servicios con garantía el monto es 0 (no se imputa al cliente).
 */
export async function ensureLocalGastoForExterno(
  solicitud: SolicitudExterno,
  opts: { usuario?: string } = {}
): Promise<Gasto | null> {
  if (!solicitud.ordenId) return null;
  const orden = await OrdenServicio.findByPk(solicitud.ordenId);
  if (!orden) return null;
  if (orden.estado === 'Cerrada') return null;

  const monto = Number(solicitud.costoEfectivo ?? 0);
  if (monto < 0) {
    logger.warn(`[GastosService] SolicitudExterno ${solicitud.id} con costoEfectivo negativo.`);
    return null;
  }

  return upsertGastoLocal({
    tipo_origen: 'EXTERNO',
    id_origen_referencia: solicitud.id,
    ordenId: solicitud.ordenId,
    co_prov: solicitud.proveedor || 'GEN',
    cantidad: 1,
    horas_trabajadas: 0,
    costo_unitario: monto,
    monto,
    usuario: opts.usuario,
    nota: `Servicio externo: ${solicitud.descripcion || ''}${solicitud.conGarantia ? ' [GARANTÍA]' : ''}`,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Backfill: regenerar todos los gastos de órdenes abiertas
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Recorre todas las solicitudes y áreas de órdenes aún no cerradas, y
 * garantiza que tengan su Gasto local. Útil al migrar o tras restaurar
 * copias de seguridad. NO elimina gastos históricos.
 */
export async function backfillGastosForOpenOrders(): Promise<{
  processed: number;
  created: number;
  updated: number;
  skipped: number;
}> {
  let processed = 0;
  let created = 0;
  let updated = 0;
  let skipped = 0;

  // Repuestos aprobados
  const solicitudes = await SolicitudRepuesto.findAll({
    include: [{ model: OrdenServicio, as: 'orden' }],
  });
  for (const s of solicitudes as any[]) {
    if (!s.orden || s.orden.estado === 'Cerrada') {
      skipped++;
      continue;
    }
    processed++;
    const before = await Gasto.findOne({ where: { idempotency_key: `REPUESTO:${s.id}` } });
    const gasto = await ensureLocalGastoForRepuesto(s);
    if (!gasto) {
      skipped++;
      continue;
    }
    if (before && before.id === gasto.id) updated++;
    else created++;
  }

  // Servicios externos aprobados
  const externos = await SolicitudExterno.findAll({
    include: [{ model: OrdenServicio, as: 'orden' }],
  });
  for (const s of externos as any[]) {
    if (!s.orden || s.orden.estado === 'Cerrada') {
      skipped++;
      continue;
    }
    processed++;
    const before = await Gasto.findOne({ where: { idempotency_key: `EXTERNO:${s.id}` } });
    const gasto = await ensureLocalGastoForExterno(s);
    if (!gasto) {
      skipped++;
      continue;
    }
    if (before && before.id === gasto.id) updated++;
    else created++;
  }

  // Áreas con horas registradas
  const areas = await OrdenArea.findAll({
    include: [{ model: OrdenServicio, as: 'orden' }],
  });
  for (const a of areas as any[]) {
    if (!a.orden || a.orden.estado === 'Cerrada') {
      skipped++;
      continue;
    }
    processed++;
    const before = await Gasto.findOne({ where: { idempotency_key: `AREA:${a.id}` } });
    const gasto = await ensureLocalGastoForArea(a);
    if (!gasto) {
      skipped++;
      continue;
    }
    if (before && before.id === gasto.id) updated++;
    else created++;
  }

  logger.info(
    `[GastosService] Backfill: processed=${processed} created=${created} updated=${updated} skipped=${skipped}`
  );
  return { processed, created, updated, skipped };
}

export async function backfillGastoOrderIds(): Promise<number> {
  let updated = 0;
  const gastos = await Gasto.findAll({ where: { id_ordenser: null } });
  for (const gasto of gastos) {
    if (!gasto.ordenId) continue;
    const idOrdenser = await resolveFlotaOrdenId(gasto.ordenId);
    if (idOrdenser === null) continue;
    gasto.id_ordenser = idOrdenser;
    await gasto.save();
    updated++;
  }
  return updated;
}

/**
 * Compatibilidad hacia atrás: el afterCreate hook de SolicitudRepuesto
 * (definido en models/index.ts) llama a esta función.
 */
export const ensureLocalGastoForSolicitud = ensureLocalGastoForRepuesto;

// ─────────────────────────────────────────────────────────────────────────────
// Sincronización a MSSQL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Espera a que MSSQL responda. Backoff lineal corto. Devuelve true al primer
 * ping exitoso o false si se agotó el timeout.
 */
async function waitForMssqlReady(totalTimeoutMs: number, initialDelayMs: number): Promise<boolean> {
  const deadline = Date.now() + totalTimeoutMs;
  let delay = initialDelayMs;
  const maxDelay = 4_000;
  while (Date.now() < deadline) {
    try {
      await profitSequelize.query('SELECT 1 AS ok');
      return true;
    } catch {
      await new Promise((r) => setTimeout(r, delay));
      delay = Math.min(delay + 500, maxDelay);
    }
  }
  return false;
}

/** Serializa un Date a formato MSSQL `datetime` (evita el bug ISO-8601 'T'/'Z'). */
function toMssqlDateTime(v: any): string | null {
  if (v === null || v === undefined) return null;
  let d: Date | null = null;
  if (v instanceof Date) d = v;
  else if (typeof v === 'string') {
    const trimmed = v.trim();
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d{1,7})?$/.test(trimmed)) return trimmed;
    const parsed = new Date(trimmed);
    d = isNaN(parsed.getTime()) ? null : parsed;
  }
  if (!d || isNaN(d.getTime())) return null;
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ` +
    `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}.${pad(d.getUTCMilliseconds(), 3)}`;
}

let mssqlTableEnsured = false;
async function ensureMssqlGastosTable(): Promise<void> {
  if (mssqlTableEnsured) return;
  const [exists]: any = await profitSequelize.query(
    `SELECT TOP 1 1 AS ok FROM [INFORMATION_SCHEMA].[TABLES] WHERE TABLE_NAME = 'gastos'`
  );
  if (exists && exists.length > 0) {
    const [columns]: any = await profitSequelize.query(
      `SELECT LOWER(COLUMN_NAME) AS name, LOWER(DATA_TYPE) AS data_type
       FROM [INFORMATION_SCHEMA].[COLUMNS] WHERE TABLE_NAME = 'gastos'`
    );
    const idOrdenserColumn = (columns ?? []).find((column: any) => column.name === 'id_ordenser');
    if (!idOrdenserColumn) {
      await profitSequelize.query(`ALTER TABLE [dbo].[gastos] ADD [id_ordenser] BIGINT NULL`);
    } else if (idOrdenserColumn.data_type !== 'bigint') {
      await profitSequelize.query(`ALTER TABLE [dbo].[gastos] ALTER COLUMN [id_ordenser] BIGINT NULL`);
    }
    const hasIdempotencyKey = (columns ?? []).some((column: any) => column.name === 'idempotency_key');
    if (!hasIdempotencyKey) {
      await profitSequelize.query(`ALTER TABLE [dbo].[gastos] ADD [idempotency_key] VARCHAR(120) NULL`);
    }
    const hasOriginReference = (columns ?? []).some((column: any) => column.name === 'id_origen_referencia');
    if (!hasOriginReference) {
      await profitSequelize.query(`ALTER TABLE [dbo].[gastos] ADD [id_origen_referencia] VARCHAR(50) NULL`);
    }
    const hasPlaca = (columns ?? []).some((column: any) => column.name === 'placa');
    if (!hasPlaca) {
      await profitSequelize.query(`ALTER TABLE [dbo].[gastos] ADD [placa] VARCHAR(30) NULL`);
    }
    mssqlTableEnsured = true;
    return;
  }
  await profitSequelize.query(
    `CREATE TABLE dbo.gastos (
      id_ordenser           BIGINT NULL,
      idempotency_key       VARCHAR(120) NULL,
      id_origen_referencia  VARCHAR(50) NULL,
      placa                 VARCHAR(30) NULL,
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
  mssqlTableEnsured = true;
}

async function introspectMssqlColumns(): Promise<Set<string>> {
  const [rows]: any = await profitSequelize.query(
    `SELECT LOWER(COLUMN_NAME) AS name FROM [INFORMATION_SCHEMA].[COLUMNS] WHERE TABLE_NAME = 'gastos'`
  );
  const out = new Set<string>();
  for (const r of rows ?? []) {
    if (r?.name) out.add(String(r.name));
  }
  return out;
}

/**
 * Empuja los gastos locales a MSSQL usando MERGE idempotente basado en
 * `codigo_articulo` (clave natural legacy) + `ordenId`/`solicitudId`. La
 * deduplicación adicional se logra mediante `idempotency_key` local.
 */
async function upsertGastoToMssql(
  gasto: Gasto,
  writeableCols: string[],
  mergeKeys: string[]
): Promise<{ updated: boolean }> {
  const dialect = (profitSequelize.getDialect() || '').toLowerCase();
  const dateCols = new Set(['fecha_actividad', 'fecha_create']);
  const valuesByCol: Record<string, any> = {
    idempotency_key: gasto.idempotency_key ?? gasto.computeIdempotencyKey(),
    id_origen_referencia: gasto.id_origen_referencia ?? null,
    id_ordenser: gasto.id_ordenser ?? null,
    placa: gasto.placa ?? null,
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
  };
  const values = writeableCols.map((c) =>
    dateCols.has(c) ? toMssqlDateTime(valuesByCol[c]) : valuesByCol[c] ?? null
  );

  if (dialect === 'mssql' && mergeKeys.length > 0) {
    const colList = writeableCols.map((c) => `[${c}]`).join(', ');
    const placeholderList = writeableCols.map(() => '?').join(', ');
    const onClause = mergeKeys.map((k) => `t.[${k}] = s.[${k}]`).join(' AND ');
    const updateAssignments = writeableCols
      .filter((c) => !mergeKeys.includes(c))
      .map((c) => `t.[${c}] = s.[${c}]`)
      .join(', ');
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
    const flat = [...values, ...values];
    await profitSequelize.query(sql, { replacements: flat });
    return { updated: false };
  }

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
    return { updated: false };
  }

  const colList = writeableCols.map((c) => `[${c}]`).join(', ');
  const placeholderList = writeableCols.map(() => '?').join(', ');
  await profitSequelize.query(
    `INSERT INTO dbo.gastos (${colList}) VALUES (${placeholderList})`,
    { replacements: values }
  );
  return { updated: false };
}

const TRANSIENT_HINTS = [
  'Failed to connect', 'ECONNRESET', 'ETIMEDOUT', 'ESOCKET', 'ESERVER',
  'ConnectionError', 'ECONNREFUSED', 'EHOSTUNREACH', 'LoginError',
  'socket hang up', 'getaddrinfo', 'ENOTFOUND',
];
const isTransient = (msg: string) => TRANSIENT_HINTS.some((h) => msg.toLowerCase().includes(h.toLowerCase()));

/**
 * Intenta enviar un gasto a MSSQL con reintentos y backoff.
 * Devuelve la fila actualizada con su estado final.
 */
async function upsertWithRetry(
  gasto: Gasto,
  writeableCols: string[],
  mergeKeys: string[],
  maxAttempts = 5
): Promise<{ success: boolean; finalError?: string; attempts: number }> {
  let delay = 1_000;
  let lastErr: any;
  let attempts = 0;
  for (let i = 1; i <= maxAttempts; i++) {
    attempts = i;
    try {
      await upsertGastoToMssql(gasto, writeableCols, mergeKeys);
      return { success: true, attempts };
    } catch (err: any) {
      lastErr = err;
      const msg = err?.message ?? String(err);
      if (!isTransient(msg) || i === maxAttempts) {
        return { success: false, finalError: msg, attempts };
      }
      logger.warn(
        `[GastosService] gasto ${gasto.id} intento ${i} falló (transitorio): ${msg.slice(0, 160)}; reintento en ${delay}ms`
      );
      await new Promise((r) => setTimeout(r, delay));
      // Antes de reintentar, esperamos a que MSSQL vuelva a estar disponible
      await waitForMssqlReady(15_000, 500);
      delay = Math.min(delay * 2, 8_000);
    }
  }
  return { success: false, finalError: lastErr?.message, attempts };
}

/**
 * Sincroniza los gastos PENDIENTES o en ERROR a MSSQL.
 *
 * Por defecto toma filas con `estado_sincronizacion='PENDIENTE'`. Si
 * `incluirErroneos=true`, también incluye las que estén en 'ERROR'
 * (con reintentos pendientes).
 */
export async function syncGastosToMssql(opts: {
  limit?: number;
  incluirErroneos?: boolean;
  idsPermitidos?: number[];
} = {}): Promise<SyncReport> {
  const startedAt = Date.now();
  const report: SyncReport = {
    attempted: 0,
    inserted: 0,
    updated: 0,
    failed: 0,
    errors: [],
    durationMs: 0,
  };

  if (!isMssqlConnectionActive()) {
    report.errors.push('MSSQL Profit no está disponible; sincronización omitida.');
    report.durationMs = Date.now() - startedAt;
    return report;
  }

  const ready = await waitForMssqlReady(20_000, 1_000);
  if (!ready) {
    report.errors.push('MSSQL no respondió tras 20s; ciclo omitido (se reintentará).');
    report.durationMs = Date.now() - startedAt;
    logger.warn(`[GastosService] MSSQL no responde aún; omitiendo ciclo.`);
    return report;
  }

  try {
    await ensureMssqlGastosTable();
  } catch (err: any) {
    report.errors.push(`ensureMssqlGastosTable: ${err?.message ?? err}`);
    report.durationMs = Date.now() - startedAt;
    logger.error(`[GastosService] No se pudo preparar dbo.gastos en MSSQL: ${err?.message ?? err}`);
    return report;
  }

  let mssqlColumns: Set<string>;
  try {
    mssqlColumns = await introspectMssqlColumns();
  } catch (err: any) {
    report.errors.push(`introspectMssqlColumns: ${err?.message ?? err}`);
    report.durationMs = Date.now() - startedAt;
    return report;
  }

  // Columnas locales que también pueden existir en MSSQL.
  // Las columnas de control local (id, syncedToMssql, mssqlError, createdAt, updatedAt)
  // nunca se intentan enviar.
  const localWriteable = [
    'idempotency_key',
    'id_origen_referencia',
    'id_ordenser',
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
    report.errors.push('La tabla dbo.gastos en MSSQL no contiene columnas escribibles conocidas.');
    report.durationMs = Date.now() - startedAt;
    return report;
  }

  // Clave natural para MERGE/ON CONFLICT: usamos las primeras 3 columnas
  // que existan en MSSQL de entre [ordenId, solicitudId, codigo_articulo].
  // Como fallback, si no existe ninguna, no hay deduplicación.
  const mergeKeys = mssqlColumns.has('idempotency_key')
    ? ['idempotency_key']
    : ['ordenId', 'solicitudId', 'codigo_articulo'].filter((k) => mssqlColumns.has(k));

  // WHERE: filtrar por estado_sincronizacion + (opcional) idsPermitidos
  const estados: any = opts.incluirErroneos ? ['PENDIENTE', 'ERROR'] : ['PENDIENTE'];
  const where: any = { estado_sincronizacion: { [Op.in]: estados } };
  if (opts.idsPermitidos && opts.idsPermitidos.length > 0) {
    where.id = { [Op.in]: opts.idsPermitidos };
  }

  const pending = await Gasto.findAll({
    where,
    order: [['id', 'ASC']],
    limit: opts.limit ?? 200,
  });
  if (pending.length === 0) {
    report.durationMs = Date.now() - startedAt;
    return report;
  }

  logger.info(
    `[GastosService] Sync MSSQL: pendientes=${pending.length} cols=${writeableCols.length} claves=[${mergeKeys.join(',') || 'ninguna'}]`
  );

  for (const gasto of pending) {
    report.attempted++;
    try {
      const r = await upsertWithRetry(gasto, writeableCols, mergeKeys);
      if (r.success) {
        gasto.estado_sincronizacion = 'ENVIADO';
        gasto.syncedToMssql = true;
        gasto.mssqlSyncedAt = new Date();
        gasto.mssqlError = null;
        gasto.intentos_sincronizacion = (gasto.intentos_sincronizacion ?? 0) + r.attempts;
        await gasto.save();
        report.inserted++;
      } else {
        gasto.estado_sincronizacion = 'ERROR';
        gasto.syncedToMssql = false;
        gasto.mssqlError = (r.finalError ?? 'error desconocido').slice(0, 480);
        gasto.intentos_sincronizacion = (gasto.intentos_sincronizacion ?? 0) + r.attempts;
        await gasto.save();
        report.failed++;
        report.errors.push(`gasto ${gasto.id}: ${r.finalError}`);
        logger.warn(
          `[GastosService] gasto ${gasto.id} falló tras ${r.attempts} intento(s): ${r.finalError?.slice(0, 160)}`
        );
      }
    } catch (err: any) {
      // Fallo no-recuperable: marcar ERROR para que el siguiente ciclo reintente.
      const msg = err?.message ?? String(err);
      gasto.estado_sincronizacion = 'ERROR';
      gasto.syncedToMssql = false;
      gasto.mssqlError = msg.slice(0, 480);
      gasto.intentos_sincronizacion = (gasto.intentos_sincronizacion ?? 0) + 1;
      await gasto.save();
      report.failed++;
      report.errors.push(`gasto ${gasto.id}: ${msg}`);
    }
  }

  report.durationMs = Date.now() - startedAt;
  logger.info(
    `[GastosService] Sync MSSQL: attempted=${report.attempted} inserted=${report.inserted} failed=${report.failed} (${report.durationMs}ms)`
  );
  return report;
}

/**
 * Sincroniza un solo gasto (por evento). Útil para invocar desde hooks
 * que ya tienen la fila en mano. Devuelve la SyncReport de 1 elemento.
 */
export async function syncOneGastoToMssql(gastoId: number): Promise<SyncReport> {
  return syncGastosToMssql({ limit: 1, idsPermitidos: [gastoId] });
}

export default {
  findArticuloEspejo,
  validateGastoDraft,
  ensureLocalGastoForArea,
  ensureLocalGastoForRepuesto,
  ensureLocalGastoForExterno,
  ensureLocalGastoForSolicitud, // alias legacy
  backfillGastosForOpenOrders,
  backfillGastoOrderIds,
  resolveFlotaOrdenId,
  syncGastosToMssql,
  syncOneGastoToMssql,
};
