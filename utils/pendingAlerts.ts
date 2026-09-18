import type { Dashboard, DashboardItem } from '../types';
import { getKpiTrackingObligation, type TrackingPeriod, type TrackingObligation } from './trackingObligation';

export type PendingType = 'MISSING_GOAL' | 'MISSING_PROGRESS' | 'TRACKING_START_UNDEFINED' | 'RESULT_CRITICAL' | 'RESULT_AT_RISK';
export type PendingCategory = 'CONFIGURACIÓN' | 'CAPTURA' | 'RESULTADO';
export interface PendingItem {
  id: string;
  type: PendingType;
  category: PendingCategory;
  severity: 'CRÍTICA' | 'ALTA' | 'MEDIA';
  indicatorId: DashboardItem['id']; indicatorName: string; dashboardId: Dashboard['id']; area?: string; responsible?: string;
  period: TrackingPeriod; message: string; actionLabel: string; source: 'trackingObligation' | 'performance';
}
export interface PendingCategoryCounts { CONFIGURACIÓN: number; CAPTURA: number; RESULTADO: number; }
const rank: Record<PendingType, number> = { TRACKING_START_UNDEFINED: 1, MISSING_GOAL: 2, MISSING_PROGRESS: 3, RESULT_CRITICAL: 4, RESULT_AT_RISK: 5 };
const detail: Record<PendingType, Pick<PendingItem, 'category'|'actionLabel'|'message'|'severity'>> = {
  TRACKING_START_UNDEFINED: { category: 'CONFIGURACIÓN', actionLabel: 'CONFIGURAR INICIO', message: 'No puede determinarse desde cuándo debe exigirse información.', severity: 'CRÍTICA' },
  MISSING_GOAL: { category: 'CAPTURA', actionLabel: 'REGISTRAR META', message: 'Este indicador ya es exigible y aún no tiene meta registrada.', severity: 'ALTA' },
  MISSING_PROGRESS: { category: 'CAPTURA', actionLabel: 'REGISTRAR AVANCE', message: 'La meta está registrada, pero falta el avance del periodo.', severity: 'ALTA' },
  RESULT_CRITICAL: { category: 'RESULTADO', actionLabel: 'GESTIONAR', message: 'Existe captura válida, pero el resultado está por debajo de la meta.', severity: 'CRÍTICA' },
  RESULT_AT_RISK: { category: 'RESULTADO', actionLabel: 'GESTIONAR', message: 'Existe captura válida y el resultado requiere atención.', severity: 'MEDIA' },
};
export const buildPendingItems = (dashboards: Dashboard[], period: TrackingPeriod, operationalPeriod: TrackingPeriod, authorizedDashboardIds: Array<Dashboard['id']>): PendingItem[] => {
  const allowed = new Set(authorizedDashboardIds.map(String)); const result: PendingItem[] = [];
  dashboards.filter(d => allowed.has(String(d.id))).forEach(d => (d.items ?? []).forEach(item => {
    if (item.indicatorType === 'compound' || item.indicatorType === 'formula') return;
    const i = period.frequency === 'monthly' ? period.monthIndex : period.weekNumber - 1;
    const goal = period.frequency === 'monthly' ? item.monthlyGoals?.[i] : item.weeklyGoals?.[i];
    const progress = period.frequency === 'monthly' ? item.monthlyProgress?.[i] : item.weeklyProgress?.[i];
    const goalCaptured = period.frequency === 'monthly' ? item.monthlyGoalCaptured?.[i] : undefined;
    const progressCaptured = period.frequency === 'monthly' ? item.monthlyProgressCaptured?.[i] : undefined;
    const obligation = getKpiTrackingObligation({ frequency: period.frequency, period, operationalPeriod, trackingStartPeriod: item.trackingStartPeriod ?? d.defaultTrackingStartPeriod, goalValue: goal, progressValue: progress, goalCaptured, progressCaptured });
    const type: PendingType | undefined = obligation === 'TRACKING_START_UNDEFINED' ? 'TRACKING_START_UNDEFINED' : obligation === 'GOAL_REQUIRED' ? 'MISSING_GOAL' : obligation === 'PROGRESS_REQUIRED' ? 'MISSING_PROGRESS' : undefined;
    if (type) { const x = detail[type]; result.push({ id: `${d.id}:${item.id}:${type}`, type, ...x, indicatorId: item.id, indicatorName: item.indicator, dashboardId: d.id, area: d.area, responsible: item.responsible, period, source: 'trackingObligation' }); return; }
    if (obligation !== 'CAPTURE_COMPLETE' || typeof goal !== 'number' || typeof progress !== 'number' || goal === 0) return;
    const score = item.goalType === 'minimize' ? (progress <= goal ? 100 : (goal / progress) * 100) : (progress / goal) * 100;
    const performanceType = score < 70 ? 'RESULT_CRITICAL' : score < 85 ? 'RESULT_AT_RISK' : undefined;
    if (performanceType) { const x = detail[performanceType]; result.push({ id: `${d.id}:${item.id}:${performanceType}`, type: performanceType, ...x, indicatorId: item.id, indicatorName: item.indicator, dashboardId: d.id, area: d.area, responsible: item.responsible, period, source: 'performance' }); }
  }));
  return result.sort((a, b) => rank[a.type] - rank[b.type] || a.indicatorName.localeCompare(b.indicatorName));
};

/** Presentation helpers keep React from recreating pending semantics. */
export const getPendingCategoryCounts = (items: PendingItem[]): PendingCategoryCounts =>
  items.reduce<PendingCategoryCounts>((counts, item) => {
    counts[item.category] += 1;
    return counts;
  }, { CONFIGURACIÓN: 0, CAPTURA: 0, RESULTADO: 0 });

export const getPendingActionTarget = (item: PendingItem) => ({
  dashboardId: item.dashboardId,
  itemId: item.indicatorId,
});
