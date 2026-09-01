import React, { useMemo, useState } from "react";
import { calculateCompliance } from "../utils/compliance";
import type { Dashboard, DashboardItem } from "../types";
import type {
  ContributionIndicatorAssignment,
  ContributionObjective,
  StrategicObjective,
  StrategicPerspective,
} from "../strategyTypes";
import { resolveStrategicKpiOwnership } from "../strategyKpiOwnership";

type Props = {
  dashboard: Dashboard;
  dashboards?: Dashboard[];
  objectives: StrategicObjective[];
  perspectives: StrategicPerspective[];
  contributions: ContributionObjective[];
  assignments: ContributionIndicatorAssignment[];
  year: number;
  onNavigateToKpi?: (
    dashboardId: number | string,
    itemId: number | string,
  ) => void;
};

const statusFor = (score: number | null) =>
  score === null
    ? "RIESGO DE DATOS"
    : score < 70
      ? "CRÍTICO"
      : score < 90
        ? "REQUIERE ATENCIÓN"
        : "BAJO CONTROL";

export const ObjectivesView: React.FC<Props> = ({
  dashboard,
  dashboards = [],
  objectives,
  perspectives,
  contributions,
  assignments,
  year,
  onNavigateToKpi,
}) => {
  const [descending, setDescending] = useState(false);
  const sourceDashboards = useMemo(
    () =>
      Array.from(
        new Map(
          [dashboard, ...dashboards].map((d) => [String(d.id), d]),
        ).values(),
      ),
    [dashboard, dashboards],
  );
  const ownership = useMemo(
    () =>
      resolveStrategicKpiOwnership(
        sourceDashboards,
        objectives,
        contributions,
        assignments,
      ),
    [sourceDashboards, objectives, contributions, assignments],
  );
  const orderedObjectives = useMemo(
    () =>
      [...objectives].sort((a, b) => {
        const perspectiveOrder = new Map(
          perspectives.map((p) => [p.id, p.order || 0]),
        );
        const direction = descending ? -1 : 1;
        const perspectiveDiff =
          (perspectiveOrder.get(a.perspectiveId) || 0) -
          (perspectiveOrder.get(b.perspectiveId) || 0);
        if (perspectiveDiff) return direction * perspectiveDiff;
        const objectiveDiff = (a.order || 0) - (b.order || 0);
        return direction * (objectiveDiff || a.code.localeCompare(b.code));
      }),
    [objectives, perspectives, descending],
  );
  const score = (item: DashboardItem, source: Dashboard) =>
    calculateCompliance(item, source.thresholds, year, "realTime", source.items)
      .overallPercentage;
  const trend = (item: DashboardItem) => {
    const values = (item.monthlyProgress || [])
      .filter((v) => v !== null && v !== undefined)
      .map(Number);
    if (values.length < 2) return "ESTABLE";
    return values[values.length - 1] >= values[values.length - 2]
      ? "MEJORA"
      : "DETERIORO";
  };
  const objectiveRows = orderedObjectives.map((objective) => ({
    objective,
    items: ownership.kpisByStrategicObjective.get(objective.id) || [],
  }));
  const unlinked = ownership.orphanKpis;
  return (
    <section className="space-y-5" aria-label="Vista por objetivos">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400">
            Objetivos
          </p>
          <h2 className="mt-1 text-2xl font-black tracking-tight text-white">
            Lectura estratégica
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Lectura de la estructura configurada.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDescending((value) => !value)}
          className="rounded-lg border border-white/10 px-3 py-2 text-[10px] font-black text-slate-300"
        >
          ORDEN DEL MAPA {descending ? "↓" : "↑"}
        </button>
      </div>
      {objectiveRows.length === 0 && (
        <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-8 text-center text-sm text-slate-400">
          Sin Objetivos Estratégicos configurados.
        </div>
      )}
      <div className="grid gap-4 xl:grid-cols-2">
        {objectiveRows.map(({ objective, items }) => {
          const scores = items.map((kpi) => score(kpi.item, kpi.dashboard));
          const statuses = scores.map(statusFor);
          const status =
            items.length === 0
              ? "SIN INDICADORES"
              : statuses.includes("CRÍTICO")
                ? "REQUIERE INTERVENCIÓN"
                : statuses.includes("REQUIERE ATENCIÓN")
                  ? "REQUIERE ATENCIÓN"
                  : statuses.includes("RIESGO DE DATOS")
                    ? "RIESGO DE DATOS"
                    : "BAJO CONTROL";
          const perspective = perspectives.find(
            (p) => p.id === objective.perspectiveId,
          );
          const plans = items.filter((kpi) =>
            Boolean(kpi.item.actionPlan),
          ).length;
          const countText = items.length
            ? `${items.length} indicadores · ${statuses.filter((value) => value === "BAJO CONTROL").length} bajo control · ${statuses.filter((value) => value === "REQUIERE ATENCIÓN").length} requieren atención · ${statuses.filter((value) => value === "CRÍTICO").length} críticos`
            : "Sin indicadores asociados";
          return (
            <article
              key={objective.id}
              className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 shadow-xl"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                    {perspective?.name || "Perspectiva no definida"}
                  </p>
                  <p className="text-[9px] font-black uppercase tracking-widest text-indigo-300">
                    {objective.code}
                  </p>
                  <h3 className="mt-1 text-lg font-black text-white">
                    {objective.title}
                  </h3>
                </div>
                <span
                  className={`whitespace-nowrap rounded-lg border px-2.5 py-1 text-[9px] font-black uppercase ${status === "REQUIERE INTERVENCIÓN" ? "border-rose-500/30 text-rose-300" : status === "REQUIERE ATENCIÓN" || status === "RIESGO DE DATOS" ? "border-amber-500/30 text-amber-300" : status === "SIN INDICADORES" ? "border-slate-500/30 text-slate-400" : "border-emerald-500/30 text-emerald-300"}`}
                >
                  {status}
                </span>
              </div>
              <p className="mt-2 text-[10px] font-semibold text-slate-400">
                {countText}
              </p>
              <div className="mt-5 space-y-2">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                  KPIs relacionados
                </p>
                {items.length === 0 ? (
                  <p className="text-sm text-slate-400">
                    SIN INDICADORES ASOCIADOS
                  </p>
                ) : (
                  items.slice(0, 5).map((kpi) => {
                    const value = Math.round(score(kpi.item, kpi.dashboard));
                    return (
                      <button
                        type="button"
                        key={kpi.identity}
                        onClick={() =>
                          onNavigateToKpi?.(kpi.dashboard.id, kpi.item.id)
                        }
                        className="flex w-full cursor-pointer items-center justify-between rounded-xl border border-white/5 bg-slate-950/40 px-3 py-2 text-left hover:border-cyan-500/30 hover:bg-slate-900"
                      >
                        <span className="truncate pr-3 text-xs font-bold text-slate-200">
                          {kpi.item.indicator}
                        </span>
                        <span className="whitespace-nowrap text-[10px] font-black text-cyan-300">
                          {value}% · {trend(kpi.item)} · REVISAR
                        </span>
                      </button>
                    );
                  })
                )}
                {items.length > 5 && (
                  <p className="text-[10px] text-slate-500">
                    +{items.length - 5} KPI adicionales
                  </p>
                )}
              </div>
              <div className="mt-4 flex gap-5 border-t border-white/5 pt-3 text-[10px] font-black uppercase tracking-widest text-slate-500">
                {plans > 0 ? (
                  <button type="button" className="hover:text-cyan-300" onClick={() => {
                    const target = items.find(kpi => Boolean(kpi.item.actionPlan));
                    if (target) onNavigateToKpi?.(target.dashboard.id, target.item.id);
                  }}>
                    Planes activos <b className="text-cyan-300">{plans}</b>
                  </button>
                ) : <span>Planes activos <b className="text-cyan-300">0</b></span>}
                <span>
                  Pendientes <b className="text-amber-300">0</b>
                </span>
              </div>
            </article>
          );
        })}
      </div>
      {unlinked.length > 0 && (
        <div className="rounded-2xl border border-dashed border-amber-500/30 bg-amber-500/5 p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-amber-300">
            KPIs SIN OBJETIVO ASOCIADO · {unlinked.length}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Señal de calidad del modelo estratégico; no se ocultan del tablero.
          </p>
        </div>
      )}
    </section>
  );
};
