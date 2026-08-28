import { Request, Response } from 'express';
import { CatalogoRepuesto } from '../models';
import { ErpService } from '../services/erp.service';
import { logger } from '../utils/logger';

export class CatalogoController {
  /**
   * Obtiene el catálogo completo de repuestos y sincroniza con el ERP Profit Plus.
   */
  static async getCatalogo(req: Request, res: Response) {
    try {
      const repuestos = await CatalogoRepuesto.findAll({ order: [['desc', 'ASC']] });
      const erpStatus = await ErpService.syncInventoryFromProfit();

      return res.json({
        success: true,
        count: repuestos.length,
        data: repuestos,
        erpSync: erpStatus,
      });
    } catch (error: any) {
      logger.error(`[CatalogoController] Error al obtener catálogo: ${error.message}`);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Obtiene un repuesto específico por su código.
   */
  static async getRepuestoByCod(req: Request, res: Response) {
    try {
      const { cod } = req.params;
      const repuesto = await CatalogoRepuesto.findOne({
        where: { cod: cod.toUpperCase().trim() },
      });

      if (!repuesto) {
        return res.status(404).json({ success: false, error: 'Repuesto no encontrado en catálogo.' });
      }

      return res.json({ success: true, data: repuesto });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Actualiza las existencias de un repuesto.
   */
  static async updateStock(req: Request, res: Response) {
    try {
      const { cod } = req.params;
      const { stock, costo } = req.body;

      const repuesto = await CatalogoRepuesto.findOne({ where: { cod: cod.toUpperCase().trim() } });
      if (!repuesto) return res.status(404).json({ success: false, error: 'Repuesto no encontrado.' });

      if (stock !== undefined) repuesto.stock = parseInt(stock, 10);
      if (costo !== undefined) repuesto.costo = parseFloat(costo);

      await repuesto.save();
      logger.info(`[CatalogoController] Stock de repuesto ${cod} actualizado a ${repuesto.stock}`);
      return res.json({ success: true, message: 'Stock actualizado exitosamente.', data: repuesto });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }
}

export default CatalogoController;
