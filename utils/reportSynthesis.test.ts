import { resolvePreviousComparablePeriod } from './reportSynthesis';

describe('report synthesis comparable period', () => {
  it('skips missing periods instead of treating them as zero', () => {
    expect(resolvePreviousComparablePeriod([82, null, 86], 2)).toEqual({ currentPeriodIndex: 2, priorPeriodIndex: 0, currentScore: 86, priorScore: 82, delta: 4, status: 'AVAILABLE' });
  });

  it('returns not available when there is no comparable prior evidence', () => {
    expect(resolvePreviousComparablePeriod([null, 86], 1).status).toBe('NOT_AVAILABLE');
  });

  it('keeps headline, last evaluated point and delta coherent', () => {
    const result = resolvePreviousComparablePeriod([null, null, null, null, null, null, null, 81, 53, null, null, null], 8);
    expect(result.currentScore).toBe(53);
    expect(result.priorScore).toBe(81);
    expect(result.delta).toBe(-28);
  });

  it('excludes future periods from the comparison', () => {
    const result = resolvePreviousComparablePeriod([81, 53, 99, 99], 1);
    expect(result.currentScore).toBe(53);
    expect(result.priorScore).toBe(81);
  });
});
