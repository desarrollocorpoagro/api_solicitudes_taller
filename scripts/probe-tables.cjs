// filepath: scripts/probe-tables.cjs
require('dotenv').config();
const { Sequelize } = require('sequelize');

const seq = new Sequelize(
  process.env.PROFIT_DB_NAME,
  process.env.PROFIT_DB_USER,
  process.env.PROFIT_DB_PASSWORD,
  {
    host: process.env.PROFIT_DB_HOST,
    port: parseInt(process.env.PROFIT_DB_PORT || '1433', 10),
    dialect: 'mssql',
    logging: false,
    dialectOptions: { options: { encrypt: false, trustServerCertificate: true } }
  }
);

(async () => {
  try {
    await seq.authenticate();
    console.log('OK Conexion exitosa');
    const [dbs] = await seq.query("SELECT name FROM sys.databases ORDER BY name");
    console.log('\n=== BASES DE DATOS ===');
    dbs.forEach(d => console.log(' -', d.name));

    const [tables] = await seq.query("SELECT TABLE_SCHEMA, TABLE_NAME FROM INFORMATION_SCHEMA.TABLES ORDER BY TABLE_SCHEMA, TABLE_NAME");
    console.log('\n=== TABLAS ===');
    tables.forEach(t => console.log(' -', t.TABLE_SCHEMA + '.' + t.TABLE_NAME));

    const [perms] = await seq.query("SELECT * FROM fn_my_permissions(NULL, 'DATABASE') ORDER BY permission_name");
    console.log('\n=== PERMISOS DEL USUARIO ===');
    perms.forEach(p => console.log(' -', p.permission_name));
  } catch (err) {
    console.log('ERROR:', err.message);
  } finally {
    await seq.close();
  }
})();
