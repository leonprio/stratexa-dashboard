import { render, screen, waitFor } from '@testing-library/react';
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
});
