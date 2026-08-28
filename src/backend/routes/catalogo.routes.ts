import { Router } from 'express';
import { CatalogoController } from '../controllers/catalogo.controller';
import { authenticateToken, requireRoles } from '../middlewares/auth.middleware';

const router = Router();

router.get('/', CatalogoController.getCatalogo);
router.get('/:cod', CatalogoController.getRepuestoByCod);
router.put('/:cod/stock', authenticateToken('FULL_AUTH'), requireRoles(['ADMIN', 'ALMACENISTA', 'GERENTE_TALLER']), CatalogoController.updateStock);

export default router;
