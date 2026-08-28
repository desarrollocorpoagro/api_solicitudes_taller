import { Router } from 'express';
import { FlotaController } from '../controllers/flota.controller';

const router = Router();

router.get('/', FlotaController.getAllFlota);
router.get('/:placa', FlotaController.getFlotaByPlaca);
router.post('/scan-qr', FlotaController.scanQR);

export default router;
