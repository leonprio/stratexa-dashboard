
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { IndicatorManager } from './IndicatorManager';
import { DashboardItem, Dashboard } from '../types';

// Mock dependencies if necessary
// Assuming indicatorManager renders a table or list where we can find items by text

const mockDashboards: Dashboard[] = [
    { id: 1, title: 'Dashboard 1', subtitle: 'Sub 1', items: [], thresholds: { onTrack: 90, atRisk: 70 } }
];

const mockItems: DashboardItem[] = [
    { id: 101, indicator: 'Alpha', weight: 10, unit: '%', type: 'average', goalType: 'maximize', monthlyGoals: [], monthlyProgress: [] }, // No order
    { id: 102, indicator: 'Beta', weight: 10, unit: '%', type: 'average', goalType: 'maximize', monthlyGoals: [], monthlyProgress: [] }, // No order
];

const mockItemsWithOrder: DashboardItem[] = [
    { id: 201, indicator: 'Second', order: 2, weight: 10, unit: '%', type: 'average', goalType: 'maximize', monthlyGoals: [], monthlyProgress: [] },
    { id: 202, indicator: 'First', order: 1, weight: 10, unit: '%', type: 'average', goalType: 'maximize', monthlyGoals: [], monthlyProgress: [] },
    { id: 203, indicator: 'Third', order: 3, weight: 10, unit: '%', type: 'average', goalType: 'maximize', monthlyGoals: [], monthlyProgress: [] },
];

const mockItemsMixed: DashboardItem[] = [
    { id: 301, indicator: 'Ordered First', order: 1, weight: 10, unit: '%', type: 'average', goalType: 'maximize', monthlyGoals: [], monthlyProgress: [] },
    { id: 302, indicator: 'No Order (ID 302)', weight: 10, unit: '%', type: 'average', goalType: 'maximize', monthlyGoals: [], monthlyProgress: [] },
    { id: 299, indicator: 'No Order (ID 299)', weight: 10, unit: '%', type: 'average', goalType: 'maximize', monthlyGoals: [], monthlyProgress: [] },
];

describe('IndicatorManager Sorting Logic', () => {

    it('renders items sorted by ID when no order is present', () => {
        const { container } = render(
            <IndicatorManager
                initialItems={mockItems}
                dashboards={mockDashboards}
                activeDashboardId={1}
                onSaveChanges={() => { }}
                onCancel={() => { }}
                onDashboardSelect={() => { }}
            />
        );

        // Find all rows in tbody
        const rows = Array.from(container.querySelectorAll('tbody tr'));
        // Extract value from the input in the 2nd cell (Name)
        const values = rows.map(row => {
            const input = row.querySelector('td:nth-child(2) input') as HTMLInputElement;
            return input ? input.value : null;
        });

        // Expected order: Alpha (101), Beta (102)
        expect(values).toEqual(['Alpha', 'Beta']);
    });

    it('renders items sorted by "order" field when present', () => {
        const { container } = render(
            <IndicatorManager
                initialItems={mockItemsWithOrder}
                dashboards={mockDashboards}
                activeDashboardId={1}
                onSaveChanges={() => { }}
                onCancel={() => { }}
                onDashboardSelect={() => { }}
            />
        );

        const rows = Array.from(container.querySelectorAll('tbody tr'));
        const values = rows.map(row => {
            const input = row.querySelector('td:nth-child(2) input') as HTMLInputElement;
            return input ? input.value : null;
        });

        // Expected order: First (order 1), Second (order 2), Third (order 3)
        expect(values).toEqual(['First', 'Second', 'Third']);
    });

    // Test mixed scenario logic: 
    // Logic was: if (a.order !== undefined && b.order !== undefined) return a.order - b.order;
    // return (Number(a.id) || 999) - (Number(b.id) || 999);
    // Be careful: if one has order and other doesn't, it falls through to ID sort.
    // This implies that if we mix ordered and unordered items, the order field is IGNORED for comparison if one is missing it?
    // Let's check the implemented logic:
    // if (a.order !== undefined && b.order !== undefined) { return a.order - b.order; }
    // return (Number(a.id) || 999) - (Number(b.id) || 999);

    // Correct! So if I have:
    // A: {order: 1, id: 300}
    // B: {order: undefined, id: 100}
    // Compare A, B: order check fails (one is undefined). Fallback to ID. 
    // 300 - 100 = 200 (positive). So B comes before A. 
    // This means "Ordered" items don't necessarily float to top if mixed.
    // This is acceptable behavior for the "Migration" phase described in plan (old items sort by ID, new/moved get order).
    // As long as items WITH order verify against each other.
});
