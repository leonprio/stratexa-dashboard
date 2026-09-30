import { ActionPlan, ActionPlanActivity, ActionPlanResultDecision, ActionPlanResultEffect, ActionPlanResultReview, ActionPlanStatus } from '../types';

export const calculateActionPlanProgress = (activities?: ActionPlanActivity[]) => activities?.length ? Math.round(activities.reduce((sum, item) => sum + Math.max(0, Math.min(100, item.progress)), 0) / activities.length) : 0;
export const deriveActionPlanStatus = (activities?: ActionPlanActivity[]): ActionPlanStatus => !activities?.length ? 'planned' : activities.every(item => item.progress === 100) ? 'completed' : 'in_progress';
export const reconcileActionPlanStatus = (current: ActionPlanStatus, activities?: ActionPlanActivity[]): ActionPlanStatus => current === 'cancelled' ? 'cancelled' : current === 'completed' && activities?.length && activities.every(item => item.progress === 100) ? 'completed' : deriveActionPlanStatus(activities);
export const normalizeActionImpact = (impact?: ActionPlanActivity['impact']): 'NOT_EVALUATED' | 'FAVORABLE' | 'PARTIAL' | 'LOW_OR_NONE' => impact === 'FAVORABLE' || impact === 'positive' ? 'FAVORABLE' : impact === 'PARTIAL' ? 'PARTIAL' : impact === 'LOW_OR_NONE' || impact === 'low' || impact === 'none' ? 'LOW_OR_NONE' : 'NOT_EVALUATED';
export type ExecutionSemaphore = 'cancelled' | 'completed' | 'overdue' | 'upcoming' | 'on_time' | 'missing_date';
type ActivityTemporal = Pick<ActionPlanActivity, 'progress' | 'targetDate'> & { status?: string };
const upcomingWindowDays = 7;
const calendarDay = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate());
export const classifyActionPlanActivity = (activity: ActivityTemporal, today = new Date()): ExecutionSemaphore => {
  if (activity.status === 'cancelled') return 'cancelled';
  if (activity.progress >= 100) return 'completed';
  if (!activity.targetDate || Number.isNaN(new Date(activity.targetDate).getTime())) return 'missing_date';
  const target = calendarDay(new Date(activity.targetDate)); const evaluationDay = calendarDay(today); const soon = new Date(evaluationDay); soon.setDate(soon.getDate() + upcomingWindowDays);
  if (target < evaluationDay) return 'overdue';
  return target <= soon ? 'upcoming' : 'on_time';
};
export const executionSemaphoreVisual: Record<ExecutionSemaphore, { label: string; color: 'red' | 'orange' | 'green' | 'neutral' }> = {
  cancelled: { label: 'Cancelada', color: 'neutral' }, completed: { label: 'Completada', color: 'green' }, overdue: { label: 'Vencida', color: 'red' }, upcoming: { label: 'Próxima', color: 'orange' }, on_time: { label: 'En plazo', color: 'green' }, missing_date: { label: 'Sin fecha', color: 'neutral' },
};
export const getActivityTrafficLight = (activity: ActivityTemporal, today = new Date()) => ({ cancelled: 'neutral', completed: 'green', overdue: 'red', upcoming: 'yellow', on_time: 'green', missing_date: 'neutral' } as const)[classifyActionPlanActivity(activity, today)];
export const classifyActionPlanExecution = (plan: Pick<ActionPlan, 'status' | 'targetDate' | 'activities'>, today = new Date()): ExecutionSemaphore => {
  if (plan.status === 'cancelled') return 'cancelled';
  if (plan.status === 'completed') return 'completed';
  const signals = (plan.activities || []).map(activity => classifyActionPlanActivity(activity, today));
  const planTemporal = plan.targetDate ? classifyActionPlanActivity({ progress: 0, targetDate: plan.targetDate }, today) : 'missing_date';
  if (signals.includes('overdue') || planTemporal === 'overdue') return 'overdue';
  if (signals.includes('upcoming') || planTemporal === 'upcoming') return 'upcoming';
  if (signals.length === 0 && planTemporal === 'missing_date') return 'missing_date';
  if (signals.some(signal => signal === 'missing_date') && planTemporal === 'missing_date') return 'missing_date';
  return 'on_time';
};
export const withCalculatedPlanState = (plan: ActionPlan): ActionPlan => ({ ...plan, progress: calculateActionPlanProgress(plan.activities), status: reconcileActionPlanStatus(plan.status, plan.activities) });

const resultEffects: readonly ActionPlanResultEffect[] = ['FAVORABLE', 'PARTIAL', 'LOW_OR_NONE', 'NOT_EVALUABLE'];
const resultDecisions: readonly ActionPlanResultDecision[] = ['CLOSE', 'CONTINUE', 'ADJUST'];
const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const isValidDateString = (value: unknown): value is string => isNonEmptyString(value) && !Number.isNaN(Date.parse(value));

/** Runtime guard so malformed/partial Firestore values do not count as a completed review. */
export const isValidActionPlanResultReview = (value: unknown): value is ActionPlanResultReview => {
  if (!value || typeof value !== 'object') return false;
  const review = value as Partial<ActionPlanResultReview>;
  return isNonEmptyString(review.id) && isValidDateString(review.reviewedAt) &&
    isNonEmptyString(review.reviewedByLabel) && isNonEmptyString(review.observedResult) &&
    resultEffects.includes(review.effect as ActionPlanResultEffect) &&
    resultDecisions.includes(review.decision as ActionPlanResultDecision);
};

/** Legacy plans and malformed review collections safely behave as having no reviews. */
export const getActionPlanResultReviews = (plan: Pick<ActionPlan, 'resultReviews'>): ActionPlanResultReview[] =>
  Array.isArray(plan.resultReviews) ? plan.resultReviews.filter(isValidActionPlanResultReview) : [];

/** Newest timestamp wins; equal timestamps use a code-point id comparison as a stable tie-break. */
export const getLatestActionPlanResultReview = (plan: Pick<ActionPlan, 'resultReviews'>): ActionPlanResultReview | undefined =>
  getActionPlanResultReviews(plan).reduce<ActionPlanResultReview | undefined>((latest, review) => {
    if (!latest) return review;
    const timeDelta = Date.parse(review.reviewedAt) - Date.parse(latest.reviewedAt);
    return timeDelta > 0 || (timeDelta === 0 && review.id > latest.id) ? review : latest;
  }, undefined);

/** Effect review is pending until the plan has at least one structurally valid review. */
export const isActionPlanEffectReviewPending = (plan: Pick<ActionPlan, 'resultReviews'>): boolean =>
  getLatestActionPlanResultReview(plan) === undefined;

export const isCompletedActionPlanEffectPending = (plan: Pick<ActionPlan, 'status' | 'resultReviews'>): boolean =>
  plan.status === 'completed' && isActionPlanEffectReviewPending(plan);

const localCalendarKey = (value: string | Date): string | undefined => {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return undefined;
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  }
  // Date-only ISO strings are calendar dates, not UTC instants.
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    const parsed = new Date(Number(year), Number(month) - 1, Number(day));
    if (parsed.getFullYear() !== Number(year) || parsed.getMonth() !== Number(month) - 1 || parsed.getDate() !== Number(day)) return undefined;
    return value;
  }
  if (!isValidDateString(value)) return undefined;
  return localCalendarKey(new Date(value));
};

/** A review on or after a promised review date satisfies that date; an earlier review does not. */
export const getOutstandingActionPlanResultReviewDate = (plan: Pick<ActionPlan, 'resultReviews'>): string | undefined => {
  const chronological = getActionPlanResultReviews(plan).sort((left, right) => Date.parse(left.reviewedAt) - Date.parse(right.reviewedAt) || left.id.localeCompare(right.id));
  let outstandingDate: string | undefined;
  let outstandingKey: string | undefined;
  for (const review of chronological) {
    const reviewedKey = localCalendarKey(review.reviewedAt);
    if (outstandingKey && reviewedKey && reviewedKey >= outstandingKey) {
      outstandingDate = undefined;
      outstandingKey = undefined;
    }
    const nextDate = review.nextReviewDate;
    const nextKey = nextDate ? localCalendarKey(nextDate) : undefined;
    if (nextDate && nextKey) {
      outstandingDate = nextDate;
      outstandingKey = nextKey;
    }
  }
  return outstandingDate;
};

/** A scheduled review becomes overdue the day after its due date, using local calendar days. */
export const hasOverdueActionPlanResultReview = (plan: Pick<ActionPlan, 'resultReviews'>, today = new Date()): boolean => {
  const dueDate = getOutstandingActionPlanResultReviewDate(plan);
  const dueKey = dueDate ? localCalendarKey(dueDate) : undefined;
  const todayKey = localCalendarKey(today);
  return !!dueKey && !!todayKey && dueKey < todayKey;
};

export type ActionPlanNextCommitment =
  | { type: 'plan'; id: string; reviewId: string }
  | { type: 'activity'; id: string; reviewId: string };

/** Returns a single unambiguous commitment link from the most recent valid review. */
export const getActionPlanNextCommitment = (plan: Pick<ActionPlan, 'resultReviews'>): ActionPlanNextCommitment | undefined => {
  const review = getLatestActionPlanResultReview(plan);
  if (!review) return undefined;
  const planId = isNonEmptyString(review.nextCommitmentPlanId) ? review.nextCommitmentPlanId.trim() : undefined;
  const activityId = isNonEmptyString(review.nextCommitmentActivityId) ? review.nextCommitmentActivityId.trim() : undefined;
  if (!!planId === !!activityId) return undefined;
  return planId ? { type: 'plan', id: planId, reviewId: review.id } : { type: 'activity', id: activityId!, reviewId: review.id };
};
