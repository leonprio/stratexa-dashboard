export type ContinuitySourceType = 'ACTIVITY_KPI' | 'SIMPLE_KPI';
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
  | { type: 'RECORD_PROGRESS'; period: number; value: number }
  | { type: 'ADJUST_PERIOD_PROGRESS'; period: number; value: number; reason?: string }
  | { type: 'VOID_PERIOD_PROGRESS'; period: number; reason?: string }
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
  progressByPeriod: Record<number, number>; // Progreso efectivo
  status: ContinuityStatus;
  outcome?: ContinuityOutcome;
  rescheduleHistory?: RescheduleRecord[];
  resolutionHistory: ResolutionHistoryItem[];
}

export const getPreviousCumulative = (c: ContinuityCommitment): number =>
  Object.entries(c.progressByPeriod)
    .filter(([period]) => Number(period) < c.scheduledPeriod)
    .reduce((sum, [, value]) => sum + (typeof value === 'number' && !isNaN(value) ? value : 0), 0);

export const getCurrentPeriodProgress = (c: ContinuityCommitment): number =>
  c.progressByPeriod[c.scheduledPeriod] ?? 0;

export const getCumulativeProgress = (c: ContinuityCommitment): number =>
  Object.values(c.progressByPeriod).reduce(
    (sum, value) => sum + (typeof value === 'number' && !isNaN(value) ? value : 0),
    0
  );

export const getRemainingTarget = (c: ContinuityCommitment): number =>
  Math.max(c.originalTarget - getCumulativeProgress(c), 0);

export const getFulfillmentPercent = (c: ContinuityCommitment): number =>
  c.originalTarget > 0 ? (getCumulativeProgress(c) / c.originalTarget) * 100 : 0;

export const isTargetReached = (c: ContinuityCommitment): boolean =>
  getCumulativeProgress(c) >= c.originalTarget && c.originalTarget > 0;

export const isCaptureComplete = (c: ContinuityCommitment, period?: number): boolean => {
  const targetPeriod = period ?? c.scheduledPeriod;
  return c.progressByPeriod[targetPeriod] !== undefined;
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
      next.progressByPeriod[event.period] = event.value;
      next.resolutionHistory.push({
        type: 'RECORD_PROGRESS',
        period: event.period,
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
      const previousValue = state.progressByPeriod[event.period] ?? 0;
      next.progressByPeriod[event.period] = event.value;
      next.resolutionHistory.push({
        type: 'ADJUST_PERIOD_PROGRESS',
        period: event.period,
        fromValue: previousValue,
        toValue: event.value,
        reason: event.reason,
        at: now,
      });
      break;
    }

    case 'VOID_PERIOD_PROGRESS': {
      const previousValue = state.progressByPeriod[event.period] ?? 0;
      next.progressByPeriod[event.period] = 0;
      next.resolutionHistory.push({
        type: 'VOID_PERIOD_PROGRESS',
        period: event.period,
        previousValue,
        reason: event.reason,
        at: now,
      });
      break;
    }

    case 'RESCHEDULE': {
      const currentSortKey = state.scheduledYear * 12 + state.scheduledPeriod;
      const targetSortKey = event.year * 12 + event.period;
      if (targetSortKey <= currentSortKey) {
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
      const currentPeriodProgress = state.progressByPeriod[state.scheduledPeriod];
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
      const previousValue = state.progressByPeriod[state.scheduledPeriod] ?? 0;

      // 1. Anular progreso efectivo en el periodo actual
      next.progressByPeriod[state.scheduledPeriod] = 0;
      next.resolutionHistory.push({
        type: 'VOID_PERIOD_PROGRESS',
        period: state.scheduledPeriod,
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
