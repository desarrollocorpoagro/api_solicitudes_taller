import { Router } from 'express';
import { authenticateToken } from '../middlewares/auth.middleware';
import { GastosController } from '../controllers/gastos.controller';

const router = Router();

// Endpoints administrativos / operativos para gastos locales.
router.get('/stats', authenticateToken('FULL_AUTH'), GastosController.stats);
router.get('/', authenticateToken('FULL_AUTH'), GastosController.list);
router.post('/backfill', authenticateToken('FULL_AUTH'), GastosController.backfill);
router.post('/sync', authenticateToken('FULL_AUTH'), GastosController.syncToMssql);
router.post('/regenerate/:solicitudId', authenticateToken('FULL_AUTH'), GastosController.regenerateForSolicitud);

export default router;
