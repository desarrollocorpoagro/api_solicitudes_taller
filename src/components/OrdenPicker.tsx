import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Camera, ChevronDown, ScanLine, X } from 'lucide-react';

export interface OrdenOption {
  id: string;
  placa: string;
  marca?: string;
  estado?: string;
}

interface OrdenPickerProps {
  value: string;
  onChange: (v: string) => void;
  orders: OrdenOption[];
  placeholder?: string;
  allowNueva?: boolean;
  onFeedback?: (msg: string, ok?: boolean) => void;
}

const norm = (s: string): string => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev: number[] = Array.from({ length: b.length + 1 }, (_, j) => j);
  let cur: number[] = [];
  for (let i = 1; i <= a.length; i++) {
    cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return cur[b.length];
}

function preprocessPlate(img: HTMLImageElement): string {
  const scale = Math.min(1, 900 / Math.max(1, img.naturalWidth || 1));
  const w = Math.max(1, Math.round((img.naturalWidth || 0) * scale));
  const h = Math.max(1, Math.round((img.naturalHeight || 0) * scale));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) return img.src;
  ctx.drawImage(img, 0, 0, w, h);
  const id = ctx.getImageData(0, 0, w, h);
  const d = id.data;
  let min = 255;
  let max = 0;
  for (let i = 0; i < d.length; i += 4) {
    const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    d[i] = d[i + 1] = d[i + 2] = lum;
    if (lum < min) min = lum;
    if (lum > max) max = lum;
  }
  const range = Math.max(1, max - min);
  for (let i = 0; i < d.length; i += 4) {
    const v = Math.round(((d[i] - min) / range) * 255);
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(id, 0, 0);
  return c.toDataURL('image/png');
}

export const OrdenPicker: React.FC<OrdenPickerProps> = ({
  value,
  onChange,
  orders,
  placeholder,
  allowNueva,
  onFeedback,
}) => {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [esMovil, setEsMovil] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse)');
    setEsMovil(mq.matches);
    const handler = (e: MediaQueryListEvent) => setEsMovil(e.matches);
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, []);

  const selectedOrder = orders.find((o) => o.id === value);
  const inputText =
    (!open && value && value.includes('NUEVA'))
      ? '➕ Aperturar Nueva Orden'
      : open
        ? query
        : selectedOrder
          ? `${selectedOrder.id} - ${selectedOrder.placa}`
          : query || '';

  const filtered = query.trim()
    ? orders.filter((o) => {
        const t = query.toLowerCase();
        return (
          o.id.toLowerCase().includes(t) ||
          String(o.placa || '').toLowerCase().includes(t) ||
          String(o.marca || '').toLowerCase().includes(t) ||
          String(o.estado || '').toLowerCase().includes(t)
        );
      })
    : orders;

  const resolveMatch = useCallback((raw: string): OrdenOption | null => {
    const R = norm(raw);
    if (!R) return null;
    const exact = orders.find(
      (o) => norm(o.placa) === R || norm(o.placa).includes(R) || norm(o.id) === R || norm(o.id).includes(R),
    );
    if (exact) return exact;
    let best: OrdenOption | null = null;
    let bestDist = 3;
    let unique = true;
    for (const o of orders) {
      for (const field of [norm(o.placa), norm(o.id)]) {
        if (!field) continue;
        const d = levenshtein(R, field);
        if (d <= 2) {
          if (d < bestDist) {
            best = o;
            bestDist = d;
            unique = true;
          } else if (d === bestDist && best && best.id !== o.id) {
            unique = false;
          }
        }
      }
    }
    return unique ? best : null;
  }, [orders]);

  const runOcr = useCallback(async (file: File) => {
    setScanning(true);
    onFeedback?.('Leyendo placa con la cámara…', true);
    try {
      const url = URL.createObjectURL(file);
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = () => reject(new Error('No se pudo cargar la imagen capturada'));
        i.src = url;
      });
      const dataUrl = preprocessPlate(img);
      URL.revokeObjectURL(url);

      const Tesseract = (await import('tesseract.js')).default;
      const worker = await Tesseract.createWorker('eng', Tesseract.OEM.LSTM_ONLY, {
        workerPath: '/tess/worker.min.js',
        corePath: '/tess/',
        langPath: '/tessdata/',
        logger: () => undefined,
      });
      try {
        await worker.setParameters({
          tessedit_pageseg_mode: '7' as import('tesseract.js').PSM,
          tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
        });
        const res = await worker.recognize(dataUrl);
        const texto = String(res?.data?.text || '').toUpperCase();
        const match = resolveMatch(texto);
        if (match) {
          onChange(match.id);
          onFeedback?.(`Placa ${match.placa} detectada → Orden ${match.id}`, true);
        } else {
          onFeedback?.(`No se encontró una orden con el texto leído (${norm(texto) || 'vacío'}).`, false);
        }
      } finally {
        await worker.terminate();
      }
    } catch (err: any) {
      onFeedback?.(`Error de OCR: ${err?.message || 'desconocido'}`, false);
    } finally {
      setScanning(false);
    }
  }, [onChange, onFeedback, resolveMatch]);

  const handleCamera = () => fileRef.current?.click();

  const nuevaOrdenId = `OS-${new Date().getFullYear()}-NUEVA`;

  return (
    <div style={{ position: 'relative', minWidth: 220 }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <input
          type="text"
          value={inputText}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            if (value && e.target.value !== inputText) {
              onChange('');
            }
          }}
          onFocus={() => {
            setQuery('');
            setOpen(true);
          }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder || 'Buscar por placa o nº de orden…'}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          style={{ paddingRight: esMovil ? 76 : 40 }}
        />
        {!open && value && !scanning && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              onChange('');
            }}
            className="absolute pr-2"
            style={{ right: esMovil ? 40 : 6, background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4 }}
            title="Limpiar selección"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        {esMovil && (
          <button
            type="button"
            onClick={handleCamera}
            disabled={scanning}
            title="Leer placa con la cámara"
            className="absolute flex items-center justify-center bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
            style={{ right: 4, width: 32, height: 32, borderRadius: 8 }}
          >
            {scanning ? <ScanLine className="w-4 h-4 animate-pulse" /> : <Camera className="w-4 h-4" />}
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) runOcr(f);
            e.target.value = '';
          }}
        />
      </div>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 60,
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 12,
            boxShadow: '0 12px 32px -8px rgba(15,23,42,0.22)',
            maxHeight: 300,
            overflowY: 'auto',
            marginTop: 4,
          }}
        >
          {filtered.length === 0 && !allowNueva ? (
            <div className="p-3 text-center text-xs text-slate-400">Sin resultados para “{query}”.</div>
          ) : (
            <>
              {filtered.map((o) => (
                <button
                  type="button"
                  key={o.id}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setQuery('');
                    onChange(o.id);
                    setOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-blue-50 flex items-center justify-between gap-2 border-b border-slate-100 last:border-0"
                  style={{ background: o.id === value ? '#eff6ff' : undefined }}
                >
                  <span className="min-w-0">
                    <span className="block font-mono text-sm font-semibold text-slate-800 truncate">{o.id}</span>
                    <span className="block text-xs text-slate-500 truncate">
                      <span className="text-blue-700 font-medium">{o.placa}</span>
                      {o.marca ? ` • ${o.marca}` : ''}
                    </span>
                  </span>
                  {o.estado && (
                    <span
                      className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{
                        color: o.estado === 'Cerrada' ? '#b45309' : '#047857',
                        background: o.estado === 'Cerrada' ? '#fffbeb' : '#ecfdf5',
                      }}
                    >
                      {o.estado}
                    </span>
                  )}
                </button>
              ))}
              {allowNueva && (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setQuery('');
                    onChange(nuevaOrdenId);
                    setOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-blue-50 font-medium text-sm text-blue-700 flex items-center gap-2 border-t border-slate-100"
                  style={{ background: value === nuevaOrdenId ? '#eff6ff' : undefined }}
                >
                  <span className="text-base leading-none">➕</span> Aperturar Nueva Orden
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default OrdenPicker;