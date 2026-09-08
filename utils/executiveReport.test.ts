import { buildExecutiveReportViewModel } from './executiveReport';

const item = (id: string, progress: number | null, target = 100): any => ({ id, indicator: id, weight: 1, monthlyGoals: [target], monthlyProgress: [progress], unit: '%', type: 'average', goalType: 'maximize' });
const alert = (id: string, severity = 'CRÍTICO', score = 50): any => ({ id, indicator: id, severity, performanceScore: score, isOvertRisk: false, isDeteriorating: true, trend: 'DETERIORÁNDOSE', dataStatus: 'DATOS INCOMPLETOS' });
const thresholds = { onTrack: 90, atRisk: 70 };

describe('executive report view model', () => {
  it('counts critical KPIs', () => expect(buildExecutiveReportViewModel([item('a', 20)], [], thresholds, 2026, [alert('a')], 0, 20, 100).status.counts['CRÍTICO']).toBe(1));
  it('counts attention KPIs', () => expect(buildExecutiveReportViewModel([item('a', 80)], [], thresholds, 2026, [], 0, 80, 100).status.counts['ATENCIÓN']).toBe(1));
  it('counts controlled KPIs', () => expect(buildExecutiveReportViewModel([item('a', 100)], [], thresholds, 2026, [], 0, 100, 100).status.counts['BAJO CONTROL']).toBe(1));
  it('counts non evaluable KPIs without data', () => expect(buildExecutiveReportViewModel([item('a', null, 0)], [], thresholds, 2026, [], 0, 0, 0).status.counts['NO EVALUABLE']).toBe(1));
  it('limits decision focus to five matters', () => expect(buildExecutiveReportViewModel([], [], thresholds, 2026, Array.from({ length: 8 }, (_, i) => alert(String(i))), 0, 0, 0).decisionFocus).toHaveLength(5));
  it('keeps active plan context separate from KPI alerts', () => expect(buildExecutiveReportViewModel([], [], thresholds, 2026, [alert('a')], 2, 0, 0).contextActions.activePlans).toBe(2));
  it('reports pending data independently', () => expect(buildExecutiveReportViewModel([], [], thresholds, 2026, [alert('a')], 0, 0, 0).contextActions.pendingData).toBe(1));
  it('does not require strategic objectives', () => expect(buildExecutiveReportViewModel([item('a', 100)], [], thresholds, 2026, [], 0, 100, 100).status.condition).toBe('BAJO CONTROL'));
  it('accepts an individual dashboard scope', () => expect(buildExecutiveReportViewModel([item('a', 100)], [{ id: 'd1', items: [item('a', 100)] } as any], thresholds, 2026, [], 0, 100, 100).status.globalScore).toBe(100));
  it('keeps executive metrics read-only and derived', () => expect(buildExecutiveReportViewModel([], [], thresholds, 2027, [], 0, 0, 0).changes.currentPeriod).toBe(2027));
});
