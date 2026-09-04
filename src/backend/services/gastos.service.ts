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

  if (!isMssqlConnectionActive()) {
    report.errors.push('MSSQL Profit no está disponible; sincronización omitida.');
    report.durationMs = Date.now() - startedAt;
    return report;
  }

  // Garantizar la tabla una sola vez por ciclo, no por fila.
  try {
    await ensureMssqlGastosTable();
  } catch (err: any) {
    report.errors.push(`ensureMssqlGastosTable: ${err?.message ?? err}`);
    report.durationMs = Date.now() - startedAt;
    logger.error(`[GastosService] No se pudo preparar dbo.gastos en MSSQL: ${err?.message ?? err}`);
    return report;
  }

  const pending = await Gasto.findAll({
    where: { syncedToMssql: false },
    order: [['id', 'ASC']],
    limit: opts.limit ?? 500,
  });

  for (const gasto of pending) {
    report.attempted++;
    try {
      await profitSequelize.query(
        `INSERT INTO dbo.gastos (
            codigo_articulo, codigo_subalmacen, co_cli, co_prov,
            fecha_actividad, cantidad, unidad, horas_trabajadas,
            costo_unitario, costo_total_calculado, usuario, nota, fecha_create
         ) VALUES (?, ?, ?, ?, GETDATE(), ?, ?, ?, ?, ?, ?, ?, GETDATE())`,
        {
          replacements: [
            gasto.codigo_articulo ?? null,
            gasto.codigo_subalmacen ?? null,
            gasto.co_cli ?? null,
            gasto.co_prov ?? 'GEN',
            gasto.cantidad ?? 0,
            gasto.unidad ?? null,
            gasto.horas_trabajadas ?? 0,
            gasto.costo_unitario ?? 0,
            gasto.costo_total_calculado ?? 0,
            gasto.usuario ?? '',
            gasto.nota ?? '',
          ],
        }
      );
      gasto.syncedToMssql = true;
      gasto.mssqlSyncedAt = new Date();
      gasto.mssqlError = null;
      await gasto.save();
      report.inserted++;
    } catch (err: any) {
      report.failed++;
      const msg = err?.message ?? String(err);
      report.errors.push(`gasto ${gasto.id}: ${msg}`);
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
