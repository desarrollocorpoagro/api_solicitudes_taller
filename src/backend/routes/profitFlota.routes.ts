import { Router } from 'express';
import { ProfitFlotaController } from '../controllers/profitFlota.controller';
import { MasterSyncController } from '../controllers/masterSync.controller';
import { validateJoi } from '../middlewares/validate.middleware';
import {
  createProfitOrdenSchema,
  updateProfitOrdenSchema,
  queryProfitOrdenSchema,
  queryVendedoresSchema,
  queryArticulosSchema,
  queryMecanicosSchema,
} from '../validations/profitFlota.validation';

const router = Router();

/**
 * @route GET /api/v1/profit/conexion/status
 * @desc Comprobar estado de la conexión MSSQL con servidor Profit (SRVBDPROFITBK / AD_TRANS)
 */
router.get('/conexion/status', ProfitFlotaController.testConnection);

/**
 * @route POST /api/v1/profit/sync/master
 * @desc Ejecutar sincronización bidireccional de datos maestros (mecánicos, vendedores, artículos)
 *       entre la BD local y la BD remota MSSQL. Cuenta registros en ambos extremos, compara e
 *       inserta los faltantes en cada lado para mantener consistencia.
 */
router.post('/sync/master', MasterSyncController.runMasterSync);

/**
 * @route GET /api/v1/profit/sync/master/status
 * @desc Estado del motor de sincronización maestra (en ejecución / último reporte).
 */
router.get('/sync/master/status', MasterSyncController.getStatus);

/**
 * @route GET /api/v1/profit/sync/master/last-report
 * @desc Devuelve el último reporte generado por la sincronización bidireccional maestra.
 */
router.get('/sync/master/last-report', MasterSyncController.getLastReport);

/**
 * @route GET /api/v1/profit/vendedores
 * @desc Listado con filtros y paginado de vendedores desde vw_flota_vendedores
 * SELECT [co_ven], [cedula], [ven_des] FROM [AD_TRANS].[dbo].[vw_flota_vendedores]
 */
router.get('/vendedores', validateJoi(queryVendedoresSchema), ProfitFlotaController.getVendedores);

/**
 * @route GET /api/v1/profit/articulos
 * @desc Listado con filtros y paginado de artículos y repuestos desde vw_flota_articulos
 * SELECT [codigo_profit], [nombre_producto], [codigo_categoria], [categoria], [unidad_medida],
 *        [costo], [tipo], [codigo_subalmacen], [sub_almacen], [codigo_almacen], [almacen], [stock_act]
 * FROM [AD_TRANS].[dbo].[vw_flota_articulos]
 */
router.get('/articulos', validateJoi(queryArticulosSchema), ProfitFlotaController.getArticulos);

/**
 * @route GET /api/v1/profit/mecanicos
 * @desc Listado con filtros y paginado de mecánicos desde ad_trans.dbo.mecanicos
 * SELECT [codigo], [nombre], [cargo], [activo] FROM [ad_trans].[dbo].[mecanicos]
 */
router.get('/mecanicos', validateJoi(queryMecanicosSchema), ProfitFlotaController.getMecanicos);

/**
 * @route GET /api/v1/profit/flota-ordenes/stats
 * @desc Obtener métricas y resumen financiero de órdenes en AD_TRANS
 */
router.get('/flota-ordenes/stats', ProfitFlotaController.getEstadisticas);

/**
 * @route GET /api/v1/profit/flota-ordenes
 * @desc Listado paginado de órdenes de servicio en dbo.flota_ordenes_servicio
 */
router.get('/flota-ordenes', validateJoi(queryProfitOrdenSchema), ProfitFlotaController.getAll);

/**
 * @route GET /api/v1/profit/flota-ordenes/:id
 * @desc Obtener orden por id_orden o nro_orden
 */
router.get('/flota-ordenes/:id', ProfitFlotaController.getById);

/**
 * @route POST /api/v1/profit/flota-ordenes
 * @desc Registrar nueva orden de servicio en dbo.flota_ordenes_servicio
 */
router.post('/flota-ordenes', validateJoi(createProfitOrdenSchema), ProfitFlotaController.create);

/**
 * @route PUT /api/v1/profit/flota-ordenes/:id
 * @desc Actualizar orden de servicio en dbo.flota_ordenes_servicio
 */
router.put('/flota-ordenes/:id', validateJoi(updateProfitOrdenSchema), ProfitFlotaController.update);

/**
 * @route DELETE /api/v1/profit/flota-ordenes/:id
 * @desc Eliminar orden de servicio de dbo.flota_ordenes_servicio
 */
router.delete('/flota-ordenes/:id', ProfitFlotaController.delete);

export default router;
