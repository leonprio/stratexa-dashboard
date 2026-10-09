import {
  buildControlCutId,
  buildControlCutSnapshot,
} from './controlCutBuilder';
import type { BuildControlCutParams, ControlCut } from '../types/controlCut';

describe('ControlCutBuilder Pure Tests', () => {
  const baseParams: BuildControlCutParams = {
    clientId: 'IPS',
    dashboardId: 'board-1',
    dashboardIds: ['board-1', 'board-2'],
    periodicity: 'monthly',
    year: 2026,
    periodIndex: 3, // Abril
    capturedByUserId: 'usr-123',
    capturedByLabel: 'Gerente General',
    kpis: [
      {
        indicatorId: 'kpi-1',
        label: 'Margen EBITDA',
        goal: 100,
        progress: 95,
        pending: 5,
        compliance: 95,
        frequency: 'monthly',
        goalCaptured: true,
        progressCaptured: true,
        dashboardId: 'board-1',
        area: 'FINANZAS',
      },
    ],
    controlSummary: {
      pendingConfigurationsCount: 1,
      pendingCapturesCount: 2,
      overdueActionsCount: 0,
      upcomingActionsCount: 3,
      activeActionsCount: 4,
      completedActionsCount: 5,
      pendingReviewsCount: 1,
      derivedAttentionCount: 2,
    },
    actionPlans: [
      {
        id: 'plan-1',
        indicatorId: 'kpi-1',
        dashboardId: 'board-1',
        clientId: 'IPS',
        title: 'Optimización de Costos',
        originYear: 2026,
        originPeriodType: 'monthly',
        originPeriodIndex: 3,
        status: 'in_progress',
        responsible: 'Juan Pérez',
        responsibleUserId: 'usr-juan',
        startDate: '2026-04-01',
        targetDate: '2026-04-30',
        progress: 50,
        createdAt: '2026-04-01T08:00:00Z',
        updatedAt: '2026-04-15T10:00:00Z',
        activities: [
          {
            id: 'act-1',
            title: 'Negociar proveedores',
            responsible: 'Juan Pérez',
            responsibleUserId: 'usr-juan',
            progress: 100,
            createdAt: '2026-04-01T08:00:00Z',
            updatedAt: '2026-04-10T12:00:00Z',
          },
        ],
        reviews: [
          {
            id: 'rev-1',
            planId: 'plan-1',
            reviewedAt: '2026-04-15T10:00:00Z',
            reviewedByUserId: 'usr-123',
            reviewedByLabel: 'Gerente General',
            observedResult: 'Reducción de costos en 5%',
            effect: 'FAVORABLE',
            decision: 'CONTINUE',
            evidenceRef: 'https://docs.google.com/evidence/1',
            nextCommitmentPlanId: 'plan-2',
            nextCommitmentActivityId: 'act-2',
          },
        ],
        nextCommitmentPlanId: 'plan-2',
        nextCommitmentActivityId: 'act-2',
      },
    ],
  };

  it('generates deterministic and canonical cutId for monthly and weekly periods', () => {
    const monthlyCutId = buildControlCutId('ips', 'board-1', 'monthly', 2026, 3);
    expect(monthlyCutId).toBe('IPS_board-1_M_2026_3');

    const weeklyCutId = buildControlCutId(' ips ', 'board-weekly', 'weekly', 2026, 14);
    expect(weeklyCutId).toBe('IPS_board-weekly_W_2026_14');
  });

  it('builds an immutable snapshot with schemaVersion 1 and deep copies', () => {
    const cut = buildControlCutSnapshot(baseParams);

    expect(cut.cutId).toBe('IPS_board-1_M_2026_3');
    expect(cut.schemaVersion).toBe(1);
    expect(cut.clientId).toBe('IPS');
    expect(cut.dashboardId).toBe('board-1');
    expect(cut.dashboardIds).toEqual(['board-1', 'board-2']);
    expect(cut.periodicity).toBe('monthly');
    expect(cut.year).toBe(2026);
    expect(cut.periodIndex).toBe(3);
    expect(cut.capturedByUserId).toBe('usr-123');
    expect(cut.capturedByLabel).toBe('Gerente General');

    expect(cut.kpis).toHaveLength(1);
    expect(cut.kpis[0].label).toBe('Margen EBITDA');
    expect(cut.kpis[0].compliance).toBe(95);

    expect(cut.controlSummary.pendingCapturesCount).toBe(2);
    expect(cut.actionPlans).toHaveLength(1);
    expect(cut.actionPlans[0].activities).toHaveLength(1);
    expect(cut.actionPlans[0].reviews).toHaveLength(1);
    expect(cut.actionPlans[0].nextCommitmentPlanId).toBe('plan-2');
    expect(cut.reviews).toHaveLength(1);
    expect(cut.reviews[0].observedResult).toBe('Reducción de costos en 5%');
    expect(cut.reviews[0].evidenceRef).toBe('https://docs.google.com/evidence/1');
  });

  it('is completely decoupled from subsequent mutations to input objects', () => {
    const paramsCopy = JSON.parse(JSON.stringify(baseParams));
    const cut = buildControlCutSnapshot(paramsCopy);

    // Mutate original input objects
    paramsCopy.kpis[0].compliance = 20;
    paramsCopy.kpis[0].label = 'Mutated Label';
    paramsCopy.actionPlans[0].progress = 100;
    paramsCopy.actionPlans[0].activities[0].progress = 0;
    paramsCopy.actionPlans[0].reviews[0].decision = 'CLOSE';

    // Verify snapshot values remain unchanged
    expect(cut.kpis[0].compliance).toBe(95);
    expect(cut.kpis[0].label).toBe('Margen EBITDA');
    expect(cut.actionPlans[0].progress).toBe(50);
    expect(cut.actionPlans[0].activities[0].progress).toBe(100);
    expect(cut.actionPlans[0].reviews[0].decision).toBe('CONTINUE');
  });

  it('handles legacy or missing optional fields safely with default fallback', () => {
    const minimal = buildControlCutSnapshot({
      clientId: 'IPS',
      dashboardId: 10,
      periodicity: 'monthly',
      year: 2026,
      periodIndex: 0,
      capturedByLabel: '',
      kpis: [],
      controlSummary: {} as any,
      actionPlans: [],
    });

    expect(minimal.cutId).toBe('IPS_10_M_2026_0');
    expect(minimal.capturedByLabel).toBe('Sistema');
    expect(minimal.dashboardIds).toEqual(['10']);
    expect(minimal.kpis).toEqual([]);
    expect(minimal.actionPlans).toEqual([]);
    expect(minimal.reviews).toEqual([]);
    expect(minimal.controlSummary.pendingCapturesCount).toBe(0);
  });

  it('associates snapshot reviews with the cutId without mutating the original review object', () => {
    const originalReview = {
      id: 'rev-legacy',
      planId: 'plan-1',
      reviewedAt: '2026-04-10T10:00:00Z',
      reviewedByLabel: 'Auditor',
      observedResult: 'Sin novedades',
      effect: 'FAVORABLE' as const,
      decision: 'CONTINUE' as const,
      // cutId is undefined initially
    };

    const cut = buildControlCutSnapshot({
      clientId: 'IPS',
      dashboardId: 'board-1',
      periodicity: 'monthly',
      year: 2026,
      periodIndex: 3,
      capturedByLabel: 'Director',
      kpis: [],
      controlSummary: {
        pendingConfigurationsCount: 0,
        pendingCapturesCount: 0,
        overdueActionsCount: 0,
        upcomingActionsCount: 0,
        activeActionsCount: 0,
        completedActionsCount: 0,
        pendingReviewsCount: 0,
        derivedAttentionCount: 0,
      },
      actionPlans: [],
      reviews: [originalReview],
    });

    // Original review remains untouched
    expect((originalReview as any).cutId).toBeUndefined();

    // Snapshot review has cutId assigned
    expect(cut.reviews[0].cutId).toBe('IPS_board-1_M_2026_3');
  });

  it('preserves nextCommitment snapshot representation even if live successor changes later', () => {
    const liveSuccessorActivity = {
      type: 'activity' as const,
      id: 'act-successor-99',
      title: 'Auditoría externa inicial',
      responsible: 'Carlos Ruiz',
      responsibleUserId: 'usr-carlos',
      targetDate: '2026-05-15',
      status: 'pending',
      progress: 0,
    };

    const reviewWithSuccessor = {
      id: 'rev-2',
      planId: 'plan-1',
      reviewedAt: '2026-04-20T10:00:00Z',
      reviewedByLabel: 'Gerente',
      observedResult: 'Compromiso creado',
      effect: 'FAVORABLE' as const,
      decision: 'CONTINUE' as const,
      nextCommitmentActivityId: 'act-successor-99',
      nextCommitment: { ...liveSuccessorActivity },
    };

    const cut = buildControlCutSnapshot({
      clientId: 'IPS',
      dashboardId: 'board-1',
      periodicity: 'monthly',
      year: 2026,
      periodIndex: 3,
      capturedByLabel: 'Director',
      kpis: [],
      controlSummary: {
        pendingConfigurationsCount: 0,
        pendingCapturesCount: 0,
        overdueActionsCount: 0,
        upcomingActionsCount: 0,
        activeActionsCount: 0,
        completedActionsCount: 0,
        pendingReviewsCount: 0,
        derivedAttentionCount: 0,
      },
      actionPlans: [
        {
          id: 'plan-1',
          indicatorId: 'kpi-1',
          dashboardId: 'board-1',
          title: 'Plan con sucesor',
          originYear: 2026,
          originPeriodType: 'monthly',
          status: 'in_progress',
          startDate: '2026-04-01',
          progress: 50,
          createdAt: '2026-04-01T00:00:00Z',
          updatedAt: '2026-04-01T00:00:00Z',
          activities: [],
          reviews: [reviewWithSuccessor],
          nextCommitmentActivityId: 'act-successor-99',
          nextCommitment: { ...liveSuccessorActivity },
        },
      ],
    });

    // Mutate the live successor activity after cut creation
    liveSuccessorActivity.title = 'Auditoría cancelada y redefinida';
    liveSuccessorActivity.responsible = 'Otro responsable';
    liveSuccessorActivity.progress = 100;

    // Verify cut snapshot retains the original commitment snapshot
    expect(cut.reviews[0].nextCommitment?.title).toBe('Auditoría externa inicial');
    expect(cut.reviews[0].nextCommitment?.responsible).toBe('Carlos Ruiz');
    expect(cut.reviews[0].nextCommitment?.progress).toBe(0);

    expect(cut.actionPlans[0].nextCommitment?.title).toBe('Auditoría externa inicial');
    expect(cut.actionPlans[0].nextCommitment?.responsible).toBe('Carlos Ruiz');
  });

  it('verifies document size remains well within Firestore limits for realistic heavy dashboard', () => {
    // Realistic heavy dashboard: 50 KPIs, 30 ActionPlans with 5 activities each and 2 reviews each
    const heavyKpis = Array.from({ length: 50 }, (_, i) => ({
      indicatorId: `kpi-${i + 1}`,
      label: `Indicador Clave de Rendimiento ${i + 1} - Operaciones y Finanzas`,
      goal: 1000,
      progress: 920,
      pending: 80,
      compliance: 92,
      frequency: 'monthly' as const,
      goalCaptured: true,
      progressCaptured: true,
      dashboardId: 'board-heavy',
      area: `AREA_${(i % 5) + 1}`,
    }));

    const heavyPlans = Array.from({ length: 30 }, (_, p) => ({
      id: `plan-${p + 1}`,
      indicatorId: `kpi-${(p % 50) + 1}`,
      dashboardId: 'board-heavy',
      clientId: 'IPS',
      title: `Plan de Acción Correctivo y Preventivo para Optimización de Procesos #${p + 1}`,
      description: `Descripción detallada de la estrategia de mitigación de desviación operativa número ${p + 1}`,
      originYear: 2026,
      originPeriodType: 'monthly' as const,
      originPeriodIndex: 3,
      status: 'in_progress' as const,
      responsible: `Líder Operativo ${p + 1}`,
      responsibleUserId: `usr-${p + 1}`,
      startDate: '2026-04-01',
      targetDate: '2026-04-30',
      progress: 60,
      expectedImpact: 'Recuperar el cumplimiento de meta a >95%',
      createdAt: '2026-04-01T08:00:00Z',
      updatedAt: '2026-04-15T10:00:00Z',
      activities: Array.from({ length: 5 }, (_, a) => ({
        id: `act-${p + 1}-${a + 1}`,
        title: `Actividad técnica programada número ${a + 1} del plan ${p + 1}`,
        responsible: `Ejecutor ${a + 1}`,
        responsibleUserId: `usr-act-${a + 1}`,
        targetDate: '2026-04-25',
        progress: 80,
        result: 'Avance conforme a lo planificado',
        impact: 'FAVORABLE',
        createdAt: '2026-04-02T08:00:00Z',
        updatedAt: '2026-04-18T12:00:00Z',
      })),
      reviews: [
        {
          id: `rev-${p + 1}-1`,
          planId: `plan-${p + 1}`,
          reviewedAt: '2026-04-15T10:00:00Z',
          reviewedByUserId: 'usr-eval',
          reviewedByLabel: 'Comité de Dirección',
          observedResult: 'Avance del 60% observado en campo con reducción del desvío',
          effect: 'FAVORABLE' as const,
          decision: 'CONTINUE' as const,
          evidenceRef: `https://storage.stratexa.com/evidence/eval-${p + 1}.pdf`,
          nextReviewDate: '2026-05-15',
          nextCommitmentActivityId: `act-${p + 1}-5`,
          nextCommitment: {
            type: 'activity' as const,
            id: `act-${p + 1}-5`,
            title: `Actividad técnica programada número 5 del plan ${p + 1}`,
            responsible: 'Ejecutor 5',
            targetDate: '2026-04-25',
            progress: 80,
          },
        },
      ],
    }));

    const heavyCut = buildControlCutSnapshot({
      clientId: 'IPS',
      dashboardId: 'board-heavy',
      dashboardIds: ['board-heavy'],
      periodicity: 'monthly',
      year: 2026,
      periodIndex: 3,
      capturedByUserId: 'usr-admin',
      capturedByLabel: 'Director General',
      kpis: heavyKpis,
      controlSummary: {
        pendingConfigurationsCount: 2,
        pendingCapturesCount: 4,
        overdueActionsCount: 1,
        upcomingActionsCount: 10,
        activeActionsCount: 25,
        completedActionsCount: 15,
        pendingReviewsCount: 3,
        derivedAttentionCount: 5,
      },
      actionPlans: heavyPlans,
    });

    const serialized = JSON.stringify(heavyCut);
    const sizeBytes = Buffer.byteLength(serialized, 'utf8');
    const sizeKB = sizeBytes / 1024;
    console.log(`[REALISTIC_FIXTURE_SIZE] bytes=${sizeBytes}, KB=${sizeKB.toFixed(2)}`);

    // Report and assert size is reasonable (< 150 KB, well below 1048 KB Firestore limit)
    expect(sizeKB).toBeLessThan(150);
    expect(heavyCut.kpis).toHaveLength(50);
    expect(heavyCut.actionPlans).toHaveLength(30);
    expect(heavyCut.reviews).toHaveLength(30);
    expect(heavyCut.reviews[0].cutId).toBe('IPS_board-heavy_M_2026_3');
  });
});
