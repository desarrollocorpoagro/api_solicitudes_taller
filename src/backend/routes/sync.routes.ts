import { Router } from 'express';
import { SyncController } from '../controllers/sync.controller';
import { authenticateToken } from '../middlewares/auth.middleware';

const router = Router();

// Rutas de sincronización bidireccional offline-first
router.get('/status', SyncController.getStatus);
router.post('/run', authenticateToken, SyncController.triggerSync);
router.get('/queue', authenticateToken, SyncController.getQueue);
router.post('/retry-failed', authenticateToken, SyncController.retryFailed);
router.post('/toggle-offline', authenticateToken, SyncController.toggleSimulatedOffline);

export default router;
