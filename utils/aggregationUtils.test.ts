import { calculateAggregateDashboard } from './aggregationUtils';
import { Dashboard, DashboardItem, SystemSettings } from '../types';

describe('aggregationUtils', () => {
    const mockThresholds = { onTrack: 90, atRisk: 80 };

    const createMockItem = (indicator: string, type: 'accumulative' | 'average', progress: number): DashboardItem => ({
        id: Math.random(),
        indicator,
        type,
        weight: 10,
        unit: '%',
        goalType: 'maximize',
        monthlyGoals: [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100],
        monthlyProgress: [progress, progress, progress, progress, progress, progress, progress, progress, progress, progress, progress, progress],
    });

    it('returns empty dashboard when no dashboards are provided', () => {
        const result = calculateAggregateDashboard([]);
        expect(result.items.length).toBe(0);
        expect(result.id).toBe(-1);
    });

    test('suma indicadores acumulativos idénticos', () => {
        const db1: Dashboard = {
            id: 1, title: 'DB1', subtitle: '', thresholds: mockThresholds,
            items: [createMockItem('Ind1', 'accumulative', 10)]
        };
        const db2: Dashboard = {
            id: 2, title: 'DB2', subtitle: '', thresholds: mockThresholds,
            items: [createMockItem('Ind1', 'accumulative', 20)]
        };

        const result = calculateAggregateDashboard([db1, db2]);
        expect(result.items[0].monthlyProgress[0]).toBe(30);
    });

    test('promedia indicadores de promedio idénticos (equal weighting)', () => {
        const db1: Dashboard = {
            id: 1, title: 'DB1', subtitle: '', thresholds: mockThresholds,
            items: [createMockItem('Ind1', 'average', 10)]
        };
        const db2: Dashboard = {
            id: 2, title: 'DB2', subtitle: '', thresholds: mockThresholds,
            items: [createMockItem('Ind1', 'average', 20)]
        };

        const result = calculateAggregateDashboard([db1, db2], { aggregationStrategy: 'equal' } as any);
        expect(result.items[0].monthlyProgress[0]).toBe(15);
    });

    test('aplica pesaje manual correctamente', () => {
        const db1: Dashboard = {
            id: 1, title: 'DB1', subtitle: '', thresholds: mockThresholds,
            items: [createMockItem('Ind1', 'average', 10)],
            dashboardWeight: 1
        };
        const db2: Dashboard = {
            id: 2, title: 'DB2', subtitle: '', thresholds: mockThresholds,
            items: [createMockItem('Ind1', 'average', 40)],
            dashboardWeight: 3
        };

        // (10 * 1 + 40 * 3) / (1 + 3) = 130 / 4 = 32.5
        const result = calculateAggregateDashboard([db1, db2], { aggregationStrategy: 'manual' } as any);
        expect(result.items[0].monthlyProgress[0]).toBe(32.5);
    });

    test('pesaje por indicador driver', () => {
        const item1 = createMockItem('Ind1', 'average', 10);
        const driver1 = createMockItem('Driver', 'accumulative', 100);

        const item2 = createMockItem('Ind1', 'average', 20);
        const driver2 = createMockItem('Driver', 'accumulative', 300);

        const db1: Dashboard = {
            id: 1, title: 'DB1', subtitle: '', thresholds: mockThresholds,
            items: [item1, driver1]
        };
        const db2: Dashboard = {
            id: 2, title: 'DB2', subtitle: '', thresholds: mockThresholds,
            items: [item2, driver2]
        };

        const settings: SystemSettings = {
            aggregationStrategy: 'indicator',
            indicatorDriver: 'Driver'
        } as any;

        // Weights: DB1=100, DB2=300. Total=400.
        // Agg Value: (10 * 100 + 20 * 300) / 400 = (1000 + 6000) / 400 = 7000 / 400 = 17.5
        const result = calculateAggregateDashboard([db1, db2], settings);
        expect(result.items[0].monthlyProgress[0]).toBe(17.5);
    });

    test('maneja indicadores semanales', () => {
        const item1 = createMockItem('Ind1', 'accumulative', 10);
        item1.weeklyProgress = [1, 2];
        item1.weeklyGoals = [10, 10];
        const item2 = createMockItem('Ind1', 'accumulative', 20);
        item2.weeklyProgress = [3, 4];
        item2.weeklyGoals = [20, 20];

        const db1: Dashboard = { id: 1, title: 'D1', subtitle: '', thresholds: mockThresholds, items: [item1] };
        const db2: Dashboard = { id: 2, title: 'D2', subtitle: '', thresholds: mockThresholds, items: [item2] };

        const result = calculateAggregateDashboard([db1, db2]);
        expect(result.items[0].weeklyProgress![0]).toBe(4);
        expect(result.items[0].weeklyProgress![1]).toBe(6);
        expect(result.items[0].weeklyGoals![0]).toBe(30);
        expect(result.items[0].weeklyGoals![1]).toBe(30);
    });

    test('promedia semanalmente indicadores de promedio', () => {
        const item1 = createMockItem('Ind1', 'average', 10);
        item1.weeklyProgress = [10, 20];
        item1.weeklyGoals = [100, 100];
        const item2 = createMockItem('Ind1', 'average', 20);
        item2.weeklyProgress = [30, 40];
        item2.weeklyGoals = [200, 200];

        const db1: Dashboard = { id: 1, title: 'D1', subtitle: '', thresholds: mockThresholds, items: [item1] };
        const db2: Dashboard = { id: 2, title: 'D2', subtitle: '', thresholds: mockThresholds, items: [item2] };

        const result = calculateAggregateDashboard([db1, db2]);
        // (10+30)/2 = 20, (20+40)/2 = 30
        expect(result.items[0].weeklyProgress![0]).toBe(20);
        expect(result.items[0].weeklyProgress![1]).toBe(30);
        // (100+200)/2 = 150
        expect(result.items[0].weeklyGoals![0]).toBe(150);
        expect(result.items[0].weeklyGoals![1]).toBe(150);
    });

    test('respeta precisión decimal de settings', () => {
        const db1: Dashboard = { id: 1, title: 'D1', subtitle: '', thresholds: mockThresholds, items: [createMockItem('I', 'average', 10.1234)] };
        const db2: Dashboard = { id: 2, title: 'D2', subtitle: '', thresholds: mockThresholds, items: [createMockItem('I', 'average', 20.5678)] };

        const result1 = calculateAggregateDashboard([db1, db2], { decimalPrecision: 1 } as any);
        expect(result1.items[0].monthlyProgress[0]).toBe(15.3);

        const result2 = calculateAggregateDashboard([db1, db2], { decimalPrecision: 2 } as any);
        expect(result2.items[0].monthlyProgress[0]).toBe(15.35);
    });

    test('concatena indicadores diferentes (Regla Red Crop +)', () => {
        const db1: Dashboard = {
            id: 1, title: 'Norte', subtitle: '', thresholds: mockThresholds,
            items: [createMockItem('Ventas', 'accumulative', 10)]
        };
        const db2: Dashboard = {
            id: 2, title: 'Sur', subtitle: '', thresholds: mockThresholds,
            items: [createMockItem('Costos', 'accumulative', 20)]
        };

        const result = calculateAggregateDashboard([db1, db2]);
        expect(result.items.length).toBe(2);
        expect(result.items[0].indicator).toBe('Ventas (Norte)');
        expect(result.items[1].indicator).toBe('Costos (Sur)');
    });

    test('pesaje por indicador driver (buscando hacia atrás)', () => {
        // Mock Date to March
        const realDate = Date;
        global.Date = class extends realDate {
            constructor() {
                super();
                return new realDate('2025-03-15');
            }
        } as any;

        const item1 = createMockItem('Ind1', 'average', 10);
        const driver1 = createMockItem('Driver', 'accumulative', 0);
        driver1.monthlyProgress[0] = 500; // Value in Jan, but we are in March. Should find Jan value.

        const db1: Dashboard = { id: 1, title: 'DB1', subtitle: '', thresholds: mockThresholds, items: [item1, driver1] };

        const settings: SystemSettings = { aggregationStrategy: 'indicator', indicatorDriver: 'Driver' } as any;

        const result = calculateAggregateDashboard([db1], settings);
        // Weight should be 500. (10 * 500) / 500 = 10.
        expect(result.items[0].monthlyProgress[0]).toBe(10);

        global.Date = realDate;
    });

    test('pesaje por indicador driver (buscando en el futuro)', () => {
        const item1 = createMockItem('Ind1', 'average', 10);
        const driver1 = createMockItem('Driver', 'accumulative', 0);
        driver1.monthlyProgress[11] = 99; // Only value is in Dec. 

        const db1: Dashboard = { id: 1, title: 'DB1', subtitle: '', thresholds: mockThresholds, items: [item1, driver1] };
        const settings: SystemSettings = { aggregationStrategy: 'indicator', indicatorDriver: 'Driver' } as any;

        const result = calculateAggregateDashboard([db1], settings);
        // Weight should be 99.
        expect(result.items[0].monthlyProgress[0]).toBe(10);
    });
});

