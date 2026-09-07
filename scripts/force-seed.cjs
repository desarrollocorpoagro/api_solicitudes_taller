// Seed directo con sqliteBridge (usando exec).
const sqlite3 = require('../src/backend/config/sqliteBridge.cjs');
const crypto = require('crypto');
const path = require('path');

const dbPath = path.resolve('./data/sanluis.sqlite');
const d = new sqlite3.Database(dbPath);

const DEFAULT_ROLE_PERMS = [
  { role: 'ADMIN', module: 'taller', actions: ['read', 'create', 'update', 'delete', 'approve', 'admin'] },
  { role: 'ADMIN', module: 'fleet', actions: ['read', 'create', 'update', 'delete', 'admin'] },
  { role: 'ADMIN', module: 'almacen', actions: ['read', 'create', 'update', 'delete', 'dispatch', 'admin'] },
  { role: 'ADMIN', module: 'aprobaciones', actions: ['read', 'approve', 'reject', 'admin'] },
  { role: 'ADMIN', module: 'users', actions: ['read', 'create', 'update', 'delete', 'admin'] },
  { role: 'ADMIN', module: 'permissions', actions: ['read', 'update', 'admin'] },
  { role: 'ADMIN', module: 'db_connections', actions: ['read', 'create', 'update', 'delete', 'test', 'admin'] },
  { role: 'ADMIN', module: 'query_runner', actions: ['read', 'execute_query', 'admin'] },
  { role: 'ADMIN', module: 'reports', actions: ['read', 'export', 'admin'] },
  { role: 'GERENTE_TALLER', module: 'taller', actions: ['read', 'create', 'update', 'delete', 'approve'] },
  { role: 'GERENTE_TALLER', module: 'fleet', actions: ['read', 'create', 'update'] },
  { role: 'GERENTE_TALLER', module: 'almacen', actions: ['read', 'create'] },
  { role: 'GERENTE_TALLER', module: 'aprobaciones', actions: ['read', 'approve', 'reject'] },
  { role: 'GERENTE_TALLER', module: 'reports', actions: ['read', 'export'] },
  { role: 'SUPERVISOR', module: 'taller', actions: ['read', 'create', 'update', 'approve'] },
  { role: 'SUPERVISOR', module: 'fleet', actions: ['read', 'update'] },
  { role: 'SUPERVISOR', module: 'almacen', actions: ['read', 'create'] },
  { role: 'SUPERVISOR', module: 'aprobaciones', actions: ['read', 'approve'] },
  { role: 'RESPONSABLE_FLOTA', module: 'fleet', actions: ['read', 'create', 'update'] },
  { role: 'RESPONSABLE_FLOTA', module: 'taller', actions: ['read', 'create'] },
  { role: 'RESPONSABLE_FLOTA', module: 'reports', actions: ['read'] },
  { role: 'MECANICO', module: 'taller', actions: ['read', 'update'] },
  { role: 'MECANICO', module: 'almacen', actions: ['read', 'create'] },
  { role: 'MECANICO', module: 'fleet', actions: ['read'] },
  { role: 'ALMACENISTA', module: 'almacen', actions: ['read', 'create', 'update', 'dispatch'] },
  { role: 'ALMACENISTA', module: 'taller', actions: ['read'] },
  { role: 'ALMACENISTA', module: 'reports', actions: ['read'] },
  { role: 'SOLICITANTE', module: 'taller', actions: ['read', 'create'] },
  { role: 'SOLICITANTE', module: 'fleet', actions: ['read'] },
  { role: 'AUDITOR', module: 'taller', actions: ['read'] },
  { role: 'AUDITOR', module: 'fleet', actions: ['read'] },
  { role: 'AUDITOR', module: 'almacen', actions: ['read'] },
  { role: 'AUDITOR', module: 'aprobaciones', actions: ['read'] },
  { role: 'AUDITOR', module: 'reports', actions: ['read', 'export'] },
  { role: 'OPERADOR', module: 'taller', actions: ['read'] },
  { role: 'OPERADOR', module: 'fleet', actions: ['read'] },
];

const now = new Date().toISOString();
const lines = [];
lines.push('DELETE FROM role_permissions;');
lines.push('DELETE FROM user_permissions;');
for (const p of DEFAULT_ROLE_PERMS) {
  const id = crypto.randomUUID();
  lines.push(
    `INSERT INTO role_permissions (id, role, module, actions, description, createdAt, updatedAt) VALUES ('${id}', '${p.role}', '${p.module}', '${JSON.stringify(p.actions)}', 'Permisos por rol ${p.role}', '${now}', '${now}');`
  );
}

d.exec(lines.join('\n'), (err) => {
  if (err) return console.error('Error poblando role_permissions:', err.message);
  console.log(`role_permissions insertadas: ${DEFAULT_ROLE_PERMS.length}`);

  d.all('SELECT id, role FROM users', [], (e2, users) => {
    if (e2) return console.error(e2.message);
    console.log(`Usuarios encontrados: ${users.length}`);
    const upLines = [];
    let count = 0;
    for (const u of users) {
      const perms = DEFAULT_ROLE_PERMS.filter(rp => rp.role === u.role);
      console.log(`  - ${u.role} (${u.id.slice(0, 8)}...) → ${perms.length} permisos`);
      for (const rp of perms) {
        const id = crypto.randomUUID();
        upLines.push(
          `INSERT INTO user_permissions (id, userId, module, actions, isGranted, notes, createdAt, updatedAt) VALUES ('${id}', '${u.id}', '${rp.module}', '${JSON.stringify(rp.actions)}', 1, 'Heredado de rol ${u.role} (semilla inicial)', '${now}', '${now}');`
        );
        count++;
      }
    }
    d.exec(upLines.join('\n'), (e3) => {
      if (e3) return console.error('Error poblando user_permissions:', e3.message);
      console.log(`user_permissions insertadas: ${count}`);
      d.close();
    });
  });
});