const sqlite3 = require('../src/backend/config/sqliteBridge.cjs');
const path = require('path');
const d = new sqlite3.Database(path.resolve('./data/sanluis.sqlite'));

// Verificar columnas de la tabla
d.all("PRAGMA table_info(gastos)", [], (e, cols) => {
  if (e) { console.error(e.message); process.exit(1); }
  console.log('=== Columnas actuales de la tabla gastos ===');
  for (const c of cols) console.log(`  ${c.name} (${c.type})${c.dflt_value ? ' DEFAULT ' + c.dflt_value : ''}`);
  console.log('\n=== Gastos con su placa ===');
  d.all('SELECT id, ordenId, codigo_articulo, placa FROM gastos ORDER BY id', [], (e2, rs) => {
    if (e2) console.error(e2.message);
    console.log(JSON.stringify(rs, null, 2));
    d.close();
  });
});