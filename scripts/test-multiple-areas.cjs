// scripts/test-multiple-areas.cjs
// Verifica que se pueden crear múltiples OTs sin colisión de PK.
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
  const login = await request('POST', '/api/v1/auth/login', {}, {
    email: 'admin@empresasanluis.com',
    password: 'Password123!',
  });
  const select = await request(
    'POST',
    '/api/v1/auth/select-company',
    { Authorization: `Bearer ${login.body.preAuthToken}` },
    { companyId: '11111111-1111-1111-1111-111111111111' }
  );
  const token = select.body.token;

  const newOrder = await request(
    'POST',
    '/api/v1/ordenes',
    {
      Authorization: `Bearer ${token}`,
      'x-tenant-id': '11111111-1111-1111-1111-111111111111',
    },
    {
      placa: 'A99ZZ11',
      km: 320000,
      recibidoPor: 'Test',
      sintomas: 'Prueba múltiples OTs',
    }
  );
  const ordenId = newOrder.body.data?.id;
  console.log('Orden creada:', ordenId);

  for (let i = 1; i <= 3; i++) {
    const r = await request(
      'POST',
      `/api/v1/ordenes/${ordenId}/areas`,
      {
        Authorization: `Bearer ${token}`,
        'x-tenant-id': '11111111-1111-1111-1111-111111111111',
      },
      {
        area: i === 1 ? 'Reparaciones mayores' : i === 2 ? 'Mtto correctivo' : 'Metalmecánica',
        mecanico: 'José Gregorio Hernández Ramírez',
        horas: i,
        diagnostico: `OT número ${i}`,
      }
    );
    console.log(`OT ${i}: HTTP ${r.status} → id=${r.body.data?.id || 'N/A'}`);
    if (r.status !== 201) console.log(`  ERROR: ${r.body.error}`);
  }
})().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});