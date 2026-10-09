import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ControlCutComparisonSection } from './ControlCutComparisonSection';
import { firebaseService } from '../../services/firebaseService';
import { Dashboard, User, GlobalUserRole, DashboardRole } from '../../types';
import { ControlCut } from '../../types/controlCut';

jest.mock('../../services/firebaseService', () => ({
  firebaseService: {
    listControlCuts: jest.fn(),
    createControlCut: jest.fn(),
    getActiveActionPlansForDashboard: jest.fn(),
  },
}));

describe('ControlCutComparisonSection', () => {
  const mockUser: User = {
    id: 'user-1',
    name: 'Admin User',
    email: 'admin@empresa.com',
    globalRole: GlobalUserRole.Admin,
    clientId: 'CLIENT_A',
    dashboardAccess: { '1': DashboardRole.Editor },
  };

  const mockDashboard: Dashboard = {
    id: 1,
    title: 'Operaciones',
    subtitle: 'Tablero Operativo',
    clientId: 'CLIENT_A',
    isAggregate: false,
    group: 'Operaciones',
    area: 'Planta',
    year: 2026,
    periodicity: 'monthly',
    thresholds: { onTrack: 90, atRisk: 75 },
    items: [],
  };

  const sampleCutA: ControlCut = {
    cutId: 'CLIENT_A_1_M_2026_0',
    schemaVersion: 1,
    capturedAt: '2026-01-31T20:00:00Z',
    capturedByLabel: 'Supervisor',
    clientId: 'CLIENT_A',
    dashboardId: 1,
    dashboardIds: [1],
    periodicity: 'monthly',
    year: 2026,
    periodIndex: 0,
    scope: {
      clientId: 'CLIENT_A',
      dashboardId: 1,
      dashboardIds: [1],
      periodicity: 'monthly',
      year: 2026,
      periodIndex: 0,
    },
    controlSummary: {
      pendingConfigurationsCount: 0,
      pendingCapturesCount: 1,
      overdueActionsCount: 2,
      upcomingActionsCount: 0,
      activeActionsCount: 2,
      completedActionsCount: 1,
      pendingReviewsCount: 1,
      derivedAttentionCount: 2,
    },
    kpis: [
      {
        indicatorId: 10,
        label: 'Eficiencia',
        goal: 100,
        progress: 80,
        compliance: 80,
        pending: 20,
        frequency: 'monthly',
        dashboardId: 1,
      },
    ],
    actionPlans: [],
    reviews: [],
  };

  const sampleCutB: ControlCut = {
    cutId: 'CLIENT_A_1_M_2026_1',
    schemaVersion: 1,
    capturedAt: '2026-02-28T20:00:00Z',
    capturedByLabel: 'Gerente',
    clientId: 'CLIENT_A',
    dashboardId: 1,
    dashboardIds: [1],
    periodicity: 'monthly',
    year: 2026,
    periodIndex: 1,
    scope: {
      clientId: 'CLIENT_A',
      dashboardId: 1,
      dashboardIds: [1],
      periodicity: 'monthly',
      year: 2026,
      periodIndex: 1,
    },
    controlSummary: {
      pendingConfigurationsCount: 0,
      pendingCapturesCount: 0,
      overdueActionsCount: 1,
      upcomingActionsCount: 0,
      activeActionsCount: 1,
      completedActionsCount: 2,
      pendingReviewsCount: 0,
      derivedAttentionCount: 1,
    },
    kpis: [
      {
        indicatorId: 10,
        label: 'Eficiencia',
        goal: 100,
        progress: 95,
        compliance: 95,
        pending: 5,
        frequency: 'monthly',
        dashboardId: 1,
      },
    ],
    actionPlans: [],
    reviews: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renderiza y carga cortes históricos desde listControlCuts', async () => {
    (firebaseService.listControlCuts as jest.Mock).mockResolvedValue([sampleCutA, sampleCutB]);

    render(
      <ControlCutComparisonSection
        dashboards={[mockDashboard]}
        currentDashboard={mockDashboard}
        activeClientId="CLIENT_A"
        currentUser={mockUser}
        year={2026}
      />,
    );

    expect(screen.getByText(/Comparación A\/B de Cortes Históricos/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(firebaseService.listControlCuts).toHaveBeenCalledWith('CLIENT_A', 1, 2026, 'monthly');
      expect(screen.getByText(/2 corte\(s\) histórico\(s\) inmutable\(s\) disponible\(s\)/i)).toBeInTheDocument();
    });
  });

  test('permite seleccionar dos cortes y abrir el modal de comparación A/B en solo lectura', async () => {
    (firebaseService.listControlCuts as jest.Mock).mockResolvedValue([sampleCutA, sampleCutB]);

    render(
      <ControlCutComparisonSection
        dashboards={[mockDashboard]}
        currentDashboard={mockDashboard}
        activeClientId="CLIENT_A"
        currentUser={mockUser}
        year={2026}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/2 corte\(s\) histórico\(s\) inmutable\(s\) disponible\(s\)/i)).toBeInTheDocument();
    });

    const selects = screen.getAllByRole('combobox');
    const selectCutA = selects[2];
    const selectCutB = selects[3];

    fireEvent.change(selectCutA, { target: { value: sampleCutA.cutId } });
    fireEvent.change(selectCutB, { target: { value: sampleCutB.cutId } });

    const compareBtn = screen.getByRole('button', { name: /Comparar Cortes/i });
    expect(compareBtn).toBeEnabled();

    fireEvent.click(compareBtn);

    // Modal abierto con comparativa
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/COMPARACIÓN A\/B DE CORTES/i)).toBeInTheDocument();
    expect(screen.getByText(/KPIs Mejoraron/i)).toBeInTheDocument();

    // Inmutabilidad / solo lectura: No hay botones de escritura, guardado o mutación en la comparación
    expect(screen.queryByRole('button', { name: /Guardar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Actualizar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Eliminar/i })).not.toBeInTheDocument();

    // Botón cerrar modal
    const closeBtn = screen.getByRole('button', { name: /^Cerrar$/i });
    fireEvent.click(closeBtn);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('viewer autorizado puede ver y comparar sin mutaciones', async () => {
    const viewerUser: User = {
      id: 'viewer-1',
      name: 'Viewer',
      email: 'viewer@empresa.com',
      globalRole: GlobalUserRole.Member,
      clientId: 'CLIENT_A',
      dashboardAccess: { '1': DashboardRole.Viewer },
    };

    (firebaseService.listControlCuts as jest.Mock).mockResolvedValue([sampleCutA, sampleCutB]);

    render(
      <ControlCutComparisonSection
        dashboards={[mockDashboard]}
        currentDashboard={mockDashboard}
        activeClientId="CLIENT_A"
        currentUser={viewerUser}
        year={2026}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/2 corte\(s\) histórico\(s\) inmutable\(s\) disponible\(s\)/i)).toBeInTheDocument();
    });
  });

  test('usuario fuera de scope no ve dashboards ni cortes ajenos (fails closed)', async () => {
    const outOfScopeUser: User = {
      id: 'other-user',
      name: 'Other',
      email: 'other@empresa.com',
      globalRole: GlobalUserRole.Admin,
      clientId: 'CLIENT_B',
      dashboardAccess: { '999': DashboardRole.Editor },
    };

    render(
      <ControlCutComparisonSection
        dashboards={[mockDashboard]}
        currentDashboard={mockDashboard}
        activeClientId="CLIENT_B"
        currentUser={outOfScopeUser}
        year={2026}
      />,
    );

    // No llama listControlCuts para tablero 1 porque no tiene acceso
    expect(firebaseService.listControlCuts).not.toHaveBeenCalled();
    expect(screen.queryByText(/2 corte\(s\) histórico\(s\)/i)).not.toBeInTheDocument();
  });

  describe('Acción operativa: Cerrar corte', () => {
    test('editor autorizado visualiza el botón Cerrar Corte', async () => {
      (firebaseService.listControlCuts as jest.Mock).mockResolvedValue([]);

      render(
        <ControlCutComparisonSection
          dashboards={[mockDashboard]}
          currentDashboard={mockDashboard}
          activeClientId="CLIENT_A"
          currentUser={mockUser}
          year={2026}
        />,
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /^Cerrar Corte$/i })).toBeInTheDocument();
      });
    });

    test('viewer NO visualiza el botón Cerrar Corte', async () => {
      const viewerUser: User = {
        id: 'viewer-1',
        name: 'Viewer',
        email: 'viewer@empresa.com',
        globalRole: GlobalUserRole.Member,
        clientId: 'CLIENT_A',
        dashboardAccess: { '1': DashboardRole.Viewer },
      };

      (firebaseService.listControlCuts as jest.Mock).mockResolvedValue([]);

      render(
        <ControlCutComparisonSection
          dashboards={[mockDashboard]}
          currentDashboard={mockDashboard}
          activeClientId="CLIENT_A"
          currentUser={viewerUser}
          year={2026}
        />,
      );

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /^Cerrar Corte$/i })).not.toBeInTheDocument();
      });
    });

    test('al presionar Cerrar Corte se abre modal con advertencia irreversible y datos del tablero', async () => {
      (firebaseService.listControlCuts as jest.Mock).mockResolvedValue([]);

      render(
        <ControlCutComparisonSection
          dashboards={[mockDashboard]}
          currentDashboard={mockDashboard}
          activeClientId="CLIENT_A"
          currentUser={mockUser}
          year={2026}
        />,
      );

      const closeCutBtn = await screen.findByRole('button', { name: /^Cerrar Corte$/i });
      fireEvent.click(closeCutBtn);

      // Modal de cierre
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText(/Operación de Cierre Inmutable/i)).toBeInTheDocument();
      expect(
        screen.getByText(/Este corte conservará el estado actual del período y no podrá modificarse ni eliminarse/i),
      ).toBeInTheDocument();
      expect(screen.getByText(/Confirmar Cierre de Corte/i)).toBeInTheDocument();
    });

    test('crea corte inmutable fiel invocando firebaseService.createControlCut e informa éxito', async () => {
      (firebaseService.listControlCuts as jest.Mock).mockResolvedValue([]);
      (firebaseService.getActiveActionPlansForDashboard as jest.Mock).mockResolvedValue([]);
      (firebaseService.createControlCut as jest.Mock).mockResolvedValue({
        success: true,
        created: true,
        cut: sampleCutA,
      });

      render(
        <ControlCutComparisonSection
          dashboards={[mockDashboard]}
          currentDashboard={mockDashboard}
          activeClientId="CLIENT_A"
          currentUser={mockUser}
          year={2026}
        />,
      );

      const closeCutBtn = await screen.findByRole('button', { name: /^Cerrar Corte$/i });
      fireEvent.click(closeCutBtn);

      const confirmBtn = screen.getByRole('button', { name: /Confirmar Cierre de Corte/i });
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(firebaseService.createControlCut).toHaveBeenCalled();
        expect(screen.getByText(/Corte cerrado y registrado exitosamente/i)).toBeInTheDocument();
      });
    });

    test('respeta idempotencia: si ya estaba registrado informa "Corte ya registrado previamente"', async () => {
      (firebaseService.listControlCuts as jest.Mock).mockResolvedValue([]);
      (firebaseService.getActiveActionPlansForDashboard as jest.Mock).mockResolvedValue([]);
      (firebaseService.createControlCut as jest.Mock).mockResolvedValue({
        success: true,
        created: false,
        cut: sampleCutA,
      });

      render(
        <ControlCutComparisonSection
          dashboards={[mockDashboard]}
          currentDashboard={mockDashboard}
          activeClientId="CLIENT_A"
          currentUser={mockUser}
          year={2026}
        />,
      );

      const closeCutBtn = await screen.findByRole('button', { name: /^Cerrar Corte$/i });
      fireEvent.click(closeCutBtn);

      const confirmBtn = screen.getByRole('button', { name: /Confirmar Cierre de Corte/i });
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(firebaseService.createControlCut).toHaveBeenCalled();
        expect(screen.getByText(/Corte ya registrado previamente para este período/i)).toBeInTheDocument();
      });
    });
  });
});

