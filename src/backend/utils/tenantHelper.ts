import { Request } from 'express';
import { Op } from 'sequelize';
import { Company } from '../models';
import { listUnidadesForTenant } from './flotaLookup';

export interface TenantContext {
  companyId: string;
  companyName: string;
  taxId?: string;
}

/**
 * Obtiene el contexto de tenant (empresa) activo para la petición HTTP.
 * Se extrae del token JWT (req.user.companyId), del contexto req.tenantId,
 * o de las cabeceras x-tenant-id / query params.
 */
export async function getTenantContext(req: Request): Promise<TenantContext | null> {
  const candidateId =
    req.tenantId ||
    req.user?.companyId ||
    (req.headers['x-tenant-id'] as string) ||
    (req.headers['x-company-id'] as string) ||
    (req.query.companyId as string) ||
    (req.query.tenantId as string);

  if (!candidateId) {
    return null;
  }

  // Buscar empresa por UUID o por nombre
  let company = await Company.findByPk(candidateId);
  if (!company) {
    company = await Company.findOne({
      where: {
        [Op.or]: [
          { id: candidateId },
          { name: candidateId },
          { taxId: candidateId },
        ],
      },
    });
  }

  if (!company) {
    return {
      companyId: candidateId,
      companyName: candidateId,
    };
  }

  return {
    companyId: company.id,
    companyName: company.name,
    taxId: company.taxId,
  };
}

/**
 * Construye la cláusula WHERE para filtrar vehículos por la empresa activa.
 */
export async function getFleetTenantWhere(req: Request): Promise<any> {
  const tenant = await getTenantContext(req);
  if (!tenant) {
    return {};
  }

  return {
    [Op.or]: [
      { companyId: tenant.companyId },
      { empresa: tenant.companyName },
    ],
  };
}

/**
 * Obtiene todas las placas autorizadas para el tenant activo.
 *
 * Lee desde la tabla espejo `flota_vehiculos` (la cual se mantiene en
 * sincronización con MSSQL Profit AD_TRANS vía MasterSyncService).
 */
export async function getAuthorizedPlatesForTenant(req: Request): Promise<string[]> {
  const tenant = await getTenantContext(req);
  const unidades = await listUnidadesForTenant(tenant?.companyName ?? null);
  return unidades.map((v) => v.placa).filter(Boolean);
}
