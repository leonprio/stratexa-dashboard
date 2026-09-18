import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { PendingAlertsCenter } from './PendingAlertsCenter';
import type { Dashboard } from '../../types';

const period = { frequency: 'monthly' as const, year: 2026, monthIndex: 8 };
const dashboard = (id: number, goal: number | null, progress: number | null, start: any): Dashboard => ({
  id, title: `Área ${id}`, subtitle: '', area: 'Operaciones', periodicity: 'monthly', thresholds: { onTrack: 95, atRisk: 85 },
  items: [{ id, indicator: `KPI ${id}`, weight: 1, unit: 'u', type: 'accumulative', goalType: 'maximize', trackingStartPeriod: start,
    monthlyGoals: Object.assign(Array(12).fill(null), { 8: goal }), monthlyProgress: Object.assign(Array(12).fill(null), { 8: progress }),
    monthlyGoalCaptured: Object.assign(Array(12).fill(false), { 8: goal !== null }), monthlyProgressCaptured: Object.assign(Array(12).fill(false), { 8: progress !== null }) }],
});

describe('PendingAlertsCenter', () => {
  beforeEach(() => jest.useFakeTimers().setSystemTime(new Date(2026, 8, 11)));
  afterEach(() => jest.useRealTimers());

  it('presents only actionable categories and deep-links an action to the canonical KPI surface', () => {
    const onNavigateToKpi = jest.fn();
    render(<PendingAlertsCenter dashboards={[dashboard(1, null, null, undefined), dashboard(2, null, null, period), dashboard(3, 100, 40, period), dashboard(4, 100, 100, period), dashboard(5, null, null, { ...period, monthIndex: 10 })]} year={2026} authorizedDashboardIds={[1, 2, 3, 4, 5]} onNavigateToKpi={onNavigateToKpi} />);
    expect(screen.getByText('3 asuntos requieren atención')).toBeInTheDocument();
    expect(screen.getByText('INICIO SIN CONFIGURAR')).toBeInTheDocument();
    expect(screen.getByText('POR CONFIGURAR')).toBeInTheDocument();
    expect(screen.getByText('RESULTADO CRÍTICO')).toBeInTheDocument();
    expect(screen.queryByText('KPI 4')).not.toBeInTheDocument();
    expect(screen.queryByText('KPI 5')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'CONFIGURAR' }));
    expect(onNavigateToKpi).toHaveBeenCalledWith(2, 2);
  });
});
