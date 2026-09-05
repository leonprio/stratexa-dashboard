import React, { useState } from 'react';
import type { PendingKpiActivity } from './CurrentPeriodFocus';

export interface KpiActivityManagerProps {
  activity: PendingKpiActivity;
  isWeekly: boolean;
  currentPeriodIndex: number;
  maxPeriodIndex: number;
  onComplete: () => Promise<void> | void;
  onReschedule: (periodIndex: number) => Promise<void> | void;
  onDiscard: (note: string) => Promise<void> | void;
  onCancel: () => void;
}

export const KpiActivityManager: React.FC<KpiActivityManagerProps> = ({ activity, isWeekly, currentPeriodIndex, maxPeriodIndex, onComplete, onReschedule, onDiscard, onCancel }) => {
  const [action, setAction] = useState<'idle' | 'complete' | 'reschedule' | 'discard'>('idle');
  const [target, setTarget] = useState(currentPeriodIndex);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const run = async (fn: () => Promise<void> | void) => { setSaving(true); try { await fn(); onCancel(); } finally { setSaving(false); } };
  const history = activity.rescheduleHistory || [];
  return <div className="mt-2 rounded-xl border border-cyan-500/30 bg-slate-950 p-3">
    <p className="text-xs font-bold text-white">{activity.label}</p>
    <p className="text-[10px] text-slate-400">ORIGEN · {activity.periodLabel}</p>
    {activity.commitmentLabel && <p className="text-[10px] text-cyan-300">COMPROMISO · {activity.commitmentLabel}</p>}
    {history.length > 0 && <div className="mt-2 border-t border-white/10 pt-2"><p className="text-[9px] font-black uppercase tracking-widest text-slate-500">HISTORIAL DE REPROGRAMACIÓN</p>{history.map((event, index) => <p key={`${event.changedAt}-${index}`} className="text-[10px] text-slate-500">{isWeekly ? `S${event.fromPeriodIndex + 1}` : `P${event.fromPeriodIndex + 1}`} → {isWeekly ? `S${event.toPeriodIndex + 1}` : `P${event.toPeriodIndex + 1}`}</p>)}</div>}
    {action === 'idle' && <div className="mt-2 flex flex-wrap gap-2"><button onClick={() => setAction('complete')} className="rounded bg-emerald-600 px-2 py-2 text-[9px] font-black text-white">✓ COMPLETAR AHORA</button><button onClick={() => setAction('reschedule')} className="rounded bg-cyan-600 px-2 py-2 text-[9px] font-black text-white">→ REPROGRAMAR</button><button onClick={() => setAction('discard')} className="rounded bg-rose-600 px-2 py-2 text-[9px] font-black text-white">× DESCARTAR</button><button onClick={onCancel} className="rounded bg-slate-700 px-2 py-2 text-[9px] font-black text-white">CANCELAR</button></div>}
    {action === 'complete' && <div className="mt-2"><p className="text-xs text-white">¿Confirmar como completada en el período actual?</p><button disabled={saving} onClick={() => void run(onComplete)} className="mr-2 mt-2 rounded bg-emerald-600 px-2 py-2 text-[9px] font-black text-white">{saving ? 'Guardando...' : 'CONFIRMAR'}</button><button onClick={() => setAction('idle')} className="mt-2 rounded bg-slate-700 px-2 py-2 text-[9px] font-black text-white">CANCELAR</button></div>}
    {action === 'reschedule' && <div className="mt-2"><p className="text-xs font-bold text-white">REPROGRAMAR ACTIVIDAD</p><select value={target} onChange={e => setTarget(Number(e.target.value))} className="mt-2 w-full rounded bg-slate-900 p-2 text-xs text-white">{Array.from({ length: maxPeriodIndex - currentPeriodIndex + 1 }, (_, index) => currentPeriodIndex + index).map(index => <option key={index} value={index}>{isWeekly ? `Semana ${index + 1}` : `Periodo ${index + 1}`}</option>)}</select><button disabled={saving} onClick={() => void run(() => onReschedule(target))} className="mr-2 mt-2 rounded bg-cyan-600 px-2 py-2 text-[9px] font-black text-white">{saving ? 'Guardando...' : 'CONFIRMAR REPROGRAMACIÓN'}</button><button onClick={() => setAction('idle')} className="mt-2 rounded bg-slate-700 px-2 py-2 text-[9px] font-black text-white">CANCELAR</button></div>}
    {action === 'discard' && <div className="mt-2"><label className="text-[9px] font-black text-slate-300">MOTIVO DEL DESCARTE<textarea value={note} onChange={e => setNote(e.target.value)} className="mt-1 w-full rounded bg-slate-900 p-2 text-xs text-white" /></label><button disabled={saving || !note.trim()} onClick={() => void run(() => onDiscard(note))} className="mr-2 mt-2 rounded bg-rose-600 px-2 py-2 text-[9px] font-black text-white">{saving ? 'Guardando...' : 'CONFIRMAR DESCARTE'}</button><button onClick={() => setAction('idle')} className="mt-2 rounded bg-slate-700 px-2 py-2 text-[9px] font-black text-white">CANCELAR</button></div>}
  </div>;
};
