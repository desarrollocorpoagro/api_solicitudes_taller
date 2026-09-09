import 'dotenv/config';
import { initProfitDatabase, profitSequelize, profitMirrorSequelize } from '../src/backend/config/profitDb';

const COLS = ['codigo','Placa','placa_anterior','Empresa_Propietaria','fec_adquisicion','Marca','Modelo','color','Año','clase','Tipo','Carga_max_kg','Carga_max_lts','Serial_carroceria1','Serial_carroceria2','Serial_Motor','Uso','Estatus_operatividad','Observaciones','cant_cauchos_vehiculo','medida_caucho_vehiculo','km_actual','tipo_bateria1','serial_bateria1','fec_garantia_bateria1','tipo_bateria2','serial_bateria2','fec_garantia_bateria2','contrato_seguro','empresa_seguro','fec_venc_seguro','fec_venc_trimestres','nro_ROTC','fec_venc_ROTC','nro_RACDA','fec_venc_RACDA','nro_gps1','nro_gps2','nro_ejes','calibracion','venc_calibrac','tara','funcion','division','activo'];

function norm(v: any): string {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString();
  return String(v).trim();
}

async function main() {
  await initProfitDatabase();
  const [remoteRaw] = await profitSequelize.query(
    `SELECT ${COLS.join(',')} FROM [AD_TRANS].[dbo].[flota_vehiculos] WITH (NOLOCK)`
  ) as any;
  const [localRaw] = await profitMirrorSequelize.query(`SELECT ${COLS.join(',')} FROM flota_vehiculos`) as any;
  const remote = remoteRaw || [];
  const local = localRaw || [];
  const rMap = new Map(remote.map((r: any) => [String(r.Placa).trim().toUpperCase(), r]));
  const lMap = new Map(local.map((r: any) => [String(r.Placa).trim().toUpperCase(), r]));
  const onlyRemote = [...rMap.keys()].filter((p) => !lMap.has(p));
  const onlyLocal = [...lMap.keys()].filter((p) => !rMap.has(p));
  console.log(`REMOTE=${remote.length} LOCAL=${local.length}`);
  console.log('SOLO_REMOTE=' + JSON.stringify(onlyRemote));
  console.log('SOLO_LOCAL=' + JSON.stringify(onlyLocal));
  let diffs = 0;
  for (const p of rMap.keys()) {
    if (!lMap.has(p)) continue;
    const rd = rMap.get(p); const ld = lMap.get(p);
    const diffCols: string[] = [];
    for (const c of COLS) {
      if (norm(rd[c]) !== norm(ld[c])) diffCols.push(`${c}:${norm(rd[c]) || '∅'}≠${norm(ld[c]) || '∅'}`);
    }
    if (diffCols.length) { diffs++; if (diffs <= 10) console.log(`DIFF ${p}: ${diffCols.join(' | ')}`); }
  }
  console.log(`FILAS_CON_DIFFS=${diffs}`);
  await profitSequelize.close();
}

main().catch((e) => { console.error('FATAL ' + e.message); process.exit(1); });