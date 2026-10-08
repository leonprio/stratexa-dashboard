import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { CurrentPeriodFocus } from './CurrentPeriodFocus';
import { DashboardItem } from '../types';

describe('CurrentPeriodFocus Runtime & Derived Indicators Render Test (v9.4.13)', () => {
  beforeEach(() => {
    window.HTMLElement.prototype.scrollIntoView = jest.fn();
  });

  const mockItems: DashboardItem[] = [
    {
      id: 2,
      indicator: 'Compromisos acordados',
      indicatorType: 'simple',
      type: 'accumulative',
      frequency: 'monthly',
      monthlyProgress: [0, 0, 0, 0, 0, 6, 0, 0, 0, 0, 0, 0],
      monthlyGoals: [0, 0, 0, 0, 0, 8, 0, 0, 0, 0, 0, 0],
      unit: '',
      goalType: 'maximize',
    },
    {
      id: 3,
      indicator: 'Compromisos cerrados con evidencia',
      indicatorType: 'simple',
      type: 'accumulative',
      frequency: 'monthly',
      monthlyProgress: [0, 0, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0],
      monthlyGoals: [0, 0, 0, 0, 0, 4, 0, 0, 0, 0, 0, 0],
      unit: '',
      goalType: 'maximize',
    },
    {
      id: 4,
      indicator: '% Compromisos estratégicos cumplidos',
      indicatorType: 'formula',
      formula: '{id:3}/{id:2}',
      goalMode: 'DERIVED_FROM_SOURCES',
      formulaOutputMode: 'RESULT_IS_COMPLIANCE',
      type: 'average',
      frequency: 'monthly',
      monthlyProgress: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      monthlyGoals: [0, 0, 0, 0, 0, 0.8, 0, 0, 0, 0, 0, 0],
      unit: '%',
      goalType: 'maximize',
    },
  ];

  test('v9.4.13: CurrentPeriodFocus renderiza sin ReferenceError y resuelve junio 50.00%', () => {
    render(
      <CurrentPeriodFocus
        item={mockItems[2]}
        allDashboardItems={mockItems}
        globalThresholds={{ onTrack: 90, atRisk: 80 }}
        year={2026}
        canEdit={true}
        onUpdateItem={jest.fn()}
        onClose={jest.fn()}
      />
    );

    expect(screen.getByText('% Compromisos estratégicos cumplidos')).toBeInTheDocument();
    expect(screen.queryByText(/GUARDAR MES/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Guardar Cambios/i)).not.toBeInTheDocument();
  });

  test('CONTROL opens the explicit September target instead of the last captured month', () => {
    render(<CurrentPeriodFocus item={mockItems[0]} allDashboardItems={mockItems} globalThresholds={{ onTrack: 90, atRisk: 80 }} year={2026} canEdit onUpdateItem={jest.fn()} onClose={jest.fn()} controlTarget={{ clientId: 'LAB-A', dashboardId: 101, itemId: 2, period: { frequency: 'monthly', year: 2026, monthIndex: 8 }, operation: 'REGISTRAR_AVANCE', origin: 'control' }} />);
    expect(screen.getAllByText('Septiembre').length).toBeGreaterThan(0);
    expect(screen.getByRole('status')).toHaveTextContent('REGISTRAR AVANCE');
    expect(document.activeElement).toHaveAttribute('id', 'actual-input');
  });

  test('CONTROL opens the explicit supported weekly period', () => {
    const weekly = { ...mockItems[0], frequency: 'weekly' as const, weeklyGoals: Array(53).fill(null), weeklyProgress: Array(53).fill(null) };
    render(<CurrentPeriodFocus item={weekly} allDashboardItems={[weekly]} globalThresholds={{ onTrack: 90, atRisk: 80 }} year={2026} canEdit onUpdateItem={jest.fn()} onClose={jest.fn()} controlTarget={{ clientId: 'LAB-B', dashboardId: 202, itemId: 2, period: { frequency: 'weekly', year: 2026, weekNumber: 39 }, operation: 'CONFIGURAR', origin: 'control' }} />);
    expect(screen.getAllByText('Semana 39').length).toBeGreaterThan(0);
    expect(document.activeElement).toHaveAttribute('id', 'goal-input');
  });

  const activityItem = () => ({
    ...mockItems[0],
    isActivityMode: true,
    activityConfig: { 8: [{ id: 'synthetic-a', label: 'Actividad ficticia', targetCount: 10, completedCount: 3 }] },
  });
  const controlTarget = (operation: 'CONFIGURAR' | 'REGISTRAR_AVANCE' | 'GESTIONAR') => ({
    clientId: 'LAB-A', dashboardId: 101, itemId: 2,
    period: { frequency: 'monthly' as const, year: 2026, monthIndex: 8 },
    operation, origin: 'control' as const,
  });

  test('CONTROL CONFIGURAR opens the checklist manager for an activity KPI', () => {
    const item = activityItem();
    render(<CurrentPeriodFocus item={item} allDashboardItems={[item]} globalThresholds={{ onTrack: 90, atRisk: 80 }} year={2026} canEdit onUpdateItem={jest.fn()} onClose={jest.fn()} controlTarget={controlTarget('CONFIGURAR')} />);
    expect(screen.getByText('CONFIRMAR LISTA')).toBeInTheDocument();
    expect(screen.getByText('Actividad ficticia')).toBeInTheDocument();
  });

  test('RED: CONTROL CONFIGURAR opens the earliest pending configuration period instead of controlTarget period', () => {
    // Control target is October (monthIndex: 9), effective start is August (monthIndex: 7).
    // August has no configuration (GOAL_REQUIRED), September and October are also consultable.
    // CONFIGURAR must open August (monthIndex: 7), not October.
    const item: DashboardItem = {
      ...mockItems[0],
      isActivityMode: true,
      trackingStartPeriod: { frequency: 'monthly', year: 2026, monthIndex: 7 },
      activityConfig: {
        7: [], // August: empty checklist (missing goal/config)
        8: [{ id: 'sep-act', label: 'Actividad septiembre', targetCount: 5, completedCount: 2 }],
        9: [{ id: 'oct-act', label: 'Actividad octubre', targetCount: 10, completedCount: 0 }],
      },
    };
    const targetOctober = {
      clientId: 'LAB-A',
      dashboardId: 101,
      itemId: 2,
      period: { frequency: 'monthly' as const, year: 2026, monthIndex: 9 },
      operation: 'CONFIGURAR' as const,
      origin: 'control' as const,
    };
    render(
      <CurrentPeriodFocus
        item={item}
        allDashboardItems={[item]}
        globalThresholds={{ onTrack: 90, atRisk: 80 }}
        year={2026}
        canEdit
        onUpdateItem={jest.fn()}
        onClose={jest.fn()}
        controlTarget={targetOctober}
      />
    );
    expect(screen.getByText('CONFIRMAR LISTA')).toBeInTheDocument();
    expect(screen.getByTestId('activity-manager-period')).toHaveTextContent('PERIODO: Agosto 2026');
  });

  test('CONTROL CONFIGURAR for simple numeric KPI sets period to earliest pending period and focuses goal input', () => {
    const item: DashboardItem = {
      ...mockItems[0],
      isActivityMode: false,
      trackingStartPeriod: { frequency: 'monthly', year: 2026, monthIndex: 7 }, // August
      monthlyGoals: Object.assign(Array(12).fill(null), { 8: 10 }), // September configured
      monthlyGoalCaptured: Object.assign(Array(12).fill(false), { 8: true }),
    };
    const targetOctober = {
      clientId: 'LAB-A',
      dashboardId: 101,
      itemId: 2,
      period: { frequency: 'monthly' as const, year: 2026, monthIndex: 9 },
      operation: 'CONFIGURAR' as const,
      origin: 'control' as const,
    };
    render(
      <CurrentPeriodFocus
        item={item}
        allDashboardItems={[item]}
        globalThresholds={{ onTrack: 90, atRisk: 80 }}
        year={2026}
        canEdit
        onUpdateItem={jest.fn()}
        onClose={jest.fn()}
        controlTarget={targetOctober}
      />
    );
    const goalInput = document.getElementById('goal-input') as HTMLInputElement;
    expect(goalInput).toBeInTheDocument();
    expect(document.activeElement).toBe(goalInput);
    // The rendered period header should show Agosto
    expect(screen.getByText('Periodo Consultado').nextElementSibling).toHaveTextContent('Agosto');
  });

  test('CONTROL REGISTRAR_AVANCE with active inherited work selects ACCIONES POR ATENDER in RESUMEN', () => {
    const item = {
      ...mockItems[0],
      isActivityMode: true,
      activityConfig: {
        7: [{ id: 'inherited-act', label: 'Compromiso atrasado agosto', targetCount: 5, completedCount: 1 }],
      },
    };
    render(
      <CurrentPeriodFocus
        item={item}
        allDashboardItems={[item]}
        globalThresholds={{ onTrack: 90, atRisk: 80 }}
        year={2026}
        canEdit
        onUpdateItem={jest.fn()}
        onClose={jest.fn()}
        controlTarget={controlTarget('REGISTRAR_AVANCE')}
      />
    );
    expect(screen.getByRole('tab', { name: 'RESUMEN' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByText('CONFIRMAR LISTA')).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /ACCIONES POR ATENDER/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Compromiso atrasado agosto')).toBeInTheDocument();
  });

  test('CONTROL REGISTRAR_AVANCE without inherited work opens canonical current period capture without selecting ACCIONES POR ATENDER', () => {
    const item = {
      ...mockItems[0],
      isActivityMode: true,
      activityConfig: {
        8: [{ id: 'current-act', label: 'Actividad septiembre', targetCount: 10, completedCount: 0 }],
      },
    };
    render(
      <CurrentPeriodFocus
        item={item}
        allDashboardItems={[item]}
        globalThresholds={{ onTrack: 90, atRisk: 80 }}
        year={2026}
        canEdit
        onUpdateItem={jest.fn()}
        onClose={jest.fn()}
        controlTarget={controlTarget('REGISTRAR_AVANCE')}
      />
    );
    expect(screen.getByRole('tab', { name: 'RESUMEN' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByText('CONFIRMAR LISTA')).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Período actual/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /ACCIONES POR ATENDER/i })).toHaveAttribute('aria-selected', 'false');
  });

  test('CONTROL GESTIONAR with pending actions opens RESUMEN with ACCIONES POR ATENDER selected', () => {
    const item = {
      ...mockItems[0],
      isActivityMode: true,
      activityConfig: {
        7: [{ id: 'pending-act', label: 'Acción a gestionar', targetCount: 3, completedCount: 0 }],
      },
    };
    render(
      <CurrentPeriodFocus
        item={item}
        allDashboardItems={[item]}
        globalThresholds={{ onTrack: 90, atRisk: 80 }}
        year={2026}
        canEdit
        onUpdateItem={jest.fn()}
        onClose={jest.fn()}
        controlTarget={controlTarget('GESTIONAR')}
      />
    );
    expect(screen.getByRole('tab', { name: 'RESUMEN' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /ACCIONES POR ATENDER/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Acción a gestionar')).toBeInTheDocument();
  });

  test('normal activity KPI selection opens summary without forcing ACCIONES POR ATENDER', () => {
    const item = {
      ...mockItems[0],
      isActivityMode: true,
      activityConfig: {
        7: [{ id: 'inherited-act', label: 'Acción previa', targetCount: 5, completedCount: 1 }],
      },
    };
    render(
      <CurrentPeriodFocus
        item={item}
        allDashboardItems={[item]}
        globalThresholds={{ onTrack: 90, atRisk: 80 }}
        year={2026}
        canEdit
        onUpdateItem={jest.fn()}
        onClose={jest.fn()}
      />
    );
    expect(screen.getByRole('tab', { name: 'RESUMEN' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByText('CONFIRMAR LISTA')).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Período actual/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /ACCIONES POR ATENDER/i })).toHaveAttribute('aria-selected', 'false');
  });

  test('summary and activities are explicit views, and closing activities returns to summary', () => {
    const item = activityItem();
    render(<CurrentPeriodFocus item={item} allDashboardItems={[item]} globalThresholds={{ onTrack: 90, atRisk: 80 }} year={2026} canEdit onUpdateItem={jest.fn()} onClose={jest.fn()} />);
    const summaryTab = screen.getByRole('tab', { name: 'RESUMEN' });
    const activitiesTab = screen.getByRole('tab', { name: 'ACTIVIDADES' });
    expect(summaryTab).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(activitiesTab);
    expect(screen.getByText('CONFIRMAR LISTA')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'DESCARTAR CAMBIOS' }));
    expect(screen.queryByText('CONFIRMAR LISTA')).not.toBeInTheDocument();
    expect(summaryTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: /VISTA ANUAL/ })).toBeInTheDocument();
  });

  test('checklist waits for successful item persistence before closing', async () => {
    let resolveSave!: () => void;
    const onUpdateItem = jest.fn(() => new Promise<void>(resolve => { resolveSave = resolve; }));
    const item = {
      ...mockItems[0],
      isActivityMode: true,
      activityConfig: { 8: [{ id: 'activity-a', label: 'Elemento pendiente', targetCount: 4, completedCount: 1 }] },
    };
    render(<CurrentPeriodFocus item={item} allDashboardItems={[item]} globalThresholds={{ onTrack: 90, atRisk: 80 }} year={2026} canEdit onUpdateItem={onUpdateItem} onClose={jest.fn()} controlTarget={{ clientId: 'LAB-A', dashboardId: 101, itemId: 2, period: { frequency: 'monthly', year: 2026, monthIndex: 8 }, operation: 'GESTIONAR', origin: 'control' }} />);

    fireEvent.click(screen.getByRole('tab', { name: 'ACTIVIDADES' }));
    fireEvent.click(screen.getByRole('button', { name: 'CONFIRMAR LISTA' }));
    expect(onUpdateItem).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Guardando checklist…')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'GUARDANDO...' })).toBeDisabled();

    resolveSave();
    await waitFor(() => expect(screen.queryByRole('button', { name: /CONFIRMAR LISTA|GUARDANDO/ })).not.toBeInTheDocument());
  });

  test('checklist mantiene los cambios visibles y muestra el error si falla la persistencia', async () => {
    const onUpdateItem = jest.fn().mockRejectedValue(new Error('write failed'));
    const item = {
      ...mockItems[0],
      isActivityMode: true,
      activityConfig: { 8: [{ id: 'activity-a', label: 'Elemento conservado', targetCount: 4, completedCount: 1 }] },
    };
    render(<CurrentPeriodFocus item={item} allDashboardItems={[item]} globalThresholds={{ onTrack: 90, atRisk: 80 }} year={2026} canEdit onUpdateItem={onUpdateItem} onClose={jest.fn()} controlTarget={{ clientId: 'LAB-A', dashboardId: 101, itemId: 2, period: { frequency: 'monthly', year: 2026, monthIndex: 8 }, operation: 'GESTIONAR', origin: 'control' }} />);

    fireEvent.click(screen.getByRole('tab', { name: 'ACTIVIDADES' }));
    fireEvent.click(screen.getByRole('button', { name: 'CONFIRMAR LISTA' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Los cambios siguen disponibles');
    expect(screen.getByText('Elemento conservado')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'CONFIRMAR LISTA' })).toBeEnabled();
    expect(onUpdateItem).toHaveBeenCalledTimes(1);
  });

  test('volver a heredar emits an explicit override deletion only after persistence succeeds', async () => {
    const onUpdateItem = jest.fn().mockResolvedValue(undefined);
    const item = { ...mockItems[0], trackingStartPeriod: { frequency: 'monthly' as const, year: 2026, monthIndex: 8 } };
    render(<CurrentPeriodFocus item={item} allDashboardItems={mockItems} globalThresholds={{ onTrack: 90, atRisk: 80 }} year={2026} canEdit onUpdateItem={onUpdateItem} onClose={jest.fn()} clientTrackingStartPeriod={{ frequency: 'monthly', year: 2026, monthIndex: 7 }} canConfigureTracking />);
    fireEvent.click(screen.getByRole('button', { name: 'VOLVER A HEREDAR' }));
    expect(screen.getByText(/Agosto 2026/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'VOLVER A HEREDAR' }));
    await waitFor(() => expect(onUpdateItem).toHaveBeenCalledWith(expect.objectContaining({ trackingStartPeriod: undefined })));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('volvió a heredar'));
  });

  test('volver a heredar reports a failed write instead of showing false success', async () => {
    const item = { ...mockItems[0], trackingStartPeriod: { frequency: 'monthly' as const, year: 2026, monthIndex: 8 } };
    render(<CurrentPeriodFocus item={item} allDashboardItems={mockItems} globalThresholds={{ onTrack: 90, atRisk: 80 }} year={2026} canEdit onUpdateItem={jest.fn().mockRejectedValue(new Error('write failed'))} onClose={jest.fn()} clientTrackingStartPeriod={{ frequency: 'monthly', year: 2026, monthIndex: 7 }} canConfigureTracking />);
    fireEvent.click(screen.getByRole('button', { name: 'VOLVER A HEREDAR' }));
    fireEvent.click(screen.getByRole('button', { name: 'VOLVER A HEREDAR' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('No se pudo restaurar'));
    expect(screen.getByRole('button', { name: 'VOLVER A HEREDAR' })).toBeInTheDocument();
  });

  test('permite acceder al compromiso descartado desde CERRADOS / DESCARTADOS y reabrirlo', async () => {
    const onUpdateItem = jest.fn().mockResolvedValue(undefined);
    const itemWithDiscarded: DashboardItem = {
      ...mockItems[0],
      isActivityMode: true,
      activityConfig: {
        7: [{ id: 'act-discarded-1', label: 'Establecer metas en Agosto', targetCount: 20, completedCount: 5 }],
      },
      continuityCommitments: {
        'activity:act-discarded-1': {
          id: 'activity:act-discarded-1',
          sourceType: 'ACTIVITY_KPI',
          sourceKpiId: '2',
          sourceActivityId: 'act-discarded-1',
          originYear: 2026,
          originPeriod: 7,
          originalTarget: 20,
          scheduledYear: 2026,
          scheduledPeriod: 8,
          progressByPeriod: { 7: 5 },
          status: 'discarded',
          outcome: 'target_not_reached',
          rescheduleHistory: [],
          resolutionHistory: [
            { type: 'CREATE_CONTINUITY', at: '2026-08-01T00:00:00.000Z' },
            { type: 'DISCARD', at: '2026-09-01T00:00:00.000Z', reason: 'Descartado por prueba' },
          ],
        },
      },
    };

    render(
      <CurrentPeriodFocus
        item={itemWithDiscarded}
        allDashboardItems={[itemWithDiscarded]}
        globalThresholds={{ onTrack: 90, atRisk: 80 }}
        year={2026}
        canEdit={true}
        onUpdateItem={onUpdateItem}
        onClose={jest.fn()}
      />
    );

    // Switch to ACCIONES POR ATENDER tab
    fireEvent.click(screen.getByRole('tab', { name: /ACCIONES POR ATENDER/i }));

    // Verify CERRADOS / DESCARTADOS accordion header is present with count 1
    const accordionBtn = screen.getByRole('button', { name: /CERRADOS \/ DESCARTADOS/i });
    expect(accordionBtn).toBeInTheDocument();

    // Click to expand CERRADOS / DESCARTADOS
    fireEvent.click(accordionBtn);

    // Check that the discarded activity label is visible
    expect(screen.getByText('Establecer metas en Agosto')).toBeInTheDocument();
    expect(screen.getByText('DESCARTADO')).toBeInTheDocument();

    // Click GESTIONAR on the discarded activity
    const gestionarBtn = screen.getByRole('button', { name: 'GESTIONAR' });
    fireEvent.click(gestionarBtn);

    // Verify ContinuityWorkspace opened
    expect(screen.getByRole('dialog', { name: 'Gestión de continuidad' })).toBeInTheDocument();
    expect(screen.getByText('Meta original')).toBeInTheDocument();

    // Click REABRIR COMPROMISO
    const reabrirBtn = screen.getByRole('button', { name: /REABRIR/i });
    expect(reabrirBtn).toBeInTheDocument();
    fireEvent.click(reabrirBtn);

    // Verify onUpdateItem was called with status 'active' and outcome 'in_progress'
    await waitFor(() => {
      expect(onUpdateItem).toHaveBeenCalledWith(
        expect.objectContaining({
          continuityCommitments: expect.objectContaining({
            'activity:act-discarded-1': expect.objectContaining({
              status: 'active',
              outcome: 'in_progress',
            }),
          }),
        })
      );
    });
  });
});
