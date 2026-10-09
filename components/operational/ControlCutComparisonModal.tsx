import React, { useMemo } from 'react';
import type { ControlCutComparisonResult } from '../../utils/controlCutComparison';

interface ControlCutComparisonModalProps {
  comparison: ControlCutComparisonResult;
  onClose: () => void;
}

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export const ControlCutComparisonModal: React.FC<ControlCutComparisonModalProps> = ({
  comparison,
  onClose,
}) => {
  const formatPeriodLabel = (periodicity: 'monthly' | 'weekly', year: number, idx: number) => {
    if (periodicity === 'monthly') {
      return `${MONTH_NAMES[idx] || `M${idx + 1}`} ${year}`;
    }
    return `Semana ${idx} ${year}`;
  };

  const labelA = formatPeriodLabel(comparison.periodicity, comparison.cutA.year, comparison.cutA.periodIndex);
  const labelB = formatPeriodLabel(comparison.periodicity, comparison.cutB.year, comparison.cutB.periodIndex);

  const improvedKpis = useMemo(
    () => comparison.kpis.filter((k) => k.interpretation === 'improved'),
    [comparison.kpis],
  );
  const worsenedKpis = useMemo(
    () => comparison.kpis.filter((k) => k.interpretation === 'worsened'),
    [comparison.kpis],
  );
  const stableKpis = useMemo(
    () => comparison.kpis.filter((k) => k.interpretation === 'stable'),
    [comparison.kpis],
  );
  const nonComparableKpis = useMemo(
    () => comparison.kpis.filter((k) => k.interpretation === 'not_comparable'),
    [comparison.kpis],
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="comparison-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
    >
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-2xl">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-cyan-500/20 px-2 py-0.5 text-[10px] font-bold text-cyan-400">
                PANEL COMPARATIVO DE CORTES
              </span>
              <span className="text-[10px] uppercase tracking-wider text-slate-400">
                {comparison.clientId} · {comparison.dashboardId} · {comparison.periodicity === 'monthly' ? 'Mensual' : 'Semanal'}
              </span>
            </div>
            <h2 id="comparison-title" className="mt-1 text-lg font-bold text-white">
              Corte A ({labelA}) vs Corte B ({labelB})
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={async () => {
                const { exportControlCutComparisonReport } = await import('../../utils/controlCutExport');
                await exportControlCutComparisonReport(comparison, 'pdf');
              }}
              className="min-h-[44px] rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-bold text-cyan-300 hover:bg-cyan-500/20"
            >
              Exportar PDF
            </button>
            <button
              type="button"
              onClick={async () => {
                const { exportControlCutComparisonReport } = await import('../../utils/controlCutExport');
                await exportControlCutComparisonReport(comparison, 'docx');
              }}
              className="min-h-[44px] rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 text-xs font-bold text-indigo-300 hover:bg-indigo-500/20"
            >
              Exportar DOCX
            </button>
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] min-w-[44px] rounded-lg border border-white/10 px-3 py-1.5 text-xs font-bold text-slate-300 hover:bg-white/10"
            >
              Cerrar
            </button>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 space-y-6 overflow-y-auto p-6 text-sm">
          {/* Metadatos de Captura */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-white/5 bg-slate-950/40 p-4">
              <p className="text-[10px] font-black uppercase text-slate-500">Corte A (Base)</p>
              <p className="mt-1 font-bold text-slate-200">{comparison.cutA.cutId}</p>
              <p className="text-xs text-slate-400">
                Capturado: {new Date(comparison.cutA.capturedAt).toLocaleString()} por {comparison.cutA.capturedByLabel}
              </p>
            </div>
            <div className="rounded-xl border border-white/5 bg-slate-950/40 p-4">
              <p className="text-[10px] font-black uppercase text-slate-500">Corte B (Comparado)</p>
              <p className="mt-1 font-bold text-slate-200">{comparison.cutB.cutId}</p>
              <p className="text-xs text-slate-400">
                Capturado: {new Date(comparison.cutB.capturedAt).toLocaleString()} por {comparison.cutB.capturedByLabel}
              </p>
            </div>
          </div>

          {/* Resumen de Variación */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-3">
              <p className="text-[10px] font-black uppercase text-emerald-400">KPIs Mejoraron</p>
              <p className="mt-1 text-2xl font-black text-emerald-300">{comparison.improvedKpiCount}</p>
            </div>
            <div className="rounded-xl border border-rose-500/20 bg-rose-950/20 p-3">
              <p className="text-[10px] font-black uppercase text-rose-400">KPIs Empeoraron</p>
              <p className="mt-1 text-2xl font-black text-rose-300">{comparison.worsenedKpiCount}</p>
            </div>
            <div className="rounded-xl border border-slate-500/20 bg-slate-800/20 p-3">
              <p className="text-[10px] font-black uppercase text-slate-400">KPIs Sin Cambio</p>
              <p className="mt-1 text-2xl font-black text-slate-300">{comparison.stableKpiCount}</p>
            </div>
            <div className="rounded-xl border border-amber-500/20 bg-amber-950/20 p-3">
              <p className="text-[10px] font-black uppercase text-amber-400">No Comparables</p>
              <p className="mt-1 text-2xl font-black text-amber-300">{comparison.nonComparableKpiCount}</p>
            </div>
          </div>

          {/* Variación de Resumen Operativo */}
          <section className="rounded-xl border border-white/5 bg-slate-950/30 p-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-300">
              Deltas de Control Operativo
            </h3>
            <div className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
              <div>
                <span className="text-slate-500">Capturas Pendientes:</span>
                <span className={`ml-2 font-bold ${comparison.summaryDelta.pendingCapturesDelta <= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {comparison.summaryDelta.pendingCapturesDelta > 0 ? '+' : ''}{comparison.summaryDelta.pendingCapturesDelta}
                </span>
              </div>
              <div>
                <span className="text-slate-500">Acciones Vencidas:</span>
                <span className={`ml-2 font-bold ${comparison.summaryDelta.overdueActionsDelta <= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {comparison.summaryDelta.overdueActionsDelta > 0 ? '+' : ''}{comparison.summaryDelta.overdueActionsDelta}
                </span>
              </div>
              <div>
                <span className="text-slate-500">Acciones Completadas:</span>
                <span className={`ml-2 font-bold ${comparison.summaryDelta.completedActionsDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {comparison.summaryDelta.completedActionsDelta > 0 ? '+' : ''}{comparison.summaryDelta.completedActionsDelta}
                </span>
              </div>
              <div>
                <span className="text-slate-500">Atención Derivada:</span>
                <span className={`ml-2 font-bold ${comparison.summaryDelta.derivedAttentionDelta <= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {comparison.summaryDelta.derivedAttentionDelta > 0 ? '+' : ''}{comparison.summaryDelta.derivedAttentionDelta}
                </span>
              </div>
            </div>
          </section>

          {/* Tabla de Indicadores */}
          <section className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-cyan-400">
              Detalle de Indicadores Físicos
            </h3>
            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/60 text-[10px] font-black uppercase text-slate-400">
                  <tr>
                    <th className="px-3 py-2.5">ID / Indicador</th>
                    <th className="px-3 py-2.5">Área</th>
                    <th className="px-3 py-2.5 text-right">Cumpl. A</th>
                    <th className="px-3 py-2.5 text-right">Cumpl. B</th>
                    <th className="px-3 py-2.5 text-right">Variación</th>
                    <th className="px-3 py-2.5 text-center">Diagnóstico</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {comparison.kpis.map((kpi) => {
                    const label = kpi.labelB || kpi.labelA || `ID ${kpi.indicatorId}`;
                    const area = kpi.areaB || kpi.areaA || '-';
                    return (
                      <tr key={String(kpi.indicatorId)} className="hover:bg-white/[0.02]">
                        <td className="px-3 py-2 font-medium text-slate-200">
                          <div>{label}</div>
                          <span className="text-[10px] text-slate-500">ID: {kpi.indicatorId}</span>
                        </td>
                        <td className="px-3 py-2 text-slate-400">{area}</td>
                        <td className="px-3 py-2 text-right text-slate-300">
                          {kpi.complianceA !== undefined ? `${kpi.complianceA}%` : '—'}
                        </td>
                        <td className="px-3 py-2 text-right text-slate-300">
                          {kpi.complianceB !== undefined ? `${kpi.complianceB}%` : '—'}
                        </td>
                        <td className="px-3 py-2 text-right font-bold">
                          {kpi.complianceDelta !== undefined ? (
                            <span className={kpi.complianceDelta > 0 ? 'text-emerald-400' : kpi.complianceDelta < 0 ? 'text-rose-400' : 'text-slate-400'}>
                              {kpi.complianceDelta > 0 ? '+' : ''}{kpi.complianceDelta}%
                            </span>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {kpi.interpretation === 'improved' && (
                            <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                              Mejoró
                            </span>
                          )}
                          {kpi.interpretation === 'worsened' && (
                            <span className="rounded bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-300">
                              Empeoró
                            </span>
                          )}
                          {kpi.interpretation === 'stable' && (
                            <span className="rounded bg-slate-500/20 px-2 py-0.5 text-[10px] font-bold text-slate-300">
                              Estable
                            </span>
                          )}
                          {kpi.interpretation === 'not_comparable' && (
                            <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                              {kpi.status === 'only_a' ? 'Ausente en B' : 'Nuevo en B'}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* Planes de Acción, Revisiones y Compromisos */}
          {comparison.actionPlans.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-cyan-400">
                Planes de Acción, Decisiones y Siguientes Compromisos
              </h3>
              <div className="space-y-3">
                {comparison.actionPlans.map((plan) => (
                  <div key={plan.planId} className="rounded-xl border border-white/5 bg-slate-950/40 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-bold text-slate-200">
                        {plan.titleB || plan.titleA || plan.planId}
                      </span>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-slate-400">Progreso:</span>
                        <span className="text-slate-300">A: {plan.progressA ?? 0}%</span>
                        <span>→</span>
                        <span className="font-bold text-cyan-300">B: {plan.progressB ?? 0}%</span>
                      </div>
                    </div>
                    {/* Decisiones y compromisos */}
                    <div className="mt-3 grid grid-cols-1 gap-3 border-t border-white/5 pt-3 md:grid-cols-2">
                      <div>
                        <p className="text-[10px] font-bold uppercase text-slate-500">Corte A</p>
                        <p className="text-xs text-slate-300">
                          {plan.observedResultA ? `Resultado: ${plan.observedResultA}` : 'Sin revisión registrada'}
                        </p>
                        {plan.decisionA && (
                          <p className="text-[11px] text-slate-400">Decisión: {plan.decisionA}</p>
                        )}
                        {plan.nextCommitmentA && (
                          <div className="mt-1 rounded bg-slate-900/60 p-1.5 text-[11px] text-slate-300">
                            <span className="font-bold text-cyan-400">Siguiente compromiso:</span> {plan.nextCommitmentA.title} ({plan.nextCommitmentA.targetDate || 'Sin fecha'})
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase text-slate-500">Corte B</p>
                        <p className="text-xs text-slate-300">
                          {plan.observedResultB ? `Resultado: ${plan.observedResultB}` : 'Sin revisión registrada'}
                        </p>
                        {plan.decisionB && (
                          <p className="text-[11px] text-slate-400">Decisión: {plan.decisionB}</p>
                        )}
                        {plan.nextCommitmentB && (
                          <div className="mt-1 rounded bg-slate-900/60 p-1.5 text-[11px] text-slate-300">
                            <span className="font-bold text-cyan-400">Siguiente compromiso:</span> {plan.nextCommitmentB.title} ({plan.nextCommitmentB.targetDate || 'Sin fecha'})
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};
