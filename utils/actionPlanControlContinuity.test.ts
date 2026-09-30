import type { ActionPlan, ActionPlanResultReview } from "../types";
import { getActionPlanControlContinuity, getActionPlanIdentityKey } from "./actionPlanControlContinuity";
import { currentControlPeriod } from "./controlNavigation";
import { hasOverdueActionPlanResultReview, isCompletedActionPlanEffectPending } from "./actionPlanLogic";

const review = (id: string, reviewedAt: string, overrides: Partial<ActionPlanResultReview> = {}): ActionPlanResultReview => ({
  id, reviewedAt, reviewedByLabel: "Revisor", observedResult: "Medición observada", effect: "PARTIAL", decision: "CONTINUE", ...overrides,
});
const plan = (overrides: Partial<ActionPlan> = {}): ActionPlan => ({
  id: "p1", clientId: "ACME", dashboardId: 10, indicatorId: 7, title: "Plan",
  originYear: 2024, originPeriodType: "monthly", originPeriodIndex: 9, status: "completed", startDate: "2024-10-01", progress: 100,
  createdAt: "2024-10-01T00:00:00.000Z", updatedAt: "2024-12-01T00:00:00.000Z", ...overrides,
});

describe("CONTROL result-review continuity", () => {
  const today = new Date("2026-06-15T12:00:00.000Z");

  test("completed plans without valid review remain effect-pending; reviewed plans do not", () => {
    expect(isCompletedActionPlanEffectPending(plan())).toBe(true);
    expect(isCompletedActionPlanEffectPending(plan({ resultReviews: [review("r1", "2026-06-01T12:00:00.000Z")] }))).toBe(false);
    expect(isCompletedActionPlanEffectPending(plan({ status: "in_progress" }))).toBe(false);
  });

  test("classifies overdue versus future next review", () => {
    const overdue = plan({ resultReviews: [review("r1", "2026-01-01T12:00:00.000Z", { nextReviewDate: "2026-06-01" })] });
    const future = plan({ resultReviews: [review("r1", "2026-06-01T12:00:00.000Z", { nextReviewDate: "2026-06-20" })] });
    expect(hasOverdueActionPlanResultReview(overdue, today)).toBe(true);
    expect(getActionPlanControlContinuity(overdue, [overdue], today).reviewOverdue).toBe(true);
    expect(hasOverdueActionPlanResultReview(future, today)).toBe(false);
  });

  test("a review at or after the promised date satisfies it, while an earlier review does not", () => {
    const reviewedAfterDue = plan({ resultReviews: [
      review("r1", "2026-01-01T12:00:00.000Z", { nextReviewDate: "2026-06-01" }),
      review("r2", "2026-06-02T12:00:00.000Z"),
    ] });
    const reviewedEarly = plan({ resultReviews: [
      review("r1", "2026-01-01T12:00:00.000Z", { nextReviewDate: "2026-06-01" }),
      review("r2", "2026-05-31T12:00:00.000Z"),
    ] });
    expect(hasOverdueActionPlanResultReview(reviewedAfterDue, today)).toBe(false);
    expect(hasOverdueActionPlanResultReview(reviewedEarly, today)).toBe(true);
  });

  test("an early follow-up may reschedule the date and only its new commitment remains", () => {
    const rescheduled = plan({ resultReviews: [
      review("r1", "2026-01-01T12:00:00.000Z", { nextReviewDate: "2026-06-01" }),
      review("r2", "2026-05-20T12:00:00.000Z", { nextReviewDate: "2026-07-01" }),
    ] });
    expect(getActionPlanControlContinuity(rescheduled, [rescheduled], today).reviewDueDate).toBe("2026-07-01");
    expect(hasOverdueActionPlanResultReview(rescheduled, today)).toBe(false);
  });

  test("activity successor stays pending until complete, then is satisfied", () => {
    const open = plan({ status: "in_progress", resultReviews: [review("r1", "2026-01-01T12:00:00.000Z", { nextCommitmentActivityId: "a1" })], activities: [{ id: "a1", title: "Comprobar medición", progress: 20, targetDate: "2026-06-10", createdAt: "", updatedAt: "" }] });
    const done = { ...open, activities: open.activities?.map((activity) => ({ ...activity, progress: 100 })) };
    expect(getActionPlanControlContinuity(open, [open], today)).toEqual(expect.objectContaining({ commitmentPending: true, commitmentOverdue: true, successorActivityTitle: "Comprobar medición" }));
    expect(getActionPlanControlContinuity(done, [done], today).commitmentPending).toBe(false);
  });

  test("successor plan resolves by plan id and physical scope, and completion satisfies it", () => {
    const root = plan({ resultReviews: [review("r1", "2026-01-01T12:00:00.000Z", { nextCommitmentPlanId: "p2" })] });
    const successor = plan({ id: "p2", title: "Plan derivado", status: "in_progress", originYear: 2026, originPeriodIndex: 5, targetDate: "2026-07-01" });
    const homonym = plan({ id: "p2", dashboardId: 11, title: "Otro tablero" });
    expect(getActionPlanControlContinuity(root, [root, homonym], today).commitmentPending).toBe(false);
    expect(getActionPlanControlContinuity(root, [root, successor], today)).toEqual(expect.objectContaining({ commitmentPending: true, successorPlan: successor }));
    expect(getActionPlanControlContinuity(root, [root, { ...successor, status: "completed" }], today).commitmentPending).toBe(false);
  });

  test("identity includes client, dashboard, KPI and plan id for homonymous KPIs", () => {
    expect(getActionPlanIdentityKey(plan())).not.toBe(getActionPlanIdentityKey(plan({ dashboardId: 11 })));
    expect(getActionPlanIdentityKey(plan())).not.toBe(getActionPlanIdentityKey(plan({ indicatorId: 8 })));
  });

  test("period navigation uses management year and supports monthly, weekly and year boundaries", () => {
    expect(currentControlPeriod("monthly", 2026, new Date("2026-12-15T12:00:00Z"))).toEqual({ frequency: "monthly", year: 2026, monthIndex: 11 });
    expect(currentControlPeriod("monthly", 2027, new Date("2027-01-03T12:00:00Z"))).toEqual({ frequency: "monthly", year: 2027, monthIndex: 0 });
    expect(currentControlPeriod("weekly", 2026, new Date("2026-06-15T12:00:00Z"))).toEqual(expect.objectContaining({ frequency: "weekly", year: 2026, weekNumber: expect.any(Number) }));
    expect(currentControlPeriod("weekly", 2027, new Date("2027-01-03T12:00:00Z"))).toEqual(expect.objectContaining({ frequency: "weekly", year: 2027 }));
  });
});
