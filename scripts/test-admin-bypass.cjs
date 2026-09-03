// scripts/test-admin-bypass.cjs
// Test E2E del bypass de tenant para ADMIN
const http = require('http');

const PORT = 4000;

function request(method, path, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'localhost',
      port: PORT,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    };
    const req = http.request(opts, (res) => {
      let chunks = '';
      res.on('data', (c) => (chunks += c));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(chunks) });
        } catch {
          resolve({ status: res.statusCode, body: chunks });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

(async () => {
  console.log('=== Test E2E: Bypass tenant para ADMIN ===\n');

  // 1. Login
  const login = await request('POST', '/api/v1/auth/login', {}, {
    email: 'admin@empresasanluis.com',
    password: 'Password123!',
  });
  if (login.status !== 200) {
    console.error('❌ Login falló:', login);
    process.exit(1);
  }
  const preAuthToken = login.body.preAuthToken;
  console.log('✅ Login OK (Paso 1)');
  console.log(`   user.role: ${login.body.user.role}`);

  // 2. Switch a Agro Llanos (empresa 22...)
  const select = await request(
    'POST',
    '/api/v1/auth/select-company',
    { Authorization: `Bearer ${preAuthToken}` },
    { companyId: '22222222-2222-2222-2222-222222222222' }
  );
  if (select.status !== 200) {
    console.error('❌ select-company falló:', select);
    process.exit(1);
  }
  const token = select.body.token;
  console.log('✅ Switch a Agro Llanos OK (Paso 2)');
  console.log(`   activeCompany.role: ${select.body.activeCompany.role}`);

  // Decodificar JWT
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
  console.log(`   JWT.role: ${payload.role}`);
  console.log(`   JWT.companyId: ${payload.companyId}\n`);

  // 3. GET orden OS-2026-00101 (que pertenece a otra empresa)
  const orden = await request(
    'GET',
    '/api/v1/ordenes/OS-2026-00101',
    {
      Authorization: `Bearer ${token}`,
      'x-tenant-id': '22222222-2222-2222-2222-222222222222',
    }
  );

  if (orden.status === 200) {
    console.log('✅ Bypass OK — Orden cargada correctamente');
    console.log(`   id (nro_orden): ${orden.body.data?.id}`);
    console.log(`   placa: ${orden.body.data?.placa}`);
    console.log(`   empresaImputada: ${orden.body.liquidacion?.empresaImputada}`);
    console.log(`   estado: ${orden.body.data?.estado}`);
    console.log(`   totalGeneral: $${orden.body.liquidacion?.totalGeneral?.toFixed(2)}`);
  } else {
    console.log(`❌ Bypass FALLÓ — HTTP ${orden.status}`);
    console.log(`   error: ${orden.body.error || orden.body}`);
    if (orden.body.code === 'TENANT_ISOLATION_VIOLATION') {
      console.log('\n⚠️  El bypass NO se está aplicando. Verifica que el backend se haya reiniciado tras el cambio.');
    }
  }
})().catch((e) => {
  console.error('Error inesperado:', e);
  process.exit(1);
});