import type {
  BuildControlCutParams,
  ControlCut,
  ControlCutActionPlanSnapshot,
  ControlCutActivitySnapshot,
  ControlCutKpiSnapshot,
  ControlCutReviewSnapshot,
  ControlCutScope,
} from '../types/controlCut';
import { CONTROL_CUT_SCHEMA_VERSION } from '../types/controlCut';
import type { ActionPlan, Dashboard, DashboardItem } from '../types';

export const buildControlCutId = (
  clientId: string,
  dashboardId: string | number,
  periodicity: 'monthly' | 'weekly',
  year: number,
  periodIndex: number,
): string => {
  const normClient = String(clientId || '').trim().toUpperCase();
  const normBoard = String(dashboardId).trim();
  const normFreq = periodicity === 'weekly' ? 'W' : 'M';
  const normYear = Math.floor(Number(year) || 0);
  const normIdx = Math.floor(Number(periodIndex) || 0);
  return `${normClient}_${normBoard}_${normFreq}_${normYear}_${normIdx}`;
};

export const sanitizeControlCutKpiSnapshot = (kpi: ControlCutKpiSnapshot): ControlCutKpiSnapshot => ({
  indicatorId: kpi.indicatorId,
  label: String(kpi.label || ''),
  ...(kpi.goal !== undefined ? { goal: Number(kpi.goal) } : {}),
  ...(kpi.progress !== undefined ? { progress: Number(kpi.progress) } : {}),
  ...(kpi.pending !== undefined ? { pending: Number(kpi.pending) } : {}),
  ...(kpi.compliance !== undefined ? { compliance: Number(kpi.compliance) } : {}),
  frequency: kpi.frequency === 'weekly' ? 'weekly' : 'monthly',
  ...(kpi.goalCaptured !== undefined ? { goalCaptured: Boolean(kpi.goalCaptured) } : {}),
  ...(kpi.progressCaptured !== undefined ? { progressCaptured: Boolean(kpi.progressCaptured) } : {}),
  ...(kpi.isActivityMode !== undefined ? { isActivityMode: Boolean(kpi.isActivityMode) } : {}),
  ...(kpi.effectiveException ? { effectiveException: String(kpi.effectiveException) } : {}),
  dashboardId: kpi.dashboardId,
  ...(kpi.area ? { area: String(kpi.area) } : {}),
  ...(kpi.direction ? { direction: String(kpi.direction) } : {}),
});

export const sanitizeControlCutActivitySnapshot = (act: ControlCutActivitySnapshot): ControlCutActivitySnapshot => ({
  id: String(act.id || ''),
  title: String(act.title || ''),
  ...(act.responsible ? { responsible: String(act.responsible) } : {}),
  ...(act.responsibleUserId ? { responsibleUserId: String(act.responsibleUserId) } : {}),
  ...(act.targetDate ? { targetDate: String(act.targetDate) } : {}),
  progress: Number(act.progress) || 0,
  ...(act.result ? { result: String(act.result) } : {}),
  ...(act.impact ? { impact: String(act.impact) } : {}),
  createdAt: String(act.createdAt || ''),
  updatedAt: String(act.updatedAt || ''),
});

export const sanitizeControlCutNextCommitmentSnapshot = (
  commitment?: import('../types/controlCut').ControlCutNextCommitmentSnapshot,
): import('../types/controlCut').ControlCutNextCommitmentSnapshot | undefined => {
  if (!commitment || !commitment.id) return undefined;
  return {
    type: commitment.type === 'activity' ? 'activity' : 'plan',
    id: String(commitment.id),
    title: String(commitment.title || ''),
    ...(commitment.responsible ? { responsible: String(commitment.responsible) } : {}),
    ...(commitment.responsibleUserId ? { responsibleUserId: String(commitment.responsibleUserId) } : {}),
    ...(commitment.targetDate ? { targetDate: String(commitment.targetDate) } : {}),
    ...(commitment.status ? { status: String(commitment.status) } : {}),
    ...(commitment.progress !== undefined ? { progress: Number(commitment.progress) || 0 } : {}),
  };
};

export const sanitizeControlCutReviewSnapshot = (
  rev: ControlCutReviewSnapshot,
  enforcedCutId?: string,
): ControlCutReviewSnapshot => {
  const sanitizedCommitment = sanitizeControlCutNextCommitmentSnapshot(rev.nextCommitment);
  const targetCutId = enforcedCutId || (rev.cutId ? String(rev.cutId) : undefined);
  return {
    id: String(rev.id || ''),
    planId: String(rev.planId || ''),
    reviewedAt: String(rev.reviewedAt || ''),
    ...(rev.reviewedByUserId ? { reviewedByUserId: String(rev.reviewedByUserId) } : {}),
    reviewedByLabel: String(rev.reviewedByLabel || ''),
    observedResult: String(rev.observedResult || ''),
    effect: rev.effect,
    decision: rev.decision,
    ...(rev.note ? { note: String(rev.note) } : {}),
    ...(rev.evidenceRef ? { evidenceRef: String(rev.evidenceRef) } : {}),
    ...(rev.nextReviewDate ? { nextReviewDate: String(rev.nextReviewDate) } : {}),
    ...(rev.nextCommitmentPlanId ? { nextCommitmentPlanId: String(rev.nextCommitmentPlanId) } : {}),
    ...(rev.nextCommitmentActivityId ? { nextCommitmentActivityId: String(rev.nextCommitmentActivityId) } : {}),
    ...(sanitizedCommitment ? { nextCommitment: sanitizedCommitment } : {}),
    ...(rev.reviewYear !== undefined ? { reviewYear: Number(rev.reviewYear) } : {}),
    ...(rev.reviewPeriodType ? { reviewPeriodType: rev.reviewPeriodType } : {}),
    ...(rev.reviewPeriodIndex !== undefined ? { reviewPeriodIndex: Number(rev.reviewPeriodIndex) } : {}),
    ...(targetCutId ? { cutId: targetCutId } : {}),
  };
};

export const sanitizeControlCutActionPlanSnapshot = (
  plan: ControlCutActionPlanSnapshot,
  enforcedCutId?: string,
): ControlCutActionPlanSnapshot => {
  const sanitizedCommitment = sanitizeControlCutNextCommitmentSnapshot(plan.nextCommitment);
  return {
    id: String(plan.id || ''),
    indicatorId: plan.indicatorId,
    dashboardId: plan.dashboardId,
    ...(plan.clientId ? { clientId: String(plan.clientId) } : {}),
    ...(plan.area ? { area: String(plan.area) } : {}),
    title: String(plan.title || ''),
    ...(plan.description ? { description: String(plan.description) } : {}),
    originYear: Number(plan.originYear) || 0,
    originPeriodType: plan.originPeriodType,
    ...(plan.originPeriodIndex !== undefined ? { originPeriodIndex: Number(plan.originPeriodIndex) } : {}),
    status: plan.status,
    ...(plan.responsible ? { responsible: String(plan.responsible) } : {}),
    ...(plan.responsibleUserId ? { responsibleUserId: String(plan.responsibleUserId) } : {}),
    startDate: String(plan.startDate || ''),
    ...(plan.targetDate ? { targetDate: String(plan.targetDate) } : {}),
    progress: Number(plan.progress) || 0,
    ...(plan.expectedImpact ? { expectedImpact: String(plan.expectedImpact) } : {}),
    createdAt: String(plan.createdAt || ''),
    updatedAt: String(plan.updatedAt || ''),
    ...(plan.closedAt ? { closedAt: String(plan.closedAt) } : {}),
    activities: (plan.activities || []).map(sanitizeControlCutActivitySnapshot),
    reviews: (plan.reviews || []).map((r) => sanitizeControlCutReviewSnapshot(r, enforcedCutId)),
    ...(plan.nextCommitmentPlanId ? { nextCommitmentPlanId: String(plan.nextCommitmentPlanId) } : {}),
    ...(plan.nextCommitmentActivityId ? { nextCommitmentActivityId: String(plan.nextCommitmentActivityId) } : {}),
    ...(sanitizedCommitment ? { nextCommitment: sanitizedCommitment } : {}),
  };
};

export const buildControlCutSnapshot = (params: BuildControlCutParams): ControlCut => {
  const normClient = String(params.clientId || '').trim().toUpperCase();
  const normBoard = params.dashboardId;
  const boardIds = params.dashboardIds && params.dashboardIds.length > 0
    ? Array.from(new Set(params.dashboardIds.map(String)))
    : [String(normBoard)];

  const cutId = buildControlCutId(
    normClient,
    normBoard,
    params.periodicity,
    params.year,
    params.periodIndex,
  );

  const scope: ControlCutScope = {
    clientId: normClient,
    dashboardId: normBoard,
    dashboardIds: boardIds,
    periodicity: params.periodicity === 'weekly' ? 'weekly' : 'monthly',
    year: Number(params.year),
    periodIndex: Number(params.periodIndex),
  };

  const capturedAt = params.capturedAt || new Date().toISOString();

  // Extract flat reviews from action plans if not explicitly passed
  const flatReviews: ControlCutReviewSnapshot[] = params.reviews
    ? params.reviews.map((r) => sanitizeControlCutReviewSnapshot(r, cutId))
    : (params.actionPlans || []).flatMap((p) => (p.reviews || []).map((r) => ({ ...r, planId: r.planId || p.id }))).map((r) => sanitizeControlCutReviewSnapshot(r, cutId));

  return {
    cutId,
    schemaVersion: CONTROL_CUT_SCHEMA_VERSION,
    capturedAt,
    ...(params.capturedByUserId ? { capturedByUserId: String(params.capturedByUserId) } : {}),
    capturedByLabel: String(params.capturedByLabel || 'Sistema'),
    clientId: normClient,
    dashboardId: normBoard,
    dashboardIds: boardIds,
    periodicity: scope.periodicity,
    year: scope.year,
    periodIndex: scope.periodIndex,
    scope,
    kpis: (params.kpis || []).map(sanitizeControlCutKpiSnapshot),
    controlSummary: {
      pendingConfigurationsCount: Number(params.controlSummary?.pendingConfigurationsCount) || 0,
      pendingCapturesCount: Number(params.controlSummary?.pendingCapturesCount) || 0,
      overdueActionsCount: Number(params.controlSummary?.overdueActionsCount) || 0,
      upcomingActionsCount: Number(params.controlSummary?.upcomingActionsCount) || 0,
      activeActionsCount: Number(params.controlSummary?.activeActionsCount) || 0,
      completedActionsCount: Number(params.controlSummary?.completedActionsCount) || 0,
      pendingReviewsCount: Number(params.controlSummary?.pendingReviewsCount) || 0,
      derivedAttentionCount: Number(params.controlSummary?.derivedAttentionCount) || 0,
    },
    actionPlans: (params.actionPlans || []).map((p) => sanitizeControlCutActionPlanSnapshot(p, cutId)),
    reviews: flatReviews,
  };
};
