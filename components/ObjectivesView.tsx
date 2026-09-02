import React, { useEffect, useMemo, useState } from "react";
import type { ActionPlan, Dashboard, DashboardItem } from "../types";
import type {
  AreaStrategyConfig,
  ContributionIndicatorAssignment,
  ContributionObjective,
  StrategicObjective,
  StrategicPerspective,
} from "../strategyTypes";
import {
  canonicalAreaIdentity,
  classifyStrategicContributionKpis,
  resolveStrategicKpiOwnership,
} from "../strategyKpiOwnership";
import type { StrategicKpiCandidate } from "../strategyKpiOwnership";
import { ContributionExecutiveCell } from "./strategy/ContributionExecutiveCell";
import { firebaseService } from "../services/firebaseService";
import {
  buildObjectiveExecutiveDiagnosis,
  buildObjectiveExecutionSummary,
  buildObjectiveNextDecision,
  buildExecutiveKpiReading,
  buildExecutiveTargetGapReading,
  objectiveExecutiveStatus,
  resolveStrategicStatus,
} from "../objectivesReading";

type Props = {
  dashboard: Dashboard;
  dashboards?: Dashboard[];
  objectives: StrategicObjective[];
  perspectives: StrategicPerspective[];
  contributions: ContributionObjective[];
  assignments: ContributionIndicatorAssignment[];
  areaConfigs?: AreaStrategyConfig[];
  year: number;
  initialReadingMode?: "objectives" | "areas" | "contribution" | "plans";
  onNavigateToKpi?: (
    dashboardId: number | string,
    itemId: number | string,
    source?: "objectives" | "areas" | "contribution" | "plans" | "control",
  ) => void;
};

const statusVisual = {
  "BAJO CONTROL": "bg-emerald-400 text-emerald-300 border-emerald-500/30",
  "REQUIERE ATENCIÓN": "bg-amber-400 text-amber-300 border-amber-500/30",
  CRÍTICO: "bg-rose-400 text-rose-300 border-rose-500/30",
  "NO EVALUABLE": "bg-slate-400 text-slate-300 border-slate-500/30",
  "DATOS PENDIENTES": "bg-slate-400 text-slate-300 border-slate-500/30",
} as const;
const formatExecutivePercent = (value: number | null | undefined) =>
  value == null ? "—" : `${Math.round(value)}%`;

export const ObjectivesView: React.FC<Props> = ({
  dashboard,
  dashboards = [],
  objectives,
  perspectives,
  contributions,
  assignments,
  areaConfigs = [],
  year,
  initialReadingMode = "objectives",
  onNavigateToKpi,
}) => {
  const [readingMode, setReadingMode] = useState<
    "objectives" | "areas" | "contribution" | "plans"
  >(initialReadingMode);
  const [planFilter, setPlanFilter] = useState("TODOS");
  const [descending, setDescending] = useState(false);
  const [expandedTrend, setExpandedTrend] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<ActionPlan | null>(null);
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
  const contributionPresentation = useMemo(
    () =>
      classifyStrategicContributionKpis(ownership, contributions, assignments),
    [ownership, contributions, assignments],
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
  const visiblePlans = Array.from(
    new Map(
      Array.from(plansByObjective.values())
        .flat()
        .map((plan) => [plan.id, plan]),
    ).values(),
  );
  const areaKpiRows = useMemo(() => {
    const rows = new Map<
      string,
      { label: string; items: StrategicKpiCandidate[] }
    >();
    objectiveRows.forEach(({ items }) =>
      items.forEach((item) => {
        const key = canonicalAreaIdentity(item.dashboard.area, areaConfigs);
        const row = rows.get(key) || {
          label: item.dashboard.area || "Área no definida",
          items: [],
        };
        if (!row.items.some((existing) => existing.identity === item.identity))
          row.items.push(item);
        rows.set(key, row);
      }),
    );
    return [...rows.values()];
  }, [objectiveRows, areaConfigs]);
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
      <div
        className="flex flex-wrap gap-1 rounded-xl border border-white/10 bg-slate-950/40 p-1"
        role="tablist"
        aria-label="Modo de lectura ejecutiva"
      >
        {(
          [
            ["objectives", "POR OBJETIVOS"],
            ["areas", "POR ÁREAS"],
            ["contribution", "CONTRIBUCIÓN"],
            ["plans", "PLANES"],
          ] as const
        ).map(([mode, label]) => (
          <button
            key={mode}
            type="button"
            role="tab"
            aria-selected={readingMode === mode}
            onClick={() => setReadingMode(mode)}
            className={`rounded-lg px-3 py-2 text-[10px] font-black tracking-widest transition ${readingMode === mode ? "bg-indigo-600 text-white shadow" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {readingMode === "contribution" && (
        <p className="text-[10px] text-slate-500">
          Lectura de indicadores directos y contribuciones por área.
        </p>
      )}
      {objectiveRows.length === 0 && (
        <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-8 text-center text-sm text-slate-400">
          Sin Objetivos Estratégicos configurados.
        </div>
      )}
      {readingMode === "contribution" &&
        (() => {
          const areaIdentity = (name: string | undefined) =>
            canonicalAreaIdentity(name, areaConfigs);
          const areaLabels = new Map<string, string>();
          [
            ...areaConfigs.map((config) => ({
              key: config.id,
              name: config.areaName,
            })),
            ...objectiveRows.flatMap((row) =>
              row.items.map((item) => ({
                key: areaIdentity(item.dashboard.area),
                name: item.dashboard.area || "Área no definida",
              })),
            ),
            ...contributions
              .filter((oc) =>
                objectiveRows.some(
                  (row) => row.objective.id === oc.primaryStrategicObjectiveId,
                ),
              )
              .map((oc) => ({
                key: oc.areaConfigId || areaIdentity(oc.areaName),
                name: oc.areaName || "Área no definida",
              })),
          ].forEach((area) => {
            if (!areaLabels.has(area.key)) areaLabels.set(area.key, area.name);
          });
          const areas = [...areaLabels.entries()].sort(([, left], [, right]) =>
            left.localeCompare(right),
          );
          const cells = (objective: StrategicObjective, areaKey: string) =>
            contributions
              .filter(
                (oc) =>
                  oc.primaryStrategicObjectiveId === objective.id &&
                  (oc.areaConfigId || areaIdentity(oc.areaName)) === areaKey,
              )
              .map((oc) => {
                const kpis = (
                  contributionPresentation.contributionKpisByContributionObjective.get(
                    oc.id,
                  ) || []
                ).map((k) => ({
                  identity: k.identity,
                  item: k.item,
                  dashboard: k.dashboard,
                  score: reading(k.item, k.dashboard).score,
                  status: reading(k.item, k.dashboard).status,
                }));
                return (
                  <ContributionExecutiveCell
                    key={oc.id}
                    code={oc.displayCode || "OC"}
                    title={oc.title}
                    kpis={kpis}
                    status={
                      kpis.length
                        ? resolveStrategicStatus(
                            kpis.map((k) => k.status) as any,
                          ).status
                        : "NO EVALUABLE"
                    }
                    onNavigateToKpi={(dashboardId, itemId) =>
                      onNavigateToKpi?.(dashboardId, itemId, "contribution")
                    }
                  />
                );
              });
          return (
            <div
              className="space-y-3"
              aria-label="Matriz de contribución ejecutiva"
            >
              <div
                className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-slate-950/30 px-3 py-2 text-[9px] font-black uppercase tracking-widest text-slate-400"
                aria-label="Leyenda de contribución"
              >
                <span className="text-cyan-300">DIRECTO AL OE</span>
                <span className="font-normal normal-case tracking-normal text-slate-500">
                  alineado directamente al OE
                </span>
                <span className="text-violet-300">VÍA OC</span>
                <span className="font-normal normal-case tracking-normal text-slate-500">
                  alineado mediante un Objetivo de Contribución del Área
                </span>
              </div>
              <div className="overflow-x-auto rounded-2xl border border-white/10">
                <div className="min-w-[760px]">
                  <div
                    className="grid"
                    style={{
                      gridTemplateColumns: `minmax(260px, 1.2fr) repeat(${areas.length}, minmax(170px, 1fr))`,
                    }}
                  >
                    <div className="p-4 text-[9px] font-black uppercase tracking-widest text-slate-500">
                      Objetivo estratégico
                    </div>
                    {areas.map(([key, label]) => (
                      <div
                        key={key}
                        className="border-l border-white/5 p-4 text-xs font-black uppercase text-white"
                      >
                        {label}
                      </div>
                    ))}
                  </div>
                  {objectiveRows.map(({ objective, items }) => {
                    const directKpis =
                      contributionPresentation.directKpisByStrategicObjective.get(
                        objective.id,
                      ) || [];
                    return (
                      <div
                        key={objective.id}
                        className="grid border-t border-white/5"
                        style={{
                          gridTemplateColumns: `minmax(260px, 1.2fr) repeat(${areas.length}, minmax(170px, 1fr))`,
                        }}
                      >
                        <div className="p-4">
                          <p className="text-[9px] uppercase tracking-widest text-indigo-300">
                            {perspectives.find(
                              (p) => p.id === objective.perspectiveId,
                            )?.name || "Perspectiva"}
                          </p>
                          <p className="mt-1 text-sm font-black text-white">
                            {objective.code} · {objective.title}
                          </p>
                          <p className="mt-1 text-[9px] font-black uppercase text-slate-500">
                            {
                              resolveStrategicStatus(
                                items.map(
                                  (item) =>
                                    reading(item.item, item.dashboard).status,
                                ) as any,
                              ).status
                            }
                          </p>
                          {directKpis.length > 0 && (
                            <div className="mt-4 border-t border-cyan-500/15 pt-3">
                              <p className="text-[9px] font-black uppercase tracking-widest text-cyan-300">
                                Indicadores directos
                              </p>
                              <div className="mt-2 space-y-1">
                                {directKpis.map((kpi) => {
                                  const kpiReading = reading(
                                    kpi.item,
                                    kpi.dashboard,
                                  );
                                  const visual =
                                    statusVisual[kpiReading.status];
                                  return (
                                    <div
                                      key={kpi.identity}
                                      className="flex items-center justify-between gap-2 text-[10px]"
                                    >
                                      <span className="flex min-w-0 items-center gap-1 text-slate-200">
                                        <span
                                          aria-hidden="true"
                                          className={`h-1.5 w-1.5 shrink-0 rounded-full ${visual.split(" ")[0]}`}
                                        />
                                        <span className="whitespace-normal">
                                          {kpi.item.indicator || kpi.item.name}
                                        </span>
                                      </span>
                                      <span className="shrink-0 text-right text-slate-400">
                                        {formatExecutivePercent(
                                          kpiReading.score,
                                        )}{" "}
                                        · {kpiReading.status}
                                      </span>
                                      <button
                                        type="button"
                                        className="shrink-0 font-black uppercase tracking-widest text-cyan-300"
                                        onClick={() =>
                                          onNavigateToKpi?.(
                                            kpi.dashboard.id,
                                            kpi.item.id,
                                            "contribution",
                                          )
                                        }
                                      >
                                        REVISAR KPI
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                        {areas.map(([key]) => (
                          <div
                            key={`${objective.id}-${key}`}
                            className="border-l border-white/5 p-3"
                          >
                            {cells(objective, key).length ? (
                              cells(objective, key)
                            ) : (
                              <span className="text-[10px] uppercase tracking-widest text-slate-600">
                                —
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })()}
      {false &&
        readingMode === "contribution" &&
        (() => {
          const areaMap = new Map<
            string,
            {
              items: (typeof objectiveRows)[number]["items"];
              statuses: string[];
            }
          >();
          objectiveRows.forEach(({ items }) =>
            items.forEach((kpi) => {
              const area = kpi.dashboard.area || "Área no definida";
              const current = areaMap.get(area) || { items: [], statuses: [] };
              if (!current.items.some((item) => item.identity === kpi.identity))
                current.items.push(kpi);
              current.statuses.push(reading(kpi.item, kpi.dashboard).status);
              areaMap.set(area, current);
            }),
          );
          const areas = Array.from(areaMap.keys()).sort();
          const sameArea = (left: string | undefined, right: string) =>
            String(left || "")
              .trim()
              .toUpperCase() === right.trim().toUpperCase();
          const statusLabel = (statuses: string[]) =>
            resolveStrategicStatus(statuses as any).status;
          return (
            <div
              className="space-y-3"
              aria-label="Matriz de contribución ejecutiva"
            >
              <div className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-950/30">
                <div className="min-w-[760px]">
                  <div
                    className="grid border-b border-white/10 bg-slate-900/70"
                    style={{
                      gridTemplateColumns: `minmax(260px, 1.2fr) repeat(${areas.length}, minmax(170px, 1fr))`,
                    }}
                  >
                    <div className="p-4 text-[9px] font-black uppercase tracking-widest text-slate-500">
                      Objetivo estratégico
                    </div>
                    {areas.map((area) => (
                      <div key={area} className="border-l border-white/5 p-4">
                        <p className="text-xs font-black uppercase text-white">
                          {area}
                        </p>
                        <p className="mt-1 text-[9px] uppercase text-slate-500">
                          {statusLabel(areaMap.get(area)?.statuses || [])}
                        </p>
                      </div>
                    ))}
                  </div>
                  {objectiveRows.map(({ objective, items }) => {
                    const oeStatus = statusLabel(
                      items.map(
                        (item) => reading(item.item, item.dashboard).status,
                      ),
                    );
                    const perspective = perspectives.find(
                      (item) => item.id === objective.perspectiveId,
                    );
                    return (
                      <div
                        key={objective.id}
                        className="grid border-b border-white/5 last:border-0"
                        style={{
                          gridTemplateColumns: `minmax(260px, 1.2fr) repeat(${areas.length}, minmax(170px, 1fr))`,
                        }}
                      >
                        <div className="p-4">
                          <p className="text-[9px] uppercase tracking-widest text-indigo-300">
                            {perspective?.name || "Perspectiva"} · {oeStatus}
                          </p>
                          <p className="mt-1 text-sm font-black text-white">
                            {objective.code} · {objective.title}
                          </p>
                        </div>
                        {areas.map((area) => {
                          const areaItems = areaMap.get(area)?.items || [];
                          const areaKey = area.trim().toUpperCase();
                          const linked = contributions.filter(
                            (oc) =>
                              oc.primaryStrategicObjectiveId === objective.id &&
                              sameArea(oc.areaName, areaKey),
                          );
                          return (
                            <div
                              key={`${objective.id}-${area}`}
                              className="border-l border-white/5 p-3"
                            >
                              {linked.length ? (
                                linked.map((oc) => {
                                  const ocAssignments = assignments.filter(
                                    (assignment) =>
                                      assignment.contributionObjectiveId ===
                                        oc.id &&
                                      areaItems.some(
                                        (item) =>
                                          String(item.dashboard.id) ===
                                            String(assignment.dashboardId) &&
                                          String(item.item.id) ===
                                            String(assignment.itemId),
                                      ),
                                  );
                                  const ocStatuses = ocAssignments.flatMap(
                                    (assignment) =>
                                      areaItems
                                        .filter(
                                          (item) =>
                                            String(item.dashboard.id) ===
                                              String(assignment.dashboardId) &&
                                            String(item.item.id) ===
                                              String(assignment.itemId),
                                        )
                                        .map(
                                          (item) =>
                                            reading(item.item, item.dashboard)
                                              .status,
                                        ),
                                  );
                                  return (
                                    <div
                                      key={oc.id}
                                      className="rounded-xl border border-violet-500/25 bg-violet-500/5 p-3"
                                    >
                                      <p className="text-xs font-black text-violet-200">
                                        ● {oc.displayCode || "OC"}
                                      </p>
                                      <p className="mt-1 line-clamp-2 text-xs font-semibold text-slate-200">
                                        {oc.title}
                                      </p>
                                      <p className="mt-2 text-[9px] font-black uppercase text-slate-400">
                                        {ocAssignments.length} KPI ·{" "}
                                        {statusLabel(ocStatuses)}
                                      </p>
                                    </div>
                                  );
                                })
                              ) : (
                                <span className="text-[10px] uppercase tracking-widest text-slate-600">
                                  No contribuye
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })()}
      {readingMode === "objectives" && (
        <div className="grid items-start gap-4 xl:grid-cols-2">
          {objectiveRows.map(({ objective, items }) => {
            const readings = items.map((kpi) =>
              reading(kpi.item, kpi.dashboard),
            );
            const statuses = readings.map(({ status }) => status);
            const status = objectiveExecutiveStatus(statuses);
            const perspective = perspectives.find(
              (p) => p.id === objective.perspectiveId,
            );
            const relatedPlans = plansByObjective.get(objective.id) || [];
            const plans = relatedPlans.length;
            const diagnosis = buildObjectiveExecutiveDiagnosis(
              items.map((kpi, index) => ({
                indicator: kpi.item.indicator,
                score: readings[index].score,
                status: readings[index].status,
              })),
            );
            const execution = buildObjectiveExecutionSummary(relatedPlans);
            const decision = buildObjectiveNextDecision(
              items.map((kpi, index) => ({
                indicator: kpi.item.indicator,
                score: readings[index].score,
                status: readings[index].status,
              })),
              relatedPlans,
              execution,
            );
            const priorityKpi =
              items.find(
                (kpi, index) => readings[index].status === "CRÍTICO",
              ) ||
              items.find(
                (kpi, index) => readings[index].status === "REQUIERE ATENCIÓN",
              );
            return (
              <article
                key={objective.id}
                className="self-start rounded-2xl border border-white/10 bg-slate-900/60 p-5 shadow-xl"
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
                <div className="mt-4 border-t border-white/5 pt-3">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                    Diagnóstico ejecutivo
                  </p>
                  <p className="mt-1 text-sm leading-5 text-slate-300">
                    {diagnosis}
                  </p>
                </div>
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
                      const targetReading = buildExecutiveTargetGapReading(
                        kpi.item,
                        kpi.dashboard.items || [],
                        year,
                      );
                      const targetAvailable = (
                        kpi.item.monthlyGoals || []
                      ).some(
                        (goal, index) =>
                          Number.isFinite(Number(goal)) &&
                          Number(goal) !== 0 &&
                          Number(kpi.item.monthlyProgress?.[index]) !== 0,
                      );
                      const trendId = `${objective.id}-${kpi.identity}`;
                      const isTrendExpanded = expandedTrend === trendId;
                      const trendSeries = kpiReading.series.slice(-8);
                      const lastPointColor =
                        kpiReading.status === "BAJO CONTROL"
                          ? "#34d399"
                          : kpiReading.status === "REQUIERE ATENCIÓN"
                            ? "#fbbf24"
                            : kpiReading.status === "CRÍTICO"
                              ? "#fb7185"
                              : "#94a3b8";
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
                        <div
                          role="button"
                          tabIndex={0}
                          key={kpi.identity}
                          onClick={() =>
                            onNavigateToKpi?.(kpi.dashboard.id, kpi.item.id)
                          }
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ")
                              onNavigateToKpi?.(kpi.dashboard.id, kpi.item.id);
                          }}
                          className="grid w-full cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-white/5 px-1 py-2.5 text-left transition hover:bg-slate-900/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 md:grid-cols-[auto_minmax(0,1fr)_auto_auto_auto]"
                        >
                          <span
                            aria-hidden="true"
                            className={`h-2.5 w-2.5 rounded-full ${visual.split(" ")[0]}`}
                          />
                          <span className="whitespace-normal break-words text-xs font-bold text-slate-200">
                            {kpi.item.indicator}
                          </span>
                          <span
                            className={`whitespace-nowrap rounded-lg border px-2 py-1 text-[9px] font-black uppercase ${visual.split(" ").slice(1).join(" ")}`}
                          >
                            {kpiReading.score === null
                              ? "—"
                              : formatExecutivePercent(kpiReading.score)}{" "}
                            · {kpiReading.status}
                          </span>
                          <span className="col-start-2 flex flex-wrap items-center gap-1 text-[9px] font-semibold text-slate-500 md:col-auto md:whitespace-nowrap">
                            {trendLabel} ·{" "}
                            {kpiReading.series.length >= 2 && (
                              <button
                                type="button"
                                aria-expanded={isTrendExpanded}
                                aria-controls={`trend-${trendId}`}
                                className="rounded px-1 text-cyan-300 underline decoration-cyan-500/40 underline-offset-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setExpandedTrend(
                                    isTrendExpanded ? null : trendId,
                                  );
                                }}
                              >
                                TENDENCIA
                              </button>
                            )}{" "}
                            · <b className="text-cyan-300">REVISAR</b>
                          </span>
                          {isTrendExpanded && (
                            <div
                              id={`trend-${trendId}`}
                              className="col-span-full rounded-lg border border-cyan-500/15 bg-slate-950/50 px-3 py-3"
                              aria-label={`Lectura HD de ${kpi.item.indicator}`}
                            >
                              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                <div className="rounded-md border border-white/10 bg-white/5 px-2 py-1">
                                  <span className="block text-[8px] font-black uppercase text-slate-500">
                                    Actual
                                  </span>
                                  <b className="text-sm text-white">
                                    {targetReading.actual == null
                                      ? "—"
                                      : `${Math.round(targetReading.actual)}${kpi.item.unit === "%" ? "%" : ""}`}
                                  </b>
                                </div>
                                <div className="rounded-md border border-white/10 bg-white/5 px-2 py-1">
                                  <span className="block text-[8px] font-black uppercase text-slate-500">
                                    Meta
                                  </span>
                                  <b className="text-sm text-cyan-300">
                                    {targetReading.target == null
                                      ? "—"
                                      : `${Math.round(targetReading.target)}${kpi.item.unit === "%" ? "%" : ""}`}
                                  </b>
                                </div>
                                <div className="rounded-md border border-white/10 bg-white/5 px-2 py-1">
                                  <span className="block text-[8px] font-black uppercase text-slate-500">
                                    Brecha
                                  </span>
                                  <b className="text-sm text-amber-300">
                                    {targetReading.gap == null
                                      ? "—"
                                      : `${targetReading.gap > 0 ? "+" : ""}${Math.round(targetReading.gap)}${kpi.item.unit === "%" ? " pts" : ""}`}
                                  </b>
                                </div>
                                <div className="rounded-md border border-white/10 bg-white/5 px-2 py-1">
                                  <span className="block text-[8px] font-black uppercase text-slate-500">
                                    Cambio vs periodo anterior
                                  </span>
                                  <b
                                    className={`text-sm ${targetReading.deltaLabel === "MEJORA" ? "text-emerald-300" : targetReading.deltaLabel === "DETERIORO" ? "text-rose-300" : "text-slate-300"}`}
                                  >
                                    {targetReading.delta == null
                                      ? "HISTORIAL INSUFICIENTE"
                                      : `${targetReading.delta > 0 ? "↑ +" : targetReading.delta < 0 ? "↓ " : "→ "}${Math.round(targetReading.delta)} pts · ${targetReading.deltaLabel}`}
                                  </b>
                                </div>
                              </div>
                              {targetReading.series.length >= 2 ? (
                                <svg
                                  viewBox="0 0 320 58"
                                  role="img"
                                  aria-label={`Actual vs meta de ${kpi.item.indicator}`}
                                  className="mt-3 h-14 w-full"
                                >
                                  <polyline
                                    fill="none"
                                    stroke="#22d3ee"
                                    strokeWidth="2"
                                    strokeLinejoin="round"
                                    strokeLinecap="round"
                                    points={targetReading.series
                                      .map(
                                        (point, index) =>
                                          `${(index / (targetReading.series.length - 1)) * 300 + 10},${50 - (point.value / 100) * 40}`,
                                      )
                                      .join(" ")}
                                  />
                                  <polyline
                                    fill="none"
                                    stroke="#94a3b8"
                                    strokeWidth="1.5"
                                    strokeDasharray="3 3"
                                    points={targetReading.targetSeries
                                      .map(
                                        (point, index) =>
                                          `${(index / (targetReading.targetSeries.length - 1)) * 300 + 10},10`,
                                      )
                                      .join(" ")}
                                  />
                                  <text
                                    x="10"
                                    y="57"
                                    fill="#94a3b8"
                                    fontSize="8"
                                  >
                                    META 100%
                                  </text>
                                </svg>
                              ) : (
                                <p className="mt-2 text-[9px] font-black uppercase tracking-widest text-slate-500">
                                  HISTORIAL INSUFICIENTE · sin microvisual
                                </p>
                              )}
                            </div>
                          )}
                          {false && isTrendExpanded && (
                            <div
                              id={`legacy-trend-${trendId}`}
                              className="col-span-full rounded-lg border border-cyan-500/15 bg-slate-950/50 px-3 py-2"
                              aria-label={`Tendencia de ${kpi.item.indicator}`}
                            >
                              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                <div className="rounded-md bg-white/5 px-2 py-1">
                                  <span className="block text-[8px] font-black uppercase text-slate-500">
                                    Actual
                                  </span>
                                  <b className="text-sm text-white">
                                    {formatExecutivePercent(kpiReading.score)}
                                  </b>
                                </div>
                                <div className="rounded-md bg-white/5 px-2 py-1">
                                  <span className="block text-[8px] font-black uppercase text-slate-500">
                                    Meta
                                  </span>
                                  <b className="text-sm text-cyan-300">
                                    {targetAvailable ? "100%" : "—"}
                                  </b>
                                </div>
                                <div className="rounded-md bg-white/5 px-2 py-1">
                                  <span className="block text-[8px] font-black uppercase text-slate-500">
                                    Brecha
                                  </span>
                                  <b className="text-sm text-amber-300">
                                    {!targetAvailable ||
                                    kpiReading.score == null
                                      ? "—"
                                      : `${kpiReading.score - 100} pts`}
                                  </b>
                                </div>
                                <div className="rounded-md bg-white/5 px-2 py-1">
                                  <span className="block text-[8px] font-black uppercase text-slate-500">
                                    Delta
                                  </span>
                                  <b className="text-sm text-slate-200">
                                    {kpiReading.series.length >= 2
                                      ? `${kpiReading.series.at(-1)!.value - kpiReading.series.at(-2)!.value >= 0 ? "+" : ""}${Math.round(kpiReading.series.at(-1)!.value - kpiReading.series.at(-2)!.value)} pts`
                                      : "—"}
                                  </b>
                                </div>
                              </div>
                              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                                  Microtendencia · referencia meta{" "}
                                  {targetAvailable ? "100%" : "no disponible"}
                                </span>
                                <span className="text-[10px] font-semibold text-slate-300">
                                  {kpiReading.series.length >= 2
                                    ? kpiReading.trend === "MEJORA"
                                      ? "↑ mejora"
                                      : kpiReading.trend === "DETERIORO"
                                        ? "↓ deterioro"
                                        : "→ estable"
                                    : "HISTORIAL INSUFICIENTE"}
                                </span>
                              </div>
                              <svg
                                viewBox="0 0 320 96"
                                role="img"
                                aria-label={`Gráfico histórico de ${kpi.item.indicator}`}
                                className="mt-2 h-24 w-full"
                              >
                                <polyline
                                  fill="none"
                                  stroke="#94a3b8"
                                  strokeOpacity=".55"
                                  strokeWidth="1.5"
                                  strokeDasharray="4 5"
                                  strokeLinejoin="round"
                                  strokeLinecap="round"
                                  points={trendSeries
                                    .map(
                                      (point, index) =>
                                        `${(index / (trendSeries.length - 1)) * 300 + 10},${86 - ((point.value - Math.min(...trendSeries.map((item) => item.value))) / (Math.max(...trendSeries.map((item) => item.value)) - Math.min(...trendSeries.map((item) => item.value)) || 1)) * 72}`,
                                    )
                                    .join(" ")}
                                />
                                {trendSeries.map((point, index) => (
                                  <circle
                                    key={`${point.periodIndex}-${index}`}
                                    cx={
                                      (index / (trendSeries.length - 1)) * 300 +
                                      10
                                    }
                                    cy={
                                      86 -
                                      ((point.value -
                                        Math.min(
                                          ...trendSeries.map(
                                            (item) => item.value,
                                          ),
                                        )) /
                                        (Math.max(
                                          ...trendSeries.map(
                                            (item) => item.value,
                                          ),
                                        ) -
                                          Math.min(
                                            ...trendSeries.map(
                                              (item) => item.value,
                                            ),
                                          ) || 1)) *
                                        72
                                    }
                                    r={
                                      index === trendSeries.length - 1
                                        ? "4"
                                        : "2"
                                    }
                                    fill={
                                      index === trendSeries.length - 1
                                        ? lastPointColor
                                        : "#64748b"
                                    }
                                    fillOpacity={
                                      index === trendSeries.length - 1
                                        ? "1"
                                        : ".45"
                                    }
                                  />
                                ))}
                              </svg>
                              <div className="flex justify-between text-[8px] text-slate-600">
                                <span>
                                  P{(trendSeries[0]?.periodIndex ?? 0) + 1}
                                </span>
                                <span>
                                  P{(trendSeries.at(-1)?.periodIndex ?? 0) + 1}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                  {items.length > 5 && (
                    <p className="text-[10px] text-slate-500">
                      +{items.length - 5} KPI adicionales
                    </p>
                  )}
                </div>
                <div className="mt-4 border-t border-cyan-500/15 pt-3">
                  <p className="text-[9px] font-black uppercase tracking-widest text-cyan-300">
                    Ejecución
                  </p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
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
                            onNavigateToKpi?.(
                              target.dashboard.id,
                              target.item.id,
                            );
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
                      Acciones activas{" "}
                      <b className="text-cyan-300">
                        {execution.activeActivities}
                      </b>
                    </span>
                    <span>
                      Vencidas{" "}
                      <b className="text-amber-300">
                        {execution.overdueActivities}
                      </b>
                    </span>
                  </div>
                  {execution.impact.favorable +
                    execution.impact.partial +
                    execution.impact.low +
                    execution.impact.notEvaluated >
                    0 && (
                    <p className="mt-2 text-[10px] font-semibold text-slate-400">
                      Impacto:{" "}
                      {execution.impact.favorable > 0 &&
                        `🟢 ${execution.impact.favorable} favorables `}
                      {execution.impact.partial > 0 &&
                        `🟡 ${execution.impact.partial} parciales `}
                      {execution.impact.low > 0 &&
                        `🔴 ${execution.impact.low} bajo/sin impacto `}
                      {execution.impact.notEvaluated > 0 &&
                        `⚪ ${execution.impact.notEvaluated} por evaluar`}
                    </p>
                  )}
                  {priorityKpi && status !== "BAJO CONTROL" && plans === 0 && (
                    <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-amber-300">
                        SIN PLAN ACTIVO PARA ESTA DESVIACIÓN
                      </span>
                      <button
                        type="button"
                        className="whitespace-nowrap text-[10px] font-black uppercase text-cyan-300"
                        onClick={() =>
                          onNavigateToKpi?.(
                            priorityKpi.dashboard.id,
                            priorityKpi.item.id,
                          )
                        }
                      >
                        CREAR PLAN
                      </button>
                    </div>
                  )}
                  {decision && (
                    <div className="mt-3 border-t border-white/5 pt-2">
                      <p className="text-[9px] font-black uppercase tracking-widest text-violet-300">
                        Próxima decisión
                      </p>
                      <p className="mt-1 text-xs font-semibold text-slate-300">
                        {decision.label}
                      </p>
                      <p className="mt-1 text-[9px] text-slate-500">
                        Basada en estado y ejecución
                      </p>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
      {readingMode === "areas" && (
        <AreaKpiDirectory
          rows={areaKpiRows}
          reading={reading}
          onNavigateToKpi={(dashboardId, itemId) =>
            onNavigateToKpi?.(dashboardId, itemId, "areas")
          }
        />
      )}
      {false &&
        readingMode === "areas" &&
        (() => {
          const areaMap = new Map<
            string,
            {
              items: (typeof objectiveRows)[number]["items"];
              objectives: StrategicObjective[];
            }
          >();
          objectiveRows.forEach(({ objective, items }) =>
            items.forEach((item) => {
              const area = item.dashboard.area || "Área no definida";
              const current = areaMap.get(area) || {
                items: [],
                objectives: [],
              };
              if (
                !current.items.some(
                  (existing) => existing.identity === item.identity,
                )
              )
                current.items.push(item);
              if (
                !current.objectives.some(
                  (existing) => existing.id === objective.id,
                )
              )
                current.objectives.push(objective);
              areaMap.set(area, current);
            }),
          );
          return (
            <div className="grid items-start gap-4 xl:grid-cols-2">
              {Array.from(areaMap.entries()).map(([area, data]) => {
                const readings = data.items.map((kpi) =>
                  reading(kpi.item, kpi.dashboard),
                );
                const summary = resolveStrategicStatus(
                  readings.map((item) => item.status),
                );
                const areaPlans = Array.from(
                  new Map(
                    data.items
                      .flatMap(
                        (kpi) =>
                          plansByObjective.get(
                            objectiveRows.find((row) =>
                              row.items.some(
                                (item) => item.identity === kpi.identity,
                              ),
                            )?.objective.id || "",
                          ) || [],
                      )
                      .map((plan) => [plan.id, plan]),
                  ).values(),
                );
                const breach = data.items.find(
                  (kpi, index) =>
                    readings[index].status === "CRÍTICO" ||
                    readings[index].status === "REQUIERE ATENCIÓN",
                );
                const statusTone =
                  summary.status === "REQUIERE INTERVENCIÓN"
                    ? "rose"
                    : summary.status === "REQUIERE ATENCIÓN"
                      ? "amber"
                      : summary.status === "BAJO CONTROL"
                        ? "emerald"
                        : "slate";
                const statusTheme =
                  statusTone === "rose"
                    ? {
                        border: "border-rose-500/30",
                        badge: "border-rose-400/40 text-rose-300",
                        dot: "bg-rose-400",
                      }
                    : statusTone === "amber"
                      ? {
                          border: "border-amber-500/30",
                          badge: "border-amber-400/40 text-amber-300",
                          dot: "bg-amber-400",
                        }
                      : statusTone === "emerald"
                        ? {
                            border: "border-emerald-500/30",
                            badge: "border-emerald-400/40 text-emerald-300",
                            dot: "bg-emerald-400",
                          }
                        : {
                            border: "border-slate-500/30",
                            badge: "border-slate-400/40 text-slate-300",
                            dot: "bg-slate-400",
                          };
                const activeActions = areaPlans
                  .flatMap((plan) => plan.activities || [])
                  .filter((activity) => activity.progress < 100);
                const overdue = activeActions.filter(
                  (activity) =>
                    activity.targetDate &&
                    new Date(activity.targetDate) < new Date(),
                ).length;
                const areaOcs = contributions.filter(
                  (oc) =>
                    oc.primaryStrategicObjectiveId &&
                    data.objectives.some(
                      (objective) =>
                        objective.id === oc.primaryStrategicObjectiveId,
                    ) &&
                    assignments.some(
                      (assignment) =>
                        assignment.contributionObjectiveId === oc.id &&
                        data.items.some(
                          (item) =>
                            String(item.dashboard.id) ===
                              String(assignment.dashboardId) &&
                            String(item.item.id) === String(assignment.itemId),
                        ),
                    ),
                );
                return (
                  <article
                    key={area}
                    className={`self-start rounded-2xl border ${statusTheme.border} bg-slate-900/70 p-5 shadow-xl`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-[0.25em] text-slate-500">
                          Área ejecutiva
                        </p>
                        <h3 className="mt-1 text-xl font-black uppercase tracking-tight text-white">
                          {area}
                        </h3>
                      </div>
                      <div
                        className={`flex items-center gap-2 rounded-xl border ${statusTheme.badge} px-3 py-2 text-[10px] font-black uppercase`}
                      >
                        <span
                          className={`h-3 w-3 rounded-full ${statusTheme.dot}`}
                        />
                        {summary.status}
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2 border-y border-white/5 py-3 text-[10px] font-black uppercase tracking-wide">
                      <span className="text-rose-300">
                        ● {summary.criticalCount} críticos
                      </span>
                      <span className="text-amber-300">
                        ● {summary.attentionCount} atención
                      </span>
                      <span className="text-emerald-300">
                        ● {summary.underControlCount} bajo control
                      </span>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                      <div>
                        <b className="block text-lg text-white">
                          {data.objectives.length}
                        </b>
                        <span className="text-[9px] uppercase text-slate-500">
                          OE
                        </span>
                      </div>
                      <div>
                        <b className="block text-lg text-white">
                          {data.items.length}
                        </b>
                        <span className="text-[9px] uppercase text-slate-500">
                          KPI
                        </span>
                      </div>
                      <div>
                        <b className="block text-lg text-cyan-300">
                          {areaPlans.length}
                        </b>
                        <span className="text-[9px] uppercase text-slate-500">
                          Planes
                        </span>
                      </div>
                    </div>
                    <div className="mt-4 space-y-4 border-t border-white/5 pt-4">
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                          Contribuye a
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {data.objectives.map((item) => (
                            <span
                              key={item.id}
                              className="rounded-lg border border-indigo-500/30 px-2 py-1 text-xs font-bold text-indigo-200"
                            >
                              {item.code}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                          Objetivos de contribución
                        </p>
                        {areaOcs.length ? (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {areaOcs.map((oc) => (
                              <span
                                key={oc.id}
                                className="rounded-lg border border-violet-500/30 px-2 py-1 text-xs font-bold text-violet-200"
                              >
                                {oc.displayCode || "OC"} · {oc.title}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-1 text-xs text-slate-500">
                            Sin OC asociado
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                          Principal brecha
                        </p>
                        {breach ? (
                          <button
                            type="button"
                            onClick={() =>
                              onNavigateToKpi?.(
                                breach.dashboard.id,
                                breach.item.id,
                              )
                            }
                            className="mt-1 text-left text-sm font-bold text-amber-300 hover:text-white"
                          >
                            {breach.item.indicator} ·{" "}
                            {readings[data.items.indexOf(breach)]?.score ?? "—"}
                            % · REVISAR
                          </button>
                        ) : (
                          <p className="mt-1 text-xs text-slate-400">
                            Sin brecha prioritaria.
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
                        <span>{activeActions.length} acciones activas</span>
                        <span
                          className={overdue ? "font-bold text-rose-300" : ""}
                        >
                          {overdue} vencidas
                        </span>
                        {areaPlans.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setPlanFilter("TODOS");
                              setReadingMode("plans");
                            }}
                            className="font-black uppercase tracking-widest text-cyan-300"
                          >
                            VER PLANES
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          );
        })()}
      {readingMode === "plans" && (
        <PlanDirectoryFinal
          plans={visiblePlans}
          objectiveRows={objectiveRows}
          onOpenPlan={setSelectedPlan}
          onNavigateToKpi={(dashboardId, itemId) =>
            onNavigateToKpi?.(dashboardId, itemId, "plans")
          }
        />
      )}
      {false &&
        readingMode === "plans" &&
        (() => {
          const allPlans = Array.from(
            new Map(
              Array.from(plansByObjective.values())
                .flat()
                .map((plan) => [plan.id, plan]),
            ).values(),
          );
          const plans = allPlans.filter(
            (plan) =>
              planFilter === "TODOS" ||
              (planFilter === "COMPLETADOS" && plan.status === "completed") ||
              (planFilter === "IMPACTO POR EVALUAR" &&
                (plan.activities || []).some(
                  (activity) =>
                    !activity.impact || activity.impact === "NOT_EVALUATED",
                )) ||
              (planFilter === "VENCIDOS" &&
                (plan.activities || []).some(
                  (activity) =>
                    activity.progress < 100 &&
                    activity.targetDate &&
                    new Date(activity.targetDate) < new Date(),
                )) ||
              (planFilter === "REQUIEREN ATENCIÓN" &&
                (plan.activities || []).some(
                  (activity) =>
                    activity.progress < 100 &&
                    activity.targetDate &&
                    new Date(activity.targetDate) < new Date(),
                )) ||
              (planFilter === "ACTIVOS" &&
                plan.status !== "completed" &&
                plan.status !== "cancelled"),
          );
          const activities = plans.flatMap((plan) => plan.activities || []);
          return (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                  Filtrar planes
                </span>
                <select
                  aria-label="Filtro de planes"
                  value={planFilter}
                  onChange={(event) => setPlanFilter(event.target.value)}
                  className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs text-slate-200"
                >
                  {[
                    "TODOS",
                    "REQUIEREN ATENCIÓN",
                    "VENCIDOS",
                    "IMPACTO POR EVALUAR",
                    "COMPLETADOS",
                  ].map((filter) => (
                    <option key={filter} value={filter}>
                      {filter}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3">
                  <p className="text-[9px] font-black uppercase text-slate-500">
                    Planes activos
                  </p>
                  <p className="mt-1 text-xl font-black text-white">
                    {
                      allPlans.filter(
                        (plan) =>
                          plan.status !== "completed" &&
                          plan.status !== "cancelled",
                      ).length
                    }
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3">
                  <p className="text-[9px] font-black uppercase text-slate-500">
                    Acciones activas
                  </p>
                  <p className="mt-1 text-xl font-black text-cyan-300">
                    {
                      activities.filter((activity) => activity.progress < 100)
                        .length
                    }
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3">
                  <p className="text-[9px] font-black uppercase text-slate-500">
                    Vencidas
                  </p>
                  <p className="mt-1 text-xl font-black text-amber-300">
                    {
                      activities.filter(
                        (activity) =>
                          activity.progress < 100 &&
                          activity.targetDate &&
                          new Date(activity.targetDate) < new Date(),
                      ).length
                    }
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3">
                  <p className="text-[9px] font-black uppercase text-slate-500">
                    Impacto por evaluar
                  </p>
                  <p className="mt-1 text-xl font-black text-slate-300">
                    {
                      activities.filter(
                        (activity) =>
                          !activity.impact ||
                          activity.impact === "NOT_EVALUATED",
                      ).length
                    }
                  </p>
                </div>
              </div>
              {plans.length === 0 ? (
                <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-400">
                  No hay planes estratégicos activos.
                </p>
              ) : (
                <div className="grid items-start gap-3 xl:grid-cols-2">
                  {plans.map((plan) => {
                    const linked = objectiveRows
                      .flatMap((row) =>
                        row.items.map((kpi) => ({
                          ...kpi,
                          objective: row.objective,
                        })),
                      )
                      .find(
                        (kpi) =>
                          String(kpi.item.id) === String(plan.indicatorId),
                      );
                    const linkedAssignment =
                      linked &&
                      assignments.find(
                        (assignment) =>
                          String(assignment.dashboardId) ===
                            String(linked.dashboard.id) &&
                          String(assignment.itemId) ===
                            String(linked.item.id) &&
                          assignment.contributionObjectiveId,
                      );
                    const linkedOc =
                      linkedAssignment &&
                      contributions.find(
                        (oc) =>
                          oc.id === linkedAssignment.contributionObjectiveId,
                      );
                    const planActivities = plan.activities || [];
                    const next = planActivities
                      .filter(
                        (activity) =>
                          activity.progress < 100 && activity.targetDate,
                      )
                      .sort((a, b) =>
                        String(a.targetDate).localeCompare(
                          String(b.targetDate),
                        ),
                      )[0];
                    return (
                      <article
                        key={plan.id}
                        className="rounded-2xl border border-white/10 bg-slate-900/60 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[9px] font-black uppercase tracking-widest text-cyan-300">
                              Ejecución estratégica
                            </p>
                            <h3 className="font-bold text-white">
                              {plan.title}
                            </h3>
                          </div>
                          <span className="text-xs font-black text-cyan-300">
                            {plan.progress}%
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-slate-300">
                          {linked
                            ? `${linked.objective.code} · ${linked.item.indicator} · ${linked.dashboard.area || "Área no definida"}`
                            : "SIN OBJETIVO ESTRATÉGICO"}
                        </p>
                        {linkedOc && (
                          <p className="mt-1 text-xs text-indigo-300">
                            {linkedOc.displayCode} · {linkedOc.title}
                          </p>
                        )}
                        <p className="mt-2 text-xs text-slate-400">
                          {plan.responsible || "Sin responsable"} ·{" "}
                          {
                            planActivities.filter(
                              (activity) => activity.progress < 100,
                            ).length
                          }{" "}
                          acciones activas ·{" "}
                          {
                            planActivities.filter(
                              (activity) =>
                                activity.progress < 100 &&
                                activity.targetDate &&
                                new Date(activity.targetDate) < new Date(),
                            ).length
                          }{" "}
                          vencidas
                        </p>
                        <p className="mt-2 text-xs text-slate-400">
                          Próximo compromiso:{" "}
                          {next?.targetDate || "Sin próximo compromiso"}
                        </p>
                        {linked && (
                          <button
                            type="button"
                            onClick={() =>
                              onNavigateToKpi?.(
                                linked.dashboard.id,
                                linked.item.id,
                              )
                            }
                            className="mt-3 text-[10px] font-black uppercase tracking-widest text-cyan-300"
                          >
                            IR AL KPI
                          </button>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}
      {selectedPlan && (
        <div
          role="dialog"
          aria-label={`Plan ${selectedPlan.title}`}
          className="rounded-2xl border border-cyan-500/30 bg-slate-900 p-5"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-cyan-300">
                Detalle del plan
              </p>
              <h3 className="mt-1 text-lg font-black text-white">
                {selectedPlan.title}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setSelectedPlan(null)}
              className="text-xs font-black uppercase text-slate-400"
            >
              Cerrar
            </button>
          </div>
          <p className="mt-3 text-sm text-slate-300">
            {selectedPlan.description || "Sin descripción"}
          </p>
          <div className="mt-4 space-y-2">
            {(selectedPlan.activities || []).map((activity) => (
              <div
                key={activity.id}
                className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300"
              >
                {activity.title || "Actividad sin título"} · {activity.progress}
                %
              </div>
            ))}
          </div>
        </div>
      )}
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

const AREA_SEVERITY: Record<string, number> = {
  CRÍTICO: 0,
  "REQUIERE ATENCIÓN": 1,
  "DATOS PENDIENTES": 2,
  "BAJO CONTROL": 3,
  "NO EVALUABLE": 4,
};

const AreaKpiDirectory: React.FC<{
  rows: { label: string; items: StrategicKpiCandidate[] }[];
  reading: (
    item: DashboardItem,
    dashboard: Dashboard,
  ) => ReturnType<typeof buildExecutiveKpiReading>;
  onNavigateToKpi: (
    dashboardId: number | string,
    itemId: number | string,
  ) => void;
}> = ({ rows, reading, onNavigateToKpi }) => (
  <div
    className="grid items-start gap-4 xl:grid-cols-2"
    aria-label="Indicadores por área"
  >
    {rows.map((row) => {
      const items = [...row.items].sort(
        (a, b) =>
          (AREA_SEVERITY[reading(a.item, a.dashboard).status] ?? 9) -
          (AREA_SEVERITY[reading(b.item, b.dashboard).status] ?? 9),
      );
      return (
        <article
          key={row.label}
          className="rounded-2xl border border-white/10 bg-slate-900/70 p-5"
        >
          <p className="text-[9px] font-black uppercase tracking-[0.25em] text-slate-500">
            Área ejecutiva
          </p>
          <h3 className="mt-1 text-xl font-black uppercase tracking-tight text-white">
            {row.label}
          </h3>
          <div className="mt-4 border-t border-white/5 pt-3">
            <p className="text-[9px] font-black uppercase tracking-widest text-cyan-300">
              Indicadores · {items.length}
            </p>
            <div className="mt-2 space-y-1">
              {items.map((kpi) => {
                const result = reading(kpi.item, kpi.dashboard);
                const color =
                  result.status === "CRÍTICO"
                    ? "bg-rose-400"
                    : result.status === "REQUIERE ATENCIÓN"
                      ? "bg-amber-400"
                      : result.status === "BAJO CONTROL"
                        ? "bg-emerald-400"
                        : "bg-slate-400";
                return (
                  <div
                    key={kpi.identity}
                    className="flex items-center justify-between gap-2 border-b border-white/5 py-2 text-[10px]"
                  >
                    <span className="flex min-w-0 items-center gap-2 text-slate-200">
                      <span
                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${color}`}
                      />
                      <span className="whitespace-normal">
                        {kpi.item.indicator || kpi.item.name}
                      </span>
                    </span>
                    <span className="shrink-0 text-right text-slate-400">
                      {result.score == null
                        ? "—"
                        : `${Math.round(result.score)}%`}{" "}
                      · {result.status}
                    </span>
                    <button
                      type="button"
                      className="shrink-0 font-black uppercase tracking-widest text-cyan-300"
                      onClick={() =>
                        onNavigateToKpi(kpi.dashboard.id, kpi.item.id)
                      }
                    >
                      REVISAR KPI
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </article>
      );
    })}
  </div>
);

const PlanDirectory: React.FC<{
  plans: ActionPlan[];
  objectiveRows: {
    objective: StrategicObjective;
    items: StrategicKpiCandidate[];
  }[];
  onOpenPlan: (plan: ActionPlan) => void;
  onNavigateToKpi: (
    dashboardId: number | string,
    itemId: number | string,
  ) => void;
}> = ({ plans, objectiveRows, onOpenPlan, onNavigateToKpi }) => (
  <div
    className="grid items-start gap-3 xl:grid-cols-2"
    aria-label="Planes estratégicos"
  >
    {plans.length === 0 ? (
      <p className="col-span-full rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-400">
        No hay planes estratégicos activos.
      </p>
    ) : (
      plans.map((plan) => {
        const linked = objectiveRows
          .flatMap((row) =>
            row.items.map((kpi) => ({ ...kpi, objective: row.objective })),
          )
          .find((kpi) => String(kpi.item.id) === String(plan.indicatorId));
        return (
          <article
            key={plan.id}
            className="rounded-2xl border border-white/10 bg-slate-900/60 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-cyan-300">
                  Ejecución estratégica
                </p>
                <h3 className="font-bold text-white">{plan.title}</h3>
              </div>
              <span className="text-xs font-black text-cyan-300">
                {plan.progress}%
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-300">
              {linked
                ? `${linked.objective.code} · ${linked.item.indicator} · ${linked.dashboard.area || "Área no definida"}`
                : "SIN OBJETIVO ESTRATÉGICO"}
            </p>
            <p className="mt-2 text-xs text-slate-400">
              {plan.responsible || "Sin responsable"}
            </p>
            <div className="mt-3 flex gap-3">
              <button
                type="button"
                onClick={() => onOpenPlan(plan)}
                className="rounded-lg bg-cyan-600 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white"
              >
                ABRIR PLAN
              </button>
              {linked && (
                <button
                  type="button"
                  onClick={() =>
                    onNavigateToKpi(linked.dashboard.id, linked.item.id)
                  }
                  className="rounded-lg border border-cyan-500/30 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-cyan-300"
                >
                  VER KPI
                </button>
              )}
            </div>
          </article>
        );
      })
    )}
  </div>
);

const PlanDirectoryFinal: React.FC<{
  plans: ActionPlan[];
  objectiveRows: {
    objective: StrategicObjective;
    items: StrategicKpiCandidate[];
  }[];
  onOpenPlan: (plan: ActionPlan) => void;
  onNavigateToKpi: (
    dashboardId: number | string,
    itemId: number | string,
  ) => void;
}> = ({ plans, objectiveRows, onOpenPlan, onNavigateToKpi }) => {
  const [summaryId, setSummaryId] = useState<string | null>(null);
  return (
    <div
      className="grid items-start gap-3 xl:grid-cols-2"
      aria-label="Planes estratégicos"
    >
      {plans.length === 0 ? (
        <p className="col-span-full rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-400">
          No hay planes estratégicos activos.
        </p>
      ) : (
        plans.map((plan) => {
          const linked = objectiveRows
            .flatMap((row) =>
              row.items.map((kpi) => ({ ...kpi, objective: row.objective })),
            )
            .find((kpi) => String(kpi.item.id) === String(plan.indicatorId));
          const expanded = summaryId === plan.id;
          return (
            <article
              key={plan.id}
              className="rounded-2xl border border-white/10 bg-slate-900/60 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-cyan-300">
                    Ejecución estratégica
                  </p>
                  <h3 className="font-bold text-white">{plan.title}</h3>
                </div>
                <span className="text-xs font-black text-cyan-300">
                  {plan.progress}%
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-300">
                {linked
                  ? `${linked.objective.code} · ${linked.item.indicator} · ${linked.dashboard.area || "Área no definida"}`
                  : "SIN OBJETIVO ESTRATÉGICO"}
              </p>
              <p className="mt-2 text-xs text-slate-400">
                {plan.responsible || "Sin responsable"}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onOpenPlan(plan)}
                  className="rounded-lg bg-cyan-600 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white"
                >
                  REVISAR PLAN
                </button>
                <button
                  type="button"
                  onClick={() => setSummaryId(expanded ? null : plan.id)}
                  className="rounded-lg border border-white/15 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-300"
                >
                  {expanded ? "OCULTAR RESUMEN" : "VER RESUMEN"}
                </button>
                {linked && (
                  <button
                    type="button"
                    onClick={() =>
                      onNavigateToKpi(linked.dashboard.id, linked.item.id)
                    }
                    className="rounded-lg border border-cyan-500/30 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-cyan-300"
                  >
                    VER KPI RELACIONADO
                  </button>
                )}
              </div>
              {expanded && (
                <div
                  className="mt-3 space-y-2 border-t border-white/5 pt-3"
                  aria-label={`Resumen de ${plan.title}`}
                >
                  <p className="text-xs text-slate-300">
                    {plan.description || "Sin descripción"}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    Avance general: {plan.progress}% · Responsable:{" "}
                    {plan.responsible || "Sin responsable"}
                  </p>
                  {(plan.activities || []).map((activity) => (
                    <div
                      key={activity.id}
                      className="rounded-lg border border-white/10 px-3 py-2 text-[10px] text-slate-300"
                    >
                      <p>
                        {activity.title || "Actividad sin título"} ·{" "}
                        {activity.progress}%
                      </p>
                      <p className="text-slate-500">
                        {activity.targetDate || "Sin fecha"} ·{" "}
                        {activity.result || "Sin nota"} ·{" "}
                        {activity.impact || "NOT_EVALUATED"}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </article>
          );
        })
      )}
    </div>
  );
};
