import { calculateActionPlanProgress, deriveActionPlanStatus, getActivityTrafficLight } from './actionPlanLogic';
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
    expect(getActivityTrafficLight(activity(20), today)).toBe('yellow');
    expect(getActivityTrafficLight(activity(0), today)).toBe('neutral');
  });
});
