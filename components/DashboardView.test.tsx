import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { DashboardView } from './DashboardView';
import { DashboardRole } from '../types';

// Mock simpler components to focus on DashboardView logic
jest.mock('./Dashboard', () => ({
    Dashboard: () => React.createElement('div', { 'data-testid': 'dashboard-component' }, 'Mock Dashboard')
}));

jest.mock('./ReportCenter', () => ({
    ReportCenter: () => React.createElement('div', { 'data-testid': 'report-center' }, 'Mock Report Center')
}));

const mockDashboard = {
    id: 1,
    title: 'Tablero de Prueba',
    subtitle: '',
    items: [],
    group: 'Grupo A',
    thresholds: { onTrack: 95, atRisk: 85 }
} as any;

const mockUser = {
    id: 'u1',
    name: 'Test User',
    email: 'test@example.com',
    role: 'admin',
    canExportPPT: true
} as any;

describe('DashboardView Component', () => {
    test('debe renderizar el título del tablero y cumplimiento', () => {
        render(
            <DashboardView
                dashboard={mockDashboard}
                onUpdateItem={jest.fn()}
                userRole={DashboardRole.Editor}
                isGlobalAdmin={true}
                currentUser={mockUser}
            />
        );

        expect(screen.getByText('Tablero de Prueba')).toBeInTheDocument();
        expect(screen.getByText(/Cumplimiento Global/i)).toBeInTheDocument();
    });

    test('debe alternar entre vista de tablero y reporte', () => {
        render(
            <DashboardView
                dashboard={mockDashboard}
                onUpdateItem={jest.fn()}
                userRole={DashboardRole.Editor}
                isGlobalAdmin={true}
                currentUser={mockUser}
            />
        );

        const reportTab = screen.getByText(/Reporte Ejecutivo/i);
        fireEvent.click(reportTab);

        expect(screen.getByTestId('report-center')).toBeInTheDocument();

        const dashboardTab = screen.getByText(/Tablero/i);
        fireEvent.click(dashboardTab);
        expect(screen.getByTestId('dashboard-component')).toBeInTheDocument();
    });

    test('debe mostrar el botón de configurar área solo para admins', () => {
        const { rerender } = render(
            <DashboardView
                dashboard={mockDashboard}
                onUpdateItem={jest.fn()}
                userRole={DashboardRole.Viewer}
                isGlobalAdmin={false}
                currentUser={mockUser}
            />
        );

        expect(screen.queryByText(/Configurar Área/i)).not.toBeInTheDocument();

        rerender(
            <DashboardView
                dashboard={mockDashboard}
                onUpdateItem={jest.fn()}
                userRole={DashboardRole.Editor}
                isGlobalAdmin={true}
                currentUser={mockUser}
            />
        );

        expect(screen.getByText(/Configurar Área/i)).toBeInTheDocument();
    });
});
