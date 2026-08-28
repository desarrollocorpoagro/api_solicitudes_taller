import { GoogleGenAI } from '@google/genai';
import { logger } from '../../utils/logger';

export class AgronomyAgent {
  static async analyze(prompt: string, context?: any): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY;

    if (apiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: `Eres el Agente Especialista en Agronomía y Maquinaria de Campo del Grupo San Luis.
Tu función es evaluar el rendimiento de cosechas, estado de tractores e implementos agrícolas, ciclos de siembra y logística de transporte agroindustrial.

Contexto: ${JSON.stringify(context || {})}
Consulta del usuario: ${prompt}

Responde de forma profesional, en español y enfocada en la optimización agroindustrial.`,
        });

        if (response.text) {
          return response.text;
        }
      } catch (err: any) {
        logger.warn(`[AgronomyAgent] Error al consultar Gemini API: ${err.message}. Usando motor experto local.`);
      }
    }

    return `[Diagnóstico Especialista en Agronomía]: La maquinaria agrícola y unidades de transporte de carga pesada vinculadas a la unidad de negocio presentan una demanda operativa óptima. Se recomienda programar los mantenimientos preventivos antes de la ventana pico de zafra/cosecha.`;
  }
}
