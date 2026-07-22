import { evaluateFormula, calculateCompliance } from './compliance';
import { DashboardItem } from '../types';

describe('FASE 3: Root Cause Audit & Mathematical Contract (v9.4.5)', () => {
  const mockItems: DashboardItem[] = [
    {
      id: 2,
      indicator: 'Compromisos Acordados',
      indicatorType: 'simple',
      type: 'accumulative',
      frequency: 'monthly',
      monthlyProgress: [0, 0, 0, 0, 0, 6, 0, 0, 0, 0, 0, 0],
      monthlyGoals: [0, 0, 0, 0, 0, 8, 0, 0, 0, 0, 0, 0],
      unit: '',
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
    },
    {
      id: 4,
      indicator: '% Compromisos estratégicos cumplidos',
      indicatorType: 'formula',
      formula: '{id:3}/{id:2}',
      type: 'average',
      frequency: 'monthly',
      monthlyProgress: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      monthlyGoals: [0, 0, 0, 0, 0, 0.8, 0, 0, 0, 0, 0, 0], // Meta esperada: 80% (0.8)
      unit: '%',
    },
  ];

  test('Paso 1: evaluateFormula {id:3}/{id:2} en el mes 5 (Junio) debe dar exactamente 0.5 (Avance derivado 3/6)', () => {
    const rawProgressJune = evaluateFormula('{id:3}/{id:2}', mockItems, 5, 'monthlyProgress', 2026);
    expect(rawProgressJune).toBe(0.5);
  });

  test('Paso 2: Avance Derivado 0.5 con Meta 0.8 produce Cumplimiento Derivado = 62.5% (Valor derivado 0.5 separado de la meta y cumplimiento)', () => {
    const formulaItem = mockItems[2];
    const defaultThresholds = { onTrack: 90, atRisk: 80 };
    
    // Evaluamos calculateCompliance en modo definitivo para el año 2026
    const res = calculateCompliance(formulaItem, defaultThresholds, 2026, 'definitive', mockItems);
    
    // Avance derivado en Junio = 3/6 = 0.5
    expect(res.currentProgress).toBe(0.5);
    // Meta explícita configurada en Junio = 0.8 (80%)
    expect(res.currentTarget).toBe(0.8);
    // Cumplimiento = 0.5 / 0.8 * 100 = 62.5%
    expect(res.overallPercentage).toBe(62.5);
  });
});
