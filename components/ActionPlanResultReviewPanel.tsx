import React, { useEffect, useMemo, useRef, useState } from "react";
import type { ActionPlan, ActionPlanActivity, ActionPlanResultDecision, ActionPlanResultEffect, ActionPlanResultReview, User } from "../types";
import { firebaseService } from "../services/firebaseService";
import { getActionPlanResultReviews } from "../utils/actionPlanLogic";

const effectLabels: Record<ActionPlanResultEffect, string> = {
  FAVORABLE: "Favorable",
  PARTIAL: "Parcial",
  LOW_OR_NONE: "Bajo o sin efecto",
  NOT_EVALUABLE: "No evaluable",
};
const decisionLabels: Record<ActionPlanResultDecision, string> = {
  CLOSE: "Cerrar revisión",
  CONTINUE: "Continuar",
  ADJUST: "Ajustar",
};
const control = "mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30 placeholder:text-slate-500";
const today = () => new Date().toISOString().slice(0, 10);
export const safeEvidenceUrl = (value: string): string | undefined => {
  try { const url = new URL(value); return url.protocol === "https:" ? url.href : undefined; } catch { return undefined; }
};

interface Props {
  plan: ActionPlan;
  canEdit: boolean;
  currentUser?: User;
  assignableUsers?: User[];
  year: number;
  periodType: "monthly" | "weekly";
  periodIndex: number;
  initialOpen?: boolean;
  onSaved: (plan: ActionPlan) => void;
}

export const ActionPlanResultReviewPanel: React.FC<Props> = ({ plan, canEdit, currentUser, assignableUsers = [], year, periodType, periodIndex, initialOpen = false, onSaved }) => {
  const [open, setOpen] = useState(initialOpen);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [observedResult, setObservedResult] = useState("");
  const [effect, setEffect] = useState<ActionPlanResultEffect>("FAVORABLE");
  const [decision, setDecision] = useState<ActionPlanResultDecision>("CLOSE");
  const [note, setNote] = useState("");
  const [nextReviewDate, setNextReviewDate] = useState("");
  const [evidenceRef, setEvidenceRef] = useState("");
  const [commitmentType, setCommitmentType] = useState<"activity" | "plan">("activity");
  const [commitmentTitle, setCommitmentTitle] = useState("");
  const [commitmentResponsible, setCommitmentResponsible] = useState("");
  const [commitmentResponsibleUserId, setCommitmentResponsibleUserId] = useState("");
  const [commitmentDate, setCommitmentDate] = useState("");
  const firstFieldRef = useRef<HTMLTextAreaElement>(null);
  const triggerButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (open) requestAnimationFrame(() => firstFieldRef.current?.focus());
  }, [open]);
  const reviews = useMemo(() => getActionPlanResultReviews(plan).sort((a, b) => Date.parse(b.reviewedAt) - Date.parse(a.reviewedAt) || b.id.localeCompare(a.id)), [plan.resultReviews]);
  const completed = plan.status === "completed" || (!!plan.activities?.length && plan.activities.every((activity) => activity.progress >= 100));
  const canAddCommitment = decision !== "CLOSE";

  const openForm = () => {
    setOpen(true);
    setError("");
    requestAnimationFrame(() => firstFieldRef.current?.focus());
  };
  const closeForm = () => {
    setOpen(false);
    setError("");
    requestAnimationFrame(() => triggerButtonRef.current?.focus());
  };
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!plan.id || !currentUser?.id || !currentUser.name?.trim() || !observedResult.trim() || saving) return;
    setSaving(true);
    setError("");
    setSuccess("");
    const review: ActionPlanResultReview = {
      id: crypto.randomUUID(),
      reviewedAt: new Date().toISOString(),
      reviewedByUserId: currentUser.id,
      reviewedByLabel: currentUser.name.trim(),
      observedResult: observedResult.trim(),
      effect,
      decision,
      ...(note.trim() ? { note: note.trim() } : {}),
      ...(evidenceRef.trim() ? { evidenceRef: safeEvidenceUrl(evidenceRef.trim()) || evidenceRef.trim() } : {}),
      ...(nextReviewDate ? { nextReviewDate } : {}),
      reviewYear: year,
      reviewPeriodType: periodType,
      reviewPeriodIndex: periodIndex,
    };
    let commitment: Parameters<typeof firebaseService.recordActionPlanResultReview>[2];
    if (canAddCommitment && commitmentTitle.trim() && commitmentType === "activity") {
      const now = new Date().toISOString();
      const activity: ActionPlanActivity = {
        id: crypto.randomUUID(),
        title: commitmentTitle.trim(),
        ...(commitmentResponsibleUserId ? { responsible: assignableUsers.find(user => user.id === commitmentResponsibleUserId)?.name || "", responsibleUserId: commitmentResponsibleUserId } : commitmentResponsible.trim() ? { responsible: commitmentResponsible.trim() } : {}),
        ...(commitmentDate ? { targetDate: commitmentDate } : {}),
        progress: 0,
        impact: "NOT_EVALUATED",
        result: "",
        createdAt: now,
        updatedAt: now,
      };
      commitment = { type: "activity", activity };
    } else if (canAddCommitment && commitmentTitle.trim() && commitmentType === "plan") {
      const now = new Date().toISOString();
      commitment = { type: "plan", plan: {
        id: crypto.randomUUID(),
        indicatorId: plan.indicatorId,
        dashboardId: plan.dashboardId,
        clientId: plan.clientId,
        title: commitmentTitle.trim(),
        description: "",
        originYear: year,
        originPeriodType: periodType,
        originPeriodIndex: periodIndex,
        status: "planned",
        ...(commitmentResponsibleUserId ? { responsible: assignableUsers.find(user => user.id === commitmentResponsibleUserId)?.name || "", responsibleUserId: commitmentResponsibleUserId } : commitmentResponsible.trim() ? { responsible: commitmentResponsible.trim() } : {}),
        startDate: today(),
        ...(commitmentDate ? { targetDate: commitmentDate } : {}),
        progress: 0,
        activities: [],
        createdAt: now,
        updatedAt: now,
      } };
    }
    try {
      const updated = await firebaseService.recordActionPlanResultReview(plan.id, review, commitment);
      onSaved(updated);
      window.dispatchEvent(new Event("action-plan-review-saved"));
      setSuccess("La revisión se guardó correctamente.");
      setOpen(false);
      requestAnimationFrame(() => triggerButtonRef.current?.focus());
      setObservedResult(""); setNote(""); setEvidenceRef(""); setNextReviewDate("");
      setCommitmentTitle(""); setCommitmentResponsible(""); setCommitmentDate("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar la revisión. Revisa tu conexión e inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  return <section className="mt-5 border-t border-white/5 pt-4" aria-labelledby="result-review-heading">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h5 id="result-review-heading" className="text-xs font-black uppercase tracking-widest text-slate-300">Revisiones de resultado</h5>
        {completed && reviews.length === 0 && <p className="mt-1 text-sm font-semibold text-amber-200">Ejecución completada · efecto pendiente</p>}
      </div>
      {canEdit && <button ref={triggerButtonRef} type="button" onClick={openForm} className="min-h-[40px] rounded-lg bg-cyan-600 px-4 py-2 text-xs font-bold text-white hover:bg-cyan-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300">Revisar resultado</button>}
    </div>
    {success && <p role="status" className="mt-3 text-sm text-emerald-300">{success}</p>}
    {open && canEdit && <form onSubmit={(event) => void submit(event)} className="mt-4 rounded-xl border border-cyan-500/20 bg-slate-950/50 p-4">
      <h6 className="text-sm font-bold text-white">Registrar resultado observado</h6>
      {!currentUser?.id || !currentUser.name?.trim() ? <p role="alert" className="mt-2 text-sm text-rose-300">No se pudo identificar a la persona revisora autorizada. Cierra y vuelve a intentarlo.</p> : null}
      <label className="mt-3 block text-xs font-semibold text-slate-200" htmlFor="review-observed-result">Resultado observado <span aria-hidden="true">*</span>
        <textarea id="review-observed-result" ref={firstFieldRef} required maxLength={1000} value={observedResult} onChange={(event) => setObservedResult(event.target.value)} className={`${control} min-h-20`} />
      </label>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-semibold text-slate-200" htmlFor="review-effect">Efecto
          <select id="review-effect" value={effect} onChange={(event) => setEffect(event.target.value as ActionPlanResultEffect)} className={control}>{Object.entries(effectLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        </label>
        <label className="block text-xs font-semibold text-slate-200" htmlFor="review-decision">Decisión
          <select id="review-decision" value={decision} onChange={(event) => setDecision(event.target.value as ActionPlanResultDecision)} className={control}>{Object.entries(decisionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        </label>
      </div>
      <label className="mt-3 block text-xs font-semibold text-slate-200" htmlFor="review-note">Nota breve (opcional)
        <textarea id="review-note" maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} className={`${control} min-h-14`} />
      </label>
      <details className="mt-3 rounded-lg border border-white/10 p-3">
        <summary className="cursor-pointer text-xs font-semibold text-cyan-200">Opciones adicionales</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-semibold text-slate-200" htmlFor="review-next-date">Próxima revisión (opcional)<input id="review-next-date" type="date" value={nextReviewDate} onChange={(event) => setNextReviewDate(event.target.value)} className={control} /></label>
          <label className="block text-xs font-semibold text-slate-200" htmlFor="review-evidence">Referencia de evidencia (opcional)<input id="review-evidence" type="text" maxLength={500} placeholder="URL HTTPS o descripción" value={evidenceRef} onChange={(event) => setEvidenceRef(event.target.value)} className={control} /><span className="mt-1 block text-[10px] text-slate-500">Sólo referencias HTTPS se podrán abrir como enlace.</span></label>
        </div>
        {canAddCommitment && <fieldset className="mt-4 rounded-lg border border-white/10 p-3">
          <legend className="px-1 text-xs font-semibold text-slate-200">Siguiente compromiso (opcional)</legend>
          <div className="flex flex-wrap gap-4 text-xs text-slate-200">
            <label className="inline-flex items-center gap-2"><input type="radio" name="commitment-type" value="activity" checked={commitmentType === "activity"} onChange={() => { setCommitmentType("activity"); setCommitmentTitle(""); }} />Agregar actividad a este plan</label>
            <label className="inline-flex items-center gap-2"><input type="radio" name="commitment-type" value="plan" checked={commitmentType === "plan"} onChange={() => { setCommitmentType("plan"); setCommitmentTitle(""); }} />Crear nuevo plan</label>
          </div>
          <label className="mt-3 block text-xs font-semibold text-slate-200" htmlFor="commitment-title">{commitmentType === "activity" ? "Título de la actividad" : "Nombre del nuevo plan"}
            <input id="commitment-title" maxLength={200} value={commitmentTitle} onChange={(event) => setCommitmentTitle(event.target.value)} className={control} />
          </label>
          <label className="mt-3 block text-xs font-semibold text-slate-200" htmlFor="commitment-responsible">Responsable externo (opcional)<input id="commitment-responsible" value={commitmentResponsible} onChange={(event) => { setCommitmentResponsible(event.target.value); setCommitmentResponsibleUserId(""); }} className={control} /></label>
          <label className="mt-3 block text-xs font-semibold text-slate-200" htmlFor="commitment-responsible-user">Asignar usuario interno (opcional)<select id="commitment-responsible-user" value={commitmentResponsibleUserId} onChange={(event) => { setCommitmentResponsibleUserId(event.target.value); setCommitmentResponsible(""); }} className={control}><option value="">Sin asignación interna</option>{assignableUsers.map(user => <option key={user.id} value={user.id}>{user.name}</option>)}</select></label>
          <label className="mt-3 block text-xs font-semibold text-slate-200" htmlFor="commitment-date">Fecha compromiso (opcional)<input id="commitment-date" type="date" value={commitmentDate} onChange={(event) => setCommitmentDate(event.target.value)} className={control} /></label>
          {commitmentType === "plan" && <p className="mt-2 text-[11px] text-slate-400">El nuevo plan conservará automáticamente el cliente, tablero e indicador.</p>}
        </fieldset>}
        {!canAddCommitment && <p className="mt-3 text-xs text-slate-400">Para cerrar esta revisión no hace falta crear otro compromiso.</p>}
      </details>
      {error && <p role="alert" className="mt-3 text-sm text-rose-300">No se guardó la revisión: {error}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" disabled={saving} onClick={closeForm} className="min-h-[40px] rounded-lg px-4 py-2 text-xs text-slate-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300">Cancelar</button>
        <button type="submit" disabled={saving || !currentUser?.id || !currentUser.name?.trim()} className="min-h-[40px] rounded-lg bg-cyan-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{saving ? "Guardando…" : "Guardar revisión"}</button>
      </div>
    </form>}
    <ol className="mt-3 space-y-2">
      {reviews.map((review) => <li key={review.id} className="rounded-lg border border-white/10 bg-slate-950/40 p-3">
        <div className="flex flex-wrap justify-between gap-2 text-[11px] text-slate-400"><time dateTime={review.reviewedAt}>{new Date(review.reviewedAt).toLocaleString("es-MX")}</time><span>{review.reviewedByLabel}</span></div>
        <p className="mt-2 text-sm text-slate-100">{review.observedResult}</p>
        <p className="mt-1 text-xs text-slate-300">Efecto: {effectLabels[review.effect]} · Decisión: {decisionLabels[review.decision]}</p>
        {review.note && <p className="mt-1 text-xs text-slate-400">Nota: {review.note}</p>}
        {review.evidenceRef && <p className="mt-1 break-all text-xs text-slate-400">Evidencia: {safeEvidenceUrl(review.evidenceRef) ? <a href={safeEvidenceUrl(review.evidenceRef)} target="_blank" rel="noopener noreferrer" className="text-cyan-300 underline">Abrir evidencia</a> : review.evidenceRef}</p>}
        {review.nextReviewDate && <p className="mt-1 text-xs text-slate-400">Próxima revisión: {review.nextReviewDate}</p>}
        {review.nextCommitmentActivityId && <p className="mt-1 text-xs text-slate-400">Actividad sucesora: {review.nextCommitmentActivityId}</p>}
        {review.nextCommitmentPlanId && <p className="mt-1 text-xs text-slate-400">Plan sucesor: {review.nextCommitmentPlanId}</p>}
      </li>)}
    </ol>
    {reviews.length === 0 && <p className="mt-3 text-xs text-slate-500">Aún no hay revisiones registradas.</p>}
  </section>;
};
