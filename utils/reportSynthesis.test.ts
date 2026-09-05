import { resolvePreviousComparablePeriod } from './reportSynthesis';

describe('report synthesis comparable period', () => {
  it('skips missing periods instead of treating them as zero', () => {
    expect(resolvePreviousComparablePeriod([82, null, 86], 2)).toEqual({ currentPeriodIndex: 2, priorPeriodIndex: 0, currentScore: 86, priorScore: 82, delta: 4, status: 'AVAILABLE' });
  });

  it('returns not available when there is no comparable prior evidence', () => {
    expect(resolvePreviousComparablePeriod([null, 86], 1).status).toBe('NOT_AVAILABLE');
  });
});
