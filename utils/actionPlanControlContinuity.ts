import type { ActionPlan } from "../types";
import {
  classifyActionPlanActivity,
  classifyActionPlanExecution,
  getActionPlanNextCommitment,
  getOutstandingActionPlanResultReviewDate,
  hasOverdueActionPlanResultReview,
  isCompletedActionPlanEffectPending,
} from "./actionPlanLogic";

export interface ActionPlanControlContinuity {
  effectPending: boolean;
  reviewDueDate?: string;
  reviewOverdue: boolean;
  commitment?: ReturnType<typeof getActionPlanNextCommitment>;
  successorPlan?: ActionPlan;
  successorActivityTitle?: string;
  commitmentPending: boolean;
  commitmentOverdue: boolean;
  priority?: number;
}

const samePhysicalPlanScope = (left: ActionPlan, right: ActionPlan) =>
  String(left.clientId || "").trim().toUpperCase() === String(right.clientId || "").trim().toUpperCase() &&
  String(left.dashboardId) === String(right.dashboardId) &&
  String(left.indicatorId) === String(right.indicatorId);

export const getActionPlanControlContinuity = (
  plan: ActionPlan,
  plans: ActionPlan[],
  now = new Date(),
): ActionPlanControlContinuity => {
  const commitment = getActionPlanNextCommitment(plan);
  let successorPlan: ActionPlan | undefined;
  let successorActivityTitle: string | undefined;
  let commitmentPending = false;
  let commitmentOverdue = false;
  if (commitment?.type === "activity") {
    const activity = (plan.activities || []).find((candidate) => candidate.id === commitment.id);
    const status = (activity as (typeof activity & { status?: string }) | undefined)?.status;
    commitmentPending = !!activity && status !== "cancelled" && activity.progress < 100;
    successorActivityTitle = activity?.title;
    commitmentOverdue = commitmentPending && !!activity && classifyActionPlanActivity(activity, now) === "overdue";
  } else if (commitment?.type === "plan") {
    successorPlan = plans.find((candidate) => candidate.id === commitment.id && samePhysicalPlanScope(plan, candidate));
    commitmentPending = !!successorPlan && successorPlan.status !== "completed" && successorPlan.status !== "cancelled";
    commitmentOverdue = commitmentPending && !!successorPlan && classifyActionPlanExecution(successorPlan, now) === "overdue";
  }
  const effectPending = isCompletedActionPlanEffectPending(plan);
  const reviewDueDate = getOutstandingActionPlanResultReviewDate(plan);
  const reviewOverdue = hasOverdueActionPlanResultReview(plan, now);
  const priority = reviewOverdue ? 1 : effectPending ? 2 : commitmentOverdue ? 3 : commitmentPending ? 4 : undefined;
  return { effectPending, reviewDueDate, reviewOverdue, commitment, successorPlan, successorActivityTitle, commitmentPending, commitmentOverdue, priority };
};

export const getActionPlanIdentityKey = (plan: Pick<ActionPlan, "id" | "clientId" | "dashboardId" | "indicatorId">) =>
  [String(plan.clientId || "").trim().toUpperCase(), String(plan.dashboardId), String(plan.indicatorId), String(plan.id)].join("|");
