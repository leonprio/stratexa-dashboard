import {
  compareTrackingPeriods,
  getKpiTrackingObligation,
  resolveTrackingStartPeriod,
  getEffectiveTrackingStartPeriod,
  suggestTrackingStartFromGoalHistory,
  selectKpiTrackingCaptureForPeriod,
} from './trackingObligation';

const monthly = (year: number, monthIndex: number) => ({ frequency: 'monthly' as const, year, monthIndex });
const weekly = (year: number, weekNumber: number) => ({ frequency: 'weekly' as const, year, weekNumber });

describe('tracking obligation', () => {
  test('monthly: before, start without goal, missing progress, explicit zero, and future', () => {
    const start = monthly(2026, 7);
    const base = { frequency: 'monthly' as const, trackingStartPeriod: start, operationalPeriod: monthly(2026, 8) };
    expect(getKpiTrackingObligation({ ...base, period: monthly(2026, 6) })).toBe('NOT_REQUIRED');
    expect(getKpiTrackingObligation({ ...base, period: start })).toBe('GOAL_REQUIRED');
    expect(getKpiTrackingObligation({ ...base, period: start, goalValue: 10, goalCaptured: true })).toBe('PROGRESS_REQUIRED');
    expect(getKpiTrackingObligation({ ...base, period: start, goalValue: 0, goalCaptured: true, progressValue: 0, progressCaptured: true })).toBe('CAPTURE_COMPLETE');
    expect(getKpiTrackingObligation({ ...base, period: monthly(2026, 9) })).toBe('FUTURE');
  });

  test('weekly: before, start, after, future and explicit zero', () => {
    const start = weekly(2026, 34);
    const base = { frequency: 'weekly' as const, trackingStartPeriod: start, operationalPeriod: weekly(2026, 36) };
    expect(getKpiTrackingObligation({ ...base, period: weekly(2026, 33) })).toBe('NOT_REQUIRED');
    expect(getKpiTrackingObligation({ ...base, period: start })).toBe('GOAL_REQUIRED');
    expect(getKpiTrackingObligation({ ...base, period: weekly(2026, 35), goalValue: 1, goalCaptured: true })).toBe('PROGRESS_REQUIRED');
    expect(getKpiTrackingObligation({ ...base, period: weekly(2026, 36), goalValue: 0, goalCaptured: true, progressValue: 0, progressCaptured: true })).toBe('CAPTURE_COMPLETE');
    expect(getKpiTrackingObligation({ ...base, period: weekly(2026, 37) })).toBe('FUTURE');
  });

  test('never assigns an implicit January or week one when start is absent', () => {
    expect(getKpiTrackingObligation({ frequency: 'monthly', period: monthly(2026, 7), operationalPeriod: monthly(2026, 8) })).toBe('TRACKING_START_UNDEFINED');
    expect(getKpiTrackingObligation({ frequency: 'weekly', period: weekly(2026, 34), operationalPeriod: weekly(2026, 35) })).toBe('TRACKING_START_UNDEFINED');
  });

  test('KPI override wins over dashboard and client defaults', () => {
    const resolved = resolveTrackingStartPeriod(
      { trackingStartPeriod: monthly(2026, 8) } as any,
      { defaultTrackingStartPeriod: monthly(2026, 7) },
      { defaultTrackingStartPeriod: monthly(2026, 6) },
    );
    expect(resolved).toEqual(monthly(2026, 8));
    expect(resolveTrackingStartPeriod({} as any, { defaultTrackingStartPeriod: monthly(2026, 7) }, { defaultTrackingStartPeriod: monthly(2026, 6) })).toEqual(monthly(2026, 7));
  });

  test('effective source changes back when KPI or dashboard overrides are removed', () => {
    expect(getEffectiveTrackingStartPeriod({ trackingStartPeriod: monthly(2026, 8) } as any, { defaultTrackingStartPeriod: monthly(2026, 7) }, { defaultTrackingStartPeriod: monthly(2026, 6) })).toMatchObject({ source: 'KPI' });
    expect(getEffectiveTrackingStartPeriod({} as any, { defaultTrackingStartPeriod: monthly(2026, 7) }, { defaultTrackingStartPeriod: monthly(2026, 6) })).toMatchObject({ source: 'DASHBOARD' });
    expect(getEffectiveTrackingStartPeriod({} as any, {}, { defaultTrackingStartPeriod: monthly(2026, 6) })).toMatchObject({ source: 'CLIENT' });
    expect(getEffectiveTrackingStartPeriod({} as any)).toMatchObject({ source: 'UNDEFINED' });
  });

  test('suggests only an evidenced first goal, including explicit zero', () => {
    expect(suggestTrackingStartFromGoalHistory('monthly', 2026, [null, null, 0], [false, false, true])).toEqual(monthly(2026, 2));
    expect(suggestTrackingStartFromGoalHistory('weekly', 2026, [null, 10])).toEqual(weekly(2026, 2));
    expect(suggestTrackingStartFromGoalHistory('monthly', 2026, [0, null], [false, false])).toBeUndefined();
  });

  test('compares cross-year monthly and weekly periods without Date', () => {
    expect(compareTrackingPeriods(monthly(2026, 11), monthly(2027, 0))).toBe(-1);
    expect(compareTrackingPeriods(weekly(2026, 53), weekly(2027, 1))).toBe(-1);
    expect(compareTrackingPeriods(monthly(2027, 0), monthly(2027, 0))).toBe(0);
  });

  test('capture denominator includes only required KPIs: 7 captured out of 7 required is 100%', () => {
    const base = { frequency: 'monthly' as const, period: monthly(2026, 7), operationalPeriod: monthly(2026, 7), trackingStartPeriod: monthly(2026, 7), goalValue: 1, goalCaptured: true, progressValue: 0, progressCaptured: true };
    const selected = selectKpiTrackingCaptureForPeriod([
      ...Array.from({ length: 7 }, (_, index) => ({ ...base, kpiId: `required-${index}` })),
      ...Array.from({ length: 3 }, (_, index) => ({ ...base, kpiId: `future-${index}`, period: monthly(2026, 8) })),
    ]);
    expect(selected.requiredKpisForPeriod).toHaveLength(7);
    expect(selected.capturedKpisForPeriod).toHaveLength(7);
    expect(Math.round((selected.capturedKpisForPeriod.length / selected.requiredKpisForPeriod.length) * 100)).toBe(100);
  });

  test('area-only and no-strategy-shaped KPI input needs no strategic dependency', () => {
    expect(getKpiTrackingObligation({ frequency: 'monthly', period: monthly(2026, 7), operationalPeriod: monthly(2026, 7), trackingStartPeriod: monthly(2026, 7), goalValue: 1, goalCaptured: true, progressValue: 1, progressCaptured: true })).toBe('CAPTURE_COMPLETE');
  });
});
