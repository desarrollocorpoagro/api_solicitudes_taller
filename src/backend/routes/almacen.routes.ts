import { Router } from 'express';
import { AlmacenController } from '../controllers/almacen.controller';
import { validateJoi } from '../middlewares/validate.middleware';
import { despachoAlmacenSchema } from '../validations/schemas';

const router = Router();

router.get('/despachos', AlmacenController.getDespachosPendientes);
router.post('/despachos/:id', validateJoi(despachoAlmacenSchema), AlmacenController.confirmarDespacho);

export default router;
