
import { calculateCompliance } from './utils/compliance.js';

const thresholds = { onTrack: 90, atRisk: 70 };

// Simulate the failing YTD test
const mockItem = {
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

// Mock Date to March 15, 2025
const realDate = Date;
global.Date = class extends realDate {
    constructor(...args) {
        if (args.length === 0) return new realDate('2025-03-15T12:00:00Z');
        return new realDate(...args);
    }
    static now() { return new realDate('2025-03-15T12:00:00Z').getTime(); }
};

console.log('Current Year:', new Date().getFullYear());
console.log('Current Month Index:', new Date().getMonth());

const result = calculateCompliance(mockItem, thresholds, 2025);
console.log('Result:', result);

if (result.overallPercentage === 100) {
    console.log('Test PASSED in script');
} else {
    console.log('Test FAILED in script. Expected 100, got', result.overallPercentage);
}
