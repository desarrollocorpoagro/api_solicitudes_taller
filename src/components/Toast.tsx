import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => undefined });

export const useToast = (): ToastContextValue => useContext(ToastContext);

const DURATION_MS = 5000;
const MAX_STACK = 4;

const TOAST_THEME: Record<ToastType, { bg: string; border: string; color: string; icon: React.ReactNode }> = {
  success: {
    bg: '#ecfdf5',
    border: '1px solid #10b981',
    color: '#059669',
    icon: <CheckCircle2 className="w-4 h-4" />,
  },
  error: {
    bg: '#fef2f2',
    border: '1px solid #f87171',
    color: '#dc2626',
    icon: <AlertCircle className="w-4 h-4" />,
  },
  info: {
    bg: '#eff6ff',
    border: '1px solid #60a5fa',
    color: '#2563eb',
    icon: <Info className="w-4 h-4" />,
  },
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, type: ToastType = 'info') => {
      const id = ++idRef.current;
      setItems((prev) => [...prev.slice(-(MAX_STACK - 1)), { id, type, message }]);
      window.setTimeout(() => dismiss(id), DURATION_MS);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        role="region"
        aria-live="polite"
        style={{
          position: 'fixed',
          bottom: 16,
          right: 16,
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          maxWidth: 380,
          width: 'calc(100vw - 32px)',
        }}
      >
        <style>{`@keyframes toast-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
        {items.map((t) => {
          const theme = TOAST_THEME[t.type];
          return (
            <div
              key={t.id}
              style={{
                background: theme.bg,
                border: theme.border,
                borderRadius: 12,
                boxShadow: '0 10px 30px -8px rgba(15,23,42,0.28)',
                padding: '10px 12px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                animation: 'toast-in 0.18s ease-out',
              }}
            >
              <span style={{ color: theme.color, flexShrink: 0, marginTop: 1 }}>{theme.icon}</span>
              <span style={{ fontSize: 13, lineHeight: 1.4, color: '#0f172a', flex: 1, whiteSpace: 'pre-line', wordBreak: 'break-word' }}>
                {t.message}
              </span>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 2, flexShrink: 0 }}
                aria-label="Cerrar notificación"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export default ToastProvider;