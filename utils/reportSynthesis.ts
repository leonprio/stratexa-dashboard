export type ComparablePeriodResult = {
  currentPeriodIndex: number | null;
  priorPeriodIndex: number | null;
  currentScore: number | null;
  priorScore: number | null;
  delta: number | null;
  status: 'AVAILABLE' | 'NOT_AVAILABLE';
};

/** Finds the latest valid period and the nearest earlier valid comparable period. */
export const resolvePreviousComparablePeriod = (
  scores: Array<number | null | undefined>,
  latestAllowedIndex = scores.length - 1,
): ComparablePeriodResult => {
  const valid = scores
    .map((score, index) => ({ score, index }))
    .filter(({ score, index }) => index <= latestAllowedIndex && typeof score === 'number' && Number.isFinite(score));
  const current = valid[valid.length - 1];
  const prior = current ? [...valid].reverse().find(candidate => candidate.index < current.index) : undefined;
  if (!current || !prior) {
    return { currentPeriodIndex: current?.index ?? null, priorPeriodIndex: null, currentScore: current?.score ?? null, priorScore: null, delta: null, status: 'NOT_AVAILABLE' };
  }
  return { currentPeriodIndex: current.index, priorPeriodIndex: prior.index, currentScore: current.score as number, priorScore: prior.score as number, delta: Math.round(((current.score as number) - (prior.score as number)) * 10) / 10, status: 'AVAILABLE' };
};
