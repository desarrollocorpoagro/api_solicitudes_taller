import { Sequelize, Options } from 'sequelize';
import path from 'path';
import fs from 'fs';
import { createRequire } from 'module';
import { logger } from '../utils/logger';

const require = createRequire(import.meta.url);
const sqliteBridge = require('./sqliteBridge.cjs');

const dbDialect = (process.env.DB_DIALECT || 'sqlite').toLowerCase() as 'mssql' | 'sqlite' | 'postgres';
const dbName = process.env.DB_NAME || 'sanluis_db';
const dbUser = process.env.DB_USER || 'sa';
const dbHost = process.env.DB_HOST || 'localhost';
const dbPassword = process.env.DB_PASSWORD || 'Password123!';
const dbPort = parseInt(process.env.DB_PORT || '1433', 10);
const dbStorage = process.env.DB_STORAGE || './data/sanluis.sqlite';

// Asegurar que el directorio de almacenamiento exista para SQLite
if (dbDialect === 'sqlite') {
  const dir = path.dirname(path.resolve(process.cwd(), dbStorage));
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

let sequelizeConfig: Options;

const shouldLogSql = process.env.DEBUG_SQL === 'true';

if (dbDialect === 'mssql') {
  sequelizeConfig = {
    dialect: 'mssql',
    host: dbHost,
    port: dbPort,
    database: dbName,
    username: dbUser,
    password: dbPassword,
    logging: shouldLogSql ? (msg) => logger.debug(`[Sequelize MSSQL] ${msg}`) : false,
    dialectOptions: {
      options: {
        encrypt: false,
        trustServerCertificate: true,
        connectTimeout: 5000,
        requestTimeout: 10000,
      },
    },
    pool: {
      max: 10,
      min: 0,
      acquire: 15000,
      idle: 10000,
    },
  };
} else {
  // SQLite con puente integrado de Node 22 para compatibilidad universal
  sequelizeConfig = {
    dialect: 'sqlite',
    dialectModule: sqliteBridge,
    storage: path.resolve(process.cwd(), dbStorage),
    logging: shouldLogSql ? (msg) => logger.debug(`[Sequelize SQLite] ${msg}`) : false,
  };
}

export let sequelize = new Sequelize(sequelizeConfig);

/**
 * Inicializa la base de datos con autenticación y migración automática.
 * Si MSSQL no está disponible en el entorno de desarrollo, realiza fallback seguro a SQLite.
 */
export const initDatabase = async (forceSync = false): Promise<Sequelize> => {
  try {
    await sequelize.authenticate();
    logger.info(`[Database] Conexión establecida exitosamente con dialecto: ${sequelize.getDialect().toUpperCase()}`);
    return sequelize;
  } catch (error: any) {
    if (dbDialect === 'mssql') {
      logger.warn(`[Database] No se pudo conectar a MSSQL (${error.message}). Realizando fallback a SQLite para desarrollo autónomo.`);

      const fallbackDir = path.dirname(path.resolve(process.cwd(), './data/sanluis_fallback.sqlite'));
      if (!fs.existsSync(fallbackDir)) {
        fs.mkdirSync(fallbackDir, { recursive: true });
      }

      sequelize = new Sequelize({
        dialect: 'sqlite',
        dialectModule: sqliteBridge,
        storage: path.resolve(process.cwd(), './data/sanluis_fallback.sqlite'),
        logging: false,
      });

      await sequelize.authenticate();
      logger.info('[Database] Conexión de respaldo SQLite inicializada exitosamente.');
      return sequelize;
    }
    logger.error('[Database] Error al conectar a la base de datos:', error);
    throw error;
  }
};

export default sequelize;
