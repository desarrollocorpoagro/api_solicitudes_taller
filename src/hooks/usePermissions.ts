import { useMemo, useCallback } from 'react';
import {
  hasPermission,
  hasAnyPermission,
  getEffectivePermissions,
  getVisibleNavItems,
  ModuleKey,
  Action,
  PermissionContext,
} from '../utils/permissions';

/**
 * Hook de React que expone utilidades para validar permisos en componentes.
 * Envuelve las funciones puras de `utils/permissions` para evitar repetir
 * el contexto en cada llamada.
 *
 *   const { can, canAny, isAdmin, roleLabel } = usePermissions(currentUser);
 *   if (!can('taller', 'approve')) return null;
 */
export function usePermissions(currentUser?: any) {
  const ctx: PermissionContext = useMemo(
    () => ({
      role: currentUser?.role,
      permissions: currentUser?.permissions,
    }),
    [currentUser?.role, currentUser?.permissions]
  );

  const role = (currentUser?.role || '').toUpperCase();
  const isAdmin = role === 'ADMIN';

  const can = useCallback(
    (module: ModuleKey, action: Action) => hasPermission(ctx, module, action),
    [ctx]
  );

  const canAny = useCallback(
    (module: ModuleKey, actions: Action[]) => hasAnyPermission(ctx, module, actions),
    [ctx]
  );

  const permissions = useMemo(() => getEffectivePermissions(ctx), [ctx]);

  const visibleNav = useMemo(() => getVisibleNavItems(ctx), [ctx]);

  return {
    can,
    canAny,
    isAdmin,
    roleLabel: currentUser?.role || 'Sin Rol',
    permissions,
    visibleNav,
  };
}