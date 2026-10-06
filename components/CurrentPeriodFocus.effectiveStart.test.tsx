import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { CurrentPeriodFocus } from "./CurrentPeriodFocus";
import type { DashboardItem } from "../types";
const base: DashboardItem = {
  id: "k",
  indicator: "H07 KPI",
  weight: 1,
  frequency: "monthly",
  type: "accumulative",
  goalType: "maximize",
  unit: "u",
  monthlyGoals: Array(12).fill(0),
  monthlyProgress: Array(12).fill(0),
};
const month = (index: number) => ({
  frequency: "monthly" as const,
  year: 2026,
  monthIndex: index,
});
const cases: Array<[string, Partial<DashboardItem>, boolean, string?]> = [
  ["no record", { monthlyGoals: [], monthlyProgress: [] }, false],
  ["technical 0/0", {}, false],
  [
    "false markers",
    {
      monthlyGoalCaptured: Array(12).fill(false),
      monthlyProgressCaptured: Array(12).fill(false),
    },
    false,
  ],
  ["real record August/September allows October", {
    monthlyGoalCaptured: Object.assign(Array(12).fill(false), {7:true,8:true}),
    monthlyProgress: Object.assign(Array(12).fill(0), {7:null,8:null}),
    monthlyProgressCaptured: Array(12).fill(false), monthlyNotes: Array(12).fill(''),
    activityConfig: {7:[],8:[]}, continuityCommitments: {}, isActivityMode: true,
  }, false],
  ["isolated historical zero goal", { monthlyGoalCaptured: [true] }, false],
  [
    "explicit zero progress",
    { monthlyProgressCaptured: [true] },
    true,
    "Enero",
  ],
  ["positive goal", { monthlyGoals: [10] }, true, "Enero"],
  ["positive progress", { monthlyProgress: [5] }, true, "Enero"],
  ["real note", { monthlyNotes: ["Incidencia con evidencia"] }, true, "Enero"],
  ["blank note", { monthlyNotes: ["  "] }, false],
  [
    "continuity origin",
    {
      continuityCommitments: {
        c: {
          id: "c",
          sourceKpiId: "k",
          sourceType: "SIMPLE_KPI",
          originYear: 2026,
          originPeriod: 0,
          originalTarget: 0,
          scheduledYear: 2026,
          scheduledPeriod: 9,
          progressByPeriod: {},
          status: "active",
          resolutionHistory: [],
        },
      },
    },
    true,
    "Enero",
  ],
  [
    "blank activity draft",
    {
      activityConfig: {
        0: [{ id: "draft", label: " ", targetCount: 0, completedCount: 0 }],
      },
    },
    false,
  ],
  [
    "later note",
    { monthlyNotes: Object.assign(Array(12).fill(""), { 9: "Octubre" }) },
    false,
  ],
  ["empty activity list", { activityConfig: { 0: [] } }, false],
  [
    "real activity",
    {
      activityConfig: {
        0: [
          {
            id: "a",
            label: "Actividad real",
            targetCount: 0,
            completedCount: 0,
          },
        ],
      },
    },
    true,
    "Enero",
  ],
  [
    "later data",
    { monthlyGoals: Object.assign(Array(12).fill(0), { 9: 10, 10: 20 }) },
    false,
  ],
  [
    "first real period",
    { monthlyGoals: Object.assign(Array(12).fill(0), { 3: 10 }) },
    true,
    "Abril",
  ],
];
const mount = (
  item: DashboardItem,
  onUpdateItem = jest.fn().mockResolvedValue(undefined),
) => {
  render(
    <CurrentPeriodFocus
      item={item}
      allDashboardItems={[item]}
      year={2026}
      globalThresholds={{ onTrack: 90, atRisk: 80 }}
      canEdit
      canConfigureTracking
      onUpdateItem={onUpdateItem}
      onClose={jest.fn()}
      controlTarget={{
        clientId: "A",
        dashboardId: "D",
        itemId: "k",
        period: month(0),
        operation: "REGISTRAR_AVANCE",
        origin: "control",
      }}
    />,
  );
  return onUpdateItem;
};
const requestOctober = () => {
  fireEvent.click(screen.getByRole("button", { name: "Definir excepción" }));
  fireEvent.change(screen.getByLabelText("Mes de inicio de seguimiento"), {
    target: { value: "9" },
  });
  fireEvent.click(screen.getByRole("button", { name: "GUARDAR EXCEPCIÓN" }));
};
beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = jest.fn();
});
test.each(
  cases.map(([name, overrides, blocked, first]) => [
    name,
    overrides,
    blocked,
    first,
  ]),
)("H07 %s", async (_name, overrides, blocked, first) => {
  const item = { ...base, ...overrides };
  const original = JSON.stringify(item),
    save = mount(item);
  requestOctober();
  if (blocked) {
    expect(
      screen.getByText(/ya tiene información registrada/),
    ).toHaveTextContent(first + " 2026");
    expect(
      screen.queryByRole("button", { name: "GUARDAR" }),
    ).not.toBeInTheDocument();
    expect(save).not.toHaveBeenCalled();
  } else {
    fireEvent.click(screen.getByRole("button", { name: "GUARDAR" }));
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith({
        ...item,
        trackingStartPeriod: month(9),
      }),
    );
  }
  expect(JSON.stringify(item)).toBe(original);
});
test("saving an untouched technical zero does not promote it to explicit capture", async () => {
  const save = mount({ ...base });
  fireEvent.click(screen.getByRole("button", { name: "Guardar Cambios" }));
  await waitFor(() => expect(save).toHaveBeenCalled());
  expect(save.mock.calls[0][0].monthlyGoalCaptured[0]).toBe(false);
});
test("typing zero explicitly is capture evidence", async () => {
  const save = mount({ ...base });
  fireEvent.change(document.getElementById("goal-input")!, {
    target: { value: "0.0" },
  });
  fireEvent.change(document.getElementById("actual-input")!, {
    target: { value: "0" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Guardar Cambios" }));
  await waitFor(() => expect(save).toHaveBeenCalled());
  expect(save.mock.calls[0][0].monthlyGoalCaptured[0]).toBe(true);
  expect(save.mock.calls[0][0].monthlyProgressCaptured[0]).toBe(true);
});

test.each([undefined, false, true])(
  "untouched zero retains capture evidence %s",
  async (marker) => {
    const item = {
      ...base,
      monthlyGoalCaptured: marker === undefined ? undefined : [marker],
    };
    const save = mount(item);
    fireEvent.click(screen.getByRole("button", { name: "Guardar Cambios" }));
    await waitFor(() => expect(save).toHaveBeenCalled());
    const saved = save.mock.calls[0][0];
    expect(saved.monthlyGoals[0]).toBe(0);
    expect(saved.monthlyGoalCaptured[0]).toBe(marker === true);
  },
);

test("save untouched January then move start to October without deleting its stored zero", async () => {
  const save = mount({ ...base });
  fireEvent.click(screen.getByRole("button", { name: "Guardar Cambios" }));
  await waitFor(() => expect(save).toHaveBeenCalled());
  const saved = save.mock.calls[0][0];
  cleanup();
  const saveStart = mount(saved);
  requestOctober();
  fireEvent.click(screen.getByRole("button", { name: "GUARDAR" }));
  await waitFor(() =>
    expect(saveStart).toHaveBeenCalledWith({
      ...saved,
      trackingStartPeriod: month(9),
    }),
  );
  expect(saveStart.mock.calls[0][0].monthlyGoals[0]).toBe(0);
});
