#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * scripts/ensure-ports.cjs
 * ---------------------------------------------------------------
 * Garantiza que los puertos 4000 (backend) y 4100 (frontend Vite)
 * estén LIBRES antes de arrancar la aplicación. Si están ocupados,
 * mata el proceso que los usa.
 *
 * Uso:
 *   node scripts/ensure-ports.cjs            # verifica ambos
 *   node scripts/ensure-ports.cjs 4000 4100  # puertos personalizados
 *
 * Compatible con Windows (PowerShell / netstat) y Linux/macOS (lsof / fuser).
 * ---------------------------------------------------------------
 */
const { execSync, spawn } = require('child_process');
const os = require('os');

const PORTS = process.argv.slice(2).map(Number).filter(Boolean);
const TARGET_PORTS = PORTS.length >= 2 ? PORTS.slice(0, 2) : [4000, 4100];

const isWindows = os.platform() === 'win32';

function log(level, msg) {
  const color = level === 'OK' ? '\x1b[32m' : level === 'KILL' ? '\x1b[33m' : '\x1b[36m';
  const reset = '\x1b[0m';
  console.log(`${color}[${level}]${reset} ${msg}`);
}

function run(cmd) {
  try {
    return execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });
  } catch (e) {
    return '';
  }
}

function findPidsOnPort(port) {
  if (isWindows) {
    // netstat -ano | findstr :PORT
    const out = run(`netstat -ano | findstr :${port}`);
    const pids = new Set();
    out.split(/\r?\n/).forEach((line) => {
      const m = line.match(new RegExp(`(?:TCP|UDP)\\s+\\S+\\:${port}\\s+\\S+\\s+(?:\\S+)\\s+(\\d+)`));
      if (m && m[1]) pids.add(m[1]);
    });
    return [...pids];
  } else {
    // lsof -ti tcp:PORT
    const out = run(`lsof -ti tcp:${port}`);
    return out.split(/\s+/).filter(Boolean);
  }
}

function killPid(pid) {
  if (!pid) return false;
  try {
    if (isWindows) {
      execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
    } else {
      execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
    }
    return true;
  } catch (_e) {
    return false;
  }
}

function isPortFree(port) {
  return findPidsOnPort(port).length === 0;
}

function waitForPortFree(port, timeoutMs = 4000) {
  return new Promise((resolve) => {
    const start = Date.now();
    const tick = () => {
      if (isPortFree(port)) return resolve(true);
      if (Date.now() - start > timeoutMs) return resolve(false);
      setTimeout(tick, 200);
    };
    tick();
  });
}

async function ensurePort(port) {
  const pids = findPidsOnPort(port);
  if (pids.length === 0) {
    log('OK', `Puerto ${port} está libre.`);
    return true;
  }
  log('KILL', `Puerto ${port} ocupado por PID(s): ${pids.join(', ')}. Terminando...`);
  pids.forEach(killPid);
  const freed = await waitForPortFree(port);
  if (freed) {
    log('OK', `Puerto ${port} liberado.`);
    return true;
  }
  log('ERR', `No se pudo liberar el puerto ${port}.`);
  return false;
}

async function main() {
  log('INFO', `Plataforma: ${os.platform()} | Puertos objetivo: ${TARGET_PORTS.join(', ')}`);
  let allOk = true;
  for (const port of TARGET_PORTS) {
    const ok = await ensurePort(port);
    if (!ok) allOk = false;
  }
  if (!allOk) {
    log('ERR', 'Algunos puertos no pudieron liberarse. Cierra los procesos manualmente.');
    process.exit(1);
  }
  log('OK', 'Todos los puertos están disponibles para iniciar la aplicación.');
}

main();
