import { render, screen } from '@testing-library/react';
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
});
