import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { DataEditor } from './DataEditor';
import { DashboardItem } from '../types';

const mockItem: DashboardItem = {
  id: 'test-dash',
  name: 'Tablero Test',
  frequency: 'weekly',
  monthlyGoals: Array(12).fill(0),
  monthlyProgress: Array(12).fill(0),
  weeklyGoals: Array(53).fill(0),
  weeklyProgress: Array(53).fill(0),
  monthlyNotes: Array(12).fill(''),
  weeklyNotes: Array(53).fill(''),
  isActivityMode: false,
  year: 2026
} as any;

const mockOnSave = jest.fn();
const mockOnCancel = jest.fn();

describe('DataEditor Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock date to 2026-03-22
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-22T10:00:00Z'));
    // Mock scrollIntoView
    window.HTMLElement.prototype.scrollIntoView = jest.fn();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('debe renderizar el editor semanal', () => {
    render(
      <DataEditor 
        item={mockItem} 
        onSave={mockOnSave} 
        onCancel={mockOnCancel} 
        canEdit={true} 
        year={2026}
      />
    );

    expect(screen.getByText(/Capturar Datos y Notas/i)).toBeInTheDocument();
    expect(screen.getByText(/Año 2026/i)).toBeInTheDocument();
  });

  test('debe ejecutar el scroll automático con delay', async () => {
    // Mocking getWeekNumber to return a specific week
    const { getWeekNumber } = require('../utils/weeklyUtils');
    jest.mock('../utils/weeklyUtils', () => ({
      ...jest.requireActual('../utils/weeklyUtils'),
      getWeekNumber: () => 10
    }));

    render(
      <DataEditor 
        item={mockItem} 
        onSave={mockOnSave} 
        onCancel={mockOnCancel} 
        canEdit={true} 
        year={2026}
      />
    );

    // Wait for the delay defined in DataEditor (600ms)
    await waitFor(() => {
      expect(screen.getByText(/SEM 11/i)).toBeInTheDocument();
    }, { timeout: 2000 });
  });

  test('debe llamar a onSave con la estructura nuclear de datos', async () => {
    const { fireEvent } = require('@testing-library/react');
    render(
      <DataEditor 
        item={mockItem} 
        onSave={mockOnSave} 
        onCancel={mockOnCancel} 
        canEdit={true} 
      />
    );

    const saveBtn = screen.getByText(/GUARDAR CAMBIOS/i);
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalled();
    }, { timeout: 2000 });
  });

  test('el checklist de DataEditor espera el autoguardado antes de cerrar', async () => {
    let resolveSave!: () => void;
    mockOnSave.mockReturnValueOnce(new Promise<void>(resolve => { resolveSave = resolve; }));
    const activityConfig = Object.fromEntries(Array.from({ length: 53 }, (_, index) => [index, [
      { id: `activity-${index}`, label: `Actividad ${index + 1}`, targetCount: 2, completedCount: 1 },
    ]]));
    const item = { ...mockItem, isActivityMode: true, activityConfig } as DashboardItem;
    render(<DataEditor item={item} onSave={mockOnSave} onCancel={mockOnCancel} canEdit year={2026} />);

    fireEvent.click(screen.getByRole('button', { name: 'Configurar actividades para la semana 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'CONFIRMAR LISTA' }));

    expect(mockOnSave).toHaveBeenCalledTimes(1);
    expect(mockOnSave).toHaveBeenCalledWith(expect.objectContaining({ activityConfig }), true);
    expect(screen.getByRole('status')).toHaveTextContent('Guardando checklist');
    expect(screen.getByRole('button', { name: 'GUARDANDO...' })).toBeDisabled();

    await act(async () => { resolveSave(); });
    await waitFor(() => expect(screen.queryByRole('button', { name: /CONFIRMAR LISTA|GUARDANDO/ })).not.toBeInTheDocument());
  });

  test('el checklist de DataEditor conserva abierto el formulario ante un rechazo', async () => {
    mockOnSave.mockRejectedValueOnce(new Error('offline'));
    const activityConfig = Object.fromEntries(Array.from({ length: 53 }, (_, index) => [index, [
      { id: `activity-${index}`, label: `Actividad ${index + 1}`, targetCount: 2, completedCount: 1 },
    ]]));
    const item = { ...mockItem, isActivityMode: true, activityConfig } as DashboardItem;
    render(<DataEditor item={item} onSave={mockOnSave} onCancel={mockOnCancel} canEdit year={2026} />);

    fireEvent.click(screen.getByRole('button', { name: 'Configurar actividades para la semana 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'CONFIRMAR LISTA' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Los cambios siguen disponibles');
    expect(screen.getByText('Actividad 1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'CONFIRMAR LISTA' })).toBeEnabled();
  });

  test('H08 copia la estructura a todos los destinos conservando íntegro e inmutable el origen', async () => {
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => undefined);
    const source = [
      { id: 'a', label: 'Actividad A', targetCount: 4, completedCount: 1 },
      { id: 'b', label: 'Actividad B', targetCount: 3, completedCount: 2, resolution: { resolutionStatus: 'reopened' as const, resolutionHistory: [{ event: 'reopened' as const, at: '2026-01-01T00:00:00Z', year: 2026, periodIndex: 0 }] } },
    ];
    const sourceSnapshot = JSON.parse(JSON.stringify(source));
    const destinationResolution = { resolutionStatus: 'discarded' as const, resolutionNote: 'estado local del destino' };
    const originalConfig = { 0: source, 5: [{ id: 'b', label: 'Etiqueta previa', targetCount: 1, completedCount: 1, resolution: destinationResolution }] };
    const item = { ...mockItem, isActivityMode: true, activityConfig: originalConfig } as DashboardItem;
    render(<DataEditor item={item} onSave={mockOnSave} onCancel={mockOnCancel} canEdit year={2026} />);

    fireEvent.click(screen.getByRole('button', { name: 'Configurar actividades para la semana 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'COPIAR A TODO EL AÑO' }));

    const saved = mockOnSave.mock.calls.at(-1)?.[0] as Partial<DashboardItem>;
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Estructura copiada exitosamente.'));
    expect(saved.activityConfig?.[0]).toEqual(source);
    expect(saved.activityConfig?.[0]).toBe(source);
    expect(saved.activityConfig?.[1]).toEqual([{ id: 'a', label: 'Actividad A', targetCount: 4, completedCount: 0 }, { id: 'b', label: 'Actividad B', targetCount: 3, completedCount: 0 }]);
    expect(saved.activityConfig?.[5]).toEqual([{ id: 'a', label: 'Actividad A', targetCount: 4, completedCount: 0 }, { id: 'b', label: 'Actividad B', targetCount: 3, completedCount: 0, resolution: destinationResolution }]);
    for (let index = 1; index < 53; index++) {
      if (index === 5) continue;
      expect(saved.activityConfig?.[index]).toEqual(saved.activityConfig?.[1]);
    }
    expect(saved.activityConfig?.[0]).toBe(originalConfig[0]);
    expect(originalConfig[0]).toBe(source);
    expect(source).toEqual(sourceSnapshot);
    expect((saved.activityConfig?.[1] as any[])[1].resolution).toBeUndefined();
    expect(mockOnSave).toHaveBeenCalledTimes(1);
    expect(Object.keys(mockOnSave.mock.calls[0][0])).toEqual(['activityConfig', 'continuityCommitments', 'isActivityMode']);
  });

  test('H08 no anuncia éxito mientras la persistencia está pendiente y bloquea envíos duplicados', async () => {
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => undefined);
    let resolveSave!: () => void;
    mockOnSave.mockReturnValueOnce(new Promise<void>(resolve => { resolveSave = resolve; }));
    const source = [{ id: 'a', label: 'Actividad A', targetCount: 4, completedCount: 1 }];
    render(<DataEditor item={{ ...mockItem, isActivityMode: true, activityConfig: { 0: source } } as DashboardItem} onSave={mockOnSave} onCancel={mockOnCancel} canEdit year={2026} />);
    fireEvent.click(screen.getByRole('button', { name: 'Configurar actividades para la semana 1' }));
    const copyButton = screen.getByRole('button', { name: 'COPIAR A TODO EL AÑO' });
    fireEvent.click(copyButton);
    expect(screen.getByRole('status')).toHaveTextContent('Copiando actividades');
    expect(alertSpy).not.toHaveBeenCalled();
    expect(copyButton).toBeDisabled();
    fireEvent.click(copyButton);
    expect(mockOnSave).toHaveBeenCalledTimes(1);
    await act(async () => { resolveSave(); });
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Estructura copiada exitosamente.'));
  });

  test('H08 ante fallo no anuncia éxito, conserva origen y permite reintentar', async () => {
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => undefined);
    mockOnSave.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined);
    const source = [{ id: 'a', label: 'Actividad A', targetCount: 4, completedCount: 1 }];
    const item = { ...mockItem, isActivityMode: true, activityConfig: { 0: source } } as DashboardItem;
    render(<DataEditor item={item} onSave={mockOnSave} onCancel={mockOnCancel} canEdit year={2026} />);
    fireEvent.click(screen.getByRole('button', { name: 'Configurar actividades para la semana 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'COPIAR A TODO EL AÑO' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('puedes reintentar');
    expect(alertSpy).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'COPIAR A TODO EL AÑO' })).toBeEnabled();
    expect(source[0].completedCount).toBe(1);
    fireEvent.click(screen.getByRole('button', { name: 'COPIAR A TODO EL AÑO' }));
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Estructura copiada exitosamente.'));
    expect(mockOnSave).toHaveBeenCalledTimes(2);
    expect((mockOnSave.mock.calls[1][0].activityConfig as any)[0]).toBe(source);
  });

  test('H08 la copia mensual rellena los otros once periodos y deja el mes de origen intacto', async () => {
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    jest.spyOn(window, 'alert').mockImplementation(() => undefined);
    const source = [{ id: 'monthly', label: 'Actividad mensual', targetCount: 8, completedCount: 3 }];
    render(<DataEditor item={{ ...mockItem, frequency: 'monthly', isActivityMode: true, activityConfig: { 4: source } } as DashboardItem} onSave={mockOnSave} onCancel={mockOnCancel} canEdit year={2026} />);
    fireEvent.click(within(document.getElementById('month-card-4') as HTMLElement).getByRole('button', { name: /Detalle \(1 metas\)/ }));
    fireEvent.click(screen.getByRole('button', { name: 'COPIAR A TODO EL AÑO' }));
    await waitFor(() => expect(mockOnSave).toHaveBeenCalledTimes(1));
    const config = mockOnSave.mock.calls[0][0].activityConfig as Record<number, any[]>;
    expect(Object.keys(config)).toHaveLength(12);
    expect(config[4]).toBe(source);
    for (let index = 0; index < 12; index++) {
      if (index === 4) continue;
      expect(config[index]).toEqual([{ id: 'monthly', label: 'Actividad mensual', targetCount: 8, completedCount: 0 }]);
    }
  });

  test('H08 una lista de origen vacía mantiene la copia anual deshabilitada y no persiste', () => {
    const confirmSpy = jest.spyOn(window, 'confirm');
    render(<DataEditor item={{ ...mockItem, isActivityMode: true, activityConfig: { 0: [] } } as DashboardItem} onSave={mockOnSave} onCancel={mockOnCancel} canEdit year={2026} />);
    fireEvent.click(screen.getByRole('button', { name: 'Configurar actividades para la semana 1' }));
    const copyButton = screen.getByRole('button', { name: 'COPIAR A TODO EL AÑO' });
    expect(copyButton).toBeDisabled();
    fireEvent.click(copyButton);
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(mockOnSave).not.toHaveBeenCalled();
  });

  test('Vista Anual abre la superficie única sin incrustar ContinuityPanel en la columna', () => {
    const item = {
      ...mockItem,
      activityConfig: {
        30: [{
          id: 'activity-physical-1',
          label: 'Compromiso anual S36',
          targetCount: 1,
          completedCount: 0,
          resolution: {
            resolutionStatus: 'rescheduled',
            scheduledResolutionYear: 2026,
            scheduledResolutionPeriodType: 'weekly',
            scheduledResolutionPeriodIndex: 35
          }
        }]
      }
    } as DashboardItem;

    render(<DataEditor item={item} onSave={mockOnSave} onCancel={mockOnCancel} canEdit={false} year={2026} />);

    const manage = screen.getByRole('button', { name: 'GESTIONAR' });
    const commitmentSection = manage.closest('section');
    expect(commitmentSection).not.toBeNull();
    expect(within(commitmentSection as HTMLElement).queryByRole('region', { name: 'Panel de continuidad' })).not.toBeInTheDocument();
    fireEvent.click(manage);

    const workspace = screen.getByRole('dialog', { name: 'Gestión de continuidad' });
    expect(within(workspace).getByRole('region', { name: 'Panel de continuidad' })).toBeInTheDocument();
    expect(within(workspace).getByText('KPI')).toBeInTheDocument();
    expect(within(workspace).getByRole('button', { name: /CERRAR SIN ALCANZAR LA META/ })).toBeInTheDocument();
    fireEvent.click(within(workspace).getByRole('button', { name: /CERRAR GESTOR/ }));
    expect(screen.queryByRole('dialog', { name: 'Gestión de continuidad' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'GESTIONAR' })).toBeInTheDocument();
  });

  test('reprograma mediante el panel compartido sin escribir la resolución legacy', async () => {
    const item = {
      ...mockItem,
      weeklyGoals: Array(53).fill(0).map((value, index) => index === 35 ? 17 : value),
      weeklyProgress: Array(53).fill(0).map((value, index) => index === 35 ? 9 : value),
      activityConfig: {
        30: [{
          id: 'activity-physical-1',
          label: 'Compromiso anual S36',
          targetCount: 1,
          completedCount: 0,
          resolution: {
            resolutionStatus: 'rescheduled',
            scheduledResolutionYear: 2026,
            scheduledResolutionPeriodType: 'weekly',
            scheduledResolutionPeriodIndex: 35,
            rescheduleHistory: [{
              fromYear: 2026,
              fromPeriodType: 'weekly',
              fromPeriodIndex: 30,
              toYear: 2026,
              toPeriodType: 'weekly',
              toPeriodIndex: 35,
              changedAt: '2026-08-01T00:00:00.000Z'
            }]
          }
        }]
      }
    } as DashboardItem;

    render(<DataEditor item={item} onSave={mockOnSave} onCancel={mockOnCancel} canEdit={true} year={2026} />);
    fireEvent.click(screen.getByRole('button', { name: 'GESTIONAR' }));
    fireEvent.click(screen.getByRole('button', { name: /REPROGRAMAR/ }));
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '39' } });
    fireEvent.click(screen.getByRole('button', { name: 'CONFIRMAR REPROGRAMACIÓN' }));

    await waitFor(() => expect(mockOnSave).toHaveBeenCalledTimes(1));
    expect(mockOnSave).toHaveBeenCalledWith(expect.any(Object), true);
    const saved = mockOnSave.mock.calls[0][0] as Partial<DashboardItem>;
    expect(saved.activityConfig).toBeUndefined();
    expect(saved.continuityCommitments?.['activity:activity-physical-1']).toMatchObject({ scheduledPeriod: 39, status: 'active' });
    expect(saved.continuityCommitments?.['activity:activity-physical-1'].rescheduleHistory).toHaveLength(1);
    expect(item.weeklyGoals[35]).toBe(17);
    expect(item.weeklyProgress[35]).toBe(9);
  });

  test('prioriza el compromiso canónico sobre la resolución legacy', () => {
    const item = {
      ...mockItem,
      activityConfig: { 30: [{ id: 'activity-physical-1', label: 'Compromiso anual S36', targetCount: 1, completedCount: 0, resolution: { resolutionStatus: 'rescheduled', scheduledResolutionYear: 2026, scheduledResolutionPeriodType: 'weekly', scheduledResolutionPeriodIndex: 35 } }] },
      continuityCommitments: { 'activity:activity-physical-1': { id: 'activity:activity-physical-1', sourceType: 'ACTIVITY_KPI', sourceKpiId: 'test-dash', sourceActivityId: 'activity-physical-1', originYear: 2026, originPeriod: 30, originalTarget: 1, scheduledYear: 2026, scheduledPeriod: 35, progressByPeriod: {}, status: 'active', outcome: 'in_progress', rescheduleHistory: [], resolutionHistory: [{ type: 'CREATE_CONTINUITY', at: '2026-08-01T00:00:00.000Z' }] } },
    } as DashboardItem;
    render(<DataEditor item={item} onSave={mockOnSave} onCancel={mockOnCancel} canEdit year={2026} />);
    fireEvent.click(screen.getByRole('button', { name: 'GESTIONAR' }));
    expect(screen.getByText('Historial')).toBeInTheDocument();
    expect(screen.getByText('Compromiso iniciado')).toBeInTheDocument();
  });
});
