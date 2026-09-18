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
    fireEvent.click(screen.getByRole('button', { name: /ACCIONES POR ATENDER/i }));

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
