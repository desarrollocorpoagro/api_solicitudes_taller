import { initDatabase } from '../config/database';
import { seedInitialData } from '../models';
import { runAllUnitTests } from './unitTests';
import { logger } from '../utils/logger';

async function main() {
  try {
    logger.info('[TestRunner] Inicializando base de datos para pruebas...');
    await initDatabase();
    await seedInitialData();

    const summary = await runAllUnitTests();

    if (summary.failed > 0) {
      logger.error(`[TestRunner] ${summary.failed} pruebas fallaron.`);
      process.exit(1);
    } else {
      logger.info('[TestRunner] Todas las pruebas unitarias pasaron exitosamente.');
      process.exit(0);
    }
  } catch (err: any) {
    logger.error(`[TestRunner] Error fatal ejecutando pruebas: ${err.message}`);
    process.exit(1);
  }
}

main();
