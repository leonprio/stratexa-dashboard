import { ControlCut, ControlCutKpiSnapshot } from '../types/controlCut';
import {
  compareControlCuts,
  validateControlCutsCompatibility,
  ControlCutComparisonResult,
} from './controlCutComparison';

describe('compareControlCuts (Bloque 2)', () => {
  const baseCutA: ControlCut = {
    cutId: 'CLIENT_A_BOARD1_M_2026_0',
    schemaVersion: 1,
    capturedAt: '2026-01-31T23:59:59Z',
    clientId: 'CLIENT_A',
    dashboardId: 'BOARD1',
    dashboardIds: ['BOARD1'],
    periodicity: 'monthly',
    year: 2026,
    periodIndex: 0,
    capturedByLabel: 'Admin 1',
    scope: {
      clientId: 'CLIENT_A',
      dashboardId: 'BOARD1',
      dashboardIds: ['BOARD1'],
      periodicity: 'monthly',
      year: 2026,
      periodIndex: 0,
    },
    controlSummary: {
      pendingConfigurationsCount: 1,
      pendingCapturesCount: 2,
      overdueActionsCount: 3,
      upcomingActionsCount: 2,
      activeActionsCount: 5,
      completedActionsCount: 2,
      pendingReviewsCount: 1,
      derivedAttentionCount: 4,
    },
    kpis: [
      {
        indicatorId: 101,
        label: 'Ventas Totales',
        goal: 1000,
        progress: 800,
        pending: 200,
        compliance: 80,
        frequency: 'monthly',
        dashboardId: 'BOARD1',
        area: 'Comercial',
      },
      {
        indicatorId: 102,
        label: 'Margen Operativo',
        goal: 25,
        progress: 20,
        pending: 5,
        compliance: 80,
        frequency: 'monthly',
        dashboardId: 'BOARD1',
        area: 'Finanzas',
      },
    ],
    actionPlans: [
      {
        id: 'PLAN_1',
        indicatorId: 101,
        dashboardId: 'BOARD1',
        title: 'Campaña Q1',
        originYear: 2026,
        originPeriodType: 'monthly',
        originPeriodIndex: 0,
        status: 'in_progress',
        startDate: '2026-01-05',
        progress: 50,
        createdAt: '2026-01-05T00:00:00Z',
        updatedAt: '2026-01-20T10:00:00Z',
        activities: [],
        reviews: [
          {
            id: 'REV_1',
            planId: 'PLAN_1',
            reviewedAt: '2026-01-20T10:00:00Z',
            reviewedByLabel: 'Revisor A',
            observedResult: 'Avanzó 50%',
            effect: 'FAVORABLE',
            decision: 'CONTINUE',
            nextCommitment: {
              type: 'plan',
              id: 'PLAN_1',
              title: 'Campaña Q1 etapa 2',
              targetDate: '2026-02-15',
              status: 'in_progress',
            },
          },
        ],
        nextCommitment: {
          type: 'plan',
          id: 'PLAN_1',
          title: 'Campaña Q1 etapa 2',
          targetDate: '2026-02-15',
          status: 'in_progress',
        },
      },
    ],
    reviews: [
      {
        id: 'REV_1',
        planId: 'PLAN_1',
        reviewedAt: '2026-01-20T10:00:00Z',
        reviewedByLabel: 'Revisor A',
        observedResult: 'Avanzó 50%',
        effect: 'FAVORABLE',
        decision: 'CONTINUE',
        nextCommitment: {
          type: 'plan',
          id: 'PLAN_1',
          title: 'Campaña Q1 etapa 2',
          targetDate: '2026-02-15',
          status: 'In Progress',
        },
      },
    ],
  };

  const baseCutB: ControlCut = {
    cutId: 'CLIENT_A_BOARD1_M_2026_1',
    schemaVersion: 1,
    capturedAt: '2026-02-28T23:59:59Z',
    clientId: 'CLIENT_A',
    dashboardId: 'BOARD1',
    dashboardIds: ['BOARD1'],
    periodicity: 'monthly',
    year: 2026,
    periodIndex: 1,
    capturedByLabel: 'Admin 2',
    scope: {
      clientId: 'CLIENT_A',
      dashboardId: 'BOARD1',
      dashboardIds: ['BOARD1'],
      periodicity: 'monthly',
      year: 2026,
      periodIndex: 1,
    },
    controlSummary: {
      pendingConfigurationsCount: 0,
      pendingCapturesCount: 1,
      overdueActionsCount: 1,
      upcomingActionsCount: 1,
      activeActionsCount: 4,
      completedActionsCount: 4,
      pendingReviewsCount: 0,
      derivedAttentionCount: 2,
    },
    kpis: [
      {
        indicatorId: 101,
        label: 'Ventas Totales Renombrado', // cambio de nombre intencional para verificar matching por indicatorId físico
        goal: 1000,
        progress: 950,
        pending: 50,
        compliance: 95,
        frequency: 'monthly',
        dashboardId: 'BOARD1',
        area: 'Comercial',
      },
      {
        indicatorId: 102,
        label: 'Margen Operativo',
        goal: 25,
        progress: 15,
        pending: 10,
        compliance: 60,
        frequency: 'monthly',
        dashboardId: 'BOARD1',
        area: 'Finanzas',
      },
      {
        indicatorId: 103, // KPI nuevo en B (ausente en A)
        label: 'Satisfacción Cliente',
        goal: 90,
        progress: 85,
        pending: 5,
        compliance: 94.4,
        frequency: 'monthly',
        dashboardId: 'BOARD1',
        area: 'Servicio',
      },
    ],
    actionPlans: [
      {
        id: 'PLAN_1',
        indicatorId: 101,
        dashboardId: 'BOARD1',
        title: 'Campaña Q1',
        originYear: 2026,
        originPeriodType: 'monthly',
        originPeriodIndex: 0,
        status: 'completed',
        startDate: '2026-01-05',
        progress: 100,
        createdAt: '2026-01-05T00:00:00Z',
        updatedAt: '2026-02-25T10:00:00Z',
        activities: [],
        reviews: [
          {
            id: 'REV_2',
            planId: 'PLAN_1',
            reviewedAt: '2026-02-25T10:00:00Z',
            reviewedByLabel: 'Revisor B',
            observedResult: 'Completado con éxito',
            effect: 'FAVORABLE',
            decision: 'CLOSE',
            nextCommitment: {
              type: 'plan',
              id: 'PLAN_2',
              title: 'Campaña Q2',
              targetDate: '2026-03-30',
              status: 'planned',
            },
          },
        ],
        nextCommitment: {
          type: 'plan',
          id: 'PLAN_2',
          title: 'Campaña Q2',
          targetDate: '2026-03-30',
          status: 'planned',
        },
      },
    ],
    reviews: [
      {
        id: 'REV_2',
        planId: 'PLAN_1',
        reviewedAt: '2026-02-25T10:00:00Z',
        reviewedByLabel: 'Revisor B',
        observedResult: 'Completado con éxito',
        effect: 'FAVORABLE',
        decision: 'CLOSE',
        nextCommitment: {
          type: 'plan',
          id: 'PLAN_2',
          title: 'Campaña Q2',
          targetDate: '2026-03-30',
          status: 'planned',
        },
      },
    ],
  };

  test('valida compatibilidad exitosa para dos cortes del mismo dashboard y periodicidad', () => {
    const val = validateControlCutsCompatibility(baseCutA, baseCutB);
    expect(val.compatible).toBe(true);
    expect(val.reason).toBeUndefined();
  });

  test('rechaza cortes de clientes distintos', () => {
    const otherClientCut = { ...baseCutB, clientId: 'CLIENT_B' };
    const val = validateControlCutsCompatibility(baseCutA, otherClientCut);
    expect(val.compatible).toBe(false);
    expect(val.reason).toMatch(/cliente/i);
    expect(() => compareControlCuts(baseCutA, otherClientCut)).toThrow(/cliente/i);
  });

  test('rechaza cortes de tableros distintos', () => {
    const otherBoardCut = { ...baseCutB, dashboardId: 'BOARD2' };
    const val = validateControlCutsCompatibility(baseCutA, otherBoardCut);
    expect(val.compatible).toBe(false);
    expect(val.reason).toMatch(/tablero/i);
    expect(() => compareControlCuts(baseCutA, otherBoardCut)).toThrow(/tablero/i);
  });

  test('rechaza cortes con periodicidades incompatibles', () => {
    const weeklyCut = { ...baseCutB, periodicity: 'weekly' as const };
    const val = validateControlCutsCompatibility(baseCutA, weeklyCut);
    expect(val.compatible).toBe(false);
    expect(val.reason).toMatch(/periodicidad/i);
    expect(() => compareControlCuts(baseCutA, weeklyCut)).toThrow(/periodicidad/i);
  });

  test('compara cortes mensuales calculando deltas y clasificaciones deterministas', () => {
    const result = compareControlCuts(baseCutA, baseCutB);

    expect(result.summaryDelta.pendingCapturesDelta).toBe(-1); // mejoró (2 -> 1)
    expect(result.summaryDelta.overdueActionsDelta).toBe(-2); // mejoró (3 -> 1)
    expect(result.summaryDelta.completedActionsDelta).toBe(2); // mejoró (2 -> 4)

    // KPI 101: cumplimiento subió de 80 a 95 (+15)
    const kpi101 = result.kpis.find((k) => String(k.indicatorId) === '101');
    expect(kpi101).toBeDefined();
    expect(kpi101?.status).toBe('both');
    expect(kpi101?.complianceA).toBe(80);
    expect(kpi101?.complianceB).toBe(95);
    expect(kpi101?.complianceDelta).toBe(15);
    expect(kpi101?.interpretation).toBe('improved');

    // KPI 102: cumplimiento cayó de 80 a 60 (-20)
    const kpi102 = result.kpis.find((k) => String(k.indicatorId) === '102');
    expect(kpi102).toBeDefined();
    expect(kpi102?.status).toBe('both');
    expect(kpi102?.complianceA).toBe(80);
    expect(kpi102?.complianceB).toBe(60);
    expect(kpi102?.complianceDelta).toBe(-20);
    expect(kpi102?.interpretation).toBe('worsened');

    // KPI 103: presente solo en B (nuevo/ausente en A)
    const kpi103 = result.kpis.find((k) => String(k.indicatorId) === '103');
    expect(kpi103).toBeDefined();
    expect(kpi103?.status).toBe('only_b');
    expect(kpi103?.interpretation).toBe('not_comparable');

    // Agrupación general de qué mejoró y qué empeoró
    expect(result.improvedKpiCount).toBe(1);
    expect(result.worsenedKpiCount).toBe(1);
  });

  test('compara cortes semanales correctamente', () => {
    const weeklyA: ControlCut = {
      ...baseCutA,
      cutId: 'CLIENT_A_BOARD1_W_2026_5',
      periodicity: 'weekly',
      periodIndex: 5,
    };
    const weeklyB: ControlCut = {
      ...baseCutB,
      cutId: 'CLIENT_A_BOARD1_W_2026_6',
      periodicity: 'weekly',
      periodIndex: 6,
    };

    const val = validateControlCutsCompatibility(weeklyA, weeklyB);
    expect(val.compatible).toBe(true);

    const result = compareControlCuts(weeklyA, weeklyB);
    expect(result.periodicity).toBe('weekly');
    expect(result.cutA.periodIndex).toBe(5);
    expect(result.cutB.periodIndex).toBe(6);
  });

  test('maneja KPI presente solo en A (ausente en B)', () => {
    const cutAExtra: ControlCut = {
      ...baseCutA,
      kpis: [
        ...baseCutA.kpis,
        {
          indicatorId: 999,
          label: 'KPI Descontinuado',
          goal: 10,
          progress: 10,
          compliance: 100,
          frequency: 'monthly',
          dashboardId: 'BOARD1',
        },
      ],
    };

    const result = compareControlCuts(cutAExtra, baseCutB);
    const kpi999 = result.kpis.find((k) => String(k.indicatorId) === '999');
    expect(kpi999).toBeDefined();
    expect(kpi999?.status).toBe('only_a');
    expect(kpi999?.interpretation).toBe('not_comparable');
  });

  test('compara planes de acción, revisiones y siguientes compromisos', () => {
    const result = compareControlCuts(baseCutA, baseCutB);

    const plan1 = result.actionPlans.find((p) => p.planId === 'PLAN_1');
    expect(plan1).toBeDefined();
    expect(plan1?.statusA).toBe('in_progress');
    expect(plan1?.statusB).toBe('completed');
    expect(plan1?.progressA).toBe(50);
    expect(plan1?.progressB).toBe(100);
    expect(plan1?.progressDelta).toBe(50);

    // Decisiones y siguientes compromisos congelados
    expect(plan1?.nextCommitmentA?.id).toBe('PLAN_1');
    expect(plan1?.nextCommitmentB?.id).toBe('PLAN_2');
    expect(plan1?.decisionB).toBe('CLOSE');
    expect(plan1?.observedResultB).toBe('Completado con éxito');
  });

  test('inmutabilidad: no muta los cortes originales', () => {
    const cloneA = JSON.parse(JSON.stringify(baseCutA));
    const cloneB = JSON.parse(JSON.stringify(baseCutB));

    compareControlCuts(baseCutA, baseCutB);

    expect(baseCutA).toEqual(cloneA);
    expect(baseCutB).toEqual(cloneB);
  });
});
