import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { OperationalControlCenter, selectControlDashboards } from './OperationalControlCenter';
import { buildOperationalAlerts } from '../../utils/operationalAlerts';

jest.mock('../../utils/operationalAlerts', () => ({ buildOperationalAlerts: jest.fn() }));
jest.mock('./OperationalAlertsCenter', () => ({ OperationalAlertsCenter: () => <div>LISTA PRIORIZADA DE ALERTAS</div> }));
jest.mock('./TransversalActionPlansControl', () => ({ TransversalActionPlansControl: ({ canEdit }: { canEdit: boolean }) => <div data-testid="control-plans" data-can-edit={String(canEdit)}>RESUMEN EJECUTIVO DE PLANES</div> }));
jest.mock('./OperationalHistoryCenter', () => ({ OperationalHistoryCenter: () => <div>TRAZABILIDAD OPERATIVA</div> }));

const dashboard = { id: 1, title: 'Control', subtitle: '', group: 'Dirección', area: 'Área', thresholds: { onTrack: 90, atRisk: 70 }, items: [] } as any;

describe('OperationalControlCenter simplificado', () => {
  beforeEach(() => {
    (buildOperationalAlerts as jest.Mock).mockReturnValue([{ severity: 'CRÍTICO', missingPeriods: 2, stalenessDays: 10 }]);
  });

  it('presenta atención y planes en una sola lectura vertical', () => {
    render(<OperationalControlCenter dashboards={[dashboard]} currentDashboard={dashboard} globalThresholds={dashboard.thresholds} year={2026} />);
    expect(screen.getByRole('heading', { name: 'Gestión por excepción' })).toBeInTheDocument();
    expect(screen.getAllByText('LISTA PRIORIZADA DE ALERTAS')).toHaveLength(1);
    expect(screen.getByText('RESUMEN EJECUTIVO DE PLANES')).toBeInTheDocument();
    expect(buildOperationalAlerts).toHaveBeenCalledWith([dashboard], dashboard.thresholds, 2026);
  });

  it('mantiene los planes en solo lectura por defecto y propaga la autorización explícita', () => {
    const { rerender } = render(<OperationalControlCenter dashboards={[dashboard]} currentDashboard={dashboard} globalThresholds={dashboard.thresholds} year={2026} />);
    expect(screen.getByTestId('control-plans')).toHaveAttribute('data-can-edit', 'false');
    rerender(<OperationalControlCenter dashboards={[dashboard]} currentDashboard={dashboard} globalThresholds={dashboard.thresholds} year={2026} canEdit />);
    expect(screen.getByTestId('control-plans')).toHaveAttribute('data-can-edit', 'true');
  });

  it('usa el mismo dashboard físico que TABLERO en una vista no agregada', () => {
    const otherDashboard = { ...dashboard, id: 2, title: 'Otro tablero' };
    expect(selectControlDashboards([dashboard, otherDashboard], dashboard)).toEqual([dashboard, otherDashboard]);
  });

  it('conserva las fuentes físicas cuando el tablero visible es agregado', () => {
    const aggregate = { ...dashboard, id: 'agg-direccion', isAggregate: true };
    const sources = [dashboard, { ...dashboard, id: 2 }];
    expect(selectControlDashboards(sources, aggregate)).toEqual(sources);
  });

  it('does not mix physical dashboards from another synthetic client', () => {
    const a = { ...dashboard, id: 101, clientId: 'LAB-A' };
    const a2 = { ...dashboard, id: 102, clientId: 'LAB-A' };
    const b = { ...dashboard, id: 201, clientId: 'LAB-B' };
    expect(selectControlDashboards([a, a2, b], a, 'LAB-A')).toEqual([a, a2]);
    expect(selectControlDashboards([a, a2, b], b, 'LAB-B')).toEqual([b]);
    expect(selectControlDashboards([a, a2, b], b, 'all')).toEqual([b]);
  });

  it('oculta la navegación redundante sin eliminar el acceso al historial', () => {
    render(<OperationalControlCenter dashboards={[dashboard]} currentDashboard={dashboard} globalThresholds={dashboard.thresholds} year={2026} />);
    expect(screen.queryByText('Mapa de Calor')).not.toBeInTheDocument();
    expect(screen.queryByText('Rankings de Disciplina')).not.toBeInTheDocument();
    expect(screen.queryByText('Alertas de Atraso')).not.toBeInTheDocument();
    expect(screen.queryByText('Alertas Activas')).not.toBeInTheDocument();
    expect(screen.queryByText('TRAZABILIDAD OPERATIVA')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Ver historial operativo|Ver historial/ }));
    expect(screen.getByText('TRAZABILIDAD OPERATIVA')).toBeInTheDocument();
  });
});
