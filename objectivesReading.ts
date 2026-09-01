import type {
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

export function objectiveExecutiveStatus(statuses: ExecutiveKpiStatus[]) {
  if (statuses.length === 0) return "SIN INDICADORES" as const;
  if (statuses.includes("CRÍTICO")) return "REQUIERE INTERVENCIÓN" as const;
  if (statuses.includes("REQUIERE ATENCIÓN"))
    return "REQUIERE ATENCIÓN" as const;
  const evaluable = statuses.filter((status) => status === "BAJO CONTROL");
  if (evaluable.length > 0 && evaluable.length === statuses.length)
    return "BAJO CONTROL" as const;
  return "DATOS PENDIENTES" as const;
}
