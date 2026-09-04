// Probe directo MERGE vs INSERT con diferentes formatos de fecha
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

  const testDate = new Date('2026-09-04T20:52:45.480Z');
  const odbcTs = `{ts '${testDate.getUTCFullYear()}-${String(testDate.getUTCMonth()+1).padStart(2,'0')}-${String(testDate.getUTCDate()).padStart(2,'0')} ${String(testDate.getUTCHours()).padStart(2,'0')}:${String(testDate.getUTCMinutes()).padStart(2,'0')}:${String(testDate.getUTCSeconds()).padStart(2,'0')}.${String(testDate.getUTCMilliseconds()).padStart(3,'0')}'}`;
  const simple = '2026-09-04 20:52:45.480';

  console.log('Test ODBC:', odbcTs);
  console.log('Test simple:', simple);

  // Borrar primero
  await sequelize.query(`DELETE FROM dbo.gastos WHERE codigo_articulo = '__TEST__'`).catch(() => {});

  // 1. INSERT con ODBC canonical
  try {
    await sequelize.query(
      `INSERT INTO dbo.gastos (codigo_articulo, fecha_actividad, cantidad, fecha_create)
       VALUES ('__TEST__', ?, 1, ?)`,
      { replacements: [odbcTs, odbcTs] }
    );
    console.log('\n✓ INSERT con ODBC canonical: OK');
  } catch (e) {
    console.log('\n✗ INSERT con ODBC canonical:', e.message);
  }

  // 2. INSERT con string simple
  try {
    await sequelize.query(`DELETE FROM dbo.gastos WHERE codigo_articulo = '__TEST__'`);
    await sequelize.query(
      `INSERT INTO dbo.gastos (codigo_articulo, fecha_actividad, cantidad, fecha_create)
       VALUES ('__TEST__', ?, 1, ?)`,
      { replacements: [simple, simple] }
    );
    console.log('✓ INSERT con simple string: OK');
  } catch (e) {
    console.log('✗ INSERT con simple string:', e.message);
  }

  // 3. INSERT con Date object (Sequelize nativo)
  try {
    await sequelize.query(`DELETE FROM dbo.gastos WHERE codigo_articulo = '__TEST__'`);
    await sequelize.query(
      `INSERT INTO dbo.gastos (codigo_articulo, fecha_actividad, cantidad, fecha_create)
       VALUES ('__TEST__', ?, 1, ?)`,
      { replacements: [testDate, testDate] }
    );
    console.log('✓ INSERT con Date object: OK');
  } catch (e) {
    console.log('✗ INSERT con Date object:', e.message);
  }

  // 4. MERGE con ODBC canonical
  try {
    await sequelize.query(`DELETE FROM dbo.gastos WHERE codigo_articulo = '__TEST__'`);
    await sequelize.query(
      `MERGE INTO [dbo].[gastos] WITH (HOLDLOCK) AS t
       USING (SELECT 'TEST_MERGE' AS codigo_articulo, ? AS fecha_actividad, 1 AS cantidad, ? AS fecha_create) AS s
         ON t.codigo_articulo = s.codigo_articulo
       WHEN NOT MATCHED THEN
         INSERT (codigo_articulo, fecha_actividad, cantidad, fecha_create) VALUES (s.codigo_articulo, s.fecha_actividad, s.cantidad, s.fecha_create);`,
      { replacements: [odbcTs, odbcTs] }
    );
    console.log('✓ MERGE con ODBC canonical: OK');
  } catch (e) {
    console.log('✗ MERGE con ODBC canonical:', e.message);
  }

  // Limpieza
  await sequelize.query(`DELETE FROM dbo.gastos WHERE codigo_articulo = '__TEST__'`).catch(() => {});

  await sequelize.close();
})();