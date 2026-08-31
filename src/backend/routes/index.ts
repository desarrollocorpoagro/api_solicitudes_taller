import { Router } from 'express';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import companyRoutes from './company.routes';
import flotaRoutes from './flota.routes';
import catalogoRoutes from './catalogo.routes';
import ordenRoutes from './orden.routes';
import aprobacionesRoutes from './aprobaciones.routes';
import almacenRoutes from './almacen.routes';
import notificacionesRoutes from './notificaciones.routes';
import multimediaRoutes from './multimedia.routes';
import aiAgentRoutes from './aiAgent.routes';
import profitFlotaRoutes from './profitFlota.routes';
import dbConnectionRoutes from './dbConnection.routes';
import rolePermissionRoutes from './rolePermission.routes';
import syncRoutes from './sync.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/companies', companyRoutes);
router.use('/flota', flotaRoutes);
router.use('/catalogo', catalogoRoutes);
router.use('/ordenes', ordenRoutes);
router.use('/aprobaciones', aprobacionesRoutes);
router.use('/almacen', almacenRoutes);
router.use('/notificaciones', notificacionesRoutes);
router.use('/multimedia', multimediaRoutes);
router.use('/ai', aiAgentRoutes);
router.use('/profit', profitFlotaRoutes);
router.use('/db-connections', dbConnectionRoutes);
router.use('/roles-permissions', rolePermissionRoutes);
router.use('/sync', syncRoutes);

export default router;
