import { calculateActionPlanProgress } from './utils/actionPlanLogic';
import type { ActionPlanActivity } from './types';
import { activityProgressVisual, normalizeActionImpact } from './components/RelatedActionPlans';

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

  it('derives execution feedback from progress, independently of impact', () => {
    expect(activityProgressVisual(0)).toMatchObject({ label: 'Pendiente', tone: 'neutral' });
    expect(activityProgressVisual(45)).toMatchObject({ label: 'En ejecución', tone: 'cyan' });
    expect(activityProgressVisual(90)).toMatchObject({ label: 'Próximo a completarse', tone: 'amber' });
    expect(activityProgressVisual(100)).toMatchObject({ label: 'Completada', tone: 'emerald' });
    expect(normalizeActionImpact(activity(100, 'LOW_OR_NONE').impact)).toBe('LOW_OR_NONE');
  });
});
