import { isMonthlyPeriodOverdue } from './compliance';
import { derivePendingKpiActivities } from '../components/CurrentPeriodFocus';

describe('semántica canónica de periodos vencidos', () => {
  const activity = { id: 'a1', label: 'Captura', targetCount: 1, completedCount: 0 };

  it('clasifica anterior como vencido y el periodo actual como vigente', () => {
    const reference = new Date('2026-09-15T12:00:00Z');
    expect(isMonthlyPeriodOverdue(2026, 7, reference)).toBe(true);
    expect(isMonthlyPeriodOverdue(2026, 8, reference)).toBe(false);
    expect(isMonthlyPeriodOverdue(2026, 9, reference)).toBe(false);
  });

  it('excluye actividad del periodo actual y conserva la anterior', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-15T12:00:00Z'));
    const pending = derivePendingKpiActivities({ 7: [activity], 8: [{ ...activity, id: 'a2' }], 9: [{ ...activity, id: 'a3' }] }, 8, false, 2026);
    expect(pending.map((entry) => entry.sourceActivityId)).toEqual(['a1']);
    expect(pending[0].status).toBe('ATRASADA');
    jest.useRealTimers();
  });

  it('excluye años futuros y trata diciembre/enero correctamente', () => {
    const reference = new Date('2027-01-10T12:00:00Z');
    expect(isMonthlyPeriodOverdue(2026, 11, reference)).toBe(true);
    expect(isMonthlyPeriodOverdue(2027, 0, reference)).toBe(false);
    expect(isMonthlyPeriodOverdue(2027, 1, reference)).toBe(false);
  });
});
