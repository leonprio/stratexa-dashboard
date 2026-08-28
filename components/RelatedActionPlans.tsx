import React, { useEffect, useState } from 'react';
import { ActionPlan, ActionPlanStatus, ActionPlanOriginPeriodType } from '../types';
import { firebaseService } from '../services/firebaseService';

const labels: Record<ActionPlanStatus, string> = { planned: 'Planeado', in_progress: 'En ejecución', completed: 'Completado', cancelled: 'Cancelado' };
const empty = (originYear: number, originPeriodType: ActionPlanOriginPeriodType, originPeriodIndex: number): Omit<ActionPlan, 'id' | 'createdAt' | 'updatedAt'> => ({
  indicatorId: '', dashboardId: '', clientId: '', title: '', description: '', originYear, originPeriodType, originPeriodIndex,
  status: 'planned', responsible: '', startDate: new Date().toISOString().slice(0, 10), targetDate: '', progress: 0, expectedImpact: ''
});

interface Props { indicatorId: number | string; dashboardId: number | string; clientId?: string; year: number; periodType: ActionPlanOriginPeriodType; periodIndex: number; canEdit: boolean; }

export const RelatedActionPlans: React.FC<Props> = ({ indicatorId, dashboardId, clientId, year, periodType, periodIndex, canEdit }) => {
  const [plans, setPlans] = useState<ActionPlan[]>([]);
  const [state, setState] = useState<'loading' | 'saving' | 'saved' | 'error'>('loading');
  const [draft, setDraft] = useState<ActionPlan | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const load = async () => { setState('loading'); try { setPlans(await firebaseService.getActionPlansForIndicator(indicatorId, clientId)); setState('saved'); } catch { setState('error'); } };
  useEffect(() => { void load(); }, [indicatorId, clientId]);
  const origin = (p: ActionPlan) => p.originPeriodType === 'weekly' ? `Semana ${(p.originPeriodIndex || 0) + 1} · ${p.originYear}` : `${['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][p.originPeriodIndex || 0]} ${p.originYear}`;
  const begin = (p?: ActionPlan) => setDraft(p || { ...empty(year, periodType, periodIndex), id: '', indicatorId, dashboardId, clientId: clientId?.trim().toUpperCase() || '' } as ActionPlan);
  const save = async () => { if (!draft || !draft.title.trim()) return; setState('saving'); try { if (draft.id) await firebaseService.updateActionPlan(draft.id, draft); else await firebaseService.createActionPlan(draft); setDraft(null); setEditing(null); await load(); } catch { setState('error'); } };
  const field = (key: keyof ActionPlan, value: string | number) => setDraft(d => d ? { ...d, [key]: value } : d);
  return <section className="mt-6 rounded-2xl border border-cyan-500/20 bg-slate-950/30 p-6">
    <div className="flex items-center justify-between mb-4"><div><h4 className="text-sm font-black uppercase tracking-widest text-cyan-300">Planes relacionados</h4><p className="text-xs text-slate-500 mt-1">Transversales al indicador · visibles en todos los períodos</p></div>{canEdit && <button onClick={() => begin()} className="rounded-xl bg-cyan-600 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white">+ Nuevo plan</button>}</div>
    {state === 'loading' && <p className="text-xs text-slate-500">Cargando planes…</p>}{state === 'error' && <p className="text-xs text-red-400">No se pudieron cargar o guardar los planes.</p>}
    <div className="space-y-3">{plans.map(p => <div key={p.id} className="rounded-xl border border-white/5 bg-slate-900/50 p-4"><div className="flex justify-between gap-4"><div><h5 className="font-bold text-slate-100">{p.title}</h5><p className="mt-1 text-xs text-slate-400">{labels[p.status]} · {p.progress}%{p.responsible ? ` · ${p.responsible}` : ''}{p.targetDate ? ` · Meta: ${p.targetDate}` : ''}</p><p className="mt-1 text-[10px] uppercase tracking-widest text-slate-600">Origen: {origin(p)}</p></div>{canEdit && <button onClick={() => { setEditing(p.id); begin(p); }} className="text-[10px] font-black uppercase text-cyan-400">Editar</button>}</div><div className="mt-3 h-1.5 rounded-full bg-slate-800"><div className="h-full rounded-full bg-cyan-500" style={{ width: `${Math.max(0, Math.min(100, p.progress))}%` }} /></div></div>)}</div>
    {draft && <div className="mt-4 grid gap-3 rounded-xl border border-cyan-500/20 bg-slate-900/70 p-4 md:grid-cols-2"><input autoFocus value={draft.title} onChange={e => field('title', e.target.value)} placeholder="Título del plan" className="input col-span-full" /><textarea value={draft.description || ''} onChange={e => field('description', e.target.value)} placeholder="Descripción" className="input col-span-full" /><select value={draft.status} onChange={e => field('status', e.target.value)} className="input">{Object.entries(labels).map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select><input value={draft.responsible || ''} onChange={e => field('responsible', e.target.value)} placeholder="Responsable" className="input" /><input type="date" value={draft.startDate || ''} onChange={e => field('startDate', e.target.value)} className="input" /><input type="date" value={draft.targetDate || ''} onChange={e => field('targetDate', e.target.value)} className="input" /><input type="number" min="0" max="100" value={draft.progress} onChange={e => field('progress', Number(e.target.value))} placeholder="Avance %" className="input" /><input value={draft.expectedImpact || ''} onChange={e => field('expectedImpact', e.target.value)} placeholder="Impacto esperado" className="input" /><p className="col-span-full text-[10px] uppercase tracking-widest text-slate-500">Origen: {origin(draft)} (no editable)</p><div className="col-span-full flex justify-end gap-2"><button onClick={() => setDraft(null)} className="text-xs text-slate-400">Cancelar</button><button disabled={state === 'saving'} onClick={() => void save()} className="rounded-lg bg-cyan-600 px-5 py-2 text-xs font-bold text-white">{state === 'saving' ? 'Guardando…' : 'Guardar plan'}</button></div></div>}
  </section>;
};
