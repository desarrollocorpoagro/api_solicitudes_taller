import { Router } from 'express';
import { RolePermissionController } from '../controllers/rolePermission.controller';
import { authenticateToken, requireRoles } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticateToken('FULL_AUTH'));
router.use(requireRoles(['ADMIN']));

/**
 * @route GET /api/v1/roles-permissions
 * @desc Matriz paginada de permisos por roles
 */
router.get('/', RolePermissionController.getAllRolePermissions);

/**
 * @route GET /api/v1/roles-permissions/role/:role
 * @desc Permisos de un rol específico
 */
router.get('/role/:role', RolePermissionController.getPermissionsByRole);

/**
 * @route PUT /api/v1/roles-permissions/role/:role
 * @desc Actualizar en lote los permisos de un rol
 */
router.put('/role/:role', RolePermissionController.bulkUpdateRole);

/**
 * @route PUT /api/v1/roles-permissions/role/:role/module
 * @desc Actualizar permisos de un rol para un módulo individual
 */
router.put('/role/:role/module', RolePermissionController.updateRolePermissions);

/**
 * @route GET /api/v1/roles-permissions/user/:userId
 * @desc Permisos y excepciones personalizadas por usuario
 */
router.get('/user/:userId', RolePermissionController.getUserPermissions);

/**
 * @route PUT /api/v1/roles-permissions/user/:userId
 * @desc Guardar excepciones de permisos para un usuario
 */
router.put('/user/:userId', RolePermissionController.updateUserPermissions);

export default router;
