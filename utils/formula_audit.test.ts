import { evaluateFormula, calculateCompliance, resolveItemValues } from './compliance';
import { DashboardItem } from '../types';

describe('FASE 9: Automatic Formula Compliance & RESULT_IS_COMPLIANCE Contract (v9.4.9)', () => {
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
      formulaOutputMode: 'RESULT_IS_COMPLIANCE', // v9.4.9
      type: 'average',
      frequency: 'monthly',
      monthlyProgress: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      monthlyGoals: [0, 0, 0, 0, 0, 0.8, 0, 0, 0, 0, 0, 0],
      unit: '%',
      goalType: 'maximize',
    },
  ];

  test('Junio: avance derivado 3/6 = 0.5 (50%)', () => {
    const progressJune = evaluateFormula('{id:3}/{id:2}', mockItems, 5, 'monthlyProgress', 2026);
    expect(progressJune).toBe(0.5);
  });

  test('Junio: meta derivada 4/8 = 0.5 (50%)', () => {
    const goalJune = evaluateFormula('{id:3}/{id:2}', mockItems, 5, 'monthlyGoals', 2026);
    expect(goalJune).toBe(0.5);
  });

  test('Junio: RESULT_IS_COMPLIANCE muestra cumplimiento 50%, NO 100%', () => {
    const formulaItem = mockItems[2];
    const defaultThresholds = { onTrack: 90, atRisk: 80 };
    const res = calculateCompliance(formulaItem, defaultThresholds, 2026, 'definitive', mockItems);
    
    expect(res.currentProgress).toBe(0.5);
    expect(res.currentTarget).toBe(0.5);
    expect(res.overallPercentage).toBe(50); // 🛡️ v9.4.9: 50%, no 100%
  });

  test('v9.4.9: VALUE_VS_TARGET conserva el cálculo (avance / meta)', () => {
    const valueVsTargetItem: DashboardItem = {
      ...mockItems[2],
      formulaOutputMode: 'VALUE_VS_TARGET',
    };
    const defaultThresholds = { onTrack: 90, atRisk: 80 };
    const res = calculateCompliance(valueVsTargetItem, defaultThresholds, 2026, 'definitive', mockItems);
    
    expect(res.overallPercentage).toBe(100); // 0.5 / 0.5 = 100%
  });

  test('v9.4.8: KPIs con nombres distintos quedan excluidos para AGREGADO aun compartiendo unidad', () => {
    const targetItem: DashboardItem = {
      id: 99,
      indicator: 'Compromisos acordados',
      unit: '',
      indicatorType: 'compound',
      monthlyProgress: [],
      monthlyGoals: [],
      type: 'accumulative',
      goalType: 'maximize',
    };

    const normalize = (str?: string) => (str || '').trim().toLowerCase();
    const isEquiv = (it: DashboardItem) => normalize(it.indicator) === normalize(targetItem.indicator);

    expect(isEquiv(mockItems[0])).toBe(true);  // Compromisos acordados == Compromisos acordados
    expect(isEquiv(mockItems[1])).toBe(false); // Compromisos cerrados != Compromisos acordados
  });
});
