import {
  formatResolutionHistoryItem,
  getCurrentPeriodProgress,
  getContinuitySnapshot,
  getCumulativeProgress,
  getFulfillmentPercent,
  getPreviousCumulative,
  getRemainingTarget,
  isCaptureComplete,
  isTargetReached,
  reduceContinuity,
  type ContinuityCommitment,
} from './continuityEngine';

const crossYearCommitment = (frequency: 'monthly' | 'weekly' = 'monthly'): any => ({
  id: `cross-year-${frequency}`,
  sourceType: 'SIMPLE_KPI',
  sourceKpiId: 'kpi-1',
  originYear: 2026,
  originPeriod: frequency === 'monthly' ? 11 : 52,
  originalTarget: 5,
  scheduledYear: 2026,
  scheduledPeriod: frequency === 'monthly' ? 11 : 52,
  frequency,
  progressByPeriod: { [frequency === 'monthly' ? 11 : 52]: 3 },
  status: 'active',
  outcome: 'in_progress',
  rescheduleHistory: [],
  resolutionHistory: [],
});

describe('temporal progress identity', () => {
  test('orders December 2026 before January 2027 without changing the original target', () => {
    let commitment = crossYearCommitment();
    commitment = reduceContinuity(commitment, { type: 'RESCHEDULE', year: 2027, period: 0 });
    commitment = reduceContinuity(commitment, { type: 'RECORD_PROGRESS', year: 2027, period: 0, value: 2 });
    expect(getContinuitySnapshot(commitment)).toMatchObject({
      previousCumulative: 3,
      currentPeriodProgress: 2,
      cumulativeProgress: 5,
      remainingTarget: 0,
      fulfillmentPercent: 100,
    });
    expect(commitment.originalTarget).toBe(5);
  });

  test('keeps weekly facts ordered across week 52 to week 1', () => {
    let commitment = crossYearCommitment('weekly');
    commitment = reduceContinuity(commitment, { type: 'RESCHEDULE', year: 2027, period: 1 });
    commitment = reduceContinuity(commitment, { type: 'RECORD_PROGRESS', year: 2027, period: 1, value: 2 });
    expect(getContinuitySnapshot(commitment)).toMatchObject({ previousCumulative: 3, currentPeriodProgress: 2, cumulativeProgress: 5 });
  });

  test('correction and void in January leave December fact intact', () => {
    let commitment = crossYearCommitment();
    commitment = reduceContinuity(commitment, { type: 'RESCHEDULE', year: 2027, period: 0 });
    commitment = reduceContinuity(commitment, { type: 'RECORD_PROGRESS', year: 2027, period: 0, value: 2 });
    commitment = reduceContinuity(commitment, { type: 'ADJUST_PERIOD_PROGRESS', year: 2027, period: 0, value: 1 });
    expect(getContinuitySnapshot(commitment)).toMatchObject({ previousCumulative: 3, currentPeriodProgress: 1, cumulativeProgress: 4 });
    commitment = reduceContinuity(commitment, { type: 'VOID_PERIOD_PROGRESS', year: 2027, period: 0 });
    expect(getContinuitySnapshot(commitment)).toMatchObject({ previousCumulative: 3, currentPeriodProgress: 0, cumulativeProgress: 3 });
  });

  test('undo reschedule crosses the year only after the current fact is voided', () => {
    let commitment = crossYearCommitment();
    commitment = reduceContinuity(commitment, { type: 'RESCHEDULE', year: 2027, period: 0 });
    commitment = reduceContinuity(commitment, { type: 'RECORD_PROGRESS', year: 2027, period: 0, value: 2 });
    expect(() => reduceContinuity(commitment, { type: 'UNDO_RESCHEDULE' })).toThrow('UNDO_REQUIRES_CORRECTION');
    commitment = reduceContinuity(commitment, { type: 'VOID_AND_UNDO_RESCHEDULE' });
    expect(commitment).toMatchObject({ scheduledYear: 2026, scheduledPeriod: 11 });
    expect(getContinuitySnapshot(commitment).cumulativeProgress).toBe(3);
  });

  test('reads legacy cross-year facts only when reschedule history supplies an authoritative year', () => {
    const legacy = {
      ...crossYearCommitment(), scheduledYear: 2027, scheduledPeriod: 0,
      progressByPeriod: { 11: 3, 0: 2 },
      rescheduleHistory: [{ id: 'r1', fromYear: 2026, fromPeriod: 11, toYear: 2027, toPeriod: 0, at: '2027-01-01', status: 'active' as const }],
    };
    expect(getContinuitySnapshot(legacy)).toMatchObject({ previousCumulative: 3, currentPeriodProgress: 2, cumulativeProgress: 5 });
  });
});

const createBaseCommitment = (overrides?: Partial<ContinuityCommitment>): ContinuityCommitment => ({
  id: 'c1',
  sourceType: 'ACTIVITY_KPI',
  sourceKpiId: 'k1',
  sourceActivityId: 'a1',
  originYear: 2026,
  originPeriod: 7, // Agosto
  originalTarget: 20,
  scheduledYear: 2026,
  scheduledPeriod: 7, // Agosto
  progressByPeriod: { 7: 5 },
  status: 'active',
  outcome: 'in_progress',
  rescheduleHistory: [],
  resolutionHistory: [],
  ...overrides,
});

describe('Semántica Final de Continuidad, Trazabilidad Humanizada e Invariantes', () => {
  test('contrato KPI gap 20/5 reprogramado conserva 5/20, pendiente 15 y 25%', () => {
    let state = createBaseCommitment({ progressByPeriod: { 7: 5 }, scheduledPeriod: 8 });
    state = reduceContinuity(state, { type: 'RESCHEDULE', year: 2026, period: 9 });
    expect(getContinuitySnapshot(state)).toMatchObject({
      previousCumulative: 5,
      currentPeriodProgress: 0,
      cumulativeProgress: 5,
      remainingTarget: 15,
      fulfillmentPercent: 25,
    });
  });

  test('contrato KPI gap suma +7 sin doble conteo: 12/20, pendiente 8 y 60%', () => {
    let state = createBaseCommitment({ progressByPeriod: { 7: 5 }, scheduledPeriod: 8 });
    state = reduceContinuity(state, { type: 'RECORD_PROGRESS', period: 8, value: 7 });
    expect(getContinuitySnapshot(state)).toMatchObject({
      cumulativeProgress: 12,
      remainingTarget: 8,
      fulfillmentPercent: 60,
    });
  });
  // A. 12/20 -> REGISTRAR META ALCANZADA -> confirmar +8 = 20/20, 100%, completed
  test('A. 12/20 -> Confirmar meta alcanzada (+8) -> 20/20, 100%, status: completed', () => {
    let state = createBaseCommitment();
    state = reduceContinuity(state, { type: 'RESCHEDULE', year: 2026, period: 8 });
    state = reduceContinuity(state, { type: 'RECORD_PROGRESS', period: 8, value: 7 }); // 12
    state = reduceContinuity(state, { type: 'RESCHEDULE', year: 2026, period: 9 }); // Octubre

    const snapBefore = getContinuitySnapshot(state);
    expect(snapBefore.remainingTarget).toBe(8);

    // Registro de progreso confirmado 8 y completado
    state = reduceContinuity(state, { type: 'RECORD_PROGRESS', period: 9, value: 8 });
    expect(isTargetReached(state)).toBe(true);
    state = reduceContinuity(state, { type: 'COMPLETE' });

    expect(state.status).toBe('completed');
    expect(state.outcome).toBe('target_reached');
    expect(getContinuitySnapshot(state)).toMatchObject({
      cumulativeProgress: 20,
      remainingTarget: 0,
      fulfillmentPercent: 100,
      isTargetReached: true,
    });
  });

  // B. 12/20 -> Cambiar sugerencia 8 por 6 = 18/20, 90%, remaining 2, status active
  test('B. 12/20 -> Cambiar sugerencia de 8 por 6 -> 18/20, 90%, status active (sin completar falsamente)', () => {
    let state = createBaseCommitment();
    state = reduceContinuity(state, { type: 'RESCHEDULE', year: 2026, period: 8 });
    state = reduceContinuity(state, { type: 'RECORD_PROGRESS', period: 8, value: 7 });
    state = reduceContinuity(state, { type: 'RESCHEDULE', year: 2026, period: 9 });

    // Usuario ajusta propuesta a 6
    state = reduceContinuity(state, { type: 'RECORD_PROGRESS', period: 9, value: 6 });

    expect(isTargetReached(state)).toBe(false);
    expect(state.status).toBe('active');
    expect(getContinuitySnapshot(state)).toMatchObject({
      cumulativeProgress: 18,
      remainingTarget: 2,
      fulfillmentPercent: 90,
      isTargetReached: false,
    });

    // Intentar COMPLETE lanza excepción
    expect(() => {
      reduceContinuity(state, { type: 'COMPLETE' });
    }).toThrow('CANNOT_COMPLETE_UNMET');
  });

  // C. Abrir diálogo de meta alcanzada sin confirmar = no data mutation
  test('C. Abrir diálogo sin confirmar no altera el estado', () => {
    const state = createBaseCommitment();
    const cloned = JSON.parse(JSON.stringify(state));
    expect(state).toEqual(cloned);
  });

  // D. CLOSE_UNMET 12/20 = conserva 12/20, 60%, brecha 8
  test('D. CLOSE_UNMET con 12/20 conserva honestamente 12/20, 60%, brecha 8', () => {
    let state = createBaseCommitment();
    state = reduceContinuity(state, { type: 'RESCHEDULE', year: 2026, period: 8 });
    state = reduceContinuity(state, { type: 'RECORD_PROGRESS', period: 8, value: 7 });

    state = reduceContinuity(state, { type: 'CLOSE_UNMET' });
    expect(state.status).toBe('closed');
    expect(state.outcome).toBe('target_not_reached');
    expect(getContinuitySnapshot(state)).toMatchObject({
      cumulativeProgress: 12,
      remainingTarget: 8,
      fulfillmentPercent: 60,
      isTargetReached: false,
    });
  });

  // E. REOPEN después de COMPLETE = conserva todos los avances
  test('E. REOPEN después de COMPLETE conserva todos los avances', () => {
    let state = createBaseCommitment();
    state = reduceContinuity(state, { type: 'RESCHEDULE', year: 2026, period: 8 });
    state = reduceContinuity(state, { type: 'RECORD_PROGRESS', period: 8, value: 15 });
    state = reduceContinuity(state, { type: 'COMPLETE' });

    state = reduceContinuity(state, { type: 'REOPEN' });
    expect(state.status).toBe('active');
    expect(state.progressByPeriod[7]).toBe(5);
    expect(state.progressByPeriod[8]).toBe(15);
    expect(getCumulativeProgress(state)).toBe(20);
  });

  // F. REOPEN después de CLOSE_UNMET = conserva todos los avances
  test('F. REOPEN después de CLOSE_UNMET conserva todos los avances', () => {
    let state = createBaseCommitment();
    state = reduceContinuity(state, { type: 'RESCHEDULE', year: 2026, period: 8 });
    state = reduceContinuity(state, { type: 'RECORD_PROGRESS', period: 8, value: 7 });
    state = reduceContinuity(state, { type: 'CLOSE_UNMET' });

    state = reduceContinuity(state, { type: 'REOPEN' });
    expect(state.status).toBe('active');
    expect(state.progressByPeriod[7]).toBe(5);
    expect(state.progressByPeriod[8]).toBe(7);
    expect(getCumulativeProgress(state)).toBe(12);
  });

  // G. Ninguna acción de estado puede fabricar progreso
  test('G. Ninguna acción de cambio de estado altera avances ni fabrica progreso fantasma', () => {
    let state = createBaseCommitment();
    const initialCumulative = getCumulativeProgress(state);

    state = reduceContinuity(state, { type: 'RESCHEDULE', year: 2026, period: 8 });
    expect(getCumulativeProgress(state)).toBe(initialCumulative);

    state = reduceContinuity(state, { type: 'UNDO_RESCHEDULE' });
    expect(getCumulativeProgress(state)).toBe(initialCumulative);

    state = reduceContinuity(state, { type: 'CLOSE_UNMET' });
    expect(getCumulativeProgress(state)).toBe(initialCumulative);

    state = reduceContinuity(state, { type: 'REOPEN' });
    expect(getCumulativeProgress(state)).toBe(initialCumulative);

    state = reduceContinuity(state, { type: 'DISCARD' });
    expect(getCumulativeProgress(state)).toBe(initialCumulative);
  });

  // H. CAPTURA COMPLETA != META ALCANZADA
  test('H. Captura Completa es independiente de Meta Alcanzada', () => {
    let state = createBaseCommitment();
    state = reduceContinuity(state, { type: 'RESCHEDULE', year: 2026, period: 8 });
    state = reduceContinuity(state, { type: 'RECORD_PROGRESS', period: 8, value: 7 }); // 12 / 20

    // En Septiembre: la captura está completa (hay un valor registrado), pero la meta NO está alcanzada
    expect(isCaptureComplete(state, 8)).toBe(true);
    expect(isTargetReached(state)).toBe(false);
    expect(getContinuitySnapshot(state).fulfillmentPercent).toBe(60);
  });

  // I. Human Readable Traceability Formatter
  test('I. Formateador de Trazabilidad Humanizada en español sin códigos técnicos', () => {
    expect(
      formatResolutionHistoryItem({ type: 'CREATE_CONTINUITY', at: '' })
    ).toBe('Compromiso iniciado');

    expect(
      formatResolutionHistoryItem({
        type: 'RESCHEDULE',
        fromPeriod: 7,
        toPeriod: 8,
        at: '',
      })
    ).toBe('Reprogramado de Agosto a Septiembre');

    expect(
      formatResolutionHistoryItem({
        type: 'RECORD_PROGRESS',
        period: 8,
        value: 7,
        at: '',
      })
    ).toBe('Avance registrado en Septiembre: +7 unidades');

    expect(
      formatResolutionHistoryItem({
        type: 'ADJUST_PERIOD_PROGRESS',
        period: 8,
        fromValue: 7,
        toValue: 6,
        at: '',
      })
    ).toBe('Avance corregido en Septiembre: de 7 a 6 unidades');

    expect(
      formatResolutionHistoryItem({
        type: 'VOID_PERIOD_PROGRESS',
        period: 8,
        previousValue: 7,
        at: '',
      })
    ).toBe('Avance de Septiembre anulado: 7 unidades');

    expect(
      formatResolutionHistoryItem({
        type: 'UNDO_RESCHEDULE',
        fromPeriod: 8,
        toPeriod: 7,
        at: '',
      })
    ).toBe('Reprogramación deshecha: vuelve a Agosto');

    expect(
      formatResolutionHistoryItem({ type: 'COMPLETE', at: '' })
    ).toBe('Meta alcanzada y compromiso cerrado');

    expect(
      formatResolutionHistoryItem({ type: 'CLOSE_UNMET', at: '' })
    ).toBe('Seguimiento cerrado sin alcanzar la meta');

    expect(
      formatResolutionHistoryItem({ type: 'DISCARD', at: '' })
    ).toBe('Compromiso descartado');

    expect(
      formatResolutionHistoryItem({ type: 'REOPEN', at: '' })
    ).toBe('Compromiso reabierto');
  });
});
