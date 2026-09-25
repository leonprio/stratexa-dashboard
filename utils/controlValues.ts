import type { DashboardItem } from '../types';
import type { TrackingPeriod } from './trackingObligation';

/** Reads the persisted period, including the checklist source used by CONTROL. */
export const readControlPeriodValues = (item: DashboardItem, period: TrackingPeriod) => {
  const index = period.frequency === 'monthly' ? period.monthIndex : period.weekNumber - 1;
  const activities = item.isActivityMode ? item.activityConfig?.[index] || [] : [];
  const goal = activities.length
    ? activities.reduce((sum, activity) => sum + Math.max(0, Number(activity.targetCount) || 0), 0)
    : period.frequency === 'monthly' ? item.monthlyGoals?.[index] : item.weeklyGoals?.[index];
  const progress = activities.length
    ? activities.reduce((sum, activity) => sum + Math.max(0, Number(activity.completedCount) || 0), 0)
    : period.frequency === 'monthly' ? item.monthlyProgress?.[index] : item.weeklyProgress?.[index];
  const goalCaptured = activities.length ? true : period.frequency === 'monthly' ? item.monthlyGoalCaptured?.[index] : undefined;
  const progressCaptured = activities.length ? progress !== null && progress > 0 : period.frequency === 'monthly' ? item.monthlyProgressCaptured?.[index] : undefined;
  const finite = (value: number | null | undefined, captured?: boolean) =>
    captured === false ? undefined :
      typeof value === 'number' && Number.isFinite(value) ? value : undefined;
  const goalValue = finite(goal, goalCaptured);
  const progressValue = finite(progress, progressCaptured);
  return {
    goal: goalValue,
    progress: progressValue,
    pending: goalValue !== undefined && progressValue !== undefined
      ? Math.max(0, item.goalType === 'minimize' ? progressValue - goalValue : goalValue - progressValue)
      : undefined,
  };
};
