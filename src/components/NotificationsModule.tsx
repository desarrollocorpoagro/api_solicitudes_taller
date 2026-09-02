import React, { useState, useEffect } from 'react';
import { Bell, Mail, Send, CheckCircle, Smartphone, RefreshCw } from 'lucide-react';
import { usePermissions } from '../hooks/usePermissions';

export const NotificationsModule: React.FC<{ currentUser?: any }> = ({ currentUser }) => {
  const { can } = usePermissions(currentUser);
  const canSend = can('notifications', 'create');
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [emailForm, setEmailForm] = useState({
    destinatario: 'gerente.taller@empresasanluis.com',
    titulo: 'Alerta de Aprobación Pendiente',
    mensaje: 'Se ha registrado una solicitud de repuesto para la unidad A12BC3D que supera el umbral de $500.00.',
  });
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('sanluis_token');
      const res = await fetch('/api/v1/notificaciones', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await res.json();
        if (data.success) {
          setNotifications(data.data || []);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      const token = localStorage.getItem('sanluis_token');
      const res = await fetch('/api/v1/notificaciones/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          tipo: 'EMAIL',
          destinatarioEmail: emailForm.destinatario,
          titulo: emailForm.titulo,
          mensaje: emailForm.mensaje,
          canal: 'taller',
        }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await res.json();
        if (data.success) {
          setToast('Notificación por correo electrónico enviada y registrada con éxito.');
          fetchNotifications();
        } else {
          alert(data.error || 'Error al enviar notificación');
        }
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSending(false);
      setTimeout(() => setToast(null), 4000);
    }
  };

  const handleSendPush = async () => {
    setSending(true);
    try {
      const res = await fetch('/api/v1/notificaciones/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'PUSH',
          titulo: '🚨 Alerta de Taller San Luis',
          mensaje: 'Nueva orden de servicio aperturada para camión Chevrolet NPR (Placa A12BC3D).',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setToast('Notificación Push emitida a los dispositivos suscritos.');
        fetchNotifications();
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSending(false);
      setTimeout(() => setToast(null), 4000);
    }
  };

  return (
    <div className="space-y-6">
      {toast && (
        <div className="p-4 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-semibold flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600" /> {toast}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Formulario de Envío */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Mail className="w-5 h-5 text-blue-600" />
            Emisión de Notificaciones Transaccionales
          </h3>
          <p className="text-xs text-slate-500">
            Envía correos electrónicos y alertas push en tiempo real a operadores y gerencia de taller.
          </p>

          <form onSubmit={handleSendEmail} className="space-y-3.5 text-xs">
            <div>
              <label className="block uppercase font-semibold text-slate-600 mb-1">Destinatario *</label>
              <input
                type="email"
                required
                value={emailForm.destinatario}
                onChange={(e) => setEmailForm({ ...emailForm, destinatario: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block uppercase font-semibold text-slate-600 mb-1">Asunto / Título *</label>
              <input
                required
                value={emailForm.titulo}
                onChange={(e) => setEmailForm({ ...emailForm, titulo: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block uppercase font-semibold text-slate-600 mb-1">Mensaje / Contenido *</label>
              <textarea
                required
                rows={3}
                value={emailForm.mensaje}
                onChange={(e) => setEmailForm({ ...emailForm, mensaje: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={sending || !canSend}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg text-xs font-medium hover:bg-blue-700 flex items-center justify-center gap-1.5 shadow-sm transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed"
                title={!canSend ? 'Su rol no permite enviar notificaciones' : undefined}
              >
                <Send className="w-3.5 h-3.5" /> Enviar Correo
              </button>
              <button
                type="button"
                onClick={handleSendPush}
                disabled={sending || !canSend}
                className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 py-2 px-4 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title={!canSend ? 'Su rol no permite enviar notificaciones' : undefined}
              >
                <Smartphone className="w-3.5 h-3.5 text-blue-600" /> Emitir Push
              </button>
            </div>
          </form>
        </div>

        {/* Historial de Notificaciones */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Bell className="w-5 h-5 text-blue-600" />
              Historial de Notificaciones
            </h3>
            <button onClick={fetchNotifications} className="text-xs text-slate-500 hover:text-slate-900 flex items-center gap-1">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
            {notifications.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8">No hay notificaciones registradas.</p>
            ) : (
              notifications.map((n) => (
                <div key={n.id} className="p-3 bg-slate-50/80 rounded-xl border border-slate-200 text-xs space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-slate-900">{n.titulo}</span>
                    <span className="text-[10px] font-mono bg-blue-50 text-blue-700 border border-blue-100 px-1.5 py-0.5 rounded font-bold">
                      {n.tipo}
                    </span>
                  </div>
                  <p className="text-slate-600 leading-relaxed">{n.mensaje}</p>
                  <div className="flex justify-between items-center text-[10px] text-slate-400 pt-1 border-t border-slate-200/50">
                    <span>{n.destinatarioEmail || 'Broadcast Push'}</span>
                    <span>{new Date(n.createdAt).toLocaleTimeString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationsModule;
