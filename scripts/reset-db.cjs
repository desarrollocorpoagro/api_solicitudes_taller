// scripts/reset-db.cjs
// Reinicia la base de datos SQLite principal (./data/sanluis.sqlite) desde cero.
// Uso:  node scripts/reset-db.cjs
//
// Después de ejecutar este script, basta con arrancar el backend
// (`npm run dev`) y el seed regenerará automáticamente todas las tablas
// y datos demo.

const fs = require('fs');
const path = require('path');

const DB_FILE = path.resolve(process.cwd(), './data/sanluis.sqlite');
const SIDECAR_FILES = [
  path.resolve(process.cwd(), './data/sanluis.sqlite-shm'),
  path.resolve(process.cwd(), './data/sanluis.sqlite-wal'),
  path.resolve(process.cwd(), './data/sanluis_fallback.sqlite'),
];

console.log('=== Reset de base de datos San Luis ===\n');

if (fs.existsSync(DB_FILE)) {
  fs.unlinkSync(DB_FILE);
  console.log(`✓ Eliminado: ${path.relative(process.cwd(), DB_FILE)}`);
} else {
  console.log(`· No existe: ${path.relative(process.cwd(), DB_FILE)}`);
}

let removed = 0;
for (const f of SIDECAR_FILES) {
  if (fs.existsSync(f)) {
    fs.unlinkSync(f);
    console.log(`✓ Eliminado: ${path.relative(process.cwd(), f)}`);
    removed++;
  }
}
if (removed === 0) {
  console.log('· No hay archivos sidecar (WAL/SHM) que limpiar.');
}

console.log('\n✅ Listo. Arranca el backend con `npm run dev` para regenerar la BD.');