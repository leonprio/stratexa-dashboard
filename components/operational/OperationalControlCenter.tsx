import React, { useCallback, useMemo, useState } from 'react';
import { Dashboard, ComplianceThresholds, SystemSettings, User } from '../../types';
import { buildOperationalAlerts } from '../../utils/operationalAlerts';
import { OperationalAlertsCenter } from './OperationalAlertsCenter';
import { PendingAlertsCenter } from './PendingAlertsCenter';
import { OperationalHistoryCenter } from './OperationalHistoryCenter';
import { TransversalActionPlansControl } from './TransversalActionPlansControl';
import type { ActionPlanControlSummary } from './TransversalActionPlansControl';
import { currentControlPeriod, type ControlNavigationTarget } from '../../utils/controlNavigation';
import { ControlReportExport } from './ControlReportExport';
import { firebaseService } from '../../services/firebaseService';
import type { PendingCategory } from '../../utils/pendingAlerts';
import { canAccessDashboard } from '../../services/tableroAuthorization';
import { buildPendingItems } from '../../utils/pendingAlerts';
import type { ActionPlanControlNavigationTarget } from './TransversalActionPlansControl';

interface OperationalControlCenterProps { dashboards: Dashboard[]; currentDashboard: Dashboard; globalThresholds: ComplianceThresholds; year: number; activeClientId?: string; currentUser?: User; canEdit?: boolean; clientSettings?: Pick<SystemSettings, 'defaultTrackingStartPeriod'>; onNavigateToKpi?: (target: ControlNavigationTarget) => void; onNavigateToPlan?: (target: ActionPlanControlNavigationTarget) => void; }

export const selectControlDashboards = (dashboards: Dashboard[], currentDashboard: Dashboard, activeClientId?: string): Dashboard[] => {
  if (activeClientId === 'all' && !currentDashboard.clientId) return currentDashboard.isAggregate ? [] : [currentDashboard];
  const tenant = (activeClientId && activeClientId !== 'all' ? activeClientId : currentDashboard.clientId)?.trim().toUpperCase();
  const physicalDashboards = dashboards.filter(d =>
    d.isAggregate !== true && d.id !== -1 && !String(d.id).startsWith('agg-') &&
    (!tenant || (d.clientId || (activeClientId !== 'all' ? tenant : ''))?.trim().toUpperCase() === tenant),
  );

  // Control es client-wide: la navegación solo define el contexto de entrada,
  // no el universo operativo que debe auditarse.
  return physicalDashboards.length > 0 ? physicalDashboards : [currentDashboard];
};

import { ControlCutComparisonSection } from './ControlCutComparisonSection';

export const OperationalControlCenter: React.FC<OperationalControlCenterProps> = ({ dashboards, currentDashboard, globalThresholds, year, activeClientId, currentUser, canEdit = false, clientSettings, onNavigateToKpi, onNavigateToPlan }) => {
  const [historyVisible, setHistoryVisible] = useState(false);
  const [planSummary, setPlanSummary] = useState<ActionPlanControlSummary>({ active: 0, overdue: 0 });
  const [exportFrequency, setExportFrequency] = useState<'monthly' | 'weekly'>('monthly');
  const [pendingFilters, setPendingFilters] = useState<{ area: string; responsible: string; category: 'TODAS' | PendingCategory }>({ area: 'TODAS', responsible: 'TODOS', category: 'TODAS' });
  const relevantDashboards = useMemo(() => currentUser ? selectControlDashboards(dashboards, currentDashboard, activeClientId).filter(dashboard => canAccessDashboard(currentUser, dashboard)) : [], [dashboards, currentDashboard, activeClientId, currentUser]);
  const clientId = (activeClientId && activeClientId !== 'all' ? activeClientId : currentDashboard.clientId || '').trim();
  const reportDashboards = useMemo(() => relevantDashboards.filter(board => currentUser && canAccessDashboard(currentUser, board) && board.items.some(item => (item.frequency || board.periodicity || 'monthly') === exportFrequency)), [relevantDashboards, exportFrequency, currentUser]);
  const reportFilters = useMemo(() => ({ areas: pendingFilters.area === 'TODAS' ? undefined : [pendingFilters.area], responsibles: pendingFilters.responsible === 'TODOS' ? undefined : [pendingFilters.responsible] }), [pendingFilters.area, pendingFilters.responsible]);
  const reportPeriod = useMemo(() => currentControlPeriod(exportFrequency, year), [exportFrequency, year]);
  const scopedReportDashboards = useMemo(() => {
    if (pendingFilters.category === 'TODAS') return reportDashboards;
    const identities = new Set(buildPendingItems(reportDashboards, reportPeriod, reportPeriod, reportDashboards.map(board => board.id), clientSettings)
      .filter(item => item.category === pendingFilters.category && (pendingFilters.area === 'TODAS' || item.area === pendingFilters.area) && (pendingFilters.responsible === 'TODOS' || item.responsible === pendingFilters.responsible))
      .map(item => `${String(item.dashboardId)}:${String(item.indicatorId)}`));
    return reportDashboards.map(board => ({ ...board, items: board.items.filter(item => identities.has(`${String(board.id)}:${String(item.id)}`)) })).filter(board => board.items.length > 0);
  }, [reportDashboards, reportPeriod, pendingFilters, clientSettings]);
  const reportFilterLabels = useMemo(() => [pendingFilters.category === 'TODAS' ? '' : `Categoría: ${pendingFilters.category}`, pendingFilters.area === 'TODAS' ? '' : `Área: ${pendingFilters.area}`, pendingFilters.responsible === 'TODOS' ? '' : `Responsable: ${pendingFilters.responsible}`].filter(Boolean), [pendingFilters.category, pendingFilters.area, pendingFilters.responsible]);
  const loadReportPlans = useCallback(async (boards: Dashboard[]) => (await Promise.all(boards.map(board => firebaseService.getActiveActionPlansForDashboard(board.id, clientId)))).flat(), [clientId]);
  const navigateFromPlan = (dashboardId: number | string, itemId: number | string) => {
    const source = relevantDashboards.find(dashboard => String(dashboard.id) === String(dashboardId));
    const item = source?.items.find(candidate => String(candidate.id) === String(itemId));
    if (!source || !item) return;
    onNavigateToKpi?.({ clientId: source.clientId || currentDashboard.clientId || activeClientId || '', dashboardId: source.id, itemId: item.id, period: currentControlPeriod(item.frequency || source.periodicity || 'monthly', year), operation: 'GESTIONAR', origin: 'control' });
  };
  const alerts = useMemo(() => buildOperationalAlerts(relevantDashboards, globalThresholds, year), [relevantDashboards, globalThresholds, year]);
  const criticalAlerts = alerts.filter(alert => alert.severity === 'CRÍTICO');
  const attentionAlerts = alerts.filter(alert => alert.severity === 'REQUIERE ATENCIÓN');
  const dataAlerts = alerts.filter(alert => alert.severity === 'DATOS PENDIENTES' || alert.severity === 'RIESGO OCULTO');

  return <div className="space-y-4 animate-in fade-in duration-500">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-400">Control</p><h2 className="mt-1 text-2xl font-black tracking-tight text-white">Gestión por excepción</h2><p className="mt-1 text-sm text-slate-400">Qué requiere atención y qué estamos haciendo al respecto.</p></div><div className="flex flex-wrap items-center gap-2"><select aria-label="Período del informe" value={exportFrequency} onChange={event => setExportFrequency(event.target.value as 'monthly' | 'weekly')} className="min-h-[36px] rounded-lg border border-white/10 bg-slate-950 px-2 text-[10px] font-bold text-slate-200"><option value="monthly">Mensual</option><option value="weekly">Semanal</option></select><ControlReportExport clientId={clientId} clientName={clientId} dashboards={scopedReportDashboards} period={reportPeriod} filters={reportFilters} filterLabels={reportFilterLabels} clientSettings={clientSettings} loadActionPlans={loadReportPlans} /></div></header>
    <section aria-label="Resumen de control" className="flex flex-wrap items-center gap-2 rounded-xl border border-white/5 bg-slate-900/40 px-3 py-2"><SummaryChip label="Vencidos" value={planSummary.overdue} tone="text-amber-400" /><SummaryChip label="Críticos" value={criticalAlerts.length} tone="text-rose-400" /><SummaryChip label="Atención" value={attentionAlerts.length} tone="text-orange-400" /><SummaryChip label="Datos pendientes" value={dataAlerts.length} tone="text-violet-400" /></section>
    <PendingAlertsCenter dashboards={relevantDashboards} year={year} authorizedDashboardIds={relevantDashboards.map(dashboard => dashboard.id)} clientId={currentDashboard.clientId || activeClientId} clientSettings={clientSettings} onNavigateToKpi={onNavigateToKpi} onFiltersChange={setPendingFilters} />
    <OperationalAlertsCenter dashboards={relevantDashboards} globalThresholds={globalThresholds} year={year} clientId={currentDashboard.clientId || activeClientId} compact onNavigateToKpi={onNavigateToKpi} />
    {relevantDashboards.length > 0 && <section aria-label="Planes de acción" className="rounded-xl border border-white/5 bg-slate-900/30 px-3 py-3"><TransversalActionPlansControl dashboards={relevantDashboards} currentDashboard={currentDashboard} managementYear={year} currentUser={currentUser} canEdit={canEdit} onSummaryChange={setPlanSummary} onNavigateToKpi={navigateFromPlan} onNavigateToPlan={onNavigateToPlan} /></section>}
    <ControlCutComparisonSection dashboards={relevantDashboards} currentDashboard={currentDashboard} activeClientId={activeClientId} currentUser={currentUser} year={year} />
    <section className="rounded-xl border border-white/5 bg-slate-900/20 px-3 py-2"><div className="flex items-center justify-between gap-3"><h2 className="text-[10px] font-black uppercase tracking-widest text-slate-300">Historial operativo</h2><button type="button" aria-expanded={historyVisible} onClick={() => setHistoryVisible(value => !value)} className="min-h-[36px] rounded-lg border border-white/10 px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:border-indigo-500/40 hover:text-white">{historyVisible ? 'Ocultar' : 'Ver historial'} {historyVisible ? '⌃' : '›'}</button></div>{historyVisible && <div className="mt-3"><OperationalHistoryCenter dashboards={relevantDashboards} globalThresholds={globalThresholds} year={year} /></div>}</section>
  </div>;
};

const SummaryChip = ({ label, value, tone }: { label: string; value: number; tone: string }) => <div className="flex items-baseline gap-1.5 rounded-lg border border-white/5 bg-slate-950/40 px-3 py-1.5"><span className="text-[9px] font-black uppercase tracking-widest text-slate-500">{label}</span><span className={`text-base font-black tabular-nums ${tone}`}>{value}</span></div>;
