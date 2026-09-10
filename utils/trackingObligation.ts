import type { Dashboard, DashboardItem, SystemSettings, TrackingStartPeriod } from '../types';

export type TrackingFrequency = 'monthly' | 'weekly';

export type TrackingPeriod =
  | { frequency: 'monthly'; year: number; monthIndex: number }
  | { frequency: 'weekly'; year: number; weekNumber: number };

export type TrackingObligation =
  | 'NOT_REQUIRED'
  | 'TRACKING_START_UNDEFINED'
  | 'FUTURE'
  | 'GOAL_REQUIRED'
  | 'PROGRESS_REQUIRED'
  | 'CAPTURE_COMPLETE';

export interface KpiTrackingObligationInput {
  frequency: TrackingFrequency;
  period: TrackingPeriod;
  operationalPeriod: TrackingPeriod;
  trackingStartPeriod?: TrackingStartPeriod;
  goalValue?: number | null;
  progressValue?: number | null;
  /** True is evidence of an explicitly supplied zero or value; false is not evidence. */
  goalCaptured?: boolean;
  /** True is evidence of an explicitly supplied zero or value; false is not evidence. */
  progressCaptured?: boolean;
}

const assertPeriod = (period: TrackingPeriod): void => {
  if (!Number.isInteger(period.year)) throw new Error('INVALID_PERIOD_YEAR');
  if (period.frequency === 'monthly' && (!Number.isInteger(period.monthIndex) || period.monthIndex < 0 || period.monthIndex > 11)) {
    throw new Error('INVALID_MONTH_INDEX');
  }
  if (period.frequency === 'weekly' && (!Number.isInteger(period.weekNumber) || period.weekNumber < 1 || period.weekNumber > 53)) {
    throw new Error('INVALID_WEEK_NUMBER');
  }
};

const periodIndex = (period: TrackingPeriod): number =>
  period.frequency === 'monthly' ? period.monthIndex : period.weekNumber;

/** Pure business comparison. It deliberately does not consult browser Date. */
export const compareTrackingPeriods = (left: TrackingPeriod, right: TrackingPeriod): -1 | 0 | 1 => {
  assertPeriod(left);
  assertPeriod(right);
  if (left.frequency !== right.frequency) throw new Error('PERIOD_FREQUENCY_MISMATCH');
  if (left.year !== right.year) return left.year < right.year ? -1 : 1;
  const leftIndex = periodIndex(left);
  const rightIndex = periodIndex(right);
  return leftIndex === rightIndex ? 0 : leftIndex < rightIndex ? -1 : 1;
};

const isExplicitOrLegacyValue = (value: number | null | undefined, captured: boolean | undefined): boolean => {
  if (captured === true) return true;
  // Older records have no marker. Only a non-zero finite value is unambiguous.
  return captured === undefined && typeof value === 'number' && Number.isFinite(value) && value !== 0;
};

/**
 * Resolves the sole start value used by obligation logic. Defaults are opt-in:
 * KPI override > dashboard default > client-scoped settings default > undefined.
 */
export const resolveTrackingStartPeriod = (
  item: Pick<DashboardItem, 'trackingStartPeriod'>,
  dashboard?: Pick<Dashboard, 'defaultTrackingStartPeriod'>,
  clientSettings?: Pick<SystemSettings, 'defaultTrackingStartPeriod'>,
): TrackingStartPeriod | undefined =>
  item.trackingStartPeriod ?? dashboard?.defaultTrackingStartPeriod ?? clientSettings?.defaultTrackingStartPeriod;

export type TrackingStartSource = 'KPI' | 'DASHBOARD' | 'CLIENT' | 'UNDEFINED';
export interface EffectiveTrackingStart {
  period?: TrackingStartPeriod;
  source: TrackingStartSource;
}

/** The single inheritance selector used by all UI surfaces. */
export const getEffectiveTrackingStartPeriod = (
  item: Pick<DashboardItem, 'trackingStartPeriod'>,
  dashboard?: Pick<Dashboard, 'defaultTrackingStartPeriod'>,
  clientSettings?: Pick<SystemSettings, 'defaultTrackingStartPeriod'>,
): EffectiveTrackingStart => {
  if (item.trackingStartPeriod) return { period: item.trackingStartPeriod, source: 'KPI' };
  if (dashboard?.defaultTrackingStartPeriod) return { period: dashboard.defaultTrackingStartPeriod, source: 'DASHBOARD' };
  if (clientSettings?.defaultTrackingStartPeriod) return { period: clientSettings.defaultTrackingStartPeriod, source: 'CLIENT' };
  return { source: 'UNDEFINED' };
};

/** Deterministic, conservative history hint. Explicit zero goal markers are evidence. */
export const suggestTrackingStartFromGoalHistory = (
  frequency: TrackingFrequency,
  year: number,
  goals: Array<number | null | undefined>,
  goalCaptured?: Array<boolean | undefined>,
): TrackingStartPeriod | undefined => {
  const first = goals.findIndex((goal, index) => isExplicitOrLegacyValue(goal, goalCaptured?.[index]));
  if (first < 0) return undefined;
  if (frequency === 'monthly') return first < 12 ? { frequency, year, monthIndex: first } : undefined;
  return first < 53 ? { frequency, year, weekNumber: first + 1 } : undefined;
};

/** Evaluates information obligation only; it does not judge KPI performance or lateness. */
export const getKpiTrackingObligation = (input: KpiTrackingObligationInput): TrackingObligation => {
  const { frequency, period, operationalPeriod, trackingStartPeriod } = input;
  assertPeriod(period);
  assertPeriod(operationalPeriod);
  if (period.frequency !== frequency || operationalPeriod.frequency !== frequency) throw new Error('INPUT_FREQUENCY_MISMATCH');

  if (!trackingStartPeriod) return 'TRACKING_START_UNDEFINED';
  assertPeriod(trackingStartPeriod);
  if (trackingStartPeriod.frequency !== frequency) throw new Error('TRACKING_START_FREQUENCY_MISMATCH');
  if (compareTrackingPeriods(period, trackingStartPeriod) < 0) return 'NOT_REQUIRED';
  if (compareTrackingPeriods(period, operationalPeriod) > 0) return 'FUTURE';

  if (!isExplicitOrLegacyValue(input.goalValue, input.goalCaptured)) return 'GOAL_REQUIRED';
  if (!isExplicitOrLegacyValue(input.progressValue, input.progressCaptured)) return 'PROGRESS_REQUIRED';
  return 'CAPTURE_COMPLETE';
};

export interface KpiTrackingPeriodEntry {
  kpiId: DashboardItem['id'];
  obligation: TrackingObligation;
}

/** Denominator-ready selector. Undefined, pre-start and future KPIs are excluded. */
export const selectKpiTrackingCaptureForPeriod = (
  inputs: Array<KpiTrackingObligationInput & { kpiId: DashboardItem['id'] }>,
): { requiredKpisForPeriod: KpiTrackingPeriodEntry[]; capturedKpisForPeriod: KpiTrackingPeriodEntry[] } => {
  const entries = inputs.map(({ kpiId, ...input }) => ({ kpiId, obligation: getKpiTrackingObligation(input) }));
  const requiredKpisForPeriod = entries.filter(({ obligation }) =>
    obligation === 'GOAL_REQUIRED' || obligation === 'PROGRESS_REQUIRED' || obligation === 'CAPTURE_COMPLETE',
  );
  return {
    requiredKpisForPeriod,
    capturedKpisForPeriod: requiredKpisForPeriod.filter(({ obligation }) => obligation === 'CAPTURE_COMPLETE'),
  };
};
