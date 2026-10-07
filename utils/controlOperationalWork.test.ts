import { buildPendingItems } from './pendingAlerts';
import { derivePendingKpiActivities } from '../components/CurrentPeriodFocus';
import type { Dashboard, DashboardItem } from '../types';

/**
 * CONTROL semantics: CONFIGURAR vs REGISTRAR AVANCE vs GESTIONAR when the
 * current period has no activityConfig but inherited work is still active.
 * The same KPI must never be "POR CONFIGURAR" in CONTROL while its own
 * "ACCIONES POR ATENDER" tab lists active, unresolved actions.
 */
const AUG = { frequency: 'monthly' as const, year: 2026, monthIndex: 7 };
const OCT = { frequency: 'monthly' as const, year: 2026, monthIndex: 9 };
const empty = () => Array(12).fill(null);
const flags = () => Array(12).fill(false);

const kpi = (overrides: Partial<DashboardItem> = {}): DashboardItem => ({
  id: 1, indicator: 'KPI actividad', weight: 1, unit: 'u', type: 'accumulative', goalType: 'maximize',
  frequency: 'monthly', isActivityMode: true, trackingStartPeriod: AUG,
  monthlyGoals: empty(), monthlyProgress: empty(), monthlyGoalCaptured: flags(), monthlyProgressCaptured: flags(),
  ...overrides,
} as DashboardItem);

const board = (item: DashboardItem): Dashboard => ({ id: 1, title: 'D', subtitle: '', area: 'A', thresholds: { onTrack: 95, atRisk: 85 }, items: [item] } as Dashboard);
const classify = (item: DashboardItem, period = OCT) => buildPendingItems([board(item)], period, period, [1]).map(x => x.type);
const attentionCount = (item: DashboardItem) =>
  derivePendingKpiActivities(item.activityConfig, OCT.monthIndex, false, OCT.year, item)
    .filter(a => !['REPROGRAMADA', 'COMPROMISO ACTUAL'].includes(a.status)).length;

// The UI legacy derivation reads the wall clock; pin it to October 2026.
beforeAll(() => { jest.useFakeTimers(); jest.setSystemTime(new Date('2026-10-15T12:00:00')); });
afterAll(() => { jest.useRealTimers(); });

const septemberLegacy = (overrides: Record<string, unknown> = {}) => ({ 8: [{ id: 'sep', label: 'Evento septiembre', targetCount: 2, completedCount: 0, ...overrides }] });
const canonical = (overrides: Record<string, unknown> = {}) => ({
  'activity:sep': {
    id: 'activity:sep', sourceType: 'ACTIVITY_KPI', sourceKpiId: '1', sourceActivityId: 'sep', frequency: 'monthly',
    originYear: 2026, originPeriod: 8, originalTarget: 2, scheduledYear: 2026, scheduledPeriod: 8,
    progressByPeriod: {}, status: 'active', outcome: 'in_progress', rescheduleHistory: [], resolutionHistory: [],
    ...overrides,
  },
});

describe('RED: empty current activityConfig + inherited active action', () => {
  test('legacy September action still pending is shown in ACCIONES POR ATENDER and is NOT a configuration gap', () => {
    const item = kpi({ activityConfig: septemberLegacy() });
    expect(attentionCount(item)).toBe(1);
    expect(classify(item)).not.toContain('MISSING_GOAL');
    expect(classify(item)).toEqual(['MISSING_PROGRESS']);
  });

  test('canonical overdue commitment (scheduled September, still active) is NOT a configuration gap', () => {
    const item = kpi({ activityConfig: septemberLegacy(), continuityCommitments: canonical() as any });
    expect(attentionCount(item)).toBe(1);
    expect(classify(item)).toEqual(['MISSING_PROGRESS']);
  });
});

describe('CONTROL configuration/capture/management matrix', () => {
  test('1. no goal, no activities, no actions -> CONFIGURAR', () => {
    const [pending] = buildPendingItems([board(kpi())], OCT, OCT, [1]);
    expect(pending.type).toBe('MISSING_GOAL');
    expect(pending.actionLabel).toBe('CONFIGURAR');
  });

  test('2. current-period activities without progress -> REGISTRAR AVANCE', () => {
    const [pending] = buildPendingItems([board(kpi({ activityConfig: { 9: [{ id: 'oct', label: 'Oct', targetCount: 3, completedCount: 0 }] } as any }))], OCT, OCT, [1]);
    expect(pending.type).toBe('MISSING_PROGRESS');
    expect(pending.actionLabel).toBe('REGISTRAR AVANCE');
  });

  test('3/4. empty month + inherited active action -> REGISTRAR AVANCE (category CAPTURA) with explicit message', () => {
    const [pending] = buildPendingItems([board(kpi({ activityConfig: septemberLegacy() as any }))], OCT, OCT, [1]);
    expect(pending.category).toBe('CAPTURA');
    expect(pending.actionLabel).toBe('REGISTRAR AVANCE');
    expect(pending.message).toMatch(/acciones o compromisos activos/i);
  });

  test('5. current activity with critical captured result -> GESTIONAR', () => {
    const item = kpi({ activityConfig: { ...septemberLegacy(), 9: [{ id: 'oct', label: 'Oct', targetCount: 10, completedCount: 2 }] } as any });
    const [pending] = buildPendingItems([board(item)], OCT, OCT, [1]);
    expect(pending.type).toBe('RESULT_CRITICAL');
    expect(pending.actionLabel).toBe('GESTIONAR');
  });

  test('6. resolved actions do not count', () => {
    expect(classify(kpi({ activityConfig: septemberLegacy({ completedCount: 2 }) as any }))).toEqual(['MISSING_GOAL']);
    expect(classify(kpi({ activityConfig: septemberLegacy({ resolution: { resolutionStatus: 'completed_later' } }) as any }))).toEqual(['MISSING_GOAL']);
    expect(classify(kpi({ activityConfig: septemberLegacy() as any, continuityCommitments: canonical({ status: 'completed' }) as any }))).toEqual(['MISSING_GOAL']);
    expect(classify(kpi({ activityConfig: septemberLegacy() as any, continuityCommitments: canonical({ status: 'closed' }) as any }))).toEqual(['MISSING_GOAL']);
  });

  test('7. cancelled/discarded actions do not count', () => {
    expect(classify(kpi({ activityConfig: septemberLegacy({ resolution: { resolutionStatus: 'discarded' } }) as any }))).toEqual(['MISSING_GOAL']);
    expect(classify(kpi({ activityConfig: septemberLegacy() as any, continuityCommitments: canonical({ status: 'discarded' }) as any }))).toEqual(['MISSING_GOAL']);
  });

  test('8. future actions are not demanded early and do not mask configuration', () => {
    expect(classify(kpi({ activityConfig: { 10: [{ id: 'nov', label: 'Nov', targetCount: 2, completedCount: 0 }] } as any }))).toEqual(['MISSING_GOAL']);
    expect(classify(kpi({ activityConfig: septemberLegacy() as any, continuityCommitments: canonical({ scheduledPeriod: 11 }) as any }))).toEqual(['MISSING_GOAL']);
  });

  test('9. continuity scheduled in the current period -> no false MISSING_GOAL (H1-H5 preserved)', () => {
    expect(classify(kpi({ activityConfig: septemberLegacy() as any, continuityCommitments: canonical({ scheduledPeriod: 9 }) as any }))).toEqual([]);
  });

  test('10. before effective tracking start -> no pending even with inherited actions', () => {
    const item = kpi({ trackingStartPeriod: { frequency: 'monthly', year: 2026, monthIndex: 10 }, activityConfig: septemberLegacy() as any });
    expect(classify(item)).toEqual([]);
  });

  test('11. explicit zero goal is a valid capture and is respected', () => {
    const item = kpi({ isActivityMode: false, monthlyGoals: Object.assign(empty(), { 9: 0 }), monthlyGoalCaptured: Object.assign(flags(), { 9: true }) });
    expect(classify(item)).toEqual(['MISSING_PROGRESS']);
  });

  test('12. isolated legacy zero without marker stays ambiguous (H07 preserved)', () => {
    const item = kpi({ isActivityMode: false, monthlyGoals: Object.assign(empty(), { 9: 0 }), monthlyGoalCaptured: undefined as any });
    expect(classify(item)).toEqual(['MISSING_GOAL']);
  });
});
