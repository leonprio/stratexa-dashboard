import { getFirstMeaningfulTrackingIndex } from './CurrentPeriodFocus';

const base = { monthlyProgress: Array(12).fill(0), monthlyGoals: Array(12).fill(0) } as any;

describe('inicio semántico de gráfica mensual', () => {
  test('inicia en agosto y no convierte enero-julio en ceros', () => {
    expect(getFirstMeaningfulTrackingIndex({ ...base, monthlyGoals: [null, null, null, null, null, null, null, 20] })).toBe(7);
  });
  test('un real explícito cero en agosto cuenta como captura', () => {
    expect(getFirstMeaningfulTrackingIndex({ ...base, monthlyGoals: [null, null, null, null, null, null, null, 20], monthlyProgressCaptured: [false, false, false, false, false, false, false, true] })).toBe(7);
  });
  test('sin datos no crea una serie artificial', () => {
    expect(getFirstMeaningfulTrackingIndex(base)).toBe(12);
  });
});
