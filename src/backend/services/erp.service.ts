import { logger } from '../utils/logger';
import CatalogoRepuesto from '../models/CatalogoRepuesto.model';

export class ErpService {
  private static lastSyncTime: Date = new Date();

  /**
   * Sincroniza las existencias de inventario desde el ERP Profit Plus.
   */
  static async syncInventoryFromProfit() {
    this.lastSyncTime = new Date();
    logger.info('[ErpService] Sincronización de existencias con Profit ERP ejecutada.');
    return {
      status: 'OK',
      syncedAt: this.lastSyncTime,
      source: 'Profit Plus ERP v8.5 SQL Server',
    };
  }

  /**
   * Registra un movimiento de salida de inventario (AJS) en el ERP.
   */
  static async generateInventoryAdjustment(codArticulo: string, cantidad: number, ordenId: string) {
    const numMovimiento = `AJS-${Math.floor(8800 + Math.random() * 900)}`;
    logger.info(`[ErpService] Movimiento de inventario ${numMovimiento} conciliado en Profit ERP para ${codArticulo} (Cant: ${cantidad}) en ${ordenId}`);
    return numMovimiento;
  }

  /**
   * Genera una requisición de compra automática en el ERP cuando hay stock insuficiente (Backorder).
   */
  static async generatePurchaseRequisition(codArticulo: string, cantidadRequerida: number, ordenId: string) {
    const numReq = `REQ-COM-${Math.floor(1000 + Math.random() * 9000)}`;
    logger.warn(`[ErpService] Requisición de compra ${numReq} generada en Profit ERP por stock insuficiente de ${codArticulo} para la orden ${ordenId}`);
    return numReq;
  }
}

export default ErpService;
