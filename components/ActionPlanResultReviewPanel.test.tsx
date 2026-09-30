import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ActionPlanResultReviewPanel } from "./ActionPlanResultReviewPanel";
import { firebaseService } from "../services/firebaseService";
import type { ActionPlan, User } from "../types";

jest.mock("../services/firebaseService", () => ({ firebaseService: { recordActionPlanResultReview: jest.fn() } }));

const user = { id: "user-7", name: "Ana Revisora", email: "ana@example.test" } as User;
const plan: ActionPlan = {
  id: "plan-1", indicatorId: 12, dashboardId: 34, clientId: "ACME", title: "Mejorar tiempos",
  originYear: 2025, originPeriodType: "monthly", originPeriodIndex: 2, status: "completed",
  startDate: "2025-01-01", progress: 100, createdAt: "2025-01-01T00:00:00.000Z", updatedAt: "2025-02-01T00:00:00.000Z",
  activities: [{ id: "activity-1", title: "Ajuste", progress: 100, createdAt: "2025-01-01T00:00:00.000Z", updatedAt: "2025-01-01T00:00:00.000Z" }],
};
const baseProps = { plan, canEdit: true, currentUser: user, year: 2026, periodType: "monthly" as const, periodIndex: 5, onSaved: jest.fn() };
const resultReview = (id: string, reviewedAt: string, observedResult = id) => ({ id, reviewedAt, reviewedByLabel: "Ana Revisora", observedResult, effect: "FAVORABLE" as const, decision: "CLOSE" as const });

describe("ActionPlanResultReviewPanel", () => {
  beforeEach(() => jest.clearAllMocks());

  test("muestra el CTA solo a personas autorizadas y señala ejecución completada con efecto pendiente", () => {
    const { rerender } = render(<ActionPlanResultReviewPanel {...baseProps} />);
    expect(screen.getByRole("button", { name: "Revisar resultado" })).toBeInTheDocument();
    expect(screen.getByText("Ejecución completada · efecto pendiente")).toBeInTheDocument();
    rerender(<ActionPlanResultReviewPanel {...baseProps} canEdit={false} />);
    expect(screen.queryByRole("button", { name: "Revisar resultado" })).not.toBeInTheDocument();
    expect(screen.getByText("Ejecución completada · efecto pendiente")).toBeInTheDocument();
  });

  test("el formulario requiere resultado observado y presenta opciones en español", () => {
    render(<ActionPlanResultReviewPanel {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Revisar resultado" }));
    expect(screen.getByLabelText(/Resultado observado/)).toBeRequired();
    expect(screen.getByRole("option", { name: "Favorable" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Parcial" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Bajo o sin efecto" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "No evaluable" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Cerrar revisión" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Continuar" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Ajustar" })).toBeInTheDocument();
  });

  test("guarda la revisión simple con identidad y periodo del usuario actual sin cambiar avance ni status", async () => {
    const saved = { ...plan, resultReviews: [resultReview("r1", "2026-06-01T12:00:00.000Z", "Efecto favorable medido")] };
    (firebaseService.recordActionPlanResultReview as jest.Mock).mockResolvedValue(saved);
    render(<ActionPlanResultReviewPanel {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Revisar resultado" }));
    fireEvent.change(screen.getByLabelText(/Resultado observado/), { target: { value: "Efecto favorable medido" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar revisión" }));
    await waitFor(() => expect(firebaseService.recordActionPlanResultReview).toHaveBeenCalledTimes(1));
    const [planId, review, commitment] = (firebaseService.recordActionPlanResultReview as jest.Mock).mock.calls[0];
    expect(planId).toBe("plan-1");
    expect(review).toEqual(expect.objectContaining({ reviewedByUserId: "user-7", reviewedByLabel: "Ana Revisora", observedResult: "Efecto favorable medido", reviewYear: 2026, reviewPeriodType: "monthly", reviewPeriodIndex: 5 }));
    expect(commitment).toBeUndefined();
    expect(baseProps.onSaved).toHaveBeenCalledWith(saved);
    expect(saved.progress).toBe(100);
    expect(saved.status).toBe("completed");
  });

  test("bloquea doble envío y deja el formulario utilizable tras un error", async () => {
    let resolveSave!: (value: ActionPlan) => void;
    (firebaseService.recordActionPlanResultReview as jest.Mock).mockImplementation(() => new Promise((resolve) => { resolveSave = resolve; }));
    render(<ActionPlanResultReviewPanel {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Revisar resultado" }));
    fireEvent.change(screen.getByLabelText(/Resultado observado/), { target: { value: "Comportamiento medido" } });
    const submit = screen.getByRole("button", { name: "Guardar revisión" });
    fireEvent.click(submit);
    fireEvent.click(submit);
    expect(firebaseService.recordActionPlanResultReview).toHaveBeenCalledTimes(1);
    resolveSave(plan);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("se guardó correctamente"));

    (firebaseService.recordActionPlanResultReview as jest.Mock).mockRejectedValueOnce(new Error("Permiso denegado. Revisa el acceso al plan."));
    fireEvent.click(screen.getByRole("button", { name: "Revisar resultado" }));
    fireEvent.change(screen.getByLabelText(/Resultado observado/), { target: { value: "Segundo dato" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar revisión" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Permiso denegado");
    expect(screen.getByLabelText(/Resultado observado/)).toHaveValue("Segundo dato");
  });

  test("muestra historial descendente y funciona con un plan legacy sin revisiones", () => {
    const { rerender } = render(<ActionPlanResultReviewPanel {...baseProps} plan={{ ...plan, resultReviews: [resultReview("old", "2026-01-01T00:00:00.000Z", "Resultado antiguo"), resultReview("new", "2026-06-01T00:00:00.000Z", "Resultado reciente")] }} />);
    const rows = screen.getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("Resultado reciente");
    expect(rows[1]).toHaveTextContent("Resultado antiguo");
    rerender(<ActionPlanResultReviewPanel {...baseProps} plan={plan} />);
    expect(screen.getByText("Aún no hay revisiones registradas.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Revisar resultado" })).toBeInTheDocument();
  });

  test("permite crear actividad sucesora desde CONTINUE con progreso inicial cero", async () => {
    (firebaseService.recordActionPlanResultReview as jest.Mock).mockResolvedValue(plan);
    render(<ActionPlanResultReviewPanel {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Revisar resultado" }));
    fireEvent.change(screen.getByLabelText(/Resultado observado/), { target: { value: "Continúa la brecha" } });
    fireEvent.change(screen.getByLabelText("Decisión"), { target: { value: "CONTINUE" } });
    fireEvent.click(screen.getByText("Opciones adicionales"));
    fireEvent.change(screen.getByLabelText("Título de la actividad"), { target: { value: "Verificar resultado" } });
    fireEvent.change(screen.getByLabelText("Responsable (opcional)"), { target: { value: "Luis" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar revisión" }));
    await waitFor(() => expect(firebaseService.recordActionPlanResultReview).toHaveBeenCalled());
    expect((firebaseService.recordActionPlanResultReview as jest.Mock).mock.calls[0][2]).toEqual(expect.objectContaining({ type: "activity", activity: expect.objectContaining({ title: "Verificar resultado", responsible: "Luis", progress: 0 }) }));
  });

  test("permite crear plan sucesor desde ADJUST y conserva cliente, tablero e indicador", async () => {
    (firebaseService.recordActionPlanResultReview as jest.Mock).mockResolvedValue(plan);
    render(<ActionPlanResultReviewPanel {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Revisar resultado" }));
    fireEvent.change(screen.getByLabelText(/Resultado observado/), { target: { value: "Se necesita ajustar" } });
    fireEvent.change(screen.getByLabelText("Decisión"), { target: { value: "ADJUST" } });
    fireEvent.click(screen.getByText("Opciones adicionales"));
    fireEvent.click(screen.getByLabelText("Crear nuevo plan"));
    fireEvent.change(screen.getByLabelText("Nombre del nuevo plan"), { target: { value: "Plan ajustado" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar revisión" }));
    await waitFor(() => expect(firebaseService.recordActionPlanResultReview).toHaveBeenCalled());
    const successor = (firebaseService.recordActionPlanResultReview as jest.Mock).mock.calls[0][2].plan;
    expect(successor).toEqual(expect.objectContaining({ title: "Plan ajustado", clientId: "ACME", dashboardId: 34, indicatorId: 12, originYear: 2026, originPeriodIndex: 5 }));
  });

  test("CLOSE no muestra obligación de compromiso y fecha/evidencia siguen siendo opcionales", () => {
    render(<ActionPlanResultReviewPanel {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Revisar resultado" }));
    fireEvent.click(screen.getByText("Opciones adicionales"));
    expect(screen.queryByText("Siguiente compromiso (opcional)")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Próxima revisión (opcional)")).not.toBeRequired();
    expect(screen.getByLabelText("Referencia de evidencia (opcional)")).not.toBeRequired();
  });
});
