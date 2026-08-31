import { Sequelize, Options } from 'sequelize';
import path from 'path';
import fs from 'fs';
import { createRequire } from 'module';
import { logger } from '../utils/logger';

const require = createRequire(import.meta.url);
const sqliteBridge = require('./sqliteBridge.cjs');

// Configuración predeterminada para el servidor Profit MSSQL AD_TRANS
const profitHost = process.env.PROFIT_DB_HOST || 'SRVBDPROFITBK';
const profitPort = parseInt(process.env.PROFIT_DB_PORT || '1433', 10);
const profitDbName = process.env.PROFIT_DB_NAME || 'AD_TRANS';
const profitUser = process.env.PROFIT_DB_USER || 'fvelazco';
const profitPassword = process.env.PROFIT_DB_PASSWORD || '123';
const profitDialect = (process.env.PROFIT_DB_DIALECT || 'mssql').toLowerCase() as 'mssql' | 'sqlite';

let profitSequelizeConfig: Options;
let isFallbackMode = false;

const shouldLogProfitSql = process.env.DEBUG_SQL === 'true';

if (profitDialect === 'mssql') {
  profitSequelizeConfig = {
    dialect: 'mssql',
    host: profitHost,
    port: profitPort,
    database: profitDbName,
    username: profitUser,
    password: profitPassword,
    logging: shouldLogProfitSql ? (msg) => logger.debug(`[Profit MSSQL AD_TRANS] ${msg}`) : false,
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
  const dir = path.resolve(process.cwd(), './data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  profitSequelizeConfig = {
    dialect: 'sqlite',
    dialectModule: sqliteBridge,
    storage: path.resolve(process.cwd(), './data/profit_ad_trans.sqlite'),
    logging: shouldLogProfitSql ? (msg) => logger.debug(`[Profit SQLite Fallback] ${msg}`) : false,
  };
}

export let profitSequelize = new Sequelize(profitSequelizeConfig);

/**
 * Prueba y obtiene el estado detallado de la conexión MSSQL al servidor Profit (AD_TRANS)
 */
export async function getProfitConnectionStatus(): Promise<{
  connected: boolean;
  server: string;
  database: string;
  user: string;
  dialect: string;
  fallback: boolean;
  message: string;
  latencyMs?: number;
}> {
  const start = Date.now();
  try {
    await profitSequelize.authenticate();
    const latency = Date.now() - start;
    return {
      connected: true,
      server: isFallbackMode ? 'Local SQLite Emulado' : profitHost,
      database: profitDbName,
      user: profitUser,
      dialect: profitSequelize.getDialect().toUpperCase(),
      fallback: isFallbackMode,
      latencyMs: latency,
      message: `Conexión activa y autenticada con ${isFallbackMode ? 'fallback SQLite' : 'MSSQL ' + profitHost}`,
    };
  } catch (error: any) {
    return {
      connected: false,
      server: profitHost,
      database: profitDbName,
      user: profitUser,
      dialect: 'MSSQL',
      fallback: isFallbackMode,
      message: `Error de conexión: ${error.message || error}`,
    };
  }
}

/**
 * Inicializa la conexión MSSQL con Profit Plus (AD_TRANS)
 * Si el servidor SRVBDPROFITBK no está accesible (ej. desarrollo fuera de la red local),
 * conmuta automáticamente a almacenamiento local SQLite para no interrumpir el desarrollo.
 */
export async function initProfitDatabase(): Promise<Sequelize> {
  try {
    await profitSequelize.authenticate();
    logger.info(`[Profit MSSQL] Conectado exitosamente a ${profitHost}/${profitDbName} con usuario ${profitUser}`);
    return profitSequelize;
  } catch (err: any) {
    if (profitDialect === 'mssql') {
      logger.warn(`[Profit MSSQL] No se pudo conectar a ${profitHost}/${profitDbName} (${err.message}). Activando respaldo local SQLite para desarrollo.`);
      isFallbackMode = true;

      const fallbackDir = path.resolve(process.cwd(), './data');
      if (!fs.existsSync(fallbackDir)) {
        fs.mkdirSync(fallbackDir, { recursive: true });
      }

      profitSequelize = new Sequelize({
        dialect: 'sqlite',
        dialectModule: sqliteBridge,
        storage: path.resolve(process.cwd(), './data/profit_ad_trans.sqlite'),
        logging: false,
      });

      await profitSequelize.authenticate();
      await seedProfitFallbackTables(profitSequelize);

      // Re-vincular modelos Sequelize a la instancia fallback
      const { initFlotaOrdenServicioProfitModel } = await import('../models/FlotaOrdenServicioProfit.model');
      const { initVwFlotaVendedoresModel } = await import('../models/VwFlotaVendedores.model');
      const { initVwFlotaArticulosModel } = await import('../models/VwFlotaArticulos.model');
      const { initMecanicosProfitModel } = await import('../models/MecanicosProfit.model');
      initFlotaOrdenServicioProfitModel(profitSequelize);
      initVwFlotaVendedoresModel(profitSequelize);
      initVwFlotaArticulosModel(profitSequelize);
      initMecanicosProfitModel(profitSequelize);

      logger.info(`[Profit MSSQL] Respaldo local SQLite para AD_TRANS inicializado exitosamente.`);
      return profitSequelize;
    }
    logger.error(`[Profit DB] Error al inicializar:`, err);
    throw err;
  }
}

/**
 * Crea tablas y datos iniciales en la base de datos de respaldo SQLite
 * para simular las vistas y tablas de Profit AD_TRANS en entornos de desarrollo local.
 */
async function seedProfitFallbackTables(seq: Sequelize): Promise<void> {
  try {
    await seq.query(`
      CREATE TABLE IF NOT EXISTS flota_ordenes_servicio (
        id_orden INTEGER PRIMARY KEY AUTOINCREMENT,
        nro_orden TEXT NOT NULL UNIQUE,
        Placa TEXT NOT NULL,
        km_horometro REAL NOT NULL,
        recibido_por TEXT NOT NULL,
        entregado_por TEXT,
        fec_apertura DATETIME DEFAULT CURRENT_TIMESTAMP,
        fec_cierre DATETIME,
        sintomas_reportados TEXT NOT NULL,
        es_reincidencia INTEGER DEFAULT 0,
        nro_orden_anterior TEXT,
        motivo_reincidencia TEXT,
        fotos_adjuntas INTEGER DEFAULT 0,
        estatus TEXT DEFAULT 'ABIERTA',
        costo_repuestos REAL DEFAULT 0,
        costo_mano_obra REAL DEFAULT 0,
        costo_servicios_ext REAL DEFAULT 0,
        costo_total REAL DEFAULT 0,
        recibe_conforme TEXT,
        hora_apertura DATETIME,
        hora_cierre DATETIME
      );
    `);

    await seq.query(`
      CREATE TABLE IF NOT EXISTS vw_flota_vendedores (
        co_ven TEXT PRIMARY KEY,
        cedula TEXT,
        ven_des TEXT
      );
    `);

    await seq.query(`
      CREATE TABLE IF NOT EXISTS vw_flota_articulos (
        codigo_profit TEXT PRIMARY KEY,
        nombre_producto TEXT NOT NULL,
        codigo_categoria TEXT,
        categoria TEXT,
        unidad_medida TEXT,
        costo REAL DEFAULT 0,
        tipo TEXT,
        codigo_subalmacen TEXT,
        sub_almacen TEXT,
        codigo_almacen TEXT,
        almacen TEXT,
        stock_act REAL DEFAULT 0
      );
    `);

    await seq.query(`
      CREATE TABLE IF NOT EXISTS mecanicos (
        codigo TEXT PRIMARY KEY,
        nombre TEXT NOT NULL,
        cargo TEXT,
        activo INTEGER DEFAULT 1
      );
    `);

    // Sembrar Vendedores si está vacía
    const [vendedores]: any = await seq.query(`SELECT COUNT(*) as count FROM vw_flota_vendedores`);
    if (vendedores[0]?.count === 0) {
      await seq.query(`
        INSERT INTO vw_flota_vendedores (co_ven, cedula, ven_des) VALUES
        ('VEN-001', 'V-14238910', 'Carlos Alberto Mendoza Rivas'),
        ('VEN-002', 'V-18765432', 'Mariana Isabel Rojas Gil'),
        ('VEN-003', 'V-12984501', 'José Antonio Ramírez Blanco'),
        ('VEN-004', 'V-16503921', 'Pedro Luis Morales Castillo'),
        ('VEN-005', 'V-20114872', 'Héctor Daniel Fernández Parra'),
        ('VEN-006', 'V-15894123', 'Luis Eduardo Quintero Peña'),
        ('VEN-007', 'V-19345678', 'Ana Carolina Soto Delgado'),
        ('VEN-008', 'V-13456789', 'Franklin José Velazco');
      `);
      logger.info(`[Profit SQLite Fallback] Vendedores de prueba sembrados en vw_flota_vendedores`);
    }

    // Sembrar Artículos si está vacía
    const [articulos]: any = await seq.query(`SELECT COUNT(*) as count FROM vw_flota_articulos`);
    if (articulos[0]?.count === 0) {
      await seq.query(`
        INSERT INTO vw_flota_articulos (codigo_profit, nombre_producto, codigo_categoria, categoria, unidad_medida, costo, tipo, codigo_subalmacen, sub_almacen, codigo_almacen, almacen, stock_act) VALUES
        ('FRE-0234', 'Discos de freno delanteros ventilados', 'FRE', 'Frenos y Suspensión', 'PAR', 38.50, 'Repuesto', 'SUB-FRE', 'Frenos y Neumática', 'TLL-01', 'Taller Principal San Luis', 8),
        ('PAS-0301', 'Juego de pastillas de freno cerámicas', 'FRE', 'Frenos y Suspensión', 'JGO', 48.90, 'Repuesto', 'SUB-FRE', 'Frenos y Neumática', 'TLL-01', 'Taller Principal San Luis', 11),
        ('FIL-0112', 'Filtro de aceite motor diésel pesado', 'FIL', 'Filtros y Mantenimiento', 'UND', 12.40, 'Consumible', 'SUB-FIL', 'Filtros y Lubricantes', 'ALM-01', 'Almacén Central', 25),
        ('FIL-0115', 'Filtro de combustible primario trampa de agua', 'FIL', 'Filtros y Mantenimiento', 'UND', 18.20, 'Consumible', 'SUB-FIL', 'Filtros y Lubricantes', 'ALM-01', 'Almacén Central', 14),
        ('LUB-15W40', 'Aceite de motor 15W40 CI-4 / E7 Tambor 208L', 'LUB', 'Lubricantes y Fluidos', 'LIT', 4.50, 'Consumible', 'SUB-LUB', 'Lubricantes y Químicos', 'ALM-01', 'Almacén Central', 420),
        ('COR-0988', 'Correa serpentina alternador / bomba de agua', 'MOT', 'Motor y Transmisión', 'UND', 24.00, 'Repuesto', 'SUB-MOT', 'Repuestos de Motor', 'TLL-01', 'Taller Principal San Luis', 6),
        ('BAT-1100', 'Batería 1100 Amp 12V servicio pesado 4D', 'ELE', 'Sistema Eléctrico', 'UND', 145.00, 'Repuesto', 'SUB-ELE', 'Baterías y Eléctrico', 'TLL-01', 'Taller Principal San Luis', 4),
        ('AMOR-5541', 'Amortiguador de cabina neumático', 'SUS', 'Frenos y Suspensión', 'UND', 62.00, 'Repuesto', 'SUB-SUS', 'Suspensión y Chasis', 'ALM-01', 'Almacén Central', 0),
        ('NEU-29580', 'Neumático 295/80R22.5 dirección y tracción', 'CAU', 'Cauchos y Neumáticos', 'UND', 285.00, 'Repuesto', 'SUB-CAU', 'Cauchos y Rines', 'ALM-01', 'Almacén Central', 16),
        ('VAL-4VIA', 'Válvula protectora de cuatro circuitos neumática', 'NEU', 'Frenos y Neumática', 'UND', 95.00, 'Repuesto', 'SUB-NEU', 'Frenos y Neumática', 'TLL-01', 'Taller Principal San Luis', 3),
        ('VAL-RET', 'Válvula de retención de aire 1/2 pulgada', 'NEU', 'Frenos y Neumática', 'UND', 14.50, 'Repuesto', 'SUB-NEU', 'Frenos y Neumática', 'TLL-01', 'Taller Principal San Luis', 19),
        ('RET-CIG', 'Retén de cigüeñal trasero vitón alta temp', 'MOT', 'Motor y Transmisión', 'UND', 22.80, 'Repuesto', 'SUB-MOT', 'Repuestos de Motor', 'ALM-01', 'Almacén Central', 7);
      `);
      logger.info(`[Profit SQLite Fallback] Artículos de prueba sembrados en vw_flota_articulos`);
    }

    // Sembrar Mecánicos con los 19 registros oficiales
    const [mecanicosCount]: any = await seq.query(`SELECT COUNT(*) as count FROM mecanicos`);
    const [hasNewData]: any = await seq.query(`SELECT COUNT(*) as count FROM mecanicos WHERE codigo LIKE 'V%'`);
    if (mecanicosCount[0]?.count === 0 || hasNewData[0]?.count === 0) {
      await seq.query(`DELETE FROM mecanicos;`);
      await seq.query(`
        INSERT INTO mecanicos (codigo, nombre, cargo, activo) VALUES
        ('V11587399', 'Denny Antonio Castillo Perdomo', 'Mecanico 1', 1),
        ('V11588384', 'Deibis Rafael Flores Colmenarez', 'Mecanico Electricista', 1),
        ('V12884596', 'Jose Luis Garcia Guedez', 'Mecanico 1', 1),
        ('V13071107', 'Isidro Gregorio Peraza', 'Mecanico 3', 1),
        ('V15306226', 'Nixon David Silva', 'Mecanico 3', 1),
        ('V16138289', 'Oscar Jose Colmenarez Medina', 'Mecanico 3', 1),
        ('V16840342', 'Pedro Catalino Querales Cordero', 'Mecanico 3', 1),
        ('V17872264', 'Jose Pastor Jimenez Perez', 'Mecanico 2', 1),
        ('V18699774', 'Armando José Hernández Reyes', 'Mecanico 1', 1),
        ('V18996330', 'Luis Eduardo Gonzalez Goyo', 'Mecanico 3', 1),
        ('V19164308', 'Gesus Alexis Gimenez Rodriguez', 'Mecanico 2', 1),
        ('V20668043', 'Leihender Josue Romero Gutierrez', 'Mecanico 2', 1),
        ('V20927555', 'Roberth Alexander Timaure Marchan', 'Mecanico 1', 1),
        ('V22189396', 'Alexander Antonio Perez Palacios', 'Mecanico 3', 1),
        ('V22268678', 'Eduith Vladimir Bonilla Mendez', 'Mecanico 2', 1),
        ('V24201409', 'Enderson Jose Nuñes Perez', 'Mecanico 3', 1),
        ('V26005758', 'Nerio Coromoto Matute Alarcon', 'Mecanico 3', 1),
        ('V27736322', 'Jose Gregorio Suarez Mendoza', 'Mecanico 2', 1),
        ('V9116556', 'Luis Fernando Cabrera', 'Mecanico Electricista', 1);
      `);
      logger.info(`[Profit SQLite Fallback] 19 mecánicos oficiales sembrados en ad_trans.dbo.mecanicos`);
    }
  } catch (err: any) {
    logger.warn(`[Profit SQLite Fallback] Error sembrando tablas de respaldo: ${err.message}`);
  }
}


export default profitSequelize;
