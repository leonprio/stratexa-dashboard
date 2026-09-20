export type ContinuitySourceType = 'ACTIVITY_KPI' | 'SIMPLE_KPI';
export type ContinuityFrequency = 'monthly' | 'weekly';
export interface ContinuityTemporalPeriod {
  frequency: ContinuityFrequency;
  year: number;
  period: number;
}

export const temporalPeriodKey = ({ frequency, year, period }: ContinuityTemporalPeriod): string =>
  `${frequency}:${year}:${period}`;

/** Compares real calendar positions; never compare month/week indexes on their own. */
export const compareTemporalPeriods = (a: ContinuityTemporalPeriod, b: ContinuityTemporalPeriod): -1 | 0 | 1 => {
  if (a.frequency !== b.frequency) throw new Error('MIXED_CONTINUITY_FREQUENCY');
  if (a.year !== b.year) return a.year < b.year ? -1 : 1;
  if (a.period === b.period) return 0;
  return a.period < b.period ? -1 : 1;
};

export const sortTemporalPeriods = (periods: ContinuityTemporalPeriod[]): ContinuityTemporalPeriod[] =>
  [...periods].sort((a, b) => compareTemporalPeriods(a, b));
export type ContinuityStatus = 'active' | 'completed' | 'closed' | 'discarded';
export type ContinuityOutcome =
  | 'in_progress'
  | 'target_reached'
  | 'target_not_reached'
  | 'discarded';

export interface RescheduleRecord {
  id: string;
  fromYear: number;
  fromPeriod: number;
  toYear: number;
  toPeriod: number;
  at: string;
  status: 'active' | 'undone';
}

export interface ResolutionHistoryItem {
  id?: string;
  type: ContinuityEvent['type'];
  period?: number;
  year?: number;
  frequency?: ContinuityFrequency;
  fromPeriod?: number;
  toPeriod?: number;
  fromYear?: number;
  toYear?: number;
  value?: number;
  fromValue?: number;
  toValue?: number;
  previousValue?: number;
  reason?: string;
  at: string;
}

export type ContinuityEvent =
  | { type: 'CREATE_CONTINUITY'; commitment: ContinuityCommitment }
  | { type: 'RECORD_PROGRESS'; period: number; value: number; year?: number; frequency?: ContinuityFrequency }
  | { type: 'ADJUST_PERIOD_PROGRESS'; period: number; value: number; reason?: string; year?: number; frequency?: ContinuityFrequency }
  | { type: 'VOID_PERIOD_PROGRESS'; period: number; reason?: string; year?: number; frequency?: ContinuityFrequency }
  | { type: 'RESCHEDULE'; year: number; period: number }
  | { type: 'UNDO_RESCHEDULE' }
  | { type: 'VOID_AND_UNDO_RESCHEDULE'; reason?: string }
  | { type: 'COMPLETE' }
  | { type: 'CLOSE_UNMET' }
  | { type: 'DISCARD' }
  | { type: 'REOPEN' };

export interface ContinuityCommitment {
  id: string;
  sourceType: ContinuitySourceType;
  sourceKpiId: string;
  sourceActivityId?: string;
  originYear: number;
  originPeriod: number;
  originalTarget: number;
  scheduledYear: number;
  scheduledPeriod: number;
  /** Frequency is explicit for new records; absent records remain readable as monthly. */
  frequency?: ContinuityFrequency;
  progressByPeriod: Record<number, number>; // Progreso efectivo
  /** Canonical facts keyed by frequency/year/period. Legacy progressByPeriod remains read-only compatible. */
  progressByTemporalPeriod?: Record<string, number>;
  status: ContinuityStatus;
  outcome?: ContinuityOutcome;
  rescheduleHistory?: RescheduleRecord[];
  resolutionHistory: ResolutionHistoryItem[];
}

const commitmentFrequency = (c: ContinuityCommitment): ContinuityFrequency => c.frequency || 'monthly';
const scheduledTemporalPeriod = (c: ContinuityCommitment): ContinuityTemporalPeriod => ({
  frequency: commitmentFrequency(c), year: c.scheduledYear, period: c.scheduledPeriod,
});
const eventTemporalPeriod = (
  c: ContinuityCommitment,
  event: { period: number; year?: number; frequency?: ContinuityFrequency },
): ContinuityTemporalPeriod => ({
  frequency: event.frequency || commitmentFrequency(c),
  year: event.year ?? c.scheduledYear,
  period: event.period,
});

/**
 * Normalizes persisted facts without guessing a year. A legacy period can be
 * read only when the commitment's authoritative origin/schedule context
 * places it in one known year. Ambiguous cross-year legacy entries are left
 * out rather than silently being assigned to the wrong year.
 */
export const getTemporalProgressFacts = (c: ContinuityCommitment): Array<{ period: ContinuityTemporalPeriod; value: number }> => {
  const frequency = commitmentFrequency(c);
  const facts = new Map<string, { period: ContinuityTemporalPeriod; value: number }>();
  for (const [key, value] of Object.entries(c.progressByTemporalPeriod || {})) {
    const [factFrequency, rawYear, rawPeriod] = key.split(':');
    const year = Number(rawYear);
    const period = Number(rawPeriod);
    if ((factFrequency === 'monthly' || factFrequency === 'weekly') && Number.isFinite(year) && Number.isFinite(period)) {
      facts.set(key, { period: { frequency: factFrequency, year, period }, value: Number(value) || 0 });
    }
  }
  for (const [rawPeriod, rawValue] of Object.entries(c.progressByPeriod || {})) {
    const period = Number(rawPeriod);
    if (!Number.isFinite(period)) continue;
    let year: number | undefined;
    if (period === c.originPeriod) year = c.originYear;
    else {
      const rescheduleYears = [...new Set((c.rescheduleHistory || [])
        .filter((record) => record.toPeriod === period)
        .map((record) => record.toYear))];
      if (rescheduleYears.length === 1) year = rescheduleYears[0];
      else if (period === c.scheduledPeriod) year = c.scheduledYear;
      else if (c.scheduledYear === c.originYear) year = c.originYear;
    }
    if (year === undefined) continue;
    const temporal = { frequency, year, period } as ContinuityTemporalPeriod;
    const key = temporalPeriodKey(temporal);
    if (!facts.has(key)) facts.set(key, { period: temporal, value: Number(rawValue) || 0 });
  }
  return [...facts.values()];
};

const getProgressAt = (c: ContinuityCommitment, period: ContinuityTemporalPeriod): number | undefined =>
  getTemporalProgressFacts(c).find((fact) => compareTemporalPeriods(fact.period, period) === 0)?.value;

const setProgressFact = (
  next: ContinuityCommitment,
  state: ContinuityCommitment,
  period: ContinuityTemporalPeriod,
  value: number,
): void => {
  next.progressByTemporalPeriod![temporalPeriodKey(period)] = value;
  // Retain the legacy projection only where its year is unambiguous.
  if (period.year === state.originYear && state.scheduledYear === state.originYear) {
    next.progressByPeriod[period.period] = value;
  }
};

const clearProgressFact = (
  next: ContinuityCommitment,
  state: ContinuityCommitment,
  period: ContinuityTemporalPeriod,
): void => {
  delete next.progressByTemporalPeriod![temporalPeriodKey(period)];
  if (period.year === state.originYear && state.scheduledYear === state.originYear) {
    delete next.progressByPeriod[period.period];
  }
};

export const getPreviousCumulative = (c: ContinuityCommitment): number =>
  getTemporalProgressFacts(c)
    .filter((fact) => compareTemporalPeriods(fact.period, scheduledTemporalPeriod(c)) < 0)
    .reduce((sum, fact) => sum + fact.value, 0);

export const getCurrentPeriodProgress = (c: ContinuityCommitment): number =>
  getProgressAt(c, scheduledTemporalPeriod(c)) ?? 0;

export const getCumulativeProgress = (c: ContinuityCommitment): number =>
  getTemporalProgressFacts(c).reduce((sum, fact) => sum + fact.value, 0);

export const getRemainingTarget = (c: ContinuityCommitment): number =>
  Math.max(c.originalTarget - getCumulativeProgress(c), 0);

export const getFulfillmentPercent = (c: ContinuityCommitment): number =>
  c.originalTarget > 0 ? (getCumulativeProgress(c) / c.originalTarget) * 100 : 0;

export const isTargetReached = (c: ContinuityCommitment): boolean =>
  getCumulativeProgress(c) >= c.originalTarget && c.originalTarget > 0;

export const isCaptureComplete = (c: ContinuityCommitment, period?: number): boolean => {
  const targetPeriod = period ?? c.scheduledPeriod;
  return getProgressAt(c, { frequency: commitmentFrequency(c), year: c.scheduledYear, period: targetPeriod }) !== undefined;
};

export const getContinuitySnapshot = (c: ContinuityCommitment) => ({
  previousCumulative: getPreviousCumulative(c),
  currentPeriodProgress: getCurrentPeriodProgress(c),
  cumulativeProgress: getCumulativeProgress(c),
  remainingTarget: getRemainingTarget(c),
  fulfillmentPercent: getFulfillmentPercent(c),
  isTargetReached: isTargetReached(c),
  isCaptureComplete: isCaptureComplete(c),
});

export const formatResolutionHistoryItem = (
  item: ResolutionHistoryItem,
  monthNames: string[] = [
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre',
  ],
  unit: string = 'unidades'
): string => {
  const getMonth = (p?: number) =>
    p !== undefined && monthNames[p] ? monthNames[p] : `Periodo ${p}`;

  switch (item.type) {
    case 'CREATE_CONTINUITY':
      return `Compromiso iniciado`;
    case 'RESCHEDULE':
      return `Reprogramado de ${getMonth(item.fromPeriod)} a ${getMonth(item.toPeriod)}`;
    case 'RECORD_PROGRESS':
      return `Avance registrado en ${getMonth(item.period)}: +${item.value} ${unit}`;
    case 'ADJUST_PERIOD_PROGRESS':
      return `Avance corregido en ${getMonth(item.period)}: de ${item.fromValue} a ${item.toValue} ${unit}`;
    case 'VOID_PERIOD_PROGRESS':
      return `Avance de ${getMonth(item.period)} anulado: ${item.previousValue} ${unit}`;
    case 'UNDO_RESCHEDULE':
      return `Reprogramación deshecha: vuelve a ${getMonth(item.toPeriod)}`;
    case 'COMPLETE':
      return `Meta alcanzada y compromiso cerrado`;
    case 'CLOSE_UNMET':
      return `Seguimiento cerrado sin alcanzar la meta`;
    case 'DISCARD':
      return `Compromiso descartado`;
    case 'REOPEN':
      return `Compromiso reabierto`;
    default:
      return (item as any).type;
  }
};

export const reduceContinuity = (
  state: ContinuityCommitment,
  event: Exclude<ContinuityEvent, { type: 'CREATE_CONTINUITY' }>
): ContinuityCommitment => {
  const next: ContinuityCommitment = {
    ...state,
    progressByPeriod: { ...state.progressByPeriod },
    progressByTemporalPeriod: { ...(state.progressByTemporalPeriod || {}) },
    rescheduleHistory: [...(state.rescheduleHistory || [])],
    resolutionHistory: [...state.resolutionHistory],
  };

  const now = new Date().toISOString();

  // Terminal state protection: only REOPEN is allowed if not active
  if (state.status !== 'active' && event.type !== 'REOPEN') {
    throw new Error('TERMINAL_STATE');
  }

  switch (event.type) {
    case 'RECORD_PROGRESS': {
      if (typeof event.value !== 'number' || isNaN(event.value)) {
        throw new Error('INVALID_PROGRESS_VALUE');
      }
      if (event.value < 0) {
        throw new Error('NEGATIVE_PROGRESS');
      }
      const temporal = eventTemporalPeriod(state, event);
      setProgressFact(next, state, temporal, event.value);
      next.resolutionHistory.push({
        type: 'RECORD_PROGRESS',
        period: event.period,
        year: temporal.year,
        frequency: temporal.frequency,
        value: event.value,
        at: now,
      });
      break;
    }

    case 'ADJUST_PERIOD_PROGRESS': {
      if (typeof event.value !== 'number' || isNaN(event.value)) {
        throw new Error('INVALID_PROGRESS_VALUE');
      }
      if (event.value < 0) {
        throw new Error('NEGATIVE_PROGRESS');
      }
      const temporal = eventTemporalPeriod(state, event);
      const previousValue = getProgressAt(state, temporal) ?? 0;
      setProgressFact(next, state, temporal, event.value);
      next.resolutionHistory.push({
        type: 'ADJUST_PERIOD_PROGRESS',
        period: event.period,
        year: temporal.year,
        frequency: temporal.frequency,
        fromValue: previousValue,
        toValue: event.value,
        reason: event.reason,
        at: now,
      });
      break;
    }

    case 'VOID_PERIOD_PROGRESS': {
      const temporal = eventTemporalPeriod(state, event);
      const previousValue = getProgressAt(state, temporal) ?? 0;
      clearProgressFact(next, state, temporal);
      next.resolutionHistory.push({
        type: 'VOID_PERIOD_PROGRESS',
        period: event.period,
        year: temporal.year,
        frequency: temporal.frequency,
        previousValue,
        reason: event.reason,
        at: now,
      });
      break;
    }

    case 'RESCHEDULE': {
      if (compareTemporalPeriods(
        { frequency: commitmentFrequency(state), year: event.year, period: event.period },
        scheduledTemporalPeriod(state),
      ) <= 0) {
        throw new Error('INVALID_SCHEDULE');
      }

      const record: RescheduleRecord = {
        id: `r_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        fromYear: state.scheduledYear,
        fromPeriod: state.scheduledPeriod,
        toYear: event.year,
        toPeriod: event.period,
        at: now,
        status: 'active',
      };

      next.rescheduleHistory = [...(next.rescheduleHistory || []), record];
      next.scheduledYear = event.year;
      next.scheduledPeriod = event.period;
      next.resolutionHistory.push({
        type: 'RESCHEDULE',
        fromYear: record.fromYear,
        fromPeriod: record.fromPeriod,
        toYear: record.toYear,
        toPeriod: record.toPeriod,
        at: now,
      });
      break;
    }

    case 'UNDO_RESCHEDULE': {
      const activeReschedules = (next.rescheduleHistory || []).filter(
        (r) => r.status === 'active'
      );
      if (activeReschedules.length === 0) {
        throw new Error('NO_ACTIVE_RESCHEDULE');
      }

      const lastReschedule = activeReschedules[activeReschedules.length - 1];

      // Guard: If current scheduled period already has effective progress > 0
      const currentPeriodProgress = getProgressAt(state, scheduledTemporalPeriod(state));
      if (currentPeriodProgress !== undefined && currentPeriodProgress > 0) {
        throw new Error('UNDO_REQUIRES_CORRECTION');
      }

      // Mark that specific reschedule as undone
      next.rescheduleHistory = (next.rescheduleHistory || []).map((r) =>
        r.id === lastReschedule.id ? { ...r, status: 'undone' as const } : r
      );

      next.scheduledYear = lastReschedule.fromYear;
      next.scheduledPeriod = lastReschedule.fromPeriod;
      next.resolutionHistory.push({
        type: 'UNDO_RESCHEDULE',
        fromYear: lastReschedule.toYear,
        fromPeriod: lastReschedule.toPeriod,
        toYear: lastReschedule.fromYear,
        toPeriod: lastReschedule.fromPeriod,
        at: now,
      });
      break;
    }

    case 'VOID_AND_UNDO_RESCHEDULE': {
      const activeReschedules = (next.rescheduleHistory || []).filter(
        (r) => r.status === 'active'
      );
      if (activeReschedules.length === 0) {
        throw new Error('NO_ACTIVE_RESCHEDULE');
      }

      const lastReschedule = activeReschedules[activeReschedules.length - 1];
      const currentTemporal = scheduledTemporalPeriod(state);
      const previousValue = getProgressAt(state, currentTemporal) ?? 0;

      // 1. Anular progreso efectivo en el periodo actual
      clearProgressFact(next, state, currentTemporal);
      next.resolutionHistory.push({
        type: 'VOID_PERIOD_PROGRESS',
        period: state.scheduledPeriod,
        year: currentTemporal.year,
        frequency: currentTemporal.frequency,
        previousValue,
        reason: event.reason || 'Anulación por reversión de reprogramación',
        at: now,
      });

      // 2. Revertir la reprogramación
      next.rescheduleHistory = (next.rescheduleHistory || []).map((r) =>
        r.id === lastReschedule.id ? { ...r, status: 'undone' as const } : r
      );

      next.scheduledYear = lastReschedule.fromYear;
      next.scheduledPeriod = lastReschedule.fromPeriod;
      next.resolutionHistory.push({
        type: 'UNDO_RESCHEDULE',
        fromYear: lastReschedule.toYear,
        fromPeriod: lastReschedule.toPeriod,
        toYear: lastReschedule.fromYear,
        toPeriod: lastReschedule.fromPeriod,
        at: now,
      });
      break;
    }

    case 'COMPLETE': {
      const cumulative = getCumulativeProgress(state);
      if (cumulative < state.originalTarget) {
        throw new Error('CANNOT_COMPLETE_UNMET');
      }
      next.status = 'completed';
      next.outcome = 'target_reached';
      next.resolutionHistory.push({
        type: 'COMPLETE',
        at: now,
      });
      break;
    }

    case 'CLOSE_UNMET': {
      next.status = 'closed';
      next.outcome = 'target_not_reached';
      next.resolutionHistory.push({
        type: 'CLOSE_UNMET',
        at: now,
      });
      break;
    }

    case 'DISCARD': {
      next.status = 'discarded';
      next.outcome = 'discarded';
      next.resolutionHistory.push({
        type: 'DISCARD',
        at: now,
      });
      break;
    }

    case 'REOPEN': {
      next.status = 'active';
      next.outcome = 'in_progress';
      next.resolutionHistory.push({
        type: 'REOPEN',
        at: now,
      });
      break;
    }

    default:
      throw new Error(`UNKNOWN_EVENT_TYPE: ${(event as any).type}`);
  }

  return next;
};
