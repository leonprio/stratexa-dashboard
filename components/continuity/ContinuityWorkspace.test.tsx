import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { ContinuityWorkspace } from './ContinuityWorkspace';

const pending = { id: 'activity:a', sourceActivityId: 'a', label: 'Establecer metas', periodIndex: 7, periodLabel: 'Ago' };
const item: any = {
  id: 7,
  indicator: 'COMPROMISOS ESTRATÉGICOS CUMPLIDOS',
  monthlyGoals: [null, null, null, null, null, null, null, 20],
  monthlyProgress: [null, null, null, null, null, null, null, null, 7, null],
  monthlyProgressCaptured: [false, false, false, false, false, false, false, true, true, false],
  activityConfig: { 7: [{ id: 'a', label: 'Establecer metas', targetCount: 20, completedCount: 5 }] },
  continuityCommitments: {
    'activity:a': {
      id: 'activity:a', sourceType: 'ACTIVITY_KPI', sourceKpiId: '7', sourceActivityId: 'a',
      originYear: 2026, originPeriod: 7, originalTarget: 20, scheduledYear: 2026, scheduledPeriod: 9,
      progressByPeriod: { 7: 5, 8: 7 }, status: 'active', outcome: 'in_progress',
      rescheduleHistory: [], resolutionHistory: [],
    },
  },
};

test('shows authoritative commitment metrics for October when scheduled for October even if consulted in September', () => {
  render(<ContinuityWorkspace item={item} pending={pending} year={2026} isWeekly={false} consultedPeriod={8} onUpdateItem={jest.fn()} onClose={jest.fn()} />);
  const summary = screen.getByRole('region', { name: 'Resumen ejecutivo de continuidad' });
  expect(within(summary).getByText('20')).toBeInTheDocument(); // Meta
  expect(within(summary).getAllByText('12')).toHaveLength(2); // Acumulado anterior (5 + 7) & Realizado acumulado
  expect(within(summary).getByText('SIN CAPTURA')).toBeInTheDocument(); // Avance de Octubre
  expect(within(summary).getByText('8')).toBeInTheDocument(); // Pendiente
  expect(within(summary).getByText('Octubre')).toBeInTheDocument(); // Periodo compromiso
  expect(screen.getByText(/PERIODO CONSULTADO/)).toHaveTextContent('Septiembre 2026');
  expect(screen.getByText(/PERIODO DEL COMPROMISO/)).toHaveTextContent('Octubre 2026');
});

test('shows authoritative commitment metrics for September even when opened from August', () => {
  const rescheduledItem: any = {
    id: 7,
    indicator: 'COMPROMISOS ESTRATÉGIDOS CUMPLIDOS',
    activityConfig: { 7: [{ id: 'a', label: 'Establecer metas en Agosto', targetCount: 10, completedCount: 3 }] },
    continuityCommitments: {
      'activity:a': {
        id: 'activity:a', sourceType: 'ACTIVITY_KPI', sourceKpiId: '7', sourceActivityId: 'a',
        originYear: 2026, originPeriod: 7, originalTarget: 10, scheduledYear: 2026, scheduledPeriod: 8,
        progressByPeriod: { 7: 3, 8: 1 }, status: 'active', outcome: 'in_progress',
        rescheduleHistory: [], resolutionHistory: [],
      },
    },
  };
  render(<ContinuityWorkspace item={rescheduledItem} pending={pending} year={2026} isWeekly={false} consultedPeriod={7} onUpdateItem={jest.fn()} onClose={jest.fn()} />);
  const summary = screen.getByRole('region', { name: 'Resumen ejecutivo de continuidad' });
  expect(within(summary).getByText('10')).toBeInTheDocument(); // Meta
  expect(within(summary).getByText('3')).toBeInTheDocument(); // Acumulado anterior
  expect(within(summary).getByText('+1')).toBeInTheDocument(); // Avance de Septiembre
  expect(within(summary).getByText('4')).toBeInTheDocument(); // Realizado acumulado
  expect(within(summary).getByText('40%')).toBeInTheDocument(); // Cumplimiento
  expect(within(summary).getByText('6')).toBeInTheDocument(); // Pendiente
  expect(within(summary).getByText('Septiembre')).toBeInTheDocument(); // Periodo compromiso
  expect(screen.getByText(/PERIODO CONSULTADO/)).toHaveTextContent('Agosto 2026');
  expect(screen.getByText(/PERIODO DEL COMPROMISO/)).toHaveTextContent('Septiembre 2026');
});

test('shows no capture for scheduled October without capture without coercing it to zero', () => {
  render(<ContinuityWorkspace item={item} pending={pending} year={2026} isWeekly={false} consultedPeriod={8} onUpdateItem={jest.fn()} onClose={jest.fn()} />);
  const summary = screen.getByRole('region', { name: 'Resumen ejecutivo de continuidad' });
  expect(within(summary).getByText('SIN CAPTURA')).toBeInTheDocument();
  expect(within(summary).getAllByText('12')).toHaveLength(2);
  expect(within(summary).getByText('8')).toBeInTheDocument();
});

test('strictly separates aggregate KPI progress (5) from individual items (4 and 1)', () => {
  const multiItem: any = {
    id: 7,
    indicator: 'COMPROMISOS ESTRATÉGICOS CUMPLIDOS',
    monthlyGoals: [0, 0, 0, 0, 0, 0, 0, 20],
    monthlyProgress: [0, 0, 0, 0, 0, 0, 0, 5],
    monthlyProgressCaptured: [false, false, false, false, false, false, false, true],
    activityConfig: {
      7: [
        { id: 'act-1', label: 'Establecer metas en Agosto para todos los indicadores', targetCount: 10, completedCount: 4 },
        { id: 'act-2', label: 'Agregar al menos una estrategia o iniciativa por indicador', targetCount: 10, completedCount: 1 },
      ],
    },
    continuityCommitments: {
      'activity:act-1': {
        id: 'activity:act-1', sourceType: 'ACTIVITY_KPI', sourceKpiId: '7', sourceActivityId: 'act-1',
        originYear: 2026, originPeriod: 7, originalTarget: 10, scheduledYear: 2026, scheduledPeriod: 7,
        progressByPeriod: { 7: 4 }, status: 'active', outcome: 'in_progress',
        rescheduleHistory: [], resolutionHistory: [],
      },
      'activity:act-2': {
        id: 'activity:act-2', sourceType: 'ACTIVITY_KPI', sourceKpiId: '7', sourceActivityId: 'act-2',
        originYear: 2026, originPeriod: 7, originalTarget: 10, scheduledYear: 2026, scheduledPeriod: 7,
        progressByPeriod: { 7: 1 }, status: 'active', outcome: 'in_progress',
        rescheduleHistory: [], resolutionHistory: [],
      },
    },
  };

  // 1. Manage Item 1
  const pending1 = { id: 'activity:act-1', sourceActivityId: 'act-1', label: 'Establecer metas en Agosto para todos los indicadores', periodIndex: 7, periodLabel: 'Ago' };
  const { unmount: unmount1 } = render(
    <ContinuityWorkspace item={multiItem} pending={pending1} year={2026} isWeekly={false} consultedPeriod={7} onUpdateItem={jest.fn()} onClose={jest.fn()} />
  );

  // Aggregate KPI context
  expect(screen.getByText('INDICADOR MAESTRO')).toBeInTheDocument();
  expect(screen.getByText(/RESULTADO DEL INDICADOR/)).toBeInTheDocument();
  expect(screen.getByText('Meta total del indicador:')).toBeInTheDocument();
  expect(screen.getByText('Real total del indicador:')).toBeInTheDocument();
  expect(screen.getByText('Cumplimiento del indicador:')).toBeInTheDocument();

  const summary1 = screen.getByRole('region', { name: 'Resumen ejecutivo de continuidad' });
  expect(within(summary1).getByText('10')).toBeInTheDocument(); // meta compromiso A (10 !== KPI target 20)
  expect(within(summary1).getByText('4')).toBeInTheDocument();  // acumulado propio compromiso A
  expect(within(summary1).getByText('+4')).toBeInTheDocument(); // avance agosto propio compromiso A
  expect(within(summary1).getByText('6')).toBeInTheDocument();  // pendiente propio compromiso A (10 - 4)

  unmount1();

  // 2. Manage Item 2
  const pending2 = { id: 'activity:act-2', sourceActivityId: 'act-2', label: 'Agregar al menos una estrategia o iniciativa por indicador', periodIndex: 7, periodLabel: 'Ago' };
  render(
    <ContinuityWorkspace item={multiItem} pending={pending2} year={2026} isWeekly={false} consultedPeriod={7} onUpdateItem={jest.fn()} onClose={jest.fn()} />
  );

  const summary2 = screen.getByRole('region', { name: 'Resumen ejecutivo de continuidad' });
  expect(within(summary2).getByText('10')).toBeInTheDocument(); // meta compromiso B (10 !== KPI target 20)
  expect(within(summary2).getByText('1')).toBeInTheDocument();  // acumulado propio compromiso B (1 !== KPI progress 5)
  expect(within(summary2).getByText('+1')).toBeInTheDocument(); // avance agosto propio compromiso B
  expect(within(summary2).getByText('9')).toBeInTheDocument();  // pendiente propio compromiso B (10 - 1)

  // Verify item2 progress !== aggregate progress
  expect(within(summary2).queryByText('+5')).not.toBeInTheDocument();
  expect(within(summary2).queryByText('5 de 10')).not.toBeInTheDocument();
});

test('resolves legacy fallback activity (not yet in continuityCommitments) with its own target and completed count', () => {
  const itemWithoutCommitmentB: any = {
    id: 7,
    indicator: 'COMPROMISOS ESTRATÉGICOS CUMPLIDOS',
    monthlyGoals: [0, 0, 0, 0, 0, 0, 0, 20],
    monthlyProgress: [0, 0, 0, 0, 0, 0, 0, 5],
    monthlyProgressCaptured: [false, false, false, false, false, false, false, true],
    activityConfig: {
      7: [
        { id: 'act-1', label: 'Establecer metas en Agosto para todos los indicadores', targetCount: 10, completedCount: 4 },
        { id: 'act-2', label: 'Agregar al menos una estrategia o iniciativa por indicador', targetCount: 10, completedCount: 1 },
      ],
    },
    continuityCommitments: {
      'activity:act-1': {
        id: 'activity:act-1', sourceType: 'ACTIVITY_KPI', sourceKpiId: '7', sourceActivityId: 'act-1',
        originYear: 2026, originPeriod: 7, originalTarget: 10, scheduledYear: 2026, scheduledPeriod: 7,
        progressByPeriod: { 7: 4 }, status: 'active', outcome: 'in_progress',
        rescheduleHistory: [], resolutionHistory: [],
      },
      // Note: 'activity:act-2' is intentionally NOT in continuityCommitments
    },
  };

  const pending2 = { id: 'activity:act-2', sourceActivityId: 'act-2', label: 'Agregar al menos una estrategia o iniciativa por indicador', periodIndex: 7, periodLabel: 'Ago' };
  render(
    <ContinuityWorkspace item={itemWithoutCommitmentB} pending={pending2} year={2026} isWeekly={false} consultedPeriod={7} onUpdateItem={jest.fn()} onClose={jest.fn()} />
  );

  const summary = screen.getByRole('region', { name: 'Resumen ejecutivo de continuidad' });
  expect(within(summary).getByText('10')).toBeInTheDocument(); // meta compromiso B = 10 (not 20)
  expect(within(summary).getByText('1')).toBeInTheDocument();  // acumulado propio = 1 (not 5)
  expect(within(summary).getByText('+1')).toBeInTheDocument(); // avance agosto propio = +1 (not +5)
  expect(within(summary).getByText('9')).toBeInTheDocument();  // pendiente propio = 9 (not 15)

  // Explicitly assert that 20 and 5 do NOT leak into item metrics
  expect(within(summary).queryByText('20')).not.toBeInTheDocument();
  expect(within(summary).queryByText('5')).not.toBeInTheDocument();
  expect(within(summary).queryByText('+5')).not.toBeInTheDocument();
  expect(within(summary).queryByText('15')).not.toBeInTheDocument();
});

test('Item B rescheduled to September with +3 progress: aug=1, sep=3, cumulative=4, fulfillment=40%, remaining=6', () => {
  const rescheduledItem: any = {
    id: 7,
    indicator: 'COMPROMISOS ESTRATÉGICOS CUMPLIDOS',
    monthlyGoals: [0, 0, 0, 0, 0, 0, 0, 20, 0],
    monthlyProgress: [0, 0, 0, 0, 0, 0, 0, 5, null],
    monthlyProgressCaptured: [false, false, false, false, false, false, false, true, false],
    activityConfig: {
      7: [
        { id: 'act-1', label: 'Establecer metas en Agosto para todos los indicadores', targetCount: 10, completedCount: 4 },
        { id: 'act-2', label: 'Agregar al menos una estrategia o iniciativa por indicador', targetCount: 10, completedCount: 1 },
      ],
    },
    continuityCommitments: {
      'activity:act-2': {
        id: 'activity:act-2', sourceType: 'ACTIVITY_KPI', sourceKpiId: '7', sourceActivityId: 'act-2',
        originYear: 2026, originPeriod: 7, originalTarget: 10, scheduledYear: 2026, scheduledPeriod: 8,
        progressByPeriod: { 7: 1, 8: 3 }, status: 'active', outcome: 'in_progress',
        rescheduleHistory: [{ id: 'r1', fromYear: 2026, fromPeriod: 7, toYear: 2026, toPeriod: 8, at: '2026-09-17', status: 'active' }],
        resolutionHistory: [{ type: 'CREATE_CONTINUITY', at: '2026-09-17' }, { type: 'RECORD_PROGRESS', period: 8, value: 3, at: '2026-09-17' }],
      },
    },
  };

  const pending2 = { id: 'activity:act-2', sourceActivityId: 'act-2', label: 'Agregar al menos una estrategia o iniciativa por indicador', periodIndex: 7, periodLabel: 'Ago' };
  render(
    <ContinuityWorkspace item={rescheduledItem} pending={pending2} year={2026} isWeekly={false} consultedPeriod={8} onUpdateItem={jest.fn()} onClose={jest.fn()} />
  );

  const summary = screen.getByRole('region', { name: 'Resumen ejecutivo de continuidad' });
  expect(within(summary).getByText('10')).toBeInTheDocument(); // meta compromiso = 10
  expect(within(summary).getByText('4')).toBeInTheDocument();  // cumulative progress = 1 + 3 = 4
  expect(within(summary).getByText('+3')).toBeInTheDocument(); // avance septiembre = +3
  expect(within(summary).getByText('6')).toBeInTheDocument();  // remaining = 10 - 4 = 6
  expect(within(summary).getByText('Septiembre')).toBeInTheDocument(); // scheduled period = Septiembre

  // Ensure 5 or 50% or remaining 5 do NOT appear
  expect(within(summary).queryByText('+5')).not.toBeInTheDocument();
  expect(within(summary).queryByText('5 de 10')).not.toBeInTheDocument();
  expect(within(summary).queryByText('5')).not.toBeInTheDocument();
});

test('Mutual independence: Item A remains strictly isolated after +3 is recorded on Item B', () => {
  const itemWithBoth: any = {
    id: 7,
    indicator: 'COMPROMISOS ESTRATÉGICOS CUMPLIDOS',
    monthlyGoals: [0, 0, 0, 0, 0, 0, 0, 20, 0],
    monthlyProgress: [0, 0, 0, 0, 0, 0, 0, 5, 3],
    monthlyProgressCaptured: [false, false, false, false, false, false, false, true, true],
    activityConfig: {
      7: [
        { id: 'act-a', label: 'Establecer metas en Agosto para todos los indicadores', targetCount: 10, completedCount: 4 },
        { id: 'act-b', label: 'Agregar al menos una estrategia o iniciativa por indicador', targetCount: 10, completedCount: 1 },
      ],
    },
    continuityCommitments: {
      'activity:act-a': {
        id: 'activity:act-a', sourceType: 'ACTIVITY_KPI', sourceKpiId: '7', sourceActivityId: 'act-a',
        originYear: 2026, originPeriod: 7, originalTarget: 10, scheduledYear: 2026, scheduledPeriod: 7,
        progressByPeriod: { 7: 4 }, status: 'active', outcome: 'in_progress',
        rescheduleHistory: [], resolutionHistory: [],
      },
      'activity:act-b': {
        id: 'activity:act-b', sourceType: 'ACTIVITY_KPI', sourceKpiId: '7', sourceActivityId: 'act-b',
        originYear: 2026, originPeriod: 7, originalTarget: 10, scheduledYear: 2026, scheduledPeriod: 8,
        progressByPeriod: { 7: 1, 8: 3 }, status: 'active', outcome: 'in_progress',
        rescheduleHistory: [{ id: 'r1', fromYear: 2026, fromPeriod: 7, toYear: 2026, toPeriod: 8, at: '2026-09-17', status: 'active' }],
        resolutionHistory: [{ type: 'CREATE_CONTINUITY', at: '2026-09-17' }, { type: 'RECORD_PROGRESS', period: 8, value: 3, at: '2026-09-17' }],
      },
    },
  };

  // Inspect A in August (period 7)
  const pendingA = { id: 'activity:act-a', sourceActivityId: 'act-a', label: 'Establecer metas en Agosto para todos los indicadores', periodIndex: 7, periodLabel: 'Ago' };
  const { unmount: unmountA } = render(
    <ContinuityWorkspace item={itemWithBoth} pending={pendingA} year={2026} isWeekly={false} consultedPeriod={7} onUpdateItem={jest.fn()} onClose={jest.fn()} />
  );

  const summaryA = screen.getByRole('region', { name: 'Resumen ejecutivo de continuidad' });
  expect(within(summaryA).getByText('10')).toBeInTheDocument(); // target A
  expect(within(summaryA).getByText('4')).toBeInTheDocument();  // cumulative A
  expect(within(summaryA).getByText('+4')).toBeInTheDocument(); // August progress A
  expect(within(summaryA).getByText('6')).toBeInTheDocument();  // remaining A
  // A has no B progress (1, 3) and no KPI aggregate (5, 20)
  expect(within(summaryA).queryByText('+1')).not.toBeInTheDocument();
  expect(within(summaryA).queryByText('+3')).not.toBeInTheDocument();
  expect(within(summaryA).queryByText('+5')).not.toBeInTheDocument();

  unmountA();

  // Inspect B in September (period 8)
  const pendingB = { id: 'activity:act-b', sourceActivityId: 'act-b', label: 'Agregar al menos una estrategia o iniciativa por indicador', periodIndex: 7, periodLabel: 'Ago' };
  render(
    <ContinuityWorkspace item={itemWithBoth} pending={pendingB} year={2026} isWeekly={false} consultedPeriod={8} onUpdateItem={jest.fn()} onClose={jest.fn()} />
  );

  const summaryB = screen.getByRole('region', { name: 'Resumen ejecutivo de continuidad' });
  expect(within(summaryB).getByText('10')).toBeInTheDocument(); // target B
  expect(within(summaryB).getByText('4')).toBeInTheDocument();  // cumulative B (1 + 3)
  expect(within(summaryB).getByText('+3')).toBeInTheDocument(); // September progress B
  expect(within(summaryB).getByText('6')).toBeInTheDocument();  // remaining B
  // Assert distinct identities
  expect(itemWithBoth.continuityCommitments['activity:act-a'].id).not.toEqual(itemWithBoth.continuityCommitments['activity:act-b'].id);
  expect(itemWithBoth.continuityCommitments['activity:act-a'].sourceActivityId).not.toEqual(itemWithBoth.continuityCommitments['activity:act-b'].sourceActivityId);
});

test('Workspace displays single source of truth: A target 9 / rem 5, B target 8 / rem 4, and KPI master 17 / 8 / 47%', () => {
  const itemWith9and8: any = {
    id: 7,
    indicator: 'COMPROMISOS ESTRATÉGICOS CUMPLIDOS',
    monthlyGoals: [0, 0, 0, 0, 0, 0, 0, 17, 0],
    monthlyProgress: [0, 0, 0, 0, 0, 0, 0, 5, 3],
    monthlyProgressCaptured: [false, false, false, false, false, false, false, true, true],
    activityConfig: {
      7: [
        { id: 'act-a', label: 'Establecer metas en Agosto para todos los indicadores', targetCount: 9, completedCount: 4 },
        { id: 'act-b', label: 'Agregar al menos una estrategia o iniciativa por indicador', targetCount: 8, completedCount: 1 },
      ],
    },
    continuityCommitments: {
      'activity:act-a': {
        id: 'activity:act-a', sourceType: 'ACTIVITY_KPI', sourceKpiId: '7', sourceActivityId: 'act-a',
        originYear: 2026, originPeriod: 7, originalTarget: 9, scheduledYear: 2026, scheduledPeriod: 7,
        progressByPeriod: { 7: 4 }, status: 'active', outcome: 'in_progress',
        rescheduleHistory: [], resolutionHistory: [],
      },
      'activity:act-b': {
        id: 'activity:act-b', sourceType: 'ACTIVITY_KPI', sourceKpiId: '7', sourceActivityId: 'act-b',
        originYear: 2026, originPeriod: 7, originalTarget: 8, scheduledYear: 2026, scheduledPeriod: 8,
        progressByPeriod: { 7: 1, 8: 3 }, status: 'active', outcome: 'in_progress',
        rescheduleHistory: [{ id: 'r1', fromYear: 2026, fromPeriod: 7, toYear: 2026, toPeriod: 8, at: '2026-09-17', status: 'active' }],
        resolutionHistory: [{ type: 'CREATE_CONTINUITY', at: '2026-09-17' }, { type: 'RECORD_PROGRESS', period: 8, value: 3, at: '2026-09-17' }],
      },
    },
  };

  // Inspect A in August (period 7)
  const pendingA = { id: 'activity:act-a', sourceActivityId: 'act-a', label: 'Establecer metas en Agosto para todos los indicadores', periodIndex: 7, periodLabel: 'Ago' };
  const { unmount: unmountA } = render(
    <ContinuityWorkspace item={itemWith9and8} pending={pendingA} year={2026} isWeekly={false} consultedPeriod={7} onUpdateItem={jest.fn()} onClose={jest.fn()} />
  );

  // Check KPI Master header
  expect(screen.getByText('Meta total del indicador:')).toBeInTheDocument();
  expect(screen.getByText('17')).toBeInTheDocument(); // Master target
  expect(screen.getByText('Real total del indicador:')).toBeInTheDocument();
  expect(screen.getByText('8')).toBeInTheDocument(); // Master real (5 + 3)
  expect(screen.getByText('Cumplimiento del indicador:')).toBeInTheDocument();
  expect(screen.getByText('47%')).toBeInTheDocument(); // Master fulfillment (8 / 17 = 47%)

  // Check Item A summary
  const summaryA = screen.getByRole('region', { name: 'Resumen ejecutivo de continuidad' });
  expect(within(summaryA).getByText('9')).toBeInTheDocument(); // target A = 9 (NOT 10)
  expect(within(summaryA).getByText('+4')).toBeInTheDocument(); // Aug progress = +4
  expect(within(summaryA).getByText('4')).toBeInTheDocument(); // cumulative = 4
  expect(within(summaryA).getByText('5')).toBeInTheDocument(); // remaining = 9 - 4 = 5
  expect(within(summaryA).getByText('44%')).toBeInTheDocument(); // 4/9 = 44%
  expect(within(summaryA).queryByText('10')).not.toBeInTheDocument();

  unmountA();

  // Inspect B in September (period 8)
  const pendingB = { id: 'activity:act-b', sourceActivityId: 'act-b', label: 'Agregar al menos una estrategia o iniciativa por indicador', periodIndex: 7, periodLabel: 'Ago' };
  render(
    <ContinuityWorkspace item={itemWith9and8} pending={pendingB} year={2026} isWeekly={false} consultedPeriod={8} onUpdateItem={jest.fn()} onClose={jest.fn()} />
  );

  const summaryB = screen.getByRole('region', { name: 'Resumen ejecutivo de continuidad' });
  expect(within(summaryB).getByText('8')).toBeInTheDocument(); // target B = 8 (NOT 10)
  expect(within(summaryB).getByText('1')).toBeInTheDocument(); // previous cumulative through Aug = 1
  expect(within(summaryB).getByText('+3')).toBeInTheDocument(); // Sep progress = +3
  expect(within(summaryB).getAllByText('4')).toHaveLength(2); // cumulative 4 and remaining 4
  expect(within(summaryB).getByText(/de 8/)).toBeInTheDocument();
  expect(within(summaryB).getByText('50%')).toBeInTheDocument(); // 4/8 = 50%
  expect(within(summaryB).getByText('Septiembre')).toBeInTheDocument();
  expect(within(summaryB).queryByText('10')).not.toBeInTheDocument();
});
