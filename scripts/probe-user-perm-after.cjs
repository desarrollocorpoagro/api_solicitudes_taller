const sqlite3 = require('../src/backend/config/sqliteBridge.cjs');
const path = require('path');
const d = new sqlite3.Database(path.resolve('./data/sanluis.sqlite'));

console.log('=== user_permissions (post-seed) ===');
d.all('SELECT COUNT(*) AS total FROM user_permissions', [], (e, r) => {
  console.log('Total filas:', r[0].total);

  d.all('SELECT u.email, u.role, COUNT(up.id) AS n FROM users u LEFT JOIN user_permissions up ON up.userId = u.id GROUP BY u.id ORDER BY u.role', [], (e2, rs) => {
    console.log('Por usuario:');
    console.table(rs);

    console.log('\nMuestra de filas:');
    d.all('SELECT u.email, up.module, up.actions, up.isGranted, up.notes FROM user_permissions up JOIN users u ON u.id = up.userId ORDER BY u.role, up.module LIMIT 15', [], (e3, rs3) => {
      for (const r of rs3) console.log(` - [${r.email} / ${r.module}] ${JSON.stringify(r.actions)} isGranted=${r.isGranted} | ${r.notes}`);
      d.close();
    });
  });
});