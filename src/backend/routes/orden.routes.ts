import { Router } from 'express';
import { OrdenController } from '../controllers/orden.controller';
import { OrdenAreaController } from '../controllers/ordenArea.controller';
import { RepuestosController } from '../controllers/repuestos.controller';
import { ExternosController } from '../controllers/externos.controller';
import { validateJoi } from '../middlewares/validate.middleware';
import {
  createOrdenServicioSchema,
  cerrarOrdenServicioSchema,
  createOrdenAreaSchema,
  updateOrdenAreaSchema,
  createSolicitudRepuestoSchema,
  createSolicitudExternoSchema,
} from '../validations/schemas';

const router = Router();

// 1. Órdenes Principales
router.post('/', validateJoi(createOrdenServicioSchema), OrdenController.createOrden);
router.get('/', OrdenController.getAllOrdenes);
router.get('/:id', OrdenController.getOrdenById);
router.post('/:id/cerrar', validateJoi(cerrarOrdenServicioSchema), OrdenController.cerrarOrden);

// 2. Órdenes de Área (OT)
router.post('/:id/areas', validateJoi(createOrdenAreaSchema), OrdenAreaController.createArea);
router.put('/:id/areas/:otId', validateJoi(updateOrdenAreaSchema), OrdenAreaController.updateArea);
router.delete('/:id/areas/:otId', OrdenAreaController.deleteArea);

// 3. Solicitudes de Repuesto
router.post('/:id/repuestos', validateJoi(createSolicitudRepuestoSchema), RepuestosController.createSolicitud);
router.delete('/:id/repuestos/:repId', RepuestosController.deleteSolicitud);

// 4. Solicitudes de Servicio Externo
router.post('/:id/externos', validateJoi(createSolicitudExternoSchema), ExternosController.createSolicitud);
router.delete('/:id/externos/:extId', ExternosController.deleteSolicitud);

export default router;
