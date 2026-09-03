import { Request, Response } from 'express';
import { OrdenArea, OrdenServicio, SolicitudRepuesto, SolicitudExterno } from '../models';
import { TARIFAS_AREA } from '../models/OrdenArea.model';
import { AuditService } from '../services/audit.service';
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
      // Incluir el ordenId en el OT id para garantizar unicidad global
      // (la PK de ordenes_area es global, no por orden).
      // Ej: OS-2026-00005 → OT-OS-2026-00005-A1, A2, ...
      const ordenSlug = String(ordenId).replace(/[^A-Za-z0-9]/g, '');
      const otId = `OT-${ordenSlug}-A${count + 1}`;
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

      // Registrar auditoría
      await AuditService.recordLog({
        ordenId,
        otId,
        action: 'CREACION_OT',
        fieldName: 'area',
        newValue: area,
        description: `Apertura de orden de área técnica ${otId} (${area}) asignada a mecánico: "${mecanico}". Horas estimadas: ${horasNum}h ($${costoManoObra}). Diagnóstico inicial: "${diagnostico || '(pendiente)'}"`,
        req,
      });

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
      const { diagnostico, horas, estado, mecanico } = req.body;

      const area = await OrdenArea.findOne({ where: { id: otId, ordenId } });
      if (!area) return res.status(404).json({ success: false, error: 'Orden de área no encontrada.' });

      const oldDiagnostico = area.diagnostico;
      const oldHoras = area.horas;
      const oldMecanico = area.mecanico;
      const oldEstado = area.estado;

      if (mecanico !== undefined && mecanico !== area.mecanico) {
        area.mecanico = mecanico;
        await AuditService.recordLog({
          ordenId,
          otId,
          action: 'ACTUALIZACION_OT',
          fieldName: 'mecanico',
          previousValue: oldMecanico,
          newValue: mecanico,
          description: `Mecánico responsable de ${otId} modificado de "${oldMecanico}" a "${mecanico}"`,
          req,
        });
      }

      if (diagnostico !== undefined && diagnostico !== area.diagnostico) {
        area.diagnostico = diagnostico;
        await AuditService.recordLog({
          ordenId,
          otId,
          action: 'ACTUALIZACION_OT',
          fieldName: 'diagnostico',
          previousValue: oldDiagnostico,
          newValue: diagnostico,
          description: `Diagnóstico técnico de ${otId} actualizado: "${diagnostico}"`,
          req,
        });
      }

      if (horas !== undefined && parseFloat(horas) !== area.horas) {
        const prevHoras = area.horas;
        area.horas = parseFloat(horas);
        const tarifa = TARIFAS_AREA[area.area] || area.tarifaHora || 12;
        const prevMO = area.costoManoObra;
        area.costoManoObra = parseFloat((area.horas * tarifa).toFixed(2));

        await AuditService.recordLog({
          ordenId,
          otId,
          action: 'ACTUALIZACION_OT',
          fieldName: 'horas',
          previousValue: `${prevHoras}h ($${prevMO})`,
          newValue: `${area.horas}h ($${area.costoManoObra})`,
          description: `Horas de mano de obra de ${otId} modificadas: ${prevHoras}h ($${prevMO}) → ${area.horas}h ($${area.costoManoObra})`,
          req,
        });
      }

      if (estado && estado !== oldEstado) {
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

        await AuditService.recordLog({
          ordenId,
          otId,
          action: estado === 'cerrada' ? 'CIERRE_OT' : 'ACTUALIZACION_OT',
          fieldName: 'estado',
          previousValue: oldEstado,
          newValue: estado,
          description: `Estado de orden de área ${otId} cambiado de "${oldEstado}" a "${estado}"`,
          req,
        });
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

      const area = await OrdenArea.findOne({ where: { id: otId, ordenId } });
      if (!area) return res.status(404).json({ success: false, error: 'Orden de área no encontrada.' });

      const countReps = await SolicitudRepuesto.count({ where: { ordenId, otId } });
      const countExts = await SolicitudExterno.count({ where: { ordenId, otId } });

      if (countReps + countExts > 0) {
        return res.status(400).json({
          success: false,
          error: 'No se puede anular la orden de área porque tiene solicitudes de repuestos o servicios externos asociadas.',
        });
      }

      const areaName = area.area;
      await area.destroy();

      await AuditService.recordLog({
        ordenId,
        otId,
        action: 'ELIMINACION_OT',
        fieldName: 'id',
        previousValue: otId,
        newValue: null,
        description: `Anulación y eliminación de orden de área ${otId} (${areaName})`,
        req,
      });

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
