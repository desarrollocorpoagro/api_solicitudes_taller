import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  Check,
  X,
  RefreshCw,
  Key,
  Trash2,
  Edit2,
  Database,
  Lock,
  Terminal,
  Play,
  Server,
  Activity,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  Settings,
  Table,
  Plus
} from 'lucide-react';

const ALL_ROLES = [
  { id: 'ADMIN', label: 'ADMINISTRADOR', desc: 'Acceso total y configuración de bases de datos, permisos y auditoría', color: 'b-bad' },
  { id: 'GERENTE_TALLER', label: 'GERENTE DE TALLER', desc: 'Control operativo integral de órdenes, diagnósticos y aprobaciones', color: 'b-info' },
  { id: 'SUPERVISOR', label: 'SUPERVISOR', desc: 'Supervisión técnica de reparaciones y asignación de mecánicos', color: 'b-info' },
  { id: 'RESPONSABLE_FLOTA', label: 'RESPONSABLE DE FLOTA', desc: 'Gestión de unidades vehiculares, kilometrajes y apertura de órdenes', color: 'b-warn' },
  { id: 'MECANICO', label: 'MECÁNICO', desc: 'Registro de diagnósticos, mano de obra y solicitud de repuestos', color: 'b-mute' },
  { id: 'ALMACENISTA', label: 'ALMACENISTA', desc: 'Kárdex, despacho y entrega de repuestos e insumos', color: 'b-ok' },
  { id: 'SOLICITANTE', label: 'SOLICITANTE', desc: 'Apertura de solicitudes de servicio y reporte de fallas', color: 'b-mute' },
  { id: 'AUDITOR', label: 'AUDITOR', desc: 'Consulta y trazabilidad financiera y operativa', color: 'b-warn' },
  { id: 'OPERADOR', label: 'OPERADOR', desc: 'Visualización básica de unidades y estatus de servicio', color: 'b-mute' },
];

const MODULE_DEFINITIONS = [
  { id: 'taller', name: 'Órdenes de Taller', actions: ['read', 'create', 'update', 'delete', 'approve', 'admin'] },
  { id: 'fleet', name: 'Flota Vehicular', actions: ['read', 'create', 'update', 'delete', 'admin'] },
  { id: 'almacen', name: 'Almacén & Repuestos', actions: ['read', 'create', 'update', 'delete', 'dispatch', 'admin'] },
  { id: 'aprobaciones', name: 'Aprobaciones & Gastos', actions: ['read', 'approve', 'reject', 'admin'] },
  { id: 'users', name: 'Usuarios & Empresas', actions: ['read', 'create', 'update', 'delete', 'admin'] },
  { id: 'permissions', name: 'Matriz de Permisos RBAC', actions: ['read', 'update', 'admin'] },
  { id: 'db_connections', name: 'Conexiones MSSQL / DB', actions: ['read', 'create', 'update', 'delete', 'test', 'admin'] },
  { id: 'query_runner', name: 'Ejecutor de Consultas SQL', actions: ['read', 'execute_query', 'admin'] },
  { id: 'reports', name: 'Auditoría & Reportes', actions: ['read', 'export', 'admin'] },
];

export const UserManagementModule: React.FC<{ token: string; currentUser?: any }> = ({ token, currentUser }) => {
  const [activeTab, setActiveTab] = useState<'users' | 'connections' | 'permissions' | 'queries'>('users');

  // ================= USERS STATE =================
  const [users, setUsers] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('');
  const [userPage, setUserPage] = useState(1);
  const [userLimit, setUserLimit] = useState(10);
  const [userPagination, setUserPagination] = useState({ total: 0, totalPages: 1, hasMore: false });

  const [userFormData, setUserFormData] = useState<{
    fullName: string;
    email: string;
    password: string;
    phone: string;
    role: string;
    isActive: boolean;
    companyIds: string[];
  }>({
    fullName: '',
    email: '',
    password: '',
    phone: '',
    role: 'MECANICO',
    isActive: true,
    companyIds: [],
  });

  // ================= DB CONNECTIONS STATE =================
  const [connections, setConnections] = useState<any[]>([]);
  const [connLoading, setConnLoading] = useState(false);
  const [showConnModal, setShowConnModal] = useState(false);
  const [editingConn, setEditingConn] = useState<any>(null);
  const [connTestingId, setConnTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<any>(null);
  const [connPage, setConnPage] = useState(1);
  const [connPagination, setConnPagination] = useState({ total: 0, totalPages: 1 });

  const [connFormData, setConnFormData] = useState({
    nombre: 'Servidor Profit Plus AD_TRANS',
    host: 'SRVBDPROFITBK',
    port: 1433,
    databaseName: 'AD_TRANS',
    username: 'solicitudweb',
    password: 'solicitudweb',
    dialect: 'mssql',
    trustServerCertificate: true,
    encrypt: false,
    isDefault: true,
    isActive: true,
  });

  // ================= PERMISSIONS (RBAC) STATE =================
  const [selectedRole, setSelectedRole] = useState('ADMIN');
  const [rolePermissions, setRolePermissions] = useState<Record<string, string[]>>({});
  const [permLoading, setPermLoading] = useState(false);
  const [permSaving, setPermSaving] = useState(false);
  const [permSuccessMsg, setPermSuccessMsg] = useState('');

  // ================= SQL QUERY RUNNER STATE =================
  const [selectedConnId, setSelectedConnId] = useState<string>('');
  const [sqlQuery, setSqlQuery] = useState<string>(
    'SELECT [codigo_profit]\n      ,[nombre_producto]\n      ,[codigo_categoria]\n      ,[categoria]\n      ,[unidad_medida]\n      ,[costo]\n      ,[tipo]\n      ,[codigo_subalmacen]\n      ,[sub_almacen]\n      ,[codigo_almacen]\n      ,[almacen]\n      ,[stock_act]\n  FROM [AD_TRANS].[dbo].[vw_flota_articulos]'
  );
  const [queryExecuting, setQueryExecuting] = useState(false);
  const [queryResult, setQueryResult] = useState<any>(null);
  const [queryPage, setQueryPage] = useState(1);
  const [queryLimit, setQueryLimit] = useState(25);

  const PRESET_QUERIES = [
    {
      title: 'Mecánicos de Taller (ad_trans.dbo.mecanicos)',
      desc: 'Consulta personal técnico, códigos, especialidades/cargos y estatus activo',
      sql: 'SELECT [codigo]\n      ,[nombre]\n      ,[cargo]\n      ,[activo]\n  FROM [ad_trans].[dbo].[mecanicos]',
    },
    {
      title: 'Artículos & Stock Profit Plus (vw_flota_articulos)',
      desc: 'Consulta todos los repuestos, costos y stock actual por almacén',
      sql: 'SELECT [codigo_profit]\n      ,[nombre_producto]\n      ,[codigo_categoria]\n      ,[categoria]\n      ,[unidad_medida]\n      ,[costo]\n      ,[tipo]\n      ,[codigo_subalmacen]\n      ,[sub_almacen]\n      ,[codigo_almacen]\n      ,[almacen]\n      ,[stock_act]\n  FROM [AD_TRANS].[dbo].[vw_flota_articulos]',
    },
    {
      title: 'Vendedores Profit Plus (vw_flota_vendedores)',
      desc: 'Consulta maestros de vendedores y cédulas de identidad',
      sql: 'SELECT [co_ven]\n      ,[cedula]\n      ,[ven_des]\n  FROM [AD_TRANS].[dbo].[vw_flota_vendedores]',
    },
    {
      title: 'Órdenes de Servicio en Profit (flota_orden_servicio_profit)',
      desc: 'Consulta órdenes de servicio sincronizadas en el ERP Profit Plus',
      sql: 'SELECT [id]\n      ,[placa]\n      ,[km]\n      ,[sintomas]\n      ,[estado]\n      ,[totalGeneral]\n      ,[createdAt]\n  FROM [AD_TRANS].[dbo].[flota_orden_servicio_profit]\n  ORDER BY [createdAt] DESC',
    },
  ];

  // Initial loads
  useEffect(() => {
    fetchUsers();
    fetchCompanies();
    fetchConnections();
    fetchRolePermissions(selectedRole);
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [userPage, userLimit, userRoleFilter]);

  useEffect(() => {
    fetchRolePermissions(selectedRole);
  }, [selectedRole]);

  // ================= USERS API CALLS =================
  const fetchUsers = async () => {
    setUsersLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', String(userPage));
      params.append('limit', String(userLimit));
      if (userSearch) params.append('search', userSearch);
      if (userRoleFilter) params.append('role', userRoleFilter);

      const res = await fetch(`/api/v1/users?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setUsers(data.data || []);
        if (data.pagination) {
          setUserPagination({
            total: data.pagination.total || 0,
            totalPages: data.pagination.totalPages || 1,
            hasMore: data.pagination.hasMore || false,
          });
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUsersLoading(false);
    }
  };

  const fetchCompanies = async () => {
    try {
      const res = await fetch('/api/v1/companies', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await res.json();
        if (data.success) {
          setCompanies(data.data || []);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenCreateUser = () => {
    setEditingUser(null);
    setUserFormData({
      fullName: '',
      email: '',
      password: '',
      phone: '',
      role: 'MECANICO',
      isActive: true,
      companyIds: companies.map((c) => c.id),
    });
    setShowUserModal(true);
  };

  const handleOpenEditUser = (u: any) => {
    setEditingUser(u);
    const assignedIds = (u.userCompanies || []).map((uc: any) => uc.companyId || uc.company?.id).filter(Boolean);
    setUserFormData({
      fullName: u.fullName || '',
      email: u.email || '',
      password: '',
      phone: u.phone || '',
      role: u.role || 'MECANICO',
      isActive: u.isActive !== undefined ? u.isActive : true,
      companyIds: assignedIds.length > 0 ? assignedIds : u.role === 'ADMIN' ? companies.map((c) => c.id) : [],
    });
    setShowUserModal(true);
  };

  const toggleUserCompany = (companyId: string) => {
    setUserFormData((prev) => {
      const exists = prev.companyIds.includes(companyId);
      return {
        ...prev,
        companyIds: exists ? prev.companyIds.filter((id) => id !== companyId) : [...prev.companyIds, companyId],
      };
    });
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingUser ? `/api/v1/users/${editingUser.id}` : '/api/v1/users';
      const method = editingUser ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(userFormData),
      });

      const data = await res.json();
      if (data.success) {
        setShowUserModal(false);
        setEditingUser(null);
        fetchUsers();
      } else {
        alert(data.error || 'Error al guardar usuario');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm('¿Está seguro de eliminar este usuario?')) return;
    try {
      const res = await fetch(`/api/v1/users/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        fetchUsers();
      } else {
        alert(data.error);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  // ================= CONNECTIONS API CALLS =================
  const fetchConnections = async () => {
    setConnLoading(true);
    try {
      const res = await fetch(`/api/v1/db-connections?page=${connPage}&limit=10`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setConnections(data.data || []);
        if (data.data?.length > 0 && !selectedConnId) {
          setSelectedConnId(data.data[0].id);
        }
        if (data.pagination) {
          setConnPagination({
            total: data.pagination.total || 0,
            totalPages: data.pagination.totalPages || 1,
          });
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setConnLoading(false);
    }
  };

  const handleOpenCreateConn = () => {
    setEditingConn(null);
    setConnFormData({
      nombre: 'Servidor Profit Plus Producción',
      host: 'SRVBDPROFITBK',
      port: 1433,
      databaseName: 'AD_TRANS',
      username: 'solicitudweb',
      password: 'solicitudweb',
      dialect: 'mssql',
      trustServerCertificate: true,
      encrypt: false,
      isDefault: false,
      isActive: true,
    });
    setTestResult(null);
    setShowConnModal(true);
  };

  const handleOpenEditConn = (c: any) => {
    setEditingConn(c);
    setConnFormData({
      nombre: c.nombre || '',
      host: c.host || 'SRVBDPROFITBK',
      port: c.port || 1433,
      databaseName: c.databaseName || 'AD_TRANS',
      username: c.username || 'solicitudweb',
      password: '',
      dialect: c.dialect || 'mssql',
      trustServerCertificate: c.trustServerCertificate !== undefined ? c.trustServerCertificate : true,
      encrypt: c.encrypt || false,
      isDefault: Boolean(c.isDefault),
      isActive: c.isActive !== undefined ? c.isActive : true,
    });
    setTestResult(null);
    setShowConnModal(true);
  };

  const handleSaveConn = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingConn ? `/api/v1/db-connections/${editingConn.id}` : '/api/v1/db-connections';
      const method = editingConn ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(connFormData),
      });

      const data = await res.json();
      if (data.success) {
        setShowConnModal(false);
        setEditingConn(null);
        fetchConnections();
      } else {
        alert(data.error || 'Error al guardar configuración de base de datos.');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleTestConnection = async (id: string) => {
    setConnTestingId(id);
    try {
      const res = await fetch(`/api/v1/db-connections/${id}/test`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setTestResult(data);
      fetchConnections();
    } catch (err: any) {
      setTestResult({ connected: false, error: err.message });
    } finally {
      setConnTestingId(null);
    }
  };

  const handleDeleteConnection = async (id: string) => {
    if (!confirm('¿Está seguro de eliminar esta conexión de base de datos?')) return;
    try {
      const res = await fetch(`/api/v1/db-connections/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        fetchConnections();
      } else {
        alert(data.error);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  // ================= PERMISSIONS API CALLS =================
  const fetchRolePermissions = async (role: string) => {
    setPermLoading(true);
    setPermSuccessMsg('');
    try {
      const res = await fetch(`/api/v1/roles-permissions/role/${role}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success && data.data) {
        const map: Record<string, string[]> = {};
        data.data.forEach((p: any) => {
          map[p.module] = p.actions || [];
        });
        setRolePermissions(map);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setPermLoading(false);
    }
  };

  const togglePermissionAction = (module: string, action: string) => {
    setRolePermissions((prev) => {
      const current = prev[module] || [];
      const hasAction = current.includes(action);
      const updated = hasAction ? current.filter((a) => a !== action) : [...current, action];
      return {
        ...prev,
        [module]: updated,
      };
    });
  };

  const handleSaveRolePermissions = async () => {
    setPermSaving(true);
    setPermSuccessMsg('');
    try {
      const permissions = Object.keys(rolePermissions).map((module) => ({
        module,
        actions: rolePermissions[module],
        description: `Permisos para módulo ${module}`,
      }));

      const res = await fetch(`/api/v1/roles-permissions/role/${selectedRole}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ permissions }),
      });

      const data = await res.json();
      if (data.success) {
        setPermSuccessMsg(`¡Permisos para el rol ${selectedRole} guardados exitosamente!`);
        setTimeout(() => setPermSuccessMsg(''), 4000);
      } else {
        alert(data.error || 'Error al guardar matriz de permisos');
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setPermSaving(false);
    }
  };

  // ================= SQL QUERY RUNNER CALLS =================
  const handleExecuteQuery = async (queryToRun?: string) => {
    const q = queryToRun || sqlQuery;
    if (!q.trim()) return;

    setQueryExecuting(true);
    setQueryResult(null);
    try {
      const res = await fetch('/api/v1/db-connections/execute-query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          query: q,
          connectionId: selectedConnId || undefined,
          page: queryPage,
          limit: queryLimit,
        }),
      });
      const data = await res.json();
      setQueryResult(data);
    } catch (err: any) {
      setQueryResult({ success: false, error: err.message });
    } finally {
      setQueryExecuting(false);
    }
  };

  return (
    <div className="wrap">
      {/* Top Header Card */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Shield className="w-5 h-5 text-[var(--navy)]" />
              <h2 style={{ margin: 0, fontSize: 18 }}>Panel de Administración & Seguridad (RBAC / MSSQL)</h2>
            </div>
            <p className="hint" style={{ marginBottom: 0, marginTop: 4 }}>
              Gestión centralizada de usuarios multi-tenant, conexiones directas MSSQL Profit Plus (AD_TRANS), permisos por roles y ejecutor SQL.
            </p>
          </div>

          {/* Sub-Navegación de Pestañas */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button
              onClick={() => setActiveTab('users')}
              className={`btn ${activeTab === 'users' ? 'dark' : ''}`}
            >
              <Users className="w-4 h-4" /> Usuarios & Empresas
            </button>
            <button
              onClick={() => setActiveTab('connections')}
              className={`btn ${activeTab === 'connections' ? 'dark' : ''}`}
            >
              <Database className="w-4 h-4" /> Conexiones MSSQL
            </button>
            <button
              onClick={() => setActiveTab('permissions')}
              className={`btn ${activeTab === 'permissions' ? 'dark' : ''}`}
            >
              <Lock className="w-4 h-4" /> Matriz de Permisos
            </button>
            <button
              onClick={() => setActiveTab('queries')}
              className={`btn ${activeTab === 'queries' ? 'dark' : ''}`}
            >
              <Terminal className="w-4 h-4" /> Ejecutor SQL
            </button>
          </div>
        </div>
      </div>

      {/* ================= TAB 1: GESTIÓN DE USUARIOS ================= */}
      {activeTab === 'users' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Barra de Filtros & Paginación */}
          <div className="card" style={{ padding: '14px 18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', gap: 10, flex: 1, minWidth: 280, flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                  <Search className="w-4 h-4 text-[var(--slate)]" style={{ position: 'absolute', left: 10, top: 10 }} />
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && fetchUsers()}
                    placeholder="Buscar por nombre, correo o teléfono..."
                    style={{ paddingLeft: 34 }}
                  />
                </div>
                <select
                  value={userRoleFilter}
                  onChange={(e) => {
                    setUserRoleFilter(e.target.value);
                    setUserPage(1);
                  }}
                  style={{ minWidth: 160 }}
                >
                  <option value="">Todos los Roles</option>
                  {ALL_ROLES.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </select>
                <button onClick={fetchUsers} className="btn">
                  <Filter className="w-3.5 h-3.5" /> Filtrar
                </button>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={fetchUsers} className="btn">
                  <RefreshCw className={`w-3.5 h-3.5 ${usersLoading ? 'animate-spin' : ''}`} />
                </button>
                <button onClick={handleOpenCreateUser} className="btn dark">
                  <UserPlus className="w-4 h-4" /> Nuevo Usuario
                </button>
              </div>
            </div>
          </div>

          {/* Tabla de Usuarios */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Usuario</th>
                    <th>Rol RBAC Asignado</th>
                    <th>Empresas Asignadas (Multi-Tenant)</th>
                    <th>Teléfono</th>
                    <th>Estado</th>
                    <th style={{ textAlign: 'right' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: 30, color: 'var(--slate)' }}>
                        {usersLoading ? 'Cargando usuarios...' : 'No se encontraron usuarios con los criterios indicados.'}
                      </td>
                    </tr>
                  ) : (
                    users.map((u) => {
                      const roleObj = ALL_ROLES.find((r) => r.id === u.role) || { label: u.role, color: 'b-info' };
                      return (
                        <tr key={u.id}>
                          <td>
                            <span style={{ fontWeight: 600, display: 'block', color: 'var(--ink)' }}>{u.fullName}</span>
                            <span style={{ fontSize: 12, color: 'var(--slate)' }}>{u.email}</span>
                          </td>
                          <td>
                            <span className={`badge ${roleObj.color} font-mono font-semibold`}>
                              {roleObj.label}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxWidth: 360 }}>
                              {u.role?.toUpperCase() === 'ADMIN' ? (
                                <span className="badge b-ok" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                  <Shield className="w-3 h-3 text-[var(--ok)]" />
                                  Acceso Global (Todas las Empresas)
                                </span>
                              ) : u.userCompanies && u.userCompanies.length > 0 ? (
                                u.userCompanies.map((uc: any) => (
                                  <span key={uc.company?.id || uc.id} className="badge b-mute">
                                    {uc.company?.name || 'Empresa'}
                                  </span>
                                ))
                              ) : (
                                <span style={{ color: 'var(--slate)', fontStyle: 'italic', fontSize: 12 }}>Sin empresas asignadas</span>
                              )}
                            </div>
                          </td>
                          <td className="mono">{u.phone || 'N/A'}</td>
                          <td>
                            <span className={`badge ${u.isActive ? 'b-ok' : 'b-bad'}`}>
                              {u.isActive ? 'Activo' : 'Inactivo'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: 6 }}>
                              <button
                                onClick={() => handleOpenEditUser(u)}
                                className="btn"
                                style={{ minHeight: 'auto', padding: '6px 8px', fontSize: 12 }}
                                title="Editar usuario y asignación de rol"
                              >
                                <Edit2 className="w-3.5 h-3.5 text-[var(--navy)]" />
                              </button>
                              <button
                                onClick={() => handleDeleteUser(u.id)}
                                className="btn danger"
                                style={{ minHeight: 'auto', padding: '6px 8px', fontSize: 12 }}
                                title="Eliminar usuario"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Paginador de Usuarios */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 18px',
              borderTop: '1px solid var(--line)',
              background: '#FAFBFC',
              flexWrap: 'wrap',
              gap: 10,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--slate)' }}>
                <span>Mostrando {users.length} de {userPagination.total} usuarios</span>
                <select
                  value={userLimit}
                  onChange={(e) => {
                    setUserLimit(Number(e.target.value));
                    setUserPage(1);
                  }}
                  style={{ minHeight: 'auto', padding: '2px 6px', fontSize: 12 }}
                >
                  <option value="5">5 por página</option>
                  <option value="10">10 por página</option>
                  <option value="20">20 por página</option>
                  <option value="50">50 por página</option>
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  disabled={userPage <= 1}
                  onClick={() => setUserPage((p) => Math.max(1, p - 1))}
                  className="btn"
                  style={{ minHeight: 'auto', padding: '4px 10px', fontSize: 12 }}
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Anterior
                </button>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--navy)' }}>
                  Página {userPage} de {userPagination.totalPages || 1}
                </span>
                <button
                  disabled={userPage >= userPagination.totalPages}
                  onClick={() => setUserPage((p) => p + 1)}
                  className="btn"
                  style={{ minHeight: 'auto', padding: '4px 10px', fontSize: 12 }}
                >
                  Siguiente <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 2: CONEXIONES DE BASE DE DATOS ================= */}
      {activeTab === 'connections' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Card descriptiva con los datos de conexión */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16 }}>Configuración de Base de Datos MSSQL Profit Plus (AD_TRANS)</h3>
                <p className="hint" style={{ marginTop: 4, marginBottom: 8 }}>
                  Tabla de conexión persistente en SQLite local para conectarse a servidores de bases de datos MSSQL.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  <span className="badge b-info font-mono">HOST: SRVBDPROFITBK</span>
                  <span className="badge b-info font-mono">PORT: 1433</span>
                  <span className="badge b-info font-mono">DB: AD_TRANS</span>
                  <span className="badge b-info font-mono">USER: solicitudweb</span>
                  <span className="badge b-ok font-mono">DIALECT: MSSQL / SQLITE FALLBACK</span>
                </div>
              </div>
              <button onClick={handleOpenCreateConn} className="btn dark">
                <Plus className="w-4 h-4" /> Registrar Conexión MSSQL
              </button>
            </div>
          </div>

          {/* Listado de Conexiones */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Nombre de Conexión</th>
                    <th>Servidor / Host</th>
                    <th>Puerto</th>
                    <th>Base de Datos</th>
                    <th>Usuario</th>
                    <th>Dialecto</th>
                    <th>Estado de Enlace</th>
                    <th>Latencia</th>
                    <th style={{ textAlign: 'right' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {connections.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: 30, color: 'var(--slate)' }}>
                        {connLoading ? 'Cargando conexiones...' : 'No hay conexiones de base de datos registradas.'}
                      </td>
                    </tr>
                  ) : (
                    connections.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Server className="w-4 h-4 text-[var(--navy)]" />
                            <span style={{ fontWeight: 600 }}>{c.nombre}</span>
                            {c.isDefault && <span className="badge b-ok">Predeterminada</span>}
                          </div>
                        </td>
                        <td className="mono">{c.host}</td>
                        <td className="mono">{c.port}</td>
                        <td>
                          <span className="badge b-info font-mono font-semibold">{c.databaseName}</span>
                        </td>
                        <td className="mono">{c.username}</td>
                        <td>
                          <span className="badge b-warn font-mono uppercase">{c.dialect}</span>
                        </td>
                        <td>
                          <span className={`badge ${c.status === 'CONNECTED' ? 'b-ok' : c.status === 'ERROR' ? 'b-bad' : 'b-mute'}`}>
                            {c.status === 'CONNECTED' ? 'Conectado' : c.status === 'ERROR' ? 'Fallo de Red' : 'En Espera'}
                          </span>
                        </td>
                        <td className="mono">{c.latencyMs ? `${c.latencyMs} ms` : '—'}</td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: 6 }}>
                            <button
                              onClick={() => handleTestConnection(c.id)}
                              disabled={connTestingId === c.id}
                              className="btn"
                              style={{ minHeight: 'auto', padding: '6px 10px', fontSize: 12 }}
                              title="Probar conexión en vivo"
                            >
                              <Activity className={`w-3.5 h-3.5 text-amber-600 ${connTestingId === c.id ? 'animate-spin' : ''}`} />
                              Probar
                            </button>
                            <button
                              onClick={() => handleOpenEditConn(c)}
                              className="btn"
                              style={{ minHeight: 'auto', padding: '6px 8px', fontSize: 12 }}
                              title="Editar conexión"
                            >
                              <Edit2 className="w-3.5 h-3.5 text-[var(--navy)]" />
                            </button>
                            <button
                              onClick={() => handleDeleteConnection(c.id)}
                              disabled={c.isDefault}
                              className="btn danger"
                              style={{ minHeight: 'auto', padding: '6px 8px', fontSize: 12 }}
                              title="Eliminar conexión"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Resultado de prueba de conexión */}
          {testResult && (
            <div className={`card ${testResult.connected ? 'border-emerald-500 bg-emerald-50/50' : 'border-rose-500 bg-rose-50/50'}`}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {testResult.connected ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-rose-600" />
                )}
                <div>
                  <h4 style={{ margin: 0, fontSize: 14, color: testResult.connected ? '#065F46' : '#991B1B' }}>
                    {testResult.connected ? 'Conexión Exitosa con el Servidor' : 'Fallo en la Conexión de Base de Datos'}
                  </h4>
                  <p style={{ margin: 0, fontSize: 12, color: testResult.connected ? '#047857' : '#B91C1C' }}>
                    {testResult.message || testResult.error}
                    {testResult.latencyMs && ` • Tiempo de respuesta: ${testResult.latencyMs}ms`}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= TAB 3: MATRIZ DE PERMISOS RBAC ================= */}
      {activeTab === 'permissions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16 }}>Matriz de Permisos por Rol (Control de Acceso RBAC)</h3>
                <p className="hint" style={{ marginTop: 4, marginBottom: 0 }}>
                  Configure los módulos del sistema y acciones permitidas (Lectura, Creación, Actualización, Eliminación, Aprobación, Despacho, Admin) para cada rol.
                </p>
              </div>

              {/* Selector de Rol para editar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)' }}>Rol Seleccionado:</span>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  style={{ fontWeight: 600 }}
                >
                  {ALL_ROLES.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleSaveRolePermissions}
                  disabled={permSaving}
                  className="btn dark"
                >
                  {permSaving ? 'Guardando...' : 'Guardar Permisos'}
                </button>
              </div>
            </div>

            {permSuccessMsg && (
              <div className="note n-ok" style={{ marginTop: 12, padding: '8px 12px' }}>
                <Check className="w-4 h-4 text-emerald-600 inline mr-2" />
                {permSuccessMsg}
              </div>
            )}
          </div>

          {/* Matriz de Permisos por Módulo */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '25%' }}>Módulo del Sistema</th>
                    <th>Acciones y Operaciones Permitidas</th>
                    <th style={{ width: '15%', textAlign: 'center' }}>Nivel de Acceso</th>
                  </tr>
                </thead>
                <tbody>
                  {MODULE_DEFINITIONS.map((m) => {
                    const assignedActions = rolePermissions[m.id] || [];
                    const isAll = m.actions.every((a) => assignedActions.includes(a));
                    return (
                      <tr key={m.id}>
                        <td>
                          <span style={{ fontWeight: 600, display: 'block', color: 'var(--ink)' }}>{m.name}</span>
                          <span className="mono" style={{ fontSize: 11, color: 'var(--slate)' }}>
                            módulo: {m.id}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {m.actions.map((act) => {
                              const isChecked = assignedActions.includes(act);
                              return (
                                <button
                                  key={act}
                                  type="button"
                                  onClick={() => togglePermissionAction(m.id, act)}
                                  className={`btn ${isChecked ? 'dark' : ''}`}
                                  style={{
                                    minHeight: 'auto',
                                    padding: '4px 10px',
                                    fontSize: 12,
                                    textTransform: 'uppercase',
                                  }}
                                >
                                  {isChecked && <Check className="w-3 h-3 text-[var(--lime)] inline mr-1" />}
                                  {act}
                                </button>
                              );
                            })}
                          </div>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span
                            className={`badge ${
                              assignedActions.length === 0
                                ? 'b-bad'
                                : isAll
                                ? 'b-ok'
                                : 'b-info'
                            }`}
                          >
                            {assignedActions.length === 0
                              ? 'Sin Acceso'
                              : isAll
                              ? 'Total (Admin)'
                              : `${assignedActions.length} Acciones`}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 4: EJECUTOR DE CONSULTAS SQL DIRECTAS ================= */}
      {activeTab === 'queries' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Consultas Rápidas Preconfiguradas */}
          <div className="card">
            <h3 style={{ margin: '0 0 10px 0', fontSize: 16 }}>Consultas Rápidas Preconfiguradas (Profit Plus AD_TRANS)</h3>
            <div className="grid g3">
              {PRESET_QUERIES.map((pq, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    setSqlQuery(pq.sql);
                    handleExecuteQuery(pq.sql);
                  }}
                  style={{
                    border: '1px solid var(--line)',
                    borderRadius: 'var(--r)',
                    padding: 12,
                    background: '#FAFBFC',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  className="hover:border-[var(--navy)] hover:shadow-sm"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <Play className="w-3.5 h-3.5 text-emerald-600" />
                    <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--navy)' }}>{pq.title}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--slate)' }}>{pq.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Editor SQL */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Terminal className="w-4 h-4 text-[var(--navy)]" />
                <span style={{ fontWeight: 600, fontSize: 14 }}>Editor de Consulta SQL Directa (MSSQL / AD_TRANS)</span>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--slate)' }}>Destino:</span>
                <select
                  value={selectedConnId}
                  onChange={(e) => setSelectedConnId(e.target.value)}
                  style={{ minHeight: 'auto', padding: '4px 8px', fontSize: 12 }}
                >
                  {connections.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre} ({c.databaseName})
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => handleExecuteQuery()}
                  disabled={queryExecuting}
                  className="btn dark"
                >
                  <Play className={`w-3.5 h-3.5 ${queryExecuting ? 'animate-spin' : ''}`} />
                  {queryExecuting ? 'Ejecutando...' : 'Ejecutar Query'}
                </button>
              </div>
            </div>

            <textarea
              rows={6}
              value={sqlQuery}
              onChange={(e) => setSqlQuery(e.target.value)}
              className="mono"
              style={{
                width: '100%',
                background: '#0D1B2A',
                color: '#A5D6A7',
                padding: 12,
                borderRadius: 'var(--r)',
                fontSize: 13,
                lineHeight: 1.5,
                border: '1px solid #1B263B',
              }}
              placeholder="Escriba su consulta SQL aquí..."
            />
          </div>

          {/* Resultados de la Consulta */}
          {queryResult && (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{
                padding: '12px 18px',
                background: queryResult.success ? '#F0FDF4' : '#FEF2F2',
                borderBottom: '1px solid var(--line)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 10,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {queryResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600" />
                  )}
                  <span style={{ fontWeight: 600, fontSize: 13, color: queryResult.success ? '#065F46' : '#991B1B' }}>
                    {queryResult.success ? 'Consulta ejecutada con éxito' : 'Error en la ejecución'}
                  </span>
                </div>
                {queryResult.success && (
                  <div style={{ display: 'flex', gap: 10, fontSize: 12, color: 'var(--slate)' }}>
                    <span><b>{queryResult.rowCount}</b> registros retornados</span>
                    <span>•</span>
                    <span><b>{queryResult.executionTimeMs} ms</b> tiempo de respuesta</span>
                    <span>•</span>
                    <span>Origen: <b>{queryResult.source}</b></span>
                  </div>
                )}
              </div>

              {queryResult.success ? (
                <div style={{ overflowX: 'auto', maxHeight: 420 }}>
                  <table>
                    <thead>
                      <tr>
                        {queryResult.columns.map((col: string) => (
                          <th key={col} className="mono" style={{ whiteSpace: 'nowrap' }}>
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {queryResult.rows.length === 0 ? (
                        <tr>
                          <td colSpan={queryResult.columns.length || 1} style={{ textAlign: 'center', padding: 20, color: 'var(--slate)' }}>
                            La consulta no devolvió filas.
                          </td>
                        </tr>
                      ) : (
                        queryResult.rows.map((row: any, idx: number) => (
                          <tr key={idx}>
                            {queryResult.columns.map((col: string) => (
                              <td key={col} className="mono" style={{ fontSize: 12 }}>
                                {row[col] !== null && row[col] !== undefined ? String(row[col]) : <i style={{ color: 'var(--slate)' }}>NULL</i>}
                              </td>
                            ))}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ padding: 18, color: '#B91C1C', fontSize: 13 }} className="mono">
                  {queryResult.error}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ================= MODAL CREAR / EDITAR USUARIO ================= */}
      {showUserModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 35, 71, 0.65)',
          backdropFilter: 'blur(3px)',
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
        }}>
          <div className="card" style={{ maxWidth: 540, width: '100%', maxHeight: '90vh', overflowY: 'auto', margin: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--line)', paddingBottom: 12, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <UserPlus className="w-5 h-5 text-[var(--navy)]" />
                <h2 style={{ fontSize: 18, margin: 0 }}>
                  {editingUser ? 'Editar Usuario y Rol Asignado' : 'Registrar Nuevo Usuario'}
                </h2>
              </div>
              <button onClick={() => setShowUserModal(false)} className="btn" style={{ minHeight: 'auto', padding: '4px 8px', border: 0 }}>
                <X className="w-4 h-4 text-[var(--slate)]" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <label className="f">
                <span className="req">Nombre Completo</span>
                <input
                  required
                  value={userFormData.fullName}
                  onChange={(e) => setUserFormData({ ...userFormData, fullName: e.target.value })}
                  placeholder="Ej. Pedro Morales"
                />
              </label>

              <label className="f">
                <span className="req">Correo Electrónico</span>
                <input
                  type="email"
                  required
                  value={userFormData.email}
                  onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
                  placeholder="usuario@empresasanluis.com"
                />
              </label>

              <label className="f">
                <span className={editingUser ? '' : 'req'}>
                  Contraseña {editingUser ? '(dejar en blanco para conservar actual)' : ''}
                </span>
                <input
                  type="password"
                  required={!editingUser}
                  value={userFormData.password}
                  onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                  placeholder="••••••••"
                  className="mono"
                />
              </label>

              <div className="grid g2">
                <label className="f">
                  <span>Teléfono</span>
                  <input
                    value={userFormData.phone}
                    onChange={(e) => setUserFormData({ ...userFormData, phone: e.target.value })}
                    placeholder="+58 412 5556677"
                    className="mono"
                  />
                </label>

                {/* SELECTOR DE ROL COMPLETO */}
                <label className="f">
                  <span className="req">Rol para Asignar al Usuario</span>
                  <select
                    value={userFormData.role}
                    onChange={(e) => setUserFormData({ ...userFormData, role: e.target.value })}
                    style={{ fontWeight: 600 }}
                  >
                    {ALL_ROLES.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {/* Explicación del Rol Seleccionado */}
              {(() => {
                const rObj = ALL_ROLES.find((r) => r.id === userFormData.role);
                return rObj ? (
                  <div className="note n-info" style={{ padding: '8px 12px', fontSize: 12 }}>
                    <b>Alcance del Rol {rObj.label}:</b> {rObj.desc}.
                  </div>
                ) : null;
              })()}

              {/* Asignación de Empresas Multi-Tenant */}
              <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--r)', padding: 14, background: 'var(--paper)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '1.2px', fontWeight: 600, color: 'var(--navy)' }}>
                    Empresas Asignadas ({userFormData.companyIds.length})
                  </span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => setUserFormData({ ...userFormData, companyIds: companies.map((c) => c.id) })}
                      className="btn"
                      style={{ minHeight: 'auto', padding: '2px 8px', fontSize: 11 }}
                    >
                      Todas
                    </button>
                    <button
                      type="button"
                      onClick={() => setUserFormData({ ...userFormData, companyIds: [] })}
                      className="btn"
                      style={{ minHeight: 'auto', padding: '2px 8px', fontSize: 11 }}
                    >
                      Limpiar
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 150, overflowY: 'auto' }}>
                  {companies.map((c) => {
                    const isChecked = userFormData.companyIds.includes(c.id);
                    return (
                      <label
                        key={c.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '6px 10px',
                          background: isChecked ? 'var(--lime-soft)' : '#fff',
                          border: `1px solid ${isChecked ? 'var(--lime)' : 'var(--line)'}`,
                          borderRadius: 'var(--r)',
                          cursor: 'pointer',
                          fontSize: 13,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleUserCompany(c.id)}
                          style={{ width: 16, height: 16, minHeight: 'auto', accentColor: 'var(--navy)', cursor: 'pointer' }}
                        />
                        <div style={{ flex: 1 }}>
                          <span style={{ fontWeight: isChecked ? 600 : 400, color: isChecked ? 'var(--navy)' : 'var(--ink)' }}>
                            {c.name}
                          </span>
                          <span style={{ display: 'block', fontSize: 10, color: 'var(--slate)' }}>
                            RIF: {c.taxId} • DB: {c.profitDb || 'AD_TRANS'}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
                <button
                  type="button"
                  onClick={() => setShowUserModal(false)}
                  className="btn"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn dark"
                >
                  {editingUser ? 'Guardar Cambios' : 'Registrar Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL CREAR / EDITAR CONEXIÓN MSSQL ================= */}
      {showConnModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 35, 71, 0.65)',
          backdropFilter: 'blur(3px)',
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
        }}>
          <div className="card" style={{ maxWidth: 540, width: '100%', maxHeight: '90vh', overflowY: 'auto', margin: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--line)', paddingBottom: 12, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Database className="w-5 h-5 text-[var(--navy)]" />
                <h2 style={{ fontSize: 18, margin: 0 }}>
                  {editingConn ? 'Editar Conexión de Base de Datos' : 'Registrar Conexión MSSQL Profit Plus'}
                </h2>
              </div>
              <button onClick={() => setShowConnModal(false)} className="btn" style={{ minHeight: 'auto', padding: '4px 8px', border: 0 }}>
                <X className="w-4 h-4 text-[var(--slate)]" />
              </button>
            </div>

            <form onSubmit={handleSaveConn} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <label className="f">
                <span className="req">Nombre Identificador</span>
                <input
                  required
                  value={connFormData.nombre}
                  onChange={(e) => setConnFormData({ ...connFormData, nombre: e.target.value })}
                  placeholder="Ej. Servidor Profit Plus Producción (AD_TRANS)"
                />
              </label>

              <div className="grid g2">
                <label className="f">
                  <span className="req">Host / Servidor</span>
                  <input
                    required
                    value={connFormData.host}
                    onChange={(e) => setConnFormData({ ...connFormData, host: e.target.value })}
                    placeholder="SRVBDPROFITBK"
                    className="mono"
                  />
                </label>
                <label className="f">
                  <span className="req">Puerto</span>
                  <input
                    type="number"
                    required
                    value={connFormData.port}
                    onChange={(e) => setConnFormData({ ...connFormData, port: parseInt(e.target.value, 10) || 1433 })}
                    placeholder="1433"
                    className="mono"
                  />
                </label>
              </div>

              <div className="grid g2">
                <label className="f">
                  <span className="req">Base de Datos</span>
                  <input
                    required
                    value={connFormData.databaseName}
                    onChange={(e) => setConnFormData({ ...connFormData, databaseName: e.target.value })}
                    placeholder="AD_TRANS"
                    className="mono"
                  />
                </label>
                <label className="f">
                  <span className="req">Dialecto</span>
                  <select
                    value={connFormData.dialect}
                    onChange={(e) => setConnFormData({ ...connFormData, dialect: e.target.value })}
                  >
                    <option value="mssql">MSSQL (Microsoft SQL Server)</option>
                    <option value="sqlite">SQLite (Local Emulado)</option>
                    <option value="postgres">PostgreSQL</option>
                  </select>
                </label>
              </div>

              <div className="grid g2">
                <label className="f">
                  <span className="req">Usuario DB</span>
                  <input
                    required
                    value={connFormData.username}
                    onChange={(e) => setConnFormData({ ...connFormData, username: e.target.value })}
                    placeholder="solicitudweb"
                    className="mono"
                  />
                </label>
                <label className="f">
                  <span className={editingConn ? '' : 'req'}>
                    Contraseña DB {editingConn ? '(dejar en blanco para conservar)' : ''}
                  </span>
                  <input
                    type="password"
                    required={!editingConn}
                    value={connFormData.password}
                    onChange={(e) => setConnFormData({ ...connFormData, password: e.target.value })}
                    placeholder="••••••••"
                    className="mono"
                  />
                </label>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, background: 'var(--paper)', borderRadius: 'var(--r)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={connFormData.trustServerCertificate}
                    onChange={(e) => setConnFormData({ ...connFormData, trustServerCertificate: e.target.checked })}
                    style={{ width: 16, height: 16, accentColor: 'var(--navy)' }}
                  />
                  <span><b>Trust Server Certificate</b> (Obligatorio para conexiones locales/VPN MSSQL)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={connFormData.isDefault}
                    onChange={(e) => setConnFormData({ ...connFormData, isDefault: e.target.checked })}
                    style={{ width: 16, height: 16, accentColor: 'var(--navy)' }}
                  />
                  <span>Establecer como Conexión Predeterminada del Sistema</span>
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
                <button
                  type="button"
                  onClick={() => setShowConnModal(false)}
                  className="btn"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn dark"
                >
                  {editingConn ? 'Actualizar Conexión' : 'Guardar y Probar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagementModule;
