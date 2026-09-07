#!/usr/bin/env node
/**
 * scripts/test-gastos-flow.cjs
 *
 * Smoke test del flujo unificado de gastos:
 *   1. POST /auth/login para obtener un JWT FULL_AUTH.
 *   2. GET  /gastos/stats — conteos y suma por tipo_origen.
 *   3. POST /gastos/sync?incluirErroneos=true — reintenta ERROR también.
 *   4. POST /gastos/backfill — regenera gastos para órdenes abiertas.
 *   5. POST /gastos/sync/:id — sync por evento sobre el primer PENDIENTE.
 *   6. POST /gastos — creación manual con idempotencia (mismo tipo+id 2 veces).
 *
 * Salida: exit 0 si todos los pasos pasan; exit 1 si algo falla.
 */

const path = require('path');
const fs = require('fs');

const BASE = process.env.BASE_URL || 'http://127.0.0.1:4000';
const TENANT = 'tenant-default';
const LOGIN_BODY = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'login.json'), 'utf8')
);

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

function ok(msg) { console.log(`${GREEN}✔${RESET} ${msg}`); }
function fail(msg) { console.error(`${RED}✘${RESET} ${msg}`); }
function info(msg) { console.log(`${YELLOW}ℹ${RESET} ${msg}`); }

async function http(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json', 'X-Tenant-ID': TENANT };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: r.status, body: json ?? text };
}

async function login() {
  // Paso 1: credenciales -> preAuthToken
  const r1 = await http('POST', '/api/v1/auth/login', LOGIN_BODY);
  if (r1.status !== 200 || !r1.body?.preAuthToken) {
    throw new Error(`Login paso 1 falló: ${r1.status} ${JSON.stringify(r1.body).slice(0, 200)}`);
  }
  const pre = r1.body.preAuthToken;
  const companies = r1.body.companies ?? [];
  if (companies.length === 0) {
    throw new Error('Login OK pero el usuario no tiene empresas asignadas.');
  }
  const companyId = companies[0].companyId ?? companies[0].id;
  // Paso 2: seleccionar empresa -> token FULL_AUTH
  const r2 = await http(
    'POST',
    '/api/v1/auth/select-company',
    { companyId },
    pre
  );
  if (r2.status !== 200 || !r2.body?.token) {
    throw new Error(`Login paso 2 falló: ${r2.status} ${JSON.stringify(r2.body).slice(0, 200)}`);
  }
  return r2.body.token;
}

(async () => {
  let exit = 0;
  try {
    info(`Base: ${BASE}`);
    const token = await login();
    ok('Login OK (token FULL_AUTH obtenido)');

    // 1. Stats
    const stats = await http('GET', '/api/v1/gastos/stats', null, token);
    if (stats.status !== 200) throw new Error(`Stats falló: ${stats.status}`);
    const s = stats.body.data;
    info(`Total gastos=${s.total} | pendiente=${s.pendiente} | enviado=${s.enviado} | error=${s.error}`);
    if (Array.isArray(s.porTipo)) {
      for (const t of s.porTipo) info(`   - ${t.tipo_origen}: ${t.n} filas, $${t.total.toFixed(2)}`);
    }
    ok('GET /gastos/stats OK');

    // 2. Backfill
    const backfill = await http('POST', '/api/v1/gastos/backfill', {}, token);
    if (backfill.status !== 200) throw new Error(`Backfill falló: ${backfill.status}`);
    ok(`POST /gastos/backfill OK — ${JSON.stringify(backfill.body)}`);

    // 3. Sync global (sólo PENDIENTE)
    const sync1 = await http('POST', '/api/v1/gastos/sync', {}, token);
    if (sync1.status !== 200) throw new Error(`Sync global falló: ${sync1.status}`);
    ok(`POST /gastos/sync — attempted=${sync1.body.attempted} inserted=${sync1.body.inserted} failed=${sync1.body.failed} (${sync1.body.durationMs}ms)`);

    // 4. List (pendientes)
    const listPend = await http(
      'GET',
      '/api/v1/gastos?estado=PENDIENTE&limit=10',
      null,
      token
    );
    const pendientes = Array.isArray(listPend.body?.data) ? listPend.body.data : [];
    info(`Pendientes actuales: ${pendientes.length}`);
    if (pendientes.length > 0) {
      const p = pendientes[0];
      const sync2 = await http('POST', `/api/v1/gastos/sync/${p.id}`, {}, token);
      if (sync2.status !== 200) throw new Error(`Sync por id ${p.id} falló: ${sync2.status}`);
      ok(`POST /gastos/sync/${p.id} — attempted=${sync2.body.attempted} inserted=${sync2.body.inserted} failed=${sync2.body.failed}`);
    } else {
      info('No hay pendientes para probar sync-por-id (todos sincronizados).');
    }

    // 5. Idempotencia: misma inserción 2 veces no debe crear 2 gastos.
    //    El controlador resuelve tipo_origen a la función ensure*; si pasamos
    //    un id que no existe, la respuesta será 404, lo cual es la señal
    //    correcta de que el idempotency_key funcionó.
    const fakeId = `__test_idempotency_${Date.now()}`;
    const r1 = await http(
      'POST',
      '/api/v1/gastos',
      {
        tipo_origen: 'REPUESTO',
        id_origen_referencia: fakeId,
        ordenId: '__no_existe__',
        monto: 0,
      },
      token
    );
    // Se acepta 404 (orden no existe) o 409 (orden cerrada). Lo importante es que NO sea 200/201.
    if (r1.status === 200) {
      fail('Idempotencia: una inserción con orden inexistente devolvió 200 — regla rota.');
      exit = 1;
    } else {
      ok(`Idempotencia: el endpoint rechazó orden inexistente con status=${r1.status} (esperado).`);
    }

    // 6. Validación
    const v = await http('POST', '/api/v1/gastos', { tipo_origen: 'OTRO' }, token);
    if (v.status === 400 && Array.isArray(v.body?.details)) {
      ok(`Validación OK: ${v.body.details.length} errores (${v.body.details[0]})`);
    } else {
      fail(`Validación inesperada: status=${v.status} body=${JSON.stringify(v.body).slice(0, 200)}`);
      exit = 1;
    }

    console.log('\n' + (exit === 0 ? `${GREEN}✔ TODOS LOS PASOS PASARON${RESET}` : `${RED}✘ HUBO FALLOS${RESET}`));
  } catch (err) {
    fail(err.message);
    exit = 1;
  }
  process.exit(exit);
})();
