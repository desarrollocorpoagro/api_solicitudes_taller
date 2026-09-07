const sqlite3 = require('../src/backend/config/sqliteBridge.cjs');
const path = require('path');
const d = new sqlite3.Database(path.resolve('./data/sanluis.sqlite'));

console.log('=== user_permissions ===');
d.all('SELECT COUNT(*) AS total FROM user_permissions', [], (e, r) => {
  if (e) return console.error(e.message);
  console.log('Total filas:', r[0].total);
  d.all('SELECT userId, module, actions, isGranted FROM user_permissions LIMIT 10', [], (e2, rs) => {
    if (rs && rs.length) console.log(JSON.stringify(rs, null, 2));
    else console.log('(vacío)');

    console.log('\n=== role_permissions por rol ===');
    d.all('SELECT role, COUNT(*) AS n FROM role_permissions GROUP BY role ORDER BY role', [], (e3, rs3) => {
      console.log(JSON.stringify(rs3, null, 2));

      console.log('\n=== users (rol y empresa) ===');
      d.all('SELECT email, role, isActive FROM users ORDER BY role, email', [], (e4, rs4) => {
        console.log(JSON.stringify(rs4, null, 2));
        d.close();
      });
    });
  });
});