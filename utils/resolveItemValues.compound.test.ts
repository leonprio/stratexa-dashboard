/**
 * Tests focalizados: resolveItemValues — compound + average/accumulative (v9.4.20)
 *
 * Caso certificado:
 *   avances = [37.04, 0, 18.18, 61.54, 50]
 *   metas   = [5, 2, 2, 5, 2]
 *   average progress = 33.352  (sum=166.76 / 5)
 *   average goal     = 3.2     (sum=16    / 5)
 *   sum progress     = 166.76
 *   sum goal         = 16
 */

import { resolveItemValues } from './compliance';
import { DashboardItem } from '../types';

// Helpers para construir items mínimos sin saturar el tipo
const makeSource = (id: number | string, progress: (number | null)[], goals: (number | null)[]): DashboardItem =>
  ({
    id,
    indicator: `Fuente ${id}`,
    indicatorType: 'simple',
    type: 'average',
    goalType: 'maximize',
    unit: '%',
    weight: 0,
    monthlyProgress: progress,
    monthlyGoals: goals,
  } as unknown as DashboardItem);

const makeCompound = (
  id: number | string,
  componentIds: (number | string)[],
  type: 'average' | 'accumulative',
  legacyProgress?: number[],
  legacyGoals?: number[],
): DashboardItem =>
  ({
    id,
    indicator: `Compound ${id}`,
    indicatorType: 'compound',
    componentIds,
    type,
    goalType: 'maximize',
    unit: '%',
    weight: 0,
    monthlyProgress: legacyProgress ?? Array(12).fill(null),
    monthlyGoals: legacyGoals ?? Array(12).fill(null),
  } as unknown as DashboardItem);

// Mes 0 = índice donde están los datos del caso certificado
// Para simplificar usamos mes 0 con valores del caso certificado por fuente
const SOURCES_PROGRESS = [37.04, 0, 18.18, 61.54, 50];
const SOURCES_GOALS    = [5, 2, 2, 5, 2];

const buildCertifiedItems = (compoundType: 'average' | 'accumulative') => {
  const sources = SOURCES_PROGRESS.map((p, i) =>
    makeSource(i + 1, [p, null, null, null, null, null, null, null, null, null, null, null],
               [SOURCES_GOALS[i], null, null, null, null, null, null, null, null, null, null, null])
  );
  const compound = makeCompound(
    99,
    sources.map(s => s.id),
    compoundType,
    Array(12).fill(999), // valor legacy que NO debe prevalecer
    Array(12).fill(999),
  );
  return { sources, compound, all: [...sources, compound] };
};

describe('resolveItemValues — compound + average (v9.4.20)', () => {

  // Test 1: caso certificado average progress
  test('1. compound average: progress mes 0 === 33.352', () => {
    const { compound, all } = buildCertifiedItems('average');
    const { monthlyProgress } = resolveItemValues(compound, all, 2026);
    // sum=166.76 / 5 = 33.352
    expect(monthlyProgress[0]).toBeCloseTo(33.352, 3);
  });

  // Test 2: caso certificado average goal
  test('2. compound average: goal mes 0 === 3.2', () => {
    const { compound, all } = buildCertifiedItems('average');
    const { monthlyGoals } = resolveItemValues(compound, all, 2026);
    expect(monthlyGoals[0]).toBeCloseTo(3.2, 3);
  });

  // Test 3 (también verifica accumulative progress)
  test('3. compound accumulative: progress mes 0 === 166.76', () => {
    const { compound, all } = buildCertifiedItems('accumulative');
    const { monthlyProgress } = resolveItemValues(compound, all, 2026);
    expect(monthlyProgress[0]).toBeCloseTo(166.76, 2);
  });

  // Test 4 (también verifica accumulative goal)
  test('4. compound accumulative: goal mes 0 === 16', () => {
    const { compound, all } = buildCertifiedItems('accumulative');
    const { monthlyGoals } = resolveItemValues(compound, all, 2026);
    expect(monthlyGoals[0]).toBeCloseTo(16, 2);
  });

  // Test 5: cero como avance válido y contabilizado
  test('5. cero en avance es dato válido y se contabiliza en el divisor', () => {
    // Fuentes: avance [0, 10] — mes0 tiene 0 que debe contar
    const s1 = makeSource('a', [0, null, null, null, null, null, null, null, null, null, null, null], [5, null, null, null, null, null, null, null, null, null, null, null]);
    const s2 = makeSource('b', [10, null, null, null, null, null, null, null, null, null, null, null], [5, null, null, null, null, null, null, null, null, null, null, null]);
    const c  = makeCompound('c', ['a', 'b'], 'average');
    // average = (0 + 10) / 2 = 5   (no 10/1=10)
    const { monthlyProgress } = resolveItemValues(c, [s1, s2, c], 2026);
    expect(monthlyProgress[0]).toBeCloseTo(5, 3);
  });

  // Test 6: meta cero como valor válido y contabilizado
  test('6. meta cero es dato válido y se contabiliza en divisor de goals', () => {
    const s1 = makeSource('a', [10, null, null, null, null, null, null, null, null, null, null, null], [0, null, null, null, null, null, null, null, null, null, null, null]);
    const s2 = makeSource('b', [10, null, null, null, null, null, null, null, null, null, null, null], [4, null, null, null, null, null, null, null, null, null, null, null]);
    const c  = makeCompound('c', ['a', 'b'], 'average');
    // goal average = (0 + 4) / 2 = 2
    const { monthlyGoals } = resolveItemValues(c, [s1, s2, c], 2026);
    expect(monthlyGoals[0]).toBeCloseTo(2, 3);
  });

  // Test 7: avance ausente (null) no aumenta progressCounts
  test('7. avance null no se contabiliza — divisor solo cuenta fuentes con datos', () => {
    const s1 = makeSource('a', [null, null, null, null, null, null, null, null, null, null, null, null], [5, null, null, null, null, null, null, null, null, null, null, null]);
    const s2 = makeSource('b', [20, null, null, null, null, null, null, null, null, null, null, null], [5, null, null, null, null, null, null, null, null, null, null, null]);
    const c  = makeCompound('c', ['a', 'b'], 'average');
    // Solo b aporta avance → average = 20 / 1 = 20
    const { monthlyProgress } = resolveItemValues(c, [s1, s2, c], 2026);
    expect(monthlyProgress[0]).toBeCloseTo(20, 3);
  });

  // Test 8: meta ausente (null) no aumenta goalCounts
  test('8. meta null no se contabiliza — divisor de goals solo cuenta fuentes con meta válida', () => {
    const s1 = makeSource('a', [10, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null]);
    const s2 = makeSource('b', [10, null, null, null, null, null, null, null, null, null, null, null], [8, null, null, null, null, null, null, null, null, null, null, null]);
    const c  = makeCompound('c', ['a', 'b'], 'average');
    // goal: solo b → average = 8 / 1 = 8
    const { monthlyGoals } = resolveItemValues(c, [s1, s2, c], 2026);
    expect(monthlyGoals[0]).toBeCloseTo(8, 3);
  });

  // Test 9: conteos independientes — avance válido sin meta no altera divisor de metas
  test('9. conteos independientes: fuente con avance pero sin meta no altera divisor de goals', () => {
    // s1: avance=30, sin meta; s2: avance=10, meta=4
    const s1 = makeSource('a', [30, null, null, null, null, null, null, null, null, null, null, null], [null, null, null, null, null, null, null, null, null, null, null, null]);
    const s2 = makeSource('b', [10, null, null, null, null, null, null, null, null, null, null, null], [4, null, null, null, null, null, null, null, null, null, null, null]);
    const c  = makeCompound('c', ['a', 'b'], 'average');
    const result = resolveItemValues(c, [s1, s2, c], 2026);
    // progress: (30+10)/2 = 20
    expect(result.monthlyProgress[0]).toBeCloseTo(20, 3);
    // goal: solo s2 → 4/1 = 4 (no 4/2=2)
    expect(result.monthlyGoals[0]).toBeCloseTo(4, 3);
  });

  // Test 10: valor legacy almacenado en el padre NO prevalece sobre la recomputación compound
  test('10. valor legacy 999 en el padre no prevalece sobre la recomputación compound', () => {
    const { compound, all } = buildCertifiedItems('average');
    // compound ya tiene monthlyProgress=[999,...] como legacy
    const { monthlyProgress } = resolveItemValues(compound, all, 2026);
    // debe ser 33.352, nunca 999
    expect(monthlyProgress[0]).not.toBeCloseTo(999, 0);
    expect(monthlyProgress[0]).toBeCloseTo(33.352, 3);
  });

  // Test 11: cambio en fuente modifica el resultado del padre
  test('11. cambiar el avance de una fuente modifica el resultado del padre', () => {
    const s1 = makeSource('a', [10, null, null, null, null, null, null, null, null, null, null, null], [5, null, null, null, null, null, null, null, null, null, null, null]);
    const s2 = makeSource('b', [20, null, null, null, null, null, null, null, null, null, null, null], [5, null, null, null, null, null, null, null, null, null, null, null]);
    const c  = makeCompound('c', ['a', 'b'], 'average');
    const before = resolveItemValues(c, [s1, s2, c], 2026).monthlyProgress[0];
    // Cambiar s2 a 40
    const s2mod = { ...s2, monthlyProgress: [40, null, null, null, null, null, null, null, null, null, null, null] } as DashboardItem;
    const after = resolveItemValues(c, [s1, s2mod, c], 2026).monthlyProgress[0];
    expect(before).toBeCloseTo(15, 3);  // (10+20)/2
    expect(after).toBeCloseTo(25, 3);   // (10+40)/2
    expect(after).not.toBeCloseTo(before, 0);
  });

  // Test: mes sin ningún dato queda como null (no se inventa cero)
  test('mes sin datos en ninguna fuente queda null (no se inventa cero)', () => {
    const s1 = makeSource('a', [10, null, null, null, null, null, null, null, null, null, null, null], [5, null, null, null, null, null, null, null, null, null, null, null]);
    const c  = makeCompound('c', ['a'], 'average');
    const { monthlyProgress } = resolveItemValues(c, [s1, c], 2026);
    // mes 1 (idx=1) no tiene dato en ninguna fuente → null
    expect(monthlyProgress[1]).toBeNull();
  });
});
