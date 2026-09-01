import React, { useEffect, useMemo, useState } from "react";
import type { ActionPlan, Dashboard, DashboardItem } from "../types";
import type {
  ContributionIndicatorAssignment,
  ContributionObjective,
  StrategicObjective,
  StrategicPerspective,
} from "../strategyTypes";
import { resolveStrategicKpiOwnership } from "../strategyKpiOwnership";
import { firebaseService } from "../services/firebaseService";
import {
  buildExecutiveKpiReading,
  objectiveExecutiveStatus,
  type HistoricalCompliancePoint,
} from "../objectivesReading";

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

const statusVisual = {
  "BAJO CONTROL": "bg-emerald-400 text-emerald-300 border-emerald-500/30",
  "REQUIERE ATENCIÓN": "bg-amber-400 text-amber-300 border-amber-500/30",
  CRÍTICO: "bg-rose-400 text-rose-300 border-rose-500/30",
  "NO EVALUABLE": "bg-slate-400 text-slate-300 border-slate-500/30",
  "DATOS PENDIENTES": "bg-slate-400 text-slate-300 border-slate-500/30",
} as const;

const Sparkline = ({ points }: { points: HistoricalCompliancePoint[] }) => {
  if (points.length < 2)
    return (
      <span className="text-[9px] text-slate-600">
        Sin historial suficiente
      </span>
    );
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const path = points
    .map((point, index) => {
      const x = points.length === 1 ? 48 : (index / (points.length - 1)) * 96;
      const y = 28 - ((point.value - min) / range) * 24;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg
      role="img"
      aria-label={`Historial de cumplimiento, ${points.length} periodos evaluables`}
      viewBox="0 0 96 32"
      className="h-8 w-24 shrink-0"
    >
      <path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="text-slate-400"
      />
      <circle
        cx="96"
        cy={(28 - ((values[values.length - 1] - min) / range) * 24).toFixed(1)}
        r="2.5"
        className="fill-cyan-300"
      />
    </svg>
  );
};

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
  const [plansByObjective, setPlansByObjective] = useState<
    Map<string, ActionPlan[]>
  >(new Map());
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
  const reading = (item: DashboardItem, source: Dashboard) =>
    buildExecutiveKpiReading(item, source.thresholds, source.items, year);
  const objectiveRows = orderedObjectives.map((objective) => ({
    objective,
    items: ownership.kpisByStrategicObjective.get(objective.id) || [],
  }));
  const unlinked = ownership.orphanKpis;
  useEffect(() => {
    let active = true;
    void Promise.all(
      objectives.map(async (objective) => {
        const kpis = ownership.kpisByStrategicObjective.get(objective.id) || [];
        const plans = (
          await Promise.all(
            kpis.flatMap((kpi) =>
              kpi.physicalAliases.map((alias) =>
                firebaseService
                  .getActionPlansForIndicator(
                    alias.item.id,
                    alias.dashboard.clientId || dashboard.clientId,
                  )
                  .catch(() => []),
              ),
            ),
          )
        ).flat();
        return [
          objective.id,
          Array.from(
            new Map(plans.map((plan) => [plan.id, plan])).values(),
          ).filter((plan) => !["completed", "cancelled"].includes(plan.status)),
        ] as const;
      }),
    ).then((entries) => {
      if (active) setPlansByObjective(new Map(entries));
    });
    return () => {
      active = false;
    };
  }, [objectives, ownership, dashboard.clientId]);
  return (
    <section className="space-y-5" aria-label="Vista por objetivos">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400">
            Mapa estratégico
          </p>
          <h2 className="mt-1 text-2xl font-black tracking-tight text-white">
            Lectura ejecutiva
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Objetivos, indicadores y ejecución estratégica.
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
          const readings = items.map((kpi) => reading(kpi.item, kpi.dashboard));
          const statuses = readings.map(({ status }) => status);
          const status = objectiveExecutiveStatus(statuses);
          const perspective = perspectives.find(
            (p) => p.id === objective.perspectiveId,
          );
          const relatedPlans = plansByObjective.get(objective.id) || [];
          const plans = relatedPlans.length;
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
                  className={`whitespace-nowrap rounded-lg border px-2.5 py-1 text-[9px] font-black uppercase ${status === "REQUIERE INTERVENCIÓN" ? "border-rose-500/30 text-rose-300" : status === "REQUIERE ATENCIÓN" ? "border-amber-500/30 text-amber-300" : status === "SIN INDICADORES" || status === "DATOS PENDIENTES" ? "border-slate-500/30 text-slate-400" : "border-emerald-500/30 text-emerald-300"}`}
                >
                  <span
                    aria-hidden="true"
                    className={`mr-1.5 inline-block h-2 w-2 rounded-full ${status === "REQUIERE INTERVENCIÓN" ? "bg-rose-400" : status === "REQUIERE ATENCIÓN" ? "bg-amber-400" : status === "BAJO CONTROL" ? "bg-emerald-400" : "bg-slate-400"}`}
                  />
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
                    const kpiReading = reading(kpi.item, kpi.dashboard);
                    const visual = statusVisual[kpiReading.status];
                    const trendLabel =
                      kpiReading.trend === "MEJORA"
                        ? "↑ Mejora"
                        : kpiReading.trend === "DETERIORO"
                          ? "↓ Deterioro"
                          : kpiReading.trend === "ESTABLE"
                            ? "→ Estable"
                            : "Sin tendencia";
                    return (
                      <button
                        type="button"
                        key={kpi.identity}
                        onClick={() =>
                          onNavigateToKpi?.(kpi.dashboard.id, kpi.item.id)
                        }
                        className="grid w-full cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-white/5 bg-slate-950/40 px-3 py-2.5 text-left transition hover:border-cyan-500/30 hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 md:grid-cols-[auto_minmax(0,1fr)_auto_auto_auto]"
                      >
                        <span
                          aria-hidden="true"
                          className={`h-2.5 w-2.5 rounded-full ${visual.split(" ")[0]}`}
                        />
                        <span className="truncate text-xs font-bold text-slate-200">
                          {kpi.item.indicator}
                        </span>
                        <span
                          className={`whitespace-nowrap rounded-lg border px-2 py-1 text-[9px] font-black uppercase ${visual.split(" ").slice(1).join(" ")}`}
                        >
                          {kpiReading.score === null
                            ? "—"
                            : `${kpiReading.score}%`}{" "}
                          · {kpiReading.status}
                        </span>
                        <Sparkline points={kpiReading.series} />
                        <span className="col-start-2 text-[9px] font-semibold text-slate-500 md:col-auto md:whitespace-nowrap">
                          {trendLabel} ·{" "}
                          <b className="text-cyan-300">REVISAR</b>
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
                  <button
                    type="button"
                    className="hover:text-cyan-300"
                    onClick={() => {
                      const plan = relatedPlans[0];
                      const target = plan
                        ? items.find((kpi) =>
                            kpi.physicalAliases.some(
                              (alias) =>
                                String(alias.item.id) ===
                                String(plan.indicatorId),
                            ),
                          )
                        : undefined;
                      if (target)
                        onNavigateToKpi?.(target.dashboard.id, target.item.id);
                    }}
                  >
                    Planes activos <b className="text-cyan-300">{plans}</b>
                  </button>
                ) : (
                  <span>
                    Planes activos <b className="text-cyan-300">0</b>
                  </span>
                )}
                <span>
                  Pendientes <b className="text-slate-400">sin consolidar</b>
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
