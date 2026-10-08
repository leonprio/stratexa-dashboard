import type { Dashboard, DashboardItem, SystemSettings, TrackingStartPeriod } from '../types';
import { getActiveOperationalWork } from './operationalWork';

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

/** Zero-valued fields and their capture markers alone do not make a period
 * substantive. Associated facts are resolved from the complete period. */
export const isTrackingPeriodSemanticallyEmpty = (input: {
  goal?: number | null;
  progress?: number | null;
  hasAssociatedFacts: boolean;
}): boolean => {
  const substantive = (value: number | null | undefined) =>
    typeof value === 'number' && Number.isFinite(value) && value !== 0;
  return !input.hasAssociatedFacts && !substantive(input.goal) &&
    !substantive(input.progress);
};

/** True only for captured historical information; legacy zero is intentionally ambiguous. */
export const hasTrackingFactsBeforePeriod = (
  frequency: TrackingFrequency,
  year: number,
  candidate: TrackingPeriod,
  goals: Array<number | null | undefined>,
  progress: Array<number | null | undefined>,
  goalCaptured?: Array<boolean | undefined>,
  progressCaptured?: Array<boolean | undefined>,
  context?: Pick<DashboardItem, 'monthlyNotes' | 'weeklyNotes' | 'activityConfig' | 'continuityCommitments'>,
): { hasFacts: boolean; firstPeriod?: TrackingPeriod; goal?: number | null; progress?: number | null; detail?: string } => {
  const size = frequency === 'monthly' ? 12 : 53;
  for (let index = 0; index < size; index++) {
    const period: TrackingPeriod = frequency === 'monthly' ? { frequency, year, monthIndex: index } : { frequency, year, weekNumber: index + 1 };
    if (compareTrackingPeriods(period, candidate) >= 0) break;
    const note = (frequency === 'monthly' ? context?.monthlyNotes : context?.weeklyNotes)?.[index]?.trim();
    const activity = (context?.activityConfig?.[index] || []).some(a => !!a.label?.trim() ||
      (Number.isFinite(a.targetCount) && a.targetCount !== 0) ||
      (Number.isFinite(a.completedCount) && a.completedCount !== 0) || !!a.resolution?.resolutionStatus);
    const commitment = Object.values(context?.continuityCommitments || {}).some(c =>
      (c.frequency || 'monthly') === frequency && c.originYear === year && c.originPeriod === index &&
      (c.sourceType === 'SIMPLE_KPI' || c.sourceType === 'ACTIVITY_KPI'));
    const detail = note ? 'Nota registrada' : activity ? 'Actividad registrada' : commitment ? 'Compromiso de continuidad registrado' : undefined;
    // Missing context cannot establish that notes/checklists/commitments are empty.
    // Preserve conservative numeric-only callers; the start UI supplies the full item.
    const hasFacts = context
      ? !isTrackingPeriodSemanticallyEmpty({
          goal: goals[index], progress: progress[index], hasAssociatedFacts: !!detail,
        })
      : isExplicitOrLegacyValue(goals[index], goalCaptured?.[index]) || isExplicitOrLegacyValue(progress[index], progressCaptured?.[index]);
    if (hasFacts) {
      return { hasFacts: true, firstPeriod: period, goal: goals[index], progress: progress[index], ...(detail ? { detail } : {}) };
    }
  }
  return { hasFacts: false };
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

/**
 * Returns the earliest exigible period between the effective tracking start and
 * the target period that still has an unresolved configuration obligation (GOAL_REQUIRED).
 * If no earlier configuration gap exists, returns targetPeriod.
 */
export const getEarliestPendingConfigurationPeriod = (
  item: DashboardItem,
  targetPeriod: TrackingPeriod,
  dashboard?: Pick<Dashboard, 'defaultTrackingStartPeriod'>,
  clientSettings?: Pick<SystemSettings, 'defaultTrackingStartPeriod'>,
): TrackingPeriod => {
  const effectiveStart = getEffectiveTrackingStartPeriod(item, dashboard, clientSettings).period;
  if (!effectiveStart) return targetPeriod;

  const frequency = targetPeriod.frequency;
  if (effectiveStart.frequency !== frequency) return targetPeriod;

  const startIndex = effectiveStart.frequency === 'monthly' ? effectiveStart.monthIndex : effectiveStart.weekNumber - 1;
  const targetIndex = targetPeriod.frequency === 'monthly' ? targetPeriod.monthIndex : targetPeriod.weekNumber - 1;

  for (let y = effectiveStart.year; y <= targetPeriod.year; y++) {
    const minIdx = y === effectiveStart.year ? startIndex : 0;
    const maxIdx = y === targetPeriod.year ? targetIndex : frequency === 'monthly' ? 11 : 52;

    for (let idx = minIdx; idx <= maxIdx; idx++) {
      const period: TrackingPeriod = frequency === 'monthly'
        ? { frequency: 'monthly', year: y, monthIndex: idx }
        : { frequency: 'weekly', year: y, weekNumber: idx + 1 };

      const activities = item.isActivityMode ? (item.activityConfig?.[idx] || []) : [];
      const activityGoal = activities.reduce((sum, activity) => sum + Math.max(0, Number(activity.targetCount) || 0), 0);
      const activityProgress = activities.reduce((sum, activity) => sum + Math.max(0, Number(activity.completedCount) || 0), 0);

      const goal = item.isActivityMode && activities.length > 0
        ? activityGoal
        : frequency === 'monthly' ? item.monthlyGoals?.[idx] : item.weeklyGoals?.[idx];
      const progress = item.isActivityMode && activities.length > 0
        ? activityProgress
        : frequency === 'monthly' ? item.monthlyProgress?.[idx] : item.weeklyProgress?.[idx];

      const goalCaptured = item.isActivityMode && activities.length > 0
        ? true
        : frequency === 'monthly' ? item.monthlyGoalCaptured?.[idx] : undefined;
      const progressCaptured = item.isActivityMode && activities.length > 0
        ? activityProgress > 0
        : frequency === 'monthly' ? item.monthlyProgressCaptured?.[idx] : undefined;

      const obligation = getKpiTrackingObligation({
        frequency,
        period,
        operationalPeriod: targetPeriod,
        trackingStartPeriod: effectiveStart,
        goalValue: goal,
        progressValue: progress,
        goalCaptured,
        progressCaptured,
      });

      if (obligation === 'GOAL_REQUIRED') {
        const operationalWork = getActiveOperationalWork(item, period);
        const hasInheritedActiveWork = operationalWork.attention.length > 0;
        const activeContinuity = operationalWork.currentCommitments.length > 0;
        if (hasInheritedActiveWork || activeContinuity) {
          // Active operational work or continuity commitment in period means it's not a configuration gap
          continue;
        }
        return period;
      }
    }
  }

  return targetPeriod;
};
