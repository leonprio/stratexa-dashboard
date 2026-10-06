import type { DashboardItem } from '../types';
import { buildResolutionHistory } from './resolutionHistory';

const commitment = (resolutionHistory: Array<{ type: string; at: string }>) => ({
  id: 'simple-kpi:1:monthly:2026:7',
  sourceType: 'SIMPLE_KPI' as const,
  sourceKpiId: '1',
  originYear: 2026,
  originPeriod: 7,
  originalTarget: 10,
  scheduledYear: 2026,
  scheduledPeriod: 7,
  progressByPeriod: {},
  status: 'active' as const,
  outcome: 'in_progress' as const,
  rescheduleHistory: [],
  resolutionHistory,
});

const itemWithHistory = (resolutionHistory: Array<{ type: string; at: string }>) => ({
  id: 1,
  indicator: 'Meta de prueba',
  weight: 100,
  unit: 'unidades',
  type: 'stock',
  goalType: 'maximize',
  monthlyGoals: [],
  monthlyProgress: [],
  continuityCommitments: { 'simple-kpi:1:monthly:2026:7': commitment(resolutionHistory) },
} as unknown as DashboardItem);

describe('buildResolutionHistory canonical event labels', () => {
  test.each([
    ['COMPLETE', 'COMPLETADO'],
    ['CLOSE_UNMET', 'CERRADO'],
    ['REOPEN', 'REABIERTO'],
    ['DISCARD', 'DESCARTADO'],
    ['RESCHEDULE', 'REPROGRAMADO'],
    ['UNDO_RESCHEDULE', 'REPROGRAMADO'],
  ])('maps %s to %s', (type, expectedStatus) => {
    const rows = buildResolutionHistory(itemWithHistory([{ type, at: '2026-09-10T12:30:00.000Z' }]), 2026);
    expect(rows.map(row => row.status)).toEqual([expectedStatus]);
    expect(rows[0].resolvedAt).toBe('2026-09-10T12:30:00.000Z');
  });

  test('does not interpret progress or creation events as reopening and preserves event order and dates', () => {
    const rows = buildResolutionHistory(itemWithHistory([
      { type: 'CREATE_CONTINUITY', at: '2026-09-01T00:00:00.000Z' },
      { type: 'RECORD_PROGRESS', at: '2026-09-02T00:00:00.000Z' },
      { type: 'COMPLETE', at: '2026-09-03T00:00:00.000Z' },
      { type: 'REOPEN', at: '2026-09-04T00:00:00.000Z' },
    ]), 2026);

    expect(rows.map(({ status, resolvedAt }) => [status, resolvedAt])).toEqual([
      ['COMPLETADO', '2026-09-03T00:00:00.000Z'],
      ['REABIERTO', '2026-09-04T00:00:00.000Z'],
    ]);
    expect(rows.map(row => row.id)).toEqual([
      'simple-kpi:1:monthly:2026:7:history:2',
      'simple-kpi:1:monthly:2026:7:history:3',
    ]);
  });
});
