import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, Company, UserCompany, FlotaVehicular, CatalogoRepuesto, OrdenServicio, OrdenArea, SolicitudRepuesto, SolicitudExterno } from '../models';
import { OrdenController } from '../controllers/orden.controller';
import { ErpService } from '../services/erp.service';
import { EmailService } from '../services/email.service';
import { PushService } from '../services/push.service';
import { MultiAgentOrchestrator } from '../agents/orchestrator.agent';
import { logger } from '../utils/logger';

export interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  durationMs: number;
  error?: string;
}

export async function runAllUnitTests(): Promise<{ total: number; passed: number; failed: number; results: TestResult[] }> {
  const results: TestResult[] = [];

  const runTest = async (suite: string, name: string, fn: () => Promise<void>) => {
    const start = Date.now();
    try {
      await fn();
      results.push({ suite, name, passed: true, durationMs: Date.now() - start });
      logger.info(`  ✅ [PASS] ${suite} -> ${name} (${Date.now() - start}ms)`);
    } catch (err: any) {
      results.push({ suite, name, passed: false, durationMs: Date.now() - start, error: err.message });
      logger.error(`  ❌ [FAIL] ${suite} -> ${name}: ${err.message}`);
    }
  };

  logger.info('=====================================================');
  logger.info('🚀 INICIANDO SUITE DE PRUEBAS UNITARIAS SAN LUIS');
  logger.info('=====================================================');

  // SUITE 1: Autenticación y Seguridad
  await runTest('Seguridad & Criptografía', 'Debe hashear contraseñas con bcrypt y validarlas', async () => {
    const password = 'SecretPassword2026!';
    const hash = await bcrypt.hash(password, 10);
    const isValid = await bcrypt.compare(password, hash);
    const isInvalid = await bcrypt.compare('WrongPassword', hash);

    if (!isValid || isInvalid) {
      throw new Error('Validación de hash bcrypt falló');
    }
  });

  await runTest('Seguridad & JWT', 'Debe firmar y verificar tokens JWT con expiración', async () => {
    const secret = 'test-secret';
    const payload = { userId: 'user-123', email: 'test@sanluis.com', type: 'FULL_AUTH' };
    const token = jwt.sign(payload, secret, { expiresIn: '1h' });
    const decoded: any = jwt.verify(token, secret);

    if (decoded.userId !== payload.userId || decoded.type !== 'FULL_AUTH') {
      throw new Error('Decodificación de JWT no coincide con el payload original');
    }
  });

  // SUITE 2: Maestro de Flota y Reincidencias
  await runTest('Flota Vehicular', 'Debe identificar unidad y detectar historial de reincidencia para A12BC3D', async () => {
    const unidad = await FlotaVehicular.findOne({ where: { placa: 'A12BC3D' } });
    if (!unidad) {
      throw new Error('Unidad A12BC3D no encontrada en base de datos');
    }
    if (unidad.historialOsAnterior !== 'OS-2026-00089') {
      throw new Error(`Historial de reincidencia esperado OS-2026-00089, obtenido: ${unidad.historialOsAnterior}`);
    }
  });

  // SUITE 3: Catálogo y Tarifas de Mano de Obra
  await runTest('Catálogo de Repuestos', 'Debe verificar existencias y costos de repuestos de frenos', async () => {
    const disco = await CatalogoRepuesto.findOne({ where: { cod: 'FRE-0234' } });
    if (!disco || Number(disco.costo) !== 82.00) {
      throw new Error('Artículo FRE-0234 no tiene el costo de 82.00');
    }
  });

  // SUITE 4: Liquidación y Validaciones de Cierre
  await runTest('Liquidación de Taller', 'Debe calcular correctamente la liquidación con repuestos y mano de obra', async () => {
    const dummyOrder = {
      sintomas: 'Falla frenos',
      solicitudesRepuesto: [
        { estadoAprobacion: 'Aprobada', costoTotal: 82.00, estadoEntrega: 'Entregado' },
        { estadoAprobacion: 'Rechazada', costoTotal: 164.00, estadoEntrega: 'Por entregar' },
      ],
      ordenesArea: [
        { estado: 'cerrada', horas: 2, costoManoObra: 36.00, diagnostico: 'Discos cambiados' },
      ],
      solicitudesExterno: [
        { estadoAprobacion: 'Aprobada', conGarantia: false, costoEfectivo: 45.00 },
        { estadoAprobacion: 'Aprobada', conGarantia: true, costoEfectivo: 0.00 },
      ],
    };

    const totales = OrdenController.calculateTotals(dummyOrder);
    // Repuestos aprobados: 82.00 | Mano de obra: 36.00 | Externos: 45.00 -> Total: 163.00
    if (totales.totalRepuestos !== 82.00) throw new Error(`Total repuestos esperado 82.00, obtenido ${totales.totalRepuestos}`);
    if (totales.totalManoObra !== 36.00) throw new Error(`Total mano obra esperado 36.00, obtenido ${totales.totalManoObra}`);
    if (totales.totalExternos !== 45.00) throw new Error(`Total externos esperado 45.00, obtenido ${totales.totalExternos}`);
    if (totales.totalGeneral !== 163.00) throw new Error(`Total general esperado 163.00, obtenido ${totales.totalGeneral}`);
  });

  await runTest('Reglas de Negocio', 'Debe bloquear el cierre de orden si existen órdenes de área abiertas', async () => {
    const dummyOrder = {
      sintomas: 'Falla frenos',
      solicitudesRepuesto: [],
      ordenesArea: [{ id: 'OT-A1', estado: 'abierta', horas: 2, diagnostico: 'En proceso' }],
      solicitudesExterno: [],
    };
    const unidad = { placa: 'A12BC3D' };
    const validacion = OrdenController.validateCierre(dummyOrder, unidad);

    if (validacion.puedeCerrar) {
      throw new Error('La validación debió bloquear el cierre con orden de área abierta');
    }
  });

  // SUITE 5: Servicios y ERP
  await runTest('Integración ERP Profit', 'Debe generar número de ajuste AJS y requisición REQ', async () => {
    const ajs = await ErpService.generateInventoryAdjustment('FRE-0234', 2, 'OS-2026-TEST');
    const req = await ErpService.generatePurchaseRequisition('ROD-0087', 1, 'OS-2026-TEST');

    if (!ajs.startsWith('AJS-') || !req.startsWith('REQ-COM-')) {
      throw new Error('Los códigos de movimiento ERP no cumplen el formato esperado');
    }
  });

  // SUITE 6: Notificaciones
  await runTest('Servicio de Notificaciones', 'Debe registrar notificación transaccional en base de datos', async () => {
    const resEmail = await EmailService.sendEmail({
      to: 'test@empresasanluis.com',
      subject: 'Prueba de Suite Automatizada',
      htmlContent: '<p>Verificación de email</p>',
    });

    const resPush = await PushService.sendPush({
      title: 'Prueba Push',
      body: 'Notificación de prueba',
    });

    if (!resEmail.success || !resPush.success) {
      throw new Error('Fallo en el servicio de notificaciones');
    }
  });

  // SUITE 7: Motor Multiagente de IA
  await runTest('Motor Multiagente IA', 'Debe responder consultas con el agente especialista correspondiente', async () => {
    const result = await MultiAgentOrchestrator.processRequest('Revisión de pastillas de freno en camión', 'fleet');
    if (!result.response || !result.agent.includes('Flota')) {
      throw new Error('El orquestador no devolvió una respuesta válida de especialista en flota');
    }
  });

  // SUITE 8: Conexión y CRUD MSSQL Profit Plus (AD_TRANS)
  await runTest('Profit MSSQL AD_TRANS', 'Debe validar conexión y realizar CRUD en flota_ordenes_servicio', async () => {
    const { FlotaOrdenServicioProfit } = await import('../models');
    const { getProfitConnectionStatus, initProfitDatabase } = await import('../config/profitDb');

    // 1. Validar conexión (o activar fallback local si no hay red a SRVBDPROFITBK)
    let status = await getProfitConnectionStatus();
    if (!status.connected) {
      await initProfitDatabase();
      status = await getProfitConnectionStatus();
    }
    if (!status.database) {
      throw new Error('No se pudo verificar la configuración de base de datos AD_TRANS');
    }

    // 2. Sincronizar y crear orden de prueba
    await FlotaOrdenServicioProfit.sync();
    const testNro = `TEST-OS-${Date.now().toString().slice(-6)}`;
    const created = await FlotaOrdenServicioProfit.create({
      nro_orden: testNro,
      Placa: 'TEST-999',
      km_horometro: 120500.0,
      recibido_por: 'Supervisor Prueba',
      sintomas_reportados: 'Prueba unitaria de persistencia en AD_TRANS',
      estatus: 'ABIERTA',
      costo_repuestos: 100.0,
      costo_mano_obra: 50.0,
      costo_servicios_ext: 25.0,
      costo_total: 175.0,
    });

    if (!created.nro_orden || created.nro_orden !== testNro) {
      throw new Error('Fallo al crear orden en flota_ordenes_servicio');
    }

    // 3. Buscar y actualizar
    const found = await FlotaOrdenServicioProfit.findOne({ where: { nro_orden: testNro } });
    if (!found) {
      throw new Error('No se encontró la orden creada en AD_TRANS');
    }

    await found.update({ estatus: 'CERRADA', costo_total: 180.0 });

    // 4. Limpiar registro de prueba
    await found.destroy();
  });

  // SUITE 9: Acceso Global Multi-Tenant del Rol ADMIN a Cualquier Empresa
  await runTest('Multi-Tenant Rol ADMIN', 'El rol ADMIN debe listar y acceder a cualquier empresa sin restricciones de asignación', async () => {
    const { User, Company, UserCompany } = await import('../models');
    const { AuthController } = await import('../controllers/auth.controller');

    // 1. Obtener usuario admin y empresas existentes
    const adminUser = await User.findOne({ where: { role: 'ADMIN', isActive: true } });
    if (!adminUser) throw new Error('Usuario ADMIN no encontrado para prueba');

    const allCompanies = await Company.findAll({ where: { isActive: true } });
    if (allCompanies.length === 0) throw new Error('No hay empresas activas');

    // 2. Simular Login de ADMIN
    const reqLogin: any = { body: { email: adminUser.email, password: 'Password123!' } };
    let loginResponseData: any = null;
    const resLogin: any = {
      status: () => resLogin,
      json: (data: any) => {
        loginResponseData = data;
        return resLogin;
      },
    };

    await AuthController.login(reqLogin, resLogin);
    if (!loginResponseData?.success || !loginResponseData?.companies) {
      throw new Error('Fallo en login de ADMIN');
    }

    if (loginResponseData.companies.length !== allCompanies.length) {
      throw new Error(`ADMIN debe recibir las ${allCompanies.length} empresas activas, pero recibió ${loginResponseData.companies.length}`);
    }

    // 3. Probar selección de empresa con el token pre-auth para la última empresa
    const targetComp = allCompanies[allCompanies.length - 1];
    const reqSelect: any = {
      body: { companyId: targetComp.id },
      user: { userId: adminUser.id, email: adminUser.email, role: 'ADMIN', type: 'PRE_AUTH' },
    };
    let selectResponseData: any = null;
    const resSelect: any = {
      status: () => resSelect,
      json: (data: any) => {
        selectResponseData = data;
        return resSelect;
      },
    };

    await AuthController.selectCompany(reqSelect, resSelect);
    if (!selectResponseData?.success || selectResponseData?.activeCompany?.id !== targetComp.id) {
      throw new Error('ADMIN no pudo seleccionar y acceder a la empresa solicitada');
    }
  });

  // SUITE 9: Integración Profit Plus MSSQL (AD_TRANS) - Vendedores y Artículos
  await runTest('Profit Plus [AD_TRANS]', 'Debe consultar y filtrar vista vw_flota_vendedores con paginación', async () => {
    const { ProfitFlotaController } = await import('../controllers/profitFlota.controller');

    const req: any = {
      query: {
        page: '1',
        limit: '5',
        search: 'Carlos',
      },
    };
    let responseData: any = null;
    const res: any = {
      status: () => res,
      json: (data: any) => {
        responseData = data;
        return res;
      },
    };

    await ProfitFlotaController.getVendedores(req, res);

    if (!responseData?.success || !Array.isArray(responseData?.data)) {
      throw new Error('Endpoint getVendedores no retornó una respuesta válida');
    }
    if (responseData.data.length > 0) {
      const first = responseData.data[0];
      if (!first.co_ven || !first.ven_des) {
        throw new Error('El registro de vendedor no contiene co_ven o ven_des');
      }
    }
  });

  await runTest('Profit Plus [AD_TRANS]', 'Debe consultar y filtrar vista vw_flota_articulos con múltiples filtros de stock y almacén', async () => {
    const { ProfitFlotaController } = await import('../controllers/profitFlota.controller');

    const req: any = {
      query: {
        page: '1',
        limit: '10',
        con_stock: 'true',
        codigo_categoria: 'FRE',
      },
    };
    let responseData: any = null;
    const res: any = {
      status: () => res,
      json: (data: any) => {
        responseData = data;
        return res;
      },
    };

    await ProfitFlotaController.getArticulos(req, res);

    if (!responseData?.success || !Array.isArray(responseData?.data)) {
      throw new Error('Endpoint getArticulos no retornó una respuesta válida');
    }
    if (responseData.data.length > 0) {
      const first = responseData.data[0];
      if (!first.codigo_profit || !first.nombre_producto || first.costo === undefined || first.stock_act === undefined) {
        throw new Error('El artículo no contiene los campos obligatorios de la vista');
      }
    }
  });

  await runTest('Profit Plus [AD_TRANS]', 'Debe consultar y filtrar tabla ad_trans.dbo.mecanicos (SELECT codigo,nombre,cargo,activo)', async () => {
    const { ProfitFlotaController } = await import('../controllers/profitFlota.controller');

    const req: any = {
      query: {
        page: '1',
        limit: '10',
        activo: 'true',
        sortBy: 'nombre',
        sortOrder: 'ASC',
      },
    };
    let responseData: any = null;
    const res: any = {
      status: () => res,
      json: (data: any) => {
        responseData = data;
        return res;
      },
    };

    await ProfitFlotaController.getMecanicos(req, res);

    if (!responseData?.success || !Array.isArray(responseData?.data)) {
      throw new Error('Endpoint getMecanicos no retornó una respuesta válida');
    }
    if (responseData.data.length === 0) {
      throw new Error('No se encontraron mecánicos en ad_trans.dbo.mecanicos');
    }
    const first = responseData.data[0];
    if (!first.codigo || !first.nombre || first.activo === undefined) {
      throw new Error('El registro de mecánico no contiene codigo, nombre o activo');
    }
  });

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  logger.info('=====================================================');
  logger.info(`📊 RESULTADO FINAL: ${passed}/${results.length} PRUEBAS SUPERADAS (${failed} fallos)`);
  logger.info('=====================================================');

  return { total: results.length, passed, failed, results };
}
