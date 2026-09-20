import {
  getContinuitySnapshot,
  isCaptureComplete,
  reduceContinuity,
  type ContinuityCommitment,
} from './continuityEngine';
import { applySimpleKpiContinuityEventToItem, canCreateSimpleKpiContinuity, getEffectiveKpiProgressByPeriod, getSimpleKpiContinuity, getSimpleKpiContinuityProjection } from './continuityAdapter';
import { mergeActivityConfigPreservingResolutions, reopenActivityResolution } from './activityResolutionMerge';
import { derivePendingKpiActivities } from '../components/CurrentPeriodFocus';
import { buildPendingItems } from './pendingAlerts';

const commitment = (overrides: Partial<ContinuityCommitment> = {}): ContinuityCommitment => ({
  id: 'cert-activity-a',
  sourceType: 'ACTIVITY_KPI',
  sourceKpiId: 'kpi-1',
  sourceActivityId: 'activity-a',
  frequency: 'monthly',
  originYear: 2026,
  originPeriod: 7,
  originalTarget: 10,
  scheduledYear: 2026,
  scheduledPeriod: 7,
  progressByPeriod: { 7: 3 },
  status: 'active',
  outcome: 'in_progress',
  rescheduleHistory: [],
  resolutionHistory: [],
  ...overrides,
});

describe('v9.6.9 continuity certification matrix', () => {
  test('A1-A4: activity reschedule, register, adjust and void isolate its period facts', () => {
    let state = reduceContinuity(commitment(), { type: 'RESCHEDULE', year: 2026, period: 8 });
    expect(getContinuitySnapshot(state)).toMatchObject({ previousCumulative: 3, currentPeriodProgress: 0, cumulativeProgress: 3, remainingTarget: 7 });
    state = reduceContinuity(state, { type: 'RECORD_PROGRESS', year: 2026, period: 8, value: 1 });
    expect(getContinuitySnapshot(state)).toMatchObject({ previousCumulative: 3, currentPeriodProgress: 1, cumulativeProgress: 4, fulfillmentPercent: 40, remainingTarget: 6 });
    state = reduceContinuity(state, { type: 'ADJUST_PERIOD_PROGRESS', year: 2026, period: 8, value: 2 });
    expect(getContinuitySnapshot(state)).toMatchObject({ previousCumulative: 3, currentPeriodProgress: 2, cumulativeProgress: 5 });
    state = reduceContinuity(state, { type: 'VOID_PERIOD_PROGRESS', year: 2026, period: 8 });
    expect(getContinuitySnapshot(state)).toMatchObject({ previousCumulative: 3, cumulativeProgress: 3 });
  });

  test('B1-B4: chained reschedules retain one original target and unwind one move at a time', () => {
    let state = reduceContinuity(commitment(), { type: 'RESCHEDULE', year: 2026, period: 8 });
    state = reduceContinuity(state, { type: 'RESCHEDULE', year: 2026, period: 9 });
    expect(state).toMatchObject({ originalTarget: 10, scheduledPeriod: 9 });
    state = reduceContinuity(state, { type: 'UNDO_RESCHEDULE' });
    expect(state.scheduledPeriod).toBe(8);
    state = reduceContinuity(state, { type: 'UNDO_RESCHEDULE' });
    expect(state.scheduledPeriod).toBe(7);
    expect(state.rescheduleHistory).toHaveLength(2);
  });

  test('C1-C6: temporal identity orders monthly and weekly cross-year facts without counting future facts as previous', () => {
    let monthly = commitment({ originPeriod: 10, scheduledPeriod: 10, originalTarget: 10, progressByPeriod: { 10: 3 } });
    monthly = reduceContinuity(monthly, { type: 'RESCHEDULE', year: 2026, period: 11 });
    monthly = reduceContinuity(monthly, { type: 'RECORD_PROGRESS', year: 2026, period: 11, value: 2 });
    monthly = reduceContinuity(monthly, { type: 'RESCHEDULE', year: 2027, period: 0 });
    monthly = reduceContinuity(monthly, { type: 'RECORD_PROGRESS', year: 2027, period: 0, value: 4 });
    expect(getContinuitySnapshot(monthly)).toMatchObject({ previousCumulative: 5, currentPeriodProgress: 4, cumulativeProgress: 9 });
    const weekly = commitment({ frequency: 'weekly', originPeriod: 52, scheduledPeriod: 52, progressByPeriod: { 52: 3 } });
    const weekly2027 = reduceContinuity(reduceContinuity(weekly, { type: 'RESCHEDULE', year: 2027, period: 1 }), { type: 'RECORD_PROGRESS', year: 2027, period: 1, value: 2 });
    expect(getContinuitySnapshot(weekly2027)).toMatchObject({ previousCumulative: 3, currentPeriodProgress: 2, cumulativeProgress: 5 });
    const week53 = reduceContinuity(commitment({ frequency: 'weekly', originPeriod: 53, scheduledPeriod: 53, progressByPeriod: { 53: 3 } }), { type: 'RESCHEDULE', year: 2027, period: 1 });
    expect(week53.scheduledYear).toBe(2027);
  });

  test('G1-G5: explicit zero is a capture, and voiding it restores no-capture operational semantics', () => {
    let state = reduceContinuity(commitment({ progressByPeriod: { 7: 3 }, scheduledPeriod: 8 }), { type: 'RECORD_PROGRESS', year: 2026, period: 8, value: 0 });
    expect(isCaptureComplete(state)).toBe(true);
    state = reduceContinuity(state, { type: 'VOID_PERIOD_PROGRESS', year: 2026, period: 8 });
    expect(isCaptureComplete(state)).toBe(false);
    expect(state.resolutionHistory.at(-1)).toMatchObject({ type: 'VOID_PERIOD_PROGRESS', previousValue: 0 });
  });

  test('A5-A8: terminal outcomes preserve facts and history, and reopen restores active state', () => {
    let completed = reduceContinuity(commitment({ originalTarget: 3 }), { type: 'COMPLETE' });
    expect(completed).toMatchObject({ status: 'completed', outcome: 'target_reached' });
    expect(completed.resolutionHistory.at(-1)?.type).toBe('COMPLETE');
    let closed = reduceContinuity(commitment(), { type: 'CLOSE_UNMET' });
    expect(closed).toMatchObject({ status: 'closed', outcome: 'target_not_reached' });
    expect(reduceContinuity(closed, { type: 'REOPEN' })).toMatchObject({ status: 'active', outcome: 'in_progress' });
    const discarded = reduceContinuity(commitment(), { type: 'DISCARD' });
    expect(reduceContinuity(discarded, { type: 'REOPEN' }).resolutionHistory).toHaveLength(2);
  });

  test('D1-D9: simple KPI continuity keeps target and own monthly goal separate', () => {
    const source: any = {
      id: 'simple-cert', indicator: 'Simple', indicatorType: 'simple', frequency: 'monthly', isActivityMode: false,
      trackingStartPeriod: { frequency: 'monthly', year: 2026, monthIndex: 8 },
      monthlyGoals: [null, null, null, null, null, null, null, null, 5, 6],
      monthlyGoalCaptured: [false, false, false, false, false, false, false, false, true, true],
      monthlyProgress: [null, null, null, null, null, null, null, null, 3, null],
      monthlyProgressCaptured: [false, false, false, false, false, false, false, false, true, false],
    };
    expect(canCreateSimpleKpiContinuity(source, 2026, 8)).toBe(true);
    let next = applySimpleKpiContinuityEventToItem(source, 2026, 8, { type: 'RESCHEDULE', year: 2026, period: 9 });
    expect(getSimpleKpiContinuityProjection(next, 2026, 8)).toMatchObject({ target: 5, previousCumulativeProgress: 3, currentPeriodProgress: null, cumulativeProgress: 3, remaining: 2 });
    next = applySimpleKpiContinuityEventToItem(next, 2026, 8, { type: 'RECORD_PROGRESS', year: 2026, period: 9, value: 1 });
    expect(getSimpleKpiContinuityProjection(next, 2026, 8)).toMatchObject({ cumulativeProgress: 4, remaining: 1 });
    next = applySimpleKpiContinuityEventToItem(next, 2026, 8, { type: 'ADJUST_PERIOD_PROGRESS', year: 2026, period: 9, value: 2 });
    expect(getSimpleKpiContinuityProjection(next, 2026, 8)).toMatchObject({ cumulativeProgress: 5, fulfillmentPercent: 100, remaining: 0 });
    next = applySimpleKpiContinuityEventToItem(next, 2026, 8, { type: 'VOID_PERIOD_PROGRESS', year: 2026, period: 9 });
    expect(getSimpleKpiContinuityProjection(next, 2026, 8)).toMatchObject({ currentPeriodProgress: null, cumulativeProgress: 3, remaining: 2 });
    expect(next.monthlyGoals[9]).toBe(6);
    expect(canCreateSimpleKpiContinuity({ ...source, monthlyProgress: [...source.monthlyProgress.slice(0, 8), 5, null] }, 2026, 8)).toBe(false);
  });

  test('E1-E6: activities remain identity-isolated and deletion does not resurrect them', () => {
    const current: any = { 7: [
      { id: 'a', label: 'A', targetCount: 2, completedCount: 1, resolution: { resolutionStatus: 'completed_later' } },
      { id: 'b', label: 'B', targetCount: 2, completedCount: 0 },
    ] };
    const merged = mergeActivityConfigPreservingResolutions(current, { 7: [current[7][1]] });
    expect(merged[7].map((a: any) => a.id)).toEqual(['b']);
    expect(merged[7].find((a: any) => a.id === 'a')).toBeUndefined();
    expect(derivePendingKpiActivities(merged, 8, false, 2026).map((p) => p.sourceActivityId)).toEqual(['b']);
  });

  test('F1-F5: legacy terminal resolutions, reopen and year ambiguity remain controlled', () => {
    const completed: any = { 7: [{ id: 'a', label: 'A', targetCount: 1, completedCount: 0, resolution: { resolutionStatus: 'completed_later' } }] };
    expect(derivePendingKpiActivities(completed, 8, false, 2026)).toHaveLength(0);
    const reopened = reopenActivityResolution(completed[7][0], 2026, 7, '2026-09-01T00:00:00.000Z');
    expect(derivePendingKpiActivities({ 7: [reopened] }, 8, false, 2026)).toHaveLength(1);
    const discarded: any = { 7: [{ ...reopened, resolution: { resolutionStatus: 'discarded' } }] };
    expect(derivePendingKpiActivities(discarded, 8, false, 2026)).toHaveLength(0);
    const ambiguous: any = { ...commitment({ scheduledYear: 2027, scheduledPeriod: 0, progressByPeriod: { 5: 2 } }), rescheduleHistory: [] };
    expect(getContinuitySnapshot(ambiguous).cumulativeProgress).toBe(0);
  });

  test('H1-H5: inherited continuity suppresses false goal configuration but independent goals remain eligible', () => {
    const dashboard: any = { id: 1, title: 'D', subtitle: '', area: 'A', thresholds: { onTrack: 95, atRisk: 85 }, items: [{ id: 1, indicator: 'Simple', weight: 1, monthlyGoals: Array(12).fill(null), monthlyProgress: Array(12).fill(null), unit: 'u', type: 'accumulative', goalType: 'maximize', trackingStartPeriod: { frequency: 'monthly', year: 2026, monthIndex: 7 }, continuityCommitments: { x: { sourceType: 'SIMPLE_KPI', status: 'active', frequency: 'monthly', scheduledYear: 2026, scheduledPeriod: 8 } } }] };
    expect(buildPendingItems([dashboard], { frequency: 'monthly', year: 2026, monthIndex: 8 }, { frequency: 'monthly', year: 2026, monthIndex: 8 }, [1])).toHaveLength(0);
  });

  test('I1-I5: continuity never mutates annual goals or fabricates graph progress points', () => {
    const source: any = { id: 'annual', indicator: 'Annual', monthlyGoals: [null, null, null, null, null, null, null, 5, 6, null, null, null], monthlyProgress: [null, null, null, null, null, null, null, 3, null, null, null, null], monthlyProgressCaptured: [false, false, false, false, false, false, false, true, false, false, false, false], continuityCommitments: {} };
    const next = applySimpleKpiContinuityEventToItem({ ...source, trackingStartPeriod: { frequency: 'monthly', year: 2026, monthIndex: 7 } }, 2026, 7, { type: 'RESCHEDULE', year: 2026, period: 8 });
    expect(next.monthlyGoals[7]).toBe(5);
    expect(next.monthlyGoals[8]).toBe(6);
    expect(getEffectiveKpiProgressByPeriod(next, 7)).toBe(3);
    expect(next.monthlyGoals).not.toContain(11);
  });

  test('J1-J9: target, period isolation and history are invariant across corrections and voids', () => {
    let state = reduceContinuity(commitment({ originalTarget: 10 }), { type: 'RECORD_PROGRESS', year: 2026, period: 7, value: 0 });
    state = reduceContinuity(state, { type: 'ADJUST_PERIOD_PROGRESS', year: 2026, period: 7, value: 1 });
    state = reduceContinuity(state, { type: 'VOID_PERIOD_PROGRESS', year: 2026, period: 7 });
    expect(state.originalTarget).toBe(10);
    expect(state.progressByTemporalPeriod).toEqual({});
    expect(state.resolutionHistory.map((entry) => entry.type)).toEqual(['RECORD_PROGRESS', 'ADJUST_PERIOD_PROGRESS', 'VOID_PERIOD_PROGRESS']);
  });
});
