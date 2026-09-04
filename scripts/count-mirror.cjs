// filepath: scripts/count-mirror.cjs
// Cuenta registros en el espejo SQLite local
const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const dbPath = path.resolve(process.cwd(), './data/profit_ad_trans.sqlite');
const db = new DatabaseSync(dbPath);

const tables = ['mecanicos', 'vw_flota_vendedores', 'vw_flota_articulos', 'flota_ordenes_servicio'];

for (const t of tables) {
  try {
    const r = db.prepare(`SELECT COUNT(*) AS c FROM ${t}`).get();
    console.log(`${t}: ${r.c} registros`);
  } catch (e) {
    console.log(`${t}: ERROR ${e.message}`);
  }
}

// Mostrar 3 primeros mecánicos
try {
  const rows = db.prepare(`SELECT codigo, nombre, cargo FROM mecanicos LIMIT 3`).all();
  console.log('\n=== Primeros 3 mecánicos en espejo ===');
  rows.forEach(r => console.log(` - ${r.codigo.trim()} | ${r.nombre} | ${r.cargo}`));
} catch (e) {
  console.log('Error leyendo mecánicos:', e.message);
}

try {
  const rows = db.prepare(`SELECT co_ven, cedula, ven_des FROM vw_flota_vendedores LIMIT 3`).all();
  console.log('\n=== Primeros 3 vendedores en espejo ===');
  rows.forEach(r => console.log(` - ${r.co_ven} | ${r.cedula.trim()} | ${(r.ven_des || '').trim()}`));
} catch (e) {
  console.log('Error leyendo vendedores:', e.message);
}

db.close();
