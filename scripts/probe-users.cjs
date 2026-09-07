const sqlite3 = require('../src/backend/config/sqliteBridge.cjs');
const path = require('path');
const d = new sqlite3.Database(path.resolve('./data/sanluis.sqlite'));
d.all('SELECT id, email, role FROM users ORDER BY role', [], (e, rs) => {
  for (const r of rs) console.log(r.id, '|', r.email, '|', r.role);
  d.close();
});