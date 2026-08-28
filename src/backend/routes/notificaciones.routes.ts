import { Router } from 'express';
import { NotificacionesController } from '../controllers/notificaciones.controller';
import { validateJoi } from '../middlewares/validate.middleware';
import { createNotificacionSchema } from '../validations/schemas';

const router = Router();

router.get('/', NotificacionesController.getNotificaciones);
router.post('/send', validateJoi(createNotificacionSchema), NotificacionesController.sendNotification);
router.post('/subscribe-push', NotificacionesController.subscribePush);
router.put('/:id/read', NotificacionesController.markAsRead);

export default router;
