/**
 * Sistema de permisos para el Frontend (RBAC - Role Based Access Control)
 *
 * Este módulo centraliza la lógica de permisos por rol/acción para todas las
 * pantallas del Frontend. ADMIN tiene permiso total; los demás roles solo
 * ven y ejecutan las acciones explícitamente registradas en su matriz.
 *
 * Reglas base (servidor de autoridad):
 *   - ADMIN → tiene TODAS las acciones en TODOS los módulos (acceso total)
 *   - Cualquier rol no listado → solo 'read' en módulos básicos
 *   - Permisos personalizados en JWT (`req.user.permissions`) tienen prioridad
 */

export type ModuleKey =
  | 'taller'
  | 'fleet'
  | 'almacen'
  | 'aprobaciones'
  | 'users'
  | 'permissions'
  | 'db_connections'
  | 'query_runner'
  | 'reports'
  | 'multimedia'
  | 'notifications'
  | 'swagger'
  | 'sync';

export type Action =
  | 'read'
  | 'create'
  | 'update'
  | 'delete'
  | 'approve'
  | 'reject'
  | 'dispatch'
  | 'close'
  | 'export'
  | 'test'
  | 'admin'
  | 'execute_query';

/**
 * Matriz estática de permisos por rol. Refleja la semilla del backend
 * (src/backend/models/index.ts) para que ADMIN tenga todo y los demás
 * roles solo lo registrado.
 */
export const ROLE_PERMISSIONS: Record<string, Array<{ module: ModuleKey; actions: Action[] }>> = {
  ADMIN: [
    { module: 'taller', actions: ['read', 'create', 'update', 'delete', 'approve', 'reject', 'close', 'admin'] },
    { module: 'fleet', actions: ['read', 'create', 'update', 'delete', 'admin'] },
    { module: 'almacen', actions: ['read', 'create', 'update', 'delete', 'dispatch', 'admin'] },
    { module: 'aprobaciones', actions: ['read', 'approve', 'reject', 'admin'] },
    { module: 'users', actions: ['read', 'create', 'update', 'delete', 'admin'] },
    { module: 'permissions', actions: ['read', 'update', 'admin'] },
    { module: 'db_connections', actions: ['read', 'create', 'update', 'delete', 'test', 'admin'] },
    { module: 'query_runner', actions: ['read', 'execute_query', 'admin'] },
    { module: 'reports', actions: ['read', 'export', 'admin'] },
    { module: 'multimedia', actions: ['read', 'create', 'update', 'delete', 'admin'] },
    { module: 'notifications', actions: ['read', 'create', 'admin'] },
    { module: 'swagger', actions: ['read'] },
    { module: 'sync', actions: ['read', 'admin'] },
  ],
  GERENTE_TALLER: [
    { module: 'taller', actions: ['read', 'create', 'update', 'approve', 'close', 'admin'] },
    { module: 'fleet', actions: ['read', 'update', 'admin'] },
    { module: 'almacen', actions: ['read', 'admin'] },
    { module: 'aprobaciones', actions: ['read', 'approve', 'reject', 'admin'] },
    { module: 'users', actions: ['read'] },
    { module: 'reports', actions: ['read', 'export', 'admin'] },
    { module: 'multimedia', actions: ['read', 'create', 'admin'] },
    { module: 'notifications', actions: ['read', 'create', 'admin'] },
    { module: 'swagger', actions: ['read'] },
    { module: 'sync', actions: ['read'] },
  ],
  SUPERVISOR: [
    { module: 'taller', actions: ['read', 'create', 'update', 'approve'] },
    { module: 'fleet', actions: ['read', 'update'] },
    { module: 'almacen', actions: ['read', 'create'] },
    { module: 'aprobaciones', actions: ['read'] },
    { module: 'reports', actions: ['read'] },
    { module: 'multimedia', actions: ['read', 'create'] },
    { module: 'notifications', actions: ['read'] },
    { module: 'swagger', actions: ['read'] },
    { module: 'sync', actions: ['read'] },
  ],
  RESPONSABLE_FLOTA: [
    { module: 'taller', actions: ['read', 'create'] },
    { module: 'fleet', actions: ['read', 'create', 'update'] },
    { module: 'reports', actions: ['read'] },
    { module: 'multimedia', actions: ['read', 'create'] },
    { module: 'notifications', actions: ['read'] },
    { module: 'swagger', actions: ['read'] },
    { module: 'sync', actions: ['read'] },
  ],
  MECANICO: [
    { module: 'taller', actions: ['read', 'create', 'update'] },
    { module: 'almacen', actions: ['read', 'create'] },
    { module: 'multimedia', actions: ['read', 'create'] },
    { module: 'notifications', actions: ['read'] },
    { module: 'swagger', actions: ['read'] },
  ],
  ALMACENISTA: [
    { module: 'taller', actions: ['read'] },
    { module: 'almacen', actions: ['read', 'dispatch', 'update'] },
    { module: 'reports', actions: ['read'] },
    { module: 'multimedia', actions: ['read', 'create'] },
    { module: 'notifications', actions: ['read'] },
    { module: 'swagger', actions: ['read'] },
    { module: 'sync', actions: ['read'] },
  ],
  AUDITOR: [
    { module: 'taller', actions: ['read'] },
    { module: 'fleet', actions: ['read'] },
    { module: 'almacen', actions: ['read'] },
    { module: 'aprobaciones', actions: ['read'] },
    { module: 'reports', actions: ['read', 'export'] },
    { module: 'multimedia', actions: ['read'] },
    { module: 'notifications', actions: ['read'] },
    { module: 'swagger', actions: ['read'] },
  ],
  SOLICITANTE: [
    { module: 'taller', actions: ['read', 'create'] },
    { module: 'fleet', actions: ['read'] },
    { module: 'multimedia', actions: ['read', 'create'] },
    { module: 'notifications', actions: ['read'] },
    { module: 'swagger', actions: ['read'] },
  ],
  OPERADOR: [
    { module: 'taller', actions: ['read'] },
    { module: 'fleet', actions: ['read'] },
    { module: 'notifications', actions: ['read'] },
  ],
};

/**
 * Definición de los módulos principales de navegación.
 * Cada ítem declara qué `module` consulta y qué acción mínima requiere
 * para que el usuario visualice esa opción en el menú principal.
 */
export interface NavItemDef {
  id: string;
  label: string;
  module: ModuleKey;
  /** Acción mínima requerida para que esta opción sea mostrada al usuario. */
  requires: Action;
}

export const NAV_ITEMS: NavItemDef[] = [
  { id: 'taller', label: 'Taller San Luis', module: 'taller', requires: 'read' },
  { id: 'usuarios', label: 'Gestión Usuarios (RBAC)', module: 'users', requires: 'read' },
  { id: 'swagger', label: 'Swagger API Explorer', module: 'swagger', requires: 'read' },
  { id: 'notificaciones', label: 'Notificaciones & Push', module: 'notifications', requires: 'read' },
  { id: 'multimedia', label: 'Archivos Multimedia', module: 'multimedia', requires: 'read' },
  { id: 'pruebas', label: 'Consola Pruebas Unitarias', module: 'query_runner', requires: 'read' },
];

export interface PermissionContext {
  role?: string;
  /** Permisos personalizados entregados por el backend en el JWT */
  permissions?: Array<{ module: string; actions: string[] }>;
}

/**
 * Devuelve la lista efectiva de permisos para el usuario actual.
 * Combina la matriz estática con permisos personalizados del JWT.
 * ADMIN siempre obtiene permisos completos de todos los módulos.
 */
export function getEffectivePermissions(ctx: PermissionContext): Array<{ module: string; actions: string[] }> {
  const role = (ctx.role || '').toUpperCase();

  // ADMIN: permisos totales garantizados
  if (role === 'ADMIN') {
    return Object.keys(ROLE_PERMISSIONS).length > 0
      ? Object.values(ROLE_PERMISSIONS).flat().reduce<Array<{ module: string; actions: string[] }>>((acc, p) => {
          if (!acc.some((x) => x.module === p.module)) {
            acc.push({ module: p.module, actions: ['admin'] });
          } else {
            const existing = acc.find((x) => x.module === p.module);
            if (existing) existing.actions = ['admin'];
          }
          return acc;
        }, [])
      : [];
  }

  const matrix = ROLE_PERMISSIONS[role] || [];
  const base: Array<{ module: string; actions: string[] }> = matrix.map((p) => ({
    module: p.module,
    actions: p.actions as string[],
  }));

  // Mezclar con permisos personalizados del JWT (el servidor es la autoridad)
  if (Array.isArray(ctx.permissions) && ctx.permissions.length > 0) {
    for (const p of ctx.permissions) {
      if (!p.module || !Array.isArray(p.actions)) continue;
      const existing = base.find((b) => b.module === p.module);
      if (existing) {
        // Unión de acciones (normalizamos a string para evitar líos con 'admin')
        const merged = Array.from(new Set<string>([...existing.actions, ...p.actions]));
        existing.actions = merged;
      } else {
        base.push({ module: p.module, actions: p.actions });
      }
    }
  }

  return base;
}

/**
 * Verifica si el usuario tiene permiso para realizar `action` sobre `module`.
 * ADMIN siempre retorna true.
 */
export function hasPermission(
  ctx: PermissionContext,
  module: ModuleKey,
  action: Action
): boolean {
  const role = (ctx.role || '').toUpperCase();

  // ADMIN: permiso total
  if (role === 'ADMIN') return true;

  const perms = getEffectivePermissions(ctx);
  const entry = perms.find((p) => p.module === module);
  if (!entry) return false;

  if (entry.actions.includes('admin')) return true;
  if (entry.actions.includes(action)) return true;

  // 'read' se concede implícitamente si el módulo tiene alguna acción permitida,
  // a menos que se esté pidiendo explícitamente otra cosa.
  if (action === 'read' && entry.actions.length > 0) return true;

  return false;
}

/**
 * Verifica si el usuario tiene CUALQUIERA de las acciones especificadas.
 */
export function hasAnyPermission(
  ctx: PermissionContext,
  module: ModuleKey,
  actions: Action[]
): boolean {
  return actions.some((a) => hasPermission(ctx, module, a));
}

/**
 * Devuelve la lista de ítems de navegación visibles para el usuario.
 */
export function getVisibleNavItems(ctx: PermissionContext): NavItemDef[] {
  return NAV_ITEMS.filter((item) => hasPermission(ctx, item.module, item.requires));
}

/**
 * Etiqueta legible del rol activo para mostrar en la UI.
 */
export function getRoleLabel(role?: string): string {
  const r = (role || '').toUpperCase();
  const map: Record<string, string> = {
    ADMIN: 'Administrador Global',
    GERENTE_TALLER: 'Gerente de Taller',
    SUPERVISOR: 'Supervisor de Taller',
    RESPONSABLE_FLOTA: 'Responsable de Flota',
    MECANICO: 'Técnico Mecánico',
    ALMACENISTA: 'Almacenista',
    AUDITOR: 'Auditor de Calidad',
    SOLICITANTE: 'Solicitante Operaciones',
    OPERADOR: 'Operador / Conductor',
  };
  return map[r] || r || 'Sin Rol';
}