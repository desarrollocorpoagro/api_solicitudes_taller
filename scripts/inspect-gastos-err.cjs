// Inspección rápida de los gastos pendientes y su mssqlError
const sqlite3 = require('../src/backend/config/sqliteBridge.cjs');
const path = require('path');
const dbPath = path.resolve(process.cwd(), './data/sanluis.sqlite');
const db = new sqlite3.Database(dbPath);

db.all(
  `SELECT id, ordenId, solicitudId, codigo_articulo, co_cli, co_prov,
          fecha_actividad, cantidad, unidad, horas_trabajadas,
          costo_unitario, costo_total_calculado, usuario, nota,
          fecha_create, syncedToMssql, mssqlSyncedAt, mssqlError
     FROM gastos
    WHERE syncedToMssql = 0
    ORDER BY id ASC
    LIMIT 10`,
  [],
  (err, rows) => {
    if (err) {
      console.error('SQL error:', err.message);
      process.exit(1);
    }
    console.log(`Pendientes: ${rows.length}`);
    for (const r of rows) {
      console.log('---');
      console.log(JSON.stringify(r, null, 2));
    }
    db.close();
  }
);