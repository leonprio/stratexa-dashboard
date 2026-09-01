import React, { useEffect, useState } from "react";
import {
  ActionPlan,
  ActionPlanActivity,
  ActionPlanOriginPeriodType,
  ActionPlanStatus,
} from "../types";
import { firebaseService } from "../services/firebaseService";
import {
  calculateActionPlanProgress,
  deriveActionPlanStatus,
  getActivityTrafficLight,
} from "../utils/actionPlanLogic";

const labels: Record<ActionPlanStatus, string> = {
  planned: "Planeado",
  in_progress: "En ejecución",
  completed: "Completado",
  cancelled: "Cancelado",
};
const traffic: Record<string, string> = {
  green: "bg-emerald-500",
  red: "bg-rose-500",
  yellow: "bg-amber-400",
  neutral: "bg-slate-600",
};
const monthNames = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];
const emptyActivity = (): ActionPlanActivity => ({
  id: crypto.randomUUID(),
  title: "",
  responsible: "",
  targetDate: "",
  progress: 0,
  impact: "NOT_EVALUATED",
  result: "",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});
const emptyPlan = (
  year: number,
  periodType: ActionPlanOriginPeriodType,
  periodIndex: number,
): ActionPlan => ({
  id: "",
  indicatorId: "",
  dashboardId: "",
  clientId: "",
  title: "",
  description: "",
  originYear: year,
  originPeriodType: periodType,
  originPeriodIndex: periodIndex,
  status: "planned",
  startDate: new Date().toISOString().slice(0, 10),
  progress: 0,
  expectedImpact: "",
  createdAt: "",
  updatedAt: "",
  activities: [],
});
interface Props {
  indicatorId: number | string;
  dashboardId: number | string;
  clientId?: string;
  year: number;
  periodType: ActionPlanOriginPeriodType;
  periodIndex: number;
  canEdit: boolean;
}
export const RelatedActionPlans: React.FC<Props> = ({
  indicatorId,
  dashboardId,
  clientId,
  year,
  periodType,
  periodIndex,
  canEdit,
}) => {
  const [plans, setPlans] = useState<ActionPlan[]>([]);
  const [state, setState] = useState<"loading" | "saving" | "saved" | "error">(
    "loading",
  );
  const [draft, setDraft] = useState<ActionPlan | null>(null);
  const load = async () => {
    setState("loading");
    try {
      setPlans(
        await firebaseService.getActionPlansForIndicator(indicatorId, clientId),
      );
      setState("saved");
    } catch {
      setState("error");
    }
  };
  useEffect(() => {
    void load();
  }, [indicatorId, clientId]);
  const origin = (p: ActionPlan) =>
    p.originPeriodType === "weekly"
      ? `Semana ${(p.originPeriodIndex || 0) + 1} · ${p.originYear}`
      : `${monthNames[p.originPeriodIndex || 0]} ${p.originYear}`;
  const begin = (plan?: ActionPlan) =>
    setDraft(
      plan
        ? { ...plan, activities: plan.activities || [] }
        : {
            ...emptyPlan(year, periodType, periodIndex),
            indicatorId,
            dashboardId,
            clientId: clientId?.trim().toUpperCase() || "",
          },
    );
  const update = (key: keyof ActionPlan, value: string) =>
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  const updateActivity = (
    id: string,
    key: keyof ActionPlanActivity,
    value: string | number,
  ) =>
    setDraft((d) =>
      d
        ? {
            ...d,
            activities: (d.activities || []).map((a) =>
              a.id === id
                ? { ...a, [key]: value, updatedAt: new Date().toISOString() }
                : a,
            ),
          }
        : d,
    );
  const save = async () => {
    if (!draft || !draft.title.trim()) return;
    setState("saving");
    const activities = draft.activities || [];
    const changes = {
      ...draft,
      activities,
      progress: calculateActionPlanProgress(activities),
      status: deriveActionPlanStatus(activities),
    };
    try {
      if (draft.id) await firebaseService.updateActionPlan(draft.id, changes);
      else await firebaseService.createActionPlan(changes);
      setDraft(null);
      await load();
    } catch {
      setState("error");
    }
  };
  const control =
    "mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30 placeholder:text-slate-500";
  return (
    <section className="mt-6 rounded-2xl border border-cyan-500/20 bg-slate-950/30 p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h4 className="text-sm font-black uppercase tracking-widest text-cyan-300">
            Planes relacionados
          </h4>
          <p className="mt-1 text-xs text-slate-500">
            Transversales al indicador · visibles en todos los períodos
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => begin()}
            className="rounded-xl bg-cyan-600 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white"
          >
            + Nuevo plan
          </button>
        )}
      </div>
      {state === "loading" && (
        <p className="text-xs text-slate-500">Cargando planes…</p>
      )}
      {state === "error" && (
        <p className="text-xs text-red-400">
          No se pudieron cargar o guardar los planes.
        </p>
      )}
      <div className="space-y-3">
        {plans.map((p) => (
          <div
            key={p.id}
            className="rounded-xl border border-white/5 bg-slate-900/50 p-4"
          >
            <div className="flex justify-between gap-4">
              <div>
                <h5 className="font-bold text-slate-100">{p.title}</h5>
                <p className="mt-1 text-xs text-slate-400">
                  {labels[deriveActionPlanStatus(p.activities)]} ·{" "}
                  {calculateActionPlanProgress(p.activities)}%
                  {p.responsible ? ` · ${p.responsible}` : ""}
                </p>
                <p className="mt-1 text-[10px] uppercase tracking-widest text-slate-600">
                  Origen: {origin(p)}
                </p>
              </div>
              {canEdit && (
                <button
                  onClick={() => begin(p)}
                  className="text-[10px] font-black uppercase text-cyan-400"
                >
                  Editar
                </button>
              )}
            </div>
            <div className="mt-3 h-1.5 rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-cyan-500"
                style={{
                  width: `${calculateActionPlanProgress(p.activities)}%`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
      {draft && (
        <div className="mt-4 rounded-xl border border-cyan-500/20 bg-slate-900/70 p-4">
          <Field label="Nombre del plan">
            <input
              autoFocus
              value={draft.title}
              onChange={(e) => update("title", e.target.value)}
              className={control}
            />
          </Field>
          <Field label="Descripción">
            <textarea
              value={draft.description || ""}
              onChange={(e) => update("description", e.target.value)}
              className={`${control} min-h-16`}
            />
          </Field>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <Field label="Responsable general">
              <input
                value={draft.responsible || ""}
                onChange={(e) => update("responsible", e.target.value)}
                className={control}
              />
            </Field>
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">
                Avance general calculado
              </span>
              <p className="mt-1 rounded-lg border border-slate-700 bg-slate-950/50 px-3 py-2 text-sm font-bold text-cyan-300">
                {calculateActionPlanProgress(draft.activities)}%
              </p>
            </div>
          </div>
          <p className="mt-3 text-[10px] uppercase tracking-widest text-slate-500">
            Origen: {origin(draft)}{" "}
            <span className="normal-case tracking-normal text-slate-600">
              (metadata histórica · no editable)
            </span>
          </p>
          <div className="mt-5 border-t border-white/5 pt-4">
            <div className="mb-3 flex items-center justify-between">
              <h5 className="text-xs font-black uppercase tracking-widest text-slate-300">
                Actividades
              </h5>
              <button
                onClick={() =>
                  setDraft((d) =>
                    d
                      ? {
                          ...d,
                          activities: [
                            ...(d.activities || []),
                            emptyActivity(),
                          ],
                        }
                      : d,
                  )
                }
                className="text-[10px] font-black uppercase tracking-widest text-cyan-400"
              >
                + Agregar actividad
              </button>
            </div>
            <div className="space-y-3">
              {(draft.activities || []).map((a) => (
                <div
                  key={a.id}
                  className="rounded-lg border border-slate-700/70 bg-slate-950/50 p-3"
                >
                  <div className="grid gap-2 md:grid-cols-[2fr,1fr,150px,100px,2fr,24px] md:items-end">
                    <Field label="Actividad">
                      <input
                        value={a.title}
                        onChange={(e) =>
                          updateActivity(a.id, "title", e.target.value)
                        }
                        className={control}
                      />
                    </Field>
                    <Field label="Responsable">
                      <input
                        value={a.responsible || ""}
                        onChange={(e) =>
                          updateActivity(a.id, "responsible", e.target.value)
                        }
                        className={control}
                      />
                    </Field>
                    <Field label="Fecha compromiso">
                      <input
                        type="date"
                        value={a.targetDate || ""}
                        onChange={(e) =>
                          updateActivity(a.id, "targetDate", e.target.value)
                        }
                        className={control}
                      />
                    </Field>
                    <Field label="Avance (%)">
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={a.progress}
                          onChange={(e) =>
                            updateActivity(
                              a.id,
                              "progress",
                              Math.max(
                                0,
                                Math.min(100, Number(e.target.value)),
                              ),
                            )
                          }
                          className={`${control} pr-7`}
                        />
                        <span className="absolute right-2 top-2 text-xs font-bold text-cyan-300">
                          %
                        </span>
                      </div>
                    </Field>
                    <Field label="Resultado / nota">
                      <input
                        value={a.result || ""}
                        onChange={(e) =>
                          updateActivity(a.id, "result", e.target.value)
                        }
                        className={control}
                      />
                    </Field>
                    <button
                      aria-label="Eliminar actividad"
                      onClick={() =>
                        window.confirm("¿Eliminar esta actividad?") &&
                        setDraft((d) =>
                          d
                            ? {
                                ...d,
                                activities: (d.activities || []).filter(
                                  (item) => item.id !== a.id,
                                ),
                              }
                            : d,
                        )
                      }
                      className="mb-2 text-slate-500 hover:text-rose-400"
                    >
                      ×
                    </button>
                  </div>
                  <div className="mt-2 max-w-xs">
                    <Field label="Impacto">
                      <select value={a.impact || 'NOT_EVALUATED'} onChange={e => updateActivity(a.id, 'impact', e.target.value)} className={control}>
                        <option value="NOT_EVALUATED">Por evaluar</option>
                        <option value="FAVORABLE">Impacto favorable</option>
                        <option value="PARTIAL">Impacto parcial</option>
                        <option value="LOW_OR_NONE">Bajo / sin impacto</option>
                      </select>
                    </Field>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-[10px] uppercase tracking-widest text-slate-500">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${traffic[getActivityTrafficLight(a)]}`}
                    />
                    {getActivityTrafficLight(a) === "green"
                      ? "Completada"
                      : getActivityTrafficLight(a) === "red"
                        ? "Vencida"
                        : getActivityTrafficLight(a) === "yellow"
                          ? "En ejecución"
                          : "Pendiente"}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-3">
            <button
              onClick={() => setDraft(null)}
              className="text-xs text-slate-400"
            >
              Cancelar
            </button>
            <button
              disabled={state === "saving"}
              onClick={() => void save()}
              className="rounded-lg bg-cyan-600 px-5 py-2 text-xs font-bold text-white"
            >
              {state === "saving" ? "Guardando…" : "Guardar plan"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
const Field = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <label className="block">
    <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">
      {label}
    </span>
    {children}
  </label>
);
