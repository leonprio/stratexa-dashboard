import React, { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { RelatedActionPlans } from "./RelatedActionPlans";
import { CurrentPeriodFocus } from "./CurrentPeriodFocus";
import { firebaseService } from "../services/firebaseService";
import type { ActionPlan, DashboardItem } from "../types";

jest.mock("../services/firebaseService", () => ({ firebaseService: {
  getActionPlansForIndicator: jest.fn(), createActionPlan: jest.fn(), updateActionPlan: jest.fn(),
} }));

const props = { indicatorId: 2, dashboardId: 10, clientId: "LEON", year: 2026, periodType: "monthly" as const, periodIndex: 8, canEdit: true };
const existing: ActionPlan = { id: "existing", indicatorId: 2, dashboardId: 10, clientId: "LEON", title: "Plan anterior", originYear: 2025, originPeriodType: "monthly", originPeriodIndex: 1, status: "planned", startDate: "2025-02-01", progress: 0, createdAt: "", updatedAt: "", activities: [] };

function FocusHarness({ plansCollapsed }: { plansCollapsed: boolean }) {
  const [collapsed, setCollapsed] = useState(plansCollapsed);
  return <RelatedActionPlans {...props} collapsed={collapsed} onToggle={() => setCollapsed(value => !value)} />;
}

beforeEach(() => jest.resetAllMocks());

test.each([true, false].flatMap(collapsed => [0, 1].map(count => ({ collapsed, count }))))(
  "creation CTA opens and saves with collapsed=$collapsed and existing plans=$count",
  async ({ collapsed, count }) => {
    let stored = count ? [existing] : [];
    (firebaseService.getActionPlansForIndicator as jest.Mock).mockImplementation(async () => [...stored, ...stored]);
    let resolveSave!: () => void;
    (firebaseService.createActionPlan as jest.Mock).mockImplementation((draft: ActionPlan) => new Promise<void>(resolve => {
      resolveSave = () => { stored = [...stored, { ...draft, id: "created" }]; resolve(); };
    }));
    render(<FocusHarness plansCollapsed={collapsed} />);
    const create = await screen.findByRole("button", { name: /Nuevo plan/ });
    expect(create).toBeVisible();
    fireEvent.click(create);
    const name = screen.getByLabelText("Nombre del plan");
    expect(name).toBeVisible();
    fireEvent.change(name, { target: { value: "Recuperar resultado" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar plan" }));
    expect(screen.getByRole("button", { name: "Guardando…" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Guardando…" }));
    expect(firebaseService.createActionPlan).toHaveBeenCalledTimes(1);
    expect(firebaseService.createActionPlan).toHaveBeenCalledWith(expect.objectContaining({
      id: "", indicatorId: 2, dashboardId: 10, clientId: "LEON", title: "Recuperar resultado",
      originYear: 2026, originPeriodType: "monthly", originPeriodIndex: 8, status: "planned", progress: 0, activities: [],
    }));
    resolveSave();
    await waitFor(() => expect(screen.queryByLabelText("Nombre del plan")).not.toBeInTheDocument());
    expect(screen.getAllByText("Recuperar resultado")).toHaveLength(1);
    expect(screen.getByText(/Planes relacionados/)).toBeVisible();
    expect(screen.getByText(new RegExp(`${count + 1} plan(es)? relacionado`))).toBeInTheDocument();
    expect(firebaseService.updateActionPlan).not.toHaveBeenCalled();
    if (count) expect(stored[0]).toEqual(existing);
  },
);

test.each([true, false])("read-only has no creation CTA, collapsed=%s", async collapsed => {
  (firebaseService.getActionPlansForIndicator as jest.Mock).mockResolvedValue([existing]);
  render(<RelatedActionPlans {...props} canEdit={false} collapsed={collapsed} />);
  await waitFor(() => expect(screen.queryByText("Cargando planes…")).not.toBeInTheDocument());
  expect(screen.queryByRole("button", { name: /Nuevo plan/ })).not.toBeInTheDocument();
});

test.each(["monthly", "weekly"] as const)("KPI focus opens first plan with the selected %s period", async frequency => {
  (firebaseService.getActionPlansForIndicator as jest.Mock).mockResolvedValue([]);
  const item: DashboardItem = { id: 2, indicator: "Ventas", weight: 1, frequency, indicatorType: "simple", type: "accumulative", unit: "ventas", goalType: "maximize", monthlyGoals: Array(12).fill(null), monthlyProgress: Array(12).fill(null), weeklyGoals: Array(53).fill(null), weeklyProgress: Array(53).fill(null) };
  render(<CurrentPeriodFocus item={item} globalThresholds={{ onTrack: 90, atRisk: 80 }} year={2026} dashboardId={10} clientId="LEON" canEdit canEditPlans onUpdateItem={jest.fn()} onClose={jest.fn()} controlTarget={{ clientId: "LEON", dashboardId: 10, itemId: 2, operation: "REGISTRAR_AVANCE", origin: "control", period: frequency === "monthly" ? { frequency, year: 2026, monthIndex: 8 } : { frequency, year: 2026, weekNumber: 39 } }} />);
  fireEvent.click(await screen.findByRole("button", { name: /Nuevo plan/ }));
  expect(screen.getByLabelText("Nombre del plan")).toBeVisible();
  fireEvent.change(screen.getByLabelText("Nombre del plan"), { target: { value: "Plan de corte" } });
  fireEvent.click(screen.getByRole("button", { name: "Guardar plan" }));
  await waitFor(() => expect(firebaseService.createActionPlan).toHaveBeenCalledWith(expect.objectContaining({ clientId: "LEON", dashboardId: 10, indicatorId: 2, originYear: 2026, originPeriodType: frequency, originPeriodIndex: frequency === "monthly" ? 8 : 38 })));
});
