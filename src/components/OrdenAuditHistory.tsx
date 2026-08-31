import React, { useState, useEffect } from 'react';
import {
  History,
  User,
  Shield,
  Clock,
  Filter,
  Search,
  Download,
  FileText,
  CheckCircle2,
  AlertCircle,
  Wrench,
  Package,
  Layers,
  ArrowRight,
  RefreshCw,
  PlusCircle,
  Send,
  Eye,
  Calendar,
  Building,
  Tag,
  Check,
  AlertTriangle,
} from 'lucide-react';

export interface AuditRecord {
  id: number;
  ordenId: string;
  otId?: string | null;
  userId?: number | null;
  userName: string;
  userEmail: string;
  userRole: string;
  action: string;
  fieldName?: string | null;
  previousValue?: string | null;
  newValue?: string | null;
  description: string;
  ipAddress?: string | null;
  createdAt: string;
}

interface OrdenAuditHistoryProps {
  ordenId: string;
  token: string;
  activeCompany: any;
  subOts?: Array<{ id: string; area: string }>;
}

export const OrdenAuditHistory: React.FC<OrdenAuditHistoryProps> = ({
  ordenId,
  token,
  activeCompany,
  subOts = [],
}) => {
  const [logs, setLogs] = useState<AuditRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [actionFilter, setActionFilter] = useState<string>('ALL');
  const [otFilter, setOtFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [viewMode, setViewMode] = useState<'timeline' | 'table'>('timeline');

  // Formulario de Nota u Observación de Auditoría
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [noteContent, setNoteContent] = useState('');
  const [noteOtId, setNoteOtId] = useState('');
  const [noteCategory, setNoteCategory] = useState('Inspección de Calidad');
  const [submittingNote, setSubmittingNote] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const fetchAuditLogs = async () => {
    if (!ordenId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/ordenes/${ordenId}/auditoria`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(activeCompany?.id ? { 'x-tenant-id': activeCompany.id } : {}),
        },
      });
      const data = await res.json();
      if (data.success) {
        setLogs(data.data || []);
      } else {
        setError(data.error || 'Error al cargar la bitácora de auditoría.');
      }
    } catch (err: any) {
      setError(err.message || 'Error de conexión con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, [ordenId, activeCompany?.id]);

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteContent.trim()) {
      setToastMsg({ type: 'err', text: 'Debe ingresar el detalle de la observación técnica.' });
      return;
    }

    setSubmittingNote(true);
    try {
      const res = await fetch(`/api/v1/ordenes/${ordenId}/auditoria/nota`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(activeCompany?.id ? { 'x-tenant-id': activeCompany.id } : {}),
        },
        body: JSON.stringify({
          nota: noteContent.trim(),
          otId: noteOtId || null,
          categoria: noteCategory,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setToastMsg({ type: 'ok', text: 'Observación de auditoría registrada correctamente.' });
        setNoteContent('');
        setShowNoteForm(false);
        fetchAuditLogs();
      } else {
        setToastMsg({ type: 'err', text: data.error || 'Error al registrar la observación.' });
      }
    } catch (err: any) {
      setToastMsg({ type: 'err', text: err.message || 'Error de red.' });
    } finally {
      setSubmittingNote(false);
      setTimeout(() => setToastMsg(null), 4000);
    }
  };

  const exportToCSV = () => {
    if (!logs.length) return;
    const headers = ['ID', 'Fecha y Hora', 'Usuario', 'Email', 'Rol', 'Accion', 'Sub-OT', 'Campo Modificado', 'Valor Anterior', 'Valor Nuevo', 'Descripcion'];
    const rows = logs.map(l => [
      l.id,
      new Date(l.createdAt).toLocaleString('es-VE'),
      `"${l.userName || ''}"`,
      `"${l.userEmail || ''}"`,
      `"${l.userRole || ''}"`,
      `"${l.action || ''}"`,
      `"${l.otId || 'General'}"`,
      `"${l.fieldName || ''}"`,
      `"${(l.previousValue || '').replace(/"/g, '""')}"`,
      `"${(l.newValue || '').replace(/"/g, '""')}"`,
      `"${(l.description || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Auditoria_${ordenId}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToJSON = () => {
    if (!logs.length) return;
    const jsonStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(logs, null, 2));
    const link = document.createElement('a');
    link.setAttribute('href', jsonStr);
    link.setAttribute('download', `Auditoria_${ordenId}_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtrado
  const filteredLogs = logs.filter(log => {
    // Filtro por acción
    if (actionFilter !== 'ALL') {
      if (actionFilter === 'APERTURA_CIERRE' && !['APERTURA_ORDEN', 'CIERRE_ORDEN'].includes(log.action)) return false;
      if (actionFilter === 'OT' && !['CREACION_OT', 'ACTUALIZACION_OT', 'CIERRE_OT', 'ELIMINACION_OT'].includes(log.action)) return false;
      if (actionFilter === 'REPUESTOS' && !['SOLICITUD_REPUESTO', 'APROBACION_REPUESTO', 'RECHAZO_REPUESTO', 'DESPACHO_REPUESTO', 'ANULACION_REPUESTO'].includes(log.action)) return false;
      if (actionFilter === 'EXTERNOS' && !['SOLICITUD_EXTERNO', 'APROBACION_EXTERNO', 'RECHAZO_EXTERNO', 'ANULACION_EXTERNO'].includes(log.action)) return false;
      if (actionFilter === 'EDICION' && log.action !== 'MODIFICACION_CAMPO') return false;
      if (actionFilter === 'NOTAS' && log.action !== 'OBSERVACION_TECNICA') return false;
      if (actionFilter === 'MULTIMEDIA' && log.action !== 'SUBIDA_MULTIMEDIA') return false;
    }

    // Filtro por Sub-OT
    if (otFilter !== 'ALL') {
      if (otFilter === 'GENERAL' && log.otId) return false;
      if (otFilter !== 'GENERAL' && log.otId !== otFilter) return false;
    }

    // Búsqueda de texto
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const matchDesc = log.description?.toLowerCase().includes(term);
      const matchUser = log.userName?.toLowerCase().includes(term) || log.userEmail?.toLowerCase().includes(term);
      const matchField = log.fieldName?.toLowerCase().includes(term);
      const matchAction = log.action?.toLowerCase().includes(term);
      const matchPrev = log.previousValue?.toLowerCase().includes(term);
      const matchNew = log.newValue?.toLowerCase().includes(term);
      if (!matchDesc && !matchUser && !matchField && !matchAction && !matchPrev && !matchNew) {
        return false;
      }
    }

    return true;
  });

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'APERTURA_ORDEN':
        return { label: 'Apertura de Orden', bg: '#e0f2fe', color: '#0369a1', border: '#bae6fd', icon: History };
      case 'CIERRE_ORDEN':
        return { label: 'Cierre y Liquidación', bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0', icon: CheckCircle2 };
      case 'CREACION_OT':
        return { label: 'Nueva Orden de Área', bg: '#fef3c7', color: '#b45309', border: '#fde68a', icon: Wrench };
      case 'ACTUALIZACION_OT':
      case 'CIERRE_OT':
        return { label: 'Actualización OT', bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe', icon: Wrench };
      case 'ELIMINACION_OT':
        return { label: 'Anulación de OT', bg: '#fef2f2', color: '#b91c1c', border: '#fecaca', icon: AlertCircle };
      case 'SOLICITUD_REPUESTO':
        return { label: 'Solicitud Repuesto', bg: '#fdf4ff', color: '#86198f', border: '#f5d0fe', icon: Package };
      case 'APROBACION_REPUESTO':
      case 'APROBACION_EXTERNO':
        return { label: 'Aprobación Gerencia', bg: '#ecfdf5', color: '#047857', border: '#a7f3d0', icon: Shield };
      case 'RECHAZO_REPUESTO':
      case 'RECHAZO_EXTERNO':
        return { label: 'Rechazo Solicitud', bg: '#fff1f2', color: '#be123c', border: '#fecdd3', icon: AlertCircle };
      case 'DESPACHO_REPUESTO':
        return { label: 'Despacho Almacén', bg: '#f0fdf4', color: '#166534', border: '#86efac', icon: Package };
      case 'ANULACION_REPUESTO':
      case 'ANULACION_EXTERNO':
        return { label: 'Anulación Requerimiento', bg: '#fef2f2', color: '#991b1b', border: '#fee2e2', icon: AlertCircle };
      case 'SOLICITUD_EXTERNO':
        return { label: 'Servicio Externo', bg: '#fff7ed', color: '#c2410c', border: '#ffedd5', icon: Layers };
      case 'SUBIDA_MULTIMEDIA':
        return { label: 'Archivo / Foto', bg: '#f8fafc', color: '#475569', border: '#e2e8f0', icon: FileText };
      case 'MODIFICACION_CAMPO':
        return { label: 'Modificación Campo', bg: '#fffbeb', color: '#92400e', border: '#fef3c7', icon: Tag };
      case 'OBSERVACION_TECNICA':
        return { label: 'Nota / Observación', bg: '#f5f3ff', color: '#6d28d9', border: '#ddd6fe', icon: FileText };
      default:
        return { label: action, bg: '#f1f5f9', color: '#334155', border: '#cbd5e1', icon: History };
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role?.toLowerCase()) {
      case 'superadmin':
      case 'admin':
        return { bg: '#fee2e2', text: '#991b1b' };
      case 'gerente_taller':
      case 'gerente':
        return { bg: '#e0e7ff', text: '#3730a3' };
      case 'almacenista':
      case 'almacen':
        return { bg: '#fef3c7', text: '#92400e' };
      case 'mecanico':
        return { bg: '#dcfce7', text: '#166534' };
      default:
        return { bg: '#f1f5f9', text: '#475569' };
    }
  };

  // Resumen estadístico
  const uniqueUsers = Array.from(new Set(logs.map(l => l.userName || l.userEmail))).filter(Boolean);
  const totalModificaciones = logs.filter(l => l.action === 'MODIFICACION_CAMPO').length;
  const lastLog = logs[0];

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMsg && (
        <div
          className={`p-3 rounded-lg border flex items-center gap-2 text-sm font-medium transition-all ${
            toastMsg.type === 'ok'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-red-50 text-red-800 border-red-200'
          }`}
        >
          {toastMsg.type === 'ok' ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <AlertCircle className="w-5 h-5 text-red-600" />}
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* Header y Resumen de Auditoría */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-indigo-50 text-indigo-700 rounded-lg">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800">
                  Historial de Auditoría y Trazabilidad Operativa
                </h2>
                <p className="text-xs text-slate-500">
                  Registro inmutable de todas las acciones, modificaciones de campos y usuarios para la orden <span className="font-semibold text-slate-700">{ordenId}</span>
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setShowNoteForm(!showNoteForm)}
              className="px-3 py-2 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Registrar Nota Técnica</span>
            </button>

            <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
              <button
                type="button"
                onClick={() => setViewMode('timeline')}
                className={`px-3 py-2 text-xs font-medium flex items-center gap-1.5 transition-colors ${
                  viewMode === 'timeline' ? 'bg-white text-indigo-600 shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>Línea de Tiempo</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`px-3 py-2 text-xs font-medium flex items-center gap-1.5 transition-colors ${
                  viewMode === 'table' ? 'bg-white text-indigo-600 shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Matriz Detallada</span>
              </button>
            </div>

            <button
              type="button"
              onClick={fetchAuditLogs}
              disabled={loading}
              title="Refrescar bitácora"
              className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
            </button>

            <div className="relative group">
              <button
                type="button"
                className="px-3 py-2 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg flex items-center gap-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>Exportar</span>
              </button>
              <div className="absolute right-0 top-full mt-1 w-36 bg-white border border-slate-200 rounded-lg shadow-lg py-1 hidden group-hover:block z-20">
                <button
                  type="button"
                  onClick={exportToCSV}
                  className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                >
                  <FileText className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Descargar CSV</span>
                </button>
                <button
                  type="button"
                  onClick={exportToJSON}
                  className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                >
                  <Tag className="w-3.5 h-3.5 text-blue-600" />
                  <span>Descargar JSON</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Tarjetas KPI de Auditoría */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Total Eventos</span>
            <div className="text-xl font-bold text-slate-800 mt-0.5">{logs.length}</div>
            <span className="text-[11px] text-slate-500">acciones registradas</span>
          </div>

          <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Usuarios Involucrados</span>
            <div className="text-xl font-bold text-indigo-700 mt-0.5">{uniqueUsers.length}</div>
            <span className="text-[11px] text-slate-500 truncate block">
              {uniqueUsers.slice(0, 2).join(', ')}{uniqueUsers.length > 2 ? '...' : ''}
            </span>
          </div>

          <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Edición de Campos</span>
            <div className="text-xl font-bold text-amber-700 mt-0.5">{totalModificaciones}</div>
            <span className="text-[11px] text-slate-500">cambios de parámetros</span>
          </div>

          <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Última Actividad</span>
            <div className="text-xs font-semibold text-slate-800 mt-1 truncate">
              {lastLog ? new Date(lastLog.createdAt).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
            </div>
            <span className="text-[11px] text-slate-500 truncate block">
              {lastLog?.userName || 'Sin registros'}
            </span>
          </div>
        </div>
      </div>

      {/* Formulario Desplegable para Agregar Observación / Nota Técnica */}
      {showNoteForm && (
        <form onSubmit={handleAddNote} className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PlusCircle className="w-5 h-5 text-indigo-700" />
              <h3 className="text-sm font-bold text-indigo-900">
                Registrar Nota u Observación de Auditoría Técnica
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setShowNoteForm(false)}
              className="text-xs text-slate-400 hover:text-slate-700"
            >
              Cancelar
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Sub-OT / Área Asociada (Opcional)
              </label>
              <select
                value={noteOtId}
                onChange={(e) => setNoteOtId(e.target.value)}
                className="w-full text-xs rounded-lg border border-slate-300 bg-white px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="">Orden General ({ordenId})</option>
                {subOts.map((ot) => (
                  <option key={ot.id} value={ot.id}>
                    {ot.id} - {ot.area}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Categoría de Observación
              </label>
              <select
                value={noteCategory}
                onChange={(e) => setNoteCategory(e.target.value)}
                className="w-full text-xs rounded-lg border border-slate-300 bg-white px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="Inspección de Calidad">Inspección de Calidad</option>
                <option value="Diagnóstico Complementario">Diagnóstico Complementario</option>
                <option value="Autorización Especial">Autorización Especial</option>
                <option value="Prueba de Ruta / Validación">Prueba de Ruta / Validación</option>
                <option value="Observación de Recepción / Entrega">Observación de Recepción / Entrega</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Detalle de la Observación o Justificación Técnica <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder="Escriba los hallazgos técnicos, acuerdos con el conductor o aprobaciones extraordinarias..."
              className="w-full text-xs rounded-lg border border-slate-300 bg-white p-3 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              required
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowNoteForm(false)}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submittingNote}
              className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 shadow-sm transition-colors"
            >
              {submittingNote ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span>Guardar en Bitácora</span>
            </button>
          </div>
        </form>
      )}

      {/* Barra de Filtros y Búsqueda */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {/* Búsqueda de texto */}
          <div className="relative sm:col-span-2">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por usuario, campo modificado, descripción..."
              className="w-full text-xs pl-9 pr-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-slate-50/50"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filtro por Acción */}
          <div>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="w-full text-xs py-2 px-3 rounded-lg border border-slate-200 bg-slate-50/50 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="ALL">Todas las acciones</option>
              <option value="APERTURA_CIERRE">Apertura y Cierre</option>
              <option value="OT">Órdenes de Área (OTs)</option>
              <option value="REPUESTOS">Repuestos y Almacén</option>
              <option value="EXTERNOS">Servicios Externos</option>
              <option value="EDICION">Modificaciones de Campos</option>
              <option value="NOTAS">Notas Técnicas</option>
              <option value="MULTIMEDIA">Fotos / Multimedia</option>
            </select>
          </div>

          {/* Filtro por Sub-OT */}
          <div>
            <select
              value={otFilter}
              onChange={(e) => setOtFilter(e.target.value)}
              className="w-full text-xs py-2 px-3 rounded-lg border border-slate-200 bg-slate-50/50 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="ALL">Todas las OTs</option>
              <option value="GENERAL">Solo Orden General</option>
              {subOts.map((ot) => (
                <option key={ot.id} value={ot.id}>
                  {ot.id} ({ot.area})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500">
          <span>
            Mostrando <span className="font-semibold text-slate-700">{filteredLogs.length}</span> de <span className="font-semibold text-slate-700">{logs.length}</span> registros de auditoría
          </span>
          {(actionFilter !== 'ALL' || otFilter !== 'ALL' || searchTerm) && (
            <button
              type="button"
              onClick={() => {
                setActionFilter('ALL');
                setOtFilter('ALL');
                setSearchTerm('');
              }}
              className="text-indigo-600 hover:text-indigo-800 font-semibold"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {/* Contenido: Línea de Tiempo o Tabla */}
      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-sm">
          <RefreshCw className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-700">Cargando bitácora de auditoría...</p>
          <p className="text-xs text-slate-400 mt-1">Consultando registros históricos en base de datos</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 rounded-xl border border-red-200 p-6 text-center shadow-sm">
          <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
          <p className="text-sm font-semibold text-red-800">{error}</p>
          <button
            type="button"
            onClick={fetchAuditLogs}
            className="mt-3 px-3 py-1.5 text-xs font-semibold rounded bg-red-600 text-white hover:bg-red-700 transition-colors"
          >
            Reintentar
          </button>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-sm">
          <Shield className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-base font-bold text-slate-700">No se encontraron registros de auditoría</p>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            {searchTerm || actionFilter !== 'ALL' || otFilter !== 'ALL'
              ? 'No hay eventos que coincidan con los filtros seleccionados. Intente restablecer los criterios de búsqueda.'
              : 'Aún no se han generado registros adicionales para esta orden de servicio.'}
          </p>
        </div>
      ) : viewMode === 'timeline' ? (
        /* VISTA LÍNEA DE TIEMPO (TIMELINE) */
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="relative pl-6 sm:pl-8 space-y-6 before:absolute before:left-3 sm:before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
            {filteredLogs.map((log) => {
              const badge = getActionBadge(log.action);
              const roleColor = getRoleBadgeColor(log.userRole);
              const dateObj = new Date(log.createdAt);
              const formattedDate = dateObj.toLocaleDateString('es-VE', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              });
              const formattedTime = dateObj.toLocaleTimeString('es-VE', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              });

              return (
                <div key={log.id} className="relative group">
                  {/* Icon Node on timeline */}
                  <div
                    className="absolute -left-[27px] sm:-left-[35px] top-1.5 w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center border-2 border-white shadow-sm"
                    style={{ backgroundColor: badge.color }}
                  >
                    <badge.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                  </div>

                  {/* Card Event */}
                  <div className="bg-slate-50/70 hover:bg-slate-50 border border-slate-200/80 rounded-xl p-4 transition-all hover:border-slate-300 hover:shadow-sm">
                    {/* Header info */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-200/60">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Action Badge */}
                        <span
                          className="text-[11px] font-bold px-2.5 py-1 rounded-md border flex items-center gap-1.5 shadow-2xs"
                          style={{
                            backgroundColor: badge.bg,
                            color: badge.color,
                            borderColor: badge.border,
                          }}
                        >
                          <badge.icon className="w-3 h-3" />
                          {badge.label}
                        </span>

                        {/* OT Sub-badge */}
                        {log.otId ? (
                          <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200">
                            {log.otId}
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium font-mono px-2 py-0.5 rounded bg-slate-200/80 text-slate-700">
                            General
                          </span>
                        )}

                        {/* Campo modificado */}
                        {log.fieldName && (
                          <span className="text-[11px] font-mono text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                            campo: <span className="font-semibold text-slate-700">{log.fieldName}</span>
                          </span>
                        )}
                      </div>

                      {/* Timestamp */}
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>{formattedDate} {formattedTime}</span>
                      </div>
                    </div>

                    {/* Description / Narrative */}
                    <div className="py-2.5 text-xs text-slate-800 leading-relaxed font-normal">
                      {log.description}
                    </div>

                    {/* Diff Viewer if field modification */}
                    {(log.previousValue || log.newValue) && (
                      <div className="my-2 p-2.5 rounded-lg bg-white border border-slate-200 text-xs font-mono grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="p-2 rounded bg-rose-50/60 border border-rose-100 text-rose-900">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 block mb-0.5">
                            Valor Anterior:
                          </span>
                          <div className="break-all whitespace-pre-wrap">{log.previousValue || '(vacío)'}</div>
                        </div>

                        <div className="p-2 rounded bg-emerald-50/60 border border-emerald-100 text-emerald-900">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 block mb-0.5">
                            Nuevo Valor:
                          </span>
                          <div className="break-all whitespace-pre-wrap">{log.newValue || '(vacío)'}</div>
                        </div>
                      </div>
                    )}

                    {/* Footer / User & IP Stamp */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pt-2 border-t border-slate-200/50 text-[11px] text-slate-500">
                      <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-semibold text-slate-700">{log.userName || 'Sistema'}</span>
                        <span className="text-slate-400">({log.userEmail})</span>
                        <span
                          className="px-1.5 py-0.2 rounded text-[10px] font-semibold uppercase tracking-wider"
                          style={{ backgroundColor: roleColor.bg, color: roleColor.text }}
                        >
                          {log.userRole}
                        </span>
                      </div>

                      {log.ipAddress && (
                        <span className="font-mono text-[10px] text-slate-400">
                          IP: {log.ipAddress}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* VISTA TABLA / MATRIZ COMPLETA */
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-3">Fecha / Hora</th>
                  <th className="py-3 px-3">Usuario & Rol</th>
                  <th className="py-3 px-3">Acción</th>
                  <th className="py-3 px-3">Sub-OT</th>
                  <th className="py-3 px-3">Campo</th>
                  <th className="py-3 px-4">Descripción / Valores Modificados</th>
                  <th className="py-3 px-3 text-right">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {filteredLogs.map((log) => {
                  const badge = getActionBadge(log.action);
                  const roleColor = getRoleBadgeColor(log.userRole);
                  const dateObj = new Date(log.createdAt);

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[11px] text-slate-500">
                        {dateObj.toLocaleDateString('es-VE', { month: '2-digit', day: '2-digit' })}{' '}
                        {dateObj.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-800">{log.userName}</div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span
                            className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase"
                            style={{ backgroundColor: roleColor.bg, color: roleColor.text }}
                          >
                            {log.userRole}
                          </span>
                          <span className="text-[10px] text-slate-400 truncate max-w-[120px]">{log.userEmail}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded border inline-flex items-center gap-1"
                          style={{
                            backgroundColor: badge.bg,
                            color: badge.color,
                            borderColor: badge.border,
                          }}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[11px]">
                        {log.otId ? (
                          <span className="font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                            {log.otId}
                          </span>
                        ) : (
                          <span className="text-slate-400">General</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[11px] text-slate-600">
                        {log.fieldName || '--'}
                      </td>
                      <td className="py-2.5 px-4 min-w-[280px]">
                        <div className="text-slate-800 leading-snug">{log.description}</div>
                        {(log.previousValue || log.newValue) && (
                          <div className="mt-1 font-mono text-[10px] flex items-center gap-1.5 text-slate-500">
                            <span className="line-through text-red-600 bg-red-50 px-1 rounded">{log.previousValue || 'null'}</span>
                            <ArrowRight className="w-3 h-3 text-slate-400" />
                            <span className="font-bold text-emerald-700 bg-emerald-50 px-1 rounded">{log.newValue}</span>
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-[10px] text-slate-400 whitespace-nowrap">
                        {log.ipAddress || '--'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrdenAuditHistory;
