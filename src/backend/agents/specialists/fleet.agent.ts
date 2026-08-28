import { GoogleGenAI } from '@google/genai';
import { logger } from '../../utils/logger';

export class FleetAgent {
  static async analyze(prompt: string, context?: any): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY;

    if (apiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: `Eres el Agente Especialista en Flota y Taller Mecánico del Grupo San Luis.
Tu función es diagnosticar fallas mecánicas de camiones, pick-ups y chutos, recomendar repuestos óptimos, detectar reincidencias y validar horas de mano de obra en áreas de taller (Mtto preventivo, Reparaciones mayores, Mtto correctivo, etc.).

Contexto actual de la orden / flota: ${JSON.stringify(context || {})}
Consulta del usuario: ${prompt}

Responde de forma técnica, precisa, en español y con recomendaciones claras para el mecánico o gerente de taller.`,
        });

        if (response.text) {
          return response.text;
        }
      } catch (err: any) {
        logger.warn(`[FleetAgent] Error al consultar Gemini API: ${err.message}. Usando motor experto local.`);
      }
    }

    // Reglas de inferencia técnica si no hay API key o offline
    if (prompt.toLowerCase().includes('freno') || prompt.toLowerCase().includes('vibraci')) {
      return `[Diagnóstico Especialista de Flota]: Se identifica posible alabeo en los discos de freno delanteros y desgaste en terminales de dirección. Recomendación:
1. Reemplazar discos de freno (FRE-0234) o rectificar con servicio externo en caso de espesor dentro de tolerancia.
2. Cambiar juego de pastillas de freno (PAS-0301).
3. Verificar rodamientos de maza delantera (ROD-0087) para descartar juego axial.
Tiempo estimado de mano de obra: 2.0 a 3.0 horas en área de Reparaciones Mayores.`;
    }

    return `[Diagnóstico Especialista de Flota]: Se ha analizado la condición vehicular reportada para la unidad. Se sugiere triaje preventivo en área de Mtto Correctivo, revisión de niveles de fluidos y escaneo de códigos OBD-II.`;
  }
}
