import { evaluateFormula, calculateCompliance, resolveItemValues } from './compliance';
import { formatIndicatorValue } from './formatters';
import { DashboardItem } from '../types';

describe('FASE 12: Derived View Paths Audit & Wiring (v9.4.12)', () => {
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

  test('v9.4.12: resolveItemValues devuelve junio Meta 0.5 y Avance 0.5', () => {
    const res = resolveItemValues(mockItems[2], mockItems, 2026);
    expect(res.monthlyGoals[5]).toBe(0.5);
    expect(res.monthlyProgress[5]).toBe(0.5);
  });

  test('v9.4.12: Brecha entre Avance (0.5) y Meta (0.5) resulta 0.0 pp', () => {
    const res = resolveItemValues(mockItems[2], mockItems, 2026);
    const gap = (res.monthlyProgress[5] ?? 0) - (res.monthlyGoals[5] ?? 0);
    const formattedGap = `${(Math.abs(gap) * 100).toFixed(1)} pp`;
    expect(formattedGap).toBe('0.0 pp');
  });

  test('v9.4.12: formatIndicatorValue formatea avance/meta a 50.00%', () => {
    const formattedProgress = formatIndicatorValue(0.5, '%', 2, true);
    expect(formattedProgress).toBe('50.00%');
  });
});
