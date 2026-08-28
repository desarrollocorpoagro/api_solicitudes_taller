import { Router } from 'express';
import { AIAgentController } from '../controllers/aiAgent.controller';
import { validateJoi } from '../middlewares/validate.middleware';
import { aiQuerySchema } from '../validations/schemas';

const router = Router();

router.post('/query', validateJoi(aiQuerySchema), AIAgentController.query);

export default router;
