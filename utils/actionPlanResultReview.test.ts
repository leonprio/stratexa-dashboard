import type { ActionPlan, ActionPlanActivity, ActionPlanResultEffect, ActionPlanResultReview } from '../types';
import {
  calculateActionPlanProgress,
  getActionPlanNextCommitment,
  getActionPlanResultReviews,
  getLatestActionPlanResultReview,
  hasOverdueActionPlanResultReview,
  isActionPlanEffectReviewPending,
  withCalculatedPlanState,
} from './actionPlanLogic';

const review = (overrides: Partial<ActionPlanResultReview> = {}): ActionPlanResultReview => ({
  id: 'review-1',
  reviewedAt: '2026-09-10T12:00:00.000Z',
  reviewedByLabel: 'Ana Pérez',
  observedResult: 'El KPI subió de 70 a 82.',
  effect: 'FAVORABLE',
  decision: 'CLOSE',
  ...overrides,
});

const activity: ActionPlanActivity = {
  id: 'activity-1',
  title: 'Acción terminada',
  progress: 100,
  impact: 'NOT_EVALUATED',
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-10T00:00:00.000Z',
};

const plan = (overrides: Partial<ActionPlan> = {}): ActionPlan => ({
  id: 'plan-1',
  indicatorId: 'kpi-1',
  dashboardId: 'board-1',
  title: 'Plan de prueba',
  originYear: 2026,
  originPeriodType: 'monthly',
  originPeriodIndex: 8,
  status: 'completed',
  startDate: '2026-09-01',
  progress: 100,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-10T00:00:00.000Z',
  activities: [activity],
  ...overrides,
});

describe('ActionPlan result review domain contract', () => {
  it('keeps a legacy plan without resultReviews valid and treats its reviews as empty', () => {
    const legacy = plan();
    expect(legacy.resultReviews).toBeUndefined();
    expect(getActionPlanResultReviews(legacy)).toEqual([]);
    expect(getLatestActionPlanResultReview(legacy)).toBeUndefined();
    expect(isActionPlanEffectReviewPending(legacy)).toBe(true);
    expect(withCalculatedPlanState(legacy)).toMatchObject({ status: 'completed', progress: 100 });
  });

  it('allows a completed plan to retain completed execution while its effect is pending', () => {
    const completed = plan({ resultReviews: [] });
    expect(completed.status).toBe('completed');
    expect(isActionPlanEffectReviewPending(completed)).toBe(true);
  });

  it('does not infer plan effectiveness from a 100 percent activity with NOT_EVALUATED impact', () => {
    const completed = plan({ activities: [activity], resultReviews: [] });
    expect(activity.progress).toBe(100);
    expect(activity.impact).toBe('NOT_EVALUATED');
    expect(isActionPlanEffectReviewPending(completed)).toBe(true);
  });

  it.each<ActionPlanResultEffect>(['FAVORABLE', 'PARTIAL', 'LOW_OR_NONE', 'NOT_EVALUABLE'])(
    'accepts %s as a valid review effect without leaving pending state',
    (effect) => {
      const withReview = plan({ resultReviews: [review({ effect })] });
      expect(isActionPlanEffectReviewPending(withReview)).toBe(false);
      expect(getLatestActionPlanResultReview(withReview)?.effect).toBe(effect);
    },
  );

  it('selects the chronologically latest review even when the array is out of order', () => {
    const older = review({ id: 'review-old', reviewedAt: '2026-09-01T10:00:00.000Z' });
    const newer = review({ id: 'review-new', reviewedAt: '2026-09-20T10:00:00.000Z' });
    const reviews = [newer, older];
    expect(getLatestActionPlanResultReview(plan({ resultReviews: reviews }))?.id).toBe('review-new');
    expect(reviews.map(({ id }) => id)).toEqual(['review-new', 'review-old']);
  });

  it('uses review id as a deterministic tie-break for equal timestamps', () => {
    const first = review({ id: 'review-a' });
    const second = review({ id: 'review-z' });
    expect(getLatestActionPlanResultReview(plan({ resultReviews: [second, first] }))?.id).toBe('review-z');
    expect(getLatestActionPlanResultReview(plan({ resultReviews: [first, second] }))?.id).toBe('review-z');
  });

  it('does not consider a future next review date overdue', () => {
    expect(hasOverdueActionPlanResultReview(
      plan({ resultReviews: [review({ nextReviewDate: '2026-09-29' })] }),
      new Date(2026, 8, 28, 23, 59),
    )).toBe(false);
  });

  it('considers a next review date in the past overdue', () => {
    expect(hasOverdueActionPlanResultReview(
      plan({ resultReviews: [review({ nextReviewDate: '2026-09-27' })] }),
      new Date(2026, 8, 28, 0, 1),
    )).toBe(true);
  });

  it('does not mark a review overdue during its exact due calendar day', () => {
    expect(hasOverdueActionPlanResultReview(
      plan({ resultReviews: [review({ nextReviewDate: '2026-09-28' })] }),
      new Date(2026, 8, 28, 23, 59, 59),
    )).toBe(false);
  });

  it('does not let a malformed date create a false overdue alert', () => {
    expect(hasOverdueActionPlanResultReview(
      plan({ resultReviews: [review({ nextReviewDate: 'not-a-date' })] }),
      new Date(2026, 8, 28),
    )).toBe(false);
  });

  it('keeps calendar due dates open through their day across month and year boundaries', () => {
    const dueAtMonthEnd = plan({ resultReviews: [review({ nextReviewDate: '2026-06-30' })] });
    expect(hasOverdueActionPlanResultReview(dueAtMonthEnd, new Date('2026-06-30T23:59:00'))).toBe(false);
    expect(hasOverdueActionPlanResultReview(dueAtMonthEnd, new Date('2026-07-01T00:01:00'))).toBe(true);
    const dueAtYearEnd = plan({ resultReviews: [review({ nextReviewDate: '2026-12-31' })] });
    expect(hasOverdueActionPlanResultReview(dueAtYearEnd, new Date('2026-12-31T23:59:00'))).toBe(false);
    expect(hasOverdueActionPlanResultReview(dueAtYearEnd, new Date('2027-01-01T00:01:00'))).toBe(true);
    expect(hasOverdueActionPlanResultReview(plan({ resultReviews: [review({ nextReviewDate: '2026-02-30' })] }), new Date('2026-03-01T12:00:00'))).toBe(false);
  });

  it('returns an activity commitment linked from the latest valid review', () => {
    expect(getActionPlanNextCommitment(plan({ resultReviews: [review({ nextCommitmentActivityId: 'activity-next' })] })))
      .toEqual({ type: 'activity', id: 'activity-next', reviewId: 'review-1' });
  });

  it('returns a plan commitment linked from the latest valid review', () => {
    expect(getActionPlanNextCommitment(plan({ resultReviews: [review({ nextCommitmentPlanId: 'plan-next' })] })))
      .toEqual({ type: 'plan', id: 'plan-next', reviewId: 'review-1' });
  });

  it('does not guess when the commitment is missing or ambiguously links both kinds', () => {
    expect(getActionPlanNextCommitment(plan({ resultReviews: [review()] }))).toBeUndefined();
    expect(getActionPlanNextCommitment(plan({ resultReviews: [review({ nextCommitmentPlanId: 'p', nextCommitmentActivityId: 'a' })] }))).toBeUndefined();
  });

  it('treats incomplete review data as pending and excludes it from the review list', () => {
    const malformed = { ...review(), observedResult: '  ' } as ActionPlanResultReview;
    const candidate = plan({ resultReviews: [malformed] });
    expect(getActionPlanResultReviews(candidate)).toEqual([]);
    expect(isActionPlanEffectReviewPending(candidate)).toBe(true);
    expect(getActionPlanNextCommitment(candidate)).toBeUndefined();
  });

  it('leaves calculated execution progress and completed status unchanged when reviews are added', () => {
    const original = plan({ activities: [activity, { ...activity, id: 'activity-2', progress: 50 }] });
    const withReview = { ...original, resultReviews: [review()] };
    expect(calculateActionPlanProgress(withReview.activities)).toBe(75);
    expect(withCalculatedPlanState(withReview)).toMatchObject({ progress: 75, status: 'in_progress' });
    expect(withCalculatedPlanState(plan({ resultReviews: [review()] }))).toMatchObject({ progress: 100, status: 'completed' });
  });
});
