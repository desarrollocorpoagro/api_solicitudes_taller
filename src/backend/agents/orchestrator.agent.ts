import { FleetAgent } from './specialists/fleet.agent';
import { AgronomyAgent } from './specialists/agronomy.agent';
import { logger } from '../utils/logger';

export class MultiAgentOrchestrator {
  static async processRequest(prompt: string, agentType?: string, context?: any) {
    logger.info(`[AI Orchestrator] Procesando consulta: "${prompt.substring(0, 80)}..." | Tipo solicitado: ${agentType || 'auto'}`);

    if (agentType === 'fleet') {
      const response = await FleetAgent.analyze(prompt, context);
      return { agent: 'Especialista en Flota y Taller', response };
    }

    if (agentType === 'agronomy') {
      const response = await AgronomyAgent.analyze(prompt, context);
      return { agent: 'Especialista en Agronomía', response };
    }

    // Clasificación automática basada en intención
    const p = prompt.toLowerCase();
    if (p.includes('cosecha') || p.includes('siembra') || p.includes('campo') || p.includes('suelo') || p.includes('agrícola')) {
      const response = await AgronomyAgent.analyze(prompt, context);
      return { agent: 'Especialista en Agronomía', response };
    }

    const response = await FleetAgent.analyze(prompt, context);
    return { agent: 'Especialista en Flota y Taller', response };
  }
}

export default MultiAgentOrchestrator;
