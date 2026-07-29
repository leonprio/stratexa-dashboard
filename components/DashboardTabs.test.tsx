import { render, screen } from '@testing-library/react';
import React from 'react';
import { DashboardTabs, calculateCapture } from './DashboardTabs';
import { Dashboard as DashboardType } from '../types';

describe('DashboardTabs Component & Runtime Integrity (v9.4.17)', () => {
    const mockDashboards: DashboardType[] = [
        {
            id: 1,
            title: 'Tablero Operaciones',
            group: 'GENERAL',
            area: 'Sostenibilidad',
            items: [
                {
                    id: 'kpi-1',
                    indicator: 'KPI Sostenible',
                    monthlyProgress: [100, 100, 100, 100, 100, 100, 0, 0, 0, 0, 0, 0],
                    monthlyGoals: [100, 100, 100, 100, 100, 100, 0, 0, 0, 0, 0, 0],
                    goalType: 'maximize'
                }
            ]
        } as any,
        {
            id: 2,
            title: 'Tablero Sin Meta',
            group: 'GENERAL',
            area: 'SinMetasArea',
            items: [
                {
                    id: 'kpi-2',
                    indicator: 'KPI Informativo',
                    monthlyProgress: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                    monthlyGoals: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                    goalType: 'maximize'
                }
            ]
        } as any
    ];

    test('calculateCapture no lanza ReferenceError y retorna un número válido', () => {
        expect(() => {
            const val = calculateCapture(mockDashboards[0]);
            expect(typeof val).toBe('number');
        }).not.toThrow();
    });

    test('DashboardTabs renderiza sin lanzar ReferenceError y muestra cumplimiento y SIN META neutral', () => {
        render(
            <DashboardTabs
                dashboards={mockDashboards}
                activeDashboardId={1}
                selectedDashboardId={1}
                onSelectDashboard={jest.fn()}
                isGlobalAdmin={true}
                activeGroup="GENERAL"
                activeArea="TODAS"
            />
        );

        expect(screen.getByText('Tablero Operaciones')).toBeInTheDocument();
        expect(screen.getAllByText('SIN META').length).toBeGreaterThan(0);
    });

    test('Caso Sostenibilidad: Cumplimiento 30% vs Captura 50% -> Menú muestra 30%', () => {
        const sostenibilidadDashboard: DashboardType = {
            id: 3,
            title: 'Tablero Sostenibilidad',
            group: 'GENERAL',
            area: 'Sostenibilidad',
            items: [
                {
                    id: 'kpi-sost',
                    indicator: 'Ind Sostenible',
                    monthlyProgress: [60, 60, 60, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                    monthlyGoals: [100, 100, 100, 100, 100, 100, 0, 0, 0, 0, 0, 0],
                    goalType: 'maximize'
                }
            ]
        } as any;

        render(
            <DashboardTabs
                dashboards={[sostenibilidadDashboard]}
                activeDashboardId={3}
                selectedDashboardId={3}
                onSelectDashboard={jest.fn()}
                isGlobalAdmin={true}
                activeGroup="GENERAL"
                activeArea="TODAS"
            />
        );

        // Cumplimiento = 30%, no 50%
        expect(screen.getAllByText('30%').length).toBeGreaterThan(0);
        expect(screen.queryByText('50%')).not.toBeInTheDocument();
    });
});
