import type { Dashboard, DashboardItem } from '../types';
import { isValidControlTarget, type ControlNavigationTarget } from './controlNavigation';
import { readControlPeriodValues } from './controlValues';
import { buildOperationalAlerts } from './operationalAlerts';

const makeItem = (id: number): DashboardItem => ({
  id, indicator: 'Indicador homónimo', weight: 1, unit: 'u', type: 'accumulative', goalType: 'maximize', frequency: 'monthly',
  monthlyGoals: Array(12).fill(null), monthlyProgress: Array(12).fill(null),
  monthlyGoalCaptured: Array(12).fill(false), monthlyProgressCaptured: Array(12).fill(false),
});
const board = (clientId: string, id: number, item: DashboardItem): Dashboard => ({
  id, clientId, title: `Tablero ${id}`, subtitle: '', items: [item], thresholds: { onTrack: 95, atRisk: 85 }, periodicity: item.frequency,
});
const target = (clientId: string, dashboardId: number, itemId: number): ControlNavigationTarget => ({
  clientId, dashboardId, itemId, period: { frequency: 'monthly', year: 2026, monthIndex: 8 }, operation: 'REGISTRAR_AVANCE', origin: 'control',
});

test('navigation identity rejects another client, dashboard, KPI, year, or frequency', () => {
  const a = board('LAB-A', 101, makeItem(1));
  const b = board('LAB-B', 201, makeItem(1));
  expect(isValidControlTarget(target('LAB-A', 101, 1), [a, b], 2026, 'LAB-A')).toBe(true);
  expect(isValidControlTarget(target('LAB-B', 101, 1), [a, b], 2026, 'LAB-A')).toBe(false);
  expect(isValidControlTarget(target('LAB-A', 201, 1), [a, b], 2026, 'LAB-A')).toBe(false);
  expect(isValidControlTarget(target('LAB-A', 101, 2), [a, b], 2026, 'LAB-A')).toBe(false);
  expect(isValidControlTarget(target('LAB-A', 101, 1), [a, b], 2025, 'LAB-A')).toBe(false);
  expect(isValidControlTarget({ ...target('LAB-A', 101, 1), period: { frequency: 'weekly', year: 2026, weekNumber: 39 } }, [a, b], 2026, 'LAB-A')).toBe(false);
});

test('period source distinguishes missing capture from an explicitly recorded zero', () => {
  const item = makeItem(1);
  item.monthlyGoals[8] = 10;
  item.monthlyGoalCaptured![8] = true;
  item.monthlyProgress[8] = 0;
  const period = { frequency: 'monthly' as const, year: 2026, monthIndex: 8 };
  expect(readControlPeriodValues(item, period)).toEqual({ goal: 10, progress: undefined, pending: undefined });
  item.monthlyProgressCaptured![8] = true;
  expect(readControlPeriodValues(item, period)).toEqual({ goal: 10, progress: 0, pending: 10 });
  item.monthlyGoals[8] = 0;
  item.monthlyGoalCaptured![8] = false;
  expect(readControlPeriodValues(item, period).goal).toBeUndefined();
});

test('period pending preserves minimization semantics without changing formulas', () => {
  const item = { ...makeItem(2), goalType: 'minimize' as const };
  item.monthlyGoals[8] = 5; item.monthlyGoalCaptured![8] = true;
  item.monthlyProgress[8] = 8; item.monthlyProgressCaptured![8] = true;
  const period = { frequency: 'monthly' as const, year: 2026, monthIndex: 8 };
  expect(readControlPeriodValues(item, period).pending).toBe(3);
  item.monthlyProgress[8] = 4;
  expect(readControlPeriodValues(item, period).pending).toBe(0);
});

test('operational values label current period separately from canonical accumulated values', () => {
  jest.useFakeTimers().setSystemTime(new Date(2026, 8, 25));
  try {
    const item = makeItem(1);
    item.monthlyGoals[0] = 10; item.monthlyGoalCaptured![0] = true;
    item.monthlyProgress[0] = 5; item.monthlyProgressCaptured![0] = true;
    item.monthlyGoals[8] = 12; item.monthlyGoalCaptured![8] = true;
    const [alert] = buildOperationalAlerts([board('LAB-A', 101, item)], { onTrack: 95, atRisk: 85 }, 2026);
    expect(alert.period).toEqual({ frequency: 'monthly', year: 2026, monthIndex: 8 });
    expect(alert.periodGoal).toBe(12);
    expect(alert.periodProgress).toBeUndefined();
    expect(alert.periodPending).toBeUndefined();
    // The certified compliance engine evaluates the last captured cut (January), not September.
    expect(alert.goal).toBe(10);
    expect(alert.progress).toBe(5);
  } finally { jest.useRealTimers(); }
});
