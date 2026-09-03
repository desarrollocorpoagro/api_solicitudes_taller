// scripts/test-login-credentials.cjs
// Verifica credenciales contra la BD para diagnosticar errores 401.
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

const credentials = [
  { email: 'admin@empresasanluis.com', pass: 'Password123!' },
  { email: 'gerente.taller@empresasanluis.com', pass: 'Password123!' },
  { email: 'mecanico@empresasanluis.com', pass: 'Password123!' },
  { email: 'operador@empresasanluis.com', pass: 'Password123!' },
];

(async () => {
  for (const c of credentials) {
    const res = await request('POST', '/api/v1/auth/login', {}, {
      email: c.email,
      password: c.pass,
    });
    console.log(
      res.status === 200
        ? `✅ ${c.email.padEnd(40)} → ${res.body.user.role}`
        : `❌ ${c.email.padEnd(40)} → HTTP ${res.status}: ${res.body.error || JSON.stringify(res.body).slice(0, 80)}`
    );
  }
})().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});