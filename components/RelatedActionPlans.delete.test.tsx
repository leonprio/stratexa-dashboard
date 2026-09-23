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
    fireEvent.click((await screen.findAllByRole("button", { name: "Editar plan" })).at(-1)!);
    fireEvent.click(screen.getByRole("button", { name: "Editar plan" }));
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

  test("initialPlanId opens the exact plan compactly until plan editing is requested", async () => {
    const other = { ...plan, id: "plan-2", title: "Otro plan" };
    (firebaseService.getActionPlansForIndicator as jest.Mock).mockResolvedValue([plan, other]);
    render(<RelatedActionPlans {...props} initialPlanId="plan-2" />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Contraer plan" })).toBeInTheDocument());
    expect(screen.getByText("Otro plan")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Otro plan")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Fecha compromiso del plan")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "VER RESULTADO Y NOTA" })).toBeInTheDocument();
    fireEvent.click((await screen.findAllByRole("button", { name: "Editar plan" })).at(-1)!);
    await waitFor(() => expect(screen.getByLabelText("Nombre del plan")).toHaveValue("Otro plan"));
  });

  test("result and impact stay available after update/edit, and can be collapsed from the same control", async () => {
    (firebaseService.getActionPlansForIndicator as jest.Mock).mockResolvedValue([plan]);
    render(<RelatedActionPlans {...props} initialPlanId="plan-1" />);
    const resultToggle = await screen.findByRole("button", { name: "VER RESULTADO Y NOTA" });
    fireEvent.click(resultToggle);
    expect(screen.getByText("Sin resultado registrado.")).toBeInTheDocument();
    expect(screen.getByText("Impacto declarado:").parentElement).toHaveTextContent("Por evaluar");
    fireEvent.click(screen.getByRole("button", { name: "ACTUALIZAR" }));
    expect(screen.getByRole("button", { name: "VER RESULTADO Y NOTA" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "VER RESULTADO Y NOTA" }));
    fireEvent.click(screen.getByRole("button", { name: "OCULTAR RESULTADO Y NOTA" }));
    expect(screen.queryByText("Sin resultado registrado.")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "VER RESULTADO Y NOTA" }));
    fireEvent.click(screen.getByRole("button", { name: "EDITAR" }));
    expect(screen.getByRole("button", { name: "VER RESULTADO Y NOTA" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ocultar edición" }));
    expect(screen.getByRole("button", { name: "VER RESULTADO Y NOTA" })).toBeInTheDocument();
  });

  test("ACTUALIZAR edits impact in the plan draft, saves explicitly, and cancel discards local changes", async () => {
    (firebaseService.getActionPlansForIndicator as jest.Mock).mockResolvedValue([plan]);
    (firebaseService.updateActionPlan as jest.Mock).mockResolvedValue(true);
    const view = render(<RelatedActionPlans {...props} initialPlanId="plan-1" />);
    fireEvent.click(await screen.findByRole("button", { name: "ACTUALIZAR" }));
    expect(screen.getByText(/únicamente con “Guardar plan”/i)).toBeInTheDocument();
    expect(screen.getAllByRole("combobox")).toHaveLength(1);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "FAVORABLE" } });
    expect(screen.getByLabelText("Impacto")).toHaveValue("FAVORABLE");
    expect(screen.getByText(/1 favorable/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Guardar plan" }));
    await waitFor(() => expect(firebaseService.updateActionPlan).toHaveBeenCalledWith("plan-1", expect.objectContaining({ activities: [expect.objectContaining({ id: "a1", impact: "FAVORABLE" })] })));

    (firebaseService.getActionPlansForIndicator as jest.Mock).mockResolvedValue([plan]);
    view.rerender(<RelatedActionPlans {...props} initialPlanId="plan-1" />);
    fireEvent.click(await screen.findByRole("button", { name: "ACTUALIZAR" }));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "LOW_OR_NONE" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(firebaseService.updateActionPlan).toHaveBeenCalledTimes(1);
  });

  test("read-only users can consult result and impact without mutation actions", async () => {
    (firebaseService.getActionPlansForIndicator as jest.Mock).mockResolvedValue([plan]);
    render(<RelatedActionPlans {...props} canEdit={false} initialPlanId="plan-1" />);
    fireEvent.click(await screen.findByRole("button", { name: "VER RESULTADO Y NOTA" }));
    expect(screen.getByText("Sin resultado registrado.")).toBeInTheDocument();
    expect(screen.getByText("Impacto declarado:").parentElement).toHaveTextContent("Por evaluar");
    expect(screen.queryByRole("button", { name: "EDITAR RESULTADO E IMPACTO" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "ACTUALIZAR" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "EDITAR" })).not.toBeInTheDocument();
  });

  test("result expansion is independent for two stable activity IDs", async () => {
    const twoActivities = { ...plan, activities: [
      { ...plan.activities[0], id: "a1", title: "Actividad uno", result: "Resultado uno" },
      { ...plan.activities[0], id: "a2", title: "Actividad dos", result: "Resultado dos" },
    ] };
    (firebaseService.getActionPlansForIndicator as jest.Mock).mockResolvedValue([twoActivities]);
    render(<RelatedActionPlans {...props} initialPlanId="plan-1" />);
    const toggles = await screen.findAllByRole("button", { name: "VER RESULTADO Y NOTA" });
    expect(toggles).toHaveLength(2);
    fireEvent.click(toggles[0]);
    expect(screen.getByText("Resultado uno")).toBeInTheDocument();
    expect(screen.queryByText("Resultado dos")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "VER RESULTADO Y NOTA" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "OCULTAR RESULTADO Y NOTA" }));
    expect(screen.queryByText("Resultado uno")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "VER RESULTADO Y NOTA" })).toHaveLength(2);
  });

  test("keeps plan, quick, and full activity modes exclusive while retaining the local draft", async () => {
    (firebaseService.getActionPlansForIndicator as jest.Mock).mockResolvedValue([plan]);
    render(<RelatedActionPlans {...props} />);
    fireEvent.click(await screen.findByRole("button", { name: "Editar plan" }));

    fireEvent.click(screen.getByRole("button", { name: "Editar plan" }));
    expect(screen.getByLabelText("Fecha compromiso del plan")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Nombre del plan"), { target: { value: "Plan en borrador" } });

    fireEvent.click(screen.getByRole("button", { name: "EDITAR" }));
    expect(screen.queryByLabelText("Fecha compromiso del plan")).not.toBeInTheDocument();
    const activityName = screen.getByLabelText("Nombre de la actividad");
    fireEvent.change(activityName, { target: { value: "Borrador conservado" } });
    fireEvent.click(screen.getByRole("button", { name: "Ocultar edición" }));
    expect(screen.queryByLabelText("Nombre de la actividad")).not.toBeInTheDocument();
    expect(screen.getByText("Borrador conservado")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "ACTUALIZAR" }));
    expect(screen.getByLabelText("Nota breve")).toBeInTheDocument();
    expect(screen.getByLabelText("Impacto")).toBeInTheDocument();
    expect(screen.getAllByRole("combobox")).toHaveLength(1);
    expect(screen.queryByLabelText("Fecha compromiso")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "EDITAR" }));
    expect(screen.queryByLabelText("Nota breve")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Impacto")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Nombre de la actividad")).toBeInTheDocument();
    expect(screen.queryByLabelText("Resultado / nota")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "VER RESULTADO Y NOTA" }));
    expect(screen.getByText("Resultado o nota:")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ocultar edición" }));
    fireEvent.click(screen.getByRole("button", { name: "EDITAR" }));
    expect(screen.queryByLabelText("Resultado / nota")).not.toBeInTheDocument();
    expect(screen.getByDisplayValue("Borrador conservado")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Editar plan" }));
    expect(screen.queryByLabelText("Nombre de la actividad")).not.toBeInTheDocument();
    expect(screen.getByDisplayValue("Plan en borrador")).toBeInTheDocument();
  });

  test("does not contaminate the executive summary with an empty activity draft", async () => {
    const twoActivities = { ...plan, activities: [
      { ...plan.activities[0], id: "a1", progress: 90, title: "Actividad A" },
      { ...plan.activities[0], id: "a2", progress: 40, title: "Actividad B" },
    ] };
    (firebaseService.getActionPlansForIndicator as jest.Mock).mockResolvedValue([twoActivities]);
    render(<RelatedActionPlans {...props} />);
    fireEvent.click(await screen.findByRole("button", { name: "Editar plan" }));
    expect(screen.getByText(/65%/)).toBeInTheDocument();
    expect(screen.getByText(/2 actividades/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Agregar actividad/ }));
    expect(screen.getByLabelText("Nombre de la actividad")).toHaveFocus();
    expect(screen.getByText(/65%/)).toBeInTheDocument();
    expect(screen.getByText(/2 actividades/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Descartar actividad" }));
    expect(screen.queryByLabelText("Nombre de la actividad")).not.toBeInTheDocument();
    expect(screen.getByText(/65%/)).toBeInTheDocument();
    expect(firebaseService.updateActionPlan).not.toHaveBeenCalled();
  });

  test("deletes a persisted activity from the compact card only after confirmation", async () => {
    (firebaseService.getActionPlansForIndicator as jest.Mock).mockResolvedValue([plan]);
    (firebaseService.updateActionPlan as jest.Mock).mockResolvedValue(true);
    render(<RelatedActionPlans {...props} />);
    fireEvent.click(await screen.findByRole("button", { name: "Editar plan" }));
    fireEvent.click(screen.getByRole("button", { name: /Eliminar actividad Actividad/ }));
    const dialog = screen.getByRole("alertdialog", { name: "¿Eliminar esta actividad?" });
    expect(dialog).toHaveTextContent("Actividad");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    expect(screen.getByText("Actividad")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Eliminar actividad Actividad/ }));
    fireEvent.click(within(screen.getByRole("alertdialog", { name: "¿Eliminar esta actividad?" })).getByRole("button", { name: "Eliminar actividad" }));
    expect(screen.queryByText("Actividad")).not.toBeInTheDocument();
    expect(firebaseService.deleteActionPlan).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Guardar plan" }));
    await waitFor(() => expect(firebaseService.updateActionPlan).toHaveBeenCalledWith("plan-1", expect.objectContaining({ activities: [] })));
  });

  test("new unsaved plan never exposes delete", async () => {
    (firebaseService.getActionPlansForIndicator as jest.Mock).mockResolvedValue([]);
    render(<RelatedActionPlans {...props} collapsed onToggle={jest.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: /Nuevo plan/ }));
    expect(screen.queryByRole("button", { name: "Eliminar plan" })).not.toBeInTheDocument();
  });

  test("confirm deletes only the exact scoped document and refreshes without reload", async () => {
    (firebaseService.getActionPlansForIndicator as jest.Mock).mockResolvedValueOnce([plan]).mockResolvedValueOnce([]);
    (firebaseService.deleteActionPlan as jest.Mock).mockResolvedValue(true);
    render(<RelatedActionPlans {...props} />);
    fireEvent.click(await screen.findByRole("button", { name: "Editar plan" }));
    fireEvent.click(screen.getByRole("button", { name: "Editar plan" }));
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

  test("edits and persists the plan commitment date without changing its KPI origin", async () => {
    (firebaseService.getActionPlansForIndicator as jest.Mock).mockResolvedValue([plan]);
    (firebaseService.updateActionPlan as jest.Mock).mockResolvedValue(true);
    render(<RelatedActionPlans {...props} />);
    fireEvent.click(await screen.findByRole("button", { name: "Editar plan" }));
    fireEvent.click(screen.getByRole("button", { name: "Editar plan" }));
    const targetDate = screen.getByLabelText("Fecha compromiso del plan");
    fireEvent.change(targetDate, { target: { value: "2026-09-30" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar plan" }));
    await waitFor(() => expect(firebaseService.updateActionPlan).toHaveBeenCalledWith(
      "plan-1",
      expect.objectContaining({ targetDate: "2026-09-30", originYear: 2026, originPeriodIndex: 35 }),
    ));
  });

  test("replaces the executive card while editing and restores it on cancel", async () => {
    (firebaseService.getActionPlansForIndicator as jest.Mock).mockResolvedValue([plan]);
    render(<RelatedActionPlans {...props} />);
    fireEvent.click(await screen.findByRole("button", { name: "Editar plan" }));
    fireEvent.click(screen.getByRole("button", { name: "Editar plan" }));
    expect(screen.queryByRole("button", { name: "Editar plan" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar plan" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(await screen.findByRole("button", { name: "Editar plan" })).toBeInTheDocument();
  });

  test("adds a local activity at the end, focuses its name, and keeps update modes exclusive", async () => {
    (firebaseService.getActionPlansForIndicator as jest.Mock).mockResolvedValue([plan]);
    render(<RelatedActionPlans {...props} />);
    fireEvent.click(await screen.findByRole("button", { name: "Editar plan" }));
    fireEvent.click(screen.getByRole("button", { name: "Editar plan" }));
    fireEvent.click(screen.getByRole("button", { name: /Agregar actividad/ }));
    const name = screen.getByLabelText("Nombre de la actividad");
    expect(name).toHaveFocus();
    fireEvent.change(name, { target: { value: "Actividad ficticia nueva" } });
    expect(screen.getAllByText("Actividad ficticia nueva").length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole("button", { name: "ACTUALIZAR" })[0]);
    expect(screen.queryByLabelText("Nombre de la actividad")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Nota breve")).toBeInTheDocument();
  });

  test("rejects an unnamed new activity and cancel removes only that local draft", async () => {
    (firebaseService.getActionPlansForIndicator as jest.Mock).mockResolvedValue([plan]);
    render(<RelatedActionPlans {...props} />);
    fireEvent.click(await screen.findByRole("button", { name: "Editar plan" }));
    fireEvent.click(screen.getByRole("button", { name: /Agregar actividad/ }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar plan" }));
    expect(await screen.findByText("Escribe un nombre antes de guardar la actividad.")).toBeInTheDocument();
    expect(firebaseService.updateActionPlan).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Descartar actividad" }));
    expect(screen.queryByText("Nueva actividad")).not.toBeInTheDocument();
    expect(screen.getByText("Actividad")).toBeInTheDocument();
  });

  test("does not expose the plans toggle while a zero-plan query is complete", async () => {
    (firebaseService.getActionPlansForIndicator as jest.Mock).mockResolvedValue([]);
    render(<RelatedActionPlans {...props} collapsed onToggle={jest.fn()} />);
    expect(await screen.findByRole("button", { name: /Nuevo plan/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Ver planes/i })).not.toBeInTheDocument();
  });

  test("one plan opens its executable activity cards without a second plan-view step", async () => {
    (firebaseService.getActionPlansForIndicator as jest.Mock).mockResolvedValue([plan]);
    const onToggle = jest.fn();
    const view = render(<RelatedActionPlans {...props} collapsed onToggle={onToggle} />);
    expect(await screen.findByRole("button", { name: /Ver planes/i })).toBeInTheDocument();
    view.rerender(<RelatedActionPlans {...props} collapsed={false} onToggle={onToggle} />);
    expect(await screen.findByText("Actividad")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ACTUALIZAR" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "EDITAR" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Eliminar actividad Actividad/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "VER PLAN" })).not.toBeInTheDocument();
  });
});
