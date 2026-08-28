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
  Shield,
  Layers
} from 'lucide-react';
import LoginScreen from './components/LoginScreen';
import TallerModule from './components/TallerModule';
import UserManagementModule from './components/UserManagementModule';
import SwaggerModule from './components/SwaggerModule';
import NotificationsModule from './components/NotificationsModule';
import MultimediaModule from './components/MultimediaModule';
import TestConsoleModule from './components/TestConsoleModule';

export default function App() {
  const [token, setToken] = useState<string>('');
  const [user, setUser] = useState<any>(null);
  const [companies, setCompanies] = useState<any[]>([]);
  const [activeCompany, setActiveCompany] = useState<any>(null);
  const [activeNav, setActiveNav] = useState<'taller' | 'usuarios' | 'swagger' | 'notificaciones' | 'multimedia' | 'pruebas'>('taller');
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
            <div className="mark">
              <div className="mark-tile">
                <span className="text-[#003366] font-extrabold text-lg italic tracking-tighter">SL</span>
              </div>
              <div className="mark-txt">
                <span>GRUPO SAN LUIS</span>
                <i />
              </div>
            </div>
          </div>

          {/* Selector de Tenant / Empresa Activa & Usuario & Logout */}
          <div className="flex items-center gap-3 flex-wrap">
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

        {/* Barra de Navegación de Módulos */}
        <div className="tabs">
          <div className="tabs-in">
            {[
              { id: 'taller', label: 'Taller San Luis', icon: Wrench },
              { id: 'usuarios', label: 'Gestión Usuarios (RBAC)', icon: Users },
              { id: 'swagger', label: 'Swagger API Explorer', icon: BookOpen },
              { id: 'notificaciones', label: 'Notificaciones & Push', icon: Bell },
              { id: 'multimedia', label: 'Archivos Multimedia', icon: ImageIcon },
              { id: 'pruebas', label: 'Consola Pruebas Unitarias', icon: Terminal },
            ].map((nav) => {
              const Icon = nav.icon;
              const isActive = activeNav === nav.id;
              return (
                <button
                  key={nav.id}
                  onClick={() => setActiveNav(nav.id as any)}
                  className={`tab ${isActive ? 'active' : ''}`}
                  aria-selected={isActive}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-[var(--navy)]' : 'text-[var(--slate)]'}`} />
                  {nav.label}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Contenido Principal */}
      <main className="flex-1 w-full max-w-[1120px] mx-auto p-4 sm:p-6">
        {activeNav === 'taller' && <TallerModule token={token} activeCompany={activeCompany} />}
        {activeNav === 'usuarios' && <UserManagementModule token={token} currentUser={user} />}
        {activeNav === 'swagger' && <SwaggerModule />}
        {activeNav === 'notificaciones' && <NotificationsModule />}
        {activeNav === 'multimedia' && <MultimediaModule />}
        {activeNav === 'pruebas' && <TestConsoleModule />}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-[var(--line)] text-[var(--slate)] text-xs py-4">
        <div className="max-w-[1120px] mx-auto px-4 flex flex-wrap justify-between items-center gap-2">
          <span>© 2026 Grupo San Luis — Plataforma Backend Multi-Tenant (MSSQL & Sequelize ORM)</span>
          <span className="font-mono text-[11px] text-[var(--slate)]">Identidad Corporativa San Luis • OpenAPI 3.0.3</span>
        </div>
      </footer>
    </div>
  );
}
