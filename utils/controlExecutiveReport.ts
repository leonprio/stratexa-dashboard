import type { ActionPlan, ComplianceStatus, Dashboard, DashboardItem, SystemSettings } from '../types';
import { calculateMonthlyCompliancePercentage, getStatusForPercentage } from './compliance';
import { readControlPeriodValues } from './controlValues';
import { buildPendingItems, type PendingCategory, type PendingType } from './pendingAlerts';
import type { TrackingPeriod } from './trackingObligation';

export type ControlExecutiveReportFormat = 'pdf' | 'docx';

export interface ControlReportFilters {
  dashboardIds?: Array<Dashboard['id']>;
  areas?: string[];
  responsibles?: string[];
  indicatorIds?: Array<DashboardItem['id']>;
}

export interface ControlReportScope {
  clientId: string;
  clientName: string;
  period: TrackingPeriod;
  operationalPeriod: TrackingPeriod;
  authorizedDashboardIds: Array<Dashboard['id']>;
  filters: ControlReportFilters;
  filterLabels: string[];
}

export interface ControlReportSource {
  scope: ControlReportScope;
  dashboards: Dashboard[];
  actionPlans?: ActionPlan[];
  clientSettings?: Pick<SystemSettings, 'defaultTrackingStartPeriod'>;
  generatedAt: string;
  generatedBy?: string;
  title?: string;
}

export interface ControlReportResultRow {
  identity: { clientId: string; dashboardId: Dashboard['id']; indicatorId: DashboardItem['id'] };
  dashboard: string;
  area: string;
  responsible: string;
  indicator: string;
  unit: string;
  period: TrackingPeriod;
  goal?: number;
  progress?: number;
  pending?: number;
  compliance?: number;
  status: ComplianceStatus | 'MISSING_CONFIGURATION' | 'MISSING_CAPTURE';
  attentionReason?: PendingType;
}

export interface ControlReportActivityRow {
  identity: ControlReportResultRow['identity'] & { activityId: string };
  label: string;
  target: number;
  completed: number;
  pending: number;
  status: 'PENDING' | 'COMPLETED';
}

export interface ControlReportPlanRow {
  id: string;
  dashboardId: Dashboard['id'];
  indicatorId: DashboardItem['id'];
  title: string;
  responsible: string;
  status: ActionPlan['status'];
  progress: number;
  targetDate?: string;
}

export interface ControlExecutiveReport {
  schemaVersion: '1.0';
  cover: { title: string; client: string; period: TrackingPeriod; generatedAt: string; generatedBy: string };
  scope: ControlReportScope & { includedDashboardIds: Array<Dashboard['id']>; includedIndicatorCount: number };
  executiveSummary: {
    totalIndicators: number;
    criticalIndicators: number;
    attentionIndicators: number;
    pendingConfiguration: number;
    pendingCapture: number;
  };
  results: ControlReportResultRow[];
  followUp: { pendingActivities: ControlReportActivityRow[]; completedActivities: ControlReportActivityRow[]; relatedPlans: ControlReportPlanRow[] };
  detail: Array<{ category: PendingCategory; items: ControlReportResultRow[] }>;
}

const normalize = (value: string | undefined) => (value || '').trim().toUpperCase();
const samePeriod = (left: TrackingPeriod, right: TrackingPeriod) => left.frequency === right.frequency && left.year === right.year &&
  (left.frequency === 'monthly' ? left.monthIndex === (right as Extract<TrackingPeriod, { frequency: 'monthly' }>).monthIndex : left.weekNumber === (right as Extract<TrackingPeriod, { frequency: 'weekly' }>).weekNumber);

const periodIndex = (period: TrackingPeriod) => period.frequency === 'monthly' ? period.monthIndex : period.weekNumber - 1;

/**
 * Pure boundary between authorized CONTROL data and future document renderers.
 * PDF and DOCX must consume this object without recalculating business values.
 */
export const buildControlExecutiveReport = (source: ControlReportSource): ControlExecutiveReport => {
  const clientId = normalize(source.scope.clientId);
  if (!clientId) throw new Error('El informe requiere un cliente activo.');
  if (!samePeriod(source.scope.period, source.scope.operationalPeriod)) throw new Error('El período solicitado no coincide con el período operativo autorizado.');

  const authorized = new Set(source.scope.authorizedDashboardIds.map(String));
  const filteredDashboardIds = source.scope.filters.dashboardIds?.length ? new Set(source.scope.filters.dashboardIds.map(String)) : undefined;
  const filteredIndicators = source.scope.filters.indicatorIds?.length ? new Set(source.scope.filters.indicatorIds.map(String)) : undefined;
  const filteredAreas = source.scope.filters.areas?.length ? new Set(source.scope.filters.areas.map(normalize)) : undefined;
  const filteredResponsibles = source.scope.filters.responsibles?.length ? new Set(source.scope.filters.responsibles.map(normalize)) : undefined;

  const dashboards = source.dashboards.filter(dashboard =>
    dashboard.isAggregate !== true && dashboard.id !== -1 && !String(dashboard.id).startsWith('agg-') &&
    normalize(dashboard.clientId) === clientId && authorized.has(String(dashboard.id)) &&
    (!filteredDashboardIds || filteredDashboardIds.has(String(dashboard.id))) &&
    (!filteredAreas || filteredAreas.has(normalize(dashboard.area))),
  ).map(dashboard => ({
    ...dashboard,
    items: (dashboard.items || []).filter(item =>
      (item.frequency || dashboard.periodicity || 'monthly') === source.scope.period.frequency &&
      (!filteredIndicators || filteredIndicators.has(String(item.id))) &&
      (!filteredResponsibles || filteredResponsibles.has(normalize(item.responsible))),
    ),
  })).filter(dashboard => dashboard.items.length > 0);

  const includedIds = dashboards.map(dashboard => dashboard.id);
  const pendingItems = buildPendingItems(dashboards, source.scope.period, source.scope.operationalPeriod, includedIds, source.clientSettings);
  const pendingByIdentity = new Map(pendingItems.map(item => [`${String(item.dashboardId)}:${String(item.indicatorId)}`, item]));

  const results: ControlReportResultRow[] = dashboards.flatMap(dashboard => dashboard.items.map(item => {
    const values = readControlPeriodValues(item, source.scope.period);
    const exception = pendingByIdentity.get(`${String(dashboard.id)}:${String(item.id)}`);
    const compliance = values.goal !== undefined && values.progress !== undefined
      ? calculateMonthlyCompliancePercentage(values.progress, values.goal, item.goalType === 'minimize')
      : undefined;
    const status: ControlReportResultRow['status'] = exception?.category === 'CONFIGURACIÓN' ? 'MISSING_CONFIGURATION'
      : exception?.category === 'CAPTURA' ? 'MISSING_CAPTURE'
      : compliance === undefined ? 'Neutral'
      : getStatusForPercentage(compliance, dashboard.thresholds, true, true);
    return {
      identity: { clientId, dashboardId: dashboard.id, indicatorId: item.id },
      dashboard: dashboard.title,
      area: dashboard.area || 'SIN ÁREA REGISTRADA',
      responsible: item.responsible || 'SIN RESPONSABLE REGISTRADO',
      indicator: item.indicator,
      unit: item.unit,
      period: source.scope.period,
      ...values,
      compliance,
      status,
      attentionReason: exception?.type,
    };
  }));

  const rowByIdentity = new Map(results.map(row => [`${String(row.identity.dashboardId)}:${String(row.identity.indicatorId)}`, row]));
  const activities: ControlReportActivityRow[] = dashboards.flatMap(dashboard => dashboard.items.flatMap(item => {
    const index = periodIndex(source.scope.period);
    return (item.isActivityMode ? item.activityConfig?.[index] || [] : []).map(activity => {
      const target = Math.max(0, Number(activity.targetCount) || 0);
      const completed = Math.max(0, Number(activity.completedCount) || 0);
      const pending = Math.max(0, target - completed);
      return {
        identity: { clientId, dashboardId: dashboard.id, indicatorId: item.id, activityId: activity.id },
        label: activity.label,
        target,
        completed,
        pending,
        status: pending === 0 ? 'COMPLETED' as const : 'PENDING' as const,
      };
    });
  }));

  const relatedPlans: ControlReportPlanRow[] = (source.actionPlans || []).filter(plan =>
    normalize(plan.clientId) === clientId && rowByIdentity.has(`${String(plan.dashboardId)}:${String(plan.indicatorId)}`),
  ).map(plan => ({
    id: plan.id,
    dashboardId: plan.dashboardId,
    indicatorId: plan.indicatorId,
    title: plan.title,
    responsible: plan.responsible || 'SIN RESPONSABLE REGISTRADO',
    status: plan.status,
    progress: plan.progress,
    targetDate: plan.targetDate,
  }));

  const categoryRows = (category: PendingCategory) => pendingItems
    .filter(item => item.category === category)
    .map(item => rowByIdentity.get(`${String(item.dashboardId)}:${String(item.indicatorId)}`))
    .filter((row): row is ControlReportResultRow => Boolean(row));

  return {
    schemaVersion: '1.0',
    cover: {
      title: source.title || 'Informe ejecutivo de CONTROL',
      client: source.scope.clientName,
      period: source.scope.period,
      generatedAt: source.generatedAt,
      generatedBy: source.generatedBy || 'Usuario del sistema',
    },
    scope: { ...source.scope, clientId, includedDashboardIds: includedIds, includedIndicatorCount: results.length },
    executiveSummary: {
      totalIndicators: results.length,
      criticalIndicators: results.filter(row => row.status === 'OffTrack').length,
      attentionIndicators: results.filter(row => row.status === 'AtRisk').length,
      pendingConfiguration: pendingItems.filter(item => item.category === 'CONFIGURACIÓN').length,
      pendingCapture: pendingItems.filter(item => item.category === 'CAPTURA').length,
    },
    results,
    followUp: {
      pendingActivities: activities.filter(activity => activity.status === 'PENDING'),
      completedActivities: activities.filter(activity => activity.status === 'COMPLETED'),
      relatedPlans,
    },
    detail: (['CONFIGURACIÓN', 'CAPTURA', 'RESULTADO'] as PendingCategory[]).map(category => ({ category, items: categoryRows(category) })),
  };
};
