import { Request, Response } from 'express';
import { MultiAgentOrchestrator } from '../agents/orchestrator.agent';
import { logger } from '../utils/logger';

export class AIAgentController {
  /**
   * Endpoint de consulta para el motor multiagente de IA de San Luis.
   */
  static async query(req: Request, res: Response) {
    try {
      const { prompt, agentType, context } = req.body;
      const result = await MultiAgentOrchestrator.processRequest(prompt, agentType, context);

      return res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error(`[AIAgentController] Error al procesar consulta de IA: ${error.message}`);
      return res.status(500).json({ success: false, error: error.message });
    }
  }
}

export default AIAgentController;
