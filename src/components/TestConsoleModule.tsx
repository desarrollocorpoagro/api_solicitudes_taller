import React, { useState } from 'react';
import { Play, CheckCircle2, XCircle, Terminal, RefreshCw } from 'lucide-react';

export const TestConsoleModule: React.FC = () => {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<any>(null);

  const handleRunTests = async () => {
    setRunning(true);
    try {
      const res = await fetch('/api/v1/system/run-tests', { method: 'POST' });
      const data = await res.json();
      setResults(data);
    } catch (err: any) {
      setResults({ success: false, error: err.message });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-wrap justify-between items-center gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Terminal className="w-5 h-5 text-blue-600" />
            Consola de Pruebas Unitarias & Diagnóstico de Backend
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Ejecución en tiempo real de la suite de pruebas: Criptografía bcrypt, JWT, Aislamiento Tenant, Reglas de Taller, Reincidencias, ERP Profit y Winston Logger.
          </p>
        </div>
        <button
          onClick={handleRunTests}
          disabled={running}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-medium hover:bg-blue-700 flex items-center gap-2 shadow-sm transition-colors"
        >
          {running ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
          {running ? 'Ejecutando Suite...' : 'Ejecutar Pruebas Ahora'}
        </button>
      </div>

      {/* Resultados de Pruebas */}
      {results && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-center">
              <span className="block text-xs uppercase font-medium text-slate-400">Total Pruebas</span>
              <span className="text-2xl font-bold font-mono text-slate-900 mt-1 block">{results.total || 0}</span>
            </div>
            <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200 shadow-sm text-center">
              <span className="block text-xs uppercase font-medium text-emerald-700">Pruebas Superadas</span>
              <span className="text-2xl font-bold font-mono text-emerald-700 mt-1 block">{results.passed || 0}</span>
            </div>
            <div className="bg-rose-50/50 p-4 rounded-xl border border-rose-200 shadow-sm text-center">
              <span className="block text-xs uppercase font-medium text-rose-700">Fallos</span>
              <span className="text-2xl font-bold font-mono text-rose-700 mt-1 block">{results.failed || 0}</span>
            </div>
          </div>

          <div className="bg-slate-900 text-slate-200 p-5 rounded-xl border border-slate-800 shadow-inner space-y-3 font-mono text-xs">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2.5">
              <span className="text-blue-400 uppercase font-semibold text-[11px] tracking-wider">
                Resumen Detallado de Ejecución
              </span>
              <span className="text-[10px] text-slate-400">Node.js Express + Sequelize SQLite/MSSQL</span>
            </div>

            <div className="space-y-1.5 pt-1">
              {results.results?.map((r: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
                  <div className="flex items-center gap-2.5">
                    {r.passed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                    )}
                    <span className="font-semibold text-slate-300">[{r.suite}]</span>
                    <span className="text-slate-400">{r.name}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">{r.durationMs}ms</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TestConsoleModule;
