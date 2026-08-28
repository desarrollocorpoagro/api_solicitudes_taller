import React, { useState, useEffect } from 'react';
import { BookOpen, ExternalLink, Code, Play, CheckCircle } from 'lucide-react';

export const SwaggerModule: React.FC = () => {
  const [spec, setSpec] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTag, setSelectedTag] = useState<string>('Todos');
  const [testResult, setTestResult] = useState<any>(null);
  const [activeEndpoint, setActiveEndpoint] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api-docs-json')
      .then(async (r) => {
        const contentType = r.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          return r.json();
        }
        throw new Error('Respuesta no JSON');
      })
      .then((data) => {
        setSpec(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error cargando swagger spec:', err);
        setLoading(false);
      });
  }, []);

  const handleTestEndpoint = async (path: string, method: string) => {
    setActiveEndpoint(`${method} ${path}`);
    setTestResult({ status: 'loading' });
    try {
      const url = `/api/v1${path.replace('{id}', 'OS-2026-00101').replace('{placa}', 'A12BC3D').replace('{cod}', 'FRE-0234').replace('{role}', 'ADMIN')}`;
      const token = localStorage.getItem('sanluis_token');
      const res = await fetch(url, {
        method: method.toUpperCase(),
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const contentType = res.headers.get('content-type') || '';
      let data: any;
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        data = await res.text();
      }
      setTestResult({
        status: res.status,
        ok: res.ok,
        data,
      });
    } catch (err: any) {
      setTestResult({
        status: 'ERROR',
        ok: false,
        error: err.message,
      });
    }
  };

  if (loading || !spec) {
    return (
      <div className="p-12 text-center text-slate-500 bg-white rounded-lg border">
        <p className="animate-pulse">Cargando especificación OpenAPI 3.0.3 de San Luis...</p>
      </div>
    );
  }

  // Agrupar paths por Tags
  const endpoints: any[] = [];
  const tagsSet = new Set<string>();

  Object.entries(spec.paths || {}).forEach(([path, methods]: [string, any]) => {
    Object.entries(methods).forEach(([method, details]: [string, any]) => {
      const tag = details.tags?.[0] || 'General';
      tagsSet.add(tag);
      endpoints.push({
        path,
        method: method.toUpperCase(),
        tag,
        summary: details.summary,
        description: details.description,
        parameters: details.parameters || [],
        security: details.security,
      });
    });
  });

  const tags = ['Todos', ...Array.from(tagsSet)];
  const filtered = selectedTag === 'Todos' ? endpoints : endpoints.filter((e) => e.tag === selectedTag);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-wrap justify-between items-center gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-600" />
            Documentación Interactiva Swagger / OpenAPI 3.0
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {spec.info.title} v{spec.info.version} • {endpoints.length} Endpoints documentados en español
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href="/api-docs"
            target="_blank"
            rel="noreferrer"
            className="px-3.5 py-2 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 flex items-center gap-1.5 shadow-sm transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Abrir Swagger UI Oficial
          </a>
          <a
            href="/api-docs-json"
            target="_blank"
            rel="noreferrer"
            className="px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono text-slate-700 hover:bg-slate-50 flex items-center gap-1 transition-colors"
          >
            <Code className="w-3.5 h-3.5 text-slate-500" /> JSON Spec
          </a>
        </div>
      </div>

      {/* Filter Tags */}
      <div className="flex flex-wrap gap-1.5 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
        {tags.map((t) => (
          <button
            key={t}
            onClick={() => setSelectedTag(t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              selectedTag === t
                ? 'bg-blue-50 text-blue-700 font-semibold border border-blue-200'
                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200/80'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Endpoint Explorer */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          {filtered.map((ep, idx) => {
            const methodColor =
              ep.method === 'GET'
                ? 'bg-blue-50 text-blue-700 border-blue-200'
                : ep.method === 'POST'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : ep.method === 'PUT'
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : 'bg-rose-50 text-rose-700 border-rose-200';

            return (
              <div key={idx} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-2 hover:border-blue-300 transition-colors">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono border ${methodColor}`}>
                      {ep.method}
                    </span>
                    <span className="font-mono text-xs font-bold text-slate-800">/api/v1{ep.path}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 bg-slate-100 border border-slate-200/60 px-2 py-0.5 rounded">{ep.tag}</span>
                </div>
                <p className="text-xs font-semibold text-slate-900">{ep.summary}</p>
                {ep.description && <p className="text-[11px] text-slate-500">{ep.description}</p>}
                <div className="flex justify-end pt-1">
                  <button
                    onClick={() => handleTestEndpoint(ep.path, ep.method)}
                    className="px-3 py-1.5 bg-slate-50 hover:bg-blue-50 hover:text-blue-700 border border-slate-200 rounded-lg text-[11px] font-medium text-slate-700 flex items-center gap-1.5 transition-colors"
                  >
                    <Play className="w-3 h-3 text-blue-600" /> Probar Endpoint
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Live Response Panel */}
        <div className="bg-slate-900 text-slate-200 border border-slate-800 p-5 rounded-xl shadow-inner h-fit sticky top-24 space-y-4">
          <div className="flex justify-between items-center border-b border-slate-800 pb-3">
            <h3 className="font-mono text-xs uppercase tracking-wider text-slate-400 flex items-center gap-1.5 font-semibold">
              <Code className="w-4 h-4 text-blue-400" /> Live Response Console
            </h3>
            {activeEndpoint && <span className="text-[10px] text-blue-400 font-mono">{activeEndpoint}</span>}
          </div>

          {!testResult ? (
            <p className="text-xs text-slate-400 leading-relaxed">
              Seleccione cualquier endpoint a la izquierda y haga clic en <b className="text-slate-300">Probar Endpoint</b> para ejecutar una llamada HTTP en vivo y visualizar la respuesta JSON del servidor.
            </p>
          ) : testResult.status === 'loading' ? (
            <p className="text-xs text-blue-400 animate-pulse font-mono">Ejecutando llamada al servidor backend...</p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-400">Estado HTTP:</span>
                <span className={`px-2 py-0.5 rounded font-bold ${testResult.ok ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-rose-950 text-rose-400 border border-rose-800'}`}>
                  {testResult.status} {testResult.ok ? 'OK' : 'FAIL'}
                </span>
              </div>
              <pre className="p-3 bg-slate-950/80 border border-slate-800 rounded-lg text-[11px] font-mono overflow-x-auto max-h-96 text-emerald-400">
                {JSON.stringify(testResult.data || testResult.error, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SwaggerModule;
