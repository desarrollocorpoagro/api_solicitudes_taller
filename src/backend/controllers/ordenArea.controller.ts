import { Request, Response } from 'express';
import { OrdenArea, OrdenServicio, SolicitudRepuesto, SolicitudExterno } from '../models';
import { TARIFAS_AREA } from '../models/OrdenArea.model';
import { logger } from '../utils/logger';

export class OrdenAreaController {
  /**
   * Crea una nueva orden de área (OT) dentro de una orden de servicio.
   */
  static async createArea(req: Request, res: Response) {
    try {
      const { id: ordenId } = req.params;
      const { area, fechaRecepcion, mecanico, diagnostico, horas } = req.body;

      const orden = await OrdenServicio.findByPk(ordenId);
      if (!orden) return res.status(404).json({ success: false, error: 'Orden de servicio no encontrada.' });

      if (orden.estado === 'Cerrada') {
        return res.status(400).json({ success: false, error: 'No se pueden añadir órdenes de área a una orden cerrada.' });
      }

      const count = await OrdenArea.count({ where: { ordenId } });
      const otId = `OT-A${count + 1}`;
      const tarifa = TARIFAS_AREA[area] || 12;
      const horasNum = parseFloat(horas || '0');
      const costoManoObra = parseFloat((horasNum * tarifa).toFixed(2));

      const nuevaArea = await OrdenArea.create({
        id: otId,
        ordenId,
        area,
        fechaRecepcion: fechaRecepcion ? new Date(fechaRecepcion) : new Date(),
        mecanico,
        diagnostico: diagnostico || '',
        horas: horasNum,
        tarifaHora: tarifa,
        costoManoObra,
        estado: 'abierta',
      });

      // Pasar la orden a estado En Proceso si estaba recién abierta
      if (orden.estado === 'Abierta') {
        orden.estado = 'En Proceso';
        await orden.save();
      }

      logger.info(`[OrdenAreaController] Orden de área ${otId} (${area}) creada para ${ordenId}`);
      return res.status(201).json({
        success: true,
        message: 'Orden de área creada exitosamente.',
        data: nuevaArea,
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Actualiza el diagnóstico, horas de mano de obra o cambia el estado (abierta/cerrada) de la orden de área.
   */
  static async updateArea(req: Request, res: Response) {
    try {
      const { id: ordenId, otId } = req.params;
      const { diagnostico, horas, estado } = req.body;

      const area = await OrdenArea.findOne({ where: { id: otId, ordenId } });
      if (!area) return res.status(404).json({ success: false, error: 'Orden de área no encontrada.' });

      if (diagnostico !== undefined) area.diagnostico = diagnostico;
      if (horas !== undefined) {
        area.horas = parseFloat(horas);
        const tarifa = TARIFAS_AREA[area.area] || area.tarifaHora || 12;
        area.costoManoObra = parseFloat((area.horas * tarifa).toFixed(2));
      }

      if (estado) {
        if (estado === 'cerrada') {
          if (!area.diagnostico || !area.diagnostico.trim()) {
            return res.status(400).json({
              success: false,
              error: 'La orden de área requiere un diagnóstico técnico antes de poder cerrarse.',
            });
          }

          // Verificar si tiene solicitudes pendientes de repuestos o externos
          const repsPendientes = await SolicitudRepuesto.count({
            where: {
              otId,
              ordenId,
              estadoAprobacion: 'Pendiente',
            },
          });

          const repsSinEntregar = await SolicitudRepuesto.count({
            where: {
              otId,
              ordenId,
              estadoAprobacion: 'Aprobada',
              estadoEntrega: 'Por entregar',
            },
          });

          const extsPendientes = await SolicitudExterno.count({
            where: {
              otId,
              ordenId,
              estadoAprobacion: 'Pendiente',
            },
          });

          if (repsPendientes + repsSinEntregar + extsPendientes > 0) {
            return res.status(400).json({
              success: false,
              error: 'Esta orden de área tiene solicitudes de repuestos o servicios externos sin resolver (pendientes de aprobación o despacho).',
            });
          }
        }
        area.estado = estado;
      }

      await area.save();
      logger.info(`[OrdenAreaController] Orden de área ${otId} actualizada.`);

      return res.json({
        success: true,
        message: 'Orden de área actualizada.',
        data: area,
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Anula una orden de área si no posee solicitudes de repuestos o servicios externos asociadas.
   */
  static async deleteArea(req: Request, res: Response) {
    try {
      const { id: ordenId, otId } = req.params;

      const countReps = await SolicitudRepuesto.count({ where: { ordenId, otId } });
      const countExts = await SolicitudExterno.count({ where: { ordenId, otId } });

      if (countReps + countExts > 0) {
        return res.status(400).json({
          success: false,
          error: 'No se puede anular la orden de área porque tiene solicitudes de repuestos o servicios externos asociadas.',
        });
      }

      const deleted = await OrdenArea.destroy({ where: { id: otId, ordenId } });
      if (!deleted) return res.status(404).json({ success: false, error: 'Orden de área no encontrada.' });

      return res.json({
        success: true,
        message: 'Orden de área anulada exitosamente.',
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }
}

export default OrdenAreaController;
