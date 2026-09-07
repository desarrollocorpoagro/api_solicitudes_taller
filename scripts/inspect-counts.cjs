// Conteo actual de filas en las tablas objetivo
const sqlite3 = require('../src/backend/config/sqliteBridge.cjs');
const path = require('path');
const d = new sqlite3.Database(path.resolve('./data/sanluis.sqlite'));

const tablas = ['ordenes_area', 'ordenes_servicio', 'ordenes_servicio_auditoria', 'catalogo_repuestos'];
let pending = tablas.length;
for (const t of tablas) {
  d.all(`SELECT COUNT(*) AS c FROM ${t}`, [], (e, rs) => {
    if (e) console.error(`${t}: ERROR ${e.message}`);
    else console.log(`${t}: ${rs[0].c} filas`);
    if (--pending === 0) d.close();
  });
}