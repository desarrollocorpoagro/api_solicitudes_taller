import { profitMirrorSequelize } from '../config/profitDb';

export interface FlotaLookupResult {
  placa: string;
  placa_anterior?: string | null;
  marca: string;
  modelo?: string | null;
  anio?: number | null;
  color?: string | null;
  clase?: string | null;
  tipo?: string | null;
  empresa: string;
  Empresa_Propietaria?: string | null;
  cc?: string | null;
  km: number;
  km_actual?: number | null;
  Uso?: string | null;
  Estatus_operatividad?: string | null;
  Observaciones?: string | null;
  nro_ROTC?: string | null;
  nro_RACDA?: string | null;
  empresa_seguro?: string | null;
  activo?: number | null;
  [key: string]: any;
}

const FLOTA_LOOKUP_COLUMNS = [
  'Placa',
  'placa_anterior',
  'Marca',
  'Modelo',
  'color',
  'Año',
  'clase',
  'Tipo',
  'Carga_max_kg',
  'Carga_max_lts',
  'Serial_carroceria1',
  'Serial_carroceria2',
  'Serial_Motor',
  'Uso',
  'Estatus_operatividad',
  'Observaciones',
  'cant_cauchos_vehiculo',
  'medida_caucho_vehiculo',
  'km_actual',
  'tipo_bateria1',
  'serial_bateria1',
  'fec_garantia_bateria1',
  'tipo_bateria2',
  'serial_bateria2',
  'fec_garantia_bateria2',
  'contrato_seguro',
  'empresa_seguro',
  'fec_venc_seguro',
  'fec_venc_trimestres',
  'nro_ROTC',
  'fec_venc_ROTC',
  'nro_RACDA',
  'fec_venc_RACDA',
  'nro_gps1',
  'nro_gps2',
  'nro_ejes',
  'calibracion',
  'venc_calibrac',
  'tara',
  'funcion',
  'division',
  'activo',
  'Empresa_Propietaria',
];

const FLOTA_LOOKUP_SQL = `SELECT ${FLOTA_LOOKUP_COLUMNS.join(', ')} FROM flota_vehiculos WHERE LTRIM(RTRIM(Placa)) = LTRIM(RTRIM(?)) LIMIT 1`;

/**
 * Lee una unidad vehicular desde la tabla espejo local `flota_vehiculos`,
 * que es donde MasterSyncService deposita los datos provenientes de MSSQL
 * Profit AD_TRANS.
 *
 * Devuelve un objeto con la forma esperada por los controladores de órdenes
 * (incluye `placa`, `marca`, `empresa`, `km`, `cc`, `historialOsAnterior`,
 * `historialDias`, `historialArea`, etc.) y los campos Profit adicionales.
 */
export async function findUnidadByPlaca(rawPlaca: string): Promise<FlotaLookupResult | null> {
  if (!rawPlaca) return null;
  const placa = String(rawPlaca).trim().toUpperCase();
  const [rows]: any = await profitMirrorSequelize.query(FLOTA_LOOKUP_SQL, {
    replacements: [placa],
  });
  const row = rows?.[0];
  if (!row) return null;

  return normalizeFlotaRow(row);
}

/**
 * Lista las unidades visibles para la empresa activa. Devuelve un array con
 * los mismos campos que `findUnidadByPlaca` para mantener compatibilidad
 * con los consumidores existentes (orden, flota, taller).
 */
export async function listUnidadesForTenant(companyName?: string | null): Promise<FlotaLookupResult[]> {
  const params: any[] = [];
  let where = '';
  if (companyName) {
    where = 'WHERE LOWER(LTRIM(RTRIM(Empresa_Propietaria))) = LOWER(LTRIM(RTRIM(?)))';
    params.push(companyName);
  }
  const [rows]: any = await profitMirrorSequelize.query(
    `SELECT ${FLOTA_LOOKUP_COLUMNS.join(', ')} FROM flota_vehiculos ${where} ORDER BY Placa ASC`,
    { replacements: params }
  );
  return (rows || []).map((r: any) => normalizeFlotaRow(r));
}

function normalizeFlotaRow(row: any): FlotaLookupResult {
  const placa = (row.Placa ?? row.placa ?? '').toString().trim();
  return {
    placa,
    placa_anterior: row.placa_anterior ?? null,
    marca: row.Marca || 'Sin datos',
    modelo: row.Modelo ?? null,
    anio: row.Año ?? null,
    color: row.color ?? null,
    clase: row.clase ?? null,
    tipo: row.Tipo ?? null,
    empresa: row.Empresa_Propietaria || 'Sin empresa',
    Empresa_Propietaria: row.Empresa_Propietaria ?? null,
    cc: row.cc ?? null,
    km: Number(row.km_actual ?? row.km ?? 0),
    km_actual: row.km_actual ?? null,
    Uso: row.Uso ?? null,
    Estatus_operatividad: row.Estatus_operatividad ?? null,
    Observaciones: row.Observaciones ?? null,
    nro_ROTC: row.nro_ROTC ?? null,
    nro_RACDA: row.nro_RACDA ?? null,
    empresa_seguro: row.empresa_seguro ?? null,
    activo: row.activo ?? 1,
    historialOsAnterior: null,
    historialDias: null,
    historialArea: null,
    ...row,
  };
}

export default { findUnidadByPlaca, listUnidadesForTenant };
