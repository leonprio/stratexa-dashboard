import { getObligationStatus } from './obligationStatus';

const monthly = (year: number, monthIndex: number) => ({ frequency: 'monthly' as const, year, monthIndex });
const weekly = (year: number, weekNumber: number) => ({ frequency: 'weekly' as const, year, weekNumber });

describe('obligation temporal status', () => {
  it('classifies monthly current, previous, future and pre-start', () => {
    const september = monthly(2026, 8);
    expect(getObligationStatus('PROGRESS_REQUIRED', september, september)).toBe('VIGENTE');
    expect(getObligationStatus('PROGRESS_REQUIRED', monthly(2026, 7), september)).toBe('ATRASADA');
    expect(getObligationStatus('GOAL_REQUIRED', monthly(2026, 9), september)).toBe('FUTURA');
    expect(getObligationStatus('NOT_REQUIRED', monthly(2026, 7), september)).toBe('NO_EXIGIBLE');
  });
  it('classifies weekly current, previous and future', () => {
    expect(getObligationStatus('PROGRESS_REQUIRED', weekly(2026, 35), weekly(2026, 35))).toBe('VIGENTE');
    expect(getObligationStatus('PROGRESS_REQUIRED', weekly(2026, 34), weekly(2026, 35))).toBe('ATRASADA');
    expect(getObligationStatus('GOAL_REQUIRED', weekly(2026, 36), weekly(2026, 35))).toBe('FUTURA');
  });
  it('handles year boundaries and complete obligations', () => {
    expect(getObligationStatus('PROGRESS_REQUIRED', monthly(2026, 11), monthly(2027, 0))).toBe('ATRASADA');
    expect(getObligationStatus('PROGRESS_REQUIRED', monthly(2027, 0), monthly(2027, 0))).toBe('VIGENTE');
    expect(getObligationStatus('CAPTURE_COMPLETE', monthly(2027, 0), monthly(2027, 0))).toBe('NO_EXIGIBLE');
  });
});
