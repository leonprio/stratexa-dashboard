import { calculateOperationalMetrics } from './compliance';
import { calculateAlertSeverity, calculateOperationalAging, calculateOperationalDataStatus, findLastOperationalCapture } from './operationalAlerts';
import type { DashboardItem } from '../types';

const item = (goals: (number | null)[], progress: (number | null)[]) => ({ id: 1, indicator: 'KPI', weight: 10, unit: '#', type: 'accumulative', goalType: 'maximize', monthlyGoals: goals, monthlyProgress: progress } as DashboardItem);
const thresholds = { onTrack: 90, atRisk: 80 };

describe('semántica ejecutiva de severidad', () => {
  beforeAll(() => { jest.useFakeTimers(); jest.setSystemTime(new Date('2026-08-29T12:00:00Z')); });
  afterAll(() => jest.useRealTimers());

  it('no convierte configuración 0/0 sin meta operativa en ocho periodos vencidos', () => {
    const metrics = calculateOperationalMetrics(item(Array(12).fill(0), Array(12).fill(0)), thresholds, 2026);
    expect(metrics.expectedPeriods).toBe(0);
    expect(calculateAlertSeverity({ ...item([], []), operationalMetrics: metrics })).toBe('SIN OBLIGACIÓN');
    expect(calculateOperationalDataStatus({ ...item([], []), operationalMetrics: metrics })).toBe('SIN OBLIGACIÓN');
  });

  it('aging parte del cierre del periodo faltante más antiguo y reconoce capturas posteriores', () => {
    const goals = Array(12).fill(null); const progress = Array(12).fill(null);
    goals[0] = goals[1] = goals[2] = 10; progress[0] = 10; progress[2] = 10;
    const metrics = calculateOperationalMetrics(item(goals, progress), thresholds, 2026);
    const expectedDays = Math.ceil((new Date('2026-08-29T12:00:00Z').getTime() - new Date(2026, 2, 0).getTime()) / 86400000);
    expect(metrics.capturedPeriods).toBe(2);
    expect(metrics.stalenessDays).toBe(expectedDays);
    expect(calculateOperationalAging({ ...item(goals, progress), operationalMetrics: metrics })).toBe('61d+ (Crítico)');
  });

  it('un conjunto mixto no queda artificialmente clasificado como crítico', () => {
    const base = { expectedPeriods: 4, capturedPeriods: 4, missingPeriods: 0, captureRate: 100, realOperationalScore: 100, stalenessDays: 0, performanceStatus: 'OnTrack', captureStatus: 'OnTrack', operationalStatus: 'OnTrack' };
    const scores = [100, 82, 45].map(performanceScore => calculateAlertSeverity({ ...item([], []), operationalMetrics: { ...base, performanceScore } }));
    const staleOnly = calculateAlertSeverity({ ...item([], []), operationalMetrics: { ...base, capturedPeriods: 1, missingPeriods: 3, captureRate: 25, performanceScore: 100, stalenessDays: 120 } });
    expect(scores).toEqual(['BAJO CONTROL', 'REQUIERE ATENCIÓN', 'CRÍTICO']);
    expect(staleOnly).toBe('RIESGO OCULTO');
    expect([...scores, staleOnly].filter(state => state === 'CRÍTICO')).toHaveLength(1);
  });

  it('conserva desempeño crítico o en atención aunque la evidencia sea parcial', () => {
    const partial = { expectedPeriods: 4, capturedPeriods: 2, missingPeriods: 2, captureRate: 50, realOperationalScore: 30, stalenessDays: 45, performanceStatus: 'OffTrack', captureStatus: 'OffTrack', operationalStatus: 'OffTrack' };
    expect(calculateAlertSeverity({ ...item([], []), operationalMetrics: { ...partial, performanceScore: 53 } })).toBe('CRÍTICO');
    expect(calculateAlertSeverity({ ...item([], []), operationalMetrics: { ...partial, performanceScore: 81 } })).toBe('REQUIERE ATENCIÓN');
  });

  it('última captura ignora slots futuros y ceros 0/0 preconfigurados', () => {
    const source = item(Array(12).fill(0), Array(12).fill(0));
    source.monthlyGoals[4] = 10; source.monthlyProgress[4] = 7;
    source.monthlyGoals[11] = 0; source.monthlyProgress[11] = 0;
    expect(findLastOperationalCapture(source, 2026, new Date('2026-08-29T12:00:00Z'))).toEqual({ periodIndex: 4, periodLabel: 'MAY' });
  });
});
