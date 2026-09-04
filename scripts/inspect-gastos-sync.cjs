const sqlite3 = require('../src/backend/config/sqliteBridge.cjs');
const path = require('path');
const d = new sqlite3.Database(path.resolve('./data/sanluis.sqlite'));
d.all('SELECT id, codigo_articulo, syncedToMssql, mssqlSyncedAt, mssqlError FROM gastos', [], (e, rs) => {
  if (e) { console.error(e.message); process.exit(1); }
  console.log(JSON.stringify(rs, null, 2));
  d.close();
});