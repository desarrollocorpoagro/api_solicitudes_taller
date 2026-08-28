import { Request, Response } from 'express';
import { FlotaVehicular } from '../models';
import { logger } from '../utils/logger';
import { getTenantContext, getFleetTenantWhere } from '../utils/tenantHelper';

export class FlotaController {
  /**
   * Obtiene la lista de la flota vehicular correspondiente a la empresa activa (Tenant).
   */
  static async getAllFlota(req: Request, res: Response) {
    try {
      const tenantWhere = await getFleetTenantWhere(req);
      const flota = await FlotaVehicular.findAll({
        where: tenantWhere,
        order: [['placa', 'ASC']],
      });
      return res.json({ success: true, count: flota.length, data: flota });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Obtiene los datos de una unidad por su placa, validando pertenencia a la empresa activa.
   */
  static async getFlotaByPlaca(req: Request, res: Response) {
    try {
      const { placa } = req.params;
      const cleanPlaca = placa.toUpperCase().trim();
      const tenant = await getTenantContext(req);

      const unidad = await FlotaVehicular.findOne({
        where: { placa: cleanPlaca },
      });

      if (!unidad) {
        return res.status(404).json({
          success: false,
          error: `Placa ${cleanPlaca} no encontrada en el maestro de flota. Verifique el código o registre la unidad.`,
          code: 'FLEET_NOT_FOUND',
        });
      }

      // Validar aislamiento multi-tenant si hay un contexto de empresa activa
      if (tenant) {
        const matchesId = unidad.companyId && unidad.companyId === tenant.companyId;
        const matchesName = unidad.empresa && unidad.empresa.toLowerCase() === tenant.companyName.toLowerCase();

        if (!matchesId && !matchesName) {
          logger.warn(`[FlotaController] Acceso denegado: Placa ${cleanPlaca} (${unidad.empresa}) no pertenece a empresa activa (${tenant.companyName})`);
          return res.status(403).json({
            success: false,
            error: `Acceso denegado por aislamiento de empresa: La unidad con placa ${cleanPlaca} pertenece a "${unidad.empresa}" y no puede ser gestionada desde "${tenant.companyName}".`,
            code: 'TENANT_ISOLATION_VIOLATION',
            vehicleCompany: unidad.empresa,
            activeCompany: tenant.companyName,
          });
        }
      }

      // Reincidencia detectada si tiene historial previo
      const tieneReincidencia = Boolean(unidad.historialOsAnterior);

      return res.json({
        success: true,
        data: unidad,
        reincidencia: tieneReincidencia
          ? {
              detectada: true,
              osAnterior: unidad.historialOsAnterior,
              dias: unidad.historialDias,
              area: unidad.historialArea,
              mensaje: `Reincidencia detectada. Esta unidad estuvo en ${unidad.historialArea} hace ${unidad.historialDias} días bajo la orden ${unidad.historialOsAnterior}.`,
            }
          : { detectada: false, mensaje: 'Sin reincidencia registrada para esta unidad.' },
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Simulación de escaneo de código QR de la unidad dentro de la empresa activa.
   */
  static async scanQR(req: Request, res: Response) {
    try {
      const { qrCode } = req.body;
      const tenantWhere = await getFleetTenantWhere(req);
      let unidad = null;

      if (qrCode) {
        unidad = await FlotaVehicular.findOne({
          where: { qrCode, ...tenantWhere },
        });
      }

      // Si no se envía QR específico, seleccionar uno aleatorio del catálogo de la empresa activa
      if (!unidad) {
        const all = await FlotaVehicular.findAll({ where: tenantWhere });
        if (all.length > 0) {
          unidad = all[Math.floor(Math.random() * all.length)];
        }
      }

      if (!unidad) {
        return res.status(404).json({
          success: false,
          error: 'Código QR no reconocido o no pertenece a la flota de la empresa activa.',
        });
      }

      logger.info(`[FlotaController] QR escaneado con éxito para placa: ${unidad.placa} (${unidad.empresa})`);
      return res.json({
        success: true,
        message: 'Lectura de QR completada.',
        data: unidad,
        reincidencia: unidad.historialOsAnterior
          ? {
              detectada: true,
              osAnterior: unidad.historialOsAnterior,
              dias: unidad.historialDias,
              area: unidad.historialArea,
            }
          : { detectada: false },
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }
}

export default FlotaController;
