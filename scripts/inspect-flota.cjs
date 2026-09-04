const sqlite3 = require('../src/backend/config/sqliteBridge.cjs');
const path = require('path');
const d = new sqlite3.Database(path.resolve('./data/profit_ad_trans.sqlite'));
console.log('=== flota_vehiculos ===');
d.all("SELECT Placa, Marca, Empresa_Propietaria, activo FROM flota_vehiculos WHERE Placa LIKE '%A12BC3D%' OR Placa LIKE '%A99ZZ11%' OR Placa LIKE '%B77XY9Z%'", [], (e, rs) => {
  if (e) { console.error(e.message); process.exit(1); }
  console.log(JSON.stringify(rs, null, 2));
  d.close();
});