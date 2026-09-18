import { applyContinuityEventToItem, continuityKey, getAvailableContinuityActions, getContinuityOperationalState, getEffectiveKpiProgressByPeriod, getIndividualCommitmentProjection, getOperationalContinuityCommitments, getRetiredContinuityCommitments, getVisibleContinuityState, syncCommitmentsWithActivityConfig } from './continuityAdapter';
import { derivePendingKpiActivities, deriveRescheduledKpiCommitments } from '../components/CurrentPeriodFocus';

const item: any = { id: 7, indicator: 'KPI', weight: 1, unit: 'u', type: 'accumulative', goalType: 'maximize', monthlyGoals: [0, 0, 0, 0, 0, 0, 0, 20], monthlyProgress: [0, 0, 0, 0, 0, 0, 0, 5], activityConfig: { 7: [{ id: 'a', label: 'Meta', targetCount: 10, completedCount: 4 }] } };
test('reschedule persists a canonical continuity commitment without writing legacy resolution', () => {
  const next = applyContinuityEventToItem(item, 'a', 7, 2026, false, { type: 'RESCHEDULE', year: 2026, period: 8 });
  expect(next.activityConfig).toEqual(item.activityConfig);
  expect(next.continuityCommitments?.[continuityKey('a')]).toMatchObject({ scheduledPeriod: 8, status: 'active' });
  expect(next.continuityCommitments?.[continuityKey('a')].resolutionHistory.at(-1)).toMatchObject({ type: 'RESCHEDULE', fromPeriod: 7, toPeriod: 8 });
});

test('projects previous, current and cumulative progress for the consulted period', () => {
  const source: any = {
    id: 9,
    activityConfig: { 7: [{ id: 'commitment', label: 'Compromiso', targetCount: 10, completedCount: 3 }] },
    continuityCommitments: {
      'activity:commitment': {
        id: 'activity:commitment', sourceType: 'ACTIVITY_KPI', sourceKpiId: '9', sourceActivityId: 'commitment',
        originYear: 2026, originPeriod: 7, originalTarget: 10, scheduledYear: 2026, scheduledPeriod: 8,
        progressByPeriod: { 7: 3, 8: 1 }, status: 'active', outcome: 'in_progress', rescheduleHistory: [], resolutionHistory: [],
      },
    },
  };
  const projection = getIndividualCommitmentProjection(source, 'commitment', 8);
  expect(projection.previousCumulativeProgress).toBe(3);
  expect(projection.currentPeriodProgress).toBe(1);
  expect(projection.cumulativeProgress).toBe(4);
  expect(projection.remaining).toBe(6);
  expect(projection.fulfillmentPercent).toBe(40);
});

test('distinguishes no capture from an explicit zero in the consulted period', () => {
  const source: any = {
    id: 10,
    activityConfig: { 7: [{ id: 'commitment', label: 'Compromiso', targetCount: 10, completedCount: 3 }] },
    continuityCommitments: {
      'activity:commitment': {
        id: 'activity:commitment', sourceType: 'ACTIVITY_KPI', sourceKpiId: '10', sourceActivityId: 'commitment',
        originYear: 2026, originPeriod: 7, originalTarget: 10, scheduledYear: 2026, scheduledPeriod: 8,
        progressByPeriod: { 7: 3 }, status: 'active', outcome: 'in_progress', rescheduleHistory: [], resolutionHistory: [],
      },
    },
  };
  expect(getIndividualCommitmentProjection(source, 'commitment', 8).currentPeriodProgress).toBeNull();
  source.continuityCommitments['activity:commitment'].progressByPeriod[8] = 0;
  expect(getIndividualCommitmentProjection(source, 'commitment', 8).currentPeriodProgress).toBe(0);
});
test('read projection prefers monthly KPI progress and uses canonical history only when monthly data is absent', () => {
  const source = { ...item, monthlyProgress: [0, 0, 0, 0, 0, 0, 0, null], continuityCommitments: { [continuityKey('a')]: {
    id: continuityKey('a'), sourceType: 'ACTIVITY_KPI', sourceKpiId: '7', sourceActivityId: 'a', originYear: 2026, originPeriod: 7, originalTarget: 20, scheduledYear: 2026, scheduledPeriod: 8, progressByPeriod: { 7: 5 }, status: 'active', outcome: 'in_progress', rescheduleHistory: [], resolutionHistory: [],
  } } } as any;
  expect(getEffectiveKpiProgressByPeriod(source, 7)).toBe(5);
  expect(getEffectiveKpiProgressByPeriod({ ...source, id: -100, sources: [{ itemId: 7 }], continuityCommitments: source.continuityCommitments }, 7)).toBe(5);
  expect(getEffectiveKpiProgressByPeriod({ ...source, monthlyProgress: [0, 0, 0, 0, 0, 0, 0, 4] }, 7)).toBe(4);
  expect(getEffectiveKpiProgressByPeriod(source, 8)).toBe(null);
});
test('uses activity target when present', () => {
  const next = applyContinuityEventToItem(item, 'a', 7, 2026, false, { type: 'RESCHEDULE', year: 2026, period: 8 });
  expect(next.continuityCommitments?.[continuityKey('a')].originalTarget).toBe(10);
});
test('materializes valid completedCount as historical activity progress', () => {
  const source = { ...item, activityConfig: { 7: [{ id: 'a', label: 'Meta', targetCount: 10, completedCount: 4 }] } };
  const next = applyContinuityEventToItem(source, 'a', 7, 2026, false, { type: 'RESCHEDULE', year: 2026, period: 8 });
  expect(next.continuityCommitments?.[continuityKey('a')].progressByPeriod).toEqual({ 7: 4 });
  expect(next.continuityCommitments?.[continuityKey('a')].scheduledPeriod).toBe(8);
});
test('canonical commitment wins over stale legacy data after reload', () => {
  const next = applyContinuityEventToItem(item, 'a', 7, 2026, false, { type: 'RESCHEDULE', year: 2026, period: 8 });
  expect(getVisibleContinuityState(JSON.parse(JSON.stringify(next)), 'a')).toMatchObject({ source: 'CANONICAL', commitment: { scheduledPeriod: 8 } });
  expect(getVisibleContinuityState(item, 'a').source).toBe('LEGACY_FALLBACK');
});
test('reconciles an empty persisted commitment from valid legacy completedCount', () => {
  const persisted = { ...item, activityConfig: { 7: [{ id: 'a', label: 'Meta', targetCount: 10, completedCount: 4 }] }, continuityCommitments: { [continuityKey('a')]: {
    id: continuityKey('a'), sourceType: 'ACTIVITY_KPI', sourceKpiId: '7', sourceActivityId: 'a',
    originYear: 2026, originPeriod: 7, originalTarget: 10, scheduledYear: 2026, scheduledPeriod: 8,
    progressByPeriod: {}, status: 'active', outcome: 'in_progress', rescheduleHistory: [], resolutionHistory: [],
  } } } as any;
  expect(getVisibleContinuityState(persisted, 'a').commitment?.progressByPeriod).toEqual({ 7: 4 });
});
test('shared action policy exposes undo only from canonical reschedule history', () => {
  const next = applyContinuityEventToItem(item, 'a', 7, 2026, false, { type: 'RESCHEDULE', year: 2026, period: 8 });
  expect(getAvailableContinuityActions(getVisibleContinuityState(next, 'a'))).toContain('UNDO_RESCHEDULE');
});
test('legacy active fallback retains executable actions before canonical materialization', () => {
  const actions = getAvailableContinuityActions(getVisibleContinuityState(item, 'a'));
  expect(actions).toEqual(expect.arrayContaining(['RESCHEDULE', 'COMPLETE', 'CLOSE_UNMET', 'DISCARD']));
});

test('retires a deleted August source from operational continuity while retaining its audit history', () => {
  const source: any = {
    ...item,
    activityConfig: {
      7: [{ id: 'activity-a', label: 'Establecer metas en Agosto', targetCount: 1, completedCount: 0 }],
      8: [{ id: 'activity-b-september', label: 'Agregar estrategia', targetCount: 8, completedCount: 0 }],
    },
    continuityCommitments: {
      'activity:activity-a': {
        id: 'activity:activity-a', sourceType: 'ACTIVITY_KPI', sourceKpiId: '7', sourceActivityId: 'activity-a', originYear: 2026, originPeriod: 7, originalTarget: 1, scheduledYear: 2026, scheduledPeriod: 7, progressByPeriod: {}, status: 'active', outcome: 'in_progress', rescheduleHistory: [], resolutionHistory: [],
      },
      'activity:activity-b-august': {
        id: 'activity:activity-b-august', sourceType: 'ACTIVITY_KPI', sourceKpiId: '7', sourceActivityId: 'activity-b-august', originYear: 2026, originPeriod: 7, originalTarget: 8, scheduledYear: 2026, scheduledPeriod: 8, progressByPeriod: { 7: 1 }, status: 'active', outcome: 'in_progress', rescheduleHistory: [{ id: 'r1', fromYear: 2026, fromPeriod: 7, toYear: 2026, toPeriod: 8, at: '2026-09-01', status: 'active' }], resolutionHistory: [{ type: 'CREATE_CONTINUITY', at: '2026-08-01' }],
      },
    },
  };

  const retired = source.continuityCommitments['activity:activity-b-august'];
  expect(getContinuityOperationalState(source, retired)).toBe('RETIRED_FROM_SOURCE');
  expect(getOperationalContinuityCommitments(source).map(c => c.id)).toEqual(['activity:activity-a']);
  expect(getRetiredContinuityCommitments(source)).toEqual([retired]);
  expect(getRetiredContinuityCommitments(source)[0].resolutionHistory).toEqual(retired.resolutionHistory);
  expect(deriveRescheduledKpiCommitments(source.activityConfig, 8, false, 2026, source)).toEqual([]);
  expect(derivePendingKpiActivities(source.activityConfig, 8, false, 2026, source).map(p => p.sourceActivityId)).not.toContain('activity-b-august');
  expect(source.activityConfig[8]).toHaveLength(1);
});

test('treats a zero-target origin residue as retired rather than an active source', () => {
  const source: any = {
    ...item,
    activityConfig: { 7: [{ id: 'activity-b', label: 'Agregar estrategia', targetCount: 0, completedCount: 0 }] },
    continuityCommitments: {
      'activity:activity-b': {
        id: 'activity:activity-b', sourceType: 'ACTIVITY_KPI', sourceKpiId: '7', sourceActivityId: 'activity-b', originYear: 2026, originPeriod: 7, originalTarget: 8, scheduledYear: 2026, scheduledPeriod: 8, progressByPeriod: {}, status: 'active', outcome: 'in_progress', rescheduleHistory: [], resolutionHistory: [{ type: 'CREATE_CONTINUITY', at: '2026-08-01' }],
      },
    },
  };
  expect(getContinuityOperationalState(source, source.continuityCommitments['activity:activity-b'])).toBe('RETIRED_FROM_SOURCE');
  expect(getOperationalContinuityCommitments(source)).toEqual([]);
  expect(getRetiredContinuityCommitments(source)).toHaveLength(1);
});

test('keeps a legitimate August-to-September reschedule operational when its source remains at origin', () => {
  const source: any = {
    ...item,
    activityConfig: { 7: [{ id: 'activity-b', label: 'Agregar estrategia', targetCount: 8, completedCount: 1 }] },
    continuityCommitments: {
      'activity:activity-b': {
        id: 'activity:activity-b', sourceType: 'ACTIVITY_KPI', sourceKpiId: '7', sourceActivityId: 'activity-b', originYear: 2026, originPeriod: 7, originalTarget: 8, scheduledYear: 2026, scheduledPeriod: 8, progressByPeriod: { 7: 1 }, status: 'active', outcome: 'in_progress', rescheduleHistory: [{ id: 'r1', fromYear: 2026, fromPeriod: 7, toYear: 2026, toPeriod: 8, at: '2026-09-01', status: 'active' }], resolutionHistory: [],
      },
    },
  };
  expect(getContinuityOperationalState(source, source.continuityCommitments['activity:activity-b'])).toBe('ACTIVE');
  expect(deriveRescheduledKpiCommitments(source.activityConfig, 8, false, 2026, source)).toHaveLength(1);
});

test('correction preserves individual activity progress in origin period instead of KPI aggregate', () => {
  const source = {
    ...item,
    monthlyProgress: [0, 0, 0, 0, 0, 0, 0, 5, 7],
    continuityCommitments: {
      [continuityKey('a')]: {
        id: continuityKey('a'), sourceType: 'ACTIVITY_KPI', sourceKpiId: '7', sourceActivityId: 'a',
        originYear: 2026, originPeriod: 7, originalTarget: 10, scheduledYear: 2026, scheduledPeriod: 8,
        progressByPeriod: { 7: 4, 8: 7 }, status: 'active', outcome: 'in_progress',
        rescheduleHistory: [], resolutionHistory: [],
      },
    },
  } as any;
  const corrected = applyContinuityEventToItem(source, 'a', 7, 2026, false, {
    type: 'ADJUST_PERIOD_PROGRESS', period: 8, value: 5,
  });
  const visible = getVisibleContinuityState({ ...corrected, monthlyProgress: source.monthlyProgress.map((v: number, i: number) => i === 8 ? 5 : v) }, 'a');
  expect(visible.commitment?.progressByPeriod).toEqual({ 7: 4, 8: 5 });
});

test('reschedule preserves corrected September progress and leaves October uncaptured', () => {
  const source = {
    ...item,
    monthlyProgress: [0, 0, 0, 0, 0, 0, 0, 5, 5],
    continuityCommitments: {
      [continuityKey('a')]: {
        id: continuityKey('a'), sourceType: 'ACTIVITY_KPI', sourceKpiId: '7', sourceActivityId: 'a',
        originYear: 2026, originPeriod: 7, originalTarget: 10, scheduledYear: 2026, scheduledPeriod: 8,
        progressByPeriod: { 7: 4, 8: 5 }, status: 'active', outcome: 'in_progress',
        rescheduleHistory: [], resolutionHistory: [],
      },
    },
  } as any;
  const next = applyContinuityEventToItem(source, 'a', 7, 2026, false, {
    type: 'RESCHEDULE', year: 2026, period: 9,
  });
  const commitment = next.continuityCommitments?.[continuityKey('a')];
  expect(commitment).toMatchObject({ scheduledPeriod: 9, status: 'active', progressByPeriod: { 7: 4, 8: 5 } });
  expect(commitment?.progressByPeriod[9]).toBeUndefined();
  expect(getAvailableContinuityActions(getVisibleContinuityState(next, 'a'))).toContain('UNDO_RESCHEDULE');
});

test('strictly avoids leaking KPI aggregate monthlyProgress to individual activities A (4) and B (1)', () => {
  const kpiWithTwoActivities: any = {
    id: 7,
    indicator: 'COMPROMISOS ESTRATÉGICOS CUMPLIDOS',
    monthlyGoals: [0, 0, 0, 0, 0, 0, 0, 20],
    monthlyProgress: [0, 0, 0, 0, 0, 0, 0, 5],
    activityConfig: {
      7: [
        { id: 'act-a', label: 'Establecer metas', targetCount: 10, completedCount: 4 },
        { id: 'act-b', label: 'Agregar estrategia', targetCount: 10, completedCount: 1 },
      ],
    },
  };

  const stateA = getVisibleContinuityState(kpiWithTwoActivities, 'act-a');
  const stateB = getVisibleContinuityState(kpiWithTwoActivities, 'act-b');

  expect(stateA.commitment?.originalTarget).toBe(10);
  expect(stateA.commitment?.progressByPeriod).toEqual({ 7: 4 });

  expect(stateB.commitment?.originalTarget).toBe(10);
  expect(stateB.commitment?.progressByPeriod).toEqual({ 7: 1 });

  // Explicit check that neither commitment has 5 or 20
  expect(stateA.commitment?.originalTarget).not.toBe(20);
  expect(stateA.commitment?.progressByPeriod[7]).not.toBe(5);
  expect(stateB.commitment?.originalTarget).not.toBe(20);
  expect(stateB.commitment?.progressByPeriod[7]).not.toBe(5);
});

test('Integrity base case and mutation test (9 -> 7 -> 9): single source of truth for targets and progress', () => {
  const itemBase: any = {
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

  // BASE CASE ASSERTIONS
  const projA = getIndividualCommitmentProjection(itemBase, 'act-a');
  expect(projA.target).toBe(9);
  expect(projA.cumulativeProgress).toBe(4);
  expect(projA.remaining).toBe(5);
  expect(projA.progressByPeriod[7]).toBe(4);
  expect(projA.progressByPeriod[8]).toBeUndefined();

  const projB = getIndividualCommitmentProjection(itemBase, 'act-b');
  expect(projB.target).toBe(8);
  expect(projB.cumulativeProgress).toBe(4); // 1 + 3 = 4
  expect(projB.remaining).toBe(4); // 8 - 4 = 4
  expect(projB.progressByPeriod[7]).toBe(1);
  expect(projB.progressByPeriod[8]).toBe(3);

  // KPI MASTER AGGREGATE
  const kpiTarget = itemBase.monthlyGoals[7];
  expect(kpiTarget).toBe(17);
  const kpiAug = itemBase.monthlyProgress[7];
  expect(kpiAug).toBe(5);
  const kpiSep = itemBase.monthlyProgress[8];
  expect(kpiSep).toBe(3);
  const kpiCumulative = kpiAug + kpiSep;
  expect(kpiCumulative).toBe(8);

  // MUTATION CASE: A targetCount 9 -> 7
  const mutatedActivityConfig = {
    7: [
      { id: 'act-a', label: 'Establecer metas en Agosto para todos los indicadores', targetCount: 7, completedCount: 4 },
      { id: 'act-b', label: 'Agregar al menos una estrategia o iniciativa por indicador', targetCount: 8, completedCount: 1 },
    ],
  };
  const syncedCommitments = syncCommitmentsWithActivityConfig(itemBase, mutatedActivityConfig);
  const mutatedGoals = [...itemBase.monthlyGoals];
  mutatedGoals[7] = 7 + 8; // 15
  const mutatedItem = {
    ...itemBase,
    activityConfig: mutatedActivityConfig,
    continuityCommitments: syncedCommitments,
    monthlyGoals: mutatedGoals,
  };

  const mutatedProjA = getIndividualCommitmentProjection(mutatedItem, 'act-a');
  expect(mutatedProjA.target).toBe(7);
  expect(mutatedProjA.cumulativeProgress).toBe(4);
  expect(mutatedProjA.remaining).toBe(3);

  const mutatedProjB = getIndividualCommitmentProjection(mutatedItem, 'act-b');
  expect(mutatedProjB.target).toBe(8);
  expect(mutatedProjB.cumulativeProgress).toBe(4);
  expect(mutatedProjB.remaining).toBe(4);
  expect(mutatedItem.monthlyGoals[7]).toBe(15);

  // RESTORE CASE: 7 -> 9
  const restoredActivityConfig = {
    7: [
      { id: 'act-a', label: 'Establecer metas en Agosto para todos los indicadores', targetCount: 9, completedCount: 4 },
      { id: 'act-b', label: 'Agregar al menos una estrategia o iniciativa por indicador', targetCount: 8, completedCount: 1 },
    ],
  };
  const restoredSyncedCommitments = syncCommitmentsWithActivityConfig(mutatedItem, restoredActivityConfig);
  const restoredGoals = [...itemBase.monthlyGoals];
  restoredGoals[7] = 9 + 8; // 17
  const restoredItem = {
    ...mutatedItem,
    activityConfig: restoredActivityConfig,
    continuityCommitments: restoredSyncedCommitments,
    monthlyGoals: restoredGoals,
  };

  const restoredProjA = getIndividualCommitmentProjection(restoredItem, 'act-a');
  expect(restoredProjA.target).toBe(9);
  expect(restoredProjA.cumulativeProgress).toBe(4);
  expect(restoredProjA.remaining).toBe(5);

  const restoredProjB = getIndividualCommitmentProjection(restoredItem, 'act-b');
  expect(restoredProjB.target).toBe(8);
  expect(restoredProjB.cumulativeProgress).toBe(4);
  expect(restoredProjB.remaining).toBe(4);
  expect(restoredItem.monthlyGoals[7]).toBe(17);

  // Assert distinct identities & no cross-leaks
  expect(restoredProjA.sourceActivityId).not.toEqual(restoredProjB.sourceActivityId);
  expect(restoredProjA.progressByPeriod[8]).toBeUndefined();
  expect(restoredProjB.progressByPeriod[8]).toBe(3);
});

test('Strict non-contamination: individual progress is decoupled from KPI aggregate and between commitments', () => {
  // Fixture: KPI has monthlyProgress [..., 5, 3], but A has completedCount=4, B has completedCount=1 and Sep=3
  const fixture: any = {
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
    // Contaminated input in continuityCommitments with legacy 5
    continuityCommitments: {
      'activity:act-a': {
        id: 'activity:act-a', sourceType: 'ACTIVITY_KPI', sourceKpiId: '7', sourceActivityId: 'act-a',
        originYear: 2026, originPeriod: 7, originalTarget: 9, scheduledYear: 2026, scheduledPeriod: 7,
        progressByPeriod: { 7: 5 }, status: 'active', outcome: 'in_progress',
        rescheduleHistory: [], resolutionHistory: [],
      },
      'activity:act-b': {
        id: 'activity:act-b', sourceType: 'ACTIVITY_KPI', sourceKpiId: '7', sourceActivityId: 'act-b',
        originYear: 2026, originPeriod: 7, originalTarget: 8, scheduledYear: 2026, scheduledPeriod: 8,
        progressByPeriod: { 7: 5, 8: 3 }, status: 'active', outcome: 'in_progress',
        rescheduleHistory: [{ id: 'r1', fromYear: 2026, fromPeriod: 7, toYear: 2026, toPeriod: 8, at: '2026-09-17', status: 'active' }],
        resolutionHistory: [{ type: 'CREATE_CONTINUITY', at: '2026-09-17' }, { type: 'RECORD_PROGRESS', period: 8, value: 3, at: '2026-09-17' }],
      },
    },
  };

  const a = getIndividualCommitmentProjection(fixture, 'act-a');
  const b = getIndividualCommitmentProjection(fixture, 'act-b');

  // Positive assertions
  expect(a.progressByPeriod[7]).toBe(4);
  expect(a.progressByPeriod[8]).toBeUndefined();
  expect(a.cumulativeProgress).toBe(4);
  expect(a.remaining).toBe(5);

  expect(b.progressByPeriod[7]).toBe(1);
  expect(b.progressByPeriod[8]).toBe(3);
  expect(b.cumulativeProgress).toBe(4);
  expect(b.remaining).toBe(4);

  const kpiAug = fixture.monthlyProgress[7];
  const kpiSep = fixture.monthlyProgress[8];
  expect(kpiAug).toBe(5);
  expect(kpiSep).toBe(3);
  expect(kpiAug + kpiSep).toBe(8);

  // Negative assertions
  expect(a.progressByPeriod[7]).not.toBe(fixture.monthlyProgress[7]); // 4 != 5
  expect(b.progressByPeriod[7]).not.toBe(fixture.monthlyProgress[7]); // 1 != 5
  expect(a.progressByPeriod[8]).not.toBe(b.progressByPeriod[8]);       // undefined != 3
  expect(a.cumulativeProgress).not.toBe(fixture.monthlyProgress[7]);  // 4 != 5
  expect(b.cumulativeProgress).not.toBe(kpiAug + kpiSep);             // 4 != 8
});

describe('authoritative commitment projection regression suite', () => {
  test('A) commitment born and active in the same month', () => {
    const itemA: any = {
      id: 11,
      activityConfig: { 7: [{ id: 'act-same', label: 'Mismo mes', targetCount: 10, completedCount: 3 }] },
    };
    const proj = getIndividualCommitmentProjection(itemA, 'act-same');
    expect(proj.originPeriod).toBe(7);
    expect(proj.scheduledPeriod).toBe(7);
    expect(proj.previousCumulativeProgress).toBe(0);
    expect(proj.currentPeriodProgress).toBe(3);
    expect(proj.cumulativeProgress).toBe(3);
    expect(proj.remaining).toBe(7);
    expect(proj.fulfillmentPercent).toBe(30);
  });

  test('B) rescheduled commitment uses new period as projectionPeriod', () => {
    const itemB: any = {
      id: 12,
      activityConfig: { 7: [{ id: 'act-resched', label: 'Reprogramado', targetCount: 10, completedCount: 3 }] },
      continuityCommitments: {
        'activity:act-resched': {
          id: 'activity:act-resched', sourceType: 'ACTIVITY_KPI', sourceKpiId: '12', sourceActivityId: 'act-resched',
          originYear: 2026, originPeriod: 7, originalTarget: 10, scheduledYear: 2026, scheduledPeriod: 8,
          progressByPeriod: { 7: 3, 8: 1 }, status: 'active', outcome: 'in_progress',
          rescheduleHistory: [], resolutionHistory: [],
        },
      },
    };
    const proj = getIndividualCommitmentProjection(itemB, 'act-resched');
    expect(proj.originPeriod).toBe(7);
    expect(proj.scheduledPeriod).toBe(8);
    expect(proj.previousCumulativeProgress).toBe(3);
    expect(proj.currentPeriodProgress).toBe(1);
    expect(proj.cumulativeProgress).toBe(4);
    expect(proj.remaining).toBe(6);
    expect(proj.fulfillmentPercent).toBe(40);
  });

  test('C) two reschedules uses the latest scheduledPeriod', () => {
    const itemC: any = {
      id: 13,
      activityConfig: { 7: [{ id: 'act-2resched', label: 'Doble reprogramación', targetCount: 10, completedCount: 3 }] },
      continuityCommitments: {
        'activity:act-2resched': {
          id: 'activity:act-2resched', sourceType: 'ACTIVITY_KPI', sourceKpiId: '13', sourceActivityId: 'act-2resched',
          originYear: 2026, originPeriod: 7, originalTarget: 10, scheduledYear: 2026, scheduledPeriod: 9,
          progressByPeriod: { 7: 3, 8: 2, 9: 1 }, status: 'active', outcome: 'in_progress',
          rescheduleHistory: [], resolutionHistory: [],
        },
      },
    };
    const proj = getIndividualCommitmentProjection(itemC, 'act-2resched');
    expect(proj.scheduledPeriod).toBe(9);
    expect(proj.previousCumulativeProgress).toBe(5); // 3 + 2
    expect(proj.currentPeriodProgress).toBe(1);
    expect(proj.cumulativeProgress).toBe(6); // 5 + 1
    expect(proj.remaining).toBe(4);
    expect(proj.fulfillmentPercent).toBe(60);
  });

  test('D) missing progress in scheduledPeriod yields currentPeriodProgress = null', () => {
    const itemD: any = {
      id: 14,
      activityConfig: { 7: [{ id: 'act-nocap', label: 'Sin captura', targetCount: 10, completedCount: 3 }] },
      continuityCommitments: {
        'activity:act-nocap': {
          id: 'activity:act-nocap', sourceType: 'ACTIVITY_KPI', sourceKpiId: '14', sourceActivityId: 'act-nocap',
          originYear: 2026, originPeriod: 7, originalTarget: 10, scheduledYear: 2026, scheduledPeriod: 8,
          progressByPeriod: { 7: 3 }, status: 'active', outcome: 'in_progress',
          rescheduleHistory: [], resolutionHistory: [],
        },
      },
    };
    const proj = getIndividualCommitmentProjection(itemD, 'act-nocap');
    expect(proj.currentPeriodProgress).toBeNull();
    expect(proj.previousCumulativeProgress).toBe(3);
    expect(proj.cumulativeProgress).toBe(3);
  });

  test('E) explicit zero progress in scheduledPeriod yields currentPeriodProgress = 0', () => {
    const itemE: any = {
      id: 15,
      activityConfig: { 7: [{ id: 'act-zero', label: 'Cero explicito', targetCount: 10, completedCount: 3 }] },
      continuityCommitments: {
        'activity:act-zero': {
          id: 'activity:act-zero', sourceType: 'ACTIVITY_KPI', sourceKpiId: '15', sourceActivityId: 'act-zero',
          originYear: 2026, originPeriod: 7, originalTarget: 10, scheduledYear: 2026, scheduledPeriod: 8,
          progressByPeriod: { 7: 3, 8: 0 }, status: 'active', outcome: 'in_progress',
          rescheduleHistory: [], resolutionHistory: [],
        },
      },
    };
    const proj = getIndividualCommitmentProjection(itemE, 'act-zero');
    expect(proj.currentPeriodProgress).toBe(0);
    expect(proj.previousCumulativeProgress).toBe(3);
    expect(proj.cumulativeProgress).toBe(3);
  });
});
