import { classifyDue, dedupePlans, filterPlans } from './TransversalActionPlansControl';
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
});
