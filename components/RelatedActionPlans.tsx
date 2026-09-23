import React, { useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import {
  ActionPlan,
  ActionPlanActivity,
  ActionPlanOriginPeriodType,
  ActionPlanStatus,
} from "../types";
import { firebaseService } from "../services/firebaseService";
import {
  calculateActionPlanProgress,
  classifyActionPlanActivity,
  classifyActionPlanExecution,
  deriveActionPlanStatus,
  normalizeActionImpact,
  reconcileActionPlanStatus,
  executionSemaphoreVisual,
  getActivityTrafficLight,
} from "../utils/actionPlanLogic";
export { normalizeActionImpact } from "../utils/actionPlanLogic";

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
export const activityProgressVisual = (progress: number) =>
  progress >= 100
    ? {
        label: "Completada",
        tone: "emerald",
        className: "bg-emerald-500",
        text: "text-emerald-300",
      }
    : {
        label: progress > 0 ? "En ejecución" : "Pendiente",
        tone: "cyan",
        className: "bg-cyan-500",
        text: "text-cyan-300",
      };
export type ActivityTimeState = "vencida" | "próxima" | "activa" | "completada" | "sin_fecha";
export const activityTimeState = (activity: Pick<ActionPlanActivity, "progress" | "targetDate">, now = new Date()): ActivityTimeState => {
  const signal = classifyActionPlanActivity(activity, now);
  return signal === "overdue" ? "vencida" : signal === "upcoming" ? "próxima" : signal === "completed" ? "completada" : signal === "missing_date" || signal === "cancelled" ? "sin_fecha" : "activa";
};
const activityTimeLabel: Record<ActivityTimeState, string> = { vencida: "Vencida", próxima: "Próxima", activa: "En plazo", completada: "Completada", sin_fecha: "Sin fecha" };
const activityTimeOrder: Record<ActivityTimeState, number> = { vencida: 0, próxima: 1, activa: 2, completada: 3, sin_fecha: 2 };
const impactVisual = (impact?: ActionPlanActivity["impact"]) =>
  ({
    NOT_EVALUATED: {
      label: "Por evaluar",
      icon: "⚪",
      className: "text-slate-400",
    },
    FAVORABLE: {
      label: "Impacto favorable",
      icon: "🟢",
      className: "text-emerald-300",
    },
    PARTIAL: {
      label: "Impacto parcial",
      icon: "🟡",
      className: "text-amber-300",
    },
    LOW_OR_NONE: {
      label: "Bajo / sin impacto",
      icon: "🔴",
      className: "text-rose-300",
    },
  })[normalizeActionImpact(impact)];
const impactDistribution = (activities?: ActionPlanActivity[]) => (activities || []).reduce((counts, activity) => {
  counts[normalizeActionImpact(activity.impact)] += 1;
  return counts;
}, { NOT_EVALUATED: 0, FAVORABLE: 0, PARTIAL: 0, LOW_OR_NONE: 0 } as Record<ReturnType<typeof normalizeActionImpact>, number>);
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
  initialPlanId?: number | string;
  onCancelEdit?: () => void;
  onSaved?: () => void;
  collapsed?: boolean;
  onToggle?: () => void;
}
export const RelatedActionPlans: React.FC<Props> = ({
  indicatorId,
  dashboardId,
  clientId,
  year,
  periodType,
  periodIndex,
  canEdit,
  initialPlanId,
  onCancelEdit,
  onSaved,
  collapsed = false,
  onToggle,
}) => {
  const [plans, setPlans] = useState<ActionPlan[]>([]);
  const [state, setState] = useState<"loading" | "saving" | "saved" | "error">(
    "loading",
  );
  const [hasLoaded, setHasLoaded] = useState(false);
  const [draft, setDraft] = useState<ActionPlan | null>(null);
  const [planMode, setPlanMode] = useState<"view" | "edit">("view");
  const [deleteConfirmation, setDeleteConfirmation] = useState(false);
  const [planSettingsOpen, setPlanSettingsOpen] = useState(false);
  const [expandedActivityId, setExpandedActivityId] = useState<string | null>(null);
  const [quickActivityId, setQuickActivityId] = useState<string | null>(null);
  const [newActivityId, setNewActivityId] = useState<string | null>(null);
  const [activityNameError, setActivityNameError] = useState("");
  const [resultExpandedActivityId, setResultExpandedActivityId] = useState<string | null>(null);
  const [deleteActivityConfirmation, setDeleteActivityConfirmation] = useState<string | null>(null);
  const newActivityNameRef = useRef<HTMLTextAreaElement | null>(null);
  const addActivityButtonRef = useRef<HTMLButtonElement | null>(null);
  const load = async () => {
    setState("loading");
    try {
      setPlans(
        Array.from(new Map((await firebaseService.getActionPlansForIndicator(indicatorId, clientId)).map((plan) => [String(plan.id), plan])).values()),
      );
      setHasLoaded(true);
      setState("saved");
    } catch {
      setHasLoaded(true);
      setState("error");
    }
  };
  useEffect(() => {
    void load();
  }, [indicatorId, clientId]);
  useEffect(() => {
    if (!initialPlanId || draft || state === "loading") return;
    const requested = plans.find(
      (plan) => String(plan.id) === String(initialPlanId),
    );
    if (requested) {
      // Selecting a plan is for inspection first; editing remains an explicit action.
      setPlanSettingsOpen(false);
      setExpandedActivityId(null);
      setQuickActivityId(null);
      setPlanMode("view");
      setDraft({ ...requested, activities: requested.activities || [] });
    }
  }, [initialPlanId, canEdit, draft, plans, state]);
  const origin = (p: ActionPlan) =>
    p.originPeriodType === "weekly"
      ? `Semana ${(p.originPeriodIndex || 0) + 1} · ${p.originYear}`
      : `${monthNames[p.originPeriodIndex || 0]} ${p.originYear}`;
  const plansRequiringAttention = plans.filter((plan) =>
    ["overdue", "upcoming"].includes(classifyActionPlanExecution(plan)),
  ).length;
  const begin = (plan?: ActionPlan) => {
    setPlanMode("edit");
    setPlanSettingsOpen(!plan);
    setExpandedActivityId(null);
    setQuickActivityId(null);
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
  };
  const openPlan = (plan: ActionPlan) => {
    setPlanMode("view");
    setPlanSettingsOpen(false);
    setExpandedActivityId(null);
    setQuickActivityId(null);
    setDraft({ ...plan, activities: plan.activities || [] });
  };
  const openEdit = (plan: ActionPlan) => {
    begin(plan);
    setPlanSettingsOpen(true);
  };
  const openQuickEdit = (plan: ActionPlan, activityId: string) => {
    setPlanMode("edit");
    setPlanSettingsOpen(false);
    setExpandedActivityId(null);
    setResultExpandedActivityId(null);
    setDeleteActivityConfirmation(null);
    setDraft((current) => current?.id === plan.id ? current : { ...plan, activities: plan.activities || [] });
    setQuickActivityId(activityId);
  };
  const openActivityEdit = (plan: ActionPlan, activityId: string) => {
    setResultExpandedActivityId(null);
    setQuickActivityId(null);
    setPlanSettingsOpen(false);
    setPlanMode("edit");
    setExpandedActivityId(activityId);
  };
  const requestActivityDelete = (plan: ActionPlan, activityId: string) => {
    begin(plan);
    setDeleteActivityConfirmation(activityId);
  };
  useEffect(() => {
    if (onToggle && !collapsed && state === "saved" && plans.length === 1 && !draft) {
      openPlan(plans[0]);
    }
  }, [onToggle, collapsed, state, plans, draft]);
  const closePlan = () => {
    setDraft(null);
    setPlanMode("view");
    setPlanSettingsOpen(false);
    setExpandedActivityId(null);
    setQuickActivityId(null);
    onCancelEdit?.();
  };
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
  const addActivity = () => {
    const activity = emptyActivity();
    setActivityNameError("");
    setNewActivityId(activity.id);
    setPlanSettingsOpen(false);
    setQuickActivityId(null);
    setDeleteActivityConfirmation(null);
    setExpandedActivityId(activity.id);
    setDraft((current) => current ? { ...current, activities: [...(current.activities || []), activity] } : current);
    requestAnimationFrame(() => {
      newActivityNameRef.current?.scrollIntoView?.({ behavior: "smooth", block: "center" });
      newActivityNameRef.current?.focus();
    });
  };
  const save = async () => {
    if (!draft || !draft.title.trim()) return;
    const invalidNewActivity = newActivityId && (draft.activities || []).find((activity) => activity.id === newActivityId && !activity.title.trim());
    if (invalidNewActivity) {
      setActivityNameError("Escribe un nombre antes de guardar la actividad.");
      setQuickActivityId(null); setExpandedActivityId(newActivityId);
      requestAnimationFrame(() => newActivityNameRef.current?.focus());
      return;
    }
    setState("saving");
    const activities = draft.activities || [];
    const changes = {
      ...draft,
      activities,
      progress: calculateActionPlanProgress(activities),
      status: reconcileActionPlanStatus(draft.status, activities),
    };
    try {
      if (draft.id) await firebaseService.updateActionPlan(draft.id, changes);
      else await firebaseService.createActionPlan(changes);
      setDraft(null);
      setNewActivityId(null);
      setActivityNameError("");
      await load();
      onSaved?.();
    } catch {
      setState("error");
    }
  };
  const removePlan = async () => {
    if (!draft?.id || !clientId) return;
    setState("saving");
    try {
      await firebaseService.deleteActionPlan(clientId, draft.id);
      setDeleteConfirmation(false);
      setDraft(null);
      await load();
    } catch {
      setState("error");
    }
  };
  const control =
    "mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30 placeholder:text-slate-500";
  return (
    <section className={collapsed || (state === "saved" && plans.length === 0 && !draft) ? "" : "mt-6 rounded-2xl border border-cyan-500/20 bg-slate-950/30 p-6"}>
      {collapsed ? <div className="flex justify-end">
        {state === "saved" && plans.length > 0 && onToggle && <button type="button" aria-expanded="false" onClick={onToggle} className="min-h-[40px] rounded-lg border border-cyan-500/30 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-cyan-200 hover:bg-cyan-500/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300">VER PLANES ({plans.length})</button>}
        {state === "loading" && <span className="text-xs text-slate-500">Cargando planes…</span>}
        {state === "error" && <span className="text-xs text-red-400">No se pudieron cargar los planes.</span>}
        {canEdit && state === "saved" && plans.length === 0 && <button type="button" onClick={() => { onToggle?.(); begin(); }} className="min-h-[40px] rounded-xl bg-cyan-600 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white">+ Nuevo plan</button>}
      </div> : <>
      {state === "saved" && plans.length > 0 && <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-black uppercase tracking-widest text-cyan-300">
            Planes relacionados
          </h4>
      <p className="mt-1 text-xs text-slate-400">Transversales al indicador · {plans.length} {plans.length === 1 ? "plan relacionado" : "planes relacionados"}{plansRequiringAttention > 0 ? ` · ${plansRequiringAttention} requieren atención` : ""}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
        {onToggle && <button type="button" aria-expanded="true" onClick={onToggle} className="min-h-[40px] rounded-lg border border-cyan-500/30 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-cyan-200 hover:bg-cyan-500/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300">VOLVER AL INDICADOR</button>}
        {canEdit && (
          <button
            onClick={() => begin()}
            className="rounded-xl bg-cyan-600 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white"
          >
            + Nuevo plan
          </button>
        )}
        </div>
      </div>}
      {!hasLoaded && state === "loading" && <p className="text-xs text-slate-500">Cargando planes…</p>}
      {state === "error" && <p className="text-xs text-red-400">No se pudieron cargar o guardar los planes.</p>}
      <div>
      <div className="space-y-3">
        {plans.filter((p) => !draft || String(p.id) !== String(draft.id)).map((p) => (
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
                <div className="mt-2 flex flex-wrap gap-1">
                  {(p.activities || []).map((activity) => {
                    const visual = impactVisual(activity.impact);
                    return (
                      <span
                        key={activity.id}
                        className={`rounded border border-white/10 px-2 py-1 text-[9px] font-bold uppercase ${visual.className}`}
                      >
                        {visual.icon} {visual.label}
                      </span>
                    );
                  })}
                </div>
              </div>
              <div className="flex flex-wrap items-start justify-end gap-3">
                {plans.length > 1 && <button type="button" onClick={() => openPlan(p)} className="text-[10px] font-black uppercase text-cyan-300">EXPANDIR EJECUCIÓN</button>}
                {canEdit && <button type="button" onClick={() => begin(p)} className="text-[10px] font-black uppercase text-cyan-400">Editar plan</button>}
              </div>
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
          {(() => { const activities = (draft.activities || []).filter((activity) => activity.id !== newActivityId); const progress = calculateActionPlanProgress(activities); const grouped = activities.reduce((counts, activity) => { counts[activityTimeState(activity)] += 1; return counts; }, { vencida: 0, próxima: 0, activa: 0, completada: 0, sin_fecha: 0 } as Record<ActivityTimeState, number>); const impact = impactDistribution(activities); const visual = executionSemaphoreVisual[classifyActionPlanExecution({ ...draft, activities })]; const tone = visual.color === "red" ? "text-rose-300" : visual.color === "orange" ? "text-amber-300" : visual.color === "green" ? "text-emerald-300" : "text-slate-300"; return <div className="rounded-xl bg-slate-950/40 p-3"><div className="flex flex-wrap items-start justify-between gap-3"><div><h5 className="text-base font-black text-slate-100">{draft.title || "Nuevo plan"}</h5><p className="mt-1 text-xs text-slate-400">{draft.responsible || "Sin responsable"} · {draft.targetDate ? `Compromiso: ${draft.targetDate}` : "Sin fecha"}</p></div></div><div className="mt-4 grid gap-3 md:grid-cols-3"><div className="rounded-lg border border-cyan-500/20 bg-slate-900/50 p-3"><p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Avance</p><p className="mt-1 text-lg font-black text-cyan-300">{progress}% <span className="text-[10px] text-slate-400">· {activities.length} actividades</span></p><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-cyan-500" style={{ width: `${progress}%` }} /></div></div><div className="rounded-lg border border-white/10 bg-slate-900/50 p-3"><p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Cumplimiento</p><p className={`mt-1 text-lg font-black ${tone}`}>{visual.label}</p><p className="mt-1 text-[10px] uppercase text-slate-400"><span className="text-rose-300">{grouped.vencida} vencidas</span> · <span className="text-amber-300">{grouped.próxima} próximas</span></p></div><div className="rounded-lg border border-white/10 bg-slate-900/50 p-3"><p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Impacto</p>{impact.FAVORABLE + impact.PARTIAL + impact.LOW_OR_NONE > 0 ? <p className="mt-1 text-[10px] font-bold uppercase"><span className="text-emerald-300">{impact.FAVORABLE} favorable</span> · <span className="text-amber-300">{impact.PARTIAL} parcial</span> · <span className="text-rose-300">{impact.LOW_OR_NONE} bajo</span></p> : <p className="mt-1 text-sm font-black text-slate-300">Por evaluar</p>}<p className="mt-1 text-[10px] text-slate-500">{impact.NOT_EVALUATED} sin evaluar</p></div></div></div>; })()}
          {planMode === "view" ? <>
            <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/40 p-4">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Consulta del plan</p>
              {draft.description && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-300">{draft.description}</p>}
              <p className="mt-2 text-[10px] uppercase tracking-widest text-slate-500">Origen: {origin(draft)}</p>
            </div>
            <div className="mt-5 border-t border-white/5 pt-4">
              <h5 className="text-xs font-black uppercase tracking-widest text-slate-300">Actividades</h5>
              <div className="mt-3 space-y-2">
                {(draft.activities || []).map((activity) => {
                  const visual = impactVisual(activity.impact);
                  const expanded = resultExpandedActivityId === activity.id;
                  return <article key={activity.id} className="rounded-lg border border-slate-700/70 bg-slate-950/50 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div><p className="font-bold text-slate-100">{activity.title || "Actividad sin título"}</p><p className="mt-1 text-xs text-slate-400">{activity.responsible || "Sin responsable"} · {activity.targetDate || "Sin fecha"}</p><p className="mt-1 text-[10px] font-black uppercase text-slate-300">{activityTimeLabel[activityTimeState(activity)]} · {activity.progress}%</p><span className={`mt-1 inline-flex text-[10px] font-bold uppercase ${visual.className}`}>{visual.icon} {visual.label}</span></div>
                      <div className="flex flex-wrap items-center justify-end gap-2"><div className="h-1.5 w-24 rounded-full bg-slate-800"><div className="h-full rounded-full bg-cyan-500" style={{ width: `${activity.progress}%` }} /></div>{canEdit && <><button type="button" onClick={() => quickActivityId === activity.id ? setQuickActivityId(null) : openQuickEdit(draft, activity.id)} className="rounded-lg bg-cyan-600 px-3 py-2 text-[10px] font-black text-white">{quickActivityId === activity.id ? "OCULTAR ACTUALIZACIÓN" : "ACTUALIZAR"}</button><button type="button" onClick={() => expandedActivityId === activity.id ? setExpandedActivityId(null) : openActivityEdit(draft, activity.id)} className="px-2 py-2 text-[10px] font-black text-cyan-300">{expandedActivityId === activity.id ? "OCULTAR EDICIÓN" : "EDITAR"}</button><button type="button" aria-label={`Eliminar actividad ${activity.title || "sin título"}`} onClick={() => requestActivityDelete(draft, activity.id)} className="inline-flex items-center gap-1 rounded-lg border border-rose-500/30 px-2 py-2 text-[10px] font-black text-rose-300"><Trash2 className="h-3.5 w-3.5" aria-hidden="true" />ELIMINAR</button></>}</div>
                    </div>
                    <button type="button" onClick={() => setResultExpandedActivityId(expanded ? null : activity.id)} className="mt-3 text-[10px] font-black uppercase tracking-widest text-cyan-300">{expanded ? "OCULTAR RESULTADO Y NOTA" : "VER RESULTADO Y NOTA"}</button>
                    {expanded && <div className="mt-2 rounded-lg border border-white/10 bg-slate-900/70 p-3 text-xs text-slate-300"><p><span className="font-bold text-slate-400">Resultado o nota:</span> {activity.result?.trim() || "Sin resultado registrado."}</p><p className="mt-1"><span className="font-bold text-slate-400">Impacto declarado:</span> {visual.label}</p></div>}
                  </article>;
                })}
                {(draft.activities || []).length === 0 && <p className="text-xs text-slate-500">Este plan no tiene actividades registradas.</p>}
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-3"><button type="button" onClick={closePlan} className="text-xs text-slate-400">Contraer plan</button>{canEdit && <button type="button" onClick={() => openEdit(draft)} className="rounded-lg bg-cyan-600 px-5 py-2 text-xs font-bold text-white">Editar plan</button>}</div>
          </> : <>
          <button type="button" onClick={() => { setPlanSettingsOpen(value => !value); setExpandedActivityId(null); setQuickActivityId(null); }} className="mt-4 text-[10px] font-black uppercase tracking-widest text-cyan-400">{planSettingsOpen ? "Ocultar edición del plan" : "Editar plan"}</button>
          {planSettingsOpen && <div className="mt-3 rounded-xl border border-white/10 bg-slate-950/40 p-4"><Field label="Nombre del plan">
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
            <Field label="Fecha compromiso del plan">
              <input
                type="date"
                value={draft.targetDate || ""}
                onChange={(e) => update("targetDate", e.target.value)}
                className={control}
              />
            </Field>
          </div>
           <p className="mt-3 text-[10px] uppercase tracking-widest text-slate-500">
            Origen: {origin(draft)}{" "}
            <span className="normal-case tracking-normal text-slate-600">
              (metadata histórica · no editable)
            </span>
          </p></div>}
          <div className="mt-5 border-t border-white/5 pt-4">
            <div className="mb-3 flex items-center justify-between">
              <h5 className="text-xs font-black uppercase tracking-widest text-slate-300">
                Actividades
              </h5>
            </div>
            <div className="space-y-2">
              {(draft.activities || []).map((activity, index) => ({ activity, index })).sort((left, right) => left.activity.id === newActivityId ? 1 : right.activity.id === newActivityId ? -1 : activityTimeOrder[activityTimeState(left.activity)] - activityTimeOrder[activityTimeState(right.activity)] || left.index - right.index).map(({ activity: a }) => (
                <div
                  key={a.id}
                  className="rounded-lg border border-slate-700/70 bg-slate-950/50 p-2.5"
                >
                  {expandedActivityId !== a.id && <><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-bold text-slate-100">{a.title || "Actividad sin título"}</p><p className="mt-0.5 text-xs text-slate-400">{a.responsible || "Sin responsable"} · {a.targetDate ? new Date(`${a.targetDate}T00:00:00`).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }) : "Sin fecha"}</p><p className={`mt-0.5 text-[10px] font-black uppercase ${activityTimeState(a) === "vencida" ? "text-rose-300" : activityTimeState(a) === "próxima" ? "text-amber-300" : activityTimeState(a) === "sin_fecha" ? "text-slate-300" : "text-emerald-300"}`}>{activityTimeLabel[activityTimeState(a)]} · {a.progress}%</p><span className={`mt-0.5 inline-flex text-[10px] font-bold uppercase ${impactVisual(a.impact).className}`}>{impactVisual(a.impact).icon} {impactVisual(a.impact).label}</span></div><div className="flex flex-wrap items-center justify-end gap-2"><button type="button" onClick={() => { setPlanSettingsOpen(false); setExpandedActivityId(null); setResultExpandedActivityId(null); setQuickActivityId(quickActivityId === a.id ? null : a.id); }} className="rounded-lg bg-cyan-600 px-3 py-2 text-[10px] font-black text-white">{quickActivityId === a.id ? "OCULTAR ACTUALIZACIÓN" : "ACTUALIZAR"}</button><button type="button" onClick={() => { setPlanSettingsOpen(false); setQuickActivityId(null); setResultExpandedActivityId(null); setExpandedActivityId(a.id); }} className="px-2 py-2 text-[10px] font-black text-cyan-300">EDITAR</button><button type="button" aria-label={`Eliminar actividad ${a.title || "sin título"}`} onClick={() => setDeleteActivityConfirmation(a.id)} className="inline-flex items-center gap-1 rounded-lg border border-rose-500/30 px-2 py-2 text-[10px] font-black text-rose-300 hover:bg-rose-500/10"><Trash2 className="h-3.5 w-3.5" aria-hidden="true" />ELIMINAR</button></div></div><div className="mt-2 h-1.5 rounded-full bg-slate-800"><div className={`h-full rounded-full ${activityProgressVisual(a.progress).className}`} style={{ width: `${a.progress}%` }} /></div>{deleteActivityConfirmation === a.id && <div role="alertdialog" aria-label="¿Eliminar esta actividad?" className="mt-2 rounded-lg border border-rose-500/30 bg-rose-950/20 p-3"><p className="text-xs font-bold text-rose-200">¿Eliminar “{a.title || "Actividad sin título"}”?</p><p className="mt-1 text-[10px] text-slate-300">Se quitará esta actividad del plan al guardar; no se eliminará el plan completo.</p><div className="mt-2 flex gap-2"><button type="button" onClick={() => setDeleteActivityConfirmation(null)} className="rounded px-2 py-1 text-[10px] text-slate-300">Cancelar</button><button type="button" onClick={() => { setDraft((d) => d ? { ...d, activities: (d.activities || []).filter((item) => item.id !== a.id) } : d); setDeleteActivityConfirmation(null); setExpandedActivityId(null); }} className="rounded border border-rose-500/40 px-2 py-1 text-[10px] font-bold text-rose-200">Eliminar actividad</button></div></div>}</>}
                  <button type="button" onClick={() => setResultExpandedActivityId(resultExpandedActivityId === a.id ? null : a.id)} className="mt-3 text-[10px] font-black uppercase tracking-widest text-cyan-300">{resultExpandedActivityId === a.id ? "OCULTAR RESULTADO Y NOTA" : "VER RESULTADO Y NOTA"}</button>
                  {resultExpandedActivityId === a.id && <div className="mt-2 rounded-lg border border-white/10 bg-slate-900/70 p-3 text-xs text-slate-300"><p><span className="font-bold text-slate-400">Resultado o nota:</span> {a.result?.trim() || "Sin resultado registrado."}</p><p className="mt-1"><span className="font-bold text-slate-400">Impacto declarado:</span> {impactVisual(a.impact).label}</p></div>}
                  {quickActivityId === a.id && <div className="mt-2 grid gap-2 rounded-lg border border-cyan-500/20 bg-slate-900/70 p-2.5 md:grid-cols-3"><Field label="Avance (%)"><input type="number" min="0" max="100" value={a.progress} onChange={(e) => updateActivity(a.id, "progress", Math.max(0, Math.min(100, Number(e.target.value))))} className={control} /></Field><Field label="Nota breve"><input value={a.result || ""} onChange={(e) => updateActivity(a.id, "result", e.target.value)} className={control} /></Field><Field label="Impacto"><select aria-label="Impacto" value={normalizeActionImpact(a.impact)} onChange={(e) => updateActivity(a.id, "impact", normalizeActionImpact(e.target.value as ActionPlanActivity["impact"]))} className={control}><option value="NOT_EVALUATED">⚪ Por evaluar</option><option value="FAVORABLE">🟢 Impacto favorable</option><option value="PARTIAL">🟡 Impacto parcial</option><option value="LOW_OR_NONE">🔴 Bajo / sin impacto</option></select><span className={`mt-1 inline-flex text-[9px] font-bold uppercase ${impactVisual(a.impact).className}`}>{impactVisual(a.impact).icon} {impactVisual(a.impact).label}</span></Field><p className="text-[10px] text-slate-400 md:col-span-3">Los cambios se guardan únicamente con “Guardar plan”.</p></div>}
                  {expandedActivityId === a.id && (<div className="mt-3"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><button type="button" onClick={() => { setExpandedActivityId(null); }} className="text-[10px] font-black uppercase tracking-widest text-cyan-300">Ocultar edición</button>{newActivityId === a.id && <button type="button" aria-label="Descartar actividad" onClick={() => { setDraft((d) => d ? { ...d, activities: (d.activities || []).filter((item) => item.id !== a.id) } : d); setNewActivityId(null); setActivityNameError(""); setExpandedActivityId(null); requestAnimationFrame(() => addActivityButtonRef.current?.focus()); }} className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-rose-500/30 px-3 py-2 text-[10px] font-black text-rose-300 hover:bg-rose-500/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-300"><Trash2 className="h-4 w-4" aria-hidden="true" />DESCARTAR ACTIVIDAD</button>}</div>
                  <div className="grid gap-3 md:grid-cols-[minmax(0,2fr),minmax(150px,1fr),150px,120px] md:items-end">
                    <Field label="Nombre de la actividad">
                      <textarea
                        ref={newActivityId === a.id ? newActivityNameRef : undefined}
                        autoFocus={newActivityId === a.id}
                        value={a.title}
                        placeholder="Escribe aquí la nueva actividad…"
                        onChange={(e) => { updateActivity(a.id, "title", e.target.value); if (e.target.value.trim()) setActivityNameError(""); }}
                        rows={2}
                        className={`${control} min-h-16 resize-y`}
                      />
                      {newActivityId === a.id && activityNameError && <span className="mt-1 block text-[10px] font-bold text-rose-300">{activityNameError}</span>}
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
                      <div>
                        {(() => {
                          const visual = activityProgressVisual(a.progress);
                          return (
                            <>
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
                              <div className="mt-2 h-1.5 rounded-full bg-slate-800">
                                <div
                                  className={`h-full rounded-full ${visual.className}`}
                                  style={{ width: `${a.progress}%` }}
                                />
                              </div>
                              <span
                                className={`mt-1 block text-[9px] font-bold uppercase ${visual.text}`}
                              >
                                {a.progress}% · {visual.label}
                              </span>
                            </>
                          );
                        })()}
                      </div>
                    </Field>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-[10px] uppercase tracking-widest text-slate-500">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${traffic[getActivityTrafficLight(a)]}`}
                    />
                    {executionSemaphoreVisual[classifyActionPlanActivity(a)].label}
                  </div></div>)}
                </div>
              ))}
              <button ref={addActivityButtonRef} type="button" onClick={addActivity} className="w-full rounded-lg border border-dashed border-cyan-500/40 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-cyan-300 hover:bg-cyan-500/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300">+ Agregar actividad</button>
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-3">
            {draft.id && planSettingsOpen && !deleteConfirmation && (
              <button
                type="button"
                onClick={() => setDeleteConfirmation(true)}
                className="mr-auto rounded-lg border border-rose-500/30 px-4 py-2 text-xs font-bold text-rose-300 hover:bg-rose-500/10"
              >
                Eliminar plan
              </button>
            )}
            <button
              onClick={() => {
                setDraft(null);
                onCancelEdit?.();
              }}
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
          {draft.id && deleteConfirmation && (
            <div
              className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4"
              role="alertdialog"
              aria-label="¿Eliminar este plan?"
            >
              <p className="text-sm font-black text-rose-200">
                ¿Eliminar este plan?
              </p>
              <p className="mt-1 text-xs text-slate-300">
                Se eliminará el plan y sus actividades. El indicador y su
                historial no se modificarán.
              </p>
              <div className="mt-3 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmation(false)}
                  className="px-3 py-2 text-xs font-bold text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={state === "saving"}
                  onClick={() => void removePlan()}
                  className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-black text-white disabled:opacity-50"
                >
                  {state === "saving" ? "Eliminando…" : "Eliminar plan"}
                </button>
              </div>
            </div>
           )}
           </>}
         </div>
      )}
       </div>
       </>}
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
