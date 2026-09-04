// Probe el endpoint POST /api/v1/ordenes/:id/cerrar con cada orden
const http = require('http');

const orders = ['OS-2026-00011', 'OSOFF729939', 'OS-2026-00006'];
const token = process.argv[2];
const tenantId = process.argv[3];

if (!token || !tenantId) {
  console.error('Uso: node test-cerrar.cjs <jwt-token> <tenant-uuid>');
  process.exit(1);
}

async function call(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: 'localhost',
        port: 4000,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'x-tenant-id': tenantId,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => resolve({ status: res.statusCode, body: data }));
      }
    );
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

(async () => {
  for (const id of orders) {
    console.log(`\n--- Probando cerrar ${id} ---`);
    // GET primero
    const get = await call(`/api/v1/ordenes/${id}`);
    console.log('GET status:', get.status);
    try {
      const parsed = JSON.parse(get.body);
      if (parsed.success) {
        console.log(' placa:', parsed.data?.placa);
        console.log(' estado:', parsed.data?.estado);
        console.log(' unidad:', parsed.unidad ? `${parsed.unidad.marca} (${parsed.unidad.empresa})` : 'NULL');
      } else {
        console.log(' error:', parsed.error);
      }
    } catch (e) { console.log(' raw:', get.body.slice(0, 200)); }

    // POST cerrar
    const post = await call(`/api/v1/ordenes/${id}/cerrar`, 'POST', {
      fechaEntrega: new Date().toISOString(),
      recibeConforme: 'TEST USER',
    });
    console.log('CERRAR status:', post.status);
    try {
      const parsed = JSON.parse(post.body);
      if (parsed.bloqueos) console.log(' bloqueos:', parsed.bloqueos);
      else if (parsed.error) console.log(' error:', parsed.error);
      else if (parsed.success) console.log(' success: ORDEN CERRADA');
    } catch (e) { console.log(' raw:', post.body.slice(0, 200)); }
  }
})();