import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { belongsToMyControl, classifyDue, dedupePlans, filterMyControlPlans, filterPlans, getOverdueActivities, hasOverdueActivity, TransversalActionPlansControl } from './TransversalActionPlansControl';
import { ActionPlan, Dashboard } from '../../types';
import { firebaseService } from '../../services/firebaseService';
import { currentControlPeriod } from '../../utils/controlNavigation';
import { getActionPlanControlContinuity } from '../../utils/actionPlanControlContinuity';

afterEach(() => jest.restoreAllMocks());

const plan = (overrides: Partial<ActionPlan> = {}) => ({ id: '1', indicatorId: 1, dashboardId: 10, title: 'Plan', originYear: 2026, originPeriodType: 'monthly' as const, status: 'planned' as const, startDate: '2026-01-01', progress: 0, createdAt: '', updatedAt: '', indicator: 'KPI', area: 'Ventas', ...overrides });

describe('transversal action plans control logic', () => {
  const now = new Date('2026-08-28T12:00:00Z');
  it('classifies active, due and undated plans deterministically', () => {
    expect(['planned', 'in_progress']).toEqual(expect.arrayContaining([plan().status, plan({ status: 'in_progress' }).status]));
    expect(classifyDue(plan({ targetDate: '2026-08-27T12:00:00Z' }), now)).toBe('vencido');
    expect(classifyDue(plan({ targetDate: '2026-09-02T12:00:00Z' }), now)).toBe('próximo');
    expect(classifyDue(plan({ targetDate: '2026-09-10T12:00:00Z' }), now)).toBe('normal');
    expect(classifyDue(plan({ targetDate: undefined }), now)).toBe('normal');
    expect(classifyDue(plan({ status: 'completed', targetDate: '2026-08-27T12:00:00Z' }), now)).toBe('normal');
  });
  it('keeps completed plans outside active plans and limits recent list consumers to eight', () => {
    const active = [plan(), plan({ id: '2', status: 'in_progress' })]; const completed = Array.from({ length: 10 }, (_, i) => plan({ id: `c${i}`, status: 'completed' }));
    expect(active.filter(p => p.status === 'planned' || p.status === 'in_progress')).toHaveLength(2);
    expect(completed.slice(0, 8)).toHaveLength(8);
  });
  it('deduplicates exactly by plan id and supports all simple filters', () => {
    const items = [plan({ responsible: 'Ana' }), plan({ id: '2', area: 'Operaciones', responsible: 'Luis', status: 'in_progress' })];
    expect(dedupePlans([...items, { ...items[0], indicator: 'Otro' }])).toHaveLength(2);
    expect(filterPlans(items, 'Área', 'Operaciones')).toHaveLength(1);
    expect(filterPlans(items, 'Responsable', 'Ana')).toHaveLength(1);
    expect(filterPlans(items, 'Estado', 'En ejecución')).toHaveLength(1);
    expect(filterPlans(items, 'Todos', 'Todos')).toHaveLength(2);
  });
  it('filters personal control by canonical user id only and includes pending assigned activities', () => {
    const items = [plan({ responsible: 'Ana', responsibleUserId: 'uid-a' }), plan({ id: '2', responsible: 'Ana', responsibleUserId: 'uid-b' }), plan({ id: '3', responsible: 'Ana' }), plan({ id: '4', activities: [{ id: 'a', title: 'Tarea', responsible: 'Ana', responsibleUserId: 'uid-a', progress: 0, createdAt: '', updatedAt: '' }] }), plan({ id: '5', responsible: 'Externo', activities: [{ id: 'b', title: 'Externa', responsible: 'Ana', progress: 0, createdAt: '', updatedAt: '' }] })];
    expect(filterMyControlPlans(items, 'uid-a', now).map(candidate => candidate.id)).toEqual(['1', '4']);
    expect(belongsToMyControl({ responsible: 'Ana' }, 'uid-a')).toBe(false);
    expect(belongsToMyControl({ responsible: 'Ana', responsibleUserId: 'uid-b' }, 'uid-a')).toBe(false);
    expect(filterPlans(items, 'Todos', 'Todos')).toHaveLength(5);
  });
  it('includes canonically assigned successor plans and activities, but excludes assignments to another user', () => {
    const successorPlan = plan({ id: 'next-plan', responsibleUserId: 'uid-a' });
    const sourcePlan = plan({ id: 'source-plan', responsibleUserId: 'uid-b', resultReviews: [{ id: 'review-p', reviewedAt: '2026-01-01', reviewedByLabel: 'x', observedResult: 'x', effect: 'PARTIAL', decision: 'CONTINUE', nextCommitmentPlanId: 'next-plan' }] });
    const sourceActivity = plan({ id: 'source-activity', responsibleUserId: 'uid-b', activities: [{ id: 'next-activity', title: 'Continuar', responsibleUserId: 'uid-a', progress: 0, createdAt: '', updatedAt: '' }], resultReviews: [{ id: 'review-a', reviewedAt: '2026-01-01', reviewedByLabel: 'x', observedResult: 'x', effect: 'PARTIAL', decision: 'CONTINUE', nextCommitmentActivityId: 'next-activity' }] });
    const otherUser = plan({ id: 'other', responsibleUserId: 'uid-b' });
    expect(filterMyControlPlans([sourcePlan, successorPlan, sourceActivity, otherUser], 'uid-a', now).map(candidate => candidate.id)).toEqual(['next-plan', 'source-activity']);
  });
  it('deduplicates personal items and keeps legacy/external responsibilities out of the personal scope', () => {
    const planWithAssignedActivity = plan({ id: 'same', responsibleUserId: 'uid-a', activities: [{ id: 'a', title: 'A', responsibleUserId: 'uid-a', progress: 0, createdAt: '', updatedAt: '' }] });
    const legacy = plan({ id: 'legacy', responsible: 'Ana' });
    const external = plan({ id: 'external', responsible: 'Ana' });
    expect(filterMyControlPlans([planWithAssignedActivity, { ...planWithAssignedActivity, indicator: 'duplicated source' }, legacy, external], 'uid-a', now).map(candidate => candidate.id)).toEqual(['same']);
    expect(filterMyControlPlans([legacy, external], 'uid-a', now)).toEqual([]);
  });
  it('enforces client and dashboard identity in the personal predicate', () => {
    const inScope = plan({ id: 'in', clientId: 'ACME', dashboardId: 10, responsibleUserId: 'uid-a' });
    const otherClient = plan({ id: 'client', clientId: 'OTHER', dashboardId: 10, responsibleUserId: 'uid-a' });
    const otherDashboard = plan({ id: 'dashboard', clientId: 'ACME', dashboardId: 11, responsibleUserId: 'uid-a' });
    expect(filterMyControlPlans([inScope, otherClient, otherDashboard], 'uid-a', now, { clientId: 'acme', dashboardIds: [10] }).map(candidate => candidate.id)).toEqual(['in']);
  });
  it('exposes the personal scope inside the existing control and leaves it disabled without an authenticated user', () => {
    render(<TransversalActionPlansControl dashboards={[controlDashboard()]} currentDashboard={controlDashboard()} managementYear={2026} />);
    expect(screen.getByRole('button', { name: 'Mi Control' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Todos' })).toHaveAttribute('aria-pressed', 'true');
  });
  it('detects overdue activities without requiring a plan target date', () => {
    const overdue = { id: 'a1', title: 'Actividad vencida', progress: 20, targetDate: '2026-08-20', createdAt: '', updatedAt: '' };
    expect(hasOverdueActivity(plan({ targetDate: undefined, activities: [overdue] }), now)).toBe(true);
    expect(getOverdueActivities(plan({ activities: [overdue] }), now)).toHaveLength(1);
  });
  it('keeps future, undated and completed activities out of overdue attention', () => {
    const activities = [
      { id: 'done', title: 'Completada', progress: 100, targetDate: '2026-08-01', createdAt: '', updatedAt: '' },
      { id: 'undated', title: 'Sin fecha', progress: 0, createdAt: '', updatedAt: '' },
      { id: 'future', title: 'Futura', progress: 0, targetDate: '2026-09-10', createdAt: '', updatedAt: '' },
    ];
    expect(getOverdueActivities(plan({ activities }), now)).toHaveLength(0);
  });
  it('keeps a future-dated plan in attention when an activity is overdue', () => {
    const overdue = { id: 'a1', title: 'Actividad vencida', progress: 20, targetDate: '2026-08-20', createdAt: '', updatedAt: '' };
    expect(classifyDue(plan({ targetDate: '2026-09-20', activities: [overdue] }), now)).toBe('normal');
    expect(hasOverdueActivity(plan({ targetDate: '2026-09-20', activities: [overdue] }), now)).toBe(true);
  });
  it('does not duplicate a plan when multiple activities are overdue', () => {
    const items = [plan({ activities: [
      { id: 'a1', title: 'Uno', progress: 0, targetDate: '2026-08-01', createdAt: '', updatedAt: '' },
      { id: 'a2', title: 'Dos', progress: 0, targetDate: '2026-08-02', createdAt: '', updatedAt: '' },
    ] })];
    expect(dedupePlans(items)).toHaveLength(1);
    expect(getOverdueActivities(items[0], now)).toHaveLength(2);
  });
});

const controlDashboard = (id = 10, frequency: 'monthly' | 'weekly' = 'monthly'): Dashboard => ({
  id, clientId: 'ACME', title: `Tablero ${id}`, subtitle: '', group: 'Operaciones', area: 'Operaciones', periodicity: frequency,
  thresholds: { onTrack: 95, atRisk: 85 }, items: [{ id: 7, indicator: 'Indicador homónimo', weight: 1, unit: 'u', type: 'accumulative', goalType: 'maximize', frequency, monthlyGoals: [], monthlyProgress: [] }],
});
const controlPlan = (overrides: Partial<ActionPlan> = {}): ActionPlan => ({
  id: 'plan-control', clientId: 'ACME', dashboardId: 10, indicatorId: 7, title: 'Plan con efecto pendiente', originYear: 2024,
  originPeriodType: 'monthly', originPeriodIndex: 9, status: 'completed', startDate: '2024-10-01', progress: 100,
  createdAt: '2024-10-01T00:00:00.000Z', updatedAt: '2024-12-01T00:00:00.000Z', ...overrides,
});

describe('TransversalActionPlansControl review continuity', () => {
  beforeEach(() => jest.restoreAllMocks());

  test('a KPI with zero linked ActionPlans has no plan or result-review CTA', async () => {
    jest.spyOn(firebaseService, 'getActionPlansForIndicator').mockResolvedValue([]);
    render(<TransversalActionPlansControl dashboards={[controlDashboard()]} currentDashboard={controlDashboard()} managementYear={2026} />);
    expect(await screen.findByText('No hay planes registrados.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'REVISAR PLAN' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'REVISAR RESULTADO' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'GESTIONAR PLAN' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'VER PLAN' })).not.toBeInTheDocument();
  });

  test('a plan without indicatorId is not rendered with plan or KPI CTAs', async () => {
    jest.spyOn(firebaseService, 'getActionPlansForIndicator').mockResolvedValue([controlPlan({ indicatorId: '' })]);
    render(<TransversalActionPlansControl dashboards={[controlDashboard()]} currentDashboard={controlDashboard()} managementYear={2026} />);
    expect(await screen.findByText('No hay planes registrados.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'REVISAR PLAN' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'VER KPI' })).not.toBeInTheDocument();
  });

  test('VER KPI navigates with the indicator and dashboard attached to that plan', async () => {
    const plan = controlPlan({ id: 'kpi-target', indicatorId: 7 });
    jest.spyOn(firebaseService, 'getActionPlansForIndicator').mockResolvedValue([plan]);
    const onNavigateToKpi = jest.fn();
    render(<TransversalActionPlansControl dashboards={[controlDashboard()]} currentDashboard={controlDashboard()} managementYear={2026} onNavigateToKpi={onNavigateToKpi} />);
    fireEvent.click(await screen.findByRole('button', { name: 'VER KPI' }));
    expect(onNavigateToKpi).toHaveBeenCalledWith(10, 7);
  });
  test('Mi Control opens an assigned activity with its physical plan and activity identities', async () => {
    const assigned = controlPlan({ id: 'activity-parent', status: 'in_progress', activities: [{ id: 'activity-owned', title: 'Actividad propia', responsible: 'Ana', responsibleUserId: 'uid-a', progress: 10, targetDate: '2026-08-01', createdAt: '', updatedAt: '' }] });
    jest.spyOn(firebaseService, 'getActionPlansForIndicator').mockResolvedValue([assigned]);
    const onNavigateToPlan = jest.fn();
    render(<TransversalActionPlansControl dashboards={[controlDashboard()]} currentDashboard={controlDashboard()} currentUser={{ id: 'uid-a', name: 'Ana' } as any} managementYear={2026} onNavigateToPlan={onNavigateToPlan} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Mi Control' }));
    fireEvent.click(screen.getByRole('button', { name: 'GESTIONAR PLAN' }));
    expect(onNavigateToPlan).toHaveBeenCalledWith(expect.objectContaining({ clientId: 'ACME', dashboardId: 10, itemId: 7, actionPlanId: 'activity-parent', activityId: 'activity-owned' }));
  });
  test('Mi Control routes a canonically assigned pending review directly to review', async () => {
    const assigned = controlPlan({ responsibleUserId: 'uid-a' });
    jest.spyOn(firebaseService, 'getActionPlansForIndicator').mockResolvedValue([assigned]);
    const onNavigateToPlan = jest.fn();
    render(<TransversalActionPlansControl dashboards={[controlDashboard()]} currentDashboard={controlDashboard()} currentUser={{ id: 'uid-a', name: 'Ana' } as any} managementYear={2026} onNavigateToPlan={onNavigateToPlan} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Mi Control' }));
    fireEvent.click(screen.getByRole('button', { name: 'REVISAR RESULTADO' }));
    expect(onNavigateToPlan).toHaveBeenCalledWith(expect.objectContaining({ clientId: 'ACME', dashboardId: 10, itemId: 7, actionPlanId: assigned.id, openResultReview: true }));
  });
  test('Mi Control deduplicates an assigned next plan and navigates to the successor plan identity', async () => {
    const root = controlPlan({ id: 'review-root', responsibleUserId: 'uid-b', resultReviews: [{ id: 'rr', reviewedAt: '2026-01-01', reviewedByLabel: 'Ana', observedResult: 'Ajustar', effect: 'PARTIAL', decision: 'ADJUST', nextCommitmentPlanId: 'successor-own' }] });
    const successor = controlPlan({ id: 'successor-own', title: 'Sucesor personal', status: 'in_progress', responsibleUserId: 'uid-a' });
    jest.spyOn(firebaseService, 'getActionPlansForIndicator').mockResolvedValue([root, successor]);
    const onNavigateToPlan = jest.fn();
    render(<TransversalActionPlansControl dashboards={[controlDashboard()]} currentDashboard={controlDashboard()} currentUser={{ id: 'uid-a', name: 'Ana' } as any} managementYear={2026} onNavigateToPlan={onNavigateToPlan} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Mi Control' }));
    expect(screen.getAllByText('Sucesor personal')).toHaveLength(1);
    expect(screen.queryByText('Plan con efecto pendiente')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'GESTIONAR PLAN' }));
    expect(onNavigateToPlan).toHaveBeenCalledWith(expect.objectContaining({ actionPlanId: 'successor-own', clientId: 'ACME', dashboardId: 10, itemId: 7 }));
  });

  test('same-title plans keep separate plan ids when navigating from their own cards', async () => {
    const first = controlPlan({ id: 'same-title-1', title: 'Plan con título repetido', status: 'in_progress' });
    const second = controlPlan({ id: 'same-title-2', title: 'Plan con título repetido', status: 'in_progress' });
    jest.spyOn(firebaseService, 'getActionPlansForIndicator').mockResolvedValue([first, second]);
    const onNavigateToPlan = jest.fn();
    render(<TransversalActionPlansControl dashboards={[controlDashboard()]} currentDashboard={controlDashboard()} managementYear={2026} onNavigateToPlan={onNavigateToPlan} />);

    const sameTitleCards = await screen.findAllByText('Plan con título repetido');
    expect(sameTitleCards).toHaveLength(2);
    fireEvent.click(within(sameTitleCards[1].parentElement!.parentElement!).getByRole('button', { name: 'GESTIONAR PLAN' }));
    expect(onNavigateToPlan).toHaveBeenCalledWith(expect.objectContaining({ actionPlanId: 'same-title-2', itemId: 7, dashboardId: 10 }));
  });

  test('effect-pending completed plans stay visible outside the eight recent completed slots', async () => {
    const history = Array.from({ length: 9 }, (_, index) => controlPlan({ id: `reviewed-${index}`, title: `Revisado ${index}`, resultReviews: [{ id: `r-${index}`, reviewedAt: `2026-06-${String(index + 1).padStart(2, '0')}T12:00:00.000Z`, reviewedByLabel: 'Ana', observedResult: 'Dato', effect: 'FAVORABLE', decision: 'CLOSE' }] }));
    const pending = controlPlan();
    jest.spyOn(firebaseService, 'getActionPlansForIndicator').mockResolvedValue([...history, pending]);
    render(<TransversalActionPlansControl dashboards={[controlDashboard()]} currentDashboard={controlDashboard()} managementYear={2026} />);
    expect(await screen.findByText('Efecto pendiente')).toBeInTheDocument();
    expect(screen.getByText('Plan con efecto pendiente')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'VER PLAN' })).toHaveLength(8);
    expect(screen.getByText('(8)')).toBeInTheDocument();
  });

  test('refreshes CONTROL after a result review is saved', async () => {
    let current = controlPlan();
    jest.spyOn(firebaseService, 'getActionPlansForIndicator').mockImplementation(async () => [current]);
    render(<TransversalActionPlansControl dashboards={[controlDashboard()]} currentDashboard={controlDashboard()} managementYear={2026} />);
    expect(await screen.findByText('Efecto pendiente')).toBeInTheDocument();
    current = { ...current, resultReviews: [{ id: 'saved', reviewedAt: '2026-06-15T12:00:00.000Z', reviewedByLabel: 'Ana', observedResult: 'Medido', effect: 'FAVORABLE', decision: 'CLOSE' }] };
    fireEvent(window, new Event('action-plan-review-saved'));
    await waitFor(() => expect(screen.queryByText('Efecto pendiente')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'VER PLAN' })).toBeInTheDocument();
  });

  test('future review date remains informational and review navigation uses current management year and period', async () => {
      const reviewed = controlPlan({ resultReviews: [{ id: 'r1', reviewedAt: '2026-06-01T12:00:00.000Z', reviewedByLabel: 'Ana', observedResult: 'Mejoró', effect: 'PARTIAL', decision: 'CONTINUE', nextReviewDate: '2026-06-20' }] });
      expect(getActionPlanControlContinuity(reviewed, [reviewed], new Date('2026-06-15T12:00:00.000Z')).reviewDueDate).toBe('2026-06-20');
      expect(getActionPlanControlContinuity(reviewed, [reviewed], new Date('2026-06-15T12:00:00.000Z'))).toEqual(expect.objectContaining({ reviewDueDate: '2026-06-20', commitmentPending: false, commitment: undefined }));
      jest.spyOn(firebaseService, 'getActionPlansForIndicator').mockResolvedValue([reviewed]);
      const onNavigateToPlan = jest.fn();
      render(<TransversalActionPlansControl dashboards={[controlDashboard()]} currentDashboard={controlDashboard()} managementYear={2026} now={new Date('2026-06-15T12:00:00.000Z')} onNavigateToPlan={onNavigateToPlan} />);
      expect(await screen.findByText('Próxima revisión: 2026-06-20')).toBeInTheDocument();
      expect(screen.queryByText(/Revisión vencida/)).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'VER PLAN' }));
      expect(onNavigateToPlan).toHaveBeenCalledWith(expect.objectContaining({ actionPlanId: 'plan-control', year: 2026, period: currentControlPeriod('monthly', 2026, new Date('2026-06-15T12:00:00.000Z')), source: 'control' }));
  });

  test('review overdue and effect pending offer a direct result-review route without using originYear', async () => {
    const plan = controlPlan({ resultReviews: [{ id: 'r1', reviewedAt: '2026-01-01T12:00:00.000Z', reviewedByLabel: 'Ana', observedResult: 'Dato', effect: 'PARTIAL', decision: 'CONTINUE', nextReviewDate: '2026-06-01' }] });
    jest.spyOn(firebaseService, 'getActionPlansForIndicator').mockResolvedValue([plan]);
    const onNavigateToPlan = jest.fn();
    render(<TransversalActionPlansControl dashboards={[controlDashboard()]} currentDashboard={controlDashboard()} managementYear={2026} onNavigateToPlan={onNavigateToPlan} />);
    expect(await screen.findByText(/Revisión vencida/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'REVISAR RESULTADO' }));
    expect(onNavigateToPlan).toHaveBeenCalledWith(expect.objectContaining({ actionPlanId: plan.id, dashboardId: 10, itemId: 7, clientId: 'ACME', year: 2026, openResultReview: true, source: 'control' }));
  });

  test('open activity successors are attached to their plan and navigate by activity id', async () => {
    const source = controlPlan({ status: 'in_progress', activities: [{ id: 'next-activity', title: 'Validar mejora', progress: 20, targetDate: '2026-06-10', createdAt: '', updatedAt: '' }], resultReviews: [{ id: 'r1', reviewedAt: '2026-01-01T12:00:00.000Z', reviewedByLabel: 'Ana', observedResult: 'Dato', effect: 'PARTIAL', decision: 'CONTINUE', nextCommitmentActivityId: 'next-activity' }] });
    jest.spyOn(firebaseService, 'getActionPlansForIndicator').mockResolvedValue([source]);
    const onNavigateToPlan = jest.fn();
    render(<TransversalActionPlansControl dashboards={[controlDashboard()]} currentDashboard={controlDashboard()} managementYear={2026} onNavigateToPlan={onNavigateToPlan} />);
    expect(await screen.findByText(/Siguiente compromiso vencido · Validar mejora/)).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'GESTIONAR PLAN' })[0]);
    expect(onNavigateToPlan).toHaveBeenCalledWith(expect.objectContaining({ actionPlanId: source.id, activityId: 'next-activity', year: 2026 }));
  });

  test('open successor plan appears once as a distinct plan and its completed state satisfies the link', async () => {
    const root = controlPlan({ resultReviews: [{ id: 'r1', reviewedAt: '2026-01-01T12:00:00.000Z', reviewedByLabel: 'Ana', observedResult: 'Dato', effect: 'PARTIAL', decision: 'ADJUST', nextCommitmentPlanId: 'successor' }] });
    const successor = controlPlan({ id: 'successor', title: 'Plan sucesor abierto', status: 'in_progress', progress: 20, originYear: 2026, originPeriodIndex: 5 });
    jest.spyOn(firebaseService, 'getActionPlansForIndicator').mockResolvedValue([root, successor]);
    const onNavigateToPlan = jest.fn();
    render(<TransversalActionPlansControl dashboards={[controlDashboard()]} currentDashboard={controlDashboard()} managementYear={2026} onNavigateToPlan={onNavigateToPlan} />);
    expect(await screen.findByText('Siguiente compromiso pendiente · derivado de Plan con efecto pendiente')).toBeInTheDocument();
    expect(screen.getAllByText('Plan con efecto pendiente')).toHaveLength(1);
    fireEvent.click(screen.getAllByRole('button', { name: 'GESTIONAR PLAN' }).find(button => button.parentElement?.parentElement?.textContent?.includes('derivado de'))!);
    expect(onNavigateToPlan).toHaveBeenCalledWith(expect.objectContaining({ actionPlanId: 'successor', year: 2026 }));
  });

  test('homonymous KPIs in separate physical dashboards remain separate, and period changes preserve plan data', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-12-15T12:00:00.000Z'));
    try {
      const monthly = controlDashboard(10, 'monthly');
      const weekly = controlDashboard(11, 'weekly');
      const one = controlPlan({ id: 'same-id', title: 'Plan tablero diez' });
      const two = controlPlan({ id: 'same-id', dashboardId: 11, title: 'Plan tablero once', resultReviews: [{ id: 'r1', reviewedAt: '2026-01-01T12:00:00.000Z', reviewedByLabel: 'Ana', observedResult: 'Dato', effect: 'FAVORABLE', decision: 'CLOSE' }] });
      const loadSpy = jest.spyOn(firebaseService, 'getActionPlansForIndicator').mockResolvedValue([one, two]);
      const onNavigateToPlan = jest.fn();
      const view = render(<TransversalActionPlansControl dashboards={[monthly, weekly]} currentDashboard={monthly} managementYear={2026} onNavigateToPlan={onNavigateToPlan} />);
      expect(await screen.findByText('Plan tablero diez')).toBeInTheDocument();
      expect(screen.getByText('Plan tablero once')).toBeInTheDocument();
      expect(screen.getAllByText('Efecto pendiente')).toHaveLength(1);
      fireEvent.click(screen.getByRole('button', { name: 'REVISAR RESULTADO' }));
      expect(onNavigateToPlan).toHaveBeenLastCalledWith(expect.objectContaining({ dashboardId: 10, period: { frequency: 'monthly', year: 2026, monthIndex: 11 } }));
      view.rerender(<TransversalActionPlansControl dashboards={[weekly]} currentDashboard={weekly} managementYear={2027} onNavigateToPlan={onNavigateToPlan} />);
      expect(await screen.findByText('Plan tablero once')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'VER PLAN' }));
      expect(onNavigateToPlan).toHaveBeenLastCalledWith(expect.objectContaining({ actionPlanId: 'same-id', dashboardId: 11, year: 2027, period: expect.objectContaining({ frequency: 'weekly', year: 2027 }) }));
      expect(two.originYear).toBe(2024);
      expect(two.originPeriodIndex).toBe(9);
      expect(two.resultReviews).toHaveLength(1);
      expect(loadSpy).toHaveBeenCalledTimes(3);
      expect(jest.spyOn(firebaseService, 'updateActionPlan')).not.toHaveBeenCalled();
      expect(jest.spyOn(firebaseService, 'createActionPlan')).not.toHaveBeenCalled();
    } finally { jest.useRealTimers(); }
  });
});
