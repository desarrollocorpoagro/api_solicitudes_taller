import { Router } from 'express';
import { AprobacionesController } from '../controllers/aprobaciones.controller';
import { validateJoi } from '../middlewares/validate.middleware';
import { aprobacionActionSchema } from '../validations/schemas';

const router = Router();

router.get('/', AprobacionesController.getBandejaAprobaciones);
router.post('/:tipo/:id', validateJoi(aprobacionActionSchema), AprobacionesController.procesarAprobacion);

export default router;
