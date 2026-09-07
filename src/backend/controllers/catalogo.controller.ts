import { Request, Response } from 'express';
import { CatalogoRepuesto } from '../models';
import { ErpService } from '../services/erp.service';
import { logger } from '../utils/logger';
import { profitMirrorSequelize } from '../config/profitDb';

export class CatalogoController {
  /**
   * Obtiene el catálogo completo de repuestos y sincroniza con el ERP Profit Plus.
   */
  static async getCatalogo(req: Request, res: Response) {
    try {
      const [rows]: any = await profitMirrorSequelize.query(
        `SELECT codigo_profit, nombre_producto, costo, codigo_subalmacen,
                sub_almacen, almacen, stock_act
         FROM vw_flota_articulos
         ORDER BY nombre_producto ASC`
      );

      const grouped = new Map<string, any>();
      for (const row of rows ?? []) {
        const code = String(row.codigo_profit ?? '').trim();
        if (!code) continue;
        const item = grouped.get(code) ?? {
          cod: code,
          desc: String(row.nombre_producto ?? '').trim(),
          costo: Number(row.costo ?? 0),
          stock: 0,
          stockCentral: 0,
          codigoSubalmacen: '01',
          almacen: String(row.almacen ?? row.sub_almacen ?? '').trim(),
          categoria: null,
        };
        const rawSubalmacen = String(row.codigo_subalmacen ?? '').trim();
        const subalmacen = rawSubalmacen === '0' || rawSubalmacen === '00'
          ? '00'
          : rawSubalmacen === '1' || rawSubalmacen === '01'
            ? '01'
            : rawSubalmacen;
        const stock = Number(row.stock_act ?? 0);
        if (subalmacen === '00') item.stockCentral += stock;
        if (subalmacen === '01') {
          item.stock += stock;
          item.almacen = String(row.almacen ?? row.sub_almacen ?? item.almacen).trim();
        }
        grouped.set(code, item);
      }

      const repuestos = Array.from(grouped.values());
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
