const sqlite3 = require('../src/backend/config/sqliteBridge.cjs');
const path = require('path');
const d = new sqlite3.Database(path.resolve('./data/profit_ad_trans.sqlite'));

// Reproduce FLOTA_LOOKUP_SQL
const cols = ['Placa','Marca','Tipo','Empresa_Propietaria','km_actual','activo'];
const sql = `SELECT ${cols.join(', ')} FROM flota_vehiculos WHERE LTRIM(RTRIM(Placa)) = LTRIM(RTRIM(?)) LIMIT 1`;

const placas = ['A12BC3D', 'A99ZZ11', 'B77XY9Z'];
let pending = placas.length;
for (const p of placas) {
  d.all(sql, [p], (e, rs) => {
    console.log(`Placa "${p}":`, rs && rs.length ? rs[0] : 'NO ENCONTRADA');
    if (--pending === 0) d.close();
  });
}