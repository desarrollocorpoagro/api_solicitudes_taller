import { sequelize } from '../config/database';
import Company from './Company.model';
import User from './User.model';
import UserCompany from './UserCompany.model';
import FlotaVehicular from './FlotaVehicular.model';
import CatalogoRepuesto from './CatalogoRepuesto.model';
import OrdenServicio from './OrdenServicio.model';
import OrdenArea from './OrdenArea.model';
import SolicitudRepuesto from './SolicitudRepuesto.model';
import SolicitudExterno from './SolicitudExterno.model';
import Notificacion from './Notificacion.model';
import Multimedia from './Multimedia.model';
import OrdenAuditLog from './OrdenAuditLog.model';
import FlotaOrdenServicioProfit from './FlotaOrdenServicioProfit.model';
import VwFlotaVendedores from './VwFlotaVendedores.model';
import VwFlotaArticulos from './VwFlotaArticulos.model';
import MecanicosProfit from './MecanicosProfit.model';
import DatabaseConnection from './DatabaseConnection.model';
import RolePermission from './RolePermission.model';
import UserPermission from './UserPermission.model';
import SyncQueue, { initSyncQueueModel } from './SyncQueue.model';
import { profitSequelize, initProfitDatabase, getProfitConnectionStatus } from '../config/profitDb';
import { logger } from '../utils/logger';

// Definición de Relaciones Multi-Tenant y de Órdenes
User.hasMany(UserCompany, { foreignKey: 'userId', as: 'userCompanies' });
UserCompany.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Company.hasMany(UserCompany, { foreignKey: 'companyId', as: 'userCompanies' });
UserCompany.belongsTo(Company, { foreignKey: 'companyId', as: 'company' });

User.hasMany(UserPermission, { foreignKey: 'userId', as: 'customPermissions', onDelete: 'CASCADE' });
UserPermission.belongsTo(User, { foreignKey: 'userId', as: 'user' });

OrdenServicio.hasMany(OrdenArea, { foreignKey: 'ordenId', as: 'ordenesArea', onDelete: 'CASCADE' });
OrdenArea.belongsTo(OrdenServicio, { foreignKey: 'ordenId', as: 'orden' });

OrdenServicio.hasMany(SolicitudRepuesto, { foreignKey: 'ordenId', as: 'solicitudesRepuesto', onDelete: 'CASCADE' });
SolicitudRepuesto.belongsTo(OrdenServicio, { foreignKey: 'ordenId', as: 'orden' });

OrdenServicio.hasMany(SolicitudExterno, { foreignKey: 'ordenId', as: 'solicitudesExterno', onDelete: 'CASCADE' });
SolicitudExterno.belongsTo(OrdenServicio, { foreignKey: 'ordenId', as: 'orden' });

OrdenServicio.hasMany(Multimedia, { foreignKey: 'ordenId', as: 'archivosMultimedia', onDelete: 'SET NULL' });
Multimedia.belongsTo(OrdenServicio, { foreignKey: 'ordenId', as: 'orden' });

OrdenServicio.hasMany(OrdenAuditLog, { foreignKey: 'ordenId', as: 'auditorias', onDelete: 'CASCADE' });
OrdenAuditLog.belongsTo(OrdenServicio, { foreignKey: 'ordenId', as: 'orden' });

export {
  sequelize,
  profitSequelize,
  initProfitDatabase,
  getProfitConnectionStatus,
  Company,
  User,
  UserCompany,
  FlotaVehicular,
  CatalogoRepuesto,
  OrdenServicio,
  OrdenArea,
  SolicitudRepuesto,
  SolicitudExterno,
  Notificacion,
  Multimedia,
  OrdenAuditLog,
  FlotaOrdenServicioProfit,
  VwFlotaVendedores,
  VwFlotaArticulos,
  MecanicosProfit,
  DatabaseConnection,
  RolePermission,
  UserPermission,
  SyncQueue,
  initSyncQueueModel,
};

/**
 * Semilla inicial de datos para demostración y puesta en marcha inmediata.
 */
export const seedInitialData = async () => {
  try {
    // Sincronizar tablas (sin alter para evitar el bug SQLite "constraint failed"
    // al rehacer tablas con índices UNIQUE sobre role_permissions).
    // Para evolucionar el esquema en desarrollo: borrar ./data/sanluis.sqlite.
    await sequelize.sync();

    // 1. Semilla de Empresas (Tenants)
    const companyCount = await Company.count();
    let comp1: Company, comp2: Company, comp3: Company;

    if (companyCount === 0) {
      comp1 = await Company.create({
        id: '11111111-1111-1111-1111-111111111111',
        name: 'TRANSPORTE SAN LUIS DE LARA, C.A.',
        taxId: 'J-30516192-5',
        email: 'contacto@transporteandina.com',
        phone: '+58 274 2441122',
        isActive: true,
      });

      comp2 = await Company.create({
        id: '22222222-2222-2222-2222-222222222222',
        name: 'SAN LUIS TRANSPORTE, C.A.',
        taxId: 'J-50178032-3',
        email: 'operaciones@agrollanos.com',
        phone: '+58 247 3349911',
        isActive: true,
      });

      
      logger.info('[Seed] Empresas creadas exitosamente.');
    } else {
      [comp1, comp2] = (await Company.findAll({ limit: 3 })) as [Company, Company];
    }

    // 2. Semilla de Usuarios y asignaciones de empresa
    const allPermissions = [
      { module: 'taller', actions: ['read', 'create', 'update', 'delete', 'approve', 'close', 'admin'] },
      { module: 'fleet', actions: ['read', 'create', 'update', 'delete', 'admin'] },
      { module: 'inventory', actions: ['read', 'dispatch', 'requisition', 'admin'] },
      { module: 'users', actions: ['read', 'create', 'update', 'delete', 'admin'] },
      { module: 'reports', actions: ['read', 'export', 'admin'] },
    ];

    const usersToSeed = [
      {
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        fullName: 'Administrador San Luis',
        email: 'admin@empresasanluis.com',
        password: 'Password123!',
        phone: '+58 412 1112233',
        role: 'ADMIN',
        isActive: true,
        companies: [comp1?.id, comp2?.id],
        permissions: allPermissions,
      },
      {
        id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        fullName: 'Ing. Carlos Mendoza (Gerente Taller)',
        email: 'gerente.taller@empresasanluis.com',
        password: 'Password123!',
        phone: '+58 414 2223344',
        role: 'GERENTE_TALLER',
        isActive: true,
        companies: [comp1?.id],
        permissions: allPermissions,
      },
      {
        id: '12121212-1212-1212-1212-121212121212',
        fullName: 'Téc. Marcos Peña (Supervisor Taller)',
        email: 'supervisor.taller@empresasanluis.com',
        password: 'Password123!',
        phone: '+58 414 7778899',
        role: 'SUPERVISOR',
        isActive: true,
        companies: [comp1?.id],
        permissions: [
          { module: 'taller', actions: ['read', 'create', 'update', 'approve'] },
          { module: 'fleet', actions: ['read', 'update'] },
          { module: 'inventory', actions: ['read', 'create'] },
        ],
      },
      {
        id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        fullName: 'Lic. Mariana Rojas (Responsable Flota)',
        email: 'flota@empresasanluis.com',
        password: 'Password123!',
        phone: '+58 416 3334455',
        role: 'RESPONSABLE_FLOTA',
        isActive: true,
        companies: [comp1?.id],
        permissions: [
          { module: 'fleet', actions: ['read', 'create', 'update'] },
          { module: 'taller', actions: ['read', 'create'] },
          { module: 'reports', actions: ['read'] },
        ],
      },
      {
        id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
        fullName: 'José Ramírez (Técnico Mecánico)',
        email: 'jose.ramirez@empresasanluis.com',
        password: 'Password123!',
        phone: '+58 424 4445566',
        role: 'MECANICO',
        isActive: true,
        companies: [comp1?.id],
        permissions: [
          { module: 'taller', actions: ['read', 'update'] },
          { module: 'inventory', actions: ['read', 'create'] },
        ],
      },
      {
        id: '34343434-3434-3434-3434-343434343434',
        fullName: 'Denny Castillo (Mecánico 1 / Taller)',
        email: 'mecanico@empresasanluis.com',
        password: 'Password123!',
        phone: '+58 412 8889900',
        role: 'MECANICO',
        isActive: true,
        companies: [comp1?.id],
        permissions: [
          { module: 'taller', actions: ['read', 'update'] },
          { module: 'inventory', actions: ['read', 'create'] },
        ],
      },
      {
        id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
        fullName: 'Pedro Morales (Almacén Central TLL-01)',
        email: 'almacen@empresasanluis.com',
        password: 'Password123!',
        phone: '+58 412 5556677',
        role: 'ALMACENISTA',
        isActive: true,
        companies: [comp1?.id],
        permissions: [
          { module: 'inventory', actions: ['read', 'dispatch', 'requisition'] },
          { module: 'taller', actions: ['read'] },
          { module: 'reports', actions: ['read'] },
        ],
      },
      {
        id: '56565656-5656-5656-5656-565656565656',
        fullName: 'Lic. Francisco Rivas (Auditor de Calidad)',
        email: 'auditor@empresasanluis.com',
        password: 'Password123!',
        phone: '+58 414 9991122',
        role: 'AUDITOR',
        isActive: true,
        companies: [comp1?.id],
        permissions: [
          { module: 'taller', actions: ['read'] },
          { module: 'fleet', actions: ['read'] },
          { module: 'inventory', actions: ['read'] },
          { module: 'reports', actions: ['read', 'export'] },
        ],
      },
      {
        id: '78787878-7878-7878-7878-787878787878',
        fullName: 'Ing. Roberto Gómez (Solicitante Operaciones)',
        email: 'solicitante@empresasanluis.com',
        password: 'Password123!',
        phone: '+58 416 2223344',
        role: 'SOLICITANTE',
        isActive: true,
        companies: [comp1?.id],
        permissions: [
          { module: 'taller', actions: ['read', 'create'] },
          { module: 'fleet', actions: ['read'] },
        ],
      },
      {
        id: '90909090-9090-9090-9090-909090909090',
        fullName: 'Luis Márquez (Operador / Conductor)',
        email: 'operador@empresasanluis.com',
        password: 'Password123!',
        phone: '+58 424 5556677',
        role: 'OPERADOR',
        isActive: true,
        companies: [comp1?.id],
        permissions: [
          { module: 'taller', actions: ['read'] },
          { module: 'fleet', actions: ['read'] },
        ],
      },
    ];

    for (const u of usersToSeed) {
      const existing = await User.findOne({ where: { email: u.email } });
      let userRecord = existing;
      if (!existing) {
        userRecord = await User.create({
          id: u.id,
          fullName: u.fullName,
          email: u.email,
          password: u.password,
          phone: u.phone,
          role: u.role,
          isActive: u.isActive,
        });
      }

      if (userRecord && u.companies) {
        for (const cId of u.companies) {
          if (!cId) continue;
          const userComp = await UserCompany.findOne({
            where: { userId: userRecord.id, companyId: cId },
          });
          if (!userComp) {
            await UserCompany.create({
              userId: userRecord.id,
              companyId: cId,
              role: u.role,
              permissions: u.permissions,
            });
          }
        }
      }
    }

    logger.info('[Seed] Usuarios y asignaciones de todos los roles (9 roles) verificados exitosamente.');

    // 3. Semilla de Flota Vehicular Multi-Tenant
    const flotaCount = await FlotaVehicular.count();
    if (flotaCount === 0) {
      // await FlotaVehicular.bulkCreate([
      //   // Empresa 1: TRANSPORTE SAN LUIS DE LARA, C.A.
      //   {
      //     placa: 'A12BC3D',
      //     companyId: comp1 ? comp1.id : '11111111-1111-1111-1111-111111111111',
      //     marca: 'Chevrolet NPR',
      //     anio: 2019,
      //     tipo: 'Camión 5t',
      //     empresa: 'TRANSPORTE SAN LUIS DE LARA, C.A.',
      //     cc: '3021',
      //     km: 184320,
      //     qrCode: 'SL-VEH-A12BC3D-3021',
      //     historialOsAnterior: 'OS-2026-00089',
      //     historialDias: 18,
      //     historialArea: 'Reparaciones mayores',
      //   },
      //   {
      //     placa: 'A99ZZ11',
      //     companyId: comp1 ? comp1.id : '11111111-1111-1111-1111-111111111111',
      //     marca: 'Mack Granite',
      //     anio: 2018,
      //     tipo: 'Chuto Pesado 30t',
      //     empresa: 'TRANSPORTE SAN LUIS DE LARA, C.A.',
      //     cc: '3022',
      //     km: 310450,
      //     qrCode: 'SL-VEH-A99ZZ11-3022',
      //   },
      //   {
      //     placa: 'A44TR88',
      //     companyId: comp1 ? comp1.id : '11111111-1111-1111-1111-111111111111',
      //     marca: 'Ford Cargo 1721',
      //     anio: 2020,
      //     tipo: 'Camión Plataforma',
      //     empresa: 'TRANSPORTE SAN LUIS DE LARA, C.A.',
      //     cc: '3023',
      //     km: 215600,
      //     qrCode: 'SL-VEH-A44TR88-3023',
      //   },

      //   // Empresa 2: SAN LUIS TRANSPORTE, C.A.
      //   {
      //     placa: 'B77XY9Z',
      //     companyId: comp2 ? comp2.id : '22222222-2222-2222-2222-222222222222',
      //     marca: 'Toyota Hilux 4x4',
      //     anio: 2021,
      //     tipo: 'Pick-up Campo',
      //     empresa: 'SAN LUIS TRANSPORTE, C.A.',
      //     cc: '1140',
      //     km: 96540,
      //     qrCode: 'SL-VEH-B77XY9Z-1140',
      //     historialOsAnterior: 'OS-2026-00045',
      //     historialDias: 40,
      //     historialArea: 'Mantenimiento Preventivo',
      //   },
      //   {
      //     placa: 'B22AG55',
      //     companyId: comp2 ? comp2.id : '22222222-2222-2222-2222-222222222222',
      //     marca: 'John Deere 6125J',
      //     anio: 2022,
      //     tipo: 'Tractor Agrícola',
      //     empresa: 'SAN LUIS TRANSPORTE, C.A.',
      //     cc: '1141',
      //     km: 4520,
      //     qrCode: 'SL-VEH-B22AG55-1141',
      //   },
      //   {
      //     placa: 'B88CC12',
      //     companyId: comp2 ? comp2.id : '22222222-2222-2222-2222-222222222222',
      //     marca: 'Chevrolet D-Max',
      //     anio: 2020,
      //     tipo: 'Pick-up Supervisión',
      //     empresa: 'SAN LUIS TRANSPORTE, C.A.',
      //     cc: '1142',
      //     km: 142100,
      //     qrCode: 'SL-VEH-B88CC12-1142',
      //   },

        
      // ]);
      logger.info('[Seed] Maestro de Flota Vehicular poblado exitosamente para todas las empresas.');
    }

    // 4. Semilla de Catálogo de Repuestos
    const repuestoCount = await CatalogoRepuesto.count();
    if (repuestoCount === 0) {
      // await CatalogoRepuesto.bulkCreate([
      //   { cod: 'FRE-0234', desc: 'Disco de freno delantero', stock: 6, costo: 82.00, almacen: 'TLL-01', categoria: 'Frenos' },
      //   { cod: 'ROD-0087', desc: 'Rodamiento de maza delantera', stock: 0, costo: 164.00, almacen: 'TLL-01', categoria: 'Tren Delantero' },
      //   { cod: 'FIL-0112', desc: 'Filtro de aceite', stock: 2, costo: 12.40, almacen: 'TLL-01', categoria: 'Filtros' },
      //   { cod: 'PAS-0301', desc: 'Juego de pastillas de freno', stock: 11, costo: 48.90, almacen: 'TLL-01', categoria: 'Frenos' },
      //   { cod: 'COR-0455', desc: 'Kit de correa de distribución', stock: 1, costo: 1290.00, almacen: 'TLL-01', categoria: 'Motor' },
      //   { cod: 'ACE-0010', desc: 'Aceite motor 15W40 (litro)', stock: 80, costo: 6.20, almacen: 'TLL-01', categoria: 'Lubricantes' },
      //   { cod: 'FIL-0889', desc: 'Filtro de combustible Diesel R90P', stock: 15, costo: 24.50, almacen: 'TLL-01', categoria: 'Filtros' },
      //   { cod: 'HID-0105', desc: 'Aceite hidráulico ISO 68 (galón)', stock: 20, costo: 18.30, almacen: 'TLL-01', categoria: 'Lubricantes' },
      // ]);
      logger.info('[Seed] Catálogo de Repuestos poblado exitosamente.');
    }

    // 5. Semilla de Órdenes de Servicio por Empresa
    const ordenCount = await OrdenServicio.count();
    if (ordenCount === 0) {
      // Orden 1: TRANSPORTE SAN LUIS DE LARA, C.A.
      const demoOrder1 = await OrdenServicio.create({
        id: 'OS-2026-00101',
        tenantId: comp1 ? comp1.id : '11111111-1111-1111-1111-111111111111',
        placa: 'A12BC3D',
        km: 184320,
        recibidoPor: 'Ing. Carlos Mendoza',
        entregadoPor: 'Luis Márquez (Operador)',
        sintomas: 'Ruido metálico al frenar y vibración en el volante sobre 60 km/h.',
        fotosCount: 1,
        esReincidencia: true,
        osAnterior: 'OS-2026-00089',
        motivoReincidencia: 'Falla distinta, misma área',
        estado: 'En Proceso',
        fechaApertura: new Date(),
        totalRepuestos: 82.00,
        totalManoObra: 36.00,
        totalExternos: 0.00,
        totalGeneral: 118.00,
      });

      const demoArea1 = await OrdenArea.create({
        id: 'OT-A1',
        ordenId: demoOrder1.id,
        area: 'Reparaciones mayores',
        fechaRecepcion: new Date(),
        mecanico: 'José Ramírez',
        diagnostico: 'Desgaste severo en discos delanteros y holgura en terminales.',
        horas: 2,
        tarifaHora: 18,
        costoManoObra: 36.00,
        estado: 'abierta',
      });

      await SolicitudRepuesto.create({
        ordenId: demoOrder1.id,
        otId: demoArea1.id,
        cod: 'FRE-0234',
        desc: 'Disco de freno delantero',
        cant: 1,
        costoUnitario: 82.00,
        costoTotal: 82.00,
        stockActual: 6,
        motivo: 'Reemplazo preventivo por alabeo excesivo.',
        estadoAprobacion: 'Pendiente',
        estadoEntrega: 'Por entregar',
        almacen: 'TLL-01',
        requiereEscalamiento: false,
      });

      // Orden 2: SAN LUIS TRANSPORTE, C.A.
      const demoOrder2 = await OrdenServicio.create({
        id: 'OS-2026-00201',
        tenantId: comp2 ? comp2.id : '22222222-2222-2222-2222-222222222222',
        placa: 'B77XY9Z',
        km: 96540,
        recibidoPor: 'Ing. Carlos Mendoza',
        entregadoPor: 'Marcos Rivas (Operador Agro)',
        sintomas: 'Mantenimiento preventivo 100,000 km y sustitución de filtros de combustible y aceite.',
        fotosCount: 0,
        esReincidencia: false,
        estado: 'Abierta',
        fechaApertura: new Date(),
        totalRepuestos: 36.90,
        totalManoObra: 25.00,
        totalExternos: 0.00,
        totalGeneral: 61.90,
      });

      const demoArea2 = await OrdenArea.create({
        id: 'OT-B1',
        ordenId: demoOrder2.id,
        area: 'Mantenimiento Preventivo',
        fechaRecepcion: new Date(),
        mecanico: 'José Ramírez',
        diagnostico: 'Revisión periódica de fluidos, correas y filtros.',
        horas: 1.5,
        tarifaHora: 18,
        costoManoObra: 27.00,
        estado: 'abierta',
      });

      await SolicitudRepuesto.create({
        ordenId: demoOrder2.id,
        otId: demoArea2.id,
        cod: 'FIL-0112',
        desc: 'Filtro de aceite',
        cant: 1,
        costoUnitario: 12.40,
        costoTotal: 12.40,
        stockActual: 2,
        motivo: 'Mantenimiento preventivo periódico.',
        estadoAprobacion: 'Aprobada',
        estadoEntrega: 'Por entregar',
        almacen: 'TLL-01',
        requiereEscalamiento: false,
      });

            
      // Semilla inicial de Auditoría y Trazabilidad para OS-2026-00101
      await OrdenAuditLog.bulkCreate([
        {
          ordenId: demoOrder1.id,
          otId: demoArea1.id,
          userName: 'José Ramírez',
          userEmail: 'mecanico@empresasanluis.com',
          userRole: 'MECANICO',
          action: 'SOLICITUD_REPUESTO',
          fieldName: 'FRE-0234',
          newValue: '1 unidad ($82.00)',
          description: `Solicitud de 1 unidad del repuesto FRE-0234 (Disco de freno delantero) por alabeo excesivo.`,
          ipAddress: '192.168.1.102',
        },
      ]);

      logger.info('[Seed] Órdenes de Servicio y Bitácoras de Auditoría inicializadas para todas las empresas.');
    }

    // 8. Semilla de Conexión de Base de Datos MSSQL Profit Plus (AD_TRANS)
    const connCount = await DatabaseConnection.count();
    if (connCount === 0) {
      await DatabaseConnection.create({
        id: '99999999-9999-9999-9999-999999999999',
        nombre: 'Servidor Profit Plus Producción (AD_TRANS)',
        host: process.env.PROFIT_DB_HOST || 'SRVBDPROFITBK',
        port: parseInt(process.env.PROFIT_DB_PORT || '1433', 10),
        databaseName: process.env.PROFIT_DB_NAME || 'AD_TRANS',
        username: process.env.PROFIT_DB_USER || 'solicitudweb',
        password: process.env.PROFIT_DB_PASSWORD || 'solicitudweb',
        dialect: (process.env.PROFIT_DB_DIALECT || 'mssql').toLowerCase(),
        trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE !== 'false',
        encrypt: false,
        isDefault: true,
        isActive: true,
        status: 'CONNECTED',
        lastTestedAt: new Date(),
        options: {
          connectTimeout: 5000,
          requestTimeout: 15000,
          pool: { max: 10, min: 0 },
        },
      });
      logger.info('[Seed] Conexión predeterminada MSSQL Profit Plus (AD_TRANS) registrada en SQLite.');
    }

    // 9. Semilla de Matriz de Permisos por Rol (RBAC)
    const permCount = await RolePermission.count();
    if (permCount === 0) {
      const defaultRolePerms = [
        // ADMIN (Acceso Total)
        { role: 'ADMIN', module: 'taller', actions: ['read', 'create', 'update', 'delete', 'approve', 'admin'], description: 'Control total de órdenes de taller' },
        { role: 'ADMIN', module: 'fleet', actions: ['read', 'create', 'update', 'delete', 'admin'], description: 'Control total del maestro de flota' },
        { role: 'ADMIN', module: 'almacen', actions: ['read', 'create', 'update', 'delete', 'dispatch', 'admin'], description: 'Control total de almacén e inventario' },
        { role: 'ADMIN', module: 'aprobaciones', actions: ['read', 'approve', 'reject', 'admin'], description: 'Aprobación y autorización de órdenes y gastos' },
        { role: 'ADMIN', module: 'users', actions: ['read', 'create', 'update', 'delete', 'admin'], description: 'Gestión global de usuarios y membresías' },
        { role: 'ADMIN', module: 'permissions', actions: ['read', 'update', 'admin'], description: 'Administración de la matriz de roles y permisos' },
        { role: 'ADMIN', module: 'db_connections', actions: ['read', 'create', 'update', 'delete', 'test', 'admin'], description: 'Gestión y prueba de conexiones de bases de datos MSSQL/SQLite' },
        { role: 'ADMIN', module: 'query_runner', actions: ['read', 'execute_query', 'admin'], description: 'Ejecución de consultas SQL directas a Profit Plus MSSQL' },
        { role: 'ADMIN', module: 'reports', actions: ['read', 'export', 'admin'], description: 'Auditoría y reportes financieros consolidados' },

        // GERENTE_TALLER
        { role: 'GERENTE_TALLER', module: 'taller', actions: ['read', 'create', 'update', 'delete', 'approve'], description: 'Gestión operativa de taller' },
        { role: 'GERENTE_TALLER', module: 'fleet', actions: ['read', 'create', 'update'], description: 'Consulta y actualización de flota' },
        { role: 'GERENTE_TALLER', module: 'almacen', actions: ['read', 'create'], description: 'Consulta de repuestos y solicitudes' },
        { role: 'GERENTE_TALLER', module: 'aprobaciones', actions: ['read', 'approve', 'reject'], description: 'Aprobación de repuestos y servicios externos' },
        { role: 'GERENTE_TALLER', module: 'reports', actions: ['read', 'export'], description: 'Reportes de taller' },

        // SUPERVISOR
        { role: 'SUPERVISOR', module: 'taller', actions: ['read', 'create', 'update', 'approve'], description: 'Supervisión y aprobación de órdenes' },
        { role: 'SUPERVISOR', module: 'fleet', actions: ['read', 'update'], description: 'Seguimiento de flota' },
        { role: 'SUPERVISOR', module: 'almacen', actions: ['read', 'create'], description: 'Solicitud de insumos' },
        { role: 'SUPERVISOR', module: 'aprobaciones', actions: ['read', 'approve'], description: 'Validación de diagnósticos' },

        // RESPONSABLE_FLOTA
        { role: 'RESPONSABLE_FLOTA', module: 'fleet', actions: ['read', 'create', 'update'], description: 'Administración de flota y kilometrajes' },
        { role: 'RESPONSABLE_FLOTA', module: 'taller', actions: ['read', 'create'], description: 'Apertura de órdenes y reporte de síntomas' },
        { role: 'RESPONSABLE_FLOTA', module: 'reports', actions: ['read'], description: 'Informes de disponibilidad' },

        // MECANICO
        { role: 'MECANICO', module: 'taller', actions: ['read', 'update'], description: 'Diagnóstico y registro de mano de obra en áreas' },
        { role: 'MECANICO', module: 'almacen', actions: ['read', 'create'], description: 'Solicitud de repuestos necesarios' },
        { role: 'MECANICO', module: 'fleet', actions: ['read'], description: 'Consulta de fichas técnicas' },

        // ALMACENISTA
        { role: 'ALMACENISTA', module: 'almacen', actions: ['read', 'create', 'update', 'dispatch'], description: 'Despacho y entrega de repuestos' },
        { role: 'ALMACENISTA', module: 'taller', actions: ['read'], description: 'Consulta de órdenes para despacho' },
        { role: 'ALMACENISTA', module: 'reports', actions: ['read'], description: 'Kárdex e inventario' },

        // SOLICITANTE
        { role: 'SOLICITANTE', module: 'taller', actions: ['read', 'create'], description: 'Solicitud y apertura de servicios' },
        { role: 'SOLICITANTE', module: 'fleet', actions: ['read'], description: 'Consulta de vehículos' },

        // AUDITOR
        { role: 'AUDITOR', module: 'taller', actions: ['read'], description: 'Auditoría de órdenes' },
        { role: 'AUDITOR', module: 'fleet', actions: ['read'], description: 'Auditoría de flota' },
        { role: 'AUDITOR', module: 'almacen', actions: ['read'], description: 'Auditoría de inventario' },
        { role: 'AUDITOR', module: 'aprobaciones', actions: ['read'], description: 'Trazabilidad de aprobaciones' },
        { role: 'AUDITOR', module: 'reports', actions: ['read', 'export'], description: 'Exportación de reportes de auditoría' },

        // OPERADOR
        { role: 'OPERADOR', module: 'taller', actions: ['read'], description: 'Visualización de estatus de órdenes' },
        { role: 'OPERADOR', module: 'fleet', actions: ['read'], description: 'Consulta básica de unidad' },
      ];

      for (const p of defaultRolePerms) {
        await RolePermission.create(p);
      }
      logger.info(`[Seed] Matriz RBAC inicializada con ${defaultRolePerms.length} reglas de permisos por rol.`);
    }

    logger.info('[Seed] Inicialización de base de datos completada satisfactoriamente.');
  } catch (error) {
    logger.error('[Seed] Error al inicializar datos:', error);
  }
};
