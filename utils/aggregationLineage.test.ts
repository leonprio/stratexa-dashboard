import { calculateAggregateDashboard } from './aggregationUtils';
import type { Dashboard, DashboardItem } from '../types';

const series = (values: (number | null)[]) => [...values, ...new Array(12 - values.length).fill(null)];
const item = (id: string, progress: (number | null)[], options: Partial<DashboardItem> = {}): DashboardItem => ({
  id, indicator: 'Actividades realizadas', semanticKey: 'activities', weight: 100,
  unit: 'Actividades', type: 'accumulative', goalType: 'maximize',
  monthlyGoals: series(progress.map(value => value === null ? null : 1)), monthlyProgress: series(progress), ...options,
});
const board = (id: string, itemValue: DashboardItem): Dashboard => ({
  id, title: id, subtitle: '', year: 2026, thresholds: { onTrack: 90, atRisk: 75 }, items: [itemValue],
});
const annual = (dashboard: Dashboard) => dashboard.items[0].monthlyProgress.slice(0, 8).reduce((sum, value) => sum + (value ?? 0), 0);

describe('universal aggregation lineage', () => {
  const gto = board('GTO', item('gto-activities', [3, 3, 3, 3, 3, 3, 3, 5])); // 26
  const qro = board('QRO', item('qro-activities', [2, 2, 3, 3, 3, 3, 2, 5])); // 23

  test('derivative 49 does not re-contribute its already-present physical sources', () => {
    const derived = board('NATIONAL', item('national-derived', [5, 5, 6, 6, 6, 6, 5, 10], {
      contributionKind: 'derived',
      derivedFrom: [{ dashboardId: 'GTO', itemId: 'gto-activities' }, { dashboardId: 'QRO', itemId: 'qro-activities' }],
    }));
    expect(annual(calculateAggregateDashboard([derived, gto, qro]))).toBe(49);
  });

  test('a derivative never overlaps a partially authorized physical source', () => {
    const derived = board('NATIONAL', item('national-derived', [5, 5, 6, 6, 6, 6, 5, 10], {
      contributionKind: 'derived',
      derivedFrom: [{ dashboardId: 'GTO', itemId: 'gto-activities' }, { dashboardId: 'QRO', itemId: 'qro-activities' }],
    }));
    // QRO is outside this fixture's authorized scope. The derivative cannot
    // re-add GTO or expose QRO through its combined value.
    expect(annual(calculateAggregateDashboard([derived, gto]))).toBe(26);
  });

  test('independent national results remain additive even when equal to a state total', () => {
    const nationalOwn = board('NATIONAL', item('national-own', [1, 0, 1, 0, 1, 0, 1, 1]));
    expect(annual(calculateAggregateDashboard([nationalOwn, gto, qro]))).toBe(54);
  });

  test('49 independent national results make a legitimate total of 98', () => {
    const nationalOwn = board('NATIONAL', item('national-own', [5, 5, 6, 6, 6, 6, 5, 10]));
    expect(annual(calculateAggregateDashboard([nationalOwn, gto, qro]))).toBe(98);
  });

  test('same visible title with distinct semantic identities remains distinct', () => {
    const left = board('LEFT', { ...item('left', [4]), semanticKey: 'regional-activities' });
    const right = board('RIGHT', { ...item('right', [7]), semanticKey: 'national-activities' });
    const aggregate = calculateAggregateDashboard([left, right]);
    expect(aggregate.items).toHaveLength(2);
    expect(aggregate.items.map(i => i.monthlyProgress[0]).sort()).toEqual([4, 7]);
  });

  test('an explicit zero remains captured while absence stays absent', () => {
    const zero = board('ZERO', item('zero', [0, null]));
    const absent = board('ABSENT', item('absent', [null, null]));
    const aggregate = calculateAggregateDashboard([zero, absent]);
    expect(aggregate.items[0].monthlyProgress[0]).toBe(0);
    expect(aggregate.items[0].monthlyProgress[1]).toBeNull();
  });
});
