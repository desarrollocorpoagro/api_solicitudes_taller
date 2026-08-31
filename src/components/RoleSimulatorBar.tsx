import React, { useState } from 'react';
import {
  Shield,
  UserCheck,
  ClipboardCheck,
  Truck,
  Wrench,
  Package,
  FileCheck,
  Send,
  User,
  Zap,
  Info,
  ChevronDown,
  ChevronUp,
  CheckCircle2
} from 'lucide-react';

export interface SystemRoleDef {
  role: string;
  label: string;
  email: string;
  name: string;
  icon: any;
  color: string;
  badgeBg: string;
  badgeText: string;
  description: string;
  primaryModule: string;
  focusTab: string;
  allowedActions: string[];
}

export const SYSTEM_ROLES: SystemRoleDef[] = [
  {
    role: 'ADMIN',
    label: 'Administrador Global',
    email: 'admin@empresasanluis.com',
    name: 'Administrador San Luis',
    icon: Shield,
    color: '#002347',
    badgeBg: '#e6f0fa',
    badgeText: '#002347',
    description: 'Acceso total a todas las empresas, órdenes, catálogo, usuarios, conexiones MSSQL y configuración de auditoría.',
    primaryModule: 'taller',
    focusTab: 'apertura',
    allowedActions: ['Crear/Editar OS', 'Aprobar Gastos', 'Despachar Almacén', 'Cerrar y Liquidar', 'Gestión RBAC', 'Consultas SQL'],
  },
  {
    role: 'GERENTE_TALLER',
    label: 'Gerente de Taller',
    email: 'gerente.taller@empresasanluis.com',
    name: 'Ing. Carlos Mendoza',
    icon: UserCheck,
    color: '#003366',
    badgeBg: '#e8f4fd',
    badgeText: '#003366',
    description: 'Aprobación de cotizaciones y repuestos, supervisión global de tiempos, liquidación y cierre técnico de órdenes.',
    primaryModule: 'taller',
    focusTab: 'aprob',
    allowedActions: ['Aprobar Repuestos', 'Aprobar Servicios Externos', 'Cierre de Orden', 'Supervisión de Áreas'],
  },
  {
    role: 'SUPERVISOR',
    label: 'Supervisor de Taller',
    email: 'supervisor.taller@empresasanluis.com',
    name: 'Téc. Marcos Peña',
    icon: ClipboardCheck,
    color: '#0284c7',
    badgeBg: '#e0f2fe',
    badgeText: '#0369a1',
    description: 'Asignación de mecánicos a áreas de trabajo, validación de diagnósticos y seguimiento de horas laboradas.',
    primaryModule: 'taller',
    focusTab: 'areas',
    allowedActions: ['Asignar Mecánicos', 'Crear Órdenes de Área', 'Supervisar Horas', 'Validar Diagnósticos'],
  },
  {
    role: 'RESPONSABLE_FLOTA',
    label: 'Responsable de Flota',
    email: 'flota@empresasanluis.com',
    name: 'Lic. Mariana Rojas',
    icon: Truck,
    color: '#d97706',
    badgeBg: '#fef3c7',
    badgeText: '#92400e',
    description: 'Monitoreo de kilometrajes, reporte de fallas de unidades, apertura de órdenes de servicio e historial vehicular.',
    primaryModule: 'taller',
    focusTab: 'apertura',
    allowedActions: ['Aperturar Orden', 'Control de Flota', 'Consulta de Historial', 'Reporte de Síntomas'],
  },
  {
    role: 'MECANICO',
    label: 'Técnico Mecánico',
    email: 'jose.ramirez@empresasanluis.com',
    name: 'José Ramírez (Técnico)',
    icon: Wrench,
    color: '#dc2626',
    badgeBg: '#fee2e2',
    badgeText: '#991b1b',
    description: 'Diagnóstico técnico en área asignada, registro de horas, solicitud de repuestos y solicitud de servicios externos.',
    primaryModule: 'taller',
    focusTab: 'areas',
    allowedActions: ['Registrar Diagnóstico', 'Solicitar Repuestos', 'Solicitar Externos', 'Cargar Fotos', 'Cerrar Área'],
  },
  {
    role: 'ALMACENISTA',
    label: 'Almacenista',
    email: 'almacen@empresasanluis.com',
    name: 'Pedro Morales (Almacén TLL-01)',
    icon: Package,
    color: '#16a34a',
    badgeBg: '#dcfce7',
    badgeText: '#166534',
    description: 'Despacho y entrega de repuestos, conciliación con stock Profit Plus, generación de requisiciones de compra.',
    primaryModule: 'taller',
    focusTab: 'almacen',
    allowedActions: ['Despachar Repuestos', 'Generar Requisición Profit', 'Ajuste de Inventario', 'Kárdex'],
  },
  {
    role: 'AUDITOR',
    label: 'Auditor de Calidad',
    email: 'auditor@empresasanluis.com',
    name: 'Lic. Francisco Rivas',
    icon: FileCheck,
    color: '#7c3aed',
    badgeBg: '#f3e8ff',
    badgeText: '#6b21a8',
    description: 'Trazabilidad y auditoría de cambios campo a campo, bitácoras de seguridad, validación de costos y tiempos.',
    primaryModule: 'taller',
    focusTab: 'auditoria',
    allowedActions: ['Consultar Auditoría', 'Ver Diferencias de Campos', 'Exportar Trazabilidad', 'Validar Tiempos'],
  },
  {
    role: 'SOLICITANTE',
    label: 'Solicitante Operaciones',
    email: 'solicitante@empresasanluis.com',
    name: 'Ing. Roberto Gómez',
    icon: Send,
    color: '#0d9488',
    badgeBg: '#ccfbf1',
    badgeText: '#115e59',
    description: 'Apertura de requerimientos de servicio vehicular para distribución y logística de transporte.',
    primaryModule: 'taller',
    focusTab: 'apertura',
    allowedActions: ['Solicitar Mantenimiento', 'Ver Estado de Solicitudes', 'Consultar Unidades'],
  },
  {
    role: 'OPERADOR',
    label: 'Operador / Conductor',
    email: 'operador@empresasanluis.com',
    name: 'Luis Márquez',
    icon: User,
    color: '#475569',
    badgeBg: '#f1f5f9',
    badgeText: '#334155',
    description: 'Consulta del estado de su vehículo asignado, historial de intervenciones y entrega de la unidad a taller.',
    primaryModule: 'taller',
    focusTab: 'apertura',
    allowedActions: ['Consultar Estado de Unidad', 'Ver Órdenes en Proceso', 'Historial Técnico'],
  },
];

interface RoleSimulatorBarProps {
  currentUser: any;
  activeCompany: any;
  onSwitchRole: (userEmail: string) => Promise<void>;
  loading?: boolean;
}

export const RoleSimulatorBar: React.FC<RoleSimulatorBarProps> = ({
  currentUser,
  activeCompany,
  onSwitchRole,
  loading = false,
}) => {
  const [expanded, setExpanded] = useState(false);
  const currentRoleDef = SYSTEM_ROLES.find(
    (r) => r.role === (currentUser?.role || 'OPERADOR')
  ) || SYSTEM_ROLES[0];

  return (
    <div
      style={{
        background: '#ffffff',
        borderBottom: '2px solid var(--line)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        padding: '8px 16px',
        fontSize: 13,
      }}
    >
      <div
        style={{
          maxWidth: 1120,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {/* Fila Principal de la Barra */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          {/* Indicador del Rol Actual */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                borderRadius: 'var(--r)',
                background: currentRoleDef.badgeBg,
                color: currentRoleDef.badgeText,
                fontWeight: 600,
                border: `1px solid ${currentRoleDef.color}33`,
              }}
            >
              <currentRoleDef.icon className="w-4 h-4" />
              <span>Rol Activo: {currentRoleDef.label}</span>
            </div>

            <span style={{ fontSize: 12, color: 'var(--slate)' }}>
              ({currentUser?.fullName || currentRoleDef.name}) • Empresa:{' '}
              <b style={{ color: 'var(--navy)' }}>{activeCompany?.name || 'San Luis'}</b>
            </span>
          </div>

          {/* Selector Rápido de Roles */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'uppercase',
                color: 'var(--slate)',
                letterSpacing: '.5px',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              Cambiar Rol para Pruebas:
            </span>

            {/* Botones rápidos para los roles más comunes */}
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {SYSTEM_ROLES.map((r) => {
                const isActive = (currentUser?.role || '') === r.role;
                const Icon = r.icon;
                return (
                  <button
                    key={r.role}
                    type="button"
                    disabled={loading}
                    onClick={() => onSwitchRole(r.email)}
                    title={`Simular rol ${r.label}: ${r.description}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '3px 8px',
                      borderRadius: 'var(--r)',
                      fontSize: 11,
                      fontWeight: isActive ? 700 : 500,
                      cursor: 'pointer',
                      border: isActive ? `2px solid ${r.color}` : '1px solid var(--line)',
                      background: isActive ? r.badgeBg : '#fafbfc',
                      color: isActive ? r.badgeText : 'var(--ink)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <Icon className="w-3 h-3" style={{ color: r.color }} />
                    <span>{r.role.replace('_', ' ')}</span>
                  </button>
                );
              })}
            </div>

            {/* Toggle de detalles del rol */}
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              style={{
                background: 'transparent',
                border: '1px solid var(--line)',
                borderRadius: 'var(--r)',
                padding: '3px 6px',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 11,
                color: 'var(--slate)',
                cursor: 'pointer',
              }}
            >
              <Info className="w-3.5 h-3.5" />
              <span>{expanded ? 'Ocultar Matriz' : 'Ver Permisos'}</span>
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>
        </div>

        {/* Panel Desplegable de Detalles y Alcance del Rol Activo */}
        {expanded && (
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 'var(--r)',
              background: '#f8fafc',
              border: '1px solid var(--line-soft)',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 12,
              animation: 'fadeIn 0.2s ease',
            }}
          >
            <div>
              <div style={{ fontWeight: 700, color: currentRoleDef.color, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                <currentRoleDef.icon className="w-4 h-4" />
                <span>Alcance y Responsabilidades: {currentRoleDef.label}</span>
              </div>
              <p style={{ fontSize: 12, color: 'var(--slate)', margin: 0, lineHeight: 1.5 }}>
                {currentRoleDef.description}
              </p>
            </div>

            <div>
              <div style={{ fontWeight: 700, color: 'var(--navy)', marginBottom: 4 }}>
                Acciones Habilitadas en Taller San Luis:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {currentRoleDef.allowedActions.map((act, i) => (
                  <span
                    key={i}
                    style={{
                      fontSize: 11,
                      padding: '2px 6px',
                      background: '#ffffff',
                      border: '1px solid var(--line)',
                      borderRadius: 4,
                      color: 'var(--ink)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    {act}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RoleSimulatorBar;
