// scripts/probe-mssql.cjs
// Prueba credenciales MSSQL comunes contra el servidor Profit AD_TRANS.
const { Sequelize } = require('sequelize');

const HOST = 'SRVBDPROFITBK';
const PORT = 1433;
const DB = 'AD_TRANS';
const USER = 'solicitudweb';
const CANDIDATES = [
  'solicitudweb', 'solicitudweb123', '123', 'Inicio123', 'Inicio123!',
  'solicitudweb', 'solicitudweb1', 'solicitud', 'web',
  'profit', 'profit123', 'Profit123', 'admin', 'admin123',
  'sanluis', 'sanluis2026', 'password', 'Password123', 'Password123!',
];

const COMMON_OPTS = {
  dialect: 'mssql',
  host: HOST,
  port: PORT,
  database: DB,
  username: USER,
  dialectOptions: {
    options: {
      encrypt: false,
      trustServerCertificate: true,
      connectTimeout: 4000,
      requestTimeout: 5000,
    },
  },
  logging: false,
  pool: { max: 1, min: 0, acquire: 5000, idle: 1000 },
};

(async () => {
  console.log(`Probando ${CANDIDATES.length} contraseñas contra ${HOST}\\${DB} como ${USER}...\n`);

  for (const pwd of CANDIDATES) {
    const seq = new Sequelize({ ...COMMON_OPTS, password: pwd });
    const t0 = Date.now();
    try {
      await seq.authenticate();
      const ms = Date.now() - t0;
      console.log(`\n✅ CONTRASEÑA ENCONTRADA: "${pwd}" (${ms} ms)`);
      await seq.close();
      process.exit(0);
    } catch (e) {
      const ms = Date.now() - t0;
      const code = e.original?.code || e.parent?.code || '?';
      console.log(`   ❌ "${pwd.padEnd(18)}" → ${code} (${ms} ms)`);
      await seq.close().catch(() => {});
    }
  }

  console.log('\n⚠️  Ninguna contraseña del diccionario funcionó.');
  console.log('   Posibles causas:');
  console.log('   - El servidor no resuelve SRVBDPROFITBK desde tu red actual');
  console.log('   - El usuario solicitudweb no existe en MSSQL');
  console.log('   - La contraseña real no está en la lista de candidatos');
  process.exit(1);
})().catch((e) => {
  console.error('Error fatal:', e.message);
  process.exit(1);
});