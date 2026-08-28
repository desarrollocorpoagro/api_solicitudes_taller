import { Router } from 'express';
import { DbConnectionController } from '../controllers/dbConnection.controller';
import { authenticateToken, requireRoles } from '../middlewares/auth.middleware';

const router = Router();

// Todas las rutas de gestión de conexiones y ejecución de queries están protegidas para el rol ADMIN
router.use(authenticateToken('FULL_AUTH'));
router.use(requireRoles(['ADMIN']));

/**
 * @route GET /api/v1/db-connections
 * @desc Listado paginado de conexiones de base de datos registradas en SQLite
 */
router.get('/', DbConnectionController.getAllConnections);

/**
 * @route GET /api/v1/db-connections/:id
 * @desc Detalle de una conexión por ID
 */
router.get('/:id', DbConnectionController.getConnectionById);

/**
 * @route POST /api/v1/db-connections
 * @desc Crear nueva conexión a base de datos (MSSQL / SQLite / Postgres)
 */
router.post('/', DbConnectionController.createConnection);

/**
 * @route PUT /api/v1/db-connections/:id
 * @desc Actualizar parámetros de conexión existente
 */
router.put('/:id', DbConnectionController.updateConnection);

/**
 * @route DELETE /api/v1/db-connections/:id
 * @desc Eliminar configuración de conexión
 */
router.delete('/:id', DbConnectionController.deleteConnection);

/**
 * @route POST /api/v1/db-connections/:id/test
 * @desc Probar conexión específica y calcular latencia en vivo
 */
router.post('/:id/test', DbConnectionController.testConnection);

/**
 * @route POST /api/v1/db-connections/test-adhoc
 * @desc Probar credenciales sin guardar
 */
router.post('/test-adhoc', DbConnectionController.testConnection);

/**
 * @route POST /api/v1/db-connections/execute-query
 * @desc Ejecutar consulta SQL directa (ej. SELECT ... FROM [AD_TRANS].[dbo].[vw_flota_articulos])
 */
router.post('/execute-query', DbConnectionController.executeQuery);

export default router;
