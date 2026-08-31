import React, { useState, useEffect } from 'react';
import {
  Wifi,
  WifiOff,
  RefreshCw,
  Database,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ChevronDown,
  X,
  RotateCcw,
  Sliders,
  Radio,
  Server,
  Zap,
} from 'lucide-react';

interface SyncStatusData {
  isOnline: boolean;
  mode: 'ONLINE' | 'OFFLINE_AUTONOMOUS';
  isSimulatedOffline: boolean;
  pendingCount: number;
  syncedCount: number;
  failedCount: number;
  lastSyncAt: string | null;
  lastCheckAt: string | null;
  latencyMs: number;
  server: string;
  database: string;
  dialect: string;
  fallback: boolean;
  isSyncRunning: boolean;
}

interface SyncQueueItem {
  id: string;
  entityType: string;
  entityId: string;
  operation: string;
  payload: string;
  status: 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED';
  retryCount: number;
  maxRetries: number;
  lastError: string | null;
  createdAt: string;
  syncedAt: string | null;
}

interface SyncStatusBadgeProps {
  token: string;
}

export default function SyncStatusBadge({ token }: SyncStatusBadgeProps) {
  const [status, setStatus] = useState<SyncStatusData | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [queueItems, setQueueItems] = useState<SyncQueueItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<SyncQueueItem | null>(null);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/v1/sync/status');
      const data = await res.json();
      if (data.success) {
        setStatus(data.data);
      }
    } catch (err) {
      console.warn('Error obteniendo estado de sincronización:', err);
    }
  };

  const fetchQueue = async () => {
    if (!token) return;
    setLoadingQueue(true);
    try {
      const res = await fetch('/api/v1/sync/queue?limit=30', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setQueueItems(data.data || []);
      }
    } catch (err) {
      console.warn('Error obteniendo cola de sincronización:', err);
    } finally {
      setLoadingQueue(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    // Sondeo de estado cada 5 segundos
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isModalOpen) {
      fetchQueue();
    }
  }, [isModalOpen]);

  const handleManualSync = async () => {
    if (!token || isSyncing) return;
    setIsSyncing(true);
    try {
      const res = await fetch('/api/v1/sync/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ forced: true }),
      });
      const data = await res.json();
      if (data.success) {
        setToastMessage(`Sincronización exitosa: ${data.data?.outboundSynced || 0} enviadas, ${data.data?.inboundSynced || 0} recibidas.`);
        fetchStatus();
        if (isModalOpen) fetchQueue();
      } else {
        setToastMessage(`Aviso: ${data.data?.message || data.error || 'No se pudo sincronizar con MSSQL.'}`);
      }
    } catch (err: any) {
      setToastMessage(`Error: ${err.message}`);
    } finally {
      setIsSyncing(false);
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  const handleToggleOffline = async () => {
    if (!token) return;
    const targetState = !status?.isSimulatedOffline;
    try {
      const res = await fetch('/api/v1/sync/toggle-offline', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ simulate: targetState }),
      });
      const data = await res.json();
      if (data.success) {
        setStatus(data.data);
        setToastMessage(targetState ? '🟠 Modo Autónomo (Offline-First) Activado' : '🟢 Enlace con MSSQL Restablecido');
        if (isModalOpen) fetchQueue();
      }
    } catch (err: any) {
      setToastMessage(`Error: ${err.message}`);
    } finally {
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  const handleRetryFailed = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/v1/sync/retry-failed', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setToastMessage(data.message || 'Operaciones re-encoladas');
        fetchStatus();
        fetchQueue();
      }
    } catch (err: any) {
      setToastMessage(`Error: ${err.message}`);
    } finally {
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  const isOnline = status?.isOnline ?? true;
  const pendingCount = status?.pendingCount ?? 0;

  return (
    <>
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed bottom-4 right-4 z-50 bg-[#002244] text-white px-4 py-3 rounded-lg shadow-2xl border border-[var(--lime)]/50 flex items-center gap-3 animate-fade-in text-xs">
          <Zap className="w-4 h-4 text-[var(--lime)] shrink-0" />
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="text-slate-400 hover:text-white ml-2">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Badge en Barra Superior */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setIsModalOpen(true)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-[var(--r)] border text-xs transition-all cursor-pointer ${
            isOnline
              ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/50'
              : 'bg-amber-950/50 border-amber-500/50 text-amber-300 hover:bg-amber-900/60'
          }`}
          title="Ver estado de sincronización bidireccional con MSSQL Server"
        >
          <span className="relative flex h-2 w-2">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isOnline ? 'bg-emerald-400' : 'bg-amber-400'
              }`}
            />
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                isOnline ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
            />
          </span>

          <div className="text-left leading-tight hidden sm:block">
            <div className="flex items-center gap-1 font-semibold text-[11px]">
              {isOnline ? (
                <>
                  <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                  <span>MSSQL En Línea</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-amber-400" />
                  <span>Modo Local Autónomo</span>
                </>
              )}
            </div>
            <span className="text-[9px] opacity-80 block">
              {pendingCount > 0 ? `${pendingCount} pendientes` : 'Sincronizado'}
            </span>
          </div>

          {pendingCount > 0 && (
            <span className="bg-amber-500 text-slate-950 font-bold px-1.5 py-0.5 rounded-full text-[10px]">
              {pendingCount}
            </span>
          )}

          <ChevronDown className="w-3.5 h-3.5 opacity-60 ml-0.5" />
        </button>

        {/* Botón rápido de sincronización */}
        <button
          onClick={handleManualSync}
          disabled={isSyncing}
          className={`p-2 rounded-[var(--r)] border border-white/20 bg-white/10 text-white hover:bg-white/20 transition-all cursor-pointer disabled:opacity-50`}
          title="Ejecutar sincronización bidireccional inmediata"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-[var(--lime)]' : 'text-slate-200'}`} />
        </button>
      </div>

      {/* Modal Detallado de Sincronización Bidireccional */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-[var(--line)] w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] animate-fade-in">
            {/* Header Modal */}
            <div className="bg-[var(--navy)] text-white px-6 py-4 flex items-center justify-between border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-lg">
                  <Database className="w-5 h-5 text-[var(--lime)]" />
                </div>
                <div>
                  <h3 className="font-bold text-base leading-tight">Centro de Sincronización Offline-First</h3>
                  <p className="text-xs text-slate-300">
                    Sincronización bidireccional local &bull; Microsoft SQL Server (AD_TRANS)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Panel de Estado y Controles */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-800">
              {/* Tarjetas de Indicadores */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div
                  className={`p-4 rounded-xl border ${
                    isOnline ? 'bg-emerald-50/70 border-emerald-200' : 'bg-amber-50/70 border-amber-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold uppercase text-slate-600">Estado Enlace</span>
                    {isOnline ? (
                      <Wifi className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <WifiOff className="w-4 h-4 text-amber-600" />
                    )}
                  </div>
                  <div className="text-base font-bold text-slate-900">
                    {isOnline ? 'Conectado (MSSQL)' : 'Modo Autónomo Local'}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                    <Server className="w-3 h-3" />
                    <span>{status?.server || 'SRVBDPROFITBK'} &bull; {status?.database || 'AD_TRANS'}</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold uppercase text-slate-600">Cola Local</span>
                    <Clock className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="text-2xl font-bold text-slate-900">
                    {status?.pendingCount || 0}
                    <span className="text-xs font-normal text-slate-500 ml-1">pendientes</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    {status?.syncedCount || 0} enviadas &bull; {status?.failedCount || 0} con error
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold uppercase text-slate-600">Última Sincronización</span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="text-sm font-semibold text-slate-900 truncate">
                    {status?.lastSyncAt ? new Date(status.lastSyncAt).toLocaleTimeString() : 'Pendiente'}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    Latencia: {status?.latencyMs || 0} ms &bull; Verificación auto: 15s
                  </div>
                </div>
              </div>

              {/* Barra de Acciones y Simulación Offline */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-100/70 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleManualSync}
                    disabled={isSyncing}
                    className="flex items-center gap-2 px-4 py-2 bg-[var(--navy)] text-white text-xs font-semibold rounded-lg hover:bg-[#002244] transition-all cursor-pointer disabled:opacity-50 shadow-xs"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                    <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar Ahora'}</span>
                  </button>

                  {status?.failedCount ? (
                    <button
                      onClick={handleRetryFailed}
                      className="flex items-center gap-1.5 px-3 py-2 bg-amber-600 text-white text-xs font-semibold rounded-lg hover:bg-amber-700 transition-all cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reintentar Fallidos ({status.failedCount})</span>
                    </button>
                  ) : null}
                </div>

                {/* Switch de Simulación de Desconexión */}
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium text-slate-600">Simulación de Red:</span>
                  <button
                    onClick={handleToggleOffline}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                      status?.isSimulatedOffline
                        ? 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <Radio className={`w-3.5 h-3.5 ${status?.isSimulatedOffline ? 'text-amber-600 animate-pulse' : 'text-slate-400'}`} />
                    <span>{status?.isSimulatedOffline ? 'Restablecer Conexión' : 'Simular Corte de Red (Offline)'}</span>
                  </button>
                </div>
              </div>

              {/* Registro de Operaciones en Cola (Sync Ledger) */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                    <span>Libro de Operaciones Locales y Sincronización</span>
                    <span className="text-xs font-normal text-slate-500">({queueItems.length} registros)</span>
                  </h4>
                  <button
                    onClick={fetchQueue}
                    disabled={loadingQueue}
                    className="text-xs text-[var(--navy)] hover:underline font-semibold cursor-pointer"
                  >
                    Actualizar Lista
                  </button>
                </div>

                {queueItems.length === 0 ? (
                  <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-slate-500 text-xs">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                    No hay operaciones en cola. Todas las acciones se encuentran sincronizadas con MSSQL.
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                    <div className="max-h-60 overflow-y-auto divide-y divide-slate-200 text-xs">
                      {queueItems.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => setSelectedItem(item)}
                          className="p-3 hover:bg-slate-50 flex items-center justify-between gap-3 cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                item.status === 'SYNCED'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : item.status === 'PENDING'
                                  ? 'bg-amber-100 text-amber-800'
                                  : item.status === 'SYNCING'
                                  ? 'bg-blue-100 text-blue-800 animate-pulse'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {item.status}
                            </span>
                            <div>
                              <div className="font-semibold text-slate-900">
                                [{item.operation}] {item.entityType} &bull; <span className="font-mono">{item.entityId}</span>
                              </div>
                              <div className="text-[11px] text-slate-500">
                                Creado: {new Date(item.createdAt).toLocaleString()} &bull; Reintentos: {item.retryCount}/{item.maxRetries}
                              </div>
                            </div>
                          </div>

                          <div className="text-right text-[11px] text-slate-500">
                            {item.syncedAt ? (
                              <span className="text-emerald-700 font-medium">Sincronizado: {new Date(item.syncedAt).toLocaleTimeString()}</span>
                            ) : item.lastError ? (
                              <span className="text-rose-600 truncate max-w-[200px] block" title={item.lastError}>
                                {item.lastError}
                              </span>
                            ) : (
                              <span className="text-amber-700">En espera de enlace</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Visor de Payload Seleccionado */}
              {selectedItem && (
                <div className="p-4 bg-slate-900 text-slate-100 rounded-xl text-xs font-mono space-y-2">
                  <div className="flex items-center justify-between text-slate-400 text-[11px] pb-1 border-b border-slate-800">
                    <span>Detalle de Payload: {selectedItem.entityId}</span>
                    <button onClick={() => setSelectedItem(null)} className="text-slate-400 hover:text-white">
                      Cerrar detalle
                    </button>
                  </div>
                  <pre className="overflow-x-auto max-h-36 text-[11px] text-emerald-400">
                    {(() => {
                      try {
                        return JSON.stringify(JSON.parse(selectedItem.payload), null, 2);
                      } catch {
                        return selectedItem.payload;
                      }
                    })()}
                  </pre>
                </div>
              )}
            </div>

            {/* Footer Modal */}
            <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[var(--lime)]" />
                Continuidad operativa 100% garantizada en modo desconectado.
              </span>
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold rounded-lg transition-all cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
