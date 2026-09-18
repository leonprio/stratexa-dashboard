import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
