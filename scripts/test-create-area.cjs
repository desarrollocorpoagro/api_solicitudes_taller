// scripts/test-create-area.cjs
// Reproduce el error 500 al crear orden de área.
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
  // 1. Login ADMIN
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

  // 2. Crear nueva orden
  const newOrder = await request(
    'POST',
    '/api/v1/ordenes',
    {
      Authorization: `Bearer ${token}`,
      'x-tenant-id': '11111111-1111-1111-1111-111111111111',
    },
    {
      placa: 'A99ZZ11',
      km: 311000,
      recibidoPor: 'Test Admin',
      sintomas: 'Prueba de creación de OT',
    }
  );
  console.log('1. Nueva orden:', newOrder.status);
  console.log('   body:', JSON.stringify(newOrder.body).slice(0, 200));
  const ordenId = newOrder.body.data?.id;

  if (!ordenId) return;

  // 3. Crear orden de área
  const newArea = await request(
    'POST',
    `/api/v1/ordenes/${ordenId}/areas`,
    {
      Authorization: `Bearer ${token}`,
      'x-tenant-id': '11111111-1111-1111-1111-111111111111',
    },
    {
      area: 'Reparaciones mayores',
      mecanico: 'José Gregorio Hernández Ramírez',
      horas: 2,
      diagnostico: 'Cambio de discos',
    }
  );
  console.log('\n2. Nueva OT:', newArea.status);
  console.log('   body:', JSON.stringify(newArea.body).slice(0, 500));
})().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});