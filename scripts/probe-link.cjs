const sqlite3 = require('../src/backend/config/sqliteBridge.cjs');
const path = require('path');
const d = new sqlite3.Database(path.resolve('./data/sanluis.sqlite'));

// Verificar que user_permissions.userId realmente apunta a users.id
d.all(`
  SELECT u.email, u.role, up.module, up.actions, up.isGranted
    FROM user_permissions up
    JOIN users u ON u.id = up.userId
    ORDER BY u.role, up.module
`, [], (e, rs) => {
  console.log(`Total filas vinculadas: ${rs.length}`);
  for (const r of rs) {
    console.log(` ${r.email} (${r.role}) → ${r.module}: ${r.actions}`);
  }
  d.close();
});