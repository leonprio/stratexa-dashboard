import React from 'react';
import { render, screen } from '@testing-library/react';
import { ObjectivesView } from './ObjectivesView';

const dashboard: any = { id: 'd1', title: 'Operaciones', thresholds: { onTrack: 90, atRisk: 70 }, items: [
  { id: 'k1', indicator: 'KPI asociado', weight: 1, monthlyGoals: [100], monthlyProgress: [81], unit: '%', type: 'average', goalType: 'maximize' },
  { id: 'k2', indicator: 'KPI sin objetivo', weight: 1, monthlyGoals: [100], monthlyProgress: [84], unit: '%', type: 'average', goalType: 'maximize' },
] };
const objective: any = { id: 'oe1', title: 'Fortalecer resultados', code: 'OE-01', perspectiveId: 'FIN', clientId: 'IPS', order: 1 };
const contribution: any = { id: 'oc1', title: 'Contribución', primaryStrategicObjectiveId: 'oe1', status: 'active' };

describe('ObjectivesView', () => {
  it('muestra KPIs asociados y separa los no vinculados', () => {
    render(<ObjectivesView dashboard={dashboard} objectives={[objective]} perspectives={[{ id: 'FIN', name: 'Financiera', order: 1 } as any]} contributions={[contribution]} assignments={[{ id: 'a1', contributionObjectiveId: 'oc1', dashboardId: 'd1', itemId: 'k1' } as any]} year={2026} />);
    expect(screen.getByText('Fortalecer resultados')).toBeInTheDocument();
    expect(screen.getByText('KPI asociado')).toBeInTheDocument();
    expect(screen.getByText('81% · ESTABLE')).toBeInTheDocument();
    expect(screen.getByText(/KPIs SIN OBJETIVO ASOCIADO/)).toBeInTheDocument();
  });

  it('muestra explícitamente objetivos sin indicadores', () => {
    render(<ObjectivesView dashboard={{ ...dashboard, items: [] }} objectives={[objective]} perspectives={[]} contributions={[]} assignments={[]} year={2026} />);
    expect(screen.getByText('SIN INDICADORES ASOCIADOS')).toBeInTheDocument();
  });
});
