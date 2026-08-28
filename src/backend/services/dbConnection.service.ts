import { Sequelize, Options } from 'sequelize';
import path from 'path';
import fs from 'fs';
import { createRequire } from 'module';
import { DatabaseConnection } from '../models/DatabaseConnection.model';
import { logger } from '../utils/logger';

const require = createRequire(import.meta.url);
const sqliteBridge = require('../config/sqliteBridge.cjs');

export interface QueryExecutionResult {
  success: boolean;
  query: string;
  rowCount: number;
  columns: string[];
  rows: any[];
  executionTimeMs: number;
  dialect: string;
  source: string;
  error?: string;
}

export class DbConnectionService {
  /**
   * Crea una instancia de Sequelize dinámica basada en la configuración guardada o enviada
   */
  static createSequelizeInstance(config: {
    dialect: string;
    host?: string;
    port?: number;
    databaseName?: string;
    username?: string;
    password?: string;
    trustServerCertificate?: boolean;
    encrypt?: boolean;
    storage?: string;
    options?: any;
  }): Sequelize {
    const dialect = (config.dialect || 'mssql').toLowerCase();

    if (dialect === 'mssql') {
      return new Sequelize({
        dialect: 'mssql',
        host: config.host || process.env.PROFIT_DB_HOST || 'SRVBDPROFITBK',
        port: config.port || parseInt(process.env.PROFIT_DB_PORT || '1433', 10),
        database: config.databaseName || process.env.PROFIT_DB_NAME || 'AD_TRANS',
        username: config.username || process.env.PROFIT_DB_USER || 'solicitudweb',
        password: config.password || process.env.PROFIT_DB_PASSWORD || 'solicitudweb',
        logging: false,
        dialectOptions: {
          options: {
            encrypt: config.encrypt ?? false,
            trustServerCertificate: config.trustServerCertificate ?? true,
            connectTimeout: 5000,
            requestTimeout: 15000,
            ...(config.options || {}),
          },
        },
        pool: {
          max: 5,
          min: 0,
          acquire: 10000,
          idle: 5000,
        },
      });
    }

    if (dialect === 'postgres' || dialect === 'postgresql') {
      return new Sequelize({
        dialect: 'postgres',
        host: config.host || 'localhost',
        port: config.port || 5432,
        database: config.databaseName || 'sanluis_db',
        username: config.username || 'postgres',
        password: config.password || 'postgres',
        logging: false,
      });
    }

    // Default SQLite fallback
    const storagePath =
      config.storage ||
      path.resolve(process.cwd(), './data/profit_ad_trans.sqlite');
    const dir = path.dirname(storagePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    return new Sequelize({
      dialect: 'sqlite',
      dialectModule: sqliteBridge,
      storage: storagePath,
      logging: false,
    });
  }

  /**
   * Prueba una conexión de base de datos específica y calcula la latencia
   */
  static async testConnectionConfig(config: {
    dialect: string;
    host?: string;
    port?: number;
    databaseName?: string;
    username?: string;
    password?: string;
    trustServerCertificate?: boolean;
    encrypt?: boolean;
    storage?: string;
    options?: any;
  }): Promise<{
    connected: boolean;
    dialect: string;
    server: string;
    database: string;
    user: string;
    latencyMs: number;
    message: string;
    error?: string;
  }> {
    const seq = this.createSequelizeInstance(config);
    const start = Date.now();
    try {
      await seq.authenticate();
      const latencyMs = Date.now() - start;
      await seq.close();

      return {
        connected: true,
        dialect: (config.dialect || 'mssql').toUpperCase(),
        server: config.host || 'localhost',
        database: config.databaseName || 'AD_TRANS',
        user: config.username || 'solicitudweb',
        latencyMs,
        message: `Conexión exitosa y autenticada en ${latencyMs}ms.`,
      };
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      try {
        await seq.close();
      } catch (_) {}

      return {
        connected: false,
        dialect: (config.dialect || 'mssql').toUpperCase(),
        server: config.host || 'localhost',
        database: config.databaseName || 'AD_TRANS',
        user: config.username || 'solicitudweb',
        latencyMs,
        message: `Error de conexión: ${err.message}`,
        error: err.message,
      };
    }
  }

  /**
   * Ejecuta una consulta SQL directa (Raw Query) de forma segura
   * Admite consultas SELECT para vistas de Profit Plus como vw_flota_articulos, etc.
   */
  static async executeDirectQuery(
    sqlQuery: string,
    connectionId?: string
  ): Promise<QueryExecutionResult> {
    const cleanSql = sqlQuery.trim();
    if (!cleanSql) {
      throw new Error('La consulta SQL no puede estar vacía.');
    }

    // Obtener conexión activa o la solicitada
    let targetSeq: Sequelize;
    let sourceName = 'AD_TRANS';
    let dialectName = 'MSSQL';

    if (connectionId) {
      const conn = await DatabaseConnection.findByPk(connectionId);
      if (conn) {
        targetSeq = this.createSequelizeInstance({
          dialect: conn.dialect,
          host: conn.host,
          port: conn.port,
          databaseName: conn.databaseName,
          username: conn.username,
          password: conn.password,
          trustServerCertificate: conn.trustServerCertificate,
          encrypt: conn.encrypt,
          options: conn.options,
        });
        sourceName = `${conn.nombre} (${conn.host}/${conn.databaseName})`;
        dialectName = conn.dialect.toUpperCase();
      } else {
        const { profitSequelize } = await import('../config/profitDb');
        targetSeq = profitSequelize;
      }
    } else {
      const { profitSequelize } = await import('../config/profitDb');
      targetSeq = profitSequelize;
    }

    const start = Date.now();
    try {
      const [results]: any = await targetSeq.query(cleanSql);
      const executionTimeMs = Date.now() - start;

      const rows = Array.isArray(results) ? results : [results];
      const columns = rows.length > 0 && typeof rows[0] === 'object' && rows[0] !== null
        ? Object.keys(rows[0])
        : [];

      return {
        success: true,
        query: cleanSql,
        rowCount: rows.length,
        columns,
        rows,
        executionTimeMs,
        dialect: dialectName,
        source: sourceName,
      };
    } catch (error: any) {
      const executionTimeMs = Date.now() - start;
      logger.error(`[DbConnectionService] Error al ejecutar consulta directa: ${error.message}`);
      return {
        success: false,
        query: cleanSql,
        rowCount: 0,
        columns: [],
        rows: [],
        executionTimeMs,
        dialect: dialectName,
        source: sourceName,
        error: error.message,
      };
    }
  }
}
