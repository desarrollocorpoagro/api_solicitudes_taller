import React, { useState, useEffect } from 'react';
import { Image, Upload, Trash2, FileText, CheckCircle, ExternalLink } from 'lucide-react';

export const MultimediaModule: React.FC = () => {
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [ordenId, setOrdenId] = useState('OS-2026-00101');
  const [tipo, setTipo] = useState('foto_sintoma');
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    fetchFiles();
  }, [ordenId]);

  const fetchFiles = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('sanluis_token');
      const res = await fetch(`/api/v1/multimedia/orden/${ordenId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await res.json();
        if (data.success) {
          setFiles(data.data || []);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      alert('Seleccione un archivo fotográfico o documento para subir.');
      return;
    }

    const formData = new FormData();
    formData.append('archivo', selectedFile);
    formData.append('ordenId', ordenId);
    formData.append('tipo', tipo);

    try {
      const token = localStorage.getItem('sanluis_token');
      const res = await fetch('/api/v1/multimedia/upload', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await res.json();
        if (data.success) {
          setToast('Archivo multimedia cargado con éxito.');
          setSelectedFile(null);
          fetchFiles();
        } else {
          alert(data.error || 'Error al subir archivo');
        }
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
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

      {/* Formulario de Carga */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Upload className="w-5 h-5 text-blue-600" />
          Almacenamiento Multimedia en la Nube (S3 / Cloud Storage / Local)
        </h3>
        <p className="text-xs text-slate-500">
          Carga fotografías de síntomas mecánicos, dictámenes periciales o comprobantes de garantía.
        </p>

        <form onSubmit={handleUpload} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end text-xs">
          <div>
            <label className="block uppercase font-semibold text-slate-600 mb-1">Orden de Servicio *</label>
            <input
              value={ordenId}
              onChange={(e) => setOrdenId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block uppercase font-semibold text-slate-600 mb-1">Tipo de Evidencia *</label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              <option value="foto_sintoma">Fotografía de Síntoma</option>
              <option value="foto_diagnostico">Fotografía de Diagnóstico</option>
              <option value="comprobante_garantia">Comprobante de Garantía</option>
            </select>
          </div>

          <div>
            <label className="block uppercase font-semibold text-slate-600 mb-1">Seleccionar Archivo *</label>
            <input
              type="file"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              className="w-full text-xs text-slate-500 file:mr-2 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>

          <div>
            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg text-xs font-medium hover:bg-blue-700 flex items-center justify-center gap-1.5 h-[38px] shadow-sm transition-colors"
            >
              <Upload className="w-4 h-4" /> Subir Archivo
            </button>
          </div>
        </form>
      </div>

      {/* Galería de Archivos */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Image className="w-5 h-5 text-blue-600" />
          Galería de Evidencias ({files.length} archivos adjuntos)
        </h3>

        {files.length === 0 ? (
          <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-xl text-slate-400 text-xs">
            No hay archivos fotográficos o documentos cargados para la orden {ordenId}.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {files.map((f) => (
              <div key={f.id} className="border border-slate-200 rounded-xl p-3 bg-slate-50/70 space-y-2 text-xs">
                <div className="h-32 bg-slate-200/80 rounded-lg flex items-center justify-center overflow-hidden">
                  {f.mimetype?.startsWith('image') ? (
                    <img src={f.url} alt={f.nombreOriginal} className="object-cover w-full h-full" />
                  ) : (
                    <FileText className="w-10 h-10 text-slate-400" />
                  )}
                </div>
                <span className="font-semibold text-slate-800 block truncate">{f.nombreOriginal}</span>
                <div className="flex justify-between items-center text-[10px] text-slate-400 pt-1 border-t border-slate-200/60">
                  <span className="font-mono">{Math.round((f.tamano || 0) / 1024)} KB</span>
                  <a
                    href={f.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 font-semibold hover:underline flex items-center gap-0.5"
                  >
                    Ver <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MultimediaModule;
