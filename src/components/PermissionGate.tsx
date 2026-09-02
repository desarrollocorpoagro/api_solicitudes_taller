import React from 'react';
import { Lock } from 'lucide-react';
import { hasPermission, hasAnyPermission, ModuleKey, Action, PermissionContext } from '../utils/permissions';

interface PermissionGateProps {
  currentUser?: any;
  module: ModuleKey;
  /** Acción individual o lista de acciones admitidas. */
  action?: Action | Action[];
  /** Si es `any`, basta con una de las acciones; si es `all`, se requieren todas. */
  match?: 'any' | 'all';
  /**
   * - 'hide' (default): no renderiza nada si no tiene permiso
   * - 'disable': renderiza children pero deshabilita los inputs/botones con aviso
   * - 'readonly': renderiza children forzando solo lectura
   * - 'placeholder': renderiza un mensaje inline indicando falta de permiso
   */
  mode?: 'hide' | 'disable' | 'readonly' | 'placeholder';
  /** Mensaje opcional para el placeholder */
  message?: string;
  /** El fragmento JSX que se renderizará condicionalmente. */
  children: React.ReactElement | React.ReactElement[] | null;
}

/**
 * Componente que oculta/deshabilita secciones de la UI según el rol del usuario.
 *
 * Comportamiento por defecto (`mode="hide"`): si el usuario no tiene el permiso
 * solicitado, no se renderiza nada.
 *
 * Úsalo para proteger botones, formularios o secciones completas:
 *
 *   <PermissionGate currentUser={user} module="taller" action="approve">
 *     <button onClick={aprobar}>Aprobar</button>
 *   </PermissionGate>
 *
 *   <PermissionGate currentUser={user} module="users" action="create" mode="placeholder">
 *     <UserForm />
 *   </PermissionGate>
 */
export const PermissionGate: React.FC<PermissionGateProps> = ({
  currentUser,
  module,
  action,
  match = 'any',
  mode = 'hide',
  message,
  children,
}) => {
  const ctx: PermissionContext = {
    role: currentUser?.role,
    permissions: currentUser?.permissions,
  };

  const actionsList: Action[] = Array.isArray(action)
    ? action
    : action
      ? [action]
      : [];

  let allowed = true;
  if (actionsList.length === 0) {
    // Si no se especifica acción, basta con acceso de lectura al módulo.
    allowed = hasPermission(ctx, module, 'read');
  } else if (match === 'all') {
    allowed = actionsList.every((a) => hasPermission(ctx, module, a));
  } else {
    allowed = hasAnyPermission(ctx, module, actionsList);
  }

  if (allowed) {
    return <>{children}</>;
  }

  if (mode === 'hide') return null;

  if (mode === 'placeholder') {
    const fallbackText =
      message ||
      `No tiene permisos de ${actionsList.join(' / ')} sobre el módulo ${module.toUpperCase()}.`;
    return (
      <div
        role="alert"
        style={{
          padding: '12px 14px',
          background: '#f8fafc',
          border: '1px dashed var(--line)',
          borderRadius: 'var(--r)',
          color: 'var(--slate)',
          fontSize: 13,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <Lock className="w-4 h-4" style={{ color: 'var(--slate)' }} />
        <span>
          <b style={{ color: 'var(--navy)' }}>Acceso restringido:</b> {fallbackText}
        </span>
      </div>
    );
  }

  if (mode === 'disable' || mode === 'readonly') {
    return (
      <>
          {React.Children.map(children, (child) => {
            if (!React.isValidElement(child)) return child;
            const isFormField =
              child.type === 'input' ||
              child.type === 'select' ||
              child.type === 'textarea';
            const isButton = child.type === 'button';

            const newProps: any = {};
            if (isFormField) {
              newProps.readOnly = true;
              newProps.disabled = mode === 'disable' ? true : false;
              newProps['aria-readonly'] = true;
              newProps.title = message || 'Acceso de solo lectura para su rol';
            } else if (isButton) {
              newProps.disabled = true;
              newProps['aria-disabled'] = true;
              newProps.style = {
                ...(child.props.style || {}),
                opacity: 0.55,
                cursor: 'not-allowed',
              };
              newProps.title = message || 'Acción no permitida para su rol';
            } else {
              newProps.style = { ...(child.props.style || {}), pointerEvents: 'none', opacity: 0.7 };
            }
            return React.cloneElement(child, newProps);
          })}
        </>
    );
  }

  return null;
};

export default PermissionGate;