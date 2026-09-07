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
import { initGastoModel, Gasto } from './Gasto.model';
import { profitSequelize, profitMirrorSequelize, initProfitDatabase, getProfitConnectionStatus } from '../config/profitDb';
import { logger } from '../utils/logger';
// (los hooks de gastos están definidos más abajo en este archivo; importan
// ensureLocalGasto* desde '../services/gastos.service' por su cuenta.)

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
  Gasto,
};

// Inicializar el modelo Gasto contra la base local y garantizar su tabla.
initGastoModel(sequelize);

// ─── Hooks transaccionales para captura de gastos ───────────────────────────
//
// Cada SolicitudRepuesto nueva genera un Gasto local (tipo_origen='REPUESTO').
// Cada SolicitudExterno aprobada genera un Gasto local (tipo_origen='EXTERNO').
// Cada OrdenArea con horas registradas genera un Gasto local (tipo_origen='AREA').
//
// Los hooks afterUpdate se disparan cuando cambia el estado funcional
// (aprobación, despacho, horas, etc.) y vuelven a llamar a la función
// ensureLocalGasto* que es IDEMPOTENTE: actualiza el monto en el mismo
// registro (misma idempotency_key) y lo marca PENDIENTE para reintento
// de sincronización con MSSQL.

import {
  ensureLocalGastoForSolicitud,
  ensureLocalGastoForExterno,
  ensureLocalGastoForArea,
} from '../services/gastos.service';

SolicitudRepuesto.afterCreate(async (solicitud, _options) => {
  try {
    await ensureLocalGastoForSolicitud(solicitud);
  } catch (err: any) {
    logger.warn(`[GastosHook] No se pudo crear gasto para solicitud ${solicitud.id}: ${err.message}`);
  }
});

SolicitudRepuesto.afterUpdate(async (solicitud, _options) => {
  try {
    // Si cambió estadoAprobacion a 'Aprobada' o estadoEntrega a 'Entregado',
    // refrescar el gasto local. ensureLocalGasto* es idempotente.
    if (
      solicitud.changed('estadoAprobacion') ||
      solicitud.changed('estadoEntrega') ||
      solicitud.changed('costoUnitario') ||
      solicitud.changed('cant')
    ) {
      await ensureLocalGastoForSolicitud(solicitud);
    }
  } catch (err: any) {
    logger.warn(`[GastosHook] No se pudo refrescar gasto para solicitud ${solicitud.id}: ${err.message}`);
  }
});

SolicitudExterno.afterCreate(async (solicitud, _options) => {
  // Sólo creamos gasto al aprobarse, no al crearse la solicitud.
  // Pero dejamos el hook para registrar un placeholder si el usuario lo
  // requiere en el futuro. Por ahora, sólo logueamos.
  logger.debug(`[GastosHook] SolicitudExterno ${solicitud.id} creada (gasto se crea al aprobar).`);
});

SolicitudExterno.afterUpdate(async (solicitud, _options) => {
  try {
    if (
      solicitud.changed('estadoAprobacion') ||
      solicitud.changed('costoEfectivo') ||
      solicitud.changed('costoCotizado')
    ) {
      if (solicitud.estadoAprobacion === 'Aprobada') {
        await ensureLocalGastoForExterno(solicitud);
      }
    }
  } catch (err: any) {
    logger.warn(`[GastosHook] No se pudo crear gasto externo para solicitud ${solicitud.id}: ${err.message}`);
  }
});

OrdenArea.afterCreate(async (area, _options) => {
  try {
    if (Number(area.horas ?? 0) > 0) {
      await ensureLocalGastoForArea(area);
    }
  } catch (err: any) {
    logger.warn(`[GastosHook] No se pudo crear gasto de área ${area.id}: ${err.message}`);
  }
});

OrdenArea.afterUpdate(async (area, _options) => {
  try {
    if (
      area.changed('horas') ||
      area.changed('tarifaHora') ||
      area.changed('costoManoObra') ||
      area.changed('estado')
    ) {
      // Si cambia el estado a 'cerrada', el siguiente ciclo del sync ya
      // no replicará porque la consulta a OrdenServicio devolverá 'Cerrada'.
      // No eliminamos el gasto histórico (mantiene auditoría).
      if (area.estado === 'cerrada' && Number(area.horas ?? 0) > 0) {
        await ensureLocalGastoForArea(area);
      } else if (Number(area.horas ?? 0) > 0) {
        await ensureLocalGastoForArea(area);
      }
    }
  } catch (err: any) {
    logger.warn(`[GastosHook] No se pudo refrescar gasto de área ${area.id}: ${err.message}`);
  }
});

/**
 * Copia la matriz de permisos del rol de cada usuario en `user_permissions`,
 * únicamente para aquellos usuarios que aún no tengan overrides propios.
 *
 * - Idempotente: respeta overrides manuales existentes (no los duplica ni sobrescribe).
 * - Seguro: si el rol no tiene reglas o el usuario está inactivo, no falla.
 * - Trazabilidad: marca cada fila con `notes` para distinguir herencia vs override.
 */
export async function seedUserPermissionsFromRoles(): Promise<{ processed: number; created: number; skipped: number }> {
  let processed = 0;
  let created = 0;
  let skipped = 0;

  try {
    const users = await User.findAll();
    for (const user of users) {
      processed++;

      // Si el usuario ya tiene filas en user_permissions, lo dejamos tal cual.
      const existing = await UserPermission.count({ where: { userId: user.id } });
      if (existing > 0) {
        skipped++;
        continue;
      }

      // Cargar la matriz de su rol.
      const rolePerms = await RolePermission.findAll({ where: { role: user.role } });
      if (rolePerms.length === 0) {
        skipped++;
        continue;
      }

      const rows = rolePerms.map((rp) => ({
        userId: user.id,
        module: rp.module,
        actions: rp.actions,
        isGranted: true,
        notes: `Heredado de rol ${user.role} (semilla inicial)`,
      }));

      await UserPermission.bulkCreate(rows);
      created += rows.length;
    }

    logger.info(
      `[Seed] user_permissions poblado por rol: usuarios=${processed} creadas=${created} ya_existían=${skipped}`
    );
  } catch (err: any) {
    logger.error(`[Seed] Error poblando user_permissions desde role_permissions: ${err.message}`);
  }

  return { processed, created, skipped };
}

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
        email: 'contacto@gruposanluis.com',
        phone: '+58 251 2627049',
        isActive: true,
      });

      comp2 = await Company.create({
        id: '22222222-2222-2222-2222-222222222222',
        name: 'SAN LUIS TRANSPORTE, C.A.',
        taxId: 'J-50178032-3',
        email: 'contacto@sanluistrasnporte.com',
        phone: '+58 251 123456',
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
      }      
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
    // La flota principal la sincroniza MasterSyncService desde MSSQL Profit AD_TRANS.
    // Aquí consultamos el espejo SQLite para no tocar la tabla legacy `flota_vehicular`.
    const [flotaMirrorCount]: any = await profitMirrorSequelize.query('SELECT COUNT(*) AS c FROM flota_vehiculos');
    const flotaCount = parseInt(flotaMirrorCount?.[0]?.c ?? '0', 10) || 0;
    if (flotaCount === 0) {     
      logger.info('[Seed] Maestro de Flota Vehicular  limpio y  en espera de sincronizacion  exitosamente para todas las empresas.');
    }

    // 4. Semilla de Catálogo de Repuestos
    //    DECISIÓN: las tablas de dominio operativo (catalogo_repuestos,
    //    ordenes_servicio, ordenes_area, ordenes_servicio_auditoria) se
    //    mantienen VACÍAS por diseño. Deben poblarse únicamente desde MSSQL
    //    Profit Plus vía MasterSyncService o desde la UI (apertura real de
    //    órdenes). Si necesitas datos de prueba, usa scripts/insert-demo-*.cjs
    //    o crea las órdenes desde la pantalla de Apertura. NO reactivar
    //    los bulkCreate comentados a continuación: el seed solo verifica
    //    que estén vacías y registra el estado.
    const repuestoCount = await CatalogoRepuesto.count();
    if (repuestoCount === 0) {
      logger.info('[Seed] catalogo_repuestos: 0 filas (vacía, en espera de sincronización desde MSSQL o de captura manual).');
    } else {
      logger.info(`[Seed] catalogo_repuestos: ${repuestoCount} filas (NO se modifica; poblado por MasterSyncService/UI).`);
    }

    // 5. Semilla de Órdenes de Servicio por Empresa
    //    Política: la tabla NO se repuebla desde el seed. El operador la
    //    puebla desde la UI (botón "Aperturar Nueva Orden") o mediante la
    //    sincronización desde MSSQL. El seed sólo reporta el estado actual
    //    y, si hay órdenes, lista únicamente las que están en estatus
    //    "Cerrada" para visibilidad operativa al arranque.
    const ordenCount = await OrdenServicio.count();
    if (ordenCount === 0) {
      logger.info('[Seed] ordenes_servicio: 0 filas (vacía, en espera de apertura real o sincronización).');
    } else {
      logger.info(`[Seed] ordenes_servicio: ${ordenCount} filas (NO se modifica).`);
      const ordenesCerradas = await OrdenServicio.findAll({
        where: { estado: 'Cerrada' },
        attributes: ['id', 'placa', 'estado', 'fechaEntrega', 'totalGeneral', 'recibeConforme'],
        order: [['fechaEntrega', 'DESC']],
      });
      if (ordenesCerradas.length === 0) {
        logger.info('[Seed] ordenes_servicio (Cerrada): 0 órdenes cerradas registradas.');
      } else {
        logger.info(`[Seed] ordenes_servicio (Cerrada): ${ordenesCerradas.length} órdenes:`);
        for (const o of ordenesCerradas as any[]) {
          const cierre = o.fechaEntrega ? new Date(o.fechaEntrega).toISOString().slice(0, 19).replace('T', ' ') : 'sin fecha';
          const total = Number(o.totalGeneral ?? 0).toFixed(2);
          const conforme = o.recibeConforme ? `recibe: ${o.recibeConforme}` : 'sin recibe';
          logger.info(`[Seed]   • ${o.id} | placa=${o.placa ?? 's/p'} | entrega=${cierre} | total=$${total} | ${conforme}`);
        }
      }
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
        { role: 'ADMIN', module: 'taller', actions: ['read', 'create', 'update', 'delete', 'approve', 'view_costs', 'admin'], description: 'Control total de órdenes de taller y costos de mano de obra' },
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

    // Evolución idempotente: el administrador conserva acceso a costos aunque
    // la matriz RBAC ya existiera antes de agregar la acción específica.
    const adminTallerPermission = await RolePermission.findOne({ where: { role: 'ADMIN', module: 'taller' } });
    if (adminTallerPermission && !adminTallerPermission.actions.includes('view_costs')) {
      adminTallerPermission.actions = [...adminTallerPermission.actions, 'view_costs'];
      await adminTallerPermission.save();
    }

    // 10. Semilla de Permisos Personalizados por Usuario (override layer)
    // Para cada usuario que aún no tenga filas en user_permissions, se copia
    // la matriz de su rol como punto de partida. Los administradores pueden
    // luego ajustar individualmente vía PUT /api/v1/roles-permissions/user/:userId.
    // Esta función es idempotente: si el usuario ya tiene overrides, no los duplica.
    await seedUserPermissionsFromRoles();

    logger.info('[Seed] Inicialización de base de datos completada satisfactoriamente.');
  } catch (error) {
    logger.error('[Seed] Error al inicializar datos:', error);
  }
};
