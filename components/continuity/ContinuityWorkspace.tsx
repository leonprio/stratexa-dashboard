import React from 'react';
import { createPortal } from 'react-dom';
import type { DashboardItem } from '../../types';
import { getIndividualCommitmentProjection } from '../../utils/continuityAdapter';
import { ContinuityPanel, type ContinuityPanelPending } from './ContinuityPanel';

interface Props {
  item: DashboardItem;
  pending: ContinuityPanelPending;
  year: number;
  isWeekly: boolean;
  consultedPeriod: number;
  onUpdateItem: (item: DashboardItem) => Promise<void> | void;
  onUpdateKpiProgress?: (period: number, value: number | null) => Promise<void> | void;
  onClose: () => void;
  onSuccess?: (message: string) => void;
}

const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export const ContinuityWorkspace: React.FC<Props> = ({
  item,
  pending,
  year,
  isWeekly,
  consultedPeriod,
  onUpdateItem,
  onUpdateKpiProgress,
  onClose,
  onSuccess,
}) => {
  const [localItem, setLocalItem] = React.useState(item);
  React.useEffect(() => setLocalItem(item), [item]);

  const handleUpdateItem = async (updated: DashboardItem) => {
    setLocalItem(updated);
    await onUpdateItem(updated);
  };

  const handleUpdateKpiProgress = onUpdateKpiProgress ? async (period: number, value: number | null) => {
    const nextItem = { ...localItem };
    if (isWeekly) {
      const nextProgress = [...(nextItem.weeklyProgress || Array(53).fill(null))];
      nextProgress[period] = value;
      nextItem.weeklyProgress = nextProgress;
    } else {
      const nextProgress = [...(nextItem.monthlyProgress || Array(12).fill(null))];
      const nextCaptured = [...(nextItem.monthlyProgressCaptured || Array(12).fill(false))];
      nextProgress[period] = value === null ? 0 : value;
      nextCaptured[period] = value !== null;
      nextItem.monthlyProgress = nextProgress;
      nextItem.monthlyProgressCaptured = nextCaptured;
    }
    setLocalItem(nextItem);
    await onUpdateKpiProgress(period, value);
  } : undefined;

  const periodLabel = (period: number) => isWeekly ? `Semana ${period + 1}` : months[period] || `Periodo ${period + 1}`;

  // FILA 1: KPI Master Aggregate Context (Compact, Secondary)
  const kpiTotalGoal = localItem.monthlyGoals
    ? (localItem.monthlyGoals.reduce((sum: number, v) => sum + (Number(v) > 0 ? Number(v) : 0), 0) || (isWeekly ? Number(localItem.weeklyGoals?.[consultedPeriod] ?? 0) : Number(localItem.monthlyGoals?.[consultedPeriod] ?? 0)))
    : (isWeekly ? Number(localItem.weeklyGoals?.[consultedPeriod] ?? 0) : Number(localItem.monthlyGoals?.[consultedPeriod] ?? 0));

  const kpiCumulativeReal = isWeekly
    ? (localItem.weeklyProgress || []).reduce((sum: number, v) => sum + (v !== null && v !== undefined && Number(v) > 0 ? Number(v) : 0), 0)
    : (localItem.monthlyProgress || []).reduce((sum: number, v, idx) => {
        const isCaptured = localItem.monthlyProgressCaptured?.[idx] !== false;
        return sum + (isCaptured && v !== null && v !== undefined && Number(v) > 0 ? Number(v) : 0);
      }, 0);

  const kpiCumulativeFulfillment = kpiTotalGoal > 0 ? Math.round((kpiCumulativeReal / kpiTotalGoal) * 100) : 0;

  // FILA 2: Individual Commitment Projection (Dominant, Authoritative)
  const projection = getIndividualCommitmentProjection(localItem, pending.sourceActivityId);

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/85 p-3 backdrop-blur-md" role="presentation">
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Gestión de continuidad"
        className="max-h-[94vh] w-full max-w-6xl overflow-y-auto rounded-3xl border border-cyan-500/30 bg-slate-950 p-4 shadow-2xl sm:p-6"
      >
        {/* FILA 1: CONTEXTO DEL INDICADOR MAESTRO (COMPACTO Y SECUNDARIO) */}
        <header className="mb-4 flex items-start justify-between gap-4 border-b border-white/10 pb-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400">
                <span>INDICADOR MAESTRO</span> · <span>KPI</span>
              </p>
            </div>
            <h2 className="mt-0.5 text-lg font-black text-slate-200 sm:text-xl uppercase tracking-tight">{localItem.indicator}</h2>

            {/* Contexto del Indicador Maestro */}
            <div className="mt-2.5 rounded-xl border border-white/10 bg-slate-900/60 p-2.5 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-slate-300">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                CONTEXTO / RESULTADO DEL INDICADOR MAESTRO:
              </span>
              <span>
                Meta total del indicador: <strong className="text-white tabular-nums">{kpiTotalGoal}</strong>
              </span>
              <span>
                Real total del indicador: <strong className="text-emerald-400 tabular-nums">{kpiCumulativeReal}</strong>
              </span>
              <span>
                Cumplimiento del indicador: <strong className="text-cyan-300 tabular-nums">{kpiCumulativeFulfillment}%</strong>
              </span>
            </div>
          </div>
          <button type="button" onClick={onClose} className="shrink-0 rounded-xl border border-white/10 px-4 py-2 text-xs font-black text-slate-300 hover:bg-white/10 min-h-[44px]">
            ✕ CERRAR GESTOR
          </button>
        </header>

        {/* FILA 2: COMPROMISO QUE ESTÁS GESTIONANDO (DOMINANTE) */}
        <div className="mb-4 rounded-2xl border border-cyan-500/40 bg-cyan-950/25 p-4 sm:p-5 shadow-xl">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-cyan-400 shadow-sm" />
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-cyan-300">
              COMPROMISO QUE ESTÁS GESTIONANDO
            </p>
          </div>
          <h3 className="text-lg sm:text-xl font-black text-white">
            {projection.title || pending.label}
          </h3>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-300">
            <span className="rounded-lg bg-slate-900/90 border border-white/10 px-3 py-1.5">
              PERIODO CONSULTADO: <strong className="text-slate-200">{periodLabel(consultedPeriod)} {year}</strong>
            </span>
            <span className="rounded-lg bg-slate-900/90 border border-white/10 px-3 py-1.5">
              Origen: <strong className="text-slate-200">{periodLabel(projection.originPeriod)} {projection.originYear || year}</strong>
            </span>
            <span className="rounded-lg bg-cyan-500/20 border border-cyan-500/40 px-3 py-1.5 text-cyan-200">
              PERIODO DEL COMPROMISO: <strong className="text-white">{periodLabel(projection.scheduledPeriod)} {projection.scheduledYear || year}</strong>
            </span>
          </div>

          <section aria-label="Resumen ejecutivo de continuidad" className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
            <div className="rounded-2xl border border-white/10 bg-slate-900/90 p-3.5">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Meta del compromiso</p>
              <p className="mt-1.5 text-2xl font-black text-white tabular-nums">{projection.target}</p>
            </div>
            <div className="rounded-2xl border border-indigo-400/25 bg-indigo-500/10 p-3.5">
              <p className="text-[9px] font-black uppercase tracking-widest text-indigo-200">Acumulado anterior</p>
              <p className="mt-1.5 text-2xl font-black text-white tabular-nums">{projection.previousCumulativeProgress}</p>
            </div>
            <div className="rounded-2xl border border-indigo-400/25 bg-indigo-500/10 p-3.5">
              <p className="text-[9px] font-black uppercase tracking-widest text-indigo-200">Avance de {periodLabel(projection.scheduledPeriod)}</p>
              <p className="mt-1.5 text-2xl font-black text-white tabular-nums">{projection.currentPeriodProgress === null ? 'SIN CAPTURA' : `+${projection.currentPeriodProgress}`}</p>
            </div>
            <div className="rounded-2xl border border-cyan-400/30 bg-cyan-500/10 p-3.5">
              <p className="text-[9px] font-black uppercase tracking-widest text-cyan-200">Realizado acumulado</p>
              <p className="mt-1.5 text-2xl font-black text-white tabular-nums">{projection.cumulativeProgress}</p>
              <p className="text-[10px] font-bold text-cyan-300">de {projection.target}</p>
            </div>
            <div className="rounded-2xl border border-cyan-400/30 bg-cyan-500/10 p-3.5">
              <p className="text-[9px] font-black uppercase tracking-widest text-cyan-200">Cumplimiento</p>
              <p className="mt-1.5 text-2xl font-black text-cyan-300 tabular-nums">{Math.round(projection.fulfillmentPercent)}%</p>
            </div>
            <div className="rounded-2xl border border-amber-400/25 bg-amber-500/10 p-3.5">
              <p className="text-[9px] font-black uppercase tracking-widest text-amber-200">Pendiente</p>
              <p className="mt-1.5 text-2xl font-black text-amber-300 tabular-nums">{projection.remaining}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-900/90 p-3.5">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Periodo compromiso</p>
              <p className="mt-1.5 text-lg font-black text-white">{periodLabel(projection.scheduledPeriod)}</p>
              <p className="text-[10px] text-slate-400">{projection.scheduledYear || year}</p>
            </div>
          </section>
        </div>

        <ContinuityPanel
          item={localItem}
          pending={pending}
          year={year}
          isWeekly={isWeekly}
          onUpdateItem={handleUpdateItem}
          onUpdateKpiProgress={handleUpdateKpiProgress}
          onDismiss={onClose}
          onSuccess={onSuccess}
        />
      </section>
    </div>,
    document.body,
  );
};
