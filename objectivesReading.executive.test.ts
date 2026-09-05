import { buildObjectiveExecutiveDiagnosis, buildObjectiveExecutionSummary, buildObjectiveNextDecision } from "./objectivesReading";

describe("executive objective reading contracts", () => {
  const base = (indicator: string, status: any, score: number | null) => ({ indicator, status, score });
  test("prioritizes the lowest critical KPI", () => {
    expect(buildObjectiveExecutiveDiagnosis([base("Reuniones", "CRÍTICO", 53), base("Prospectos", "REQUIERE ATENCIÓN", 84)])).toContain("Reuniones (53%)");
  });
  test("returns favorable and neutral messages", () => {
    expect(buildObjectiveExecutiveDiagnosis([base("Ingresos", "BAJO CONTROL", 99)])).toBe("Todos los indicadores evaluables están bajo control.");
    expect(buildObjectiveExecutiveDiagnosis([base("Nuevas asesorías", "NO EVALUABLE", null)])).toContain("No existen indicadores evaluables");
    expect(buildObjectiveExecutiveDiagnosis([base("Aplicaciones", "BAJO CONTROL", 100), base("Nuevas asesorías", "NO EVALUABLE", null)])).toContain("No existen indicadores evaluables");
  });
  test("deduplicates plans and derives active, overdue, and impact metrics", () => {
    const plan: any = { id: "p1", status: "in_progress", activities: [{ id: "a1", progress: 20, targetDate: "2020-01-01", impact: "PARTIAL" }, { id: "a2", progress: 100, impact: "LOW_OR_NONE" }] };
    expect(buildObjectiveExecutionSummary([plan, plan], new Date("2026-01-01"))).toEqual({ activePlans: 1, activeActivities: 1, overdueActivities: 1, impact: { favorable: 0, partial: 1, low: 1, notEvaluated: 0 } });
  });
  test("emits only deterministic actionable decisions", () => {
    const critical = [base("Reuniones", "CRÍTICO", 53)];
    const emptyExecution = { activePlans: 0, activeActivities: 0, overdueActivities: 0, impact: { favorable: 0, partial: 0, low: 0, notEvaluated: 0 } };
    expect(buildObjectiveNextDecision(critical, [], emptyExecution)?.label).toBe("Crear un plan para atender Reuniones.");
    expect(buildObjectiveNextDecision([base("Ingresos", "BAJO CONTROL", 99)], [], emptyExecution)).toBeNull();
  });
});
