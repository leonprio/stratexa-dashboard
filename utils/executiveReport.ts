import type { ComplianceThresholds, Dashboard, DashboardItem } from '../types';
import { calculateCompliance } from './compliance';
import type { OperationalAlert } from './operationalAlerts';

export type ExecutiveStatus = 'CRÍTICO' | 'ATENCIÓN' | 'BAJO CONTROL' | 'DATOS PENDIENTES' | 'NO EVALUABLE';
export type ExecutiveReportViewModel = {
  status: { globalScore: number; capture: number; condition: ExecutiveStatus; counts: Record<ExecutiveStatus, number> };
  changes: { improved: number; deteriorated: number; stable: number; currentPeriod: number; priorPeriod: number | null };
  decisionFocus: Array<{ indicator: string; condition: string; gap: number; trend: string; hasActivePlan: boolean; decision: string }>;
  contextActions: { activePlans: number; relevantAlerts: number; pendingData: number };
};

const statusOf = (item: DashboardItem, thresholds: ComplianceThresholds, year: number, context: DashboardItem[]): ExecutiveStatus => {
  const reading = calculateCompliance(item, thresholds, year, 'realTime', context, context);
  if (!reading.isActive || reading.complianceStatus === 'Neutral') return 'NO EVALUABLE';
  if (reading.complianceStatus === 'OnTrack') return 'BAJO CONTROL';
  if (reading.complianceStatus === 'AtRisk') return 'ATENCIÓN';
  return 'CRÍTICO';
};

export const buildExecutiveReportViewModel = (items: DashboardItem[], dashboards: Dashboard[], thresholds: ComplianceThresholds, year: number, alerts: OperationalAlert[], activePlans: number, globalScore: number, capture: number): ExecutiveReportViewModel => {
  const counts: Record<ExecutiveStatus, number> = { 'CRÍTICO': 0, 'ATENCIÓN': 0, 'BAJO CONTROL': 0, 'DATOS PENDIENTES': 0, 'NO EVALUABLE': 0 };
  items.forEach(item => { counts[statusOf(item, thresholds, year, items)] += 1; });
  const current = dashboards.length ? Math.round(dashboards.reduce((sum, dashboard) => sum + (dashboard.items || []).length, 0)) : 0;
  const decisionFocus = [...alerts].sort((a, b) => (b.isOvertRisk ? 1 : 0) - (a.isOvertRisk ? 1 : 0) || a.performanceScore - b.performanceScore || b.stalenessDays - a.stalenessDays).slice(0, 5).map(alert => ({
    indicator: alert.indicator,
    condition: alert.severity,
    gap: Math.max(0, Math.round(100 - alert.performanceScore)),
    trend: alert.trend,
    hasActivePlan: activePlans > 0,
    decision: alert.dataStatus === 'SIN DATOS' ? 'Solicitar captura' : alert.performanceScore < 70 ? 'Definir recuperación' : 'Revisar causa y seguimiento',
  }));
  return { status: { globalScore, capture, condition: counts['CRÍTICO'] ? 'CRÍTICO' : counts['ATENCIÓN'] ? 'ATENCIÓN' : 'BAJO CONTROL', counts }, changes: { improved: 0, deteriorated: alerts.filter(a => a.isDeteriorating).length, stable: Math.max(0, current - alerts.length), currentPeriod: year, priorPeriod: year - 1 }, decisionFocus, contextActions: { activePlans, relevantAlerts: alerts.length, pendingData: alerts.filter(a => a.dataStatus !== 'AL DÍA').length } };
};
