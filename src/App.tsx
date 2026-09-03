import React, { useState, useEffect } from 'react';
import {
  Wrench,
  Settings,
  Users,
  BookOpen,
  Bell,
  Image as ImageIcon,
  Terminal,
  FolderOpen,
  Stethoscope,
  Package,
  ExternalLink,
  CheckCircle,
  Archive,
  Lock,
  ClipboardList,
  Building2,
  LogOut,
} from 'lucide-react';
import LoginScreen from './components/LoginScreen';
import TallerModule from './components/TallerModule';
import UserManagementModule from './components/UserManagementModule';
import SwaggerModule from './components/SwaggerModule';
import NotificationsModule from './components/NotificationsModule';
import MultimediaModule from './components/MultimediaModule';
import TestConsoleModule from './components/TestConsoleModule';
import SyncStatusBadge from './components/SyncStatusBadge';
import RoleSimulatorBar from './components/RoleSimulatorBar';
import SanLuisLogo from './components/SanLuisLogo';

// ─── Tipos del menú jerárquico ────────────────────────────────────────────────
export type ModuleId =
  | 'taller'
  | 'users'
  | 'swagger'
  | 'notifications'
  | 'multimedia'
  | 'query_runner';

export type Permission = 'read' | 'write' | 'admin';

export interface NavItem {
  id: string;
  label: string;
  icon: any;
  module?: ModuleId;
  requires?: Permission;
  children?: NavItem[];
}

export const navItems: NavItem[] = [
  {
    id: 'taller',
    label: 'Taller San Luis',
    icon: Wrench,
    children: [
      { id: 'apertura', label: '01 APERTURA', icon: FolderOpen, module: 'taller', requires: 'read' },
      { id: 'areas-diagnostico', label: '02 ÁREAS Y DIAGNÓSTICO', icon: Stethoscope, module: 'taller', requires: 'read' },
      { id: 'repuestos', label: '03 REPUESTOS', icon: Package, module: 'taller', requires: 'read' },
      { id: 'externos', label: '04 EXTERNOS', icon: ExternalLink, module: 'taller', requires: 'read' },
      { id: 'aprobaciones', label: '05 APROBACIONES', icon: CheckCircle, module: 'taller', requires: 'read' },
      { id: 'almacen', label: '06 ALMACÉN', icon: Archive, module: 'taller', requires: 'read' },
      { id: 'cierre', label: '07 CIERRE', icon: Lock, module: 'taller', requires: 'read' },
      { id: 'auditoria', label: '08 AUDITORÍA Y TRAZABILIDAD', icon: ClipboardList, module: 'taller', requires: 'read' },
    ],
  },
  {
    id: 'configuracion',
    label: 'Configuración',
    icon: Settings,
    children: [
      { id: 'usuarios', label: 'Gestión Usuarios (RBAC)', icon: Users, module: 'users', requires: 'read' },
      { id: 'swagger', label: 'Swagger API Explorer', icon: BookOpen, module: 'swagger', requires: 'read' },
      { id: 'notificaciones', label: 'Notificaciones & Push', icon: Bell, module: 'notifications', requires: 'read' },
      { id: 'multimedia', label: 'Archivos Multimedia', icon: ImageIcon, module: 'multimedia', requires: 'read' },
      { id: 'pruebas', label: 'Consola Pruebas Unitarias', icon: Terminal, module: 'query_runner', requires: 'read' },
    ],
  },
];

// IDs de las 8 fases internas del taller (alias para activeTab)
export type TallerSubNav =
  | 'apertura'
  | 'areas'
  | 'repuestos'
  | 'externos'
  | 'aprob'
  | 'almacen'
  | 'cierre'
  | 'auditoria';

// Mapeo desde id del menú jerárquico → pestaña interna del TallerModule
const SUBNAV_TO_TALLER_TAB: Record<string, TallerSubNav> = {
  'apertura': 'apertura',
  'areas-diagnostico': 'areas',
  'repuestos': 'repuestos',
  'externos': 'externos',
  'aprobaciones': 'aprob',
  'almacen': 'almacen',
  'cierre': 'cierre',
  'auditoria': 'auditoria',
};

// ─── Permisos por rol (RBAC) ──────────────────────────────────────────────────
// Contrato: GET /api/v1/roles-permissions/role/:role → { success, data: [{ module, actions }] }
// module es ModuleId; actions incluye 'read' cuando el rol puede acceder.
export type RolePermissionsMap = Record<string, string[]>;

const canAccess = (
  perms: RolePermissionsMap | null,
  moduleId: ModuleId | undefined,
  required: Permission | undefined
): boolean => {
  // Si el item no declara módulo (p.ej. sólo agrupador) o no requiere permiso, se permite.
  if (!moduleId || !required) return true;
  // Mientras no tengamos permisos cargados (null) dejamos visible para no romper la UX.
  if (!perms) return true;
  const actions = perms[moduleId] || [];
  return actions.includes(required);
};

const filterNavItemsByRole = (
  items: NavItem[],
  perms: RolePermissionsMap | null
): NavItem[] => {
  return items
    .map((parent) => {
      const filteredChildren = parent.children?.filter((c) =>
        canAccess(perms, c.module, c.requires)
      );
      // Si el padre tiene hijos visibles, se muestra; si era un agrupador sin hijos propios, se oculta.
      if (parent.children) {
        if (!filteredChildren || filteredChildren.length === 0) return null;
        return { ...parent, children: filteredChildren };
      }
      // Item sin hijos: se filtra por su propio module/requires
      return canAccess(perms, parent.module, parent.requires) ? parent : null;
    })
    .filter((x): x is NavItem => x !== null);
};

export default function App() {
  const [token, setToken] = useState<string>('');
  const [user, setUser] = useState<any>(null);
  const [companies, setCompanies] = useState<any[]>([]);
  const [activeCompany, setActiveCompany] = useState<any>(null);
  // activeNav = id del item del menú (puede ser padre 'taller'/'configuracion'
  // o hijo directo 'apertura'/'areas-diagnostico'/etc.)
  const [activeNav, setActiveNav] = useState<string>('apertura');
  const [expandedParent, setExpandedParent] = useState<string | null>('taller');

  // Permisos efectivos del rol activo (moduleId → actions[])
  const [rolePerms, setRolePerms] = useState<RolePermissionsMap | null>(null);

  const [loading, setLoading] = useState(false);

  const handleLoginSuccess = (data: {
    token: string;
    user: any;
    activeCompany: any;
    companies: any[];
  }) => {
    setToken(data.token);
    setUser(data.user);
    setActiveCompany(data.activeCompany);
    setCompanies(data.companies);
    // Cargar permisos efectivos del rol (incluye merge con custom user perms)
    fetchRolePermissions(data.user?.role, data.token);
  };

  // Carga permisos del rol activo. Si el usuario tiene permisos personalizados
  // (customUserPermissions) se aplican como override sobre los del rol.
  const fetchRolePermissions = async (role: string | undefined, authToken: string) => {
    if (!role) {
      setRolePerms(null);
      return;
    }
    try {
      const res = await fetch(`/api/v1/roles-permissions/role/${role}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        const map: RolePermissionsMap = {};
        data.data.forEach((p: any) => {
          map[p.module] = Array.isArray(p.actions) ? p.actions : [];
        });
        setRolePerms(map);
      } else {
        setRolePerms({});
      }
    } catch (err) {
      console.error('Error cargando permisos del rol:', err);
      setRolePerms({});
    }
  };

  const handleLogout = () => {
    setToken('');
    setUser(null);
    setActiveCompany(null);
    setCompanies([]);
    setActiveNav('apertura');
    setExpandedParent('taller');
    setRolePerms(null);
  };

  const handleSwitchCompany = async (compId: string) => {
    setLoading(true);
    try {
      // Re-autenticar o seleccionar empresa
      const resLogin = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user?.email, password: 'Password123!' }),
      });
      const dataLogin = await resLogin.json();
      if (dataLogin.success) {
        const resSelect = await fetch('/api/v1/auth/select-company', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${dataLogin.preAuthToken}`,
          },
          body: JSON.stringify({ companyId: compId }),
        });
        const dataSelect = await resSelect.json();
        if (dataSelect.success) {
          setToken(dataSelect.token);
          setActiveCompany(dataSelect.activeCompany);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchRole = async (userEmail: string) => {
    setLoading(true);
    try {
      const resLogin = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail, password: 'Password123!' }),
      });
      const dataLogin = await resLogin.json();
      if (dataLogin.success && dataLogin.companies?.length > 0) {
        const matchingComp = dataLogin.companies.find((c: any) => c.id === activeCompany?.id);
        const compIdToSelect = matchingComp ? matchingComp.id : dataLogin.companies[0].id;

        const resSelect = await fetch('/api/v1/auth/select-company', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${dataLogin.preAuthToken}`,
          },
          body: JSON.stringify({ companyId: compIdToSelect }),
        });
        const dataSelect = await resSelect.json();
        if (dataSelect.success) {
          setToken(dataSelect.token);
          setUser(dataLogin.user);
          setActiveCompany(dataSelect.activeCompany);
          setCompanies(dataLogin.companies);
          // Recargar permisos del nuevo rol (puede diferir del anterior)
          fetchRolePermissions(dataLogin.user?.role, dataSelect.token);
        }
      }
    } catch (err) {
      console.error('Error al cambiar de rol de prueba:', err);
    } finally {
      setLoading(false);
    }
  };

  // Aplica el filtro RBAC al árbol de navegación para el rol activo
  const visibleNavItems = filterNavItemsByRole(navItems, rolePerms);

  // Si el activeNav quedó oculto tras un cambio de permisos, caer al primer item visible
  useEffect(() => {
    if (!visibleNavItems.length) return;
    const stillVisible = visibleNavItems.some((p) =>
      p.children?.some((c) => c.id === activeNav) || p.id === activeNav
    );
    if (!stillVisible) {
      const firstParent = visibleNavItems[0];
      const firstLeaf = firstParent.children?.[0];
      if (firstLeaf) {
        setActiveNav(firstLeaf.id);
        setExpandedParent(firstParent.id);
      }
    }
  }, [visibleNavItems, activeNav]);

  // Si no hay sesión activa, mostrar la pantalla de Login
  if (!token || !user || !activeCompany) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)] flex flex-col font-['Rubik']">
      {/* Top Header Corporativo Grupo San Luis */}
      <header className="topbar">
        <div className="topbar-in">
          <div className="flex items-center gap-3">
            <SanLuisLogo variant="inverse" height={30} subtext="Taller & Flota" />
          </div>

          {/* Selector de Tenant / Empresa Activa & Usuario & Sync & Logout */}
          <div className="flex items-center gap-3 flex-wrap">
            <SyncStatusBadge token={token} />

            <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-[var(--r)] border border-white/20">
              <Building2 className="w-4 h-4 text-[var(--lime)]" />
              <div>
                <span className="block text-[9px] text-[#9DB8D4] uppercase font-semibold leading-none">Empresa Activa</span>
                <select
                  value={activeCompany?.id}
                  onChange={(e) => handleSwitchCompany(e.target.value)}
                  className="bg-transparent text-white font-semibold text-xs focus:outline-none cursor-pointer pr-2 border-0 p-0 min-h-0"
                >
                  {companies.map((c) => (
                    <option key={c.id} value={c.id} className="text-[#12232E]">
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Badge de Usuario */}
            <div className="flex items-center gap-2 text-xs bg-white/10 border border-white/20 px-3 py-1.5 rounded-[var(--r)]">
              <div className="w-6 h-6 rounded-full bg-[var(--lime)] text-[var(--navy)] font-bold flex items-center justify-center text-xs">
                {user?.fullName?.charAt(0) || 'U'}
              </div>
              <div>
                <span className="block font-semibold text-white leading-none text-xs">{user?.fullName || 'Usuario'}</span>
                <span className="text-[10px] text-[var(--lime)] font-mono">{user?.role || 'OPERADOR'}</span>
              </div>
            </div>

            {/* Botón Cerrar Sesión */}
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-xs text-rose-200 hover:text-white bg-rose-500/20 hover:bg-rose-600/40 border border-rose-400/30 px-3 py-2 rounded-[var(--r)] transition-all cursor-pointer"
              title="Cerrar sesión y volver a la pantalla de login"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-300" />
              <span className="font-semibold">Cerrar Sesión</span>
            </button>
          </div>
        </div>

        {/* Barra de Navegación Jerárquica: Padres + Submenús */}
        <div className="tabs">
          <div className="tabs-in">
            {visibleNavItems.map((parent) => {
              const ParentIcon = parent.icon;
              const isExpanded = expandedParent === parent.id;
              const hasActiveChild = parent.children?.some((c) => c.id === activeNav);

              return (
                <div key={parent.id} className="nav-group">
                  <button
                    onClick={() => setExpandedParent(isExpanded ? null : parent.id)}
                    className={`tab ${hasActiveChild ? 'active' : ''}`}
                    aria-expanded={isExpanded}
                    aria-haspopup="true"
                  >
                    <ParentIcon className={`w-4 h-4 ${hasActiveChild ? 'text-[var(--navy)]' : 'text-[var(--slate)]'}`} />
                    {parent.label}
                  </button>

                  {isExpanded && parent.children && (
                    <div className="nav-submenu" role="menu" aria-label={`${parent.label} submenú`}>
                      <div className="nav-submenu-header">
                        {parent.label}
                      </div>
                      {parent.children.map((child) => {
                        const ChildIcon = child.icon;
                        const isChildActive = activeNav === child.id;
                        return (
                          <button
                            key={child.id}
                            role="menuitem"
                            onClick={() => {
                              setExpandedParent(parent.id);
                              setActiveNav(child.id);
                            }}
                            className={`tab sub ${isChildActive ? 'active' : ''}`}
                            aria-selected={isChildActive}
                          >
                            <ChildIcon className={`w-3.5 h-3.5 ${isChildActive ? 'text-[var(--lime)]' : 'text-[var(--slate)]'}`} />
                            {child.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </header>

      {/* Simulador y Selector Rápido de Roles para Pruebas */}
      <RoleSimulatorBar
        currentUser={user}
        activeCompany={activeCompany}
        onSwitchRole={handleSwitchRole}
        loading={loading}
      />

      {/* Contenido Principal */}
      <main className="flex-1 w-full max-w-[1440px] mx-auto p-4 sm:p-6">
        {(() => {
          // Buscar el item activo recorriendo visibleNavItems (filtrado por RBAC)
          let activeModule: ModuleId | undefined;
          let tallerTab: TallerSubNav | undefined;
          for (const parent of visibleNavItems) {
            const leaf = parent.children?.find((c) => c.id === activeNav);
            if (leaf) {
              activeModule = leaf.module;
              if (activeModule === 'taller') {
                tallerTab = SUBNAV_TO_TALLER_TAB[leaf.id];
              }
              break;
            }
          }

          if (activeModule === 'taller') {
            return (
              <TallerModule
                token={token}
                activeCompany={activeCompany}
                currentUser={user}
                initialTab={tallerTab}
              />
            );
          }
          if (activeModule === 'users') return <UserManagementModule token={token} currentUser={user} />;
          if (activeModule === 'swagger') return <SwaggerModule />;
          if (activeModule === 'notifications') return <NotificationsModule />;
          if (activeModule === 'multimedia') return <MultimediaModule />;
          if (activeModule === 'query_runner') return <TestConsoleModule />;
          return null;
        })()}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-[var(--line)] text-[var(--slate)] text-xs py-4">
        <div className="max-w-[1440px] mx-auto px-4 flex flex-wrap justify-between items-center gap-2">
          <span>© 2026 Grupo San Luis — Plataforma Backend Multi-Tenant (MSSQL & Sequelize ORM)</span>
          <span className="font-mono text-[11px] text-[var(--slate)]">Identidad Corporativa San Luis • OpenAPI 3.0.3</span>
        </div>
      </footer>
    </div>
  );
}
