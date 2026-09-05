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

  test('abre inline el gestor real de un compromiso reprogramado en Vista Anual', () => {
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
    fireEvent.click(manage);

    expect(within(commitmentSection as HTMLElement).getByRole('button', { name: /COMPLETAR AHORA/ })).toBeInTheDocument();
    expect(within(commitmentSection as HTMLElement).getByRole('button', { name: /REPROGRAMAR/ })).toBeInTheDocument();
    expect(within(commitmentSection as HTMLElement).getByRole('button', { name: /DESCARTAR/ })).toBeInTheDocument();
    expect(within(commitmentSection as HTMLElement).getByRole('button', { name: 'CANCELAR' })).toBeInTheDocument();
  });

  test('reprograma sucesivamente la misma actividad física sin alterar KPI/YTD', async () => {
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
    const saved = mockOnSave.mock.calls[0][0] as Partial<DashboardItem>;
    const savedActivities = saved.activityConfig?.[30] || [];
    expect(savedActivities).toHaveLength(1);
    expect(savedActivities[0].id).toBe('activity-physical-1');
    expect(savedActivities[0].resolution?.scheduledResolutionPeriodIndex).toBe(39);
    expect(savedActivities[0].resolution?.rescheduleHistory).toHaveLength(2);
    expect(savedActivities[0].resolution?.rescheduleHistory?.[1]).toMatchObject({ fromPeriodIndex: 35, toPeriodIndex: 39 });
    expect(item.weeklyGoals[35]).toBe(17);
    expect(item.weeklyProgress[35]).toBe(9);
  });
});
