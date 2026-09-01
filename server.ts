import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import { createServer as createViteServer } from 'vite';

import { initDatabase } from './src/backend/config/database';
import { initProfitDatabase, initProfitMirrorSchema, seedProfitMirrorFromMain } from './src/backend/config/profitDb';
import { seedInitialData } from './src/backend/models';
import apiRoutes from './src/backend/routes';
import swaggerDocument from './src/backend/config/swagger';
import { logger, morganStream } from './src/backend/utils/logger';
import { apiRateLimiter } from './src/backend/middlewares/rateLimiter.middleware';
import { SyncService } from './src/backend/services/sync.service';
import { MasterSyncService } from './src/backend/services/masterSync.service';
import { runAllUnitTests } from './src/backend/tests/unitTests';

dotenv.config();

async function startServer() {
  const app = express();
  const basePort = Number(process.env.PORT || 3000);
  const isProduction = process.env.NODE_ENV === 'production';

  // Configurar trust proxy para proxies inversos (Cloud Run / Nginx / Vite)
  app.set('trust proxy', 1);

  // 1. Middlewares de Seguridad y Logging
  app.use(
    helmet({
      contentSecurityPolicy: false, // Permitir Vite dev mode y Swagger UI embebido
      crossOriginEmbedderPolicy: false,
    })
  );

  app.use(
    cors({
      origin: process.env.CORS_ORIGIN || '*',
      credentials: true,
    })
  );

  app.use(morgan(':method :url :status :res[content-length] - :response-time ms', { stream: morganStream }));
  app.use(express.json({ limit: '15mb' }));
  app.use(express.urlencoded({ extended: true, limit: '15mb' }));

  // 2. Servir Directorio de Archivos Multimedia
  const uploadDir = path.resolve(process.cwd(), process.env.UPLOAD_DIR || './data/uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  app.use('/uploads', express.static(uploadDir));

  // 3. Documentación Swagger / OpenAPI 3.0 en Español
  app.get('/api-docs-json', (_req: Request, res: Response) => {
    res.json(swaggerDocument);
  });
  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerDocument, {
      customSiteTitle: 'Grupo San Luis — Documentación Swagger API',
      customCss: '.swagger-ui .topbar { background-color: #003366; } .swagger-ui .topbar .topbar-wrapper img { content: url("https://upload.wikimedia.org/wikipedia/commons/a/ab/Logo_placeholder.png"); width: 40px; }',
    })
  );

  // 4. Healthcheck y Endpoint de Pruebas Unitarias
  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'UP',
      service: 'sanluis-backend-api',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      dialect: process.env.DB_DIALECT || 'sqlite',
    });
  });

  app.post('/api/v1/system/run-tests', async (_req: Request, res: Response) => {
    try {
      const summary = await runAllUnitTests();
      return res.json({ success: true, ...summary });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 4.1 Sitemap para Search Console
  app.get('/sitemap.xml', (_req: Request, res: Response) => {
    const sitemapPath = path.resolve(process.cwd(), 'public', 'sitemap.xml');
    res.setHeader('Content-Type', 'application/xml');
    res.sendFile(sitemapPath, (err) => {
      if (err) {
        logger.warn(`[Sitemap] Archivo no encontrado: ${sitemapPath}`);
        res.status(404).send('Sitemap no disponible');
      }
    });
  });

  // 5. Montar Rutas Modulares de la API
  app.use('/api/v1', apiRateLimiter, apiRoutes);

  // 5.1 Manejador 404 JSON estricto para cualquier ruta /api/* no existente (evita fallback a HTML SPA)
  app.all('/api/*', (_req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: `Endpoint API no encontrado: ${_req.method} ${_req.originalUrl}`,
      code: 'API_ENDPOINT_NOT_FOUND',
    });
  });

  // 6. Integración con Vite / SPA Fallback
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // 7. Middleware Global de Manejo de Errores
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    logger.error(`[GlobalErrorHandler] Error no controlado: ${err.stack || err.message}`);
    res.status(err.status || 500).json({
      success: false,
      error: err.message || 'Error interno del servidor.',
      code: err.code || 'INTERNAL_SERVER_ERROR',
    });
  });

  // 8. Inicialización de Bases de Datos (Principal y MSSQL Profit AD_TRANS)
  try {
    await initDatabase();
    await seedInitialData();
    await initProfitDatabase();
    // Asegurar que el espejo SQLite local (./data/profit_ad_trans.sqlite) tenga las tablas
    // antes de iniciar la sincronización bidireccional. Sin esto, el primer ciclo fallaría
    // al intentar INSERT en tablas inexistentes.
    await initProfitMirrorSchema();
    await seedProfitMirrorFromMain();
    // Iniciar motor de verificación periódica de conectividad y sincronización offline-first
    SyncService.startBackgroundSync(15000);
    // Iniciar motor de sincronización bidireccional de datos maestros
    // (mecánicos, vendedores, artículos y flota_ordenes_servicio).
    // Ejecuta un ciclo inmediato de poblado/inserción y luego continúa cada 30s.
    MasterSyncService.startBackgroundMasterSync(30000);
  } catch (dbErr: any) {
    logger.error(`[DatabaseInit] Error inicializando bases de datos: ${dbErr.message}`);
  }

  const listenOnPort = (port: number): void => {
    const server = app.listen(port, '0.0.0.0', () => {
      logger.info(`========================================================`);
      logger.info(`🚜 [San Luis Backend] Servidor Express activo en puerto ${port}`);
      logger.info(`📚 Swagger UI disponible en: http://localhost:${port}/api-docs`);
      logger.info(`📄 Especificación JSON en: http://localhost:${port}/api-docs-json`);
      logger.info(`🏥 Healthcheck: http://localhost:${port}/health`);
      logger.info(`========================================================`);
    });

    server.on('error', (err: any) => {
      if (err && err.code === 'EADDRINUSE') {
        logger.warn(`[Server] Puerto ${port} ocupado; intentando ${port + 1}...`);
        listenOnPort(port + 1);
        return;
      }
      throw err;
    });
  };

  listenOnPort(basePort);
}

startServer().catch((error) => {
  console.error('Error al iniciar el servidor San Luis:', error);
  process.exit(1);
});
