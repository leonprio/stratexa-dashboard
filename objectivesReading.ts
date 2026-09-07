import type {
  ActionPlan,
  ComplianceStatus,
  ComplianceThresholds,
  DashboardItem,
} from "./types";
import {
  calculateCompliance,
  calculateMonthlyCompliancePercentage,
  resolveItemValues,
} from "./utils/compliance";

export type ExecutiveKpiStatus =
  | "BAJO CONTROL"
  | "REQUIERE ATENCIÓN"
  | "CRÍTICO"
  | "NO EVALUABLE"
  | "DATOS PENDIENTES";
export type ExecutiveTrend =
  | "MEJORA"
  | "ESTABLE"
  | "DETERIORO"
  | "SIN TENDENCIA";
export type HistoricalCompliancePoint = { periodIndex: number; value: number };
export type ExecutiveTargetGapReading = {
  actual: number | null;
  target: number | null;
  gap: number | null;
  delta: number | null;
  deltaLabel: "MEJORA" | "DETERIORO" | "ESTABLE" | "HISTORIAL INSUFICIENTE";
  series: HistoricalCompliancePoint[];
  targetSeries: Array<{ periodIndex: number; value: number }>;
};
export type StrategicStatus = "REQUIERE INTERVENCIÓN" | "REQUIERE ATENCIÓN" | "BAJO CONTROL" | "DATOS PENDIENTES" | "NO EVALUABLE" | "SIN INDICADORES";
export type StrategicStatusSummary = {
  status: StrategicStatus;
  criticalCount: number;
  attentionCount: number;
  underControlCount: number;
  notEvaluableCount: number;
  pendingDataCount: number;
  totalLogicalKpi: number;
};

export type ObjectiveExecutionSummary = {
  activePlans: number;
  activeActivities: number;
  overdueActivities: number;
  impact: { favorable: number; partial: number; low: number; notEvaluated: number };
};

export function buildObjectiveExecutionSummary(
  plans: ActionPlan[],
  now: Date = new Date(),
): ObjectiveExecutionSummary {
  const uniquePlans = Array.from(new Map(plans.map((plan) => [plan.id, plan])).values());
  const activities = uniquePlans.flatMap((plan) => plan.activities || []);
  const impact = { favorable: 0, partial: 0, low: 0, notEvaluated: 0 };
  for (const activity of activities) {
    if (activity.impact === "FAVORABLE" || activity.impact === "positive") impact.favorable++;
    else if (activity.impact === "PARTIAL") impact.partial++;
    else if (activity.impact === "LOW_OR_NONE" || activity.impact === "low" || activity.impact === "none") impact.low++;
    else impact.notEvaluated++;
  }
  return {
    activePlans: uniquePlans.length,
    activeActivities: activities.filter((activity) => activity.progress < 100).length,
    overdueActivities: activities.filter((activity) => activity.progress < 100 && activity.targetDate && new Date(activity.targetDate) < now).length,
    impact,
  };
}

export function buildObjectiveExecutiveDiagnosis(
  readings: Array<{ indicator: string; score: number | null; status: ExecutiveKpiStatus }>,
): string {
  const evaluable = readings.filter((reading) => reading.score !== null && reading.status !== "NO EVALUABLE");
  if (!evaluable.length) return "No existen indicadores evaluables suficientes para determinar la condición.";
  const outsideControl = evaluable.filter((reading) => reading.status !== "BAJO CONTROL");
  if (!outsideControl.length) {
    return evaluable.length < readings.length
      ? "No existen indicadores evaluables suficientes para determinar la condición."
      : "Todos los indicadores evaluables están bajo control.";
  }
  const priority = outsideControl.filter((reading) => reading.status === "CRÍTICO");
  const candidates = priority.length
    ? priority
    : outsideControl.filter((reading) => reading.status === "REQUIERE ATENCIÓN");
  const worst = [...(candidates.length ? candidates : outsideControl)].sort(
    (a, b) => (a.score ?? 0) - (b.score ?? 0),
  )[0];
  if (!worst) return "No existen indicadores evaluables suficientes para determinar la condición.";
  return `${outsideControl.length} de ${evaluable.length} indicadores requieren atención. La principal brecha está en ${worst.indicator} (${worst.score}%).`;
}

export function buildObjectiveNextDecision(
  readings: Array<{ indicator: string; score: number | null; status: ExecutiveKpiStatus }>,
  plans: ActionPlan[],
  execution: ObjectiveExecutionSummary,
): { label: string; indicator?: string } | null {
  const critical = readings.filter((reading) => reading.status === "CRÍTICO").sort((a, b) => (a.score ?? 0) - (b.score ?? 0))[0];
  if (critical) return plans.length ? { label: `Revisar ejecución e impacto del plan asociado a ${critical.indicator}.`, indicator: critical.indicator } : { label: `Crear un plan para atender ${critical.indicator}.`, indicator: critical.indicator };
  const attention = readings.filter((reading) => reading.status === "REQUIERE ATENCIÓN").sort((a, b) => (a.score ?? 0) - (b.score ?? 0))[0];
  if (attention && execution.overdueActivities > 0) return { label: `Resolver actividades vencidas asociadas a ${attention.indicator}.`, indicator: attention.indicator };
  return null;
}

export const executiveStatusFromCompliance = (
  status: ComplianceStatus,
): ExecutiveKpiStatus => {
  if (status === "OnTrack") return "BAJO CONTROL";
  if (status === "AtRisk") return "REQUIERE ATENCIÓN";
  if (status === "OffTrack") return "CRÍTICO";
  if (status === "InProgress") return "DATOS PENDIENTES";
  return "NO EVALUABLE";
};

export function buildHistoricalComplianceSeries(
  item: DashboardItem,
  contextItems: DashboardItem[],
  year: number,
  now: Date = new Date(),
): HistoricalCompliancePoint[] {
  const { monthlyProgress, monthlyGoals } = resolveItemValues(
    item,
    contextItems,
    year,
  );
  const lastAllowedPeriod =
    year < now.getFullYear()
      ? 11
      : year === now.getFullYear()
        ? now.getMonth()
        : -1;
  const lowerIsBetter = item.goalType === "minimize";

  return monthlyGoals.flatMap((goal, periodIndex) => {
    if (periodIndex > lastAllowedPeriod) return [];
    const progress = monthlyProgress[periodIndex];
    if (
      goal === null ||
      goal === undefined ||
      progress === null ||
      progress === undefined
    )
      return [];
    const numericGoal = Number(goal);
    const numericProgress = Number(progress);
    if (!Number.isFinite(numericGoal) || !Number.isFinite(numericProgress))
      return [];
    if (numericGoal === 0 && numericProgress === 0) return [];
    return [
      {
        periodIndex,
        value: calculateMonthlyCompliancePercentage(
          numericProgress,
          numericGoal,
          lowerIsBetter,
        ),
      },
    ];
  });
}

export function trendFromSeries(
  series: HistoricalCompliancePoint[],
): ExecutiveTrend {
  if (series.length < 2) return "SIN TENDENCIA";
  const previous = series[series.length - 2].value;
  const current = series[series.length - 1].value;
  if (current > previous) return "MEJORA";
  if (current < previous) return "DETERIORO";
  return "ESTABLE";
}

export function buildExecutiveKpiReading(
  item: DashboardItem,
  thresholds: ComplianceThresholds,
  contextItems: DashboardItem[],
  year: number,
  now: Date = new Date(),
) {
  const compliance = calculateCompliance(
    item,
    thresholds,
    year,
    "realTime",
    contextItems,
  );
  const series = buildHistoricalComplianceSeries(item, contextItems, year, now);
  return {
    score: compliance.isActive
      ? Math.round(compliance.overallPercentage)
      : null,
    status: executiveStatusFromCompliance(compliance.complianceStatus),
    trend: trendFromSeries(series),
    series,
  };
}

export function buildExecutiveTargetGapReading(
  item: DashboardItem,
  contextItems: DashboardItem[],
  year: number,
  now: Date = new Date(),
): ExecutiveTargetGapReading {
  const { monthlyProgress, monthlyGoals } = resolveItemValues(item, contextItems, year);
  const lastAllowedPeriod = year < now.getFullYear() ? 11 : year === now.getFullYear() ? now.getMonth() : -1;
  const points = monthlyGoals.flatMap((goal, periodIndex) => {
    const progress = monthlyProgress[periodIndex];
    if (periodIndex > lastAllowedPeriod || goal == null || progress == null) return [];
    const numericGoal = Number(goal);
    const numericProgress = Number(progress);
    if (!Number.isFinite(numericGoal) || !Number.isFinite(numericProgress) || (numericGoal === 0 && numericProgress === 0)) return [];
    return [{ periodIndex, actual: numericProgress, target: numericGoal, compliance: calculateMonthlyCompliancePercentage(numericProgress, numericGoal, item.goalType === "minimize") }];
  });
  const latest = points.at(-1);
  const previous = points.at(-2);
  const lowerIsBetter = item.goalType === "minimize";
  const gap = latest ? (lowerIsBetter ? latest.target - latest.actual : latest.actual - latest.target) : null;
  const delta = latest && previous ? latest.compliance - previous.compliance : null;
  const deltaLabel = delta == null ? "HISTORIAL INSUFICIENTE" : delta > 0 ? "MEJORA" : delta < 0 ? "DETERIORO" : "ESTABLE";
  return {
    actual: latest?.actual ?? null,
    target: latest?.target ?? null,
    gap,
    delta,
    deltaLabel,
    series: points.map(point => ({ periodIndex: point.periodIndex, value: point.compliance })),
    targetSeries: points.map(point => ({ periodIndex: point.periodIndex, value: 100 })),
  };
}

export function resolveStrategicStatus(statuses: ExecutiveKpiStatus[]): StrategicStatusSummary {
  const summary = {
    criticalCount: statuses.filter(status => status === "CRÍTICO").length,
    attentionCount: statuses.filter(status => status === "REQUIERE ATENCIÓN").length,
    underControlCount: statuses.filter(status => status === "BAJO CONTROL").length,
    notEvaluableCount: statuses.filter(status => status === "NO EVALUABLE").length,
    pendingDataCount: statuses.filter(status => status === "DATOS PENDIENTES").length,
    totalLogicalKpi: statuses.length,
  };
  const evaluableCount = summary.criticalCount + summary.attentionCount + summary.underControlCount;
  const status: StrategicStatus = !statuses.length ? "SIN INDICADORES"
    : summary.criticalCount > 0 ? "REQUIERE INTERVENCIÓN"
    : summary.attentionCount > 0 ? "REQUIERE ATENCIÓN"
    : evaluableCount > 0 && summary.underControlCount === evaluableCount ? "BAJO CONTROL"
    : evaluableCount === 0 && summary.pendingDataCount > 0 ? "DATOS PENDIENTES"
    : "NO EVALUABLE";
  return { status, ...summary };
}

export function objectiveExecutiveStatus(statuses: ExecutiveKpiStatus[]) {
  return resolveStrategicStatus(statuses).status;
}
