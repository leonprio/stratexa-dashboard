import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ContinuityWorkspace } from '../components/continuity/ContinuityWorkspace';
import { createSimpleKpiContinuityCommitment } from '../utils/continuityAdapter';
import type { DashboardItem } from '../types';

const emptyMonths = (value: number | null = null) => Array(12).fill(value) as (number | null)[];

describe('Lab & ContinuityWorkspace validation', () => {
  const activityFixture: DashboardItem = {
    id: 'lab-activity-kpi',
    indicator: 'EVENTOS DE CERTIFICACIÓN',
    weight: 100,
    frequency: 'monthly',
    monthlyGoals: emptyMonths(0).map((v, i) => (i === 7 ? 3 : v)),
    monthlyProgress: emptyMonths(null).map((v, i) => (i === 7 ? 0 : v)),
    monthlyProgressCaptured: Array(12).fill(false).map((_, i) => i === 7),
    unit: 'eventos',
    type: 'accumulative',
    goalType: 'maximize',
    indicatorType: 'simple',
    isActivityMode: true,
    activityConfig: {
      7: [
        { id: 'test-activity-a', label: 'Actividad A', targetCount: 2, completedCount: 0 },
        { id: 'test-activity-b', label: 'Actividad B', targetCount: 1, completedCount: 0 },
      ],
    },
  };

  const simpleItem: DashboardItem = {
    id: 'lab-simple-kpi',
    indicator: 'ALIANZAS DE CERTIFICACIÓN',
    weight: 100,
    frequency: 'monthly',
    trackingStartPeriod: { frequency: 'monthly', year: 2026, monthIndex: 7 },
    monthlyGoals: emptyMonths(0).map((v, i) => (i === 7 ? 5 : v)),
    monthlyProgress: emptyMonths(null).map((v, i) => (i === 7 ? 3 : v)),
    monthlyProgressCaptured: Array(12).fill(false).map((_, i) => i === 7),
    unit: 'alianzas',
    type: 'accumulative',
    goalType: 'maximize',
    indicatorType: 'simple',
    isActivityMode: false,
  };
  const commitment = createSimpleKpiContinuityCommitment(simpleItem, 2026, 7);
  const simpleFixture: DashboardItem = {
    ...simpleItem,
    continuityCommitments: {
      [commitment.id]: commitment,
    },
  };

  test('Actividad A opens with Meta 2, Real 0, Pendiente 2', () => {
    const handleClose = jest.fn();
    render(
      <ContinuityWorkspace
        item={activityFixture}
        pending={{
          id: 'test-activity-a',
          sourceActivityId: 'test-activity-a',
          label: 'Actividad A',
          periodIndex: 7,
          periodLabel: 'Agosto',
        }}
        year={2026}
        isWeekly={false}
        consultedPeriod={7}
        onUpdateItem={jest.fn()}
        onClose={handleClose}
      />
    );

    const summary = screen.getByRole('region', { name: 'Resumen ejecutivo de continuidad' });
    expect(summary).toHaveTextContent('Meta del compromiso');
    expect(summary).toHaveTextContent('2'); // Meta 2
    expect(summary).toHaveTextContent('Pendiente');

    // Test close button
    const closeBtn = screen.getByRole('button', { name: /CERRAR GESTOR/i });
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  test('Actividad B opens with Meta 1, Real 0, Pendiente 1', () => {
    const handleClose = jest.fn();
    render(
      <ContinuityWorkspace
        item={activityFixture}
        pending={{
          id: 'test-activity-b',
          sourceActivityId: 'test-activity-b',
          label: 'Actividad B',
          periodIndex: 7,
          periodLabel: 'Agosto',
        }}
        year={2026}
        isWeekly={false}
        consultedPeriod={7}
        onUpdateItem={jest.fn()}
        onClose={handleClose}
      />
    );

    const summary = screen.getByRole('region', { name: 'Resumen ejecutivo de continuidad' });
    expect(summary).toHaveTextContent('Meta del compromiso');
    expect(summary).toHaveTextContent('1'); // Meta 1

    const closeBtn = screen.getByRole('button', { name: /CERRAR GESTOR/i });
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  test('Simple KPI opens with Meta 5, Real 3, Pendiente 2', () => {
    const handleClose = jest.fn();
    render(
      <ContinuityWorkspace
        item={simpleFixture}
        pending={{
          id: commitment.id,
          sourceActivityId: commitment.id,
          label: 'ALIANZAS DE CERTIFICACIÓN',
          periodIndex: 7,
          periodLabel: 'Agosto',
        }}
        year={2026}
        isWeekly={false}
        consultedPeriod={7}
        onUpdateItem={jest.fn()}
        onClose={handleClose}
      />
    );

    const summary = screen.getByRole('region', { name: 'Resumen ejecutivo de continuidad' });
    expect(summary).toHaveTextContent('5'); // Meta 5
    expect(summary).toHaveTextContent('+3'); // Avance de Agosto
    expect(summary).toHaveTextContent('3'); // Realizado acumulado
    expect(summary).toHaveTextContent('2'); // Pendiente 2
    expect(summary).toHaveTextContent('60%'); // Cumplimiento

    const closeBtn = screen.getByRole('button', { name: /CERRAR GESTOR/i });
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
