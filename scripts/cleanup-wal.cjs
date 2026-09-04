// filepath: scripts/cleanup-wal.cjs
// Consolida y elimina los archivos -wal y -shm de SQLite.
// IMPORTANTE: ejecutar SOLO con el backend detenido.
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const dataDir = path.resolve(process.cwd(), './data');
const dbs = ['sanluis.sqlite', 'profit_ad_trans.sqlite'];

for (const dbName of dbs) {
  const dbPath = path.join(dataDir, dbName);
  if (!fs.existsSync(dbPath)) {
    console.log(`[skip] ${dbName} no existe`);
    continue;
  }
  try {
    const db = new DatabaseSync(dbPath);
    // Forzar checkpoint para consolidar WAL en la base principal
    const r = db.prepare('PRAGMA wal_checkpoint(TRUNCATE)').get();
    console.log(`[${dbName}] checkpoint:`, r);
    db.close();
  } catch (e) {
    console.log(`[${dbName}] error en checkpoint: ${e.message}`);
  }

  // Eliminar -shm y -wal
  for (const ext of ['-shm', '-wal']) {
    const f = dbPath + ext;
    if (fs.existsSync(f)) {
      fs.unlinkSync(f);
      console.log(`[${dbName}] eliminado ${ext}`);
    }
  }
}
console.log('Listo.');
