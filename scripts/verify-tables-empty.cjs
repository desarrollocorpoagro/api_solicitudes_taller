// Verifica que las tablas de dominio operativo estén vacías.
// Útil para confirmar que el seed no las repobló tras un reinicio del backend.
const sqlite3 = require('../src/backend/config/sqliteBridge.cjs');
const path = require('path');
const d = new sqlite3.Database(path.resolve('./data/sanluis.sqlite'));

const tablas = [
  'ordenes_area',
  'ordenes_servicio',
  'ordenes_servicio_auditoria',
  'catalogo_repuestos',
  'solicitudes_repuestos',
  'solicitudes_externos',
];

let pending = tablas.length;
let totalFilas = 0;
let alertas = 0;
for (const t of tablas) {
  d.all(`SELECT COUNT(*) AS c FROM ${t}`, [], (e, rs) => {
    const n = rs[0].c;
    totalFilas += n;
    if (n > 0) alertas++;
    console.log(`${n === 0 ? '✓' : '✗'} ${t}: ${n} filas`);
    if (--pending === 0) {
      d.close();
      console.log(`\nTotal filas en tablas de dominio: ${totalFilas}`);
      if (alertas === 0) {
        console.log('✅ Todas las tablas operativas están vacías (correcto).');
      } else {
        console.log(`⚠️  ${alertas} tabla(s) tienen datos. El seed no las repobló, pero verifica el origen.`);
      }
    }
  });
}