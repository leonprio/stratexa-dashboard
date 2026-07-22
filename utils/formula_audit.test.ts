import { evaluateFormula, calculateCompliance, resolveItemValues } from './compliance';
import { formatIndicatorValue } from './formatters';
import { DashboardItem } from '../types';

describe('FASE 10: Derived YTD Summary & Navigation Audit (v9.4.11)', () => {
  const mockItems: DashboardItem[] = [
    {
      id: 2,
      indicator: 'Compromisos acordados',
      indicatorType: 'simple',
      type: 'accumulative',
      frequency: 'monthly',
      monthlyProgress: [0, 0, 0, 0, 0, 6, 0, 0, 0, 0, 0, 0],
      monthlyGoals: [0, 0, 0, 0, 0, 8, 0, 0, 0, 0, 0, 0],
      unit: '',
      goalType: 'maximize',
    },
    {
      id: 3,
      indicator: 'Compromisos cerrados con evidencia',
      indicatorType: 'simple',
      type: 'accumulative',
      frequency: 'monthly',
      monthlyProgress: [0, 0, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0],
      monthlyGoals: [0, 0, 0, 0, 0, 4, 0, 0, 0, 0, 0, 0],
      unit: '',
      goalType: 'maximize',
    },
    {
      id: 4,
      indicator: '% Compromisos estratégicos cumplidos',
      indicatorType: 'formula',
      formula: '{id:3}/{id:2}',
      goalMode: 'DERIVED_FROM_SOURCES',
      formulaOutputMode: 'RESULT_IS_COMPLIANCE',
      type: 'average',
      frequency: 'monthly',
      monthlyProgress: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      monthlyGoals: [0, 0, 0, 0, 0, 0.8, 0, 0, 0, 0, 0, 0],
      unit: '%',
      goalType: 'maximize',
    },
  ];

  test('Junio 2026: YTD progress y goal son 0.5 (50.0%) evaluando fuentes acumuladas', () => {
    const defaultThresholds = { onTrack: 90, atRisk: 80 };
    const res = calculateCompliance(mockItems[2], defaultThresholds, 2026, 'realTime', mockItems);
    
    expect(res.currentProgress).toBe(0.5);
    expect(res.currentTarget).toBe(0.5);
    expect(res.overallPercentage).toBe(50);
  });

  test('v9.4.11: formatIndicatorValue formatea tarjeta principal a 1 decimal (50.0%)', () => {
    const formattedProgress = formatIndicatorValue(0.5, '%', 1, true);
    expect(formattedProgress).toBe('50.0%');
  });

  test('v9.4.11: formatIndicatorValue formatea detalle a 2 decimales (50.00%)', () => {
    const formattedProgress = formatIndicatorValue(0.5, '%', 2, true);
    expect(formattedProgress).toBe('50.00%');
  });

  test('v9.4.11: Indicadores sin % < 1 muestran 1 decimal (ej. 0.5)', () => {
    const formattedNoPct = formatIndicatorValue(0.5, '', 0, false);
    expect(formattedNoPct).toBe('0.5');
  });
});
