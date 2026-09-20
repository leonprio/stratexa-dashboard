import type { DashboardItem } from '../types';
import { getContinuitySnapshot, isCaptureComplete, reduceContinuity, type ContinuityCommitment, type ContinuityEvent, type ContinuityFrequency, type ContinuityStatus } from './continuityEngine';

export const cleanActivityId = (activityId: string) => String(activityId || '').replace(/^activity:/, '');
export const continuityKey = (activityId: string) => `activity:${cleanActivityId(activityId)}`;
export const simpleKpiContinuityKey = (
  item: Pick<DashboardItem, 'id'>,
  frequency: ContinuityFrequency,
  originYear: number,
  originPeriod: number,
) => `simple-kpi:${item.id}:${frequency}:${originYear}:${originPeriod}`;
export type VisibleContinuityState = { source: 'CANONICAL' | 'LEGACY_FALLBACK' | 'NONE'; commitment?: ContinuityCommitment };
export type ContinuityOperationalState = 'ACTIVE' | 'RETIRED_FROM_SOURCE';

const hasSourceActivityAtOrigin = (item: DashboardItem, commitment: ContinuityCommitment): boolean => {
  if (commitment.sourceType !== 'ACTIVITY_KPI' || !commitment.sourceActivityId) return true;
  const originActivities = item.activityConfig?.[commitment.originPeriod];
  return Array.isArray(originActivities) && originActivities.some(
    (activity) =>
      cleanActivityId(activity.id) === cleanActivityId(commitment.sourceActivityId || '') &&
      Number(activity.targetCount) > 0,
  );
};

/**
 * Read-only reconciliation: a deleted source must not remain actionable merely
 * because its historical canonical commitment is still persisted.  A genuine
 * reschedule retains an exigible source activity at its origin, so it stays
 * active. A residual zero-target activity is not an operational source.
 */
export const getContinuityOperationalState = (
  item: DashboardItem,
  commitment: ContinuityCommitment,
): ContinuityOperationalState =>
  commitment.status === 'active' && !hasSourceActivityAtOrigin(item, commitment)
    ? 'RETIRED_FROM_SOURCE'
    : 'ACTIVE';

export const getOperationalContinuityCommitments = (item: DashboardItem): ContinuityCommitment[] =>
  Object.values(item.continuityCommitments || {}).filter(
    (commitment) => getContinuityOperationalState(item, commitment) === 'ACTIVE',
  );

/** Preserved audit records that are intentionally excluded from live queues. */
export const getRetiredContinuityCommitments = (item: DashboardItem): ContinuityCommitment[] =>
  Object.values(item.continuityCommitments || {}).filter(
    (commitment) => getContinuityOperationalState(item, commitment) === 'RETIRED_FROM_SOURCE',
  );
/** Read-only KPI projection shared by annual, trend and continuity surfaces. */
export const getEffectiveKpiProgressByPeriod = (item: DashboardItem, period: number): number | null => {
  if (item.frequency === 'weekly') {
    const raw = item.weeklyProgress?.[period];
    return raw !== null && raw !== undefined && Number.isFinite(Number(raw)) ? Number(raw) : null;
  }
  const explicit = item.monthlyProgress?.[period];
  const isCaptured = item.monthlyProgressCaptured?.[period];
  if (isCaptured === true && explicit !== null && explicit !== undefined && Number.isFinite(Number(explicit))) {
    return Number(explicit);
  }
  if (isCaptured === undefined && explicit !== null && explicit !== undefined && Number.isFinite(Number(explicit)) && Number(explicit) > 0) {
    return Number(explicit);
  }
  const sourceKpiIds = new Set([
    String(item.id),
    ...(((item as DashboardItem & { sources?: { itemId: number | string }[] }).sources || []).map((source) => String(source.itemId))),
  ]);
  const canonical = Object.values(item.continuityCommitments || {}).find((commitment) =>
    sourceKpiIds.has(String(commitment.sourceKpiId)) && Object.prototype.hasOwnProperty.call(commitment.progressByPeriod || {}, period),
  );
  const historical = canonical?.progressByPeriod?.[period];
  return historical !== null && historical !== undefined && Number.isFinite(Number(historical)) && Number(historical) > 0 ? Number(historical) : null;
};
export const getKpiProgressForPeriod = getEffectiveKpiProgressByPeriod;
export const reconcileCommitmentProgress = (
  rawProgress: Record<number, number> | undefined,
  matchingActivity: any,
  originPeriod: number,
): Record<number, number> => {
  const result: Record<number, number> = {};

  // 1. Origin period: if matchingActivity.completedCount > 0, it is authoritative.
  // If matchingActivity.completedCount is 0 or not set, preserve explicit rawProgress[originPeriod] if present.
  if (matchingActivity?.completedCount !== undefined && Number(matchingActivity.completedCount) > 0) {
    result[originPeriod] = Number(matchingActivity.completedCount);
  } else if (rawProgress?.[originPeriod] !== undefined && rawProgress[originPeriod] !== null) {
    result[originPeriod] = Number(rawProgress[originPeriod]);
  }

  // 2. Additional periods: preserve explicit progress entries
  if (rawProgress) {
    for (const [pStr, val] of Object.entries(rawProgress)) {
      const p = Number(pStr);
      if (p === originPeriod) continue;
      if (val !== null && val !== undefined && Number.isFinite(Number(val))) {
        result[p] = Number(val);
      }
    }
  }

  return result;
};

export const createKpiContinuityCommitment = (
  item: DashboardItem,
  activityId: string,
  originYear: number,
  originPeriod: number,
  scheduledYear = originYear,
  scheduledPeriod = originPeriod,
  existing?: ContinuityCommitment,
): ContinuityCommitment => {
  const cleanId = cleanActivityId(activityId);
  let matchingActivity: any = undefined;
  let activityOriginPeriod = originPeriod;
  if (item.activityConfig) {
    for (const [p, raw] of Object.entries(item.activityConfig)) {
      const list = Array.isArray(raw) ? raw : Object.values(raw || {});
      const found = list.find((a: any) => cleanActivityId(a?.id) === cleanId);
      if (found) {
        matchingActivity = found;
        activityOriginPeriod = Number(p);
        break;
      }
    }
  }

  const target = (matchingActivity?.targetCount !== undefined && Number(matchingActivity.targetCount) > 0)
    ? Number(matchingActivity.targetCount)
    : (existing?.originalTarget || 0);

  const finalProgress = reconcileCommitmentProgress(
    existing?.progressByPeriod,
    matchingActivity,
    activityOriginPeriod,
  );

  return {
    ...(existing || {}),
    id: existing?.id || continuityKey(cleanId),
    sourceType: 'ACTIVITY_KPI',
    sourceKpiId: String(item.id),
    sourceActivityId: cleanId,
    frequency: item.frequency || 'monthly',
    originYear: existing?.originYear ?? originYear,
    originPeriod: existing?.originPeriod ?? activityOriginPeriod,
    originalTarget: target,
    scheduledYear,
    scheduledPeriod,
    progressByPeriod: finalProgress,
    progressByTemporalPeriod: existing?.progressByTemporalPeriod,
    status: existing?.status || 'active',
    outcome: existing?.outcome || 'in_progress',
    rescheduleHistory: existing?.rescheduleHistory || [],
    resolutionHistory: existing?.resolutionHistory || [],
  };
};

const simpleKpiPeriodValues = (item: DashboardItem, frequency: ContinuityFrequency, period: number) => {
  const goal = frequency === 'weekly' ? item.weeklyGoals?.[period] : item.monthlyGoals?.[period];
  const progress = frequency === 'weekly' ? item.weeklyProgress?.[period] : item.monthlyProgress?.[period];
  const progressCaptured = frequency === 'weekly'
    ? progress !== null && progress !== undefined
    : item.monthlyProgressCaptured?.[period] === true ||
      (item.monthlyProgressCaptured?.[period] === undefined && typeof progress === 'number' && Number.isFinite(progress) && progress !== 0);
  return { goal: Number(goal), progress: Number(progress), progressCaptured };
};

/** A simple KPI can become a commitment only from a real, unmet captured fact. */
export const canCreateSimpleKpiContinuity = (
  item: DashboardItem,
  originYear: number,
  originPeriod: number,
  frequency: ContinuityFrequency = item.frequency || 'monthly',
): boolean => {
  if (item.isActivityMode || item.indicatorType === 'compound' || item.indicatorType === 'formula' || !item.trackingStartPeriod) return false;
  const { goal, progress, progressCaptured } = simpleKpiPeriodValues(item, frequency, originPeriod);
  return Number.isFinite(goal) && goal > 0 && progressCaptured && Number.isFinite(progress) && progress >= 0 && progress < goal;
};

export const createSimpleKpiContinuityCommitment = (
  item: DashboardItem,
  originYear: number,
  originPeriod: number,
  scheduledYear = originYear,
  scheduledPeriod = originPeriod,
  existing?: ContinuityCommitment,
): ContinuityCommitment => {
  const frequency: ContinuityFrequency = item.frequency || 'monthly';
  if (!existing && !canCreateSimpleKpiContinuity(item, originYear, originPeriod, frequency)) {
    throw new Error('SIMPLE_KPI_CONTINUITY_NOT_ELIGIBLE');
  }
  const { goal, progress, progressCaptured } = simpleKpiPeriodValues(item, frequency, originPeriod);
  const initialProgress = progressCaptured ? progress : 0;
  return {
    ...(existing || {}),
    id: existing?.id || simpleKpiContinuityKey(item, frequency, originYear, originPeriod),
    sourceType: 'SIMPLE_KPI',
    sourceKpiId: String(item.id),
    originYear: existing?.originYear ?? originYear,
    originPeriod: existing?.originPeriod ?? originPeriod,
    originalTarget: existing?.originalTarget ?? goal,
    scheduledYear,
    scheduledPeriod,
    frequency,
    progressByPeriod: existing?.progressByPeriod || (progressCaptured ? { [originPeriod]: initialProgress } : {}),
    progressByTemporalPeriod: existing?.progressByTemporalPeriod,
    status: existing?.status || 'active',
    outcome: existing?.outcome || 'in_progress',
    rescheduleHistory: existing?.rescheduleHistory || [],
    resolutionHistory: existing?.resolutionHistory || [{ type: 'CREATE_CONTINUITY', at: new Date().toISOString() }],
  };
};

export const getSimpleKpiContinuity = (
  item: DashboardItem,
  originYear: number,
  originPeriod: number,
): ContinuityCommitment | undefined => {
  const frequency: ContinuityFrequency = item.frequency || 'monthly';
  const key = simpleKpiContinuityKey(item, frequency, originYear, originPeriod);
  const existing = item.continuityCommitments?.[key];
  return existing && existing.sourceType === 'SIMPLE_KPI'
    ? createSimpleKpiContinuityCommitment(item, originYear, originPeriod, existing.scheduledYear, existing.scheduledPeriod, existing)
    : undefined;
};

export const applySimpleKpiContinuityEventToItem = (
  item: DashboardItem,
  originYear: number,
  originPeriod: number,
  event: Exclude<ContinuityEvent, { type: 'CREATE_CONTINUITY' }>,
): DashboardItem => {
  const frequency: ContinuityFrequency = item.frequency || 'monthly';
  const key = simpleKpiContinuityKey(item, frequency, originYear, originPeriod);
  const current = getSimpleKpiContinuity(item, originYear, originPeriod) ||
    createSimpleKpiContinuityCommitment(item, originYear, originPeriod);
  const next = reduceContinuity(current, event);
  return { ...item, continuityCommitments: { ...(item.continuityCommitments || {}), [key]: next } };
};
export const getVisibleContinuityState = (item: DashboardItem, activityId: string): VisibleContinuityState => {
  const cleanId = cleanActivityId(activityId);
  const key = continuityKey(cleanId);
  const commitment =
    item.continuityCommitments?.[key] ||
    item.continuityCommitments?.[activityId] ||
    Object.values(item.continuityCommitments || {}).find((c) => cleanActivityId(c.sourceActivityId || c.id) === cleanId);

  if (!commitment) {
    let foundActivity: any = undefined;
    let foundPeriod = 0;
    if (item.activityConfig) {
      for (const [p, raw] of Object.entries(item.activityConfig)) {
        const list = Array.isArray(raw) ? raw : Object.values(raw || {});
        const found = list.find((a: any) => cleanActivityId(a?.id) === cleanId);
        if (found) {
          foundActivity = found;
          foundPeriod = Number(p);
          break;
        }
      }
    }
    if (foundActivity) {
      const year = item.trackingStartPeriod?.year || new Date().getFullYear();
      const synthetic = createKpiContinuityCommitment(
        item,
        cleanId,
        year,
        foundPeriod,
        year,
        foundPeriod,
      );
      return { source: 'LEGACY_FALLBACK', commitment: synthetic };
    }
    return { source: item.activityConfig ? 'LEGACY_FALLBACK' : 'NONE' };
  }
  // Keep the persisted record auditable, but never rematerialize a removed
  // source as an active operational commitment.
  if (getContinuityOperationalState(item, commitment) === 'RETIRED_FROM_SOURCE') {
    return { source: 'NONE' };
  }
  if (commitment.sourceType === 'SIMPLE_KPI') {
    return {
      source: 'CANONICAL',
      commitment: createSimpleKpiContinuityCommitment(
        item,
        commitment.originYear,
        commitment.originPeriod,
        commitment.scheduledYear,
        commitment.scheduledPeriod,
        commitment,
      ),
    };
  }
  return {
    source: 'CANONICAL',
    commitment: createKpiContinuityCommitment(
      item,
      cleanId,
      commitment.originYear,
      commitment.originPeriod,
      commitment.scheduledYear,
      commitment.scheduledPeriod,
      commitment,
    ),
  };
};

export interface IndividualCommitmentProjection {
  id: string;
  sourceActivityId: string;
  title: string;
  originPeriod: number;
  originYear: number;
  scheduledPeriod: number;
  scheduledYear: number;
  target: number;
  progressByPeriod: Record<number, number>;
  previousCumulativeProgress: number;
  currentPeriodProgress: number | null;
  cumulativeProgress: number;
  fulfillmentPercent: number;
  remaining: number;
  status: ContinuityStatus;
  commitment?: ContinuityCommitment;
}

/** Same continuity-workspace metrics, sourced from a simple KPI rather than an activity. */
export const getSimpleKpiContinuityProjection = (
  item: DashboardItem,
  originYear: number,
  originPeriod: number,
): IndividualCommitmentProjection | undefined => {
  const commitment = getSimpleKpiContinuity(item, originYear, originPeriod);
  if (!commitment) return undefined;
  const snapshot = getContinuitySnapshot(commitment);
  return {
    id: commitment.id,
    sourceActivityId: commitment.id,
    title: item.indicator,
    originPeriod: commitment.originPeriod,
    originYear: commitment.originYear,
    scheduledPeriod: commitment.scheduledPeriod,
    scheduledYear: commitment.scheduledYear,
    target: commitment.originalTarget,
    progressByPeriod: commitment.progressByPeriod,
    previousCumulativeProgress: snapshot.previousCumulative,
    currentPeriodProgress: isCaptureComplete(commitment) ? snapshot.currentPeriodProgress : null,
    cumulativeProgress: snapshot.cumulativeProgress,
    fulfillmentPercent: snapshot.fulfillmentPercent,
    remaining: snapshot.remainingTarget,
    status: commitment.status,
    commitment,
  };
};

export const getIndividualCommitmentProjection = (
  item: DashboardItem,
  sourceActivityId: string,
  consultedPeriod?: number,
): IndividualCommitmentProjection => {
  const cleanId = cleanActivityId(sourceActivityId);
  const visible = getVisibleContinuityState(item, cleanId);
  const commitment = visible.commitment;

  let matchingActivity: any = undefined;
  let activityOriginPeriod = 0;
  if (item.activityConfig) {
    for (const [p, raw] of Object.entries(item.activityConfig)) {
      const list = Array.isArray(raw) ? raw : Object.values(raw || {});
      const found = list.find((a: any) => cleanActivityId(a?.id) === cleanId);
      if (found) {
        matchingActivity = found;
        activityOriginPeriod = Number(p);
        break;
      }
    }
  }

  const target = (matchingActivity?.targetCount !== undefined && Number(matchingActivity.targetCount) > 0)
    ? Number(matchingActivity.targetCount)
    : (commitment?.originalTarget || 0);

  const progressByPeriod = reconcileCommitmentProgress(
    commitment?.progressByPeriod,
    matchingActivity,
    activityOriginPeriod,
  );

  const projectionPeriod = commitment?.scheduledPeriod ?? activityOriginPeriod;
  const snapshot = commitment ? getContinuitySnapshot(commitment) : undefined;
  const previousCumulativeProgress = snapshot?.previousCumulative ?? Object.entries(progressByPeriod)
    .filter(([period]) => Number(period) < projectionPeriod)
    .reduce((sum, [, value]) => sum + Number(value || 0), 0);
  const currentPeriodProgress = commitment
    ? (isCaptureComplete(commitment) ? snapshot!.currentPeriodProgress : null)
    : (Object.prototype.hasOwnProperty.call(progressByPeriod, projectionPeriod) ? Number(progressByPeriod[projectionPeriod] || 0) : null);
  const cumulativeProgressThroughPeriod = snapshot?.cumulativeProgress ?? (previousCumulativeProgress + (currentPeriodProgress ?? 0));
  const remaining = Math.max(0, target - cumulativeProgressThroughPeriod);
  return {
    id: commitment?.id || continuityKey(cleanId),
    sourceActivityId: cleanId,
    title: matchingActivity?.label || (commitment?.sourceType === 'SIMPLE_KPI' ? item.indicator : (commitment?.sourceActivityId || cleanId)),
    originPeriod: commitment?.originPeriod ?? activityOriginPeriod,
    originYear: commitment?.originYear ?? new Date().getFullYear(),
    scheduledPeriod: commitment?.scheduledPeriod ?? activityOriginPeriod,
    scheduledYear: commitment?.scheduledYear ?? new Date().getFullYear(),
    target,
    progressByPeriod,
    previousCumulativeProgress,
    currentPeriodProgress,
    cumulativeProgress: cumulativeProgressThroughPeriod,
    fulfillmentPercent: target > 0 ? (cumulativeProgressThroughPeriod / target) * 100 : 0,
    remaining,
    status: commitment?.status || 'active',
    commitment,
  };
};

export const syncCommitmentsWithActivityConfig = (
  item: DashboardItem,
  updatedActivityConfig: DashboardItem['activityConfig'],
): Record<string, ContinuityCommitment> => {
  const existingCommitments = { ...(item.continuityCommitments || {}) };
  if (!updatedActivityConfig) return existingCommitments;

  for (const [p, raw] of Object.entries(updatedActivityConfig)) {
    const list = Array.isArray(raw) ? raw : Object.values(raw || {});
    const period = Number(p);
    for (const activity of list) {
      if (!activity?.id) continue;
      const cleanId = cleanActivityId(activity.id);
      const key = continuityKey(cleanId);
      const existing =
        existingCommitments[key] ||
        existingCommitments[activity.id] ||
        Object.values(existingCommitments).find((c) => cleanActivityId(c.sourceActivityId || c.id) === cleanId);
      if (existing) {
        const canonicalKey = existing.id || key;
        const reconciled = reconcileCommitmentProgress(
          existing.progressByPeriod,
          activity,
          existing.originPeriod ?? period,
        );
        existingCommitments[canonicalKey] = {
          ...existing,
          originalTarget: Number(activity.targetCount) > 0 ? Number(activity.targetCount) : existing.originalTarget,
          progressByPeriod: reconciled,
        };
      }
    }
  }
  return existingCommitments;
};

/** Read-only projection for recovery UX; discarded commitments never enter active attention queues. */
export const getDiscardedContinuityCommitments = (item: DashboardItem) =>
  Object.values(item.continuityCommitments || {}).filter((commitment) => commitment.status === 'discarded');

export type ContinuityAction = 'RESCHEDULE' | 'UNDO_RESCHEDULE' | 'COMPLETE' | 'REGISTER_TARGET_REACHED' | 'CLOSE_UNMET' | 'DISCARD' | 'REOPEN' | 'ADJUST_PERIOD_PROGRESS' | 'VOID_PERIOD_PROGRESS' | 'RECORD_PROGRESS' | 'RESTORE_PROGRESS';
/** Shared UI policy. A legacy fallback may only materialize the four actions migrated to the canonical store. */
export const getAvailableContinuityActions = (state: VisibleContinuityState): ContinuityAction[] => {
  const commitment = state.commitment;
  if (!commitment) {
    return state.source === 'LEGACY_FALLBACK'
      ? ['RESCHEDULE', 'COMPLETE', 'CLOSE_UNMET', 'DISCARD', 'RECORD_PROGRESS']
      : [];
  }
  if (commitment.status !== 'active') return ['REOPEN'];

  const hasCapturedProgress = isCaptureComplete(commitment);
  const currentProgress = commitment.progressByPeriod[commitment.scheduledPeriod] ?? 0;
  const historyForPeriod = (commitment.resolutionHistory || []).filter(
    (h) => h.period === commitment.scheduledPeriod,
  );
  const lastOp = historyForPeriod[historyForPeriod.length - 1];
  const hasRecoverableVoid = currentProgress === 0 && lastOp?.type === 'VOID_PERIOD_PROGRESS' && (lastOp.previousValue ?? 0) > 0;

  const actions: ContinuityAction[] = ['RESCHEDULE', 'COMPLETE', 'CLOSE_UNMET', 'DISCARD'];

  if (hasCapturedProgress) {
    actions.push('ADJUST_PERIOD_PROGRESS', 'VOID_PERIOD_PROGRESS');
  } else {
    actions.push('RECORD_PROGRESS');
    if (hasRecoverableVoid) {
      actions.push('RESTORE_PROGRESS');
    }
  }

  if ((commitment.rescheduleHistory || []).some((entry) => entry.status === 'active')) {
    actions.splice(1, 0, 'UNDO_RESCHEDULE');
  }
  return actions;
};

const createFromActivity = (item: DashboardItem, activityId: string, originPeriod: number, year: number, weekly: boolean): ContinuityCommitment => {
  const activity = (item.activityConfig?.[originPeriod] || []).find(entry => entry.id === activityId);
  if (!activity) throw new Error('CONTINUITY_ACTIVITY_NOT_FOUND');
  return createKpiContinuityCommitment(item, activityId, year, originPeriod, year, originPeriod, {
    id: continuityKey(activityId), sourceType: 'ACTIVITY_KPI', sourceKpiId: String(item.id), sourceActivityId: activityId,
    originYear: year, originPeriod, originalTarget: 0, scheduledYear: year, scheduledPeriod: originPeriod,
    progressByPeriod: {}, status: 'active', outcome: 'in_progress', rescheduleHistory: [],
    resolutionHistory: [{ type: 'CREATE_CONTINUITY', at: new Date().toISOString() }],
  });
};

/** Applies the frozen engine to a persisted item without mutating legacy activityConfig. */
export const applyContinuityEventToItem = (
  item: DashboardItem, activityId: string, originPeriod: number, year: number, weekly: boolean,
  event: Exclude<ContinuityEvent, { type: 'CREATE_CONTINUITY' }>,
): DashboardItem => {
  const visible = getVisibleContinuityState(item, activityId);
  if (visible.commitment?.sourceType === 'SIMPLE_KPI') {
    return applySimpleKpiContinuityEventToItem(item, visible.commitment.originYear, visible.commitment.originPeriod, event);
  }
  const key = continuityKey(activityId);
  const current = visible.commitment || createFromActivity(item, activityId, originPeriod, year, weekly);
  const next = reduceContinuity(current, event);
  return { ...item, continuityCommitments: { ...(item.continuityCommitments || {}), [key]: next } };
};
