import React, { useState } from 'react';
import {
  Building2,
  Lock,
  Mail,
  Shield,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Wrench,
  Package,
  Truck,
  UserCheck,
  ClipboardCheck,
  FileCheck,
  Send,
  User
} from 'lucide-react';
import SanLuisLogo from './SanLuisLogo';

interface LoginScreenProps {
  onLoginSuccess: (data: {
    token: string;
    user: any;
    activeCompany: any;
    companies: any[];
  }) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Paso 2: Selección de Empresa Multi-Tenant (si aplica)
  const [preAuthData, setPreAuthData] = useState<{
    user: any;
    companies: any[];
    preAuthToken: string;
  } | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');

    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Credenciales no válidas. Verifique sus datos.');
      }

      const availableCompanies = data.companies || [];

      // Si solo tiene 1 empresa o se desea auto-seleccionar, o mostrar paso de selección
      if (availableCompanies.length === 1) {
        // Auto-seleccionar la única empresa asignada
        await handleCompanySelection(availableCompanies[0].id, data.preAuthToken, data.user, availableCompanies);
      } else {
        // Mostrar vista de selección de empresa / tenant
        setPreAuthData({
          user: data.user,
          companies: availableCompanies,
          preAuthToken: data.preAuthToken,
        });
        setSelectedCompanyId(availableCompanies[0]?.id || '');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error de conexión con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  const handleCompanySelection = async (
    companyIdToSelect: string,
    tokenToUse?: string,
    userData?: any,
    compsList?: any[]
  ) => {
    setLoading(true);
    setErrorMessage('');

    const token = tokenToUse || preAuthData?.preAuthToken;
    const currentUser = userData || preAuthData?.user;
    const currentCompanies = compsList || preAuthData?.companies || [];

    try {
      const res = await fetch('/api/v1/auth/select-company', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ companyId: companyIdToSelect }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Error al acceder a la empresa seleccionada.');
      }

      // Login completado exitosamente
      onLoginSuccess({
        token: data.token,
        user: currentUser,
        activeCompany: data.activeCompany,
        companies: currentCompanies,
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al seleccionar empresa.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (userEmail: string, userPass: string) => {
    setEmail(userEmail);
    setPassword(userPass);
    setErrorMessage('');
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--paper)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        fontFamily: "'Rubik', system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Contenedor Principal */}
      <div style={{ maxWidth: 460, width: '100%' }}>
        {/* Cabecera del Portal con Identidad San Luis */}
        <div
          style={{
            background: 'var(--navy)',
            borderRadius: 'var(--r) var(--r) 0 0',
            borderBottom: '4px solid var(--lime)',
            padding: '24px 20px',
            textAlign: 'center',
            color: '#fff',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <SanLuisLogo variant="inverse" height={44} />
          {/* <img
            src="./assets/logo-sanluis.png"
            alt="Logo San Luis"
            style={{ width: 120, height: 'auto' }}
          /> */}
          <p style={{ fontSize: 13, color: '#9DB8D4', margin: '4px 0 0', letterSpacing: '.3px' }}>
            Portal Integral de Taller y Gestión de Flota 
          </p>
        </div>

        {/* Tarjeta de Formulario */}
        <div
          className="card"
          style={{
            borderRadius: '0 0 var(--r) var(--r)',
            marginTop: 0,
            padding: 24,
            boxShadow: '0 4px 16px rgba(0, 35, 71, 0.08)',
          }}
        >
          {errorMessage && (
            <div className="note n-bad" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertCircle className="w-4 h-4 shrink-0 text-[var(--bad)]" />
              <span>{errorMessage}</span>
            </div>
          )}

          {!preAuthData ? (
            /* PASO 1: Formulario de Credenciales */
            <form onSubmit={handleCredentialsSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <h2 style={{ fontSize: 18, marginBottom: 2 }}>Iniciar Sesión</h2>
                <p className="hint" style={{ marginBottom: 0 }}>
                  Ingrese sus credenciales corporativas autorizadas.
                </p>
              </div>

              <label className="f">
                <span className="req">Correo Electrónico</span>
                <div style={{ position: 'relative' }}>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="usuario@empresasanluis.com"
                    autoComplete="email"
                    style={{ paddingLeft: 38 }}
                  />
                  <Mail
                    className="w-4 h-4 text-[var(--slate)]"
                    style={{ position: 'absolute', left: 12, top: 13 }}
                  />
                </div>
              </label>

              <label className="f">
                <span className="req">Contraseña</span>
                <div style={{ position: 'relative' }}>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    autoComplete="current-password"
                    className="mono"
                    style={{ paddingLeft: 38 }}
                  />
                  <Lock
                    className="w-4 h-4 text-[var(--slate)]"
                    style={{ position: 'absolute', left: 12, top: 13 }}
                  />
                </div>
              </label>

              <button
                type="submit"
                disabled={loading || !email || !password}
                className="btn dark"
                style={{ width: '100%', marginTop: 4, fontWeight: 600 }}
              >
                {loading ? 'Validando Credenciales...' : 'Acceder al Sistema'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          ) : (
            /* PASO 2: Selección de Empresa / Tenant Asignado */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <CheckCircle2 className="w-4 h-4 text-[var(--ok)]" />
                  <span className="badge b-ok" style={{ fontSize: 11 }}>
                    Usuario Autenticado: {preAuthData.user.fullName}
                  </span>
                </div>
                <h2 style={{ fontSize: 18, marginBottom: 2 }}>Seleccione la Empresa Activa</h2>
                <p className="hint" style={{ marginBottom: 0 }}>
                  Su cuenta tiene acceso a múltiples unidades de negocio del Grupo San Luis.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {preAuthData.companies.map((c) => {
                  const isSelected = selectedCompanyId === c.id;
                  return (
                    <div
                      key={c.id}
                      onClick={() => setSelectedCompanyId(c.id)}
                      style={{
                        padding: 12,
                        borderRadius: 'var(--r)',
                        border: `2px solid ${isSelected ? 'var(--navy)' : 'var(--line)'}`,
                        background: isSelected ? 'var(--lime-soft)' : '#fff',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 'var(--r)',
                            background: isSelected ? 'var(--navy)' : 'var(--paper)',
                            color: isSelected ? '#fff' : 'var(--navy)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Building2 className="w-4 h-4" />
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--navy)' }}>
                            {c.name}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--slate)', textTransform: 'uppercase' }}>
                            RIF: {c.taxId} • Rol: {c.role || 'OPERADOR'}
                          </div>
                        </div>
                      </div>

                      <input
                        type="radio"
                        name="selectedCompany"
                        checked={isSelected}
                        onChange={() => setSelectedCompanyId(c.id)}
                        style={{ width: 18, height: 18, minHeight: 'auto', accentColor: 'var(--navy)', cursor: 'pointer' }}
                      />
                    </div>
                  );
                })}
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <button
                  type="button"
                  onClick={() => setPreAuthData(null)}
                  className="btn"
                  style={{ flex: 1 }}
                >
                  Volver
                </button>
                <button
                  type="button"
                  disabled={loading || !selectedCompanyId}
                  onClick={() => handleCompanySelection(selectedCompanyId)}
                  className="btn amber"
                  style={{ flex: 2 }}
                >
                  {loading ? 'Ingresando...' : 'Continuar a la Empresa'}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Cuentas de Acceso Rápido / Demo */}
          <div
            style={{
              marginTop: 20,
              paddingTop: 16,
              borderTop: '1px solid var(--line-soft)',
            }}
          >
            <span
              style={{
                display: 'block',
                fontSize: 10,
                letterSpacing: '1.2px',
                textTransform: 'uppercase',
                color: 'var(--slate)',
                fontWeight: 600,
                marginBottom: 8,
              }}
            >
              Cuentas de Acceso Rápido por Rol (Pruebas del Sistema)
            </span>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
              <button
                type="button"
                onClick={() => handleQuickLogin('admin@empresasanluis.com', 'Password123!')}
                className="btn"
                style={{
                  padding: '6px 8px',
                  minHeight: 'auto',
                  fontSize: 11,
                  justifyContent: 'flex-start',
                  textAlign: 'left',
                }}
              >
                <Shield className="w-3.5 h-3.5 text-[var(--navy)]" />
                <div>
                  <b style={{ display: 'block' }}>Admin Global</b>
                  <span style={{ fontSize: 9, color: 'var(--slate)' }}>Todas las empresas</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('gerente.taller@empresasanluis.com', 'Password123!')}
                className="btn"
                style={{
                  padding: '6px 8px',
                  minHeight: 'auto',
                  fontSize: 11,
                  justifyContent: 'flex-start',
                  textAlign: 'left',
                }}
              >
                <UserCheck className="w-3.5 h-3.5 text-[var(--navy)]" />
                <div>
                  <b style={{ display: 'block' }}>Gerente Taller</b>
                  <span style={{ fontSize: 9, color: 'var(--slate)' }}>Aprobaciones & Cierre</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('supervisor.taller@empresasanluis.com', 'Password123!')}
                className="btn"
                style={{
                  padding: '6px 8px',
                  minHeight: 'auto',
                  fontSize: 11,
                  justifyContent: 'flex-start',
                  textAlign: 'left',
                }}
              >
                <ClipboardCheck className="w-3.5 h-3.5 text-blue-600" />
                <div>
                  <b style={{ display: 'block' }}>Supervisor Taller</b>
                  <span style={{ fontSize: 9, color: 'var(--slate)' }}>Supervisión técnica</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('flota@empresasanluis.com', 'Password123!')}
                className="btn"
                style={{
                  padding: '6px 8px',
                  minHeight: 'auto',
                  fontSize: 11,
                  justifyContent: 'flex-start',
                  textAlign: 'left',
                }}
              >
                <Truck className="w-3.5 h-3.5 text-amber-600" />
                <div>
                  <b style={{ display: 'block' }}>Responsable Flota</b>
                  <span style={{ fontSize: 9, color: 'var(--slate)' }}>Gestión de unidades</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('jose.ramirez@empresasanluis.com', 'Password123!')}
                className="btn"
                style={{
                  padding: '6px 8px',
                  minHeight: 'auto',
                  fontSize: 11,
                  justifyContent: 'flex-start',
                  textAlign: 'left',
                }}
              >
                <Wrench className="w-3.5 h-3.5 text-[var(--hi)]" />
                <div>
                  <b style={{ display: 'block' }}>Técnico Mecánico</b>
                  <span style={{ fontSize: 9, color: 'var(--slate)' }}>Diagnóstico & Repuestos</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('almacen@empresasanluis.com', 'Password123!')}
                className="btn"
                style={{
                  padding: '6px 8px',
                  minHeight: 'auto',
                  fontSize: 11,
                  justifyContent: 'flex-start',
                  textAlign: 'left',
                }}
              >
                <Package className="w-3.5 h-3.5 text-[var(--ok)]" />
                <div>
                  <b style={{ display: 'block' }}>Almacenista</b>
                  <span style={{ fontSize: 9, color: 'var(--slate)' }}>Despacho & Kárdex</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('auditor@empresasanluis.com', 'Password123!')}
                className="btn"
                style={{
                  padding: '6px 8px',
                  minHeight: 'auto',
                  fontSize: 11,
                  justifyContent: 'flex-start',
                  textAlign: 'left',
                }}
              >
                <FileCheck className="w-3.5 h-3.5 text-purple-600" />
                <div>
                  <b style={{ display: 'block' }}>Auditor Calidad</b>
                  <span style={{ fontSize: 9, color: 'var(--slate)' }}>Trazabilidad & Logs</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('solicitante@empresasanluis.com', 'Password123!')}
                className="btn"
                style={{
                  padding: '6px 8px',
                  minHeight: 'auto',
                  fontSize: 11,
                  justifyContent: 'flex-start',
                  textAlign: 'left',
                }}
              >
                <Send className="w-3.5 h-3.5 text-teal-600" />
                <div>
                  <b style={{ display: 'block' }}>Solicitante</b>
                  <span style={{ fontSize: 9, color: 'var(--slate)' }}>Apertura de servicios</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('operador@empresasanluis.com', 'Password123!')}
                className="btn"
                style={{
                  padding: '6px 8px',
                  minHeight: 'auto',
                  fontSize: 11,
                  justifyContent: 'flex-start',
                  textAlign: 'left',
                  gridColumn: 'span 2',
                }}
              >
                <Truck className="w-3.5 h-3.5 text-[var(--info)]" />
                <div>
                  <b style={{ display: 'block' }}>Operador / Conductor</b>
                  <span style={{ fontSize: 9, color: 'var(--slate)' }}>Visualización de unidades e historial de ruta</span>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Pie de pantalla */}
        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 11, color: 'var(--slate)' }}>
          © 2026 Grupo San Luis • 
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
