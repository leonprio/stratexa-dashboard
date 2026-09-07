import { isMonthlyPeriodOverdue } from './compliance';
import { compareCalendarPeriods, derivePendingKpiActivities } from '../components/CurrentPeriodFocus';

describe('semántica canónica de periodos vencidos', () => {
  const activity = { id: 'a1', label: 'Captura', targetCount: 1, completedCount: 0 };

  it.each([
    ['agosto 2026 -> enero 2027 en septiembre 2026', 2027, 0, 2026, 8, 1],
    ['agosto 2026 -> julio 2026 en septiembre 2026', 2026, 6, 2026, 8, -1],
    ['agosto 2026 -> septiembre 2026 en septiembre 2026', 2026, 8, 2026, 8, 0],
    ['diciembre 2026 -> enero 2027 en diciembre 2026', 2027, 0, 2026, 11, 1],
    ['enero 2027 en febrero 2027', 2027, 0, 2027, 1, -1],
  ])('%s compara año y período conjuntamente', (_label, scheduledYear, scheduledIndex, currentYear, currentIndex, expected) => {
    expect(compareCalendarPeriods(scheduledYear, scheduledIndex, currentYear, currentIndex)).toBe(expected);
  });

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
