import { derivePendingKpiActivities } from './CurrentPeriodFocus';

describe('pending KPI activities', () => {
  it('keeps incomplete activities, origin period and status without duplicating ids', () => {
    const activityConfig = {
      0: [
        { id: 'old', label: 'Actividad atrasada', targetCount: 2, completedCount: 0 },
        { id: 'done', label: 'Actividad completada', targetCount: 1, completedCount: 1 },
      ],
      1: [
        { id: 'partial', label: 'Actividad en atención', targetCount: 2, completedCount: 1 },
        { id: 'future', label: 'Actividad posterior', targetCount: 1, completedCount: 0 },
      ],
      2: [
        { id: 'current', label: 'Actividad pendiente', targetCount: 1, completedCount: 0 },
        { id: 'current', label: 'Actividad pendiente duplicada', targetCount: 1, completedCount: 0 },
      ],
    };

    expect(derivePendingKpiActivities(activityConfig, 2, false, 2026)).toEqual([
      { id: '0:old', label: 'Actividad atrasada', periodIndex: 0, periodLabel: 'Ene · 2026', status: 'ATRASADA' },
      { id: '1:partial', label: 'Actividad en atención', periodIndex: 1, periodLabel: 'Feb · 2026', status: 'ATRASADA' },
      { id: '1:future', label: 'Actividad posterior', periodIndex: 1, periodLabel: 'Feb · 2026', status: 'ATRASADA' },
      { id: '2:current', label: 'Actividad pendiente', periodIndex: 2, periodLabel: 'Mar · 2026', status: 'PENDIENTE' },
    ]);
  });

  it('does not classify future periods or completed activities, and supports weekly labels', () => {
    const activityConfig = {
      3: [{ id: 'future', label: 'Futura', targetCount: 1, completedCount: 0 }],
      4: [{ id: 'partial', label: 'Parcial', targetCount: 3, completedCount: 1 }],
      5: [{ id: 'done', label: 'Terminada', targetCount: 1, completedCount: 1 }],
    };

    expect(derivePendingKpiActivities(activityConfig, 4, true, 2026)).toEqual([
      { id: '3:future', label: 'Futura', periodIndex: 3, periodLabel: 'S4 · 2026', status: 'ATRASADA' },
      { id: '4:partial', label: 'Parcial', periodIndex: 4, periodLabel: 'S5 · 2026', status: 'ATENCIÓN' },
    ]);
  });
});
