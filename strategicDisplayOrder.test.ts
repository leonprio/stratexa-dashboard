import { orderDashboardItemsForStrategicPresentation } from './strategicDisplayOrder';

const item = (id: string, indicator: string, order?: number) => ({ id, indicator, order, weight: 1, monthlyGoals: [1], monthlyProgress: [1], unit: 'u', type: 'accumulative', goalType: 'maximize' });

describe('strategic KPI presentation order', () => {
  const dashboard: any = { id: 'd1', title: 'Operativo', items: [item('free', 'LIBRE', 0), item('p3', 'P3 KPI', 2), item('p1b', 'P1 B', 1), item('p1a', 'P1 A', 0)] };
  const perspectives: any[] = [{ id: 'P1', order: 1 }, { id: 'P3', order: 3 }];
  const objectives: any[] = [{ id: 'OE1', code: 'OE01', perspectiveId: 'P1', order: 1 }, { id: 'OE3', code: 'OE03', perspectiveId: 'P3', order: 1 }];
  const assignments: any[] = [{ strategicObjectiveId: 'OE3', dashboardId: 'd1', itemId: 'p3' }, { strategicObjectiveId: 'OE1', dashboardId: 'd1', itemId: 'p1b' }, { strategicObjectiveId: 'OE1', dashboardId: 'd1', itemId: 'p1a' }];

  it('uses perspective then objective order, preserves KPI operational order, and leaves free KPIs last', () => {
    const result = orderDashboardItemsForStrategicPresentation(dashboard.items, 'd1', [dashboard], perspectives, objectives, [], assignments);
    expect(result.map(i => i.id)).toEqual(['p1a', 'p1b', 'p3', 'free']);
    expect(result.map(i => i.id).sort()).toEqual(dashboard.items.map((i: any) => i.id).sort());
  });

  it('keeps operational order when no strategic configuration exists', () => {
    expect(orderDashboardItemsForStrategicPresentation(dashboard.items, 'd1', [dashboard], [], [], [], []).map(i => i.id)).toEqual(dashboard.items.map((i: any) => i.id));
  });
});
