import { Request, Response } from 'express';
import { FlotaVehicular } from '../models';
import { profitMirrorSequelize } from '../config/profitDb';
import { logger } from '../utils/logger';
import { getTenantContext, getFleetTenantWhere } from '../utils/tenantHelper';

interface FlotaMirrorRow {
  Placa?: string;
  placa?: string;
  placa_anterior?: string | null;
  Empresa_Propietaria?: string | null;
  Marca?: string | null;
  Modelo?: string | null;
  color?: string | null;
  Año?: number | null;
  clase?: string | null;
  Tipo?: string | null;
  Uso?: string | null;
  Estatus_operatividad?: string | null;
  Observaciones?: string | null;
  km_actual?: number | null;
  nro_ROTC?: string | null;
  nro_RACDA?: string | null;
  empresa_seguro?: string | null;
  historialOsAnterior?: string | null;
  historialDias?: number | null;
  historialArea?: string | null;
  [key: string]: any;
}

function normalizeFlotaRow(row: FlotaMirrorRow) {
  const placa = (row.Placa ?? row.placa ?? '').toString().trim();
  return {
    placa,
    placa_anterior: row.placa_anterior ?? null,
    marca: row.Marca ?? null,
    modelo: row.Modelo ?? null,
    anio: row.Año ?? null,
    color: row.color ?? null,
    clase: row.clase ?? null,
    tipo: row.Tipo ?? null,
    empresa: row.Empresa_Propietaria ?? null,
    Empresa_Propietaria: row.Empresa_Propietaria ?? null,
    Uso: row.Uso ?? null,
    Estatus_operatividad: row.Estatus_operatividad ?? null,
    Observaciones: row.Observaciones ?? null,
    km: row.km_actual ?? 0,
    km_actual: row.km_actual ?? null,
    nro_ROTC: row.nro_ROTC ?? null,
    nro_RACDA: row.nro_RACDA ?? null,
    empresa_seguro: row.empresa_seguro ?? null,
    historialOsAnterior: row.historialOsAnterior ?? null,
    historialDias: row.historialDias ?? null,
    historialArea: row.historialArea ?? null,
    ...row,
  };
}

export class FlotaController {
  /**
   * Obtiene la lista de la flota vehicular correspondiente a la empresa activa (Tenant).
   * Lee desde la tabla espejo `flota_vehiculos` que es donde MasterSyncService
   * deposita la información proveniente de MSSQL Profit AD_TRANS.
   */
  static async getAllFlota(req: Request, res: Response) {
    try {
      const tenant = await getTenantContext(req);
      const params: any[] = [];
      let where = '';
      if (tenant) {
        where = 'WHERE (LOWER(LTRIM(RTRIM(Empresa_Propietaria))) = LOWER(LTRIM(RTRIM(?))))';
        params.push(tenant.companyName);
      }
      const [rows]: any = await profitMirrorSequelize.query(
        `SELECT Placa, placa_anterior, Empresa_Propietaria, Marca, Modelo, color, Año, clase, Tipo,
                Carga_max_kg, Carga_max_lts, Serial_carroceria1, Serial_carroceria2, Serial_Motor,
                Uso, Estatus_operatividad, Observaciones, cant_cauchos_vehiculo, medida_caucho_vehiculo,
                km_actual, tipo_bateria1, serial_bateria1, fec_garantia_bateria1,
                tipo_bateria2, serial_bateria2, fec_garantia_bateria2,
                contrato_seguro, empresa_seguro, fec_venc_seguro, fec_venc_trimestres,
                nro_ROTC, fec_venc_ROTC, nro_RACDA, fec_venc_RACDA,
                nro_gps1, nro_gps2, nro_ejes, calibracion, venc_calibrac, tara, funcion, division, activo
         FROM flota_vehiculos
         ${where}
         ORDER BY Placa ASC`,
        { replacements: params }
      );
      const flota = (rows || []).map((r: FlotaMirrorRow) => normalizeFlotaRow(r));
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

      const [rows]: any = await profitMirrorSequelize.query(
        `SELECT Placa, placa_anterior, Empresa_Propietaria, Marca, Modelo, color, Año, clase, Tipo,
                Carga_max_kg, Carga_max_lts, Serial_carroceria1, Serial_carroceria2, Serial_Motor,
                Uso, Estatus_operatividad, Observaciones, cant_cauchos_vehiculo, medida_caucho_vehiculo,
                km_actual, tipo_bateria1, serial_bateria1, fec_garantia_bateria1,
                tipo_bateria2, serial_bateria2, fec_garantia_bateria2,
                contrato_seguro, empresa_seguro, fec_venc_seguro, fec_venc_trimestres,
                nro_ROTC, fec_venc_ROTC, nro_RACDA, fec_venc_RACDA,
                nro_gps1, nro_gps2, nro_ejes, calibracion, venc_calibrac, tara, funcion, division, activo
         FROM flota_vehiculos
         WHERE LTRIM(RTRIM(Placa)) = LTRIM(RTRIM(?))
         LIMIT 1`,
        { replacements: [cleanPlaca] }
      );
      const unidad = (rows && rows[0]) ? normalizeFlotaRow(rows[0]) : null;

      if (!unidad) {
        return res.status(404).json({
          success: false,
          error: `Placa ${cleanPlaca} no encontrada en el maestro de flota. Verifique el código o registre la unidad.`,
          code: 'FLEET_NOT_FOUND',
        });
      }

      // Validar aislamiento multi-tenant si hay un contexto de empresa activa
      if (tenant) {
        const vehicleCompany = (unidad.empresa || '').toString();
        const matchesName = vehicleCompany.toLowerCase() === tenant.companyName.toLowerCase();
        if (!matchesName) {
          logger.warn(`[FlotaController] Acceso denegado: Placa ${cleanPlaca} (${vehicleCompany}) no pertenece a empresa activa (${tenant.companyName})`);
          return res.status(403).json({
            success: false,
            error: `Acceso denegado por aislamiento de empresa: La unidad con placa ${cleanPlaca} pertenece a "${vehicleCompany}" y no puede ser gestionada desde "${tenant.companyName}".`,
            code: 'TENANT_ISOLATION_VIOLATION',
            vehicleCompany,
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
      const tenant = await getTenantContext(req);
      const params: any[] = [];
      let where = '';
      if (tenant) {
        where = 'AND LOWER(LTRIM(RTRIM(Empresa_Propietaria))) = LOWER(LTRIM(RTRIM(?)))';
        params.push(tenant.companyName);
      }
      let rows: any[] = [];

      if (qrCode) {
        const [direct]: any = await profitMirrorSequelize.query(
          `SELECT * FROM flota_vehiculos WHERE LTRIM(RTRIM(Placa)) = LTRIM(RTRIM(?)) ${where} LIMIT 1`,
          { replacements: [qrCode, ...params] }
        );
        rows = direct || [];
      }

      if (rows.length === 0) {
        const [random]: any = await profitMirrorSequelize.query(
          `SELECT * FROM flota_vehiculos WHERE 1=1 ${where} ORDER BY RANDOM() LIMIT 1`,
          { replacements: params }
        );
        rows = random || [];
      }

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Código QR no reconocido o no pertenece a la flota de la empresa activa.',
        });
      }

      const unidad = normalizeFlotaRow(rows[0]);
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
