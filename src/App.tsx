import React, { useState } from 'react';
import {
  Wrench,
  Users,
  BookOpen,
  Bell,
  Image as ImageIcon,
  Terminal,
  Building2,
  LogOut,
  ChevronDown
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
import PermissionGate from './components/PermissionGate';
import { usePermissions } from './hooks/usePermissions';

export default function App() {
  const [token, setToken] = useState<string>('');
  const [user, setUser] = useState<any>(null);
  const [companies, setCompanies] = useState<any[]>([]);
  const [activeCompany, setActiveCompany] = useState<any>(null);
  const [activeNav, setActiveNav] = useState<'taller' | 'usuarios' | 'swagger' | 'notificaciones' | 'multimedia' | 'pruebas'>('taller');
  const [loading, setLoading] = useState(false);

  // Hooks deben invocarse SIEMPRE en el mismo orden y antes de cualquier
  // early return. Si los movemos debajo del return de LoginScreen, React
  // detecta un cambio en el número de hooks entre renders
  // ("Rendered more hooks than during the previous render").
  const { visibleNav } = usePermissions(user);

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
  };

  const handleLogout = () => {
    setToken('');
    setUser(null);
    setActiveCompany(null);
    setCompanies([]);
    setActiveNav('taller');
  };

  const handleSwitchCompany = async (compId: string) => {
    setLoading(true);
    try {
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
        }
      }
    } catch (err) {
      console.error('Error al cambiar de rol de prueba:', err);
    } finally {
      setLoading(false);
    }
  };

  // Si no hay sesión activa, mostrar la pantalla de Login
  if (!token || !user || !activeCompany) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  // Definición maestra de los módulos de navegación. El filtro por permisos
  // se aplica al renderizar: ADMIN ve todo, los demás roles solo lo que su
  // matriz de permisos autorice.
  const navItems = [
    { id: 'taller', label: 'Taller San Luis', icon: Wrench, module: 'taller' as const, requires: 'read' as const },
    { id: 'usuarios', label: 'Gestión Usuarios (RBAC)', icon: Users, module: 'users' as const, requires: 'read' as const },
    { id: 'swagger', label: 'Swagger API Explorer', icon: BookOpen, module: 'swagger' as const, requires: 'read' as const },
    { id: 'notificaciones', label: 'Notificaciones & Push', icon: Bell, module: 'notifications' as const, requires: 'read' as const },
    { id: 'multimedia', label: 'Archivos Multimedia', icon: ImageIcon, module: 'multimedia' as const, requires: 'read' as const },
    { id: 'pruebas', label: 'Consola Pruebas Unitarias', icon: Terminal, module: 'query_runner' as const, requires: 'read' as const },
  ];

  // Filtra los ítems según permisos; ADMIN siempre ve todo.
  const filteredNav = navItems.filter((n) =>
    visibleNav.some((v) => v.id === n.id)
  );

  // Si la pestaña activa quedó oculta por un cambio de rol, vuelve a 'taller'
  // si está disponible o al primer ítem visible.
  
  console.log('filteredNav ',filteredNav)
  if (
    !filteredNav.some((n) => n.id === activeNav) &&
    filteredNav.length > 0
  ) {
    const fallback = filteredNav.find((n) => n.id === 'taller') ? 'taller' : (filteredNav[0]?.id as typeof activeNav);
    if (fallback) {
      setActiveNav(fallback as typeof activeNav);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)] flex flex-col font-['Rubik'] antialiased selection:bg-[var(--lime-soft)] selection:text-[var(--navy)]">
      {/* Top Header Corporativo Grupo San Luis */}
      <header className="topbar">
        <div className="topbar-in">
          <div className="flex items-center gap-3">
            <SanLuisLogo variant="inverse" height={30} subtext="Taller & Flota" />
          </div>

          {/* Selector de Tenant / Empresa Activa & Usuario & Sync & Logout */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <SyncStatusBadge token={token} />

            {/* Selector de Empresa */}
            <div className="flex items-center gap-2 bg-white/10 hover:bg-white/15 backdrop-blur-sm px-3 py-1.5 rounded-[var(--r)] border border-white/20 transition-colors">
              <Building2 className="w-4 h-4 text-[var(--lime)] shrink-0" />
              <div className="relative flex items-center pr-4">
                <div>
                  <span className="block text-[9px] text-[#9DB8D4] uppercase font-semibold leading-none tracking-wider">Empresa Activa</span>
                  <select
                    value={activeCompany?.id}
                    onChange={(e) => handleSwitchCompany(e.target.value)}
                    disabled={loading}
                    className="bg-transparent text-white font-semibold text-xs focus:outline-none cursor-pointer border-0 p-0 min-h-0 appearance-none leading-tight"
                  >
                    {companies.map((c) => (
                      <option key={c.id} value={c.id} className="text-[#12232E] bg-white">
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-white/70 absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Badge de Usuario */}
            <div className="flex items-center gap-2 text-xs bg-white/10 backdrop-blur-sm border border-white/20 px-3 py-1.5 rounded-[var(--r)]">
              <div className="w-6 h-6 rounded-full bg-[var(--lime)] text-[var(--navy)] font-bold flex items-center justify-center text-xs shrink-0 shadow-sm">
                {user?.fullName?.charAt(0) || 'U'}
              </div>
              <div className="hidden sm:block">
                <span className="block font-semibold text-white leading-tight text-xs">{user?.fullName || 'Usuario'}</span>
                <span className="text-[10px] text-[var(--lime)] font-mono leading-none block">{user?.role || 'OPERADOR'}</span>
              </div>
            </div>

            {/* Botón Cerrar Sesión */}
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-xs text-rose-200 hover:text-white bg-rose-500/20 hover:bg-rose-600/40 active:scale-95 border border-rose-400/30 px-3 py-2 rounded-[var(--r)] transition-all cursor-pointer"
              title="Cerrar sesión y volver a la pantalla de login"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-300" />
              <span className="font-semibold hidden md:inline">Cerrar Sesión</span>
            </button>
          </div>
        </div>

        {/* Barra de Navegación de Módulos */}
        <nav className="tabs" aria-label="Navegación principal de módulos">
          <div className="tabs-in">
            {filteredNav.map((nav) => {
              const Icon = nav.icon;
              const isActive = activeNav === nav.id;
              return (
                <button
                  key={nav.id}
                  onClick={() => setActiveNav(nav.id)}
                  className={`tab group ${isActive ? 'active' : ''}`}
                  aria-selected={isActive}
                  role="tab"
                >
                  <Icon className={`w-4 h-4 transition-colors ${isActive ? 'text-[var(--navy)]' : 'text-[var(--slate)] group-hover:text-[var(--ink)]'}`} />
                  <span>{nav.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      </header>

      {/* ============================================================
          BARRA DE SIMULACIÓN DE ROLES (solo para ADMIN)
          ------------------------------------------------------------
          Esta barra permite al Administrador Global saltar entre las
          cuentas semilla de cada rol (GERENTE_TALLER, SUPERVISOR,
          MECANICO, etc.) para validar la matriz RBAC y los módulos
          visibles por cada perfil.

          Restricciones:
          - Renderizada SOLO si el usuario tiene la acción 'admin'
            sobre el módulo 'permissions' (en la práctica, solo ADMIN).
          - Para el resto de roles el componente se oculta por completo
            (mode="hide") y la barra no aparece en el DOM.
          - Está separada del <header> corporativo para que sea claro
            que es una HERRAMIENTA DE PRUEBAS, no parte del flujo de
            negocio.
          ============================================================ */}
      <PermissionGate
        currentUser={user}
        module="permissions"
        action="admin"
        mode="hide"
      >
        <section
          aria-label="Herramienta de simulación de roles para pruebas QA"
          data-testid="role-simulator-bar"
          className="border-b border-amber-300/60 bg-amber-50/70"
        >
          <RoleSimulatorBar
            currentUser={user}
            activeCompany={activeCompany}
            onSwitchRole={handleSwitchRole}
            loading={loading}
          />
        </section>
      </PermissionGate>

      {/* Contenido Principal */}
      <main className="wrap flex-1">
        <div key={activeNav} className="module-fade">
          {activeNav === 'taller' && <TallerModule token={token} activeCompany={activeCompany} currentUser={user} />}
          {activeNav === 'usuarios' && visibleNav.some((v) => v.id === 'usuarios') && <UserManagementModule token={token} currentUser={user} />}
          {activeNav === 'swagger' && visibleNav.some((v) => v.id === 'swagger') && <SwaggerModule />}
          {activeNav === 'notificaciones' && visibleNav.some((v) => v.id === 'notificaciones') && <NotificationsModule currentUser={user} />}
          {activeNav === 'multimedia' && visibleNav.some((v) => v.id === 'multimedia') && <MultimediaModule currentUser={user} />}
          {activeNav === 'pruebas' && visibleNav.some((v) => v.id === 'pruebas') && <TestConsoleModule currentUser={user} />}
        </div>
      </main>

      {/* Footer Fijo en la Base */}
      <footer className="bg-white border-t border-[var(--line)] text-[var(--slate)] text-xs py-4 mt-auto">
        <div className="wrap !padding-0 flex flex-col sm:flex-row justify-between items-center gap-2 text-center sm:text-left !pb-0">
          <span>© 2026 Grupo San Luis )</span>
          <span className="font-mono text-[11px] text-[var(--slate)]"></span>
        </div>
      </footer>
    </div>
  );
}