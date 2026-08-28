import { Router } from 'express';
import { UserController } from '../controllers/user.controller';
import { validateJoi } from '../middlewares/validate.middleware';
import { createUserSchema, updateUserSchema, assignUserCompanySchema } from '../validations/schemas';
import { authenticateToken, requireRoles } from '../middlewares/auth.middleware';

const router = Router();

// Gestión de usuarios protegida con JWT
router.use(authenticateToken('FULL_AUTH'));

router.get('/', requireRoles(['ADMIN', 'GERENTE_TALLER']), UserController.getAllUsers);
router.get('/:id', UserController.getUserById);
router.post('/', requireRoles(['ADMIN']), validateJoi(createUserSchema), UserController.createUser);
router.put('/:id', requireRoles(['ADMIN']), validateJoi(updateUserSchema), UserController.updateUser);
router.delete('/:id', requireRoles(['ADMIN']), UserController.deleteUser);
router.post('/:id/assign-company', requireRoles(['ADMIN']), validateJoi(assignUserCompanySchema), UserController.assignCompany);

export default router;
