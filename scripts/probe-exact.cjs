// filepath: scripts/probe-exact.cjs
// Probe idéntico a como arranca el backend: dotenv + sequelize/mssql + lectura del .env
require('dotenv').config();
const { Sequelize } = require('sequelize');

const host = process.env.PROFIT_DB_HOST;
const port = parseInt(process.env.PROFIT_DB_PORT || '1433', 10);
const db = process.env.PROFIT_DB_NAME;
const user = process.env.PROFIT_DB_USER;
const pass = process.env.PROFIT_DB_PASSWORD;
const dialect = process.env.PROFIT_DB_DIALECT;

console.log('[probe] PROFIT_DB_HOST=', host);
console.log('[probe] PROFIT_DB_PORT=', port);
console.log('[probe] PROFIT_DB_NAME=', db);
console.log('[probe] PROFIT_DB_USER=', JSON.stringify(user));
console.log('[probe] PROFIT_DB_PASSWORD=', JSON.stringify(pass));
console.log('[probe] PROFIT_DB_DIALECT=', dialect);
console.log('[probe] cwd=', process.cwd());

const seq = new Sequelize(db, user, pass, {
  host, port, dialect: 'mssql',
  logging: false,
  dialectOptions: { options: { encrypt: false, trustServerCertificate: true } }
});

(async () => {
  try {
    await seq.authenticate();
    console.log('OK CONEXION EXITOSA con', user + '/' + pass);
    const [rows] = await seq.query("SELECT TOP 5 co_mecanico, mecanico FROM mecanicos");
    console.log('Mecánicos encontrados:', rows.length);
    rows.forEach(r => console.log('  -', r.co_mecanico, r.mecanico));
  } catch (err) {
    console.log('ERROR:', err.message);
    console.log('  parent:', err.parent && err.parent.message);
  } finally {
    await seq.close();
  }
})();
