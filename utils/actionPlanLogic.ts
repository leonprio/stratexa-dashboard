import { ActionPlan, ActionPlanActivity, ActionPlanStatus } from '../types';

export const calculateActionPlanProgress = (activities?: ActionPlanActivity[]) => activities?.length ? Math.round(activities.reduce((sum, item) => sum + Math.max(0, Math.min(100, item.progress)), 0) / activities.length) : 0;
export const deriveActionPlanStatus = (activities?: ActionPlanActivity[]): ActionPlanStatus => !activities?.length ? 'planned' : activities.every(item => item.progress === 100) ? 'completed' : 'in_progress';
export const getActivityTrafficLight = (activity: Pick<ActionPlanActivity, 'progress' | 'targetDate'>, today = new Date()) => { if (activity.progress === 100) return 'green'; if (activity.targetDate && new Date(activity.targetDate) < today && activity.progress < 100) return 'red'; if (activity.progress > 0) return 'yellow'; return 'neutral'; };
export const withCalculatedPlanState = (plan: ActionPlan): ActionPlan => ({ ...plan, progress: calculateActionPlanProgress(plan.activities), status: deriveActionPlanStatus(plan.activities) });
