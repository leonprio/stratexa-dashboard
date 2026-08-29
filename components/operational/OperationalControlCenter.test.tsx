import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { OperationalControlCenter } from './OperationalControlCenter';
import { buildOperationalAlerts } from '../../utils/operationalAlerts';

jest.mock('../../utils/operationalAlerts', () => ({ buildOperationalAlerts: jest.fn() }));
jest.mock('./OperationalAlertsCenter', () => ({ OperationalAlertsCenter: () => <div>LISTA PRIORIZADA DE ALERTAS</div> }));
jest.mock('./TransversalActionPlansControl', () => ({ TransversalActionPlansControl: () => <div>RESUMEN EJECUTIVO DE PLANES</div> }));
jest.mock('./OperationalHistoryCenter', () => ({ OperationalHistoryCenter: () => <div>TRAZABILIDAD OPERATIVA</div> }));

const dashboard = { id: 1, title: 'Control', subtitle: '', group: 'Dirección', area: 'Área', thresholds: { onTrack: 90, atRisk: 70 }, items: [] } as any;

describe('OperationalControlCenter simplificado', () => {
  beforeEach(() => {
    (buildOperationalAlerts as jest.Mock).mockReturnValue([{ severity: 'CRÍTICO', missingPeriods: 2, stalenessDays: 10 }]);
  });

  it('presenta atención y planes en una sola lectura vertical', () => {
    render(<OperationalControlCenter dashboards={[dashboard]} currentDashboard={dashboard} globalThresholds={dashboard.thresholds} year={2026} />);
    expect(screen.getByRole('heading', { name: 'Gestión por excepción' })).toBeInTheDocument();
    expect(screen.getByText('LISTA PRIORIZADA DE ALERTAS')).toBeInTheDocument();
    expect(screen.getByText('RESUMEN EJECUTIVO DE PLANES')).toBeInTheDocument();
    expect(buildOperationalAlerts).toHaveBeenCalledWith([dashboard], dashboard.thresholds, 2026);
  });

  it('oculta la navegación redundante sin eliminar el acceso al historial', () => {
    render(<OperationalControlCenter dashboards={[dashboard]} currentDashboard={dashboard} globalThresholds={dashboard.thresholds} year={2026} />);
    expect(screen.queryByText('Mapa de Calor')).not.toBeInTheDocument();
    expect(screen.queryByText('Rankings de Disciplina')).not.toBeInTheDocument();
    expect(screen.queryByText('Alertas de Atraso')).not.toBeInTheDocument();
    expect(screen.queryByText('Alertas Activas')).not.toBeInTheDocument();
    expect(screen.queryByText('TRAZABILIDAD OPERATIVA')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ver historial operativo' }));
    expect(screen.getByText('TRAZABILIDAD OPERATIVA')).toBeInTheDocument();
  });
});
