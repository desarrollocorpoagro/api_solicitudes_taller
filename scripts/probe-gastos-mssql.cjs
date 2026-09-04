// Probe schema de dbo.gastos en MSSQL Profit
const { Sequelize } = require('sequelize');
require('dotenv').config();

(async () => {
  const sequelize = new Sequelize(
    process.env.PROFIT_DB_NAME || 'AD_TRANS',
    process.env.PROFIT_DB_USER || 'solicitudweb',
    process.env.PROFIT_DB_PASSWORD || 'solicitudweb',
    {
      host: process.env.PROFIT_DB_HOST || 'SRVBDPROFITBK',
      port: Number(process.env.PROFIT_DB_PORT) || 1433,
      dialect: 'mssql',
      logging: false,
      dialectOptions: {
        encrypt: false,
        trustServerCertificate: true,
        connectTimeout: 5000,
        requestTimeout: 8000,
      },
    }
  );

  try {
    await sequelize.authenticate();
    console.log('Conectado a MSSQL.');

    // 1. Listado de columnas
    const [cols] = await sequelize.query(
      `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
         FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'gastos'
        ORDER BY ORDINAL_POSITION`
    );
    console.log(`\nColumnas en dbo.gastos: ${cols.length}`);
    for (const c of cols) console.log(` - ${c.COLUMN_NAME} (${c.DATA_TYPE}, ${c.IS_NULLABLE})`);

    // 2. ¿La tabla existe?
    const [tables] = await sequelize.query(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'gastos'`
    );
    console.log(`\n¿Existe tabla 'gastos'?: ${tables.length > 0 ? 'SÍ' : 'NO'}`);

    // 3. Probar INSERT/UPDATE dummy para reproducir el error exacto
    try {
      await sequelize.query(`SELECT TOP 1 co_prov FROM dbo.gastos`);
      console.log('\nSELECT co_prov → OK');
    } catch (e) {
      console.log('\nSELECT co_prov → ERROR:', e.message);
    }
  } catch (e) {
    console.error('Fallo:', e.message);
  } finally {
    await sequelize.close();
  }
})();