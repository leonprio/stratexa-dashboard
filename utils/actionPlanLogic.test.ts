import { calculateActionPlanProgress, classifyActionPlanActivity, classifyActionPlanExecution, deriveActionPlanStatus, getActivityTrafficLight, normalizeActionImpact, reconcileActionPlanStatus } from './actionPlanLogic';
import { ActionPlanActivity } from '../types';

const activity = (progress: number, targetDate?: string): ActionPlanActivity => ({ id: String(progress), title: 'Actividad', progress, targetDate, createdAt: '', updatedAt: '' });

describe('action plan activity logic', () => {
  const today = new Date('2026-08-28T12:00:00Z');
  it('supports legacy plans without activities and calculates average progress', () => {
    expect(calculateActionPlanProgress()).toBe(0);
    expect(calculateActionPlanProgress([activity(20), activity(80)])).toBe(50);
  });
  it('derives status from activity completion', () => {
    expect(deriveActionPlanStatus()).toBe('planned');
    expect(deriveActionPlanStatus([activity(30), activity(100)])).toBe('in_progress');
    expect(deriveActionPlanStatus([activity(100), activity(100)])).toBe('completed');
  });
  it('returns deterministic activity traffic lights', () => {
    expect(getActivityTrafficLight(activity(100), today)).toBe('green');
    expect(getActivityTrafficLight(activity(20, '2026-08-27T12:00:00Z'), today)).toBe('red');
    expect(getActivityTrafficLight(activity(20), today)).toBe('neutral');
    expect(getActivityTrafficLight(activity(0), today)).toBe('neutral');
  });
  it('classifies temporal execution independently from percentage with an explicit evaluation date', () => {
    expect(classifyActionPlanActivity(activity(90, '2026-08-27T12:00:00Z'), today)).toBe('overdue');
    expect(classifyActionPlanActivity(activity(40, '2026-09-20T12:00:00Z'), today)).toBe('on_time');
    expect(classifyActionPlanActivity(activity(99, '2026-09-02T12:00:00Z'), today)).toBe('upcoming');
    expect(classifyActionPlanActivity(activity(40, '2026-08-28T23:59:59Z'), today)).toBe('upcoming');
    expect(classifyActionPlanActivity(activity(100, '2026-08-01T12:00:00Z'), today)).toBe('completed');
    expect(classifyActionPlanActivity(activity(20), today)).toBe('missing_date');
    expect(classifyActionPlanExecution({ status: 'in_progress', activities: [activity(65, '2026-08-27T12:00:00Z')] }, today)).toBe('overdue');
  });
  it('preserves terminal plan states and legacy impact meaning', () => {
    expect(reconcileActionPlanStatus('cancelled', [activity(10)])).toBe('cancelled');
    expect(reconcileActionPlanStatus('completed', [activity(100)])).toBe('completed');
    expect(normalizeActionImpact('low')).toBe('LOW_OR_NONE');
    expect(normalizeActionImpact('none')).toBe('LOW_OR_NONE');
    expect(normalizeActionImpact('positive')).toBe('FAVORABLE');
  });
});
