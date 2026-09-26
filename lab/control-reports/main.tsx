import React, { useMemo, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { ActionPlan, Dashboard, DashboardItem } from '../../types';
import { buildControlExecutiveReport } from '../../utils/controlExecutiveReport';
import { formatControlReportPeriod, formatControlReportStatus } from '../../utils/controlExecutiveReportDocumentModel';
import { ControlReportExport } from '../../components/operational/ControlReportExport';
import type { TrackingPeriod } from '../../utils/trackingObligation';

type Scenario = 'breve' | 'excepciones' | 'homonimos' | 'sin-meta' | 'sin-captura' | 'actividades' | 'semanal' | 'extenso';
const month: TrackingPeriod = { frequency: 'monthly', year: 2026, monthIndex: 8 };
const week: TrackingPeriod = { frequency: 'weekly', year: 2026, weekNumber: 39 };
const localOnly = ['localhost', '127.0.0.1'].includes(window.location.hostname);
const monthlyValues = (amount: number | null) => Array.from({ length: 12 }, (_, index) => index === 8 ? amount : null);
const weeklyValues = (amount: number | null) => Array.from({ length: 53 }, (_, index) => index === 38 ? amount : null);

const kpi = (id: string, indicator: string, goal: number | null, progress: number | null, frequency: 'monthly' | 'weekly' = 'monthly'): DashboardItem => ({
  id, indicator, weight: 1, frequency, unit: 'unidades', type: 'accumulative', goalType: 'maximize',
  trackingStartPeriod: frequency === 'monthly' ? { frequency, year: 2026, monthIndex: 0 } : { frequency, year: 2026, weekNumber: 1 },
  monthlyGoals: frequency === 'monthly' ? monthlyValues(goal) : monthlyValues(null), monthlyProgress: frequency === 'monthly' ? monthlyValues(progress) : monthlyValues(null),
  monthlyGoalCaptured: Array.from({ length: 12 }, (_, index) => index === 8 && goal !== null),
  monthlyProgressCaptured: Array.from({ length: 12 }, (_, index) => index === 8 && progress !== null),
  weeklyGoals: frequency === 'weekly' ? weeklyValues(goal) : undefined, weeklyProgress: frequency === 'weekly' ? weeklyValues(progress) : undefined,
  responsible: 'Ana Núñez',
});
const board = (id: string, title: string, items: DashboardItem[], frequency: 'monthly' | 'weekly' = 'monthly'): Dashboard => ({
  id, clientId: 'LAB-DOCUMENTAL', title, subtitle: 'Datos ficticios', area: 'OPERACIONES', periodicity: frequency, year: 2026,
  thresholds: { onTrack: 95, atRisk: 85 }, items,
});
const plan = (dashboardId: string, indicatorId: string): ActionPlan => ({ id: 'plan-ficticio', clientId: 'LAB-DOCUMENTAL', dashboardId, indicatorId, title: 'Plan de recuperación de señalización', responsible: 'José Muñoz', originYear: 2026, originPeriodType: 'monthly', status: 'in_progress', startDate: '2026-09-01', targetDate: '2026-10-15', progress: 50, createdAt: '', updatedAt: '' });

export const createFixture = (scenario: Scenario): { dashboards: Dashboard[]; period: TrackingPeriod; plans: ActionPlan[] } => {
  const sample = kpi('kpi-1', 'Índice de atención y señalización', 100, 82);
  if (scenario === 'breve') return { dashboards: [board('norte', 'Tablero Norte', [sample])], period: month, plans: [] };
  if (scenario === 'homonimos') return { dashboards: [board('norte', 'Tablero Norte', [sample]), board('sur', 'Tablero Sur', [kpi('kpi-1', sample.indicator, 150, 45)])], period: month, plans: [] };
  if (scenario === 'sin-meta') return { dashboards: [board('norte', 'Tablero Norte', [kpi('sin-meta', 'Cobertura de niños y niñas', null, null)])], period: month, plans: [] };
  if (scenario === 'sin-captura') return { dashboards: [board('norte', 'Tablero Norte', [kpi('sin-captura', 'Atención en área clínica', 100, null)])], period: month, plans: [] };
  if (scenario === 'semanal') return { dashboards: [board('semanal', 'Tablero Semanal', [kpi('semana-1', 'Inspecciones de seguridad', 10, 6, 'weekly')], 'weekly')], period: week, plans: [] };
  if (scenario === 'actividades') {
    sample.isActivityMode = true;
    sample.activityConfig = { 8: [{ id: 'actividad-1', label: 'Revisar señalización', targetCount: 6, completedCount: 4 }, { id: 'actividad-2', label: 'Capacitar personal', targetCount: 4, completedCount: 4 }] };
    return { dashboards: [board('norte', 'Tablero Norte', [sample])], period: month, plans: [plan('norte', 'kpi-1')] };
  }
  if (scenario === 'extenso') return { dashboards: [board('norte', 'Tablero Norte', Array.from({ length: 100 }, (_, index) => kpi(`kpi-${index + 1}`, `Indicador ficticio ${index + 1}`, 100 + index, index % 3 === 0 ? 0 : 80)))], period: month, plans: [] };
  return { dashboards: [board('norte', 'Tablero Norte', [sample, kpi('sin-meta', 'Meta sin configurar', null, null), kpi('sin-captura', 'Captura ausente', 100, null), kpi('cero', 'Cero registrado', 100, 0)])], period: month, plans: [plan('norte', 'kpi-1')] };
};

export const ControlReportsLab = () => {
  const [scenario, setScenario] = useState<Scenario>('excepciones');
  const fixture = useMemo(() => createFixture(scenario), [scenario]);
  const report = useMemo(() => buildControlExecutiveReport({ scope: { clientId: 'LAB-DOCUMENTAL', clientName: 'Cliente Ñandú Ficticio', period: fixture.period, operationalPeriod: fixture.period, authorizedDashboardIds: fixture.dashboards.map(item => item.id), filters: {}, filterLabels: [] }, dashboards: fixture.dashboards, actionPlans: fixture.plans, generatedAt: '2026-09-25T12:00:00.000Z', generatedBy: 'Laboratorio local' }), [fixture]);
  if (!localOnly) return <main className="min-h-screen bg-slate-950 p-8 text-white">Laboratorio disponible únicamente en localhost.</main>;
  return <main className="min-h-screen bg-slate-950 p-6 text-slate-100"><div className="mx-auto max-w-5xl space-y-5">
    <header className="rounded-xl border border-cyan-500/30 bg-slate-900 p-5"><p className="text-xs font-bold uppercase tracking-widest text-cyan-300">Laboratorio documental aislado</p><h1 className="mt-1 text-2xl font-black">Informe ejecutivo de CONTROL</h1><p className="mt-2 text-sm text-slate-300">Todos los nombres, cifras, actividades y planes son ficticios. Cliente Ñandú Ficticio.</p></header>
    <section className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-slate-900 p-4"><label className="text-sm font-bold">Caso <select aria-label="Caso documental" value={scenario} onChange={event => setScenario(event.target.value as Scenario)} className="ml-2 rounded border border-slate-600 bg-slate-950 p-2"><option value="breve">Informe breve</option><option value="excepciones">Varias excepciones</option><option value="homonimos">KPI homónimos</option><option value="sin-meta">Sin meta</option><option value="sin-captura">Sin captura</option><option value="actividades">Actividades y planes</option><option value="semanal">Período semanal</option><option value="extenso">Informe extenso</option></select></label><ControlReportExport clientId="LAB-DOCUMENTAL" clientName="Cliente Ñandú Ficticio" dashboards={fixture.dashboards} period={fixture.period} filters={{}} filterLabels={[]} loadActionPlans={async () => fixture.plans} /></section>
    <section className="rounded-xl border border-white/10 bg-slate-900 p-4"><h2 className="text-lg font-bold">Contenido del caso</h2><p className="mt-2 text-sm text-slate-300">Período: {formatControlReportPeriod(fixture.period)} · {report.results.length} indicadores · {report.detail.reduce((sum, group) => sum + group.items.length, 0)} excepciones · {report.followUp.relatedPlans.length} planes.</p><div className="mt-4 overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr className="border-b border-white/20 text-cyan-300"><th className="p-2">Tablero</th><th className="p-2">KPI</th><th className="p-2">Meta</th><th className="p-2">Realizado</th><th className="p-2">Pendiente</th><th className="p-2">Estado</th></tr></thead><tbody>{report.results.map(item => <tr key={`${item.identity.dashboardId}:${item.identity.indicatorId}`} className="border-b border-white/5"><td className="p-2">{item.dashboard}</td><td className="p-2">{item.indicator}</td><td className="p-2">{item.goal ?? 'No disponible'}</td><td className="p-2">{item.progress ?? 'No disponible'}</td><td className="p-2">{item.pending ?? 'No disponible'}</td><td className="p-2">{formatControlReportStatus(item.status)}</td></tr>)}</tbody></table></div></section>
  </div></main>;
};

const root = document.getElementById('root');
const labWindow = window as Window & { __controlReportsRoot?: Root };
if (root) {
  labWindow.__controlReportsRoot ||= createRoot(root);
  labWindow.__controlReportsRoot.render(<ControlReportsLab />);
}
