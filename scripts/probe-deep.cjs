const sqlite3 = require('../src/backend/config/sqliteBridge.cjs');
const path = require('path');

// Verificar las DOS bases de datos
for (const dbName of ['sanluis.sqlite', 'profit_ad_trans.sqlite']) {
  const dbPath = path.resolve('./data', dbName);
  console.log(`\n=== ${dbName} ===`);
  const d = new sqlite3.Database(dbPath);
  d.all("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name", [], (e, tables) => {
    console.log(`Tablas (${tables.length}):`, tables.map(t => t.name).join(', '));
    d.close();
  });
}

// Verificar la BD principal
const d = new sqlite3.Database(path.resolve('./data/sanluis.sqlite'));
setTimeout(() => {
  d.all("SELECT COUNT(*) c FROM users", [], (e, rs) => console.log('\nusers count:', rs[0]?.c));
  d.all("SELECT COUNT(*) c FROM user_permissions", [], (e, rs) => console.log('user_permissions count:', rs[0]?.c));
  d.all("SELECT COUNT(*) c FROM role_permissions", [], (e, rs) => console.log('role_permissions count:', rs[0]?.c));
  d.close();
}, 200);