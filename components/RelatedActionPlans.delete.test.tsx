import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { firebaseService } from "../services/firebaseService";
import { RelatedActionPlans } from "./RelatedActionPlans";

jest.mock("../services/firebaseService", () => ({
  firebaseService: {
    getActionPlansForIndicator: jest.fn(),
    deleteActionPlan: jest.fn(),
    updateActionPlan: jest.fn(),
    createActionPlan: jest.fn(),
  },
}));

const plan: any = {
  id: "plan-1",
  indicatorId: 2,
  dashboardId: 10,
  clientId: "LEON",
  title: "Plan de prueba",
  originYear: 2026,
  originPeriodType: "weekly",
  originPeriodIndex: 35,
  status: "in_progress",
  startDate: "2026-08-01",
  progress: 20,
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-02T00:00:00.000Z",
  activities: [{ id: "a1", title: "Actividad", progress: 20, createdAt: "2026-08-01T00:00:00.000Z", updatedAt: "2026-08-01T00:00:00.000Z" }],
};
const props = { indicatorId: 2, dashboardId: 10, clientId: "LEON", year: 2026, periodType: "weekly" as const, periodIndex: 35, canEdit: true };

describe("RelatedActionPlans delete contract", () => {
  beforeEach(() => jest.clearAllMocks());

  test("existing plan shows inline confirmation and cancel does not delete", async () => {
    (firebaseService.getActionPlansForIndicator as jest.Mock).mockResolvedValue([plan]);
    render(<RelatedActionPlans {...props} />);
    fireEvent.click(await screen.findByRole("button", { name: "Editar" }));
    fireEvent.click(screen.getByRole("button", { name: "Eliminar plan" }));
    expect(screen.getByRole("alertdialog", { name: "¿Eliminar este plan?" })).toBeInTheDocument();
    fireEvent.click(
      within(screen.getByRole("alertdialog", { name: "¿Eliminar este plan?" })).getByRole(
        "button",
        { name: "Cancelar" },
      ),
    );
    expect(firebaseService.deleteActionPlan).not.toHaveBeenCalled();
  });

  test("new unsaved plan never exposes delete", async () => {
    (firebaseService.getActionPlansForIndicator as jest.Mock).mockResolvedValue([]);
    render(<RelatedActionPlans {...props} />);
    fireEvent.click(await screen.findByRole("button", { name: /Nuevo plan/ }));
    expect(screen.queryByRole("button", { name: "Eliminar plan" })).not.toBeInTheDocument();
  });

  test("confirm deletes only the exact scoped document and refreshes without reload", async () => {
    (firebaseService.getActionPlansForIndicator as jest.Mock).mockResolvedValueOnce([plan]).mockResolvedValueOnce([]);
    (firebaseService.deleteActionPlan as jest.Mock).mockResolvedValue(true);
    render(<RelatedActionPlans {...props} />);
    fireEvent.click(await screen.findByRole("button", { name: "Editar" }));
    fireEvent.click(screen.getByRole("button", { name: "Eliminar plan" }));
    fireEvent.click(
      within(screen.getByRole("alertdialog", { name: "¿Eliminar este plan?" })).getByRole(
        "button",
        { name: "Eliminar plan" },
      ),
    );
    await waitFor(() => expect(firebaseService.deleteActionPlan).toHaveBeenCalledWith("LEON", "plan-1"));
    await waitFor(() => expect(screen.queryByText("Plan de prueba")).not.toBeInTheDocument());
    expect(firebaseService.updateActionPlan).not.toHaveBeenCalled();
  });
});
