import { ActionPlan, ActionPlanActivity, ActionPlanStatus } from '../types';

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
