import React, { useMemo, useState } from 'react';
import { Dashboard, ComplianceThresholds } from '../../types';
import { buildOperationalAlerts } from '../../utils/operationalAlerts';
import { OperationalAlertsCenter } from './OperationalAlertsCenter';
import { OperationalHistoryCenter } from './OperationalHistoryCenter';
import { TransversalActionPlansControl } from './TransversalActionPlansControl';
import type { ActionPlanControlSummary } from './TransversalActionPlansControl';

interface OperationalControlCenterProps { dashboards: Dashboard[]; currentDashboard: Dashboard; globalThresholds: ComplianceThresholds; year: number; }

export const selectControlDashboards = (dashboards: Dashboard[], currentDashboard: Dashboard): Dashboard[] => {
  const isAggregate = currentDashboard.isAggregate === true
    || currentDashboard.id === -1
    || String(currentDashboard.id).startsWith('agg-');

  return isAggregate && dashboards.length > 0 ? dashboards : [currentDashboard];
};

export const OperationalControlCenter: React.FC<OperationalControlCenterProps> = ({ dashboards, currentDashboard, globalThresholds, year }) => {
  const [historyVisible, setHistoryVisible] = useState(false);
  const [planSummary, setPlanSummary] = useState<ActionPlanControlSummary>({ active: 0, overdue: 0 });
  const relevantDashboards = useMemo(() => selectControlDashboards(dashboards, currentDashboard), [dashboards, currentDashboard]);
  const alerts = useMemo(() => buildOperationalAlerts(relevantDashboards, globalThresholds, year), [relevantDashboards, globalThresholds, year]);
  const attentionAlerts = alerts.filter(alert => alert.severity !== 'BAJO CONTROL' && alert.severity !== 'SIN OBLIGACIÓN');
  const delayedAlerts = alerts.filter(alert => alert.dataStatus === 'DATOS INCOMPLETOS' || alert.dataStatus === 'DATOS VENCIDOS' || alert.dataStatus === 'SIN DATOS');

  return <div className="space-y-8 animate-in fade-in duration-500">
    <header><p className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-400">Control</p><h2 className="mt-1 text-2xl font-black tracking-tight text-white">Gestión por excepción</h2><p className="mt-1 text-sm text-slate-400">Qué requiere atención y qué estamos haciendo al respecto.</p></header>
    <section aria-label="Resumen de control" className="grid grid-cols-1 gap-3 sm:grid-cols-3"><SummaryCard label="Críticos / requieren atención" value={attentionAlerts.filter(alert => alert.severity === 'CRÍTICO' || alert.severity === 'REQUIERE ATENCIÓN' || alert.severity === 'RIESGO OCULTO').length} tone="text-rose-400" /><SummaryCard label="Planes activos" value={planSummary.active} tone="text-cyan-400" /><SummaryCard label="Vencidos / datos pendientes" value={delayedAlerts.length + planSummary.overdue} tone="text-amber-400" /></section>
    <ControlSection title="Requiere atención" subtitle="Señales priorizadas por criticidad, deterioro y atraso."><OperationalAlertsCenter dashboards={relevantDashboards} globalThresholds={globalThresholds} year={year} compact /></ControlSection>
    <ControlSection title="Planes activos" subtitle="Acciones en curso para corregir las desviaciones."><TransversalActionPlansControl dashboards={relevantDashboards} currentDashboard={currentDashboard} onSummaryChange={setPlanSummary} /></ControlSection>
    <section className="rounded-2xl border border-white/5 bg-slate-900/30 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-sm font-black uppercase tracking-widest text-slate-200">Historial</h2><p className="mt-1 text-xs text-slate-500">Trazabilidad operativa secundaria.</p></div><button type="button" aria-expanded={historyVisible} onClick={() => setHistoryVisible(value => !value)} className="min-h-[44px] rounded-xl border border-white/10 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-300 hover:border-indigo-500/40 hover:text-white">{historyVisible ? 'Ocultar historial' : 'Ver historial operativo'}</button></div>{historyVisible && <div className="mt-5"><OperationalHistoryCenter dashboards={relevantDashboards} globalThresholds={globalThresholds} year={year} /></div>}</section>
  </div>;
};

const SummaryCard = ({ label, value, tone }: { label: string; value: number; tone: string }) => <div className="rounded-2xl border border-white/5 bg-slate-900/50 p-4"><p className="text-[9px] font-black uppercase tracking-widest text-slate-500">{label}</p><p className={`mt-1 text-3xl font-black tabular-nums ${tone}`}>{value}</p></div>;
const ControlSection = ({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) => <section className="space-y-4"><div><h2 className="text-sm font-black uppercase tracking-widest text-white">{title}</h2><p className="mt-1 text-xs text-slate-500">{subtitle}</p></div>{children}</section>;
