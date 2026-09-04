const { DatabaseSync } = require('node:sqlite');
const EventEmitter = require('events');

function sanitizeValue(val) {
  if (val === undefined || val === null) return null;
  if (typeof val === 'boolean') return val ? 1 : 0;
  if (val instanceof Date) return val.toISOString();
  if (typeof val === 'bigint') return Number(val);
  if (typeof val === 'object' && !(val instanceof Uint8Array || Buffer.isBuffer(val))) {
    return JSON.stringify(val);
  }
  return val;
}

function normalizeParams(sql, params) {
  if (!params) return { sql, params: [] };

  if (Array.isArray(params)) {
    let normalizedSql = sql.replace(/\$(\d+)/g, '?');
    const sanitized = params.map(sanitizeValue);
    return { sql: normalizedSql, params: sanitized };
  } else if (typeof params === 'object') {
    const sanitized = {};
    for (const [k, v] of Object.entries(params)) {
      sanitized[k] = sanitizeValue(v);
    }
    return { sql, params: sanitized };
  }
  return { sql, params: [sanitizeValue(params)] };
}

class Database extends EventEmitter {
  constructor(filename, mode, callback) {
    super();
    if (typeof mode === 'function') {
      callback = mode;
      mode = null;
    }
    this.writeCount = 0;
    this.checkpointEvery = 50; // PRAGMA wal_checkpoint(TRUNCATE) cada N escrituras
    try {
      this.db = new DatabaseSync(filename === ':memory:' ? ':memory:' : (filename || ':memory:'));
      // PRAGMAs defensivos: evitan SQLITE_BUSY cuando múltiples procesos/secuencias
      // tocan el mismo archivo SQLite simultáneamente.
      try { this.db.exec('PRAGMA busy_timeout = 10000'); } catch (_e) {}
      try { this.db.exec('PRAGMA journal_mode = WAL'); } catch (_e) {}
      try { this.db.exec('PRAGMA synchronous = NORMAL'); } catch (_e) {}
      try { this.db.exec('PRAGMA wal_autocheckpoint = 1000'); } catch (_e) {} // default, respaldo
      process.nextTick(() => {
        if (callback) callback(null);
        this.emit('open');
      });
    } catch (err) {
      process.nextTick(() => {
        if (callback) callback(err);
        this.emit('error', err);
      });
    }
  }

  /**
   * Ejecuta un checkpoint TRUNCATE periódico para mantener el .wal pequeño.
   * Sin truncar, el .wal puede crecer hasta 4MB antes del auto-checkpoint.
   */
  maybeAutoCheckpoint() {
    this.writeCount++;
    if (this.writeCount >= this.checkpointEvery) {
      this.writeCount = 0;
      try {
        // TRUNCATE: consolida .wal en .sqlite y vacía el .wal
        this.db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
      } catch (_e) { /* ignorar errores de checkpoint */ }
    }
  }

  close(callback) {
    try {
      if (this.db) {
        this.db.close();
      }
      if (callback) callback(null);
      this.emit('close');
    } catch (err) {
      if (callback) callback(err);
    }
  }

  run(sql, params, callback) {
    if (typeof params === 'function') {
      callback = params;
      params = [];
    }
    try {
      const normalized = normalizeParams(sql, params);
      const stmt = this.db.prepare(normalized.sql);
      const result = Array.isArray(normalized.params)
        ? stmt.run(...normalized.params)
        : stmt.run(normalized.params);

      // Auto-checkpoint cada N escrituras para mantener el .wal pequeño
      this.maybeAutoCheckpoint();

      const ctx = {
        lastID: result.lastInsertRowid !== undefined ? Number(result.lastInsertRowid) : 0,
        changes: result.changes !== undefined ? Number(result.changes) : 0,
      };
      if (callback) callback.call(ctx, null);
    } catch (err) {
      if (callback) callback(err);
      else throw err;
    }
    return this;
  }

  all(sql, params, callback) {
    if (typeof params === 'function') {
      callback = params;
      params = [];
    }
    try {
      const normalized = normalizeParams(sql, params);
      const stmt = this.db.prepare(normalized.sql);
      const rows = Array.isArray(normalized.params)
        ? stmt.all(...normalized.params)
        : stmt.all(normalized.params);

      if (callback) callback(null, rows || []);
    } catch (err) {
      if (callback) callback(err, null);
      else throw err;
    }
    return this;
  }

  get(sql, params, callback) {
    if (typeof params === 'function') {
      callback = params;
      params = [];
    }
    try {
      const normalized = normalizeParams(sql, params);
      const stmt = this.db.prepare(normalized.sql);
      const row = Array.isArray(normalized.params)
        ? stmt.get(...normalized.params)
        : stmt.get(normalized.params);

      if (callback) callback(null, row || null);
    } catch (err) {
      if (callback) callback(err, null);
      else throw err;
    }
    return this;
  }

  each(sql, params, callback, complete) {
    if (typeof params === 'function') {
      complete = callback;
      callback = params;
      params = [];
    }
    this.all(sql, params, (err, rows) => {
      if (err) {
        if (callback) callback(err);
        if (complete) complete(err, 0);
        return;
      }
      rows.forEach((r) => callback && callback(null, r));
      if (complete) complete(null, rows.length);
    });
    return this;
  }

  exec(sql, callback) {
    try {
      this.db.exec(sql);
      if (callback) callback(null);
    } catch (err) {
      if (callback) callback(err);
      else throw err;
    }
    return this;
  }

  serialize(fn) {
    if (fn) fn();
  }

  parallelize(fn) {
    if (fn) fn();
  }
}

module.exports = {
  Database,
  OPEN_READONLY: 1,
  OPEN_READWRITE: 2,
  OPEN_CREATE: 4,
  verbose: () => module.exports,
};
