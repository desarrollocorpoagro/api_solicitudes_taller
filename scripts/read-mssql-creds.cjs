// scripts/read-mssql-creds.cjs
// Lee las credenciales MSSQL desde la BD SQLite local (database_connections).
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
  // Login como admin
  const login = await request('POST', '/api/v1/auth/login', {}, {
    email: 'admin@empresasanluis.com',
    password: 'Password123!',
  });
  const preAuthToken = login.body.preAuthToken;

  const select = await request(
    'POST',
    '/api/v1/auth/select-company',
    { Authorization: `Bearer ${preAuthToken}` },
    { companyId: '11111111-1111-1111-1111-111111111111' }
  );
  const token = select.body.token;

  // Listar database_connections
  const list = await request(
    'GET',
    '/api/v1/db-connections?page=1&limit=10',
    { Authorization: `Bearer ${token}` }
  );

  console.log('Status:', list.status);
  if (list.body.data) {
    console.log('\nConexiones registradas:');
    for (const c of list.body.data) {
      console.log('---');
      console.log('Nombre:    ', c.nombre);
      console.log('Host:      ', c.host);
      console.log('Port:      ', c.port);
      console.log('Database:  ', c.databaseName);
      console.log('Username:  ', c.username);
      console.log('Password:  ', c.password);  // Aparece en /api/v1
      console.log('Dialect:   ', c.dialect);
      console.log('IsDefault: ', c.isDefault);
      console.log('Status:    ', c.status);
    }
  } else {
    console.log('Body:', JSON.stringify(list.body, null, 2));
  }
})().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});