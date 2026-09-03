// scripts/test-roles-endpoint.cjs
// Verifica que GET /roles-permissions/role/:role sea accesible para
// cualquier usuario autenticado (no solo ADMIN).
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
  const creds = [
    { email: 'gerente.taller@empresasanluis.com', role: 'GERENTE_TALLER' },
    { email: 'mecanico@empresasanluis.com', role: 'MECANICO' },
    { email: 'operador@empresasanluis.com', role: 'OPERADOR' },
  ];

  for (const c of creds) {
    const login = await request('POST', '/api/v1/auth/login', {}, {
      email: c.email,
      password: 'Password123!',
    });
    if (login.status !== 200) {
      console.log(`❌ Login ${c.email} falló: ${login.status}`);
      continue;
    }
    const preAuthToken = login.body.preAuthToken;
    const select = await request(
      'POST',
      '/api/v1/auth/select-company',
      { Authorization: `Bearer ${preAuthToken}` },
      { companyId: '22222222-2222-2222-2222-222222222222' }
    );
    if (select.status !== 200) {
      console.log(`❌ select-company ${c.email} falló: ${select.status}`);
      continue;
    }
    const token = select.body.token;

    const perms = await request(
      'GET',
      `/api/v1/roles-permissions/role/${c.role}`,
      { Authorization: `Bearer ${token}` }
    );

    if (perms.status === 200) {
      const count = Array.isArray(perms.body.data) ? perms.body.data.length : 0;
      console.log(`✅ ${c.role.padEnd(20)} → ${count} módulos con permisos`);
    } else {
      console.log(
        `❌ ${c.role.padEnd(20)} → HTTP ${perms.status}: ${perms.body.error || JSON.stringify(perms.body).slice(0, 80)}`
      );
    }
  }
})().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});