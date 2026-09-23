import { classifyDue, dedupePlans, filterPlans, getOverdueActivities, hasOverdueActivity } from './TransversalActionPlansControl';
import { ActionPlan } from '../../types';

const plan = (overrides: Partial<ActionPlan> = {}) => ({ id: '1', indicatorId: 1, dashboardId: 10, title: 'Plan', originYear: 2026, originPeriodType: 'monthly' as const, status: 'planned' as const, startDate: '2026-01-01', progress: 0, createdAt: '', updatedAt: '', indicator: 'KPI', area: 'Ventas', ...overrides });

describe('transversal action plans control logic', () => {
  const now = new Date('2026-08-28T12:00:00Z');
  it('classifies active, due and undated plans deterministically', () => {
    expect(['planned', 'in_progress']).toEqual(expect.arrayContaining([plan().status, plan({ status: 'in_progress' }).status]));
    expect(classifyDue(plan({ targetDate: '2026-08-27T12:00:00Z' }), now)).toBe('vencido');
    expect(classifyDue(plan({ targetDate: '2026-09-02T12:00:00Z' }), now)).toBe('próximo');
    expect(classifyDue(plan({ targetDate: '2026-09-10T12:00:00Z' }), now)).toBe('normal');
    expect(classifyDue(plan({ targetDate: undefined }), now)).toBe('normal');
    expect(classifyDue(plan({ status: 'completed', targetDate: '2026-08-27T12:00:00Z' }), now)).toBe('normal');
  });
  it('keeps completed plans outside active plans and limits recent list consumers to eight', () => {
    const active = [plan(), plan({ id: '2', status: 'in_progress' })]; const completed = Array.from({ length: 10 }, (_, i) => plan({ id: `c${i}`, status: 'completed' }));
    expect(active.filter(p => p.status === 'planned' || p.status === 'in_progress')).toHaveLength(2);
    expect(completed.slice(0, 8)).toHaveLength(8);
  });
  it('deduplicates exactly by plan id and supports all simple filters', () => {
    const items = [plan({ responsible: 'Ana' }), plan({ id: '2', area: 'Operaciones', responsible: 'Luis', status: 'in_progress' })];
    expect(dedupePlans([...items, { ...items[0], indicator: 'Otro' }])).toHaveLength(2);
    expect(filterPlans(items, 'Área', 'Operaciones')).toHaveLength(1);
    expect(filterPlans(items, 'Responsable', 'Ana')).toHaveLength(1);
    expect(filterPlans(items, 'Estado', 'En ejecución')).toHaveLength(1);
    expect(filterPlans(items, 'Todos', 'Todos')).toHaveLength(2);
  });
  it('detects overdue activities without requiring a plan target date', () => {
    const overdue = { id: 'a1', title: 'Actividad vencida', progress: 20, targetDate: '2026-08-20', createdAt: '', updatedAt: '' };
    expect(hasOverdueActivity(plan({ targetDate: undefined, activities: [overdue] }), now)).toBe(true);
    expect(getOverdueActivities(plan({ activities: [overdue] }), now)).toHaveLength(1);
  });
  it('keeps future, undated and completed activities out of overdue attention', () => {
    const activities = [
      { id: 'done', title: 'Completada', progress: 100, targetDate: '2026-08-01', createdAt: '', updatedAt: '' },
      { id: 'undated', title: 'Sin fecha', progress: 0, createdAt: '', updatedAt: '' },
      { id: 'future', title: 'Futura', progress: 0, targetDate: '2026-09-10', createdAt: '', updatedAt: '' },
    ];
    expect(getOverdueActivities(plan({ activities }), now)).toHaveLength(0);
  });
  it('keeps a future-dated plan in attention when an activity is overdue', () => {
    const overdue = { id: 'a1', title: 'Actividad vencida', progress: 20, targetDate: '2026-08-20', createdAt: '', updatedAt: '' };
    expect(classifyDue(plan({ targetDate: '2026-09-20', activities: [overdue] }), now)).toBe('normal');
    expect(hasOverdueActivity(plan({ targetDate: '2026-09-20', activities: [overdue] }), now)).toBe(true);
  });
  it('does not duplicate a plan when multiple activities are overdue', () => {
    const items = [plan({ activities: [
      { id: 'a1', title: 'Uno', progress: 0, targetDate: '2026-08-01', createdAt: '', updatedAt: '' },
      { id: 'a2', title: 'Dos', progress: 0, targetDate: '2026-08-02', createdAt: '', updatedAt: '' },
    ] })];
    expect(dedupePlans(items)).toHaveLength(1);
    expect(getOverdueActivities(items[0], now)).toHaveLength(2);
  });
});
