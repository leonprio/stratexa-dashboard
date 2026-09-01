import { calculateActionPlanProgress } from './utils/actionPlanLogic';
import type { ActionPlanActivity } from './types';
import { normalizeActionImpact } from './components/RelatedActionPlans';

const activity = (progress: number, impact?: ActionPlanActivity['impact']): ActionPlanActivity => ({ id: String(progress), title: 'Acción', progress, impact, result: 'Evidencia', createdAt: '', updatedAt: '' });

describe('ActionPlan activity impact contract', () => {
  it('keeps impact independent from execution progress', () => {
    expect(calculateActionPlanProgress([activity(100, 'LOW_OR_NONE')])).toBe(100);
    expect(calculateActionPlanProgress([activity(25, 'FAVORABLE')])).toBe(25);
  });

  it('keeps legacy activities without impact compatible', () => {
    expect(calculateActionPlanProgress([activity(50)])).toBe(50);
    expect(normalizeActionImpact()).toBe('NOT_EVALUATED');
    expect(normalizeActionImpact('positive')).toBe('FAVORABLE');
    expect(normalizeActionImpact('low')).toBe('PARTIAL');
    expect(normalizeActionImpact('none')).toBe('LOW_OR_NONE');
  });
});
