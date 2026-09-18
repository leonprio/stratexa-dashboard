import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { ContinuityPanel } from './ContinuityPanel';

const baseItem: any = {
  id: 7, indicator: 'KPI', unit: 'u', weight: 1, type: 'accumulative', goalType: 'maximize',
  monthlyGoals: [], monthlyProgress: [],
  activityConfig: { 7: [{ id: 'activity-1', label: 'Meta de agosto', targetCount: 10, completedCount: 0 }] },
};
const pending = { id: 'pending-1', sourceActivityId: 'activity-1', label: 'Meta de agosto', periodIndex: 7, periodLabel: 'Agosto' };

test('materializes a legacy fallback through the canonical reschedule path', async () => {
  const onUpdateItem = jest.fn().mockResolvedValue(undefined);
  render(<ContinuityPanel item={baseItem} pending={pending} year={2026} isWeekly={false} onUpdateItem={onUpdateItem} onDismiss={jest.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: /REPROGRAMAR/ }));
  fireEvent.click(screen.getByRole('button', { name: /CONFIRMAR REPROGRAMACIÓN/ }));
  await waitFor(() => expect(onUpdateItem).toHaveBeenCalledWith(expect.objectContaining({ continuityCommitments: expect.any(Object) })));
  expect(onUpdateItem.mock.calls[0][0].activityConfig).toEqual(baseItem.activityConfig);
});

test('keeps the panel mounted after a successful continuity action', async () => {
  const onUpdateItem = jest.fn().mockResolvedValue(undefined);
  const onDismiss = jest.fn();
  render(<ContinuityPanel item={baseItem} pending={pending} year={2026} isWeekly={false} onUpdateItem={onUpdateItem} onDismiss={onDismiss} />);
  fireEvent.click(screen.getByRole('button', { name: /REPROGRAMAR/ }));
  fireEvent.click(screen.getByRole('button', { name: /CONFIRMAR REPROGRAMACIÓN/ }));
  await waitFor(() => expect(onUpdateItem).toHaveBeenCalled());
  expect(onDismiss).not.toHaveBeenCalled();
  expect(screen.getByRole('region', { name: 'Panel de continuidad' })).toBeInTheDocument();
});

test('submits the first future period shown by the reschedule selector', async () => {
  const onUpdateItem = jest.fn().mockResolvedValue(undefined);
  const septemberItem: any = {
    ...baseItem,
    monthlyGoals: [0, 0, 0, 0, 0, 0, 0, 20],
    monthlyProgress: [0, 0, 0, 0, 0, 0, 0, 5, 7],
    continuityCommitments: {
      'activity:activity-1': {
        id: 'activity:activity-1', sourceType: 'ACTIVITY_KPI', sourceKpiId: '7', sourceActivityId: 'activity-1',
        originYear: 2026, originPeriod: 7, originalTarget: 20, scheduledYear: 2026, scheduledPeriod: 8,
        progressByPeriod: { 7: 5, 8: 7 }, status: 'active', outcome: 'in_progress',
        rescheduleHistory: [], resolutionHistory: [],
      },
    },
  };
  render(<ContinuityPanel item={septemberItem} pending={pending} year={2026} isWeekly={false} onUpdateItem={onUpdateItem} onDismiss={jest.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'REPROGRAMAR' }));
  expect(screen.getByRole('combobox', { name: 'Periodo destino' })).toHaveValue('9');
  fireEvent.click(screen.getByRole('button', { name: 'CONFIRMAR REPROGRAMACIÓN' }));
  await waitFor(() => expect(onUpdateItem).toHaveBeenCalled());
  expect(onUpdateItem.mock.calls[0][0].continuityCommitments['activity:activity-1']).toMatchObject({
    scheduledPeriod: 9,
    progressByPeriod: { 7: 5, 8: 7 },
  });
});

test('labels commitment metrics with their independent scope', () => {
  render(<ContinuityPanel item={{ ...baseItem, continuityCommitments: { 'activity:activity-1': { id: 'activity:activity-1', sourceType: 'ACTIVITY_KPI', sourceKpiId: '7', sourceActivityId: 'activity-1', originYear: 2026, originPeriod: 7, originalTarget: 10, scheduledYear: 2026, scheduledPeriod: 8, progressByPeriod: {}, status: 'active', outcome: 'in_progress', rescheduleHistory: [], resolutionHistory: [] } } }} pending={pending} year={2026} isWeekly={false} onUpdateItem={jest.fn()} onDismiss={jest.fn()} />);
  expect(screen.getByText('AVANCE DEL COMPROMISO')).toBeInTheDocument();
  expect(screen.getByText('FALTA PARA COMPLETAR')).toBeInTheDocument();
  expect(screen.getByText(/COMPROMISO DE CONTINUIDAD/)).toBeInTheDocument();
});

test('reopens a terminal canonical commitment from the shared panel', async () => {
  const onUpdateItem = jest.fn().mockResolvedValue(undefined);
  const item = { ...baseItem, continuityCommitments: { 'activity:activity-1': { id: 'activity:activity-1', sourceType: 'ACTIVITY_KPI', sourceKpiId: '7', sourceActivityId: 'activity-1', originYear: 2026, originPeriod: 7, originalTarget: 10, scheduledYear: 2026, scheduledPeriod: 7, progressByPeriod: {}, status: 'closed', outcome: 'target_not_reached', rescheduleHistory: [], resolutionHistory: [{ type: 'CLOSE_UNMET', at: '2026-09-01T00:00:00.000Z' }] } } };
  render(<ContinuityPanel item={item} pending={pending} year={2026} isWeekly={false} onUpdateItem={onUpdateItem} onDismiss={jest.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'REABRIR' }));
  await waitFor(() => expect(onUpdateItem).toHaveBeenCalledWith(expect.objectContaining({ continuityCommitments: expect.any(Object) })));
  expect(onUpdateItem.mock.calls[0][0].continuityCommitments['activity:activity-1']).toMatchObject({ status: 'active' });
});

test('requires discard confirmation and offers immediate REOPEN undo', async () => {
  const onUpdateItem = jest.fn().mockResolvedValue(undefined);
  const item = { ...baseItem, continuityCommitments: { 'activity:activity-1': { id: 'activity:activity-1', sourceType: 'ACTIVITY_KPI', sourceKpiId: '7', sourceActivityId: 'activity-1', originYear: 2026, originPeriod: 7, originalTarget: 10, scheduledYear: 2026, scheduledPeriod: 7, progressByPeriod: { 7: 5 }, status: 'active', outcome: 'in_progress', rescheduleHistory: [], resolutionHistory: [{ type: 'RECORD_PROGRESS', period: 7, value: 5, at: '2026-08-01T00:00:00.000Z' }] } } };
  render(<ContinuityPanel item={item} pending={pending} year={2026} isWeekly={false} onUpdateItem={onUpdateItem} onDismiss={jest.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'DESCARTAR COMPROMISO' }));
  expect(screen.getByText(/dejará de estar activo/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'CANCELAR' }));
  expect(onUpdateItem).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'DESCARTAR COMPROMISO' }));
  fireEvent.click(screen.getByRole('button', { name: 'CONFIRMAR DESCARTE' }));
  await waitFor(() => expect(onUpdateItem).toHaveBeenCalledWith(expect.objectContaining({ continuityCommitments: expect.any(Object) })));
  expect(onUpdateItem.mock.calls[0][0].continuityCommitments['activity:activity-1']).toMatchObject({ status: 'discarded', progressByPeriod: { 7: 5 } });
  expect(screen.getByRole('status')).toHaveTextContent('Compromiso descartado');
  fireEvent.click(screen.getByRole('button', { name: 'DESHACER' }));
  await waitFor(() => expect(onUpdateItem).toHaveBeenCalledTimes(2));
  expect(onUpdateItem.mock.calls[1][0].continuityCommitments['activity:activity-1']).toMatchObject({ status: 'active', progressByPeriod: { 7: 5 } });
});

test('requires confirmation before CLOSE_UNMET and preserves active state on cancel', async () => {
  const onUpdateItem = jest.fn().mockResolvedValue(undefined);
  const item = { ...baseItem, continuityCommitments: { 'activity:activity-1': { id: 'activity:activity-1', sourceType: 'ACTIVITY_KPI', sourceKpiId: '7', sourceActivityId: 'activity-1', originYear: 2026, originPeriod: 7, originalTarget: 10, scheduledYear: 2026, scheduledPeriod: 7, progressByPeriod: { 7: 4 }, status: 'active', outcome: 'in_progress', rescheduleHistory: [], resolutionHistory: [{ type: 'RECORD_PROGRESS', period: 7, value: 4, at: '2026-08-01T00:00:00.000Z' }] } } };
  render(<ContinuityPanel item={item} pending={pending} year={2026} isWeekly={false} onUpdateItem={onUpdateItem} onDismiss={jest.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'CERRAR SIN ALCANZAR LA META' }));
  expect(screen.getByRole('button', { name: 'CONFIRMAR CIERRE' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'CANCELAR' })).toBeInTheDocument();
  expect(onUpdateItem).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'CANCELAR' }));
  expect(screen.queryByRole('button', { name: 'CONFIRMAR CIERRE' })).not.toBeInTheDocument();
  expect(onUpdateItem).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'CERRAR SIN ALCANZAR LA META' }));
  fireEvent.click(screen.getByRole('button', { name: 'CONFIRMAR CIERRE' }));
  await waitFor(() => expect(onUpdateItem).toHaveBeenCalledTimes(1));
  expect(onUpdateItem.mock.calls[0][0].continuityCommitments['activity:activity-1']).toMatchObject({ status: 'closed', progressByPeriod: { 7: 4 } });
});

test('undoes only the latest canonical reschedule step', async () => {
  const onUpdateItem = jest.fn().mockResolvedValue(undefined);
  const item = { ...baseItem, continuityCommitments: { 'activity:activity-1': { id: 'activity:activity-1', sourceType: 'ACTIVITY_KPI', sourceKpiId: '7', sourceActivityId: 'activity-1', originYear: 2026, originPeriod: 7, originalTarget: 10, scheduledYear: 2026, scheduledPeriod: 9, progressByPeriod: {}, status: 'active', outcome: 'in_progress', rescheduleHistory: [{ id: 'first', fromYear: 2026, fromPeriod: 7, toYear: 2026, toPeriod: 8, at: '2026-08-01T00:00:00.000Z', status: 'active' }, { id: 'second', fromYear: 2026, fromPeriod: 8, toYear: 2026, toPeriod: 9, at: '2026-09-01T00:00:00.000Z', status: 'active' }], resolutionHistory: [] } } };
  render(<ContinuityPanel item={item} pending={pending} year={2026} isWeekly={false} onUpdateItem={onUpdateItem} onDismiss={jest.fn()} />);
  fireEvent.click(screen.getAllByRole('button', { name: 'DESHACER REPROGRAMACIÓN' })[0]);
  fireEvent.click(screen.getAllByRole('button', { name: 'DESHACER REPROGRAMACIÓN' })[1]);
  await waitFor(() => expect(onUpdateItem).toHaveBeenCalled());
  expect(onUpdateItem.mock.calls[0][0].continuityCommitments['activity:activity-1']).toMatchObject({ scheduledPeriod: 8 });
});

describe('ANULAR AVANCE & RESTAURAR AVANCE (Phase 11 Certification)', () => {
  const itemWithSeptProgress = (progress = 7): any => ({
    ...baseItem,
    continuityCommitments: {
      'activity:activity-1': {
        id: 'activity:activity-1',
        sourceType: 'ACTIVITY_KPI',
        sourceKpiId: '7',
        sourceActivityId: 'activity-1',
        originYear: 2026,
        originPeriod: 7,
        originalTarget: 10,
        scheduledYear: 2026,
        scheduledPeriod: 8, // Septiembre
        progressByPeriod: { 7: 5, 8: progress },
        status: 'active',
        outcome: 'in_progress',
        rescheduleHistory: [{ id: 'r1', fromYear: 2026, fromPeriod: 7, toYear: 2026, toPeriod: 8, at: '2026-08-01T00:00:00.000Z', status: 'active' }],
        resolutionHistory: [
          { type: 'RECORD_PROGRESS', period: 8, value: 7, at: '2026-09-01T00:00:00.000Z' },
          ...(progress !== 7 ? [{ type: 'ADJUST_PERIOD_PROGRESS', period: 8, fromValue: 7, toValue: progress, at: '2026-09-02T00:00:00.000Z' }] : []),
        ],
      },
    },
  });

  test('Caso A: periodo vigente Septiembre avance 7 -> VOID -> avance deja de contar', async () => {
    const onUpdateItem = jest.fn().mockResolvedValue(undefined);
    const item = itemWithSeptProgress(7);
    render(<ContinuityPanel item={item} pending={pending} year={2026} isWeekly={false} onUpdateItem={onUpdateItem} onDismiss={jest.fn()} />);

    // Click ANULAR AVANCE to show confirmation
    fireEvent.click(screen.getByRole('button', { name: 'ANULAR AVANCE' }));
    expect(screen.getByText(/Este avance dejará de contar en el acumulado/)).toBeInTheDocument();

    // Confirm VOID
    const confirmButtons = screen.getAllByRole('button', { name: 'ANULAR AVANCE' });
    fireEvent.click(confirmButtons[confirmButtons.length - 1]);

    await waitFor(() => expect(onUpdateItem).toHaveBeenCalled());
    const updated = onUpdateItem.mock.calls[0][0];
    const commitment = updated.continuityCommitments['activity:activity-1'];
    expect(commitment.progressByPeriod[8]).toBe(0);
  });

  test('Caso B: VOID conserva hecho histórico con previousValue', async () => {
    const onUpdateItem = jest.fn().mockResolvedValue(undefined);
    const item = itemWithSeptProgress(7);
    render(<ContinuityPanel item={item} pending={pending} year={2026} isWeekly={false} onUpdateItem={onUpdateItem} onDismiss={jest.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'ANULAR AVANCE' }));
    const confirmButtons = screen.getAllByRole('button', { name: 'ANULAR AVANCE' });
    fireEvent.click(confirmButtons[confirmButtons.length - 1]);

    await waitFor(() => expect(onUpdateItem).toHaveBeenCalled());
    const commitment = onUpdateItem.mock.calls[0][0].continuityCommitments['activity:activity-1'];
    const lastHistory = commitment.resolutionHistory.at(-1);
    expect(lastHistory).toMatchObject({
      type: 'VOID_PERIOD_PROGRESS',
      period: 8,
      previousValue: 7,
    });
  });

  test('Caso C: VOID afecta Septiembre (periodo 8), no Agosto (periodo 7)', async () => {
    const onUpdateItem = jest.fn().mockResolvedValue(undefined);
    const item = itemWithSeptProgress(7);
    render(<ContinuityPanel item={item} pending={pending} year={2026} isWeekly={false} onUpdateItem={onUpdateItem} onDismiss={jest.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'ANULAR AVANCE' }));
    const confirmButtons = screen.getAllByRole('button', { name: 'ANULAR AVANCE' });
    fireEvent.click(confirmButtons[confirmButtons.length - 1]);

    await waitFor(() => expect(onUpdateItem).toHaveBeenCalled());
    const commitment = onUpdateItem.mock.calls[0][0].continuityCommitments['activity:activity-1'];
    expect(commitment.progressByPeriod[7]).toBe(5); // Agosto intacto
    expect(commitment.progressByPeriod[8]).toBe(0); // Septiembre anulado
  });

  test('Caso D: RESTORE devuelve 7 tras anulación', async () => {
    const onUpdateItem = jest.fn().mockResolvedValue(undefined);
    const voidedItem: any = {
      ...baseItem,
      continuityCommitments: {
        'activity:activity-1': {
          id: 'activity:activity-1',
          sourceType: 'ACTIVITY_KPI',
          sourceKpiId: '7',
          sourceActivityId: 'activity-1',
          originYear: 2026,
          originPeriod: 7,
          originalTarget: 10,
          scheduledYear: 2026,
          scheduledPeriod: 8,
          progressByPeriod: { 7: 5, 8: 0 },
          status: 'active',
          outcome: 'in_progress',
          rescheduleHistory: [],
          resolutionHistory: [
            { type: 'RECORD_PROGRESS', period: 8, value: 7, at: '2026-09-01T00:00:00.000Z' },
            { type: 'VOID_PERIOD_PROGRESS', period: 8, previousValue: 7, at: '2026-09-02T00:00:00.000Z' },
          ],
        },
      },
    };

    render(<ContinuityPanel item={voidedItem} pending={pending} year={2026} isWeekly={false} onUpdateItem={onUpdateItem} onDismiss={jest.fn()} />);

    // Click RESTAURAR AVANCE
    fireEvent.click(screen.getByRole('button', { name: 'RESTAURAR AVANCE' }));
    expect(screen.getByText(/Avance anulado:/)).toBeInTheDocument();
    expect(screen.getAllByText(/7 unidades/).length).toBeGreaterThan(0);

    // Confirm RESTORE
    const confirmRestore = screen.getAllByRole('button', { name: 'RESTAURAR AVANCE' });
    fireEvent.click(confirmRestore[confirmRestore.length - 1]);

    await waitFor(() => expect(onUpdateItem).toHaveBeenCalled());
    const commitment = onUpdateItem.mock.calls[0][0].continuityCommitments['activity:activity-1'];
    expect(commitment.progressByPeriod[8]).toBe(7);
  });

  test('Caso E: historial conserva registro, anulación y restauración', async () => {
    const onUpdateItem = jest.fn().mockResolvedValue(undefined);
    const voidedItem: any = {
      ...baseItem,
      continuityCommitments: {
        'activity:activity-1': {
          id: 'activity:activity-1',
          sourceType: 'ACTIVITY_KPI',
          sourceKpiId: '7',
          sourceActivityId: 'activity-1',
          originYear: 2026,
          originPeriod: 7,
          originalTarget: 10,
          scheduledYear: 2026,
          scheduledPeriod: 8,
          progressByPeriod: { 7: 5, 8: 0 },
          status: 'active',
          outcome: 'in_progress',
          rescheduleHistory: [],
          resolutionHistory: [
            { type: 'RECORD_PROGRESS', period: 8, value: 7, at: '2026-09-01T00:00:00.000Z' },
            { type: 'VOID_PERIOD_PROGRESS', period: 8, previousValue: 7, at: '2026-09-02T00:00:00.000Z' },
          ],
        },
      },
    };

    render(<ContinuityPanel item={voidedItem} pending={pending} year={2026} isWeekly={false} onUpdateItem={onUpdateItem} onDismiss={jest.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'RESTAURAR AVANCE' }));
    const confirmRestore = screen.getAllByRole('button', { name: 'RESTAURAR AVANCE' });
    fireEvent.click(confirmRestore[confirmRestore.length - 1]);

    await waitFor(() => expect(onUpdateItem).toHaveBeenCalled());
    const history = onUpdateItem.mock.calls[0][0].continuityCommitments['activity:activity-1'].resolutionHistory;
    expect(history).toHaveLength(3);
    expect(history[0].type).toBe('RECORD_PROGRESS');
    expect(history[1].type).toBe('VOID_PERIOD_PROGRESS');
    expect(history[2].type).toBe('ADJUST_PERIOD_PROGRESS');
    expect(history[2].toValue).toBe(7);
  });

  test('Caso F: tras corrección 7 -> 5, VOID y RESTORE recupera 5, no 7', async () => {
    const onUpdateItem = jest.fn().mockResolvedValue(undefined);
    const voidedAfterAdjustItem: any = {
      ...baseItem,
      continuityCommitments: {
        'activity:activity-1': {
          id: 'activity:activity-1',
          sourceType: 'ACTIVITY_KPI',
          sourceKpiId: '7',
          sourceActivityId: 'activity-1',
          originYear: 2026,
          originPeriod: 7,
          originalTarget: 10,
          scheduledYear: 2026,
          scheduledPeriod: 8,
          progressByPeriod: { 7: 5, 8: 0 },
          status: 'active',
          outcome: 'in_progress',
          rescheduleHistory: [],
          resolutionHistory: [
            { type: 'RECORD_PROGRESS', period: 8, value: 7, at: '2026-09-01T00:00:00.000Z' },
            { type: 'ADJUST_PERIOD_PROGRESS', period: 8, fromValue: 7, toValue: 5, at: '2026-09-02T00:00:00.000Z' },
            { type: 'VOID_PERIOD_PROGRESS', period: 8, previousValue: 5, at: '2026-09-03T00:00:00.000Z' },
          ],
        },
      },
    };

    render(<ContinuityPanel item={voidedAfterAdjustItem} pending={pending} year={2026} isWeekly={false} onUpdateItem={onUpdateItem} onDismiss={jest.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'RESTAURAR AVANCE' }));
    expect(screen.getAllByText(/5 unidades/).length).toBeGreaterThan(0);

    const confirmRestore = screen.getAllByRole('button', { name: 'RESTAURAR AVANCE' });
    fireEvent.click(confirmRestore[confirmRestore.length - 1]);

    await waitFor(() => expect(onUpdateItem).toHaveBeenCalled());
    const commitment = onUpdateItem.mock.calls[0][0].continuityCommitments['activity:activity-1'];
    expect(commitment.progressByPeriod[8]).toBe(5);
  });

  test('Caso G: write failure mantiene panel y muestra mensaje de error sin falso éxito', async () => {
    const onUpdateItem = jest.fn().mockRejectedValue(new Error('Firebase network error'));
    const item = itemWithSeptProgress(7);
    render(<ContinuityPanel item={item} pending={pending} year={2026} isWeekly={false} onUpdateItem={onUpdateItem} onDismiss={jest.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'ANULAR AVANCE' }));
    const confirmButtons = screen.getAllByRole('button', { name: 'ANULAR AVANCE' });
    fireEvent.click(confirmButtons[confirmButtons.length - 1]);

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByText('No se pudo guardar el cambio de continuidad.')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Panel de continuidad' })).toBeInTheDocument();
  });
});
