import type { DashboardItem, TrackingStartPeriod } from '../types';
import { getEffectiveTrackingStartPeriod, getKpiTrackingObligation, type KpiTrackingObligationInput, type TrackingObligation, type TrackingPeriod } from './trackingObligation';
import type { Dashboard, SystemSettings } from '../types';

export const captureLabel: Record<TrackingObligation, string> = {
  NOT_REQUIRED: 'NO EXIGIBLE', TRACKING_START_UNDEFINED: 'INICIO SIN CONFIGURAR', FUTURE: 'FUTURO',
  GOAL_REQUIRED: 'FALTA META', PROGRESS_REQUIRED: 'FALTA AVANCE', CAPTURE_COMPLETE: 'CAPTURA COMPLETA',
};

export interface CaptureEntry { item: DashboardItem; input: KpiTrackingObligationInput; }
export interface CaptureSummary {
  totalKpis: number; requiredKpis: number; capturedKpis: number; missingGoalKpis: number;
  missingProgressKpis: number; notRequiredKpis: number; undefinedStartKpis: number; futureKpis: number;
  capturePercent: number | null; obligations: Array<{ item: DashboardItem; obligation: TrackingObligation }>;
}

/** Presentation-only formatter: a dash means the category is not applicable. */
export const formatCaptureCount = (value: number, noObligations: boolean): string =>
  noObligations ? '—' : String(value);

/** Read-only denominator: only obligated, non-future KPIs can count. */
export const getCaptureSummaryForPeriod = (entries: CaptureEntry[]): CaptureSummary => {
  const obligations = entries.map(({ item, input }) => ({ item, obligation: getKpiTrackingObligation(input) }));
  const count = (state: TrackingObligation) => obligations.filter(x => x.obligation === state).length;
  const capturedKpis = count('CAPTURE_COMPLETE');
  const missingGoalKpis = count('GOAL_REQUIRED');
  const missingProgressKpis = count('PROGRESS_REQUIRED');
  const requiredKpis = capturedKpis + missingGoalKpis + missingProgressKpis;
  return { totalKpis: entries.length, requiredKpis, capturedKpis, missingGoalKpis, missingProgressKpis,
    notRequiredKpis: count('NOT_REQUIRED'), undefinedStartKpis: count('TRACKING_START_UNDEFINED'), futureKpis: count('FUTURE'),
    capturePercent: requiredKpis ? (capturedKpis / requiredKpis) * 100 : null, obligations };
};

/** Converts stored monthly/weekly arrays into the only input accepted by the canonical engine. */
export const makeCaptureEntry = (item: DashboardItem, period: TrackingPeriod, operationalPeriod: TrackingPeriod, start?: TrackingStartPeriod): CaptureEntry => {
  const weekly = period.frequency === 'weekly';
  const index = weekly ? period.weekNumber - 1 : period.monthIndex;
  return { item, input: { frequency: period.frequency, period, operationalPeriod, trackingStartPeriod: start,
    goalValue: weekly ? item.weeklyGoals?.[index] : item.monthlyGoals?.[index],
    progressValue: weekly ? item.weeklyProgress?.[index] : item.monthlyProgress?.[index],
    goalCaptured: weekly ? undefined : item.monthlyGoalCaptured?.[index],
    progressCaptured: weekly ? undefined : item.monthlyProgressCaptured?.[index] } };
};

/** Builds the visible, read-only capture summary for one dashboard or a consolidated universe. */
export const getCaptureSummaryForDashboard = (
  dashboard: Pick<Dashboard, 'items' | 'year' | 'periodicity' | 'defaultTrackingStartPeriod'>,
  settings?: Pick<SystemSettings, 'defaultTrackingStartPeriod'>,
  now = new Date(),
): CaptureSummary => {
  const frequency = dashboard.periodicity ?? (dashboard.items?.some(item => item.frequency === 'weekly') ? 'weekly' : 'monthly');
  const year = dashboard.year ?? now.getFullYear();
  const operationalPeriod: TrackingPeriod = frequency === 'weekly'
    ? { frequency, year, weekNumber: year < now.getFullYear() ? 53 : Math.max(1, Math.min(53, Math.ceil((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / 604800000))) }
    : { frequency, year, monthIndex: year < now.getFullYear() ? 11 : year > now.getFullYear() ? now.getMonth() : now.getMonth() };
  const entries = (dashboard.items ?? [])
    .filter(item => item.indicatorType !== 'compound' && item.indicatorType !== 'formula' && !(item as any).isAggregate)
    .map(item => makeCaptureEntry(item, operationalPeriod, operationalPeriod, getEffectiveTrackingStartPeriod(item, dashboard, settings).period));
  return getCaptureSummaryForPeriod(entries);
};
