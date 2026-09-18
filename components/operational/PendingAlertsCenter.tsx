import React, { useMemo, useState } from 'react';
import type { Dashboard } from '../../types';
import { buildPendingItems, getPendingActionTarget, getPendingCategoryCounts, type PendingCategory, type PendingItem } from '../../utils/pendingAlerts';
import type { TrackingPeriod } from '../../utils/trackingObligation';

interface PendingAlertsCenterProps {
  dashboards: Dashboard[];
  year: number;
  authorizedDashboardIds: Array<Dashboard['id']>;
  onNavigateToKpi?: (dashboardId: number | string, itemId: number | string) => void;
}

const currentPeriod = (frequency: 'monthly' | 'weekly', year: number): TrackingPeriod => {
  const now = new Date();
  if (frequency === 'monthly') return { frequency, year, monthIndex: year < now.getFullYear() ? 11 : year > now.getFullYear() ? 0 : now.getMonth() };
  const weekNumber = year < now.getFullYear() ? 53 : Math.max(1, Math.min(53, Math.ceil((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / 604800000)));
  return { frequency, year, weekNumber };
};

const periodLabel = (period: TrackingPeriod) => period.frequency === 'monthly'
  ? new Intl.DateTimeFormat('es-MX', { month: 'short', year: 'numeric' }).format(new Date(period.year, period.monthIndex, 1))
  : `Semana ${period.weekNumber} · ${period.year}`;

const typeLabel: Record<PendingItem['type'], string> = {
  TRACKING_START_UNDEFINED: 'INICIO SIN CONFIGURAR', MISSING_GOAL: 'FALTA META', MISSING_PROGRESS: 'FALTA AVANCE', RESULT_CRITICAL: 'RESULTADO CRÍTICO', RESULT_AT_RISK: 'RESULTADO EN RIESGO',
};

export const PendingAlertsCenter: React.FC<PendingAlertsCenterProps> = ({ dashboards, year, authorizedDashboardIds, onNavigateToKpi }) => {
  const [area, setArea] = useState('TODAS');
  const [responsible, setResponsible] = useState('TODOS');
  const [category, setCategory] = useState<'TODAS' | PendingCategory>('TODAS');
  const pending = useMemo(() => (['monthly', 'weekly'] as const).flatMap(frequency => {
    const scoped = dashboards.filter(d => (d.periodicity || 'monthly') === frequency);
    const period = currentPeriod(frequency, year);
    return buildPendingItems(scoped, period, period, authorizedDashboardIds);
  }), [authorizedDashboardIds, dashboards, year]);
  const counts = useMemo(() => getPendingCategoryCounts(pending), [pending]);
  const areas = useMemo(() => ['TODAS', ...Array.from(new Set(pending.map(x => x.area).filter(Boolean) as string[])).sort()], [pending]);
  const responsibles = useMemo(() => ['TODOS', ...Array.from(new Set(pending.map(x => x.responsible).filter(Boolean) as string[])).sort()], [pending]);
  const visible = useMemo(() => pending.filter(item => (area === 'TODAS' || item.area === area) && (responsible === 'TODOS' || item.responsible === responsible) && (category === 'TODAS' || item.category === category)), [area, category, pending, responsible]);

  return <section aria-label="Pendientes inteligentes" className="rounded-xl border border-cyan-500/15 bg-slate-900/30 p-3 sm:p-4">
    <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
      <div><p className="text-[10px] font-black uppercase tracking-[0.25em] text-cyan-300">Pendientes</p><h3 className="mt-1 text-base font-black text-white">{pending.length} asuntos requieren atención</h3><p className="mt-1 text-xs text-slate-400">Sólo excepciones accionables del periodo actual.</p></div>
      <div className="flex flex-wrap gap-2 text-[9px] font-black uppercase tracking-wider"><span className="rounded bg-violet-500/10 px-2 py-1 text-violet-200">Configuración: {counts.CONFIGURACIÓN}</span><span className="rounded bg-amber-500/10 px-2 py-1 text-amber-200">Captura: {counts.CAPTURA}</span><span className="rounded bg-rose-500/10 px-2 py-1 text-rose-200">Resultado: {counts.RESULTADO}</span></div>
    </div>
    <div className="mt-4 flex flex-wrap gap-2">
      <select aria-label="Filtrar pendientes por categoría" value={category} onChange={e => setCategory(e.target.value as 'TODAS' | PendingCategory)} className="min-h-[36px] rounded-lg border border-white/10 bg-slate-950 px-2 text-[10px] font-black text-slate-300"><option value="TODAS">TODAS LAS CATEGORÍAS</option><option>CONFIGURACIÓN</option><option>CAPTURA</option><option>RESULTADO</option></select>
      <select aria-label="Filtrar pendientes por área" value={area} onChange={e => setArea(e.target.value)} className="min-h-[36px] rounded-lg border border-white/10 bg-slate-950 px-2 text-[10px] font-black text-slate-300">{areas.map(value => <option key={value}>{value}</option>)}</select>
      <select aria-label="Filtrar pendientes por responsable" value={responsible} onChange={e => setResponsible(e.target.value)} className="min-h-[36px] rounded-lg border border-white/10 bg-slate-950 px-2 text-[10px] font-black text-slate-300">{responsibles.map(value => <option key={value}>{value}</option>)}</select>
    </div>
    <div className="mt-4 grid gap-3 xl:grid-cols-3">{(['CONFIGURACIÓN', 'CAPTURA', 'RESULTADO'] as const).map(group => <div key={group}><h4 className="mb-2 text-[9px] font-black uppercase tracking-[0.22em] text-slate-400">{group}</h4><div className="space-y-2">{visible.filter(x => x.category === group).map(item => <article key={item.id} className="rounded-lg border border-white/10 bg-slate-950/40 p-3"><div className="flex items-start justify-between gap-2"><span className="text-[9px] font-black uppercase tracking-wider text-cyan-200">{typeLabel[item.type]}</span><span className="text-[9px] text-slate-500">{periodLabel(item.period)}</span></div><h5 className="mt-2 text-sm font-black text-white">{item.indicatorName}</h5><p className="mt-1 text-xs leading-relaxed text-slate-300">{item.message}</p><p className="mt-2 text-[9px] font-bold uppercase tracking-wide text-slate-500">{item.area || 'Área no registrada'} · {item.responsible || 'Responsable no registrado'}</p><button type="button" onClick={() => { const target = getPendingActionTarget(item); onNavigateToKpi?.(target.dashboardId, target.itemId); }} className="mt-3 min-h-[36px] rounded-md bg-cyan-700 px-3 text-[9px] font-black uppercase tracking-wider text-white hover:bg-cyan-600">{item.actionLabel}</button></article>)}{visible.filter(x => x.category === group).length === 0 && <p className="rounded-lg border border-dashed border-white/10 p-3 text-xs text-slate-500">Sin asuntos.</p>}</div></div>)}</div>
  </section>;
};
