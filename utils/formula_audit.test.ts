import { evaluateFormula, calculateCompliance, resolveItemValues } from './compliance';
import { formatIndicatorValue } from './formatters';
import { DashboardItem } from '../types';

describe('FASE 10: Derived Percentage Formatting & All Views Wiring Audit (v9.4.10)', () => {
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

  test('Junio: rawGoal = 0.5, rawProgress = 0.5, rawCompliance = 0.5', () => {
    const progressJune = evaluateFormula('{id:3}/{id:2}', mockItems, 5, 'monthlyProgress', 2026);
    const goalJune = evaluateFormula('{id:3}/{id:2}', mockItems, 5, 'monthlyGoals', 2026);
    expect(progressJune).toBe(0.5);
    expect(goalJune).toBe(0.5);
  });

  test('v9.4.10: formatIndicatorValue formatea 0.5 con unidad % a 50.00%', () => {
    const formattedProgress = formatIndicatorValue(0.5, '%', 2, true);
    const formattedGoal = formatIndicatorValue(0.5, '%', 2, true);
    expect(formattedProgress).toBe('50.00%');
    expect(formattedGoal).toBe('50.00%');
  });

  test('v9.4.10: 0.5 NUNCA se muestra como 0.50, .50 o 0.5%', () => {
    const formatted = formatIndicatorValue(0.5, '%', 2, true);
    expect(formatted).not.toBe('0.50');
    expect(formatted).not.toBe('.50');
    expect(formatted).not.toBe('0.5%');
  });

  test('Junio: RESULT_IS_COMPLIANCE devuelve raw 0.5 (overallPercentage 50%)', () => {
    const formulaItem = mockItems[2];
    const defaultThresholds = { onTrack: 90, atRisk: 80 };
    const res = calculateCompliance(formulaItem, defaultThresholds, 2026, 'definitive', mockItems);
    
    expect(res.currentProgress).toBe(0.5);
    expect(res.currentTarget).toBe(0.5);
    expect(res.overallPercentage).toBe(50);
  });
});
