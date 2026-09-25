import { buildPendingItems } from './pendingAlerts';
import { buildOperationalAlerts } from './operationalAlerts';
import type { Dashboard } from '../types';

const period = { frequency: 'monthly' as const, year: 2026, monthIndex: 8 };

const activityDashboard = (id: number, title: string, activities: Array<{ id: string; targetCount: number; completedCount: number }>): Dashboard => ({
  id,
  title,
  subtitle: '',
  area: 'A',
  defaultTrackingStartPeriod: { frequency: 'monthly', year: 2026, monthIndex: 0 },
  periodicity: 'monthly',
  thresholds: { onTrack: 95, atRisk: 85 },
  items: [{
    id: 10,
    indicator: 'Actividades de inclusión realizadas',
    weight: 1,
    unit: 'u',
    type: 'accumulative',
    goalType: 'maximize',
    isActivityMode: true,
    activityConfig: { 8: activities.map(activity => ({ ...activity, label: `Actividad ${activity.id}` })) },
    monthlyGoals: Array(12).fill(null),
    monthlyProgress: Array(12).fill(null),
  }],
});

describe('CONTROL checklist traceability', () => {
  it('keeps homonymous KPI instances distinct and consolidates checklist elements once per KPI/period', () => {
    const items = buildPendingItems([
      activityDashboard(1, 'Inclusión Nacional', [{ id: 'a', targetCount: 4, completedCount: 1 }, { id: 'b', targetCount: 6, completedCount: 2 }]),
      activityDashboard(2, 'Inclusión — Guanajuato', [{ id: 'c', targetCount: 3, completedCount: 0 }]),
    ], period, period, [1, 2]);

    expect(items).toHaveLength(2);
    const byDashboard = [...items].sort((a, b) => Number(a.dashboardId) - Number(b.dashboardId));
    expect(byDashboard.map(item => item.dashboardTitle)).toEqual(['Inclusión Nacional', 'Inclusión — Guanajuato']);
    expect(byDashboard.map(item => [item.goal, item.progress, item.pending])).toEqual([[10, 3, 7], [3, undefined, undefined]]);
    expect(new Set(items.map(item => item.id))).toEqual(new Set(['1:10:RESULT_CRITICAL', '2:10:MISSING_PROGRESS']));
  });

  it('does not present zero as a configured goal when configuration is missing', () => {
    const dashboard = activityDashboard(3, 'Tablero sin meta', []);
    const [item] = buildPendingItems([dashboard], period, period, [3]);

    expect(item.type).toBe('MISSING_GOAL');
    expect(item.dashboardTitle).toBe('Tablero sin meta');
    expect(item.goal).toBeUndefined();
    expect(item.progress).toBeUndefined();
    expect(item.pending).toBeUndefined();
  });

  it('exposes canonical operational values and dashboard identity in operational alerts', () => {
    const dashboard = activityDashboard(4, 'Tablero operativo', []);
    dashboard.items[0].isActivityMode = false;
    dashboard.items[0].monthlyGoals = Object.assign(Array(12).fill(null), { 8: 100 });
    dashboard.items[0].monthlyProgress = Object.assign(Array(12).fill(null), { 8: 50 });
    dashboard.items[0].monthlyGoalCaptured = Object.assign(Array(12).fill(false), { 8: true });
    dashboard.items[0].monthlyProgressCaptured = Object.assign(Array(12).fill(false), { 8: true });

    const [alert] = buildOperationalAlerts([dashboard], { onTrack: 95, atRisk: 85 }, 2026);

    expect(alert.dashboardTitle).toBe('Tablero operativo');
    expect(alert.goal).toBe(100);
    expect(alert.progress).toBe(50);
    expect(alert.pending).toBe(50);
    expect(alert.indicator).toBe('Actividades de inclusión realizadas');
  });
});
