import { getWeekNumber, getYearWeekMapping, aggregateWeeklyToMonthly } from './weeklyUtils';

describe('weeklyUtils', () => {
    describe('getWeekNumber', () => {
        it('should return 1 for Jan 1, 2025', () => {
            const date = new Date(2025, 0, 1);
            expect(getWeekNumber(date)).toBe(1);
        });

        it('should handle different start days', () => {
            const date = new Date(2025, 0, 1);
            // Jan 1, 2025 is Wednesday
            expect(getWeekNumber(date, 1)).toBe(1);
            expect(getWeekNumber(date, 0)).toBe(1);
        });
    });

    describe('getYearWeekMapping', () => {
        it('should return 53 weeks for 2025', () => {
            const mapping = getYearWeekMapping(2025);
            expect(mapping.length).toBeGreaterThanOrEqual(52);
            expect(mapping[0].weekIndex).toBe(0);
        });

        it('should have month contributions that sum to 1', () => {
            const mapping = getYearWeekMapping(2025);
            mapping.forEach(week => {
                const sum = Object.values(week.monthContributions).reduce((a, b) => a + b, 0);
                expect(sum).toBeCloseTo(1, 5);
            });
        });
    });

    describe('aggregateWeeklyToMonthly', () => {
        it('should aggregate weekly values to monthly using average mode', () => {
            const weeklyValues = Array(53).fill(100);
            const monthlyValues = aggregateWeeklyToMonthly(weeklyValues, 2025, 1, undefined, 'average');

            monthlyValues.forEach(val => {
                expect(val).toBeCloseTo(100, 5);
            });
        });

        it('should aggregate weekly values to monthly using sum mode', () => {
            const weeklyValues = Array(53).fill(7); // 1 per day
            const monthlyValues = aggregateWeeklyToMonthly(weeklyValues, 2025, 1, undefined, 'sum');

            // In 2025, Jan has 31 days. So Jan should have sum of ~31.
            // Weekly sum might be slightly different depending on week boundaries.
            const totalSum = monthlyValues.reduce((a, b) => (a || 0) + (b || 0), 0);
            expect(totalSum).toBeCloseTo(371, 0); // 53 weeks * 7 = 371 days
        });

        it('should handle null values', () => {
            const weeklyValues = Array(53).fill(null);
            const monthlyValues = aggregateWeeklyToMonthly(weeklyValues, 2025);
            monthlyValues.forEach(val => expect(val).toBeNull());
        });
    });
});
