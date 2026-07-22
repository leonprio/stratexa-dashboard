import { evaluateFormula, calculateCompliance, resolveItemValues } from './compliance';
import { DashboardItem } from '../types';

describe('FASE 10: Derived Formula Monthly Targets & Contract Audit (v9.4.7)', () => {
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
      goalMode: 'DERIVED_FROM_SOURCES', // Por defecto meta derivada
      type: 'average',
      frequency: 'monthly',
      monthlyProgress: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      monthlyGoals: [0, 0, 0, 0, 0, 0.8, 0, 0, 0, 0, 0, 0], // Valor legacy que debe ignorarse en DERIVED_FROM_SOURCES
      unit: '%',
      goalType: 'maximize',
    },
  ];

  test('Junio: avance fórmula {id:3}/{id:2} produce 3/6 = 0.5 (50%)', () => {
    const progressJune = evaluateFormula('{id:3}/{id:2}', mockItems, 5, 'monthlyProgress', 2026);
    expect(progressJune).toBe(0.5);
  });

  test('Junio: meta fórmula {id:3}/{id:2} en DERIVED_FROM_SOURCES produce 4/8 = 0.5 (50%) ignorando valor legacy 0.80', () => {
    const goalJune = evaluateFormula('{id:3}/{id:2}', mockItems, 5, 'monthlyGoals', 2026);
    expect(goalJune).toBe(0.5);

    const resolved = resolveItemValues(mockItems[2], mockItems, 2026);
    expect(resolved.monthlyGoals[5]).toBe(0.5);
  });

  test('Junio: cumplimiento resulta 0.5 / 0.5 = 1.0 (100%)', () => {
    const formulaItem = mockItems[2];
    const defaultThresholds = { onTrack: 90, atRisk: 80 };
    const res = calculateCompliance(formulaItem, defaultThresholds, 2026, 'definitive', mockItems);
    
    expect(res.currentProgress).toBe(0.5);
    expect(res.currentTarget).toBe(0.5);
    expect(res.overallPercentage).toBe(100);
  });

  test('Denominador cero en mes 0 (Enero) produce 0 (SIN DATOS)', () => {
    const progressJan = evaluateFormula('{id:3}/{id:2}', mockItems, 0, 'monthlyProgress', 2026);
    const goalJan = evaluateFormula('{id:3}/{id:2}', mockItems, 0, 'monthlyGoals', 2026);
    expect(progressJan).toBe(0);
    expect(goalJan).toBe(0);
  });
});
