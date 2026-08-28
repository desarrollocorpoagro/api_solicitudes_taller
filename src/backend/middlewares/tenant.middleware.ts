import { Request, Response, NextFunction } from 'express';

/**
 * REGLA DE CIBERSEGURIDAD SAN LUIS:
 * El tenant efectivo debe proceder de forma prioritaria del JWT autenticado.
 * NUNCA se confía ciegamente en headers o query params del cliente para evitar IDOR (Insecure Direct Object References).
 */
export const enforceTenantContext = (req: Request, res: Response, next: NextFunction) => {
  const jwtTenantId = req.user?.companyId;

  // Si ya viene fijado en el token criptográfico firmado
  if (jwtTenantId) {
    req.tenantId = jwtTenantId;
    return next();
  }

  // Si el usuario es ADMIN global y provee el header X-Tenant-ID
  const tenantHeader = req.headers['x-tenant-id'] as string;
  if (req.user?.role?.toUpperCase() === 'ADMIN' && tenantHeader) {
    req.tenantId = tenantHeader;
    return next();
  }

  return res.status(403).json({
    success: false,
    error: 'Acceso no autorizado. No existe un contexto de Tenant (Empresa) válido en la sesión activa.',
    code: 'TENANT_CONTEXT_MISSING',
  });
};
