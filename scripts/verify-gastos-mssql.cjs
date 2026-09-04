// Verifica que los gastos se insertaron en MSSQL dbo.gastos
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
      dialectOptions: { encrypt: false, trustServerCertificate: true },
    }
  );

  try {
    const [rows] = await sequelize.query(
      `SELECT TOP 10 codigo_articulo, cantidad, costo_total_calculado, fecha_actividad, fecha_create
       FROM dbo.gastos
       WHERE codigo_articulo LIKE 'RVH%' OR codigo_articulo LIKE 'FIL%' OR codigo_articulo LIKE 'PAS%' OR codigo_articulo LIKE 'FRE%'
       ORDER BY fecha_create DESC`
    );
    console.log(`Filas encontradas en dbo.gastos: ${rows.length}`);
    for (const r of rows) console.log(' -', JSON.stringify(r));
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await sequelize.close();
  }
})();