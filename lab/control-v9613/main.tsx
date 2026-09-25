import React, { useEffect, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ActivityManager, type Activity } from '../../components/ActivityManager';
import { OperationalAlertsCenter } from '../../components/operational/OperationalAlertsCenter';
import { PendingAlertsCenter } from '../../components/operational/PendingAlertsCenter';
import { buildOperationalAlerts } from '../../utils/operationalAlerts';
import { buildPendingItems, type PendingItem } from '../../utils/pendingAlerts';
import type { Dashboard, DashboardItem } from '../../types';
import { isValidControlTarget, type ControlNavigationTarget } from '../../utils/controlNavigation';

const periodIndex = 8; // Septiembre 2026: coincide con el corte del laboratorio.
const months = (value: number | null = null) => Array(12).fill(value) as (number | null)[];
const captured = (active = false) => Array(12).fill(active);
const localOnly = ['localhost', '127.0.0.1'].includes(location.hostname);

const checklistKpi = (id: number, goal: number, progress: number): DashboardItem => ({
  id,
  indicator: 'Actividades de inclusión realizadas',
  weight: 100,
  frequency: 'monthly',
  trackingStartPeriod: { frequency: 'monthly', year: 2026, monthIndex: 0 },
  monthlyGoals: months(null).map((value, index) => index === periodIndex ? goal : value),
  monthlyProgress: months(null).map((value, index) => index === periodIndex ? progress : value),
  monthlyGoalCaptured: captured(false).map((value, index) => index === periodIndex),
  monthlyProgressCaptured: captured(false).map((value, index) => index === periodIndex),
  unit: 'actividades', type: 'accumulative', goalType: 'maximize', indicatorType: 'simple', isActivityMode: true,
  activityConfig: { [periodIndex]: [{ id: `a-${id}`, label: 'Actividad de prueba A', targetCount: goal - 2, completedCount: Math.max(0, progress - 1) }, { id: `b-${id}`, label: 'Actividad de prueba B', targetCount: 2, completedCount: Math.min(1, progress) }] },
});

const unconfiguredKpi = (): DashboardItem => ({
  id: 401, indicator: 'Actividades de inclusión realizadas', weight: 100, frequency: 'monthly',
  trackingStartPeriod: { frequency: 'monthly', year: 2026, monthIndex: 0 }, monthlyGoals: months(), monthlyProgress: months(),
  monthlyGoalCaptured: captured(false), monthlyProgressCaptured: captured(false), unit: 'actividades', type: 'accumulative', goalType: 'maximize', indicatorType: 'simple', isActivityMode: true,
});

const captureKpi = (): DashboardItem => ({
  id: 501, indicator: 'Evidencias de capacitación', weight: 100, frequency: 'monthly',
  trackingStartPeriod: { frequency: 'monthly', year: 2026, monthIndex: 0 },
  monthlyGoals: months(null).map((value, index) => index === periodIndex ? 12 : value), monthlyProgress: months(),
  monthlyGoalCaptured: captured(false).map((value, index) => index === periodIndex), monthlyProgressCaptured: captured(false),
  unit: 'evidencias', type: 'accumulative', goalType: 'maximize', indicatorType: 'simple', isActivityMode: false,
});

const weeklyKpi = (): DashboardItem => ({
  id: 1021, indicator: 'Actividades de inclusión realizadas', weight: 100, frequency: 'weekly',
  trackingStartPeriod: { frequency: 'weekly', year: 2026, weekNumber: 1 },
  monthlyGoals: months(), monthlyProgress: months(),
  weeklyGoals: Array(53).fill(null).map((value, index) => index === 38 ? 7 : value),
  weeklyProgress: Array(53).fill(null).map((value, index) => index === 38 ? 2 : value),
  unit: 'actividades', type: 'accumulative', goalType: 'maximize', indicatorType: 'simple', isActivityMode: false,
});

const initialDashboards: Dashboard[] = [
  { id: 101, clientId: 'LAB-A', title: 'TABLERO INCLUSIÓN · NORTE', subtitle: 'Cliente ficticio · Laboratorio', area: 'Norte', periodicity: 'monthly', thresholds: { onTrack: 95, atRisk: 85 }, items: [checklistKpi(1011, 10, 3)] },
  { id: 102, clientId: 'LAB-A', title: 'TABLERO INCLUSIÓN · CENTRO', subtitle: 'Cliente ficticio · Laboratorio', area: 'Centro', periodicity: 'monthly', thresholds: { onTrack: 95, atRisk: 85 }, items: [checklistKpi(1021, 8, 2)] },
  { id: 103, clientId: 'LAB-A', title: 'TABLERO INCLUSIÓN · SUR', subtitle: 'Cliente ficticio · Laboratorio', area: 'Sur', periodicity: 'monthly', thresholds: { onTrack: 95, atRisk: 85 }, items: [checklistKpi(1031, 6, 1)] },
  { id: 104, clientId: 'LAB-A', title: 'TABLERO CONFIGURACIÓN · PRUEBA', subtitle: 'Cliente ficticio · Laboratorio', area: 'Configuración', periodicity: 'monthly', thresholds: { onTrack: 95, atRisk: 85 }, items: [unconfiguredKpi()] },
  { id: 105, clientId: 'LAB-A', title: 'TABLERO CAPTURA · PRUEBA', subtitle: 'Cliente ficticio · Laboratorio', area: 'Captura', periodicity: 'monthly', thresholds: { onTrack: 95, atRisk: 85 }, items: [captureKpi()] },
  { id: 201, clientId: 'LAB-B', title: 'TABLERO INCLUSIÓN · ORIENTE', subtitle: 'Cliente ficticio B · Laboratorio', area: 'Oriente', periodicity: 'monthly', thresholds: { onTrack: 95, atRisk: 85 }, items: [checklistKpi(1011, 9, 2)] },
  { id: 202, clientId: 'LAB-B', title: 'TABLERO INCLUSIÓN · SEMANAL', subtitle: 'Cliente ficticio B · Laboratorio', area: 'Semanal', periodicity: 'weekly', thresholds: { onTrack: 95, atRisk: 85 }, items: [weeklyKpi()] },
];

const storageKey = 'tablero-control-v9613-synthetic-only';
const loadDashboards = (): Dashboard[] => {
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      const parsed: unknown = JSON.parse(saved);
      if (Array.isArray(parsed)) return initialDashboards.map(initial => {
        const existing = (parsed as Dashboard[]).find(candidate => candidate?.id === initial.id && candidate.items?.[0]?.id === initial.items[0].id);
        return existing ? { ...initial, ...existing, clientId: initial.clientId } : initial;
      });
    }
  } catch { /* An unavailable or malformed local store leaves fixtures usable. */ }
  return initialDashboards;
};
type LabNavigation = ControlNavigationTarget & { action: string; category: PendingItem['category'] };

const resolveLabNavigation = (dashboards: Dashboard[], target: ControlNavigationTarget): LabNavigation | null => {
  if (!isValidControlTarget(target, dashboards, 2026)) return null;
  const periodDashboards = dashboards.filter(candidate => (candidate.periodicity || 'monthly') === target.period.frequency);
  const pendingActions = buildPendingItems(periodDashboards, target.period, target.period, periodDashboards.map(candidate => candidate.id));
  const pending = pendingActions.find(candidate => String(candidate.dashboardId) === String(target.dashboardId) && String(candidate.indicatorId) === String(target.itemId));
  return {
    ...target,
    action: pending?.actionLabel || 'REVISAR KPI',
    category: pending?.category || 'RESULTADO',
  };
};

export function ControlVisualLab() {
  const [dashboards, setDashboards] = useState<Dashboard[]>(loadDashboards);
  const [clientId, setClientId] = useState('LAB-A');
  const [navigation, setNavigation] = useState<LabNavigation | null>(null);
  const clientDashboards = dashboards.filter(dashboard => dashboard.clientId === clientId);
  useEffect(() => {
    if (localOnly) {
      try { localStorage.setItem(storageKey, JSON.stringify(dashboards)); } catch { /* In-memory mode remains available. */ }
    }
  }, [dashboards]);
  if (!localOnly) return <main className="min-h-screen bg-slate-950 p-6 text-slate-100"><h1 className="text-xl font-black">Laboratorio detenido</h1><p className="mt-2 text-slate-400">Disponible únicamente en localhost.</p></main>;
  return <main className="min-h-screen bg-slate-950 p-4 text-slate-100 sm:p-6"><div className="mx-auto max-w-[1440px]">
    <header className="mb-5 rounded-xl border border-cyan-500/30 bg-slate-900/70 p-4"><p className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300">Laboratorio local aislado · v9.6.13</p><h1 className="mt-1 text-xl font-black">CONTROL · Aceptación funcional</h1><p className="mt-2 text-sm text-slate-400">Cliente: {clientId} · Datos sintéticos en memoria · Sin Firebase · Corte: septiembre 2026.</p><label className="mt-3 block text-xs font-bold text-slate-300">Cliente ficticio<select aria-label="Cliente ficticio" className="ml-3 rounded border border-slate-600 bg-slate-950 p-2" value={clientId} onChange={event => { setNavigation(null); setClientId(event.target.value); }}><option value="LAB-A">LAB-A</option><option value="LAB-B">LAB-B</option></select></label></header>
    {navigation && <LabKpiDestination key={`${navigation.clientId}:${navigation.dashboardId}:${navigation.itemId}:${navigation.action}`} dashboards={clientDashboards} navigation={navigation} onBack={() => setNavigation(null)} onUpdate={(updated) => setDashboards(current => current.map(dashboard => dashboard.clientId === navigation.clientId && String(dashboard.id) === String(navigation.dashboardId) ? { ...dashboard, items: dashboard.items.map(item => String(item.id) === String(navigation.itemId) ? updated : item) } : dashboard))} />}
    <div hidden={Boolean(navigation)} key={clientId}><ControlOfflineSurface dashboards={clientDashboards} onNavigateToKpi={(target) => { if (target.clientId === clientId) setNavigation(resolveLabNavigation(clientDashboards, target)); }} /></div>
  </div></main>;
}

function LabKpiDestination({ dashboards, navigation, onBack, onUpdate }: { dashboards: Dashboard[]; navigation: LabNavigation; onBack: () => void; onUpdate: (item: DashboardItem) => void }) {
  const dashboard = dashboards.find(candidate => String(candidate.id) === String(navigation.dashboardId));
  const item = dashboard?.items.find(candidate => String(candidate.id) === String(navigation.itemId));
  const [input, setInput] = useState('');
  const [saved, setSaved] = useState(false);
  const [activitiesOpen, setActivitiesOpen] = useState(false);
  if (!dashboard || !item) return <section role="alert">Destino no disponible. <button type="button" onClick={onBack}>VOLVER A CONTROL</button></section>;
  const selectedPeriodIndex = navigation.period.frequency === 'monthly' ? navigation.period.monthIndex : navigation.period.weekNumber - 1;
  const selectedPeriodLabel = navigation.period.frequency === 'monthly'
    ? `${new Intl.DateTimeFormat('es-MX', { month: 'long' }).format(new Date(navigation.period.year, selectedPeriodIndex, 1)).replace(/^./, letter => letter.toUpperCase())} ${navigation.period.year}`
    : `Semana ${navigation.period.weekNumber} ${navigation.period.year}`;
  const activities = item.activityConfig?.[selectedPeriodIndex] || [];
  const goal = activities.length ? activities.reduce((sum, activity) => sum + activity.targetCount, 0) : navigation.period.frequency === 'monthly' ? item.monthlyGoals[selectedPeriodIndex] : item.weeklyGoals?.[selectedPeriodIndex];
  const progress = activities.length ? activities.reduce((sum, activity) => sum + activity.completedCount, 0) : navigation.period.frequency === 'monthly' ? item.monthlyProgress[selectedPeriodIndex] : item.weeklyProgress?.[selectedPeriodIndex];
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const value = Number(input);
    if (!Number.isFinite(value) || value < 0 || input.trim() === '') return;
    if (navigation.category === 'CONFIGURACIÓN') {
      if (navigation.period.frequency === 'monthly') {
        const monthlyGoals = [...item.monthlyGoals]; monthlyGoals[selectedPeriodIndex] = value;
        const monthlyGoalCaptured = [...(item.monthlyGoalCaptured || captured(false))]; monthlyGoalCaptured[selectedPeriodIndex] = true;
        onUpdate({ ...item, monthlyGoals, monthlyGoalCaptured });
      } else {
        const weeklyGoals = [...(item.weeklyGoals || Array(53).fill(null))]; weeklyGoals[selectedPeriodIndex] = value;
        onUpdate({ ...item, weeklyGoals });
      }
    } else if (navigation.category === 'CAPTURA') {
      if (navigation.period.frequency === 'monthly') {
        const monthlyProgress = [...item.monthlyProgress]; monthlyProgress[selectedPeriodIndex] = value;
        const monthlyProgressCaptured = [...(item.monthlyProgressCaptured || captured(false))]; monthlyProgressCaptured[selectedPeriodIndex] = true;
        onUpdate({ ...item, monthlyProgress, monthlyProgressCaptured });
      } else {
        const weeklyProgress = [...(item.weeklyProgress || Array(53).fill(null))]; weeklyProgress[selectedPeriodIndex] = value;
        onUpdate({ ...item, weeklyProgress });
      }
    }
    setSaved(true);
  };
  const saveActivities = (updatedActivities: Activity[]) => {
    const monthlyGoals = [...item.monthlyGoals];
    const monthlyProgress = [...item.monthlyProgress];
    const monthlyGoalCaptured = [...(item.monthlyGoalCaptured || captured(false))];
    const monthlyProgressCaptured = [...(item.monthlyProgressCaptured || captured(false))];
    monthlyGoals[selectedPeriodIndex] = updatedActivities.reduce((sum, activity) => sum + activity.targetCount, 0);
    monthlyProgress[selectedPeriodIndex] = updatedActivities.reduce((sum, activity) => sum + activity.completedCount, 0);
    monthlyGoalCaptured[selectedPeriodIndex] = true;
    monthlyProgressCaptured[selectedPeriodIndex] = true;
    onUpdate({ ...item, activityConfig: { ...item.activityConfig, [selectedPeriodIndex]: updatedActivities }, monthlyGoals, monthlyProgress, monthlyGoalCaptured, monthlyProgressCaptured });
    setActivitiesOpen(false);
    setSaved(true);
  };
  return <><section aria-label="Vista funcional del KPI" className="rounded-xl border border-cyan-500/20 bg-slate-900/70 p-5 text-slate-100">
    <button type="button" onClick={onBack} className="mb-5 min-h-[44px] rounded-lg border border-cyan-500/40 px-4 text-xs font-black text-cyan-200">← VOLVER A CONTROL</button>
    <p className="text-[10px] font-black uppercase tracking-widest text-cyan-300">{navigation.action} · {navigation.category}</p>
    <h2 className="mt-2 text-xl font-black">{item.indicator}</h2>
    <p className="mt-2 text-sm text-slate-300">Cliente: {navigation.clientId} · Tablero: {dashboard.title}</p>
    <p className="mt-1 text-sm text-slate-300">KPI ID: {item.id} · Período: {selectedPeriodLabel}</p>
    <div className="mt-5 grid gap-3 sm:grid-cols-3"><p className="rounded-lg bg-slate-950 p-3 text-sm">Meta: {goal ?? 'Sin meta definida'}</p><p className="rounded-lg bg-slate-950 p-3 text-sm">Realizado: {progress ?? '—'}</p><p className="rounded-lg bg-slate-950 p-3 text-sm">Pendiente: {goal === null || progress === null ? '—' : Math.max(0, goal - progress)}</p></div>
    {navigation.category === 'RESULTADO' && activities.length > 0 && <section className="mt-5"><h3 className="text-sm font-black">Actividades del checklist</h3><ul className="mt-2 space-y-1 text-sm text-slate-300">{activities.map(activity => <li key={activity.id}>{activity.label}: {activity.completedCount} de {activity.targetCount}</li>)}</ul><button type="button" onClick={() => setActivitiesOpen(true)} className="mt-4 min-h-[44px] rounded-lg bg-indigo-600 px-4 text-xs font-black text-white">GESTIÓN DETALLADA DE ACTIVIDADES</button></section>}
    {navigation.category === 'RESULTADO' && activities.length === 0 && <p className="mt-5 text-sm text-slate-300">Seguimiento operativo del KPI sin lista de actividades para este período.</p>}
    {saved && navigation.category === 'RESULTADO' && <p role="status" className="mt-4 text-sm text-emerald-300">Checklist ficticio guardado sólo en el laboratorio local.</p>}
    {navigation.category !== 'RESULTADO' && <form onSubmit={submit} className="mt-5 flex max-w-md flex-col gap-3"><label className="text-sm font-bold">{navigation.category === 'CONFIGURACIÓN' ? 'Meta' : 'Avance'} de {selectedPeriodLabel}<input type="number" min="0" step="1" required value={input} onChange={event => setInput(event.target.value)} className="mt-2 block w-full rounded-lg border border-slate-600 bg-slate-950 p-3 text-white" /></label><button type="submit" className="min-h-[44px] rounded-lg bg-cyan-600 px-4 text-xs font-black text-white">APLICAR EN MEMORIA LOCAL</button>{saved && <p role="status" className="text-sm text-emerald-300">Dato ficticio aplicado sólo en memoria. Puedes volver a CONTROL.</p>}</form>}
  </section>{activitiesOpen && <ActivityManager title={item.indicator} subtitle={dashboard.title} periodLabel={selectedPeriodLabel} initialActivities={activities} goalType={item.goalType} canEdit onClose={() => setActivitiesOpen(false)} onSave={saveActivities} />}</>;
}

function ControlOfflineSurface({ dashboards, onNavigateToKpi }: { dashboards: Dashboard[]; onNavigateToKpi: (target: ControlNavigationTarget) => void }) {
  const thresholds = { onTrack: 95, atRisk: 85 };
  const alerts = buildOperationalAlerts(dashboards, thresholds, 2026);
  const critical = alerts.filter(alert => alert.severity === 'CRÍTICO').length;
  const attention = alerts.filter(alert => alert.severity === 'REQUIERE ATENCIÓN').length;
  const data = alerts.filter(alert => alert.severity === 'DATOS PENDIENTES' || alert.severity === 'RIESGO OCULTO').length;
  return <div className="space-y-4 animate-in fade-in duration-500">
    <header><p className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-400">Control</p><h2 className="mt-1 text-2xl font-black tracking-tight text-white">Gestión por excepción</h2><p className="mt-1 text-sm text-slate-400">Qué requiere atención y qué estamos haciendo al respecto.</p></header>
    <section aria-label="Resumen de control" className="flex flex-wrap items-center gap-2 rounded-xl border border-white/5 bg-slate-900/40 px-3 py-2"><Chip label="Vencidos" value={0} tone="text-amber-400" /><Chip label="Críticos" value={critical} tone="text-rose-400" /><Chip label="Atención" value={attention} tone="text-orange-400" /><Chip label="Datos pendientes" value={data} tone="text-violet-400" /></section>
    <PendingAlertsCenter dashboards={dashboards} year={2026} authorizedDashboardIds={dashboards.map(dashboard => dashboard.id)} clientId={dashboards[0]?.clientId} onNavigateToKpi={onNavigateToKpi} />
    <OperationalAlertsCenter dashboards={dashboards} globalThresholds={thresholds} year={2026} clientId={dashboards[0]?.clientId} compact onNavigateToKpi={onNavigateToKpi} />
  </div>;
}

const Chip = ({ label, value, tone }: { label: string; value: number; tone: string }) => <div className="flex items-baseline gap-1.5 rounded-lg border border-white/5 bg-slate-950/40 px-3 py-1.5"><span className="text-[9px] font-black uppercase tracking-widest text-slate-500">{label}</span><span className={`text-base font-black tabular-nums ${tone}`}>{value}</span></div>;

const root = document.getElementById('root');
const labWindow = window as Window & { __controlV9613Root?: Root };
if (root) {
  labWindow.__controlV9613Root ||= createRoot(root);
  labWindow.__controlV9613Root.render(<ControlVisualLab />);
}
