import { calculateCompliance, calculateOperationalMetrics } from './compliance';
import { buildOperationalAlerts, calculateAlertSeverity, calculateOperationalDataStatus, calculateReliabilityScore, findLastOperationalCapture } from './operationalAlerts';
import type { Dashboard, DashboardItem } from '../types';

const thresholds = { onTrack: 90, atRisk: 70 };
const item = (id: string, indicator: string, progress: (number | null)[], goals: (number | null)[]): DashboardItem => ({
  id,
  indicator,
  weight: 1,
  monthlyGoals: [...goals, ...Array(12 - goals.length).fill(null)],
  monthlyProgress: [...progress, ...Array(12 - progress.length).fill(null)],
  unit: 'Número',
  type: 'accumulative',
  goalType: 'maximize',
});

// Contract fixture only. It deliberately does not claim to be a current production snapshot.
const activities = item('kpi-activities', 'ACTIVIDADES ESTRATÉGICAS', [2, 2, 2, 2, 5], [2, 2, 2, 2, 8]);
const ingresos = item('kpi-income', 'INGRESOS', [198], [200]);
const noObligation = item('kpi-no-obligation', 'SIN OBLIGACIÓN', [0], [0]);
const dashboard: Dashboard = {
  id: 'dashboard-runtime-contract',
  title: 'Fixture de contrato',
  subtitle: '',
  items: [ingresos, activities, noObligation],
  thresholds,
  clientId: 'FIXTURE',
  year: 2026,
};

describe('reconciliación TABLERO y CONTROL', () => {
  beforeAll(() => { jest.useFakeTimers(); jest.setSystemTime(new Date('2026-08-29T12:00:00Z')); });
  afterAll(() => jest.useRealTimers());

  it('deriva TABLERO y CONTROL del mismo item físico, contexto y corte', () => {
    expect(dashboard.items).toContain(ingresos);
    expect(dashboard.items.find(value => value.id === activities.id)).toBe(activities);

    for (const source of dashboard.items) {
      const tableroItem = source;
      const controlItem = source;
      expect(controlItem.id).toBe(tableroItem.id);

      const tablero = calculateCompliance(tableroItem, thresholds, 2026, 'realTime', dashboard.items);
      const metrics = calculateOperationalMetrics(controlItem, thresholds, 2026, 'realTime', dashboard.items);
      expect(metrics.sourcePerformanceScore).toBeCloseTo(tablero.overallPercentage, 8);
      const enriched = { ...controlItem, operationalMetrics: metrics };
      expect(calculateAlertSeverity(enriched)).toBeTruthy();
      expect(calculateOperationalDataStatus(enriched)).toBeTruthy();
      expect(calculateReliabilityScore(enriched)).toBeGreaterThanOrEqual(0);
      expect(findLastOperationalCapture(controlItem, 2026, new Date('2026-08-29T12:00:00Z')))
        .toEqual(findLastOperationalCapture(tableroItem, 2026, new Date('2026-08-29T12:00:00Z')));
    }
    const alerts = buildOperationalAlerts([dashboard], thresholds, 2026);
    expect(alerts.find(alert => alert.id === activities.id)?.performanceScore)
      .toBe(calculateCompliance(activities, thresholds, 2026, 'realTime', dashboard.items).overallPercentage);
  });

  it('no altera el resultado fuente al clasificar riesgo oculto', () => {
    const sourceResult = 100;
    const sparse = item('kpi-hidden-risk', 'APLICACIONES DESARROLLADAS', [4], [4]);
    const operationalMetrics = {
      performanceScore: sourceResult,
      captureRate: 12.5,
      expectedPeriods: 8,
      capturedPeriods: 1,
      missingPeriods: 7,
      realOperationalScore: 12.5,
    };
    const severity = calculateAlertSeverity({ ...sparse, operationalMetrics });
    expect(operationalMetrics.performanceScore).toBe(sourceResult);
    expect(severity).toBe('RIESGO OCULTO');
  });

  it('conserva 0/0 como SIN OBLIGACIÓN', () => {
    const metrics = calculateOperationalMetrics(noObligation, thresholds, 2026, 'realTime', dashboard.items);
    expect(calculateAlertSeverity({ ...noObligation, operationalMetrics: metrics })).toBe('SIN OBLIGACIÓN');
  });
});
