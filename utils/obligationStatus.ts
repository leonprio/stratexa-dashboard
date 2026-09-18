import { compareTrackingPeriods, type TrackingObligation, type TrackingPeriod } from './trackingObligation';

export type ObligationStatus = 'VIGENTE' | 'ATRASADA' | 'FUTURA' | 'NO_EXIGIBLE';

/** Deterministic temporal status; callers provide both periods explicitly. */
export const getObligationStatus = (
  obligation: TrackingObligation,
  period: TrackingPeriod,
  operationalPeriod: TrackingPeriod,
): ObligationStatus => {
  if (obligation === 'NOT_REQUIRED' || obligation === 'TRACKING_START_UNDEFINED' || obligation === 'CAPTURE_COMPLETE') return 'NO_EXIGIBLE';
  const comparison = compareTrackingPeriods(period, operationalPeriod);
  if (obligation === 'FUTURE' || comparison > 0) return 'FUTURA';
  if (comparison < 0) return 'ATRASADA';
  return 'VIGENTE';
};
