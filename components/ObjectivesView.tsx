import React, { useMemo } from 'react';
import { calculateCompliance } from '../utils/compliance';
import type { Dashboard, DashboardItem } from '../types';
import type { ContributionIndicatorAssignment, ContributionObjective, StrategicObjective, StrategicPerspective } from '../strategyTypes';

type Props = {
  dashboard: Dashboard;
  objectives: StrategicObjective[];
  perspectives: StrategicPerspective[];
  contributions: ContributionObjective[];
  assignments: ContributionIndicatorAssignment[];
  year: number;
};

const statusFor = (score: number | null) => score === null ? 'RIESGO DE DATOS' : score < 70 ? 'CRÍTICO' : score < 90 ? 'REQUIERE ATENCIÓN' : 'BAJO CONTROL';

export const ObjectivesView: React.FC<Props> = ({ dashboard, objectives, perspectives, contributions, assignments, year }) => {
  const linkedIds = useMemo(() => new Set(assignments.filter(a => String(a.dashboardId) === String(dashboard.id)).map(a => String(a.itemId))), [assignments, dashboard.id]);
  const rowsFor = (objectiveId: string) => {
    const contributionIds = new Set(contributions.filter(c => c.primaryStrategicObjectiveId === objectiveId && c.status !== 'inactive').map(c => c.id));
    const itemIds = new Set(assignments.filter(a => String(a.dashboardId) === String(dashboard.id) && (a.strategicObjectiveId === objectiveId || (a.contributionObjectiveId && contributionIds.has(a.contributionObjectiveId)))).map(a => String(a.itemId)));
    return dashboard.items.filter(item => itemIds.has(String(item.id)));
  };
  const score = (item: DashboardItem) => calculateCompliance(item, dashboard.thresholds, year, 'realTime', dashboard.items).overallPercentage;
  const trend = (item: DashboardItem) => {
    const values = (item.monthlyProgress || []).filter(v => v !== null && v !== undefined).map(Number);
    if (values.length < 2) return 'ESTABLE';
    return values[values.length - 1] >= values[values.length - 2] ? 'MEJORA' : 'DETERIORO';
  };
  const objectiveRows = objectives.map(objective => ({ objective, items: rowsFor(objective.id) }));
  const unlinked = dashboard.items.filter(item => !linkedIds.has(String(item.id)));
  return <section className="space-y-5" aria-label="Vista por objetivos">
    <div><p className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400">Objetivos</p><h2 className="mt-1 text-2xl font-black tracking-tight text-white">Lectura estratégica</h2><p className="mt-1 text-sm text-slate-400">Objetivo → desviación → causa → acción.</p></div>
    {objectiveRows.length === 0 && <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-8 text-center text-sm text-slate-400">Sin Objetivos Estratégicos configurados.</div>}
    <div className="grid gap-4 xl:grid-cols-2">{objectiveRows.map(({ objective, items }) => {
      const scores = items.map(score); const aggregate = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
      const status = statusFor(aggregate); const perspective = perspectives.find(p => p.id === objective.perspectiveId);
      const plans = items.filter(item => Boolean(item.actionPlan)).length;
      return <article key={objective.id} className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 shadow-xl"><div className="flex items-start justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-widest text-slate-500">{perspective?.name || 'Perspectiva no definida'}</p><h3 className="mt-1 text-lg font-black text-white">{objective.title}</h3></div><span className={`whitespace-nowrap rounded-lg border px-2.5 py-1 text-[9px] font-black uppercase ${status === 'CRÍTICO' ? 'border-rose-500/30 text-rose-300' : status === 'REQUIERE ATENCIÓN' ? 'border-amber-500/30 text-amber-300' : 'border-emerald-500/30 text-emerald-300'}`}>{aggregate === null ? '—' : `${aggregate}%`} · {status}</span></div><div className="mt-5 space-y-2"><p className="text-[9px] font-black uppercase tracking-widest text-slate-500">KPIs relacionados</p>{items.length === 0 ? <p className="text-sm text-slate-400">SIN INDICADORES ASOCIADOS</p> : items.slice(0, 5).map(item => { const value = Math.round(score(item)); return <div key={String(item.id)} className="flex items-center justify-between rounded-xl border border-white/5 bg-slate-950/40 px-3 py-2"><span className="truncate pr-3 text-xs font-bold text-slate-200">{item.indicator}</span><span className="whitespace-nowrap text-[10px] font-black text-cyan-300">{value}% · {trend(item)}</span></div>; })}{items.length > 5 && <p className="text-[10px] text-slate-500">+{items.length - 5} KPI adicionales</p>}</div><div className="mt-4 flex gap-5 border-t border-white/5 pt-3 text-[10px] font-black uppercase tracking-widest text-slate-500"><span>Planes activos <b className="text-cyan-300">{plans}</b></span><span>Pendientes <b className="text-amber-300">0</b></span></div></article>;
    })}</div>
    {unlinked.length > 0 && <div className="rounded-2xl border border-dashed border-amber-500/30 bg-amber-500/5 p-4"><p className="text-[10px] font-black uppercase tracking-widest text-amber-300">KPIs SIN OBJETIVO ASOCIADO · {unlinked.length}</p><p className="mt-1 text-xs text-slate-400">Señal de calidad del modelo estratégico; no se ocultan del tablero.</p></div>}
  </section>;
};
