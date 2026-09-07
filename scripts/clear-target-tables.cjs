// Vacía las tablas de órdenes, auditoría y catálogo de repuestos.
// Idempotente: limpia sin error si ya están vacías. Borra también los datos
// espejo (solicitudes) en cascada cuando aplica.
const sqlite3 = require('../src/backend/config/sqliteBridge.cjs');
const path = require('path');
const d = new sqlite3.Database(path.resolve('./data/sanluis.sqlite'));

const tablas = [
  // primero hijas, luego padres (FKs en cascada)
  'solicitudes_externos',
  'solicitudes_repuestos',
  'ordenes_servicio_auditoria',
  'ordenes_area',
  'ordenes_servicio',
  'catalogo_repuestos',
];

(async () => {
  for (const t of tablas) {
    await new Promise((resolve) => {
      d.exec(`DELETE FROM ${t}`, (e) => {
        if (e) console.error(`✗ ${t}: ${e.message}`);
        else console.log(`✓ ${t}: vaciada`);
        resolve(null);
      });
    });
  }
  // Reiniciar los autoincrementales de SQLite (si existen)
  for (const t of tablas) {
    await new Promise((resolve) => {
      d.exec(`DELETE FROM sqlite_sequence WHERE name = '${t}'`, () => resolve(null));
    });
  }
  d.close();
  console.log('\nListo. Las tablas quedaron en blanco y se mantienen así (el seed ya no las repoblará).');
})();