import { calculateGapToTarget } from './ReportCenter';

describe('report metric semantics', () => {
  it('calculates the percentage-point gap to a 100% target', () => {
    expect(calculateGapToTarget(79)).toBe(21);
    expect(calculateGapToTarget(100)).toBe(0);
    expect(calculateGapToTarget(103)).toBe(0);
  });
});
