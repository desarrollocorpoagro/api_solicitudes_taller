import { Router } from 'express';
import { OrdenController } from '../controllers/orden.controller';
import { OrdenAreaController } from '../controllers/ordenArea.controller';
import { RepuestosController } from '../controllers/repuestos.controller';
import { ExternosController } from '../controllers/externos.controller';
import { validateJoi } from '../middlewares/validate.middleware';
import { authenticateToken } from '../middlewares/auth.middleware';
import {
  createOrdenServicioSchema,
  cerrarOrdenServicioSchema,
  createOrdenAreaSchema,
  updateOrdenAreaSchema,
  createSolicitudRepuestoSchema,
  createSolicitudExternoSchema,
} from '../validations/schemas';

const router = Router();

// Autenticación obligatoria: todas las rutas de órdenes requieren JWT válido.
// Esto habilita el bypass de tenant para usuarios ADMIN global.
router.use(authenticateToken('FULL_AUTH'));

// 1. Órdenes Principales
router.post('/', validateJoi(createOrdenServicioSchema), OrdenController.createOrden);
router.get('/', OrdenController.getAllOrdenes);
router.get('/:id', OrdenController.getOrdenById);
router.put('/:id', OrdenController.updateOrden);
router.post('/:id/cerrar', validateJoi(cerrarOrdenServicioSchema), OrdenController.cerrarOrden);

// 1.1 Bitácora de Auditoría y Trazabilidad Operativa
router.get('/:id/auditoria', OrdenController.getAuditoriaByOrdenId);
router.post('/:id/auditoria/nota', OrdenController.addManualAuditNote);

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
