// 🛡️ REGLA v6.2.4-Fix7: Uso de globales de Jest para compatibilidad
import { calculateAggregateDashboard } from './aggregationUtils';

// Mock data
const mockBoard = (id, items) => ({
    id,
    title: `Board ${id}`,
    subtitle: "Subtitle",
    items: items.map(i => ({ ...i, id: Math.random() })), // Random IDs to simulate different DB entries
    thresholds: { onTrack: 90, atRisk: 80 }
});

describe('calculateAggregateDashboard', () => {
    test('groups "Bajas Totales" variations into single row', () => {
        // Scenario: 3 dashboards.
        // Board 1: "Bajas Totales" (Clean)
        // Board 2: "Bajas  Totales" (Extra space)
        // Board 3: "bajas totales" (Lowercase)

        // We expect 1 aggregated item "BAJAS TOTALES"

        const boards = [
            mockBoard(1, [{ indicator: 'Bajas Totales', value: 1 }]),
            mockBoard(2, [{ indicator: 'Bajas  Totales', value: 1 }]),
            mockBoard(3, [{ indicator: 'bajas totales', value: 1 }])
        ];

        const agg = calculateAggregateDashboard(boards, { aggregationStrategy: 'equal' } as any);

        expect(agg.items).toHaveLength(1);
        expect(agg.items[0].indicator).toBe('BAJAS TOTALES');
    });

    test('respects "order" property in aggregation', () => {
        // Scenario: Items should be sorted by order
        // Board 1 has: A (order 2), B (order 1)

        const boards = [
            mockBoard(1, [
                { indicator: 'Item A', order: 2, value: 10 },
                { indicator: 'Item B', order: 1, value: 20 }
            ])
        ];

        const agg = calculateAggregateDashboard(boards, { aggregationStrategy: 'equal' } as any);

        // Should be [B, A]
        expect(agg.items).toHaveLength(2);
        expect(agg.items[0].indicator).toBe('ITEM B');
        expect(agg.items[1].indicator).toBe('ITEM A');
    });

    test('forces "accumulative" for Bajas/Altas indicators (v6.2.4-Fix7)', () => {
        // Scenario: 2 boards. 
        // Indicator "Bajas Totales" without explicit type (defaulting to average)
        const boards = [
            mockBoard(1, [{ indicator: 'Bajas Totales', monthlyProgress: [10, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] }]),
            mockBoard(2, [{ indicator: 'Bajas Totales', monthlyProgress: [20, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] }])
        ];

        const agg = calculateAggregateDashboard(boards, { aggregationStrategy: 'equal' } as any);

        expect(agg.items[0].indicator).toBe('BAJAS TOTALES');
        expect(agg.items[0].monthlyProgress[0]).toBe(30); // SUM PROTECTION
    });

    test('v9.4.19: Rotación SH configurada como PROMEDIO promedia avances y metas correctamente', () => {
        // avances=[37.04, 0, 18.18, 61.54, 50] (5 tableros) -> Suma=166.76 -> Promedio = 33.352
        // metas=[5, 2, 2, 5, 2] (5 tableros) -> Suma=16 -> Promedio = 3.2
        const avances = [37.04, 0, 18.18, 61.54, 50];
        const metas = [5, 2, 2, 5, 2];

        const boards = avances.map((av, idx) =>
            mockBoard(idx + 1, [{
                indicator: 'Rotación SH',
                type: 'average',
                goalType: 'minimize',
                monthlyProgress: [av, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                monthlyGoals: [metas[idx], 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
            }])
        );

        const agg = calculateAggregateDashboard(boards, { aggregationStrategy: 'manual', customWeights: { '1': 1, '2': 1, '3': 1, '4': 1, '5': 1 } } as any);

        expect(agg.items[0].type).toBe('average');
        expect(agg.items[0].monthlyProgress[0]).toBeCloseTo(33.352, 3);
        expect(agg.items[0].monthlyGoals[0]).toBeCloseTo(3.2, 3);
    });
});
