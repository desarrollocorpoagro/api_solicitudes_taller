// Verifica exactamente qué columnas ve el código de gastos.service.ts
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
      dialectOptions: { encrypt: false, trustServerCertificate: true, connectTimeout: 5000 },
    }
  );

  try {
    // Reproduce la query exacta del servicio
    const [rows] = await sequelize.query(
      `SELECT LOWER(COLUMN_NAME) AS name
         FROM [INFORMATION_SCHEMA].[COLUMNS]
        WHERE TABLE_NAME = 'gastos'`
    );
    console.log(`Columnas detectadas por la introspección: ${rows.length}`);
    console.log('Set:', rows.map(r => r.name).join(', '));
    console.log(`¿co_prov presente?: ${rows.some(r => r.name === 'co_prov')}`);
    console.log(`¿codigo_articulo presente?: ${rows.some(r => r.name === 'codigo_articulo')}`);

    // Misma query pero con schema explícito
    const [rows2] = await sequelize.query(
      `SELECT LOWER(COLUMN_NAME) AS name
         FROM [INFORMATION_SCHEMA].[COLUMNS]
        WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'gastos'`
    );
    console.log(`\nCon TABLE_SCHEMA=dbo: ${rows2.length}`);
    console.log('Set:', rows2.map(r => r.name).join(', '));
  } catch (e) {
    console.error('Fallo:', e.message);
  } finally {
    await sequelize.close();
  }
})();