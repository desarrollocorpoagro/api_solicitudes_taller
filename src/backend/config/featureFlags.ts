/**
 * Banderas de funcionalidad del sistema.
 *
 * TENANT_ISOLATION_ENABLED:
 * - false (valor por defecto): NO se aplican restricciones de empresa activa
 *   al aperturar, consultar, cerrar o modificar órdenes, ni al listar despachos.
 * - true (TENANT_ISOLATION_ENABLED=true): se reactiva el aislamiento estricto
 *   original multi-tenant.
 */
export const TENANT_ISOLATION_ENABLED = process.env.TENANT_ISOLATION_ENABLED === 'true';