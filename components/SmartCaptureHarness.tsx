import React, { useMemo, useState } from 'react';
import { formatCaptureCount, getCaptureSummaryForPeriod, makeCaptureEntry } from '../utils/smartCapture';
import type { DashboardItem } from '../types';

const period = { frequency: 'monthly' as const, year: 2026, monthIndex: 7 }; // Agosto 2026

const makeItem = (
  id: number,
  indicator: string,
  goal: number | null,
  progress: number | null,
  start: any,
  goalMarked = true,
  progressMarked = goalMarked,
): DashboardItem => {
  const g = Array(12).fill(null);
  const p = Array(12).fill(null);
  const gm = Array(12).fill(false);
  const pm = Array(12).fill(false);
  g[7] = goal;
  p[7] = progress;
  gm[7] = goalMarked;
  pm[7] = progressMarked;
  return {
    id,
    indicator,
    weight: 1,
    unit: 'u',
    type: 'accumulative',
    goalType: 'maximize',
    frequency: 'monthly',
    indicatorType: 'simple',
    trackingStartPeriod: start,
    monthlyGoals: g,
    monthlyProgress: p,
    monthlyGoalCaptured: gm,
    monthlyProgressCaptured: pm,
  } as DashboardItem;
};

export const SmartCaptureHarness: React.FC = () => {
  const [scenario, setScenario] = useState<'complete' | 'partial' | 'empty' | 'undefined_start' | 'explicit_zero'>('complete');

  const items: DashboardItem[] = useMemo(() => {
    switch (scenario) {
      case 'empty':
        return Array.from({ length: 10 }, (_, i) =>
          makeItem(i + 1, `KPI Futuro ${i + 1}`, null, null, { ...period, monthIndex: 9 })
        );
      case 'undefined_start':
        return Array.from({ length: 5 }, (_, i) =>
          makeItem(i + 1, `KPI Sin Configurar ${i + 1}`, null, null, undefined, false, false)
        );
      case 'explicit_zero':
        return [
          makeItem(1, 'KPI Ventas Cumplidas', 100, 105, period, true, true),
          makeItem(2, 'KPI Accidentes (Cero Válido)', 0, 0, period, true, true),
          makeItem(3, 'KPI Futuro No Exigible', null, null, { ...period, monthIndex: 10 }),
        ];
      case 'partial':
        return [
          ...Array.from({ length: 5 }, (_, i) => makeItem(i + 1, `KPI Completo ${i + 1}`, 10, 10, period, true, true)),
          makeItem(6, 'KPI Falta Meta', null, 10, period, false, true),
          makeItem(7, 'KPI Falta Avance', 10, null, period, true, false),
          ...Array.from({ length: 3 }, (_, i) => makeItem(i + 8, `KPI Futuro ${i + 8}`, null, null, { ...period, monthIndex: 9 })),
        ];
      case 'complete':
      default:
        return [
          ...Array.from({ length: 7 }, (_, i) => makeItem(i + 1, `KPI Exigible ${i + 1}`, 10, 0, period, true, true)),
          ...Array.from({ length: 3 }, (_, i) => makeItem(i + 8, `KPI Futuro ${i + 8}`, null, null, { ...period, monthIndex: 9 })),
        ];
    }
  }, [scenario]);

  const entries = useMemo(() => {
    return items.map(it => makeCaptureEntry(it, period, period, it.trackingStartPeriod));
  }, [items]);

  const summary = useMemo(() => getCaptureSummaryForPeriod(entries), [entries]);
  const noObligations = summary.requiredKpis === 0;

  return (
    <main className="min-h-screen bg-slate-950 p-6 md:p-10 text-white font-sans">
      <div className="max-w-5xl mx-auto space-y-8">
        <div>
          <div className="flex items-center gap-3">
            <span className="h-3 w-3 rounded-full bg-cyan-400 shadow-[0_0_10px_#22d3ee]" />
            <h1 className="text-2xl md:text-3xl font-black tracking-tight">
              CAPTURA INTELIGENTE · VALIDACIÓN VISUAL v9.6.7
            </h1>
          </div>
          <p className="text-xs text-slate-400 uppercase tracking-widest mt-1">
            Validación de numerador y denominador sobre KPI exigibles
          </p>
        </div>

        {/* CONTROLES DE ESCENARIO */}
        <div className="space-y-2">
          <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
            Escenarios de Prueba
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'complete', label: '7 de 7 Exigibles (100%)' },
              { id: 'partial', label: '5 de 7 Exigibles (71%)' },
              { id: 'empty', label: 'Sin KPI Exigibles (10 Futuros)' },
              { id: 'undefined_start', label: 'Inicio Sin Configurar' },
              { id: 'explicit_zero', label: 'Cero Explícito Válido' },
            ].map(s => (
              <button
                key={s.id}
                data-testid={`scenario-${s.id}`}
                onClick={() => setScenario(s.id as any)}
                className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all border ${
                  scenario === s.id
                    ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-lg shadow-cyan-500/20'
                    : 'bg-slate-900/80 text-slate-300 border-white/10 hover:bg-slate-800'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* HERO CAPTURA BADGE */}
        <div className="glass-panel rounded-2xl p-6 border border-white/10 bg-slate-900/60 shadow-2xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Resultado de Captura Visible
              </span>
              <h2 className="text-4xl md:text-5xl font-black mt-1 tracking-tight text-white">
                {summary.capturePercent === null
                  ? 'NINGÚN KPI EXIGIBLE'
                  : `${Math.round(summary.capturePercent)}%`}
              </h2>
              <p className="mt-2 text-sm md:text-base font-bold text-cyan-300">
                {summary.capturePercent === null
                  ? `Los ${summary.totalKpis} indicadores no están obligados en este periodo.`
                  : `${summary.capturedKpis} de ${summary.requiredKpis} indicadores requeridos capturados · ${Math.round(
                      summary.capturePercent,
                    )}%`}
              </p>
            </div>

            {/* BADGE SIMULATION AS SEEN IN DASHBOARDVIEW */}
            <div className="flex items-center gap-3 border border-white/10 bg-slate-950/80 px-5 py-3 rounded-2xl shadow-inner">
              <div className="flex flex-col items-end">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">
                  Badge en DashboardView
                </span>
                {summary.capturePercent !== null ? (
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-2xl font-black tracking-tight ${
                        summary.capturePercent === 100 ? 'text-emerald-400' : 'text-amber-400'
                      }`}
                    >
                      {Math.round(summary.capturePercent)}%
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap">
                      {summary.capturedKpis} de {summary.requiredKpis} exigibles
                    </span>
                  </div>
                ) : (
                  <span className="text-xs font-black text-slate-400 uppercase tracking-wider">
                    Sin obligaciones
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* METRICS GRID */}
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-3">
            Desglose de Denominador y Obligaciones
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border border-white/10 bg-slate-900/40 p-4">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">
                TOTAL KPIS
              </span>
              <span className="text-2xl font-black text-white">{summary.totalKpis}</span>
            </div>
            <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-4">
              <span className="text-[9px] font-black text-cyan-400 uppercase tracking-widest block">
                EXIGIBLES (DENOMINADOR)
              </span>
              <span className="text-2xl font-black text-cyan-300">{summary.requiredKpis}</span>
            </div>
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
              <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest block">
                CAPTURADOS (NUMERADOR)
              </span>
              <span className="text-2xl font-black text-emerald-300">
                {formatCaptureCount(summary.capturedKpis, noObligations)}
              </span>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-900/40 p-4">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">
                NO EXIGIBLES / FUTUROS
              </span>
              <span className="text-2xl font-black text-slate-300">
                {summary.notRequiredKpis + summary.futureKpis}
              </span>
            </div>

            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
              <span className="text-[9px] font-black text-amber-400 uppercase tracking-widest block">
                FALTA META
              </span>
              <span className="text-2xl font-black text-amber-300">
                {formatCaptureCount(summary.missingGoalKpis, noObligations)}
              </span>
            </div>
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
              <span className="text-[9px] font-black text-amber-400 uppercase tracking-widest block">
                FALTA AVANCE
              </span>
              <span className="text-2xl font-black text-amber-300">
                {formatCaptureCount(summary.missingProgressKpis, noObligations)}
              </span>
            </div>
            <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4">
              <span className="text-[9px] font-black text-purple-400 uppercase tracking-widest block">
                INICIO SIN CONFIGURAR
              </span>
              <span className="text-2xl font-black text-purple-300">
                {formatCaptureCount(summary.undefinedStartKpis, noObligations)}
              </span>
            </div>
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
              <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest block">
                PORCENTAJE FINAL
              </span>
              <span className="text-2xl font-black text-blue-300">
                {summary.capturePercent === null ? '—' : `${Math.round(summary.capturePercent)}%`}
              </span>
            </div>
          </div>
        </div>

        {/* LISTA DE INDICADORES DEL ESCENARIO */}
        <div className="space-y-2">
          <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
            Detalle de Indicadores Evaluados ({items.length})
          </div>
          <div className="divide-y divide-white/5 border border-white/10 rounded-2xl bg-slate-900/50 overflow-hidden">
            {summary.obligations.map(({ item, obligation }, idx) => (
              <div key={item.id || idx} className="p-4 flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-bold text-white">{item.indicator}</div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    TrackingStart:{' '}
                    {item.trackingStartPeriod
                      ? `M${(item.trackingStartPeriod as any).monthIndex + 1}/${(item.trackingStartPeriod as any).year}`
                      : 'NO CONFIGURADO'}
                    {' · '}
                    Meta: {String(item.monthlyGoals?.[7] ?? 'null')} | Avance:{' '}
                    {String(item.monthlyProgress?.[7] ?? 'null')}
                  </div>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                    obligation === 'CAPTURE_COMPLETE'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : obligation === 'NOT_REQUIRED' || obligation === 'FUTURE'
                      ? 'bg-slate-800 text-slate-400 border border-slate-700'
                      : obligation === 'TRACKING_START_UNDEFINED'
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}
                >
                  {obligation}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
};
