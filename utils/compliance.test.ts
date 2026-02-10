import { describe, it, expect } from '@jest/globals';
import { evaluateFormula, calculateMonthlyCompliancePercentage, calculateCompliance } from './compliance';
import { DashboardItem, ComplianceThresholds } from '../types';

describe('Motor de Cumplimiento v6.0.1', () => {
    const mockThresholds: ComplianceThresholds = { onTrack: 95, atRisk: 80 };

    describe('evaluateFormula', () => {
        const items: DashboardItem[] = [
            { id: 101, indicator: 'K1', monthlyProgress: [10, 20], monthlyGoals: [10, 10] } as any,
            { id: 102, indicator: 'K2', monthlyProgress: [5, 5], monthlyGoals: [5, 5] } as any
        ];

        it('debe sumar dos indicadores correctamente', () => {
            const formula = '{id:101} + {id:102}';
            const result = evaluateFormula(formula, items, 0, 'monthlyProgress');
            expect(result).toBe(15);
        });

        it('debe retornar 0 si el indicador no existe', () => {
            const formula = '{id:999} + 10';
            const result = evaluateFormula(formula, items, 0, 'monthlyProgress');
            expect(result).toBe(10);
        });
    });

    describe('calculateMonthlyCompliancePercentage', () => {
        it('higher is better: 80/100 -> 80%', () => {
            expect(calculateMonthlyCompliancePercentage(80, 100, false)).toBe(80);
        });

        it('lower is better: 120/100 -> 83.33%', () => {
            expect(calculateMonthlyCompliancePercentage(120, 100, true)).toBeCloseTo(83.33);
        });

        it('sin datos (0,0) -> 0%', () => {
            expect(calculateMonthlyCompliancePercentage(0, 0, false)).toBe(0);
        });
    });

    describe('calculateCompliance (Contexto Global)', () => {
        const globalContext: DashboardItem[] = [
            { id: 1, indicator: 'UNE 1', monthlyProgress: [100], monthlyGoals: [100] } as any
        ];

        const aggregateItem: DashboardItem = {
            id: 'agg-1',
            indicator: 'Total Operaciones',
            indicatorType: 'compound',
            componentIds: [1],
            monthlyProgress: [0], // Debería sobreescribirse
            monthlyGoals: [0]
        } as any;

        it('un agregado debe encontrar a su hijo en el contexto global', () => {
            const result = calculateCompliance(aggregateItem, mockThresholds, 2026, 'realTime', [], globalContext);
            expect(result.overallPercentage).toBe(100);
            expect(result.complianceStatus).toBe('OnTrack');
        });

        it('un agregado sin contexto debe retornar 0%', () => {
            const result = calculateCompliance(aggregateItem, mockThresholds, 2026, 'realTime', [], []);
            expect(result.overallPercentage).toBe(0);
        });
    });
});
