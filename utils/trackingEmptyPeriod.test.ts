import { hasTrackingFactsBeforePeriod } from "./trackingObligation";
import type { DashboardItem } from "../types";
const october = { frequency: "monthly" as const, year: 2026, monthIndex: 9 };
const base: DashboardItem = {
  id: 2,
  indicator: "Liderazgos juveniles activos",
  weight: 1,
  unit: "u",
  frequency: "monthly",
  type: "accumulative",
  goalType: "maximize",
  isActivityMode: true,
  monthlyGoals: Array(12).fill(0),
  monthlyProgress: Array(12).fill(0),
  monthlyGoalCaptured: Object.assign(Array(12).fill(false), {
    7: true,
    8: true,
  }),
  monthlyProgressCaptured: Array(12).fill(false),
  monthlyNotes: Array(12).fill(""),
  activityConfig: { 7: [], 8: [] },
  continuityCommitments: {},
};
base.monthlyProgress[7] = null;
base.monthlyProgress[8] = null;
const facts = (item: DashboardItem) =>
  hasTrackingFactsBeforePeriod(
    "monthly",
    2026,
    october,
    item.monthlyGoals,
    item.monthlyProgress,
    item.monthlyGoalCaptured,
    item.monthlyProgressCaptured,
    item,
  );
test("historical August/September isolated goal flags and empty checklist permit October without mutation", () => {
  const original = JSON.stringify(base);
  expect(facts(base)).toEqual({ hasFacts: false });
  expect(JSON.stringify(base)).toBe(original);
});
test.each(["goal", "progress"])(
  "positive %s is protected even with false marker",
  (kind) => {
    const item = {
      ...base,
      monthlyGoals: [...base.monthlyGoals],
      monthlyProgress: [...base.monthlyProgress],
    };
    if (kind === "goal") item.monthlyGoals[0] = 5;
    else item.monthlyProgress[0] = 5;
    expect(facts(item)).toMatchObject({
      hasFacts: true,
      firstPeriod: { monthIndex: 0 },
    });
  },
);
test("zero progress explicitly captured remains protected", () => {
  expect(facts({ ...base, monthlyProgressCaptured: [true] })).toMatchObject({
    hasFacts: true,
    firstPeriod: { monthIndex: 0 },
  });
});
test("null progress is absence even with stale marker", () => {
  expect(
    facts({
      ...base,
      monthlyProgress: Array(12).fill(null),
      monthlyProgressCaptured: Array(12).fill(true),
    }),
  ).toEqual({ hasFacts: false });
});
test.each(["note", "activity", "continuity"])(
  "real %s protects a zero goal",
  (kind) => {
    const item = { ...base };
    if (kind === "note") item.monthlyNotes = ["Evidencia de captura"];
    if (kind === "activity")
      item.activityConfig = {
        0: [
          {
            id: "a",
            label: "Actividad real",
            targetCount: 0,
            completedCount: 0,
          },
        ],
      };
    if (kind === "continuity")
      item.continuityCommitments = {
        c: {
          id: "c",
          sourceType: "SIMPLE_KPI",
          sourceKpiId: "2",
          originYear: 2026,
          originPeriod: 0,
          originalTarget: 0,
          scheduledYear: 2026,
          scheduledPeriod: 8,
          progressByPeriod: {},
          status: "active",
          resolutionHistory: [],
        },
      };
    expect(facts(item)).toMatchObject({
      hasFacts: true,
      firstPeriod: { monthIndex: 0 },
    });
  },
);
test("empty draft, whitespace and unmarked technical zero are not data", () => {
  expect(
    facts({
      ...base,
      monthlyNotes: [" "],
      activityConfig: {
        0: [{ id: "draft", label: " ", targetCount: 0, completedCount: 0 }],
      },
    }),
  ).toEqual({ hasFacts: false });
});
test("substantive data from October is not excluded by October start", () => {
  expect(
    facts({
      ...base,
      monthlyGoals: Object.assign(Array(12).fill(0), { 9: 5 }),
      monthlyNotes: Object.assign(Array(12).fill(""), { 9: "Información" }),
    }),
  ).toEqual({ hasFacts: false });
});
