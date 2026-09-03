import { Router } from 'express';
import { RolePermissionController } from '../controllers/rolePermission.controller';
import { authenticateToken, requireRoles } from '../middlewares/auth.middleware';

const router = Router();

// Autenticación obligatoria para TODAS las rutas de este módulo.
router.use(authenticateToken('FULL_AUTH'));

/**
 * @route GET /api/v1/roles-permissions/role/:role
 * @desc Permisos de un rol específico — accesible a cualquier usuario autenticado.
 *       Lo usa el frontend (App.tsx) tras login para filtrar el menú según el rol.
 */
router.get('/role/:role', RolePermissionController.getPermissionsByRole);

/**
 * @route GET /api/v1/roles-permissions/user/:userId
 * @desc Permisos personalizados de un usuario — accesible a cualquier usuario autenticado.
 */
router.get('/user/:userId', RolePermissionController.getUserPermissions);

// Las siguientes rutas requieren rol ADMIN (operaciones de administración global):
router.get('/', requireRoles(['ADMIN']), RolePermissionController.getAllRolePermissions);
router.put('/role/:role', requireRoles(['ADMIN']), RolePermissionController.bulkUpdateRole);
router.put('/role/:role/module', requireRoles(['ADMIN']), RolePermissionController.updateRolePermissions);
router.put('/user/:userId', requireRoles(['ADMIN']), RolePermissionController.updateUserPermissions);

export default router;
