import React, { useState, useEffect } from 'react';
import {
  Wrench,
  QrCode,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  Clock,
  Package,
  ExternalLink,
  ShieldCheck,
  Building,
  Check,
  X,
  Upload,
  RefreshCw,
  Send,
  User,
  Users,
  Search,
  ChevronDown,
  Plus,
  UserPlus,
  Shield,
  History,
  FileText,
  Save,
} from 'lucide-react';
import { OrdenAuditHistory } from './OrdenAuditHistory';
import SanLuisLogo from './SanLuisLogo';

interface MecanicoProfitItem {
  codigo: string;
  nombre: string;
  cargo: string | null;
  activo: boolean;
}

interface VendedorProfitItem {
  co_ven: string;
  cedula: string | null;
  ven_des: string;
}

interface Unidad {
  placa: string;
  marca: string;
  anio: number;
  tipo: string;
  empresa: string;
  cc: string;
  km: number;
  historialOsAnterior?: string;
  historialDias?: number;
  historialArea?: string;
}

interface AreaOT {
  id: string;
  area: string;
  fechaRecepcion: string;
  mecanico: string;
  diagnostico: string;
  horas: number;
  tarifaHora: number;
  costoManoObra: number;
  estado: 'abierta' | 'cerrada';
}

interface SolicitudRep {
  id: string;
  otId: string;
  cod: string;
  desc: string;
  cant: number;
  costoUnitario: number;
  costoTotal: number;
  stockActual: number;
  motivo?: string;
  estadoAprobacion: 'Pendiente' | 'Aprobada' | 'Rechazada';
  estadoEntrega: 'Por entregar' | 'Entregado' | 'Backorder';
  almacen: string;
  numMovimientoERP?: string;
}

interface SolicitudExt {
  id: string;
  otId: string;
  proveedor: string;
  descripcion: string;
  conGarantia: boolean;
  ordenOrigenGarantia?: string;
  costoCotizado: number;
  costoEfectivo: number;
  estadoAprobacion: 'Pendiente' | 'Aprobada' | 'Rechazada';
}

export const TallerModule: React.FC<{ token: string; activeCompany: any; currentUser?: any }> = ({ token, activeCompany, currentUser }) => {
  const [activeTab, setActiveTab] = useState<'apertura' | 'areas' | 'repuestos' | 'externos' | 'aprob' | 'almacen' | 'cierre' | 'auditoria'>('apertura');

  // Listas de la empresa activa
  const [companyFleet, setCompanyFleet] = useState<Unidad[]>([]);
  const [companyOrders, setCompanyOrders] = useState<any[]>([]);

  // Estado de la orden
  const [ordNo, setOrdNo] = useState('OS-2026-00101');
  const [estadoOrden, setEstadoOrden] = useState<'Abierta' | 'En Proceso' | 'Cerrada'>('Abierta');
  const [placa, setPlaca] = useState('A12BC3D');
  const [unidad, setUnidad] = useState<Unidad | null>(null);
  const [km, setKm] = useState(184320);
  const [recibidoPor, setRecibidoPor] = useState('V11587399');
  const [entregadoPor, setEntregadoPor] = useState('');
  const [sintomas, setSintomas] = useState('Ruido metálico al frenar y vibración en el volante sobre 60 km/h.');
  const [esReincidencia, setEsReincidencia] = useState(true);
  const [osAnterior, setOsAnterior] = useState('OS-2026-00089');
  const [motivoReinc, setMotivoReinc] = useState('Falla distinta, misma área');
  const [fotosCount, setFotosCount] = useState(1);
  const [recibeConforme, setRecibeConforme] = useState('');
  const [fEntrega, setFEntrega] = useState('');

  // Listas maestras desde Profit Plus MSSQL (ad_trans)
  const [mecanicosList, setMecanicosList] = useState<MecanicoProfitItem[]>([]);
  const [mecanicosLoading, setMecanicosLoading] = useState(false);
  const [mecanicoSearch, setMecanicoSearch] = useState('');
  const [showMecanicosDropdown, setShowMecanicosDropdown] = useState(false);

  const [vendedoresList, setVendedoresList] = useState<VendedorProfitItem[]>([]);
  const [vendedoresLoading, setVendedoresLoading] = useState(false);
  const [vendedorSearch, setVendedorSearch] = useState('');
  const [showVendedoresDropdown, setShowVendedoresDropdown] = useState(false);

  // Autocompletado para selección de Orden de Área
  const [otSearch, setOtSearch] = useState('');
  const [showOtDropdown, setShowOtDropdown] = useState(false);

  // Autocompletado para selección de Repuesto
  const [repSearch, setRepSearch] = useState('');
  const [showRepDropdown, setShowRepDropdown] = useState(false);

  // Listas de trabajo de la orden actual
  const [ots, setOts] = useState<AreaOT[]>([]);
  const [reps, setReps] = useState<SolicitudRep[]>([]);
  const [exts, setExts] = useState<SolicitudExt[]>([]);
  const [catalogo, setCatalogo] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [creandoOrden, setCreandoOrden] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Form inputs para nuevas solicitudes
  const [formArea, setFormArea] = useState({ area: 'Reparaciones mayores', mecanico: 'José Ramírez', diagnostico: 'Revisión y sustitución de pastillas y discos.', horas: 2 });
  const [formRep, setFormRep] = useState({ otId: '', cod: 'FRE-0234', cant: 1, motivo: 'Reemplazo preventivo por alabeo excesivo' });
  const [formExt, setFormExt] = useState({ otId: '', proveedor: 'Frenos y Rectificados Centro C.A.', descripcion: 'Rectificado de discos delanteros', conGarantia: false, ordenOrigen: '', costo: 45 });

  // Helper centralizado para peticiones autenticadas con contexto de empresa
  const authFetch = async (url: string, options: RequestInit = {}) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(activeCompany?.id ? { 'x-tenant-id': activeCompany.id } : {}),
      ...(options.headers as any || {}),
    };
    return fetch(url, { ...options, headers });
  };

  const showToast = (text: string, type: 'ok' | 'err' = 'ok') => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 4500);
  };

  // Cargar datos al cambiar de empresa activa o token
  useEffect(() => {
    cargarCatalogo();
    cargarDatosEmpresa();
    cargarMecanicos();
    cargarVendedores();
  }, [activeCompany?.id, token]);

  // Cargar orden actual cuando cambia el número de orden
  useEffect(() => {
    if (ordNo) {
      cargarOrdenActual(ordNo);
    }
  }, [ordNo]);

  // Cambiar pestaña activa por defecto según el rol del usuario autenticado
  useEffect(() => {
    if (currentUser?.role) {
      const role = currentUser.role.toUpperCase();
      if (role === 'MECANICO') {
        setActiveTab('areas');
      } else if (role === 'ALMACENISTA') {
        setActiveTab('almacen');
      } else if (role === 'AUDITOR') {
        setActiveTab('auditoria');
      } else if (role === 'GERENTE_TALLER' || role === 'SUPERVISOR') {
        setActiveTab('aprob');
      } else if (role === 'RESPONSABLE_FLOTA' || role === 'SOLICITANTE' || role === 'OPERADOR') {
        setActiveTab('apertura');
      }
    }
  }, [currentUser?.role]);

  const cargarMecanicos = async () => {
    setMecanicosLoading(true);
    try {
      const res = await authFetch('/api/v1/profit/mecanicos?limit=1000&sortBy=nombre&sortOrder=ASC');
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setMecanicosList(data.data);
        if (data.data.length > 0 && (!recibidoPor || recibidoPor === 'Ing. Carlos Mendoza')) {
          setRecibidoPor(data.data[0].codigo);
        }
      }
    } catch (err) {
      console.error('Error cargando mecanicos:', err);
    } finally {
      setMecanicosLoading(false);
    }
  };

  const cargarVendedores = async () => {
    setVendedoresLoading(true);
    try {
      const res = await authFetch('/api/v1/profit/vendedores?limit=1000&sortBy=ven_des&sortOrder=ASC');
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setVendedoresList(data.data);
      }
    } catch (err) {
      console.error('Error cargando vendedores:', err);
    } finally {
      setVendedoresLoading(false);
    }
  };

  const handleSelectMecanico = (codigo: string) => {
    setRecibidoPor(codigo);
    setMecanicoSearch('');
    setShowMecanicosDropdown(false);
  };

  const handleSelectVendedor = (nombre: string) => {
    setEntregadoPor(nombre);
    setVendedorSearch('');
    setShowVendedoresDropdown(false);
  };

  const handleAgregarNuevoConductor = (nombre: string) => {
    const cleanName = nombre.trim();
    if (!cleanName) return;

    if (!vendedoresList.some(v => v.ven_des.toLowerCase() === cleanName.toLowerCase())) {
      const nuevoItem: VendedorProfitItem = {
        co_ven: `COND-${(vendedoresList.length + 1).toString().padStart(3, '0')}`,
        ven_des: cleanName,
        cedula: null,
      };
      setVendedoresList(prev => [nuevoItem, ...prev]);
    }

    setEntregadoPor(cleanName);
    setVendedorSearch('');
    setShowVendedoresDropdown(false);
    showToast(`Conductor "${cleanName}" seleccionado y agregado.`);
  };

  const cargarCatalogo = async () => {
    try {
      const res = await authFetch('/api/v1/catalogo');
      const data = await res.json();
      if (data.success) {
        setCatalogo(data.data);
      }
    } catch (err) {
      console.error('Error al cargar catálogo:', err);
    }
  };

  const cargarDatosEmpresa = async () => {
    setLoading(true);
    try {
      // 1. Cargar flota de la empresa activa
      const resFlota = await authFetch('/api/v1/flota');
      const dataFlota = await resFlota.json();
      let flotaEmpresa: Unidad[] = [];
      if (dataFlota.success && dataFlota.data) {
        flotaEmpresa = dataFlota.data;
        setCompanyFleet(flotaEmpresa);
      }

      // 2. Cargar órdenes de la empresa activa
      const resOrdenes = await authFetch('/api/v1/ordenes');
      const dataOrdenes = await resOrdenes.json();
      let ordenesEmpresa: any[] = [];
      if (dataOrdenes.success && dataOrdenes.data) {
        ordenesEmpresa = dataOrdenes.data;
        setCompanyOrders(ordenesEmpresa);
      }

      // 3. Sincronizar orden o vehículo inicial para la empresa seleccionada
      if (ordenesEmpresa.length > 0) {
        const primeraOrden = ordenesEmpresa[0];
        setOrdNo(primeraOrden.id);
        setPlaca(primeraOrden.placa);
        await consultarPlaca(primeraOrden.placa);
      } else if (flotaEmpresa.length > 0) {
        const primerVehiculo = flotaEmpresa[0];
        setPlaca(primerVehiculo.placa);
        setUnidad(primerVehiculo);
        setKm(primerVehiculo.km || 0);
        setOrdNo(`OS-${new Date().getFullYear()}-NUEVA`);
        setEstadoOrden('Abierta');
        setOts([]);
        setReps([]);
        setExts([]);
      }
    } catch (err: any) {
      console.error('Error al cargar datos de empresa:', err);
      showToast('Error al sincronizar datos de la empresa: ' + err.message, 'err');
    } finally {
      setLoading(false);
    }
  };

  const consultarPlaca = async (p: string) => {
    if (!p) return;
    try {
      const res = await authFetch(`/api/v1/flota/${p.toUpperCase().trim()}`);
      const data = await res.json();
      if (data.success) {
        setUnidad(data.data);
        setKm(data.data.km || 0);
        if (data.reincidencia?.detectada) {
          setEsReincidencia(true);
          setOsAnterior(data.reincidencia.osAnterior || '');
          setMotivoReinc(data.data.historialArea ? 'Falla distinta, misma área' : '');
        } else {
          setEsReincidencia(false);
          setOsAnterior('');
          setMotivoReinc('');
        }
      } else {
        setUnidad(null);
        if (data.code === 'TENANT_ISOLATION_VIOLATION') {
          showToast(data.error, 'err');
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const cargarOrdenActual = async (targetOrdNo: string) => {
    if (!targetOrdNo || targetOrdNo.includes('NUEVA')) return;
    try {
      const res = await authFetch(`/api/v1/ordenes/${targetOrdNo}`);
      const data = await res.json();
      if (data.success) {
        setOts(data.data.ordenesArea || []);
        setReps(data.data.solicitudesRepuesto || []);
        setExts(data.data.solicitudesExterno || []);
        setEstadoOrden(data.data.estado);
        setPlaca(data.data.placa);
        setKm(data.data.km || 0);
        setSintomas(data.data.sintomas || '');
        setRecibidoPor(data.data.recibidoPor || 'Ing. Carlos Mendoza');
        setEntregadoPor(data.data.entregadoPor || '');
        setEsReincidencia(Boolean(data.data.esReincidencia));
        setOsAnterior(data.data.osAnterior || '');
        setMotivoReinc(data.data.motivoReincidencia || '');
        setFotosCount(data.data.fotosCount || 0);
        if (data.unidad) {
          setUnidad(data.unidad);
        }
      } else {
        if (data.code === 'TENANT_ISOLATION_VIOLATION') {
          showToast(data.error, 'err');
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleScanQR = async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/v1/flota/scan-qr', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.success) {
        setPlaca(data.data.placa);
        setUnidad(data.data);
        setKm(data.data.km || 0);
        if (data.reincidencia?.detectada) {
          setEsReincidencia(true);
          setOsAnterior(data.reincidencia.osAnterior || '');
        } else {
          setEsReincidencia(false);
          setOsAnterior('');
        }
        showToast(`QR escaneado: Unidad ${data.data.placa} (${data.data.marca}) [${data.data.empresa}]`);
      } else {
        showToast(data.error || 'Error al escanear código QR', 'err');
      }
    } catch (err: any) {
      showToast(err.message, 'err');
    } finally {
      setLoading(false);
    }
  };

  const handleCrearNuevaOrden = async () => {
    if (!unidad) {
      alert('Debe identificar una unidad perteneciente a la empresa activa antes de aperturar la orden.');
      return;
    }
    if (!sintomas.trim()) {
      alert('Debe registrar los síntomas o motivo de ingreso reportados.');
      return;
    }

    setCreandoOrden(true);
    try {
      const res = await authFetch('/api/v1/ordenes', {
        method: 'POST',
        body: JSON.stringify({
          placa: unidad.placa,
          km,
          recibidoPor,
          entregadoPor,
          sintomas,
          esReincidencia,
          osAnterior: esReincidencia ? osAnterior : undefined,
          motivoReincidencia: esReincidencia ? motivoReinc : undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        showToast(`¡Orden ${data.data.id} aperturada con éxito para ${unidad.empresa}!`);
        setOrdNo(data.data.id);
        setEstadoOrden('Abierta');
        // Refrescar órdenes de la empresa
        const resOrdenes = await authFetch('/api/v1/ordenes');
        const dataOrdenes = await resOrdenes.json();
        if (dataOrdenes.success) {
          setCompanyOrders(dataOrdenes.data);
        }
        setActiveTab('areas');
      } else {
        showToast(data.error || 'Error al aperturar orden', 'err');
      }
    } catch (err: any) {
      showToast(err.message, 'err');
    } finally {
      setCreandoOrden(false);
    }
  };

  const handleActualizarOrdenExistente = async () => {
    if (!ordNo) {
      showToast('No hay una orden de servicio seleccionada.', 'err');
      return;
    }
    if (estadoOrden === 'Cerrada') {
      showToast('No se puede modificar una orden que ya ha sido cerrada.', 'err');
      return;
    }

    setLoading(true);
    try {
      const res = await authFetch(`/api/v1/ordenes/${ordNo}`, {
        method: 'PUT',
        body: JSON.stringify({
          km,
          sintomas,
          recibidoPor,
          entregadoPor,
          motivoReincidencia: esReincidencia ? motivoReinc : undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`¡Cambios guardados y auditados para la orden ${ordNo}!`);
      } else {
        showToast(data.error || 'Error al actualizar orden', 'err');
      }
    } catch (err: any) {
      showToast(err.message, 'err');
    } finally {
      setLoading(false);
    }
  };

  const handleCrearArea = async () => {
    if (!formArea.area || !formArea.mecanico) {
      alert('Complete el área y mecánico asignado');
      return;
    }
    try {
      const res = await authFetch(`/api/v1/ordenes/${ordNo}/areas`, {
        method: 'POST',
        body: JSON.stringify(formArea),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Orden de área ${data.data.id} creada con éxito`);
        cargarOrdenActual(ordNo);
      } else {
        showToast(data.error, 'err');
      }
    } catch (err: any) {
      showToast(err.message, 'err');
    }
  };

  const handleUpdateArea = async (otId: string, updates: any) => {
    try {
      const res = await authFetch(`/api/v1/ordenes/${ordNo}/areas/${otId}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Orden de área ${otId} actualizada`);
        cargarOrdenActual(ordNo);
      } else {
        showToast(data.error, 'err');
      }
    } catch (err: any) {
      showToast(err.message, 'err');
    }
  };

  const handleCrearRepuesto = async () => {
    const targetOt = formRep.otId || (ots[0] ? ots[0].id : '');
    if (!targetOt || !formRep.cod || formRep.cant < 1) {
      alert('Seleccione orden de área, código de repuesto y cantidad válida');
      return;
    }
    try {
      const res = await authFetch(`/api/v1/ordenes/${ordNo}/repuestos`, {
        method: 'POST',
        body: JSON.stringify({ ...formRep, otId: targetOt }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Solicitud de repuesto agregada');
        cargarOrdenActual(ordNo);
      } else {
        showToast(data.error, 'err');
      }
    } catch (err: any) {
      showToast(err.message, 'err');
    }
  };

  const handleCrearExterno = async () => {
    const targetOt = formExt.otId || (ots[0] ? ots[0].id : '');
    if (!targetOt || !formExt.proveedor || !formExt.descripcion) {
      alert('Complete orden de área, proveedor y descripción');
      return;
    }
    try {
      const res = await authFetch(`/api/v1/ordenes/${ordNo}/externos`, {
        method: 'POST',
        body: JSON.stringify({
          otId: targetOt,
          proveedor: formExt.proveedor,
          descripcion: formExt.descripcion,
          conGarantia: formExt.conGarantia,
          ordenOrigenGarantia: formExt.ordenOrigen,
          costoCotizado: formExt.costo,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Solicitud de servicio externo agregada');
        cargarOrdenActual(ordNo);
      } else {
        showToast(data.error, 'err');
      }
    } catch (err: any) {
      showToast(err.message, 'err');
    }
  };

  const handleProcesarAprobacion = async (tipo: 'repuesto' | 'externo', id: string, accion: 'APROBAR' | 'RECHAZAR') => {
    try {
      const res = await authFetch(`/api/v1/aprobaciones/${tipo}/${id}`, {
        method: 'POST',
        body: JSON.stringify({ accion }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Solicitud ${accion === 'APROBAR' ? 'aprobada' : 'rechazada'}`);
        cargarOrdenActual(ordNo);
      } else {
        showToast(data.error, 'err');
      }
    } catch (err: any) {
      showToast(err.message, 'err');
    }
  };

  const handleConfirmarDespacho = async (id: string) => {
    try {
      const res = await authFetch(`/api/v1/almacen/despachos/${id}`, {
        method: 'POST',
        body: JSON.stringify({ accion: 'DESPACHAR' }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Despacho confirmado y movimiento ERP conciliado');
        cargarOrdenActual(ordNo);
      } else {
        showToast(data.error, 'err');
      }
    } catch (err: any) {
      showToast(err.message, 'err');
    }
  };

  const handleCerrarOrden = async () => {
    if (!recibeConforme.trim()) {
      alert('Debe indicar el nombre de quien recibe conforme.');
      return;
    }
    try {
      const res = await authFetch(`/api/v1/ordenes/${ordNo}/cerrar`, {
        method: 'POST',
        body: JSON.stringify({ fechaEntrega: fEntrega || new Date().toISOString(), recibeConforme }),
      });
      const data = await res.json();
      if (data.success) {
        setEstadoOrden('Cerrada');
        showToast('¡Orden cerrada exitosamente y liquidación enviada al ERP!');
        cargarOrdenActual(ordNo);
        // Refrescar lista de órdenes
        const resOrdenes = await authFetch('/api/v1/ordenes');
        const dataOrdenes = await resOrdenes.json();
        if (dataOrdenes.success) {
          setCompanyOrders(dataOrdenes.data);
        }
      } else {
        alert(`Bloqueo de Cierre:\n${(data.bloqueos || [data.error]).join('\n')}`);
      }
    } catch (err: any) {
      showToast(err.message, 'err');
    }
  };

  // Cálculos de liquidación
  const totalRepuestos = reps.filter(r => r.estadoAprobacion === 'Aprobada').reduce((acc, r) => acc + Number(r.costoTotal || 0), 0);
  const totalManoObra = ots.reduce((acc, o) => acc + Number(o.costoManoObra || 0), 0);
  const totalExternos = exts.filter(x => x.estadoAprobacion === 'Aprobada').reduce((acc, x) => acc + Number(x.costoEfectivo || 0), 0);
  const serviciosGarantia = exts.filter(x => x.conGarantia).length;
  const totalGeneral = totalRepuestos + totalManoObra + totalExternos;

  // Validaciones
  const validaciones: string[] = [];
  if (!unidad) validaciones.push('Falta identificar la unidad.');
  if (!sintomas.trim()) validaciones.push('Falta registrar los síntomas reportados.');
  if (!ots.length) validaciones.push('No hay órdenes de área abiertas.');
  const otsAbiertas = ots.filter(o => o.estado === 'abierta');
  if (otsAbiertas.length) validaciones.push(`${otsAbiertas.length} orden(es) de área sin cerrar: ${otsAbiertas.map(o => o.id).join(', ')}.`);
  const pendAprob = [...reps, ...exts].filter(s => s.estadoAprobacion === 'Pendiente').length;
  if (pendAprob) validaciones.push(`${pendAprob} solicitud(es) sin aprobación del gerente de taller.`);
  const sinDespacho = reps.filter(r => r.estadoAprobacion === 'Aprobada' && r.estadoEntrega !== 'Entregado').length;
  if (sinDespacho) validaciones.push(`${sinDespacho} repuesto(s) aprobados sin entregar por almacén.`);
  if (esReincidencia && !motivoReinc) validaciones.push('Falta indicar el motivo de la reincidencia.');
  if (ots.some(o => Number(o.horas) <= 0)) validaciones.push('Hay órdenes de área sin horas de mano de obra registradas.');

  const puedeCerrar = validaciones.length === 0;

  return (
    <div className="wrap">
      {/* Toast Notification */}
      {msg && (
        <div className={`note ${msg.type === 'ok' ? 'n-ok' : 'n-bad'}`} style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {msg.type === 'ok' ? <CheckCircle className="w-4 h-4 text-[var(--ok)]" /> : <AlertCircle className="w-4 h-4 text-[var(--bad)]" />}
            <span>{msg.text}</span>
          </div>
          <button onClick={() => setMsg(null)} className="btn" style={{ minHeight: 'auto', padding: '2px 8px', fontSize: 12 }}>Cerrar</button>
        </div>
      )}

      {/* Banner de Contexto de Empresa y Selector de Órdenes */}
      <div className="card" style={{ marginBottom: 16, borderLeft: '4px solid var(--navy)', background: '#ffffff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <SanLuisLogo variant="light" height={36} />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span className="chip" style={{ background: 'var(--navy)', color: '#ffffff', fontWeight: 600 }}>
                  🏢 {activeCompany?.name || 'Empresa Activa'}
                </span>
                <span style={{ fontSize: 13, color: 'var(--slate)', fontWeight: 500 }}>
                  RIF: {activeCompany?.taxId || 'N/A'}
                </span>
              </div>
              <p className="hint" style={{ marginTop: 4, marginBottom: 0, fontSize: 12 }}>
                Gestión de Taller & Flota ({companyFleet.length} unidades registradas) • Orden activa: <b className="mono text-navy">{ordNo}</b>
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>Órdenes de {activeCompany?.code || 'Empresa'}:</label>
            <select
              value={ordNo}
              onChange={(e) => {
                const selected = e.target.value;
                setOrdNo(selected);
                if (selected.includes('NUEVA')) {
                  setEstadoOrden('Abierta');
                  setOts([]);
                  setReps([]);
                  setExts([]);
                  setSintomas('');
                }
              }}
              style={{ padding: '6px 12px', fontSize: 13, minWidth: 160 }}
            >
              {companyOrders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.id} - {o.placa} ({o.estado})
                </option>
              ))}
              <option value={`OS-${new Date().getFullYear()}-NUEVA`}>➕ Aperturar Nueva Orden</option>
            </select>
            <button
              onClick={() => {
                setOrdNo(`OS-${new Date().getFullYear()}-NUEVA`);
                setEstadoOrden('Abierta');
                setOts([]);
                setReps([]);
                setExts([]);
                setSintomas('');
                setActiveTab('apertura');
              }}
              className="btn"
              style={{ padding: '6px 10px', fontSize: 12 }}
            >
              + Nueva Orden
            </button>
          </div>
        </div>

        {/* Selector rápido de flota de la empresa */}
        {companyFleet.length > 0 && (
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--line-soft)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--slate)', fontWeight: 600 }}>Unidades de {activeCompany?.code || 'esta empresa'}:</span>
            {companyFleet.map((v) => (
              <button
                key={v.placa}
                type="button"
                onClick={() => {
                  setPlaca(v.placa);
                  consultarPlaca(v.placa);
                }}
                className={`chip mono ${placa === v.placa ? 'b-ok' : ''}`}
                style={{
                  cursor: 'pointer',
                  border: placa === v.placa ? '2px solid var(--navy)' : '1px solid var(--line)',
                  background: placa === v.placa ? 'var(--navy)' : '#ffffff',
                  color: placa === v.placa ? '#ffffff' : 'var(--ink)',
                  fontWeight: 600,
                  fontSize: 12,
                }}
              >
                {v.placa} ({v.marca})
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Top Banner de la Orden */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="ot-head">
          <div>
            <div className="brand">
              <h1>Orden de Servicio</h1>
              <span className="ordno">{ordNo}</span>
            </div>
            <div className="ordline">
              <span className="hint" style={{ marginBottom: 0 }}>
                {unidad ? `${unidad.marca} (${unidad.placa}) • Empresa: ${unidad.empresa} • CC: ${unidad.cc}` : 'Sin Unidad Seleccionada'}
              </span>
            </div>
          </div>
          <div className="topmeta">
            <div>
              <span className="k">Estatus</span>
              <span className="chip">{estadoOrden}</span>
            </div>
            <div>
              <span className="k">Órdenes de Área</span>
              <span className="v">{ots.length}</span>
            </div>
            <div>
              <span className="k">Costo Acumulado</span>
              <span className="v" style={{ color: 'var(--navy)', fontWeight: 700 }}>${totalGeneral.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Navegación por pestañas (Fase 1 Taller) */}
      <div className="tabs" style={{ borderRadius: 'var(--r)', marginBottom: 16 }}>
        <div className="tabs-in">
          {[
            { id: 'apertura', num: '01', label: 'Apertura', flag: !unidad || !sintomas.trim() },
            { id: 'areas', num: '02', label: 'Áreas y diagnóstico', flag: !ots.length || otsAbiertas.length > 0 },
            { id: 'repuestos', num: '03', label: 'Repuestos', flag: false },
            { id: 'externos', num: '04', label: 'Servicios externos', flag: false },
            { id: 'aprob', num: '05', label: 'Aprobaciones', flag: pendAprob > 0 },
            { id: 'almacen', num: '06', label: 'Almacén', flag: sinDespacho > 0 },
            { id: 'cierre', num: '07', label: 'Cierre', flag: !puedeCerrar },
            { id: 'auditoria', num: '08', label: 'Auditoría / Trazabilidad', flag: false },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`tab ${activeTab === t.id ? 'active' : ''} ${t.flag ? 'flag' : ''}`}
              aria-selected={activeTab === t.id}
            >
              <span className="num">{t.num}</span>
              {t.label}
              <span className="dot" />
            </button>
          ))}
        </div>
      </div>

      {/* PANELES */}

      {/* 01 APERTURA */}
      <div className={`panel ${activeTab === 'apertura' ? 'on' : ''}`}>
        <div className="card">
          <h2>Identificación de la unidad</h2>
          <p className="hint">Escanea el código QR de la unidad o introduce la placa registrada.</p>

          <div className="grid g2" style={{ marginBottom: 14 }}>
            <label className="f">
              <span className="req">Placa</span>
              <input
                value={placa}
                onChange={(e) => { setPlaca(e.target.value); consultarPlaca(e.target.value); }}
                placeholder="A12BC3D"
                className="mono"
              />
            </label>
            <label className="f">
              <span>Lectura de QR</span>
              <button
                onClick={handleScanQR}
                disabled={loading}
                className="btn"
                style={{ width: '100%' }}
              >
                <QrCode className="w-4 h-4 text-[var(--navy)]" />
                {loading ? 'Escaneando...' : 'Escanear QR de la unidad'}
              </button>
            </label>
          </div>

          {unidad ? (
            <div className="unit" style={{ marginBottom: 14 }}>
              <div><span className="k">Placa</span><span className="v font-bold">{unidad.placa}</span></div>
              <div><span className="k">Unidad</span><span className="v">{unidad.marca} ({unidad.anio})</span></div>
              <div><span className="k">Tipo</span><span className="v">{unidad.tipo}</span></div>
              <div><span className="k">Empresa</span><span className="v">{unidad.empresa}</span></div>
              <div><span className="k">Centro Costo</span><span className="v font-bold text-[var(--lime)]">{unidad.cc}</span></div>
            </div>
          ) : (
            <div className="note n-bad" style={{ marginBottom: 14 }}>
              Placa no encontrada en el maestro de flota. Verifique el código o regístrela en el panel.
            </div>
          )}

          <div className="grid g3">
            <label className="f">
              <span className="req">Kilometraje / Horómetro</span>
              <input
                type="number"
                value={km}
                onChange={(e) => setKm(Number(e.target.value))}
                className="mono"
              />
            </label>

            {/* Recibido por: Autocompletado con búsqueda y selección directa de Mecánico (sin segundo select) */}
            <div className="f" style={{ position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span className="req" style={{ fontWeight: 600, fontSize: 13 }}>Recibido por (Mecánico)</span>
                <span style={{ fontSize: 11, color: 'var(--slate)', fontFamily: 'monospace' }}>
                  Código: <b style={{ color: 'var(--navy)' }}>{recibidoPor || 'Sin asignar'}</b>
                </span>
              </div>

              <div style={{ position: 'relative' }}>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Search className="w-4 h-4 text-[var(--slate)]" style={{ position: 'absolute', left: 10, pointerEvents: 'none' }} />
                  <input
                    type="text"
                    value={mecanicoSearch}
                    onChange={(e) => {
                      setMecanicoSearch(e.target.value);
                      setShowMecanicosDropdown(true);
                    }}
                    onFocus={() => setShowMecanicosDropdown(true)}
                    placeholder={
                      (() => {
                        const actual = mecanicosList.find(m => m.codigo === recibidoPor);
                        return actual ? `[${actual.codigo}] ${actual.nombre}${actual.cargo ? ` — ${actual.cargo}` : ''}` : "Buscar mecánico por nombre o código...";
                      })()
                    }
                    style={{ paddingLeft: 32, paddingRight: 56, width: '100%', height: 38 }}
                  />
                  <div style={{ position: 'absolute', right: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                    {mecanicoSearch && (
                      <button
                        type="button"
                        onClick={() => {
                          setMecanicoSearch('');
                        }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--slate)' }}
                        title="Limpiar búsqueda"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowMecanicosDropdown(!showMecanicosDropdown)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--slate)' }}
                      title="Ver catálogo de mecánicos"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Dropdown flotante con lista completa de mecánicos */}
                {showMecanicosDropdown && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      zIndex: 50,
                      background: '#ffffff',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15)',
                      maxHeight: 260,
                      overflowY: 'auto',
                      marginTop: 4,
                      padding: 4,
                    }}
                  >
                    <div style={{ padding: '6px 8px', fontSize: 11, color: 'var(--slate)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Mecánicos registrados ({mecanicosList.length} total)</span>
                      <button
                        type="button"
                        onClick={() => setShowMecanicosDropdown(false)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--navy)', fontWeight: 600 }}
                      >
                        Cerrar ✕
                      </button>
                    </div>
                    {mecanicosLoading ? (
                      <div style={{ padding: 12, textAlign: 'center', fontSize: 12, color: 'var(--slate)' }}>Cargando catálogo de mecánicos...</div>
                    ) : (
                      (() => {
                        const filtrados = mecanicosList.filter(m => {
                          if (!mecanicoSearch.trim()) return true;
                          const t = mecanicoSearch.toLowerCase();
                          return m.nombre.toLowerCase().includes(t) || m.codigo.toLowerCase().includes(t) || (m.cargo && m.cargo.toLowerCase().includes(t));
                        });

                        if (filtrados.length === 0) {
                          return (
                            <div style={{ padding: 12, textAlign: 'center', fontSize: 12, color: 'var(--slate)' }}>
                              No se encontraron mecánicos para "{mecanicoSearch}"
                            </div>
                          );
                        }

                        return filtrados.map(m => {
                          const isSelected = recibidoPor === m.codigo;
                          return (
                            <div
                              key={m.codigo}
                              onClick={() => handleSelectMecanico(m.codigo)}
                              style={{
                                padding: '8px 10px',
                                borderRadius: 6,
                                cursor: 'pointer',
                                background: isSelected ? '#f0fdf4' : 'transparent',
                                borderBottom: '1px solid #f1f5f9',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                transition: 'background 0.15s ease',
                              }}
                              onMouseEnter={(e) => {
                                if (!isSelected) (e.currentTarget as HTMLElement).style.background = '#f8fafc';
                              }}
                              onMouseLeave={(e) => {
                                if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent';
                              }}
                            >
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 12, color: 'var(--navy)', background: '#e2e8f0', padding: '1px 5px', borderRadius: 4 }}>
                                    {m.codigo}
                                  </span>
                                  <span style={{ fontWeight: 600, fontSize: 13, color: '#0f172a' }}>
                                    {m.nombre}
                                  </span>
                                  {m.activo && (
                                    <span style={{ fontSize: 10, background: '#dcfce7', color: '#15803d', padding: '1px 4px', borderRadius: 3, fontWeight: 600 }}>
                                      Activo
                                    </span>
                                  )}
                                </div>
                                {m.cargo && (
                                  <span style={{ fontSize: 11, color: 'var(--slate)', marginTop: 2 }}>
                                    {m.cargo}
                                  </span>
                                )}
                              </div>
                              {isSelected && <Check className="w-4 h-4 text-emerald-600" />}
                            </div>
                          );
                        });
                      })()
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Entregado por: Autocompletado con búsqueda y capacidad de agregar nuevo si no existe */}
            <div className="f" style={{ position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontWeight: 600, fontSize: 13 }}>Entregado por (Conductor/Vendedor)</span>
                <span style={{ fontSize: 11, color: 'var(--slate)' }}>
                  {entregadoPor ? <b style={{ color: 'var(--navy)' }}>{entregadoPor}</b> : 'Búsqueda o nuevo'}
                </span>
              </div>

              <div style={{ position: 'relative' }}>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Search className="w-4 h-4 text-[var(--slate)]" style={{ position: 'absolute', left: 10, pointerEvents: 'none' }} />
                  <input
                    type="text"
                    value={vendedorSearch || (showVendedoresDropdown ? '' : entregadoPor)}
                    onChange={(e) => {
                      const val = e.target.value;
                      setVendedorSearch(val);
                      setEntregadoPor(val);
                      setShowVendedoresDropdown(true);
                    }}
                    onFocus={() => {
                      if (!vendedorSearch && entregadoPor) {
                        setVendedorSearch(entregadoPor);
                      }
                      setShowVendedoresDropdown(true);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (vendedorSearch.trim()) {
                          handleAgregarNuevoConductor(vendedorSearch.trim());
                        }
                      }
                    }}
                    placeholder="Buscar conductor/vendedor o escribir nuevo..."
                    style={{ paddingLeft: 32, paddingRight: 56, width: '100%', height: 38 }}
                  />
                  <div style={{ position: 'absolute', right: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                    {(vendedorSearch || entregadoPor) && (
                      <button
                        type="button"
                        onClick={() => {
                          setVendedorSearch('');
                          setEntregadoPor('');
                          setShowVendedoresDropdown(false);
                        }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--slate)' }}
                        title="Limpiar campo"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowVendedoresDropdown(!showVendedoresDropdown)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--slate)' }}
                      title="Ver lista de conductores y vendedores"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Dropdown flotante con búsqueda y opción de nuevo registro */}
                {showVendedoresDropdown && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      zIndex: 50,
                      background: '#ffffff',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15)',
                      maxHeight: 260,
                      overflowY: 'auto',
                      marginTop: 4,
                      padding: 4,
                    }}
                  >
                    <div style={{ padding: '6px 8px', fontSize: 11, color: 'var(--slate)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Conductores y Vendedores ({vendedoresList.length} en catálogo)</span>
                      <button
                        type="button"
                        onClick={() => setShowVendedoresDropdown(false)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--navy)', fontWeight: 600 }}
                      >
                        Cerrar ✕
                      </button>
                    </div>

                    {/* Botón para agregar el término actual si se ha escrito algo */}
                    {vendedorSearch.trim() && (
                      <div
                        onClick={() => handleAgregarNuevoConductor(vendedorSearch.trim())}
                        style={{
                          margin: '4px 0',
                          padding: '8px 10px',
                          borderRadius: 6,
                          background: '#eff6ff',
                          border: '1px dashed #3b82f6',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          color: '#1e40af',
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        <UserPlus className="w-4 h-4 text-blue-600 shrink-0" />
                        <span style={{ flex: 1 }}>
                          ➕ Usar / Registrar <b>"{vendedorSearch.trim()}"</b> como conductor
                        </span>
                      </div>
                    )}

                    {vendedoresLoading ? (
                      <div style={{ padding: 12, textAlign: 'center', fontSize: 12, color: 'var(--slate)' }}>Cargando conductores y vendedores...</div>
                    ) : (
                      (() => {
                        const filtrados = vendedoresList.filter(v => {
                          if (!vendedorSearch.trim()) return true;
                          const t = vendedorSearch.toLowerCase();
                          return v.ven_des.toLowerCase().includes(t) || v.co_ven.toLowerCase().includes(t) || (v.cedula && v.cedula.toLowerCase().includes(t));
                        });

                        if (filtrados.length === 0) {
                          return (
                            <div style={{ padding: 12, textAlign: 'center', fontSize: 12, color: 'var(--slate)' }}>
                              No se encontraron conductores con ese nombre.
                              <div style={{ marginTop: 4, color: 'var(--navy)', fontWeight: 500 }}>
                                Puedes usar la opción superior para registrarlo.
                              </div>
                            </div>
                          );
                        }

                        return filtrados.map(v => {
                          const isSelected = entregadoPor.toLowerCase() === v.ven_des.toLowerCase();
                          return (
                            <div
                              key={v.co_ven}
                              onClick={() => handleSelectVendedor(v.ven_des)}
                              style={{
                                padding: '8px 10px',
                                borderRadius: 6,
                                cursor: 'pointer',
                                background: isSelected ? '#f0fdf4' : 'transparent',
                                borderBottom: '1px solid #f1f5f9',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                transition: 'background 0.15s ease',
                              }}
                              onMouseEnter={(e) => {
                                if (!isSelected) (e.currentTarget as HTMLElement).style.background = '#f8fafc';
                              }}
                              onMouseLeave={(e) => {
                                if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent';
                              }}
                            >
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 11, color: 'var(--navy)', background: '#e2e8f0', padding: '1px 5px', borderRadius: 4 }}>
                                    {v.co_ven}
                                  </span>
                                  <span style={{ fontWeight: 600, fontSize: 13, color: '#0f172a' }}>
                                    {v.ven_des}
                                  </span>
                                </div>
                                {v.cedula && (
                                  <span style={{ fontSize: 11, color: 'var(--slate)', marginTop: 2 }}>
                                    C.I: {v.cedula}
                                  </span>
                                )}
                              </div>
                              {isSelected && <Check className="w-4 h-4 text-emerald-600" />}
                            </div>
                          );
                        });
                      })()
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Reincidencia */}
        <div className="card">
          <h2>Reincidencia</h2>
          {esReincidencia ? (
            <div className="note n-bad" style={{ marginBottom: 14 }}>
              <b>Reincidencia detectada.</b> Esta unidad estuvo en Reparaciones mayores hace 18 días bajo la orden {osAnterior}. Confirma el motivo antes de continuar.
            </div>
          ) : (
            <div className="note n-ok" style={{ marginBottom: 14 }}>
              Sin reincidencia registrada para esta unidad.
            </div>
          )}

          <div className="grid g2">
            <label className="f">
              <span>Orden de servicio anterior</span>
              <input value={osAnterior} readOnly className="mono" />
            </label>
            <label className="f">
              <span>Motivo de la reincidencia</span>
              <select
                value={motivoReinc}
                onChange={(e) => setMotivoReinc(e.target.value)}
                disabled={!esReincidencia}
              >
                <option value="">Sin especificar</option>
                <option>Reparación incompleta</option>
                <option>Repuesto defectuoso</option>
                <option>Diagnóstico errado</option>
                <option>Falla distinta, misma área</option>
              </select>
            </label>
          </div>
        </div>

        {/* Síntomas */}
        <div className="card">
          <h2>Síntomas reportados</h2>
          <label className="f" style={{ marginBottom: 14 }}>
            <span>Descripción del operador</span>
            <textarea
              value={sintomas}
              onChange={(e) => setSintomas(e.target.value)}
              placeholder="Describe lo que reporta el operador..."
            />
          </label>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                onClick={() => setFotosCount(fotosCount + 1)}
                className="btn"
              >
                <Upload className="w-3.5 h-3.5 text-[var(--navy)]" /> Adjuntar fotografía
              </button>
              <span style={{ fontSize: 13, color: 'var(--slate)' }}>{fotosCount} fotografía(s) adjunta(s)</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {estadoOrden !== 'Cerrada' && (
                <button
                  type="button"
                  onClick={handleActualizarOrdenExistente}
                  disabled={loading}
                  className="btn"
                  style={{
                    padding: '8px 16px',
                    fontWeight: 600,
                    background: '#eff6ff',
                    borderColor: '#93c5fd',
                    color: '#1d4ed8',
                  }}
                  title="Registra los cambios en kilometraje, síntomas o conductores en la bitácora de auditoría"
                >
                  <Save className="w-4 h-4 text-blue-600" />
                  {loading ? 'Guardando...' : 'Guardar y Auditar Modificaciones'}
                </button>
              )}

              <button
                onClick={handleCrearNuevaOrden}
                disabled={creandoOrden || !unidad || !sintomas.trim()}
                className="btn dark"
                style={{ padding: '8px 18px', fontWeight: 600 }}
              >
                {creandoOrden ? 'Aperturando...' : `💾 Aperturar Nueva Orden para ${activeCompany?.code || 'Empresa'}`}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 02 ÁREAS Y DIAGNÓSTICO */}
      <div className={`panel ${activeTab === 'areas' ? 'on' : ''}`}>
        <div className="card">
          <h2>Abrir orden en un área</h2>
          <div className="grid g3" style={{ marginBottom: 14 }}>
            <label className="f">
              <span className="req">Área</span>
              <select
                value={formArea.area}
                onChange={(e) => setFormArea({ ...formArea, area: e.target.value })}
              >
                <option>Mtto preventivo</option>
                <option>Reparaciones mayores</option>
                <option>Mtto correctivo</option>
                <option>Metalmecánica</option>
                <option>Latonería y pintura</option>
                <option>Cauchera</option>
                <option>Lavado</option>
              </select>
            </label>
            <label className="f">
              <span className="req">Mecánico Asignado</span>
              <select
                value={formArea.mecanico}
                onChange={(e) => setFormArea({ ...formArea, mecanico: e.target.value })}
              >
                {mecanicosList.length > 0 ? (
                  mecanicosList.map((m) => (
                    <option key={m.codigo} value={m.nombre}>
                      [{m.codigo}] {m.nombre} {m.cargo ? `(${m.cargo})` : ''}
                    </option>
                  ))
                ) : (
                  <>
                    <option>José Gregorio Hernández Ramírez</option>
                    <option>Luis Márquez</option>
                    <option>Ana Peña</option>
                    <option>Carlos Ojeda</option>
                    <option>Miguel Sanz</option>
                  </>
                )}
              </select>
            </label>
            <label className="f">
              <span>Horas estimadas</span>
              <input
                type="number"
                step="0.5"
                value={formArea.horas}
                onChange={(e) => setFormArea({ ...formArea, horas: parseFloat(e.target.value) || 0 })}
                className="mono"
              />
            </label>
          </div>
          <label className="f" style={{ marginBottom: 14 }}>
            <span>Triaje / Diagnóstico</span>
            <textarea
              value={formArea.diagnostico}
              onChange={(e) => setFormArea({ ...formArea, diagnostico: e.target.value })}
              placeholder="Hallazgo técnico y trabajo a ejecutar..."
            />
          </label>
          <button
            onClick={handleCrearArea}
            className="btn dark"
          >
            Abrir orden de área
          </button>
        </div>

        {/* Listado de OTs */}
        <div>
          {ots.length === 0 ? (
            <div className="empty">
              Aún no hay órdenes de área. Abre al menos una para poder solicitar repuestos o servicios.
            </div>
          ) : (
            ots.map((ot) => (
              <div key={ot.id} className={`ot ${ot.estado === 'cerrada' ? 'cerrada' : 'abierta'}`}>
                <div className="ot-head">
                  <div>
                    <h3>{ot.area}</h3>
                    <div className="sub">{ot.id} • Mecánico: {ot.mecanico}</div>
                  </div>
                  <span className={`badge ${ot.estado === 'cerrada' ? 'b-ok' : 'b-hi'}`}>
                    {ot.estado === 'cerrada' ? 'Cerrada' : 'En ejecución'}
                  </span>
                </div>
                <label className="f" style={{ marginBottom: 12 }}>
                  <span>Diagnóstico</span>
                  <textarea
                    value={ot.diagnostico}
                    onChange={(e) => handleUpdateArea(ot.id, { diagnostico: e.target.value })}
                  />
                </label>
                <div className="grid g3" style={{ background: 'var(--paper)', padding: 12, borderRadius: 'var(--r)', marginBottom: 12 }}>
                  <div>
                    <span style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--slate)' }}>Horas MO:</span>
                    <input
                      type="number"
                      step="0.5"
                      value={ot.horas}
                      onChange={(e) => handleUpdateArea(ot.id, { horas: parseFloat(e.target.value) || 0 })}
                      className="mono"
                      style={{ marginTop: 4 }}
                    />
                  </div>
                  <div>
                    <span style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--slate)' }}>Tarifa:</span>
                    <div className="mono font-bold" style={{ marginTop: 8 }}>${ot.tarifaHora}/h</div>
                  </div>
                  <div>
                    <span style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--slate)' }}>Costo MO:</span>
                    <div className="mono font-bold" style={{ marginTop: 8, color: 'var(--navy)' }}>${Number(ot.costoManoObra).toFixed(2)}</div>
                  </div>
                </div>
                <div className="row-end">
                  <button
                    onClick={() => handleUpdateArea(ot.id, { estado: ot.estado === 'cerrada' ? 'abierta' : 'cerrada' })}
                    className={`btn ${ot.estado === 'cerrada' ? '' : 'dark'}`}
                  >
                    {ot.estado === 'cerrada' ? 'Reabrir orden de área' : 'Cerrar orden de área'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 03 REPUESTOS */}
      <div className={`panel ${activeTab === 'repuestos' ? 'on' : ''}`}>
        <div className="card">
          <h2>Solicitud de repuesto</h2>
          <p className="hint">Toda solicitud requiere aprobación del gerente de taller antes del despacho.</p>

          <div className="grid g2" style={{ marginBottom: 14 }}>
            <label className="f">
              <span className="req">Orden de área</span>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  value={otSearch !== '' ? otSearch : (formRep.otId ? ots.find(o => o.id === formRep.otId)?.id + ' — ' + ots.find(o => o.id === formRep.otId)?.area : '')}
                  onChange={(e) => {
                    setOtSearch(e.target.value);
                    setShowOtDropdown(true);
                  }}
                  onFocus={() => {
                    setOtSearch('');
                    setShowOtDropdown(true);
                  }}
                  onBlur={() => setTimeout(() => setShowOtDropdown(false), 200)}
                  placeholder="Buscar orden de área..."
                  className="mono"
                />
                {showOtDropdown && ots.length > 0 && (
                  <ul className="autocomplete-dropdown">
                    {ots
                      .filter(o => {
                        const search = otSearch.toLowerCase();
                        if (!search) return true;
                        return (
                          o.id.toLowerCase().includes(search) ||
                          o.area.toLowerCase().includes(search)
                        );
                      })
                      .slice(0, 50)
                      .map(o => (
                        <li
                          key={o.id}
                          onMouseDown={() => {
                            setFormRep({ ...formRep, otId: o.id });
                            setOtSearch('');
                            setShowOtDropdown(false);
                          }}
                          className="autocomplete-item"
                        >
                          <strong className="mono">{o.id}</strong> — {o.area}
                          {o.mecanico && <span style={{ color: 'var(--slate)', fontSize: 11, marginLeft: 6 }}>· {o.mecanico}</span>}
                        </li>
                      ))}
                    {ots.filter(o => {
                      const search = otSearch.toLowerCase();
                      if (!search) return true;
                      return o.id.toLowerCase().includes(search) || o.area.toLowerCase().includes(search);
                    }).length === 0 && (
                      <li className="autocomplete-empty">Sin resultados</li>
                    )}
                  </ul>
                )}
              </div>
            </label>
            <label className="f">
              <span className="req">Repuesto</span>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  value={repSearch !== '' ? repSearch : (formRep.cod ? catalogo.find(c => c.cod === formRep.cod)?.cod + ' — ' + catalogo.find(c => c.cod === formRep.cod)?.desc : '')}
                  onChange={(e) => {
                    setRepSearch(e.target.value);
                    setShowRepDropdown(true);
                  }}
                  onFocus={() => {
                    setRepSearch('');
                    setShowRepDropdown(true);
                  }}
                  onBlur={() => setTimeout(() => setShowRepDropdown(false), 200)}
                  placeholder="Buscar por código o descripción..."
                  className="mono"
                />
                {showRepDropdown && catalogo.length > 0 && (
                  <ul className="autocomplete-dropdown">
                    {catalogo
                      .filter(c => {
                        const search = repSearch.toLowerCase();
                        if (!search) return true;
                        return (
                          c.cod.toLowerCase().includes(search) ||
                          (c.desc || '').toLowerCase().includes(search)
                        );
                      })
                      .slice(0, 50)
                      .map(c => (
                        <li
                          key={c.cod}
                          onMouseDown={() => {
                            setFormRep({ ...formRep, cod: c.cod });
                            setRepSearch('');
                            setShowRepDropdown(false);
                          }}
                          className="autocomplete-item"
                        >
                          <strong className="mono">{c.cod}</strong> — {c.desc}
                          <span style={{ color: 'var(--slate)', fontSize: 11, marginLeft: 6 }}>
                            · Stock: {c.stock} · ${c.costo}
                          </span>
                        </li>
                      ))}
                    {catalogo.filter(c => {
                      const search = repSearch.toLowerCase();
                      if (!search) return true;
                      return c.cod.toLowerCase().includes(search) || (c.desc || '').toLowerCase().includes(search);
                    }).length === 0 && (
                      <li className="autocomplete-empty">Sin resultados</li>
                    )}
                  </ul>
                )}
              </div>
            </label>
          </div>

          <div className="grid g3" style={{ marginBottom: 14 }}>
            <label className="f">
              <span className="req">Cantidad</span>
              <input
                type="number"
                min="1"
                value={formRep.cant}
                onChange={(e) => setFormRep({ ...formRep, cant: parseInt(e.target.value) || 1 })}
                className="mono"
              />
            </label>
            <label className="f" style={{ gridColumn: 'span 2' }}>
              <span>Justificación</span>
              <input
                value={formRep.motivo}
                onChange={(e) => setFormRep({ ...formRep, motivo: e.target.value })}
                placeholder="Por qué se requiere este repuesto"
              />
            </label>
          </div>

          <button
            onClick={handleCrearRepuesto}
            className="btn dark"
          >
            Agregar solicitud
          </button>
        </div>

        {/* Listado de Repuestos */}
        <div className="card">
          <h2>Solicitudes de la orden</h2>
          {reps.length === 0 ? (
            <div className="empty">Sin solicitudes de repuesto.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Repuesto</th>
                    <th>OT</th>
                    <th className="num">Cant</th>
                    <th className="num">Total</th>
                    <th>Aprobación</th>
                    <th>Entrega</th>
                  </tr>
                </thead>
                <tbody>
                  {reps.map((r) => (
                    <tr key={r.id}>
                      <td><b>{r.desc}</b> <span className="mono" style={{ color: 'var(--slate)' }}>({r.cod})</span></td>
                      <td className="mono">{r.otId}</td>
                      <td className="num mono">{r.cant}</td>
                      <td className="num mono font-bold">${Number(r.costoTotal).toFixed(2)}</td>
                      <td>
                        <span className={`badge ${r.estadoAprobacion === 'Aprobada' ? 'b-ok' : r.estadoAprobacion === 'Rechazada' ? 'b-bad' : 'b-hi'}`}>
                          {r.estadoAprobacion}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${r.estadoEntrega === 'Entregado' ? 'b-ok' : r.estadoEntrega === 'Backorder' ? 'b-bad' : 'b-mute'}`}>
                          {r.estadoEntrega}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* 04 EXTERNOS */}
      <div className={`panel ${activeTab === 'externos' ? 'on' : ''}`}>
        <div className="card">
          <h2>Solicitud de servicio externo</h2>
          <p className="hint">Si el servicio va por garantía, el costo se registra en cero y se conserva la orden de origen.</p>

          <div className="grid g2" style={{ marginBottom: 14 }}>
            <label className="f">
              <span className="req">Orden de área</span>
              <select
                value={formExt.otId}
                onChange={(e) => setFormExt({ ...formExt, otId: e.target.value })}
              >
                {ots.map(o => <option key={o.id} value={o.id}>{o.id} — {o.area}</option>)}
              </select>
            </label>
            <label className="f">
              <span className="req">Proveedor</span>
              <input
                value={formExt.proveedor}
                onChange={(e) => setFormExt({ ...formExt, proveedor: e.target.value })}
                placeholder="Razón social del taller externo"
              />
            </label>
          </div>

          <label className="f" style={{ marginBottom: 14 }}>
            <span className="req">Descripción del servicio</span>
            <input
              value={formExt.descripcion}
              onChange={(e) => setFormExt({ ...formExt, descripcion: e.target.value })}
              placeholder="Ej. Rectificado de discos de freno"
            />
          </label>

          <div className="grid g3" style={{ marginBottom: 14 }}>
            <label className="f">
              <span>¿Va con garantía?</span>
              <select
                value={formExt.conGarantia ? 'si' : 'no'}
                onChange={(e) => setFormExt({ ...formExt, conGarantia: e.target.value === 'si', costo: e.target.value === 'si' ? 0 : formExt.costo })}
              >
                <option value="no">No, se factura</option>
                <option value="si">Sí, cubierto por garantía</option>
              </select>
            </label>
            <label className="f">
              <span>Orden de origen de la garantía</span>
              <input
                value={formExt.ordenOrigen}
                onChange={(e) => setFormExt({ ...formExt, ordenOrigen: e.target.value })}
                disabled={!formExt.conGarantia}
                placeholder="OS-2026-00089"
                className="mono"
              />
            </label>
            <label className="f">
              <span className="req">Costo cotizado</span>
              <input
                type="number"
                value={formExt.costo}
                disabled={formExt.conGarantia}
                onChange={(e) => setFormExt({ ...formExt, costo: parseFloat(e.target.value) || 0 })}
                className="mono"
              />
            </label>
          </div>

          <button
            onClick={handleCrearExterno}
            className="btn dark"
          >
            Agregar solicitud
          </button>
        </div>

        {/* Listado Externos */}
        <div className="card">
          <h2>Servicios externos de la orden</h2>
          {exts.length === 0 ? (
            <div className="empty">Sin servicios externos solicitados.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Servicio</th>
                    <th>OT</th>
                    <th>Garantía</th>
                    <th className="num">Costo</th>
                    <th>Aprobación</th>
                  </tr>
                </thead>
                <tbody>
                  {exts.map((x) => (
                    <tr key={x.id}>
                      <td><b>{x.descripcion}</b> <span style={{ color: 'var(--slate)' }}>({x.proveedor})</span></td>
                      <td className="mono">{x.otId}</td>
                      <td>{x.conGarantia ? <span className="badge b-info">Garantía ({x.ordenOrigenGarantia})</span> : 'No'}</td>
                      <td className="num mono font-bold">${Number(x.costoEfectivo).toFixed(2)}</td>
                      <td>
                        <span className={`badge ${x.estadoAprobacion === 'Aprobada' ? 'b-ok' : x.estadoAprobacion === 'Rechazada' ? 'b-bad' : 'b-hi'}`}>
                          {x.estadoAprobacion}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* 05 APROBACIONES */}
      <div className={`panel ${activeTab === 'aprob' ? 'on' : ''}`}>
        <div className="card">
          <h2>Bandeja del gerente de taller</h2>
          <div className="note n-info" style={{ marginBottom: 16 }}>
            <b>Umbral de escalamiento configurado en $500,00.</b> Por encima de ese monto se requiere una segunda firma del responsable de flota.
          </div>

          <div>
            {[...reps.map(r => ({ ...r, tipo: 'repuesto' as const, nombre: `${r.desc} × ${r.cant}`, monto: r.costoTotal })), ...exts.map(x => ({ ...x, tipo: 'externo' as const, nombre: `${x.descripcion} · ${x.proveedor}`, monto: x.costoEfectivo }))].length === 0 ? (
              <div className="empty">No hay solicitudes que aprobar.</div>
            ) : (
              [...reps.map(r => ({ ...r, tipo: 'repuesto' as const, nombre: `${r.desc} × ${r.cant}`, monto: r.costoTotal })), ...exts.map(x => ({ ...x, tipo: 'externo' as const, nombre: `${x.descripcion} · ${x.proveedor}`, monto: x.costoEfectivo }))].map((item) => {
                const pend = item.estadoAprobacion === 'Pendiente';
                const escala = item.monto > 500;
                return (
                  <div key={item.id} className="card" style={{ background: 'var(--paper)', marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div>
                        <b>{item.nombre}</b>
                        <div style={{ fontSize: 12, color: 'var(--slate)' }}>{item.otId} • {item.tipo === 'repuesto' ? 'Repuesto' : 'Servicio externo'}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div className="mono font-bold" style={{ fontSize: 16 }}>${Number(item.monto).toFixed(2)}</div>
                        <span className={`badge ${item.estadoAprobacion === 'Aprobada' ? 'b-ok' : item.estadoAprobacion === 'Rechazada' ? 'b-bad' : 'b-hi'}`} style={{ marginTop: 4 }}>
                          {item.estadoAprobacion}
                        </span>
                      </div>
                    </div>
                    {item.tipo === 'repuesto' && item.stockActual < item.cant && (
                      <div className="note n-bad" style={{ marginBottom: 8, fontSize: 12 }}>
                        Existencia insuficiente ({item.stockActual} disponibles). Al aprobar se genera requisición de compra en ERP.
                      </div>
                    )}
                    {escala && (
                      <div className="note n-hi" style={{ marginBottom: 8, fontSize: 12 }}>
                        Supera el umbral de $500.00. Requiere además la firma del responsable de flota.
                      </div>
                    )}
                    {pend && (
                      <div className="row-end">
                        <button
                          onClick={() => handleProcesarAprobacion(item.tipo, item.id, 'APROBAR')}
                          className="btn dark"
                        >
                          {escala ? 'Aprobar y escalar' : 'Aprobar'}
                        </button>
                        <button
                          onClick={() => handleProcesarAprobacion(item.tipo, item.id, 'RECHAZAR')}
                          className="btn danger"
                        >
                          Rechazar
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* 06 ALMACÉN */}
      <div className={`panel ${activeTab === 'almacen' ? 'on' : ''}`}>
        <div className="card">
          <h2>Despacho de almacén</h2>
          <div className="note n-hi" style={{ marginBottom: 16 }}>
            Existencias sincronizadas desde Profit Plus hace 4 minutos.
          </div>

          <div>
            {reps.filter(r => r.estadoAprobacion === 'Aprobada').length === 0 ? (
              <div className="empty">No hay repuestos aprobados pendientes de despacho.</div>
            ) : (
              reps.filter(r => r.estadoAprobacion === 'Aprobada').map(r => (
                <div key={r.id} className="card" style={{ background: 'var(--paper)', marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div>
                      <b>{r.desc}</b>
                      <div className="mono" style={{ fontSize: 12, color: 'var(--slate)' }}>{r.cod} • {r.otId}</div>
                    </div>
                    <span className={`badge ${r.estadoEntrega === 'Entregado' ? 'b-ok' : r.estadoEntrega === 'Backorder' ? 'b-bad' : 'b-mute'}`}>
                      {r.estadoEntrega}
                    </span>
                  </div>
                  <div className="grid g3" style={{ background: '#fff', padding: 10, borderRadius: 'var(--r)', marginBottom: 8 }}>
                    <div><span style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--slate)' }}>Solicitado:</span><span className="mono font-bold" style={{ display: 'block' }}>{r.cant}</span></div>
                    <div><span style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--slate)' }}>Existencia:</span><span className="mono" style={{ display: 'block' }}>{r.stockActual}</span></div>
                    <div><span style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--slate)' }}>Almacén:</span><span className="mono" style={{ display: 'block' }}>TLL-01</span></div>
                  </div>
                  {r.estadoEntrega === 'Backorder' && (
                    <div className="note n-bad" style={{ fontSize: 12 }}>
                      Sin existencia. Requisición de compra generada en el ERP.
                    </div>
                  )}
                  {r.estadoEntrega === 'Por entregar' && (
                    <div className="row-end">
                      <button
                        onClick={() => handleConfirmarDespacho(r.id)}
                        className="btn dark"
                      >
                        Confirmar despacho
                      </button>
                    </div>
                  )}
                  {r.estadoEntrega === 'Entregado' && (
                    <div className="note n-ok" style={{ fontSize: 12 }}>
                      Despachado. Movimiento de inventario {r.numMovimientoERP || 'AJS-8821'} conciliado con el ERP.
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 07 CIERRE */}
      <div className={`panel ${activeTab === 'cierre' ? 'on' : ''}`}>
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16, borderBottom: '1px solid var(--line-soft)', paddingBottom: 12 }}>
            <SanLuisLogo variant="light" height={40} subtext="Liquidación Técnica" />
            <div style={{ textAlign: 'right' }}>
              <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)' }}>{ordNo}</span>
              <div style={{ fontSize: 11, color: 'var(--slate)' }}>
                {activeCompany?.name} • RIF: {activeCompany?.taxId}
              </div>
            </div>
          </div>

          <h2>Liquidación Financiera</h2>
          <p className="hint">El costo se imputa a la empresa propietaria de la unidad y a su centro de costo.</p>

          <div style={{ overflowX: 'auto', marginBottom: 16 }}>
            <table>
              <thead>
                <tr>
                  <th>Componente</th>
                  <th className="num">Monto</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>Repuestos aprobados</td><td className="num mono">${totalRepuestos.toFixed(2)}</td></tr>
                <tr><td>Mano de obra ({ots.reduce((a, b) => a + b.horas, 0)} hrs)</td><td className="num mono">${totalManoObra.toFixed(2)}</td></tr>
                <tr><td>Servicios externos</td><td className="num mono">${totalExternos.toFixed(2)}</td></tr>
                {serviciosGarantia > 0 && (
                  <tr><td style={{ color: 'var(--info)' }}>Servicios cubiertos por garantía</td><td className="num font-bold" style={{ color: 'var(--info)' }}>{serviciosGarantia} sin costo</td></tr>
                )}
                <tr style={{ background: 'var(--paper)', fontWeight: 'bold' }}>
                  <td>Total imputado a {unidad?.empresa || 'Empresa'} • CC {unidad?.cc || 'N/A'}</td>
                  <td className="num mono" style={{ color: 'var(--navy)', fontSize: 16 }}>${totalGeneral.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h2>Validaciones de cierre</h2>
          <p className="hint">La orden principal no puede cerrarse mientras exista un punto pendiente.</p>

          <div style={{ marginBottom: 16 }}>
            {validaciones.length > 0 ? (
              validaciones.map((v, i) => (
                <div key={i} className="note n-bad" style={{ marginBottom: 6 }}>
                  {v}
                </div>
              ))
            ) : (
              <div className="note n-ok" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle className="w-4 h-4 text-[var(--ok)]" /> Todas las validaciones están conformes. La orden puede cerrarse.
              </div>
            )}
          </div>

          <div className="grid g2" style={{ marginBottom: 16 }}>
            <label className="f">
              <span>Fecha y hora de entrega</span>
              <input
                type="datetime-local"
                value={fEntrega}
                onChange={(e) => setFEntrega(e.target.value)}
                className="mono"
              />
            </label>
            <label className="f">
              <span className="req">Recibe conforme</span>
              <input
                value={recibeConforme}
                onChange={(e) => setRecibeConforme(e.target.value)}
                placeholder="Nombre de quien retira la unidad"
              />
            </label>
          </div>

          <button
            onClick={handleCerrarOrden}
            disabled={!puedeCerrar || estadoOrden === 'Cerrada'}
            className="btn amber"
            style={{ width: '100%', fontSize: 16 }}
          >
            {estadoOrden === 'Cerrada' ? 'Orden de Servicio Cerrada' : 'Cerrar orden de servicio'}
          </button>
        </div>
      </div>

      {/* 08 AUDITORÍA Y TRAZABILIDAD */}
      <div className={`panel ${activeTab === 'auditoria' ? 'on' : ''}`}>
        <OrdenAuditHistory
          ordenId={ordNo}
          token={token}
          activeCompany={activeCompany}
          subOts={ots.map(o => ({ id: o.id, area: o.area }))}
        />
      </div>

      {/* Floating Bottom Action Gate */}
      <div className={`gate ${puedeCerrar ? 'clear' : ''}`}>
        <div className="gate-in">
          <div className="gate-list">
            <b>{puedeCerrar ? 'Listo para cerrar' : 'Cierre bloqueado'}</b>
            <span>{puedeCerrar ? 'Sin pendientes en ninguna orden de área.' : validaciones[0]}</span>
          </div>
          <div className="tot">
            <small>Costo acumulado</small>
            ${totalGeneral.toFixed(2)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TallerModule;
