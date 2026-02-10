import { describe, it, expect, afterEach } from '@jest/globals';
import {
    calculateCompliance,
    getStatusForPercentage,
    calculateMonthlyCompliancePercentage,
    getMissingMonthsWarning,
    getOverdueWarning,
    calculateDashboardWeightedScore
} from './compliance';
import { DashboardItem, ComplianceThresholds } from '../types';

describe('compliance utils', () => {
    const thresholds: ComplianceThresholds = {
        onTrack: 90,
        atRisk: 70
    };

    const realDate = global.Date;

    const setMockDate = (isoString: string) => {
        const mockDate = new realDate(isoString);
        global.Date = class extends realDate {
            constructor(...args: any[]) {
                if (args.length === 0) {
                    super();
                    return mockDate;
                }
                return new (realDate as any)(...args);
            }
            static now() { return mockDate.getTime(); }
            static UTC(...args: any[]) { return realDate.UTC(...(args as [any])); }
            static parse(s: string) { return realDate.parse(s); }
        } as any;
    };

    afterEach(() => {
        global.Date = realDate;
    });

    describe('getStatusForPercentage', () => {
        it('returns correct status based on thresholds', () => {
            expect(getStatusForPercentage(95, thresholds)).toBe('OnTrack');
            expect(getStatusForPercentage(85, thresholds)).toBe('AtRisk');
            expect(getStatusForPercentage(65, thresholds)).toBe('OffTrack');
        });
    });

    describe('calculateMonthlyCompliancePercentage', () => {
        it('handles target 0 and actual 0 (no data case)', () => {
            expect(calculateMonthlyCompliancePercentage(0, 0, false)).toBe(0);
        });

        it('handles target 0 and actual 0 for lower-is-better (case sin datos)', () => {
            // Regla: if (t === 0 && a === 0) return 0;
            expect(calculateMonthlyCompliancePercentage(0, 0, true)).toBe(0);
        });

        it('handles target 0 for higher-is-better', () => {
            expect(calculateMonthlyCompliancePercentage(10, 0, false)).toBe(100);
        });

        it('handles target 0 for lower-is-better (with actual > 0)', () => {
            expect(calculateMonthlyCompliancePercentage(10, 0, true)).toBe(0);
        });

        it('calculates lower-is-better correctly', () => {
            expect(calculateMonthlyCompliancePercentage(10, 20, true)).toBe(200);
            expect(calculateMonthlyCompliancePercentage(40, 20, true)).toBe(50);
            expect(calculateMonthlyCompliancePercentage(0, 20, true)).toBe(100);
        });
    });

    describe('getMissingMonthsWarning', () => {
        it('returns null if no missing data', () => {
            expect(getMissingMonthsWarning([10, 10], [10, 10])).toBeNull();
            expect(getMissingMonthsWarning([0, 0], [0, 0])).toBeNull();
            expect(getMissingMonthsWarning([], [])).toBeNull();
        });

        it('returns warning for incomplete months', () => {
            const warning = getMissingMonthsWarning([10, 0], [0, 10]);
            expect(warning).toContain('Ene');
            expect(warning).toContain('Feb');
        });

        it('handles null/undefined objects', () => {
            expect(getMissingMonthsWarning(null, null)).toBeNull();
        });
    });

    describe('getOverdueWarning', () => {
        it('returns warning for past months with no data', () => {
            setMockDate('2025-03-15T12:00:00Z');
            const warning = getOverdueWarning(Array(12).fill(0), Array(12).fill(0));
            expect(warning).toContain('Ene');
            expect(warning).toContain('Feb');
            expect(warning).not.toContain('Mar');
        });
    });

    describe('calculateCompliance', () => {
        it('handles weekly items in current year (past weeks)', () => {
            setMockDate('2025-06-20T12:00:00Z');

            const mockItem: DashboardItem = {
                id: 6,
                indicator: 'Weekly Current',
                unit: 'x',
                weight: 10,
                frequency: 'weekly',
                type: 'accumulative',
                goalType: 'maximize',
                weeklyGoals: Array(53).fill(10),
                weeklyProgress: Array(53).fill(5),
                monthlyGoals: [],
                monthlyProgress: [],
                paiRows: []
            };

            const result = calculateCompliance(mockItem, thresholds, 2025);
            expect(result.isActive).toBe(true);
            expect(result.overallPercentage).toBe(50);
        });

        it('handles current year monthly limit strictly (YTD)', () => {
            setMockDate('2025-03-15T12:00:00Z');

            const mockItem: DashboardItem = {
                id: 5,
                indicator: 'Monthly Current Year',
                unit: 'x',
                weight: 10,
                type: 'average',
                goalType: 'maximize',
                monthlyGoals: [100, 100, 100, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                monthlyProgress: [100, 100, 50, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                paiRows: []
            };

            const result = calculateCompliance(mockItem, thresholds, 2025, 'definitive');
            // In March, only Jan and Feb (Index 0, 1) are closed.
            expect(result.overallPercentage).toBe(100);
        });

        it('calculates average correctly for maximize in past year', () => {
            const mockItem: DashboardItem = {
                id: 1,
                indicator: 'A',
                unit: '%',
                weight: 10,
                type: 'average',
                goalType: 'maximize',
                monthlyGoals: [100, 100, 0],
                monthlyProgress: [80, 70, 0],
                paiRows: []
            };
            const result = calculateCompliance(mockItem, thresholds, 2024);
            expect(result.overallPercentage).toBe(75);
        });

        it('handles year > currentYear by returning inactive', () => {
            setMockDate('2025-01-01T00:00:00Z');
            const mockItem: any = { monthlyGoals: [100], monthlyProgress: [100], frequency: 'monthly' };
            const result = calculateCompliance(mockItem, thresholds, 2026);
            expect(result.isActive).toBe(false);
            expect(result.overallPercentage).toBe(0);
        });
    });

    describe('calculateDashboardWeightedScore', () => {
        it('calculates weighted score correctly', () => {
            const items: DashboardItem[] = [
                {
                    id: 1, indicator: 'A', weight: 50, type: 'average', goalType: 'maximize',
                    monthlyGoals: [100], monthlyProgress: [100], unit: '',
                },
                {
                    id: 2, indicator: 'B', weight: 50, type: 'average', goalType: 'maximize',
                    monthlyGoals: [100], monthlyProgress: [50], unit: '',
                }
            ];
            expect(calculateDashboardWeightedScore(items, thresholds, 2024)).toBe(75);
        });

        it('caps percentage at 200 for score calculation', () => {
            const items: DashboardItem[] = [
                {
                    id: 1, indicator: 'A', weight: 100, type: 'average', goalType: 'maximize',
                    monthlyGoals: [10], monthlyProgress: [50], unit: '', // 500% compliance
                }
            ];
            expect(calculateDashboardWeightedScore(items, thresholds, 2024)).toBe(200);
        });

        it('returns 0 if all items are inactive', () => {
            const items: DashboardItem[] = [{ id: 1, indicator: 'I', weight: 50, type: 'average', goalType: 'maximize', monthlyGoals: [0], monthlyProgress: [0], unit: '' }];
            expect(calculateDashboardWeightedScore(items, thresholds, 2024)).toBe(0);
        });
    });
});
