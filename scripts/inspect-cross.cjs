const sqlite3 = require('../src/backend/config/sqliteBridge.cjs');
const path = require('path');

const d1 = new sqlite3.Database(path.resolve('./data/sanluis.sqlite'));
const d2 = new sqlite3.Database(path.resolve('./data/profit_ad_trans.sqlite'));

console.log('=== Placas en flota_vehiculos (top 20) ===');
d2.all("SELECT Placa, Empresa_Propietaria, activo FROM flota_vehiculos WHERE activo = 1 ORDER BY Placa LIMIT 20", [], (e, rs) => {
  if (e) console.error(e.message);
  for (const r of rs || []) console.log(` ${r.Placa} - ${r.Marca || ''} (${r.Empresa_Propietaria || 'sin empresa'})`);
  console.log('\n=== Placas en ordenes_servicio (activas) ===');
  d1.all("SELECT DISTINCT placa, COUNT(*) as n FROM ordenes_servicio WHERE estado != 'Cerrada' GROUP BY placa", [], (e2, rs2) => {
    if (e2) console.error(e2.message);
    for (const r of rs2 || []) console.log(` ${r.placa} - ${r.n} orden(es)`);
    d1.close();
    d2.close();
  });
});