import React, { useEffect, useState } from 'react';
import type { DashboardItem } from '../../types';
import { applyContinuityEventToItem, getAvailableContinuityActions, getVisibleContinuityState } from '../../utils/continuityAdapter';
import { formatResolutionHistoryItem, getContinuitySnapshot, type ContinuityEvent } from '../../utils/continuityEngine';
export interface ContinuityPanelPending { id:string; sourceActivityId:string; label:string; periodIndex:number; periodLabel:string; }
interface Props { item:DashboardItem; pending:ContinuityPanelPending; year:number; isWeekly:boolean; onUpdateItem:(item:DashboardItem)=>Promise<void>|void; onUpdateKpiProgress?:(period:number,value:number|null)=>Promise<void>|void; onDismiss:()=>void; onSuccess?:(message:string)=>void; }
const months=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
export const ContinuityPanel: React.FC<Props> = ({
  item,
  pending,
  year,
  isWeekly,
  onUpdateItem,
  onUpdateKpiProgress,
  onDismiss,
  onSuccess,
}) => {
  const [localItem, setLocalItem] = useState(item);
  const [feedback, setFeedback] = useState('');
  useEffect(() => setLocalItem(item), [item]);
  const visible = getVisibleContinuityState(localItem, pending.sourceActivityId);
  const c = visible.commitment;
  const actions = getAvailableContinuityActions(visible);
  const snap = c && getContinuitySnapshot(c);

  const [mode, setMode] = useState<
    'record' | 'adjust' | 'void' | 'restore' | 'complete' | 'closeUnmet' | 'reschedule' | 'undo' | 'discard' | ''
  >('');
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');
  const [target, setTarget] = useState(c?.scheduledPeriod ?? pending.periodIndex + 1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [historyExpanded, setHistoryExpanded] = useState(false);

  const label = (p: number) =>
    isWeekly ? `Semana ${p + 1}` : months[p] || `Periodo ${p + 1}`;
  const can = (a: string) => actions.includes(a as never);

  const historyForPeriod = (c?.resolutionHistory || []).filter(
    (h) => h.period === c?.scheduledPeriod,
  );
  const lastOp = historyForPeriod[historyForPeriod.length - 1];
  const recoverableVoidValue =
    snap?.currentPeriodProgress === 0 &&
    lastOp?.type === 'VOID_PERIOD_PROGRESS'
      ? (lastOp.previousValue ?? 0)
      : 0;
  const history = c?.resolutionHistory || [];
  const visibleHistory = historyExpanded ? history : history.slice(-3);
  const progressPercent = snap
    ? Math.min(100, Math.max(0, snap.fulfillmentPercent))
    : 0;

  const persist = async (
    event: Exclude<ContinuityEvent, { type: 'CREATE_CONTINUITY' }>,
    message: string,
  ) => {
    setSaving(true);
    setError('');
    try {
      const nextItem = applyContinuityEventToItem(
        localItem,
        pending.sourceActivityId,
        pending.periodIndex,
        year,
        isWeekly,
        event,
      );
      setLocalItem(nextItem);
      setFeedback(event.type === 'DISCARD' ? 'Compromiso descartado' : event.type === 'REOPEN' ? 'Compromiso reabierto' : '');
      await onUpdateItem(nextItem);
      onSuccess?.(message);
      setMode('');
      setValue('');
      setReason('');
      setSaving(false);
    } catch (e) {
      console.error('Continuity persistence failed', e);
      setError('No se pudo guardar el cambio de continuidad.');
      setSaving(false);
    }
  };

  const submit = (type: 'RECORD_PROGRESS' | 'ADJUST_PERIOD_PROGRESS') => {
    const n = Number(value);
    if (!Number.isFinite(n)) {
      setError('Introduce un valor numérico válido.');
      return;
    }
    void persist(
      {
        type,
        period: c?.scheduledPeriod ?? pending.periodIndex,
        value: n,
        reason: reason || undefined,
      },
      type === 'RECORD_PROGRESS' ? `Avance registrado: +${n}` : 'Avance corregido',
    );
  };

  return (
    <section
      aria-label="Panel de continuidad"
      className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-950/95 p-5 text-slate-100 shadow-xl"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-black">{pending.label}</p>
          <p className="mt-1 text-[10px] uppercase tracking-widest text-slate-500">
            COMPROMISO DE CONTINUIDAD · {label(c?.scheduledPeriod ?? pending.periodIndex)} {year} · origen {label(c?.originPeriod ?? pending.periodIndex)} {year}
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/10 min-h-[44px]"
        >
          Cerrar
        </button>
      </div>

      {snap && (
        <>
          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-xl bg-cyan-500/10 p-3 md:col-span-2">
              <p className="text-[9px] font-black uppercase tracking-widest text-cyan-300">
                AVANCE DEL COMPROMISO
              </p>
              <p className="mt-1 text-3xl font-black text-white">
                {snap.fulfillmentPercent.toFixed(0)}%
              </p>
              <p className="text-xs text-slate-400">
                {snap.cumulativeProgress} de {c!.originalTarget} ejecutado
              </p>
            </div>
            <div className="rounded-xl bg-slate-900 p-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                FALTA PARA COMPLETAR
              </p>
              <p className="mt-1 text-2xl font-black text-white">
                {snap.remainingTarget}
              </p>
                <p className="text-xs text-slate-400">unidades del compromiso</p>
            </div>
            <div className="rounded-xl bg-slate-900 p-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                PERIODO DE COMPROMISO
              </p>
              <p className="mt-1 text-lg font-black text-white">
                {label(c!.scheduledPeriod)}
              </p>
              <p className="text-xs text-slate-500">{year}</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-500">
            <span><span>Meta original</span>: {c!.originalTarget}</span>
            <span>Origen: {label(c!.originPeriod)}</span>
            <span>Anterior: {snap.previousCumulative}</span>
            <span>Avance del periodo de compromiso: {snap.currentPeriodProgress}</span>
            <span>Estado: {c!.status}</span>
          </div>
          <div className="mt-4 rounded-xl bg-slate-900/80 p-3">
            <div className="flex items-center justify-between gap-3 text-[9px] font-black uppercase tracking-widest text-slate-400">
              <span>Progreso del compromiso</span>
              <span className="text-cyan-200">{snap.cumulativeProgress} / {c!.originalTarget}</span>
            </div>
            <div
              className="mt-2 h-2 overflow-hidden rounded-full bg-slate-700"
              role="progressbar"
              aria-label="Progreso de esta actividad"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progressPercent}
            >
              <div className="h-full rounded-full bg-cyan-400 transition-all" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>
        </>
      )}

      {c?.status === 'discarded' && (
        <div className="mt-4 rounded-xl border border-slate-600/60 bg-slate-900/70 p-3">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">ESTADO DEL COMPROMISO</p>
          <p className="mt-1 text-lg font-black text-slate-200">DESCARTADO</p>
        </div>
      )}

      {/* Siguiente acción */}
      <h3 className="mt-6 text-[10px] font-black uppercase tracking-widest text-slate-400">
        Siguiente acción
      </h3>
      <div className="mt-2 flex flex-wrap gap-2">
        {can('RECORD_PROGRESS') && (
          <button
            type="button"
            onClick={() => setMode('record')}
            className="rounded-lg bg-cyan-500 px-3 py-2 text-xs font-black text-slate-950 min-h-[44px]"
          >
            REGISTRAR AVANCE
          </button>
        )}
        {can('COMPLETE') && (
          <button
            type="button"
            onClick={() => setMode('complete')}
            className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-black text-slate-950 min-h-[44px]"
          >
            REGISTRAR META ALCANZADA
          </button>
        )}
        {(can('RESTORE_PROGRESS') || (recoverableVoidValue > 0 && snap?.currentPeriodProgress === 0)) && (
          <button
            type="button"
            onClick={() => setMode('restore')}
            className="rounded-lg bg-cyan-500 px-3 py-2 text-xs font-black text-slate-950 min-h-[44px]"
          >
            RESTAURAR AVANCE
          </button>
        )}
      </div>

      {/* Gestión y cierre */}
      <h3 className="mt-5 text-[10px] font-black uppercase tracking-widest text-slate-500">
        Gestión y cierre
      </h3>
      <div className="mt-2 flex flex-wrap gap-2">
        {can('ADJUST_PERIOD_PROGRESS') && (
          <button
            type="button"
            onClick={() => setMode('adjust')}
            className="rounded-lg border border-cyan-400/40 px-3 py-2 text-xs text-cyan-100 min-h-[44px]"
          >
            CORREGIR AVANCE
          </button>
        )}
        {can('VOID_PERIOD_PROGRESS') && (
          <button
            type="button"
            onClick={() => setMode('void')}
            className="rounded-lg border border-rose-400/40 px-3 py-2 text-xs text-rose-200 min-h-[44px]"
          >
            ANULAR AVANCE
          </button>
        )}
        {can('RESCHEDULE') && (
          <button
            type="button"
            onClick={() => {
              setTarget((c?.scheduledPeriod ?? pending.periodIndex) + 1);
              setMode('reschedule');
            }}
            className="rounded-lg border border-cyan-400/40 px-3 py-2 text-xs text-cyan-100 min-h-[44px]"
          >
            REPROGRAMAR
          </button>
        )}
        {can('UNDO_RESCHEDULE') && (
          <button
            type="button"
            onClick={() => setMode('undo')}
            className="rounded-lg border border-cyan-400/40 px-3 py-2 text-xs text-cyan-100 min-h-[44px]"
          >
            DESHACER REPROGRAMACIÓN
          </button>
        )}
        {can('CLOSE_UNMET') && (
          <button type="button" onClick={() => setMode('closeUnmet')}
            className="rounded-lg border border-white/15 px-3 py-2 text-xs text-slate-300 min-h-[44px]"
          >
            CERRAR SIN ALCANZAR LA META
          </button>
        )}
        {can('DISCARD') && (
          <button
            type="button"
            onClick={() => setMode('discard')}
            className="rounded-lg border border-rose-400/40 px-3 py-2 text-xs text-rose-200 min-h-[44px]"
          >
            DESCARTAR COMPROMISO
          </button>
        )}
      {can('REOPEN') && (
          <button
            type="button"
            onClick={() =>
              void persist({ type: 'REOPEN' }, 'Compromiso reabierto')
            }
            className="rounded-lg bg-cyan-500 px-3 py-2 text-xs font-black text-slate-950 min-h-[44px]"
          >
            <span aria-label="REABRIR">REABRIR COMPROMISO</span>
          </button>
        )}
      </div>

      {feedback && (
        <div role="status" className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-emerald-400/30 bg-emerald-950/30 p-3 text-sm text-emerald-100">
          <span>{feedback}</span>
          {feedback === 'Compromiso descartado' && (
            <button type="button" disabled={saving} onClick={() => void persist({ type: 'REOPEN' }, 'Compromiso reabierto')} className="rounded-lg bg-cyan-500 px-3 py-2 text-xs font-black text-slate-950 min-h-[44px]">
              DESHACER
            </button>
          )}
        </div>
      )}

      {mode === 'discard' && (
        <div className="mt-4 rounded-xl border border-rose-500/40 bg-rose-950/30 p-4">
          <h4 className="text-xs font-black uppercase tracking-wider text-rose-300">DESCARTAR COMPROMISO</h4>
          <p className="mt-2 text-xs text-rose-100">Este compromiso dejará de estar activo. Podrás reabrirlo posteriormente.</p>
          <div className="mt-3 flex gap-2">
            <button type="button" disabled={saving} onClick={() => void persist({ type: 'DISCARD' }, 'Compromiso descartado')} className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-black text-white min-h-[44px]">CONFIRMAR DESCARTE</button>
            <button type="button" onClick={() => setMode('')} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 min-h-[44px]">CANCELAR</button>
          </div>
        </div>
      )}

      {/* Input de Registro o Corrección con Descubribilidad Directa */}
      {(mode === 'record' || mode === 'adjust') && (
        <div className="mt-4 rounded-xl border border-cyan-400/30 bg-cyan-500/5 p-4">
          <p className="text-xs font-black text-cyan-200">
            {mode === 'record' ? 'REGISTRAR AVANCE' : 'CORREGIR AVANCE'}
          </p>
          {mode === 'adjust' && (
            <p className="mt-1 text-xs text-slate-400">
              Valor actual: <span className="font-bold text-white">{snap?.currentPeriodProgress ?? 0}</span>
            </p>
          )}
          <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <label className="text-xs text-slate-300 flex flex-col gap-1">
              Nuevo avance
              <input
                autoFocus
                aria-label="Valor de avance"
                type="number"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={
                  mode === 'record' && snap
                    ? String(snap.remainingTarget)
                    : 'Valor'
                }
                className="mt-1 w-full rounded-lg border border-cyan-500/40 bg-slate-900 p-2.5 text-sm text-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 focus:outline-none"
              />
            </label>
            <label className="text-xs text-slate-300 flex flex-col gap-1">
              Motivo (opcional)
              <input
                aria-label="Motivo"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Describe el ajuste"
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900 p-2.5 text-sm text-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 focus:outline-none"
              />
            </label>
            <div className="flex gap-2 self-end">
              <button
                disabled={saving}
                type="button"
                onClick={() =>
                  submit(
                    mode === 'record'
                      ? 'RECORD_PROGRESS'
                      : 'ADJUST_PERIOD_PROGRESS',
                  )
                }
                className="rounded-lg bg-cyan-500 px-4 py-2.5 text-xs font-black text-slate-950 hover:bg-cyan-400 min-h-[44px]"
              >
                CONFIRMAR
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('');
                  setValue('');
                  setReason('');
                }}
                className="rounded-lg border border-white/10 px-3 py-2.5 text-xs text-slate-400 hover:bg-white/5 min-h-[44px]"
              >
                CANCELAR
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmación Explícita de ANULAR AVANCE */}
      {mode === 'void' && (
        <div className="mt-4 rounded-xl border border-rose-500/40 bg-rose-950/30 p-4">
          <h4 className="text-xs font-black uppercase tracking-wider text-rose-300">
            ANULAR AVANCE
          </h4>
          <div className="mt-2 space-y-1 text-xs text-slate-300">
            <p>
              <span className="text-slate-400">Periodo:</span>{' '}
              <span className="font-bold text-white">
                {label(c?.scheduledPeriod ?? pending.periodIndex)} {year}
              </span>
            </p>
            <p>
              <span className="text-slate-400">Avance registrado:</span>{' '}
              <span className="font-bold text-white">
                {snap?.currentPeriodProgress ?? 0}
              </span>
            </p>
            <p className="mt-2 text-rose-200/90 italic">
              "Este avance dejará de contar en el acumulado, pero permanecerá en el historial."
            </p>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              disabled={saving}
              type="button"
              onClick={() =>
                void persist(
                  {
                    type: 'VOID_PERIOD_PROGRESS',
                    period: c!.scheduledPeriod,
                    reason: 'Anulación desde ContinuityPanel',
                  },
                  'Avance anulado',
                )
              }
              className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-black text-white hover:bg-rose-500 min-h-[44px]"
            >
              ANULAR AVANCE
            </button>
            <button
              type="button"
              onClick={() => setMode('')}
              className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/5 min-h-[44px]"
            >
              CANCELAR
            </button>
          </div>
        </div>
      )}

      {/* Confirmación Explícita de RESTAURAR AVANCE */}
      {mode === 'restore' && (
        <div className="mt-4 rounded-xl border border-cyan-500/40 bg-cyan-950/30 p-4">
          <h4 className="text-xs font-black uppercase tracking-wider text-cyan-300">
            RESTAURAR AVANCE
          </h4>
          <div className="mt-2 space-y-1 text-xs text-slate-300">
            <p>
              <span className="text-slate-400">Periodo:</span>{' '}
              <span className="font-bold text-white">
                {label(c?.scheduledPeriod ?? pending.periodIndex)} {year}
              </span>
            </p>
            <p>
              <span className="text-slate-400">Avance anulado:</span>{' '}
              <span className="font-bold text-cyan-200">
                {recoverableVoidValue} unidades
              </span>
            </p>
            <p className="mt-2 text-cyan-100/90 italic">
              "Se recuperará el último avance válido registrado en este periodo."
            </p>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              disabled={saving}
              type="button"
              onClick={() =>
                void persist(
                  {
                    type: 'ADJUST_PERIOD_PROGRESS',
                    period: c!.scheduledPeriod,
                    value: recoverableVoidValue,
                    reason: 'Restauración de avance anulado',
                  },
                  `Avance restaurado: ${recoverableVoidValue}`,
                )
              }
              className="rounded-lg bg-cyan-500 px-4 py-2 text-xs font-black text-slate-950 hover:bg-cyan-400 min-h-[44px]"
            >
              RESTAURAR AVANCE
            </button>
            <button
              type="button"
              onClick={() => setMode('')}
              className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/5 min-h-[44px]"
            >
              CANCELAR
            </button>
          </div>
        </div>
      )}

      {mode === 'complete' && (
        <div className="mt-3 rounded border border-emerald-400/30 p-3 text-sm">
          Se certificará la meta con el acumulado actual ({snap?.cumulativeProgress}).{' '}
          <button
            disabled={saving}
            type="button"
            onClick={() => void persist({ type: 'COMPLETE' }, 'Meta alcanzada')}
            className="rounded bg-emerald-600 px-3 py-2 text-xs min-h-[44px]"
          >
            CONFIRMAR
          </button>
          <button type="button" onClick={() => setMode('')} className="rounded border border-white/10 px-3 py-2 text-xs text-slate-300 min-h-[44px]">CANCELAR</button>
        </div>
      )}

      {mode === 'closeUnmet' && (
        <div className="mt-3 rounded-xl border border-amber-400/40 bg-amber-950/20 p-4 text-sm">
          <h4 className="text-xs font-black uppercase tracking-wider text-amber-200">CERRAR SIN ALCANZAR LA META</h4>
          <p className="mt-2 text-xs text-amber-100">Este compromiso se cerrará sin alcanzar la meta. Se conservarán el avance acumulado, el pendiente y el historial.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button disabled={saving} type="button" onClick={() => void persist({ type: 'CLOSE_UNMET' }, 'Cerrado sin alcanzar la meta')} className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-black text-white min-h-[44px]">CONFIRMAR CIERRE</button>
            <button type="button" onClick={() => setMode('')} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 min-h-[44px]">CANCELAR</button>
          </div>
        </div>
      )}

      {mode === 'reschedule' && (
        <div className="mt-3 flex flex-wrap gap-2">
          <select
            aria-label="Periodo destino"
            value={target}
            onChange={(e) => setTarget(Number(e.target.value))}
            className="rounded bg-slate-900 p-2 text-sm"
          >
            {Array.from({ length: isWeekly ? 53 : 12 }, (_, p) => p)
              .filter((p) => p > (c?.scheduledPeriod ?? pending.periodIndex))
              .map((p) => (
                <option key={p} value={p}>
                  {label(p)}
                </option>
              ))}
          </select>
          <button
            disabled={saving}
            type="button"
            onClick={() =>
              void persist(
                { type: 'RESCHEDULE', year, period: target },
                `Reprogramado a ${label(target)}`,
              )
            }
            className="rounded bg-cyan-600 px-3 py-2 text-xs min-h-[44px]"
          >
            CONFIRMAR REPROGRAMACIÓN
          </button>
          <button type="button" onClick={() => setMode('')} className="rounded border border-white/10 px-3 py-2 text-xs text-slate-300 min-h-[44px]">CANCELAR</button>
        </div>
      )}

      {mode === 'undo' && (
        <div className="mt-3 rounded border border-amber-400/40 p-3 text-sm">
          {snap?.currentPeriodProgress ? (
            <>
              Hay avance en el periodo actual.{' '}
              <button
                type="button"
                onClick={() => setMode('adjust')}
                className="rounded border border-amber-300 px-2 py-1 text-xs min-h-[44px]"
              >
                CORREGIR AVANCE
              </button>{' '}
              <button
                type="button"
                onClick={() =>
                  void persist(
                    {
                      type: 'VOID_AND_UNDO_RESCHEDULE',
                      reason: 'Anulación explícita',
                    },
                    'Reprogramación deshecha',
                  )
                }
                className="rounded bg-rose-600 px-2 py-1 text-xs min-h-[44px]"
              >
                ANULAR AVANCE Y VOLVER
              </button>
              <button type="button" onClick={() => setMode('')} className="rounded border border-white/10 px-2 py-1 text-xs text-slate-300 min-h-[44px]">CANCELAR</button>
            </>
          ) : (
            <button
              type="button"
              onClick={() =>
                void persist(
                  { type: 'UNDO_RESCHEDULE' },
                  'Reprogramación deshecha',
                )
              }
              className="rounded bg-cyan-600 px-3 py-2 text-xs min-h-[44px]"
            >
              DESHACER REPROGRAMACIÓN
            </button>
          )}
        </div>
      )}

      {/* Historial */}
      <h3 className="mt-5 text-[10px] font-black uppercase tracking-widest text-cyan-200">
        Historial
      </h3>
      <ul className="mt-2 space-y-1 text-xs text-slate-300">
        {visibleHistory.map((entry, i) => {
          let text = formatResolutionHistoryItem(entry, months);
          if (
            entry.type === 'ADJUST_PERIOD_PROGRESS' &&
            entry.reason === 'Restauración de avance anulado'
          ) {
            const m =
              entry.period !== undefined && months[entry.period]
                ? months[entry.period]
                : `Periodo ${entry.period}`;
            text = `Avance restaurado en ${m}: ${entry.toValue} unidades`;
          }
          return <li key={`${entry.at}-${i}`}>{text}</li>;
        })}
      </ul>
      {history.length > 3 && (
        <button
          type="button"
          onClick={() => setHistoryExpanded((expanded) => !expanded)}
          className="mt-3 rounded-lg border border-white/10 px-3 py-2 text-[9px] font-black uppercase tracking-widest text-cyan-200 hover:bg-white/5 min-h-[44px]"
        >
          {historyExpanded ? 'VER MENOS' : 'VER HISTORIAL COMPLETO'}
        </button>
      )}

      {error && (
        <p role="alert" className="mt-3 text-xs text-rose-300">
          {error}
        </p>
      )}
    </section>
  );
};
