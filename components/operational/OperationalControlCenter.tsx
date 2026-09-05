import React, { useMemo, useState } from 'react';
import { Dashboard, ComplianceThresholds } from '../../types';
import { buildOperationalAlerts } from '../../utils/operationalAlerts';
import { OperationalAlertsCenter } from './OperationalAlertsCenter';
import { OperationalHistoryCenter } from './OperationalHistoryCenter';
import { TransversalActionPlansControl } from './TransversalActionPlansControl';
import type { ActionPlanControlSummary } from './TransversalActionPlansControl';

interface OperationalControlCenterProps { dashboards: Dashboard[]; currentDashboard: Dashboard; globalThresholds: ComplianceThresholds; year: number; onNavigateToKpi?: (dashboardId: number | string, itemId: number | string) => void; onNavigateToPlan?: (target: { actionPlanId: number | string; dashboardId: number | string; itemId: number | string; clientId?: string; year: number }) => void; }

export const selectControlDashboards = (dashboards: Dashboard[], currentDashboard: Dashboard): Dashboard[] => {
  const physicalDashboards = dashboards.filter(d =>
    d.isAggregate !== true && d.id !== -1 && !String(d.id).startsWith('agg-'),
  );

  // Control es client-wide: la navegación solo define el contexto de entrada,
  // no el universo operativo que debe auditarse.
  return physicalDashboards.length > 0 ? physicalDashboards : [currentDashboard];
};

export const OperationalControlCenter: React.FC<OperationalControlCenterProps> = ({ dashboards, currentDashboard, globalThresholds, year, onNavigateToKpi, onNavigateToPlan }) => {
  const [historyVisible, setHistoryVisible] = useState(false);
  const [planSummary, setPlanSummary] = useState<ActionPlanControlSummary>({ active: 0, overdue: 0 });
  const relevantDashboards = useMemo(() => selectControlDashboards(dashboards, currentDashboard), [dashboards, currentDashboard]);
  const alerts = useMemo(() => buildOperationalAlerts(relevantDashboards, globalThresholds, year), [relevantDashboards, globalThresholds, year]);
  const criticalAlerts = alerts.filter(alert => alert.severity === 'CRÍTICO');
  const attentionAlerts = alerts.filter(alert => alert.severity === 'REQUIERE ATENCIÓN');
  const dataAlerts = alerts.filter(alert => alert.severity === 'DATOS PENDIENTES' || alert.severity === 'RIESGO OCULTO');

  return <div className="space-y-4 animate-in fade-in duration-500">
    <header><p className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-400">Control</p><h2 className="mt-1 text-2xl font-black tracking-tight text-white">Gestión por excepción</h2><p className="mt-1 text-sm text-slate-400">Qué requiere atención y qué estamos haciendo al respecto.</p></header>
    <section aria-label="Resumen de control" className="flex flex-wrap items-center gap-2 rounded-xl border border-white/5 bg-slate-900/40 px-3 py-2"><SummaryChip label="Vencidos" value={planSummary.overdue} tone="text-amber-400" /><SummaryChip label="Críticos" value={criticalAlerts.length} tone="text-rose-400" /><SummaryChip label="Atención" value={attentionAlerts.length} tone="text-orange-400" /><SummaryChip label="Datos pendientes" value={dataAlerts.length} tone="text-violet-400" /></section>
    <OperationalAlertsCenter dashboards={relevantDashboards} globalThresholds={globalThresholds} year={year} compact onNavigateToKpi={onNavigateToKpi} />
    <section aria-label="Planes de acción" className="rounded-xl border border-white/5 bg-slate-900/30 px-3 py-3"><TransversalActionPlansControl dashboards={relevantDashboards} currentDashboard={currentDashboard} onSummaryChange={setPlanSummary} onNavigateToKpi={onNavigateToKpi} onNavigateToPlan={onNavigateToPlan} /></section>
    <section className="rounded-xl border border-white/5 bg-slate-900/20 px-3 py-2"><div className="flex items-center justify-between gap-3"><h2 className="text-[10px] font-black uppercase tracking-widest text-slate-300">Historial operativo</h2><button type="button" aria-expanded={historyVisible} onClick={() => setHistoryVisible(value => !value)} className="min-h-[36px] rounded-lg border border-white/10 px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:border-indigo-500/40 hover:text-white">{historyVisible ? 'Ocultar' : 'Ver historial'} {historyVisible ? '⌃' : '›'}</button></div>{historyVisible && <div className="mt-3"><OperationalHistoryCenter dashboards={relevantDashboards} globalThresholds={globalThresholds} year={year} /></div>}</section>
  </div>;
};

const SummaryChip = ({ label, value, tone }: { label: string; value: number; tone: string }) => <div className="flex items-baseline gap-1.5 rounded-lg border border-white/5 bg-slate-950/40 px-3 py-1.5"><span className="text-[9px] font-black uppercase tracking-widest text-slate-500">{label}</span><span className={`text-base font-black tabular-nums ${tone}`}>{value}</span></div>;
