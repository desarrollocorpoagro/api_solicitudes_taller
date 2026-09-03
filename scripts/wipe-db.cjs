// scripts/wipe-db.cjs
// Limpia TODAS las filas de la base de datos SQLite principal, conservando
// el esquema. Útil cuando no se puede borrar el archivo porque otro proceso
// (VS Code, editor) tiene un handle abierto.
//
// Uso:
//   1) Asegúrate de que el backend NO esté corriendo en :4000.
//   2) node scripts/wipe-db.cjs
//   3) Arranca el backend; el seed recreará los datos demo.

const path = require('path');
const { execSync } = require('child_process');

const DB_FILE = path.resolve(process.cwd(), './data/sanluis.sqlite');

if (!require('fs').existsSync(DB_FILE)) {
  console.error(`No existe ${DB_FILE}. Nada que limpiar.`);
  process.exit(1);
}

const TABLES = [
  'orden_audit_logs',
  'multimedia',
  'solicitud_externos',
  'solicitud_repuestos',
  'orden_areas',
  'ordenes_servicio',
  'flota_vehicular',
  'catalogo_repuestos',
  'role_permissions',
  'user_permissions',
  'user_companies',
  'sync_queue',
  'database_connections',
  'companies',
  'users',
  'notificaciones',
];

console.log('=== Wipe lógico de la base de datos ===');
console.log('Archivo:', DB_FILE);
console.log();

try {
  for (const t of TABLES) {
    try {
      execSync(`sqlite3 "${DB_FILE}" "DELETE FROM ${t};"`, { stdio: 'ignore' });
      console.log(`✓ ${t}`);
    } catch (e) {
      console.log(`· ${t} (no existe o sqlite3 no instalado)`);
    }
  }

  // Resetear autoincrement
  try {
    execSync(`sqlite3 "${DB_FILE}" "DELETE FROM sqlite_sequence;"`, { stdio: 'ignore' });
    console.log('✓ sqlite_sequence (autoincrement)');
  } catch {}

  console.log('\n✅ Tablas vaciadas. Arranca `npm run dev` para regenerar el seed.');
} catch (e) {
  console.error('\n❌ Error:', e.message);
  process.exit(1);
}