import React, { useEffect, useState, useMemo, useCallback } from 'react';
import type { Dashboard, User } from '../../types';
import type { ControlCut, ControlCutKpiSnapshot, ControlCutControlSummarySnapshot, ControlCutActionPlanSnapshot } from '../../types/controlCut';
import { firebaseService } from '../../services/firebaseService';
import { canAccessDashboard, canEditActionPlan } from '../../services/tableroAuthorization';
import {
  compareControlCuts,
  validateControlCutsCompatibility,
  ControlCutComparisonResult,
} from '../../utils/controlCutComparison';
import { buildControlCutSnapshot } from '../../utils/controlCutBuilder';
import { readControlPeriodValues } from '../../utils/controlValues';
import { calculateMonthlyCompliancePercentage, isMonthlyPeriodOverdue } from '../../utils/compliance';
import { getWeekNumber } from '../../utils/weeklyUtils';
import { ControlCutComparisonModal } from './ControlCutComparisonModal';

interface ControlCutComparisonSectionProps {
  dashboards: Dashboard[];
  currentDashboard: Dashboard;
  activeClientId?: string;
  currentUser?: User;
  year: number;
}

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export const ControlCutComparisonSection: React.FC<ControlCutComparisonSectionProps> = ({
  dashboards,
  currentDashboard,
  activeClientId,
  currentUser,
  year,
}) => {
  const [selectedDashboardId, setSelectedDashboardId] = useState<string | number>(currentDashboard.id);
  const [periodicity, setPeriodicity] = useState<'monthly' | 'weekly'>('monthly');
  const [cuts, setCuts] = useState<ControlCut[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [selectedCutAId, setSelectedCutAId] = useState<string>('');
  const [selectedCutBId, setSelectedCutBId] = useState<string>('');
  const [comparisonResult, setComparisonResult] = useState<ControlCutComparisonResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Estados para "Cerrar corte"
  const [isCloseModalOpen, setIsCloseModalOpen] = useState<boolean>(false);
  const [closePeriodIndex, setClosePeriodIndex] = useState<number>(0);
  const [isSubmittingCut, setIsSubmittingCut] = useState<boolean>(false);
  const [cutActionMessage, setCutActionMessage] = useState<{ text: string; isError: boolean } | null>(null);

  const clientId = (activeClientId && activeClientId !== 'all' ? activeClientId : currentDashboard.clientId || '')
    .trim()
    .toUpperCase();

  const authorizedDashboards = useMemo(() => {
    if (!currentUser) return [];
    return dashboards.filter(
      (d) =>
        d.isAggregate !== true &&
        d.id !== -1 &&
        !String(d.id).startsWith('agg-') &&
        (!clientId || (d.clientId || '').trim().toUpperCase() === clientId) &&
        canAccessDashboard(currentUser, d),
    );
  }, [dashboards, currentUser, clientId]);

  // Sincronizar tablero seleccionado si no está en la lista autorizada
  useEffect(() => {
    if (authorizedDashboards.length > 0 && !authorizedDashboards.some((d) => String(d.id) === String(selectedDashboardId))) {
      setSelectedDashboardId(authorizedDashboards[0].id);
    }
  }, [authorizedDashboards, selectedDashboardId]);

  const targetDashboard = useMemo(
    () => authorizedDashboards.find((d) => String(d.id) === String(selectedDashboardId)) || currentDashboard,
    [authorizedDashboards, selectedDashboardId, currentDashboard],
  );

  // Permiso para cerrar corte: editor del tablero seleccionado
  const canCloseCut = useMemo(() => {
    if (!currentUser || !targetDashboard) return false;
    return canEditActionPlan(currentUser, targetDashboard);
  }, [currentUser, targetDashboard]);

  // Cargar lista de cortes históricos inmutables
  const loadCuts = useCallback(() => {
    const isTargetAuthorized = authorizedDashboards.some(
      (d) => String(d.id) === String(selectedDashboardId),
    );
    if (!clientId || !selectedDashboardId || !isTargetAuthorized) {
      setCuts([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);

    void firebaseService
      .listControlCuts(clientId, selectedDashboardId, year, periodicity)
      .then((loaded) => {
        // Ordenar por periodIndex ascendente
        const sorted = [...loaded].sort((a, b) => a.periodIndex - b.periodIndex);
        setCuts(sorted);
        setIsLoading(false);
      })
      .catch(() => {
        setIsLoading(false);
        setErrorMessage('Error al consultar cortes históricos.');
      });
  }, [clientId, selectedDashboardId, year, periodicity, authorizedDashboards]);

  useEffect(() => {
    loadCuts();
  }, [loadCuts]);

  // Calcular períodos elegibles (no futuros)
  const eligiblePeriods = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const currentWeek = getWeekNumber(now);

    if (periodicity === 'monthly') {
      const months = [];
      for (let m = 0; m < 12; m++) {
        const isEligible = isMonthlyPeriodOverdue(year, m, now);
        const alreadyClosed = cuts.some((c) => c.year === year && c.periodicity === 'monthly' && c.periodIndex === m);
        months.push({
          index: m,
          label: `${MONTH_NAMES[m]} (${year})`,
          isEligible,
          alreadyClosed,
        });
      }
      return months;
    } else {
      const weeks = [];
      for (let w = 1; w <= 52; w++) {
        const isEligible = year < currentYear || (year === currentYear && w < currentWeek);
        const alreadyClosed = cuts.some((c) => c.year === year && c.periodicity === 'weekly' && c.periodIndex === w);
        weeks.push({
          index: w,
          label: `Semana ${w} (${year})`,
          isEligible,
          alreadyClosed,
        });
      }
      return weeks;
    }
  }, [periodicity, year, cuts]);

  // Inicializar closePeriodIndex en el primer período elegible no cerrado
  useEffect(() => {
    if (isCloseModalOpen) {
      const firstEligible = eligiblePeriods.find((p) => p.isEligible && !p.alreadyClosed) || eligiblePeriods.find((p) => p.isEligible) || eligiblePeriods[0];
      if (firstEligible) {
        setClosePeriodIndex(firstEligible.index);
      }
    }
  }, [isCloseModalOpen, eligiblePeriods]);

  const formatCutLabel = (c: ControlCut) => {
    const periodLabel =
      c.periodicity === 'monthly'
        ? `${MONTH_NAMES[c.periodIndex] || `M${c.periodIndex + 1}`}`
        : `Sem ${c.periodIndex}`;
    const dateStr = new Date(c.capturedAt).toLocaleDateString();
    return `${periodLabel} (${c.year}) — ${dateStr}`;
  };

  const handleCompare = () => {
    setErrorMessage(null);
    if (!selectedCutAId || !selectedCutBId) {
      setErrorMessage('Selecciona ambos cortes (Corte A y Corte B) para comparar.');
      return;
    }
    if (selectedCutAId === selectedCutBId) {
      setErrorMessage('Selecciona dos cortes distintos para la comparación A/B.');
      return;
    }

    const cutA = cuts.find((c) => c.cutId === selectedCutAId);
    const cutB = cuts.find((c) => c.cutId === selectedCutBId);

    if (!cutA || !cutB) {
      setErrorMessage('Uno de los cortes seleccionados ya no está disponible.');
      return;
    }

    const validation = validateControlCutsCompatibility(cutA, cutB);
    if (!validation.compatible) {
      setErrorMessage(validation.reason || 'Los cortes no son compatibles.');
      return;
    }

    try {
      const res = compareControlCuts(cutA, cutB);
      setComparisonResult(res);
    } catch (e: any) {
      setErrorMessage(e?.message || 'Error al procesar la comparación.');
    }
  };

  // Crear corte inmutable
  const handleExecuteCloseCut = async () => {
    if (!canCloseCut || !targetDashboard) return;

    // Verificar elegibilidad
    const selectedEligible = eligiblePeriods.find((p) => p.index === closePeriodIndex);
    if (!selectedEligible || !selectedEligible.isEligible) {
      setCutActionMessage({
        text: 'El período seleccionado no es elegible para cierre (no ha vencido o es futuro).',
        isError: true,
      });
      return;
    }

    setIsSubmittingCut(true);
    setCutActionMessage(null);

    try {
      // 1. Obtener planes de acción activos
      let activePlans: any[] = [];
      try {
        activePlans = await firebaseService.getActiveActionPlansForDashboard(targetDashboard.id, clientId);
      } catch {
        activePlans = [];
      }

      // 2. Construir snapshots de KPIs para el período
      const periodTracking: any =
        periodicity === 'monthly'
          ? { frequency: 'monthly', monthIndex: closePeriodIndex, year }
          : { frequency: 'weekly', weekNumber: closePeriodIndex, year };

      const kpisSnapshot: ControlCutKpiSnapshot[] = (targetDashboard.items || []).map((item) => {
        const values = readControlPeriodValues(item, periodTracking);
        let compliance: number | undefined;
        if (typeof values.progress === 'number' && typeof values.goal === 'number') {
          compliance = calculateMonthlyCompliancePercentage(
            values.progress,
            values.goal,
            item.goalType === 'minimize',
          );
        }
        return {
          indicatorId: item.id,
          label: item.indicator || `KPI ${item.id}`,
          goal: values.goal,
          progress: values.progress,
          pending: values.pending,
          compliance,
          frequency: periodicity,
          goalCaptured: values.goal !== undefined,
          progressCaptured: values.progress !== undefined,
          isActivityMode: item.isActivityMode,
          dashboardId: targetDashboard.id,
          area: (item as any).area || targetDashboard.area,
        };
      });

      // 3. Resumen de control operativo
      const controlSummarySnapshot: ControlCutControlSummarySnapshot = {
        pendingConfigurationsCount: kpisSnapshot.filter((k) => k.goal === undefined).length,
        pendingCapturesCount: kpisSnapshot.filter((k) => k.goal !== undefined && k.progress === undefined).length,
        overdueActionsCount: 0,
        upcomingActionsCount: 0,
        activeActionsCount: activePlans.length,
        completedActionsCount: 0,
        pendingReviewsCount: 0,
        derivedAttentionCount: kpisSnapshot.filter((k) => typeof k.compliance === 'number' && k.compliance < 80).length,
      };

      // 4. Mapear ActionPlans a ControlCutActionPlanSnapshot
      const actionPlansSnapshot: ControlCutActionPlanSnapshot[] = activePlans.map((p) => ({
        id: String(p.id),
        indicatorId: p.indicatorId,
        dashboardId: targetDashboard.id,
        clientId,
        area: p.area || targetDashboard.area,
        title: String(p.title || ''),
        description: p.description,
        originYear: p.originYear || year,
        originPeriodType: p.originPeriodType || (periodicity === 'weekly' ? 'weekly' : 'monthly'),
        originPeriodIndex: p.originPeriodIndex ?? closePeriodIndex,
        status: p.status || 'planned',
        responsible: p.responsible,
        responsibleUserId: p.responsibleUserId,
        startDate: p.startDate || '',
        targetDate: p.targetDate,
        progress: Number(p.progress) || 0,
        expectedImpact: p.expectedImpact,
        createdAt: p.createdAt || '',
        updatedAt: p.updatedAt || '',
        closedAt: p.closedAt,
        activities: (p.activities || []).map((a: any) => ({
          id: String(a.id),
          title: String(a.title || ''),
          responsible: a.responsible,
          responsibleUserId: a.responsibleUserId,
          targetDate: a.targetDate,
          progress: Number(a.progress) || 0,
          result: a.result,
          impact: a.impact,
          createdAt: a.createdAt || '',
          updatedAt: a.updatedAt || '',
        })),
        reviews: (p.reviews || []).map((r: any) => ({
          id: String(r.id),
          planId: String(p.id),
          reviewedAt: r.reviewedAt || '',
          reviewedByUserId: r.reviewedByUserId,
          reviewedByLabel: r.reviewedByLabel || 'Auditor',
          observedResult: r.observedResult || '',
          effect: r.effect || 'none',
          decision: r.decision || 'MAINTAIN',
          note: r.note,
          evidenceRef: r.evidenceRef,
          nextReviewDate: r.nextReviewDate,
        })),
      }));

      // 5. Construir snapshot inmutable determinista
      const cut = buildControlCutSnapshot({
        clientId,
        dashboardId: targetDashboard.id,
        dashboardIds: [targetDashboard.id],
        periodicity,
        year,
        periodIndex: closePeriodIndex,
        capturedByUserId: currentUser?.id,
        capturedByLabel: currentUser?.name || currentUser?.email || 'Usuario Autorizado',
        kpis: kpisSnapshot,
        controlSummary: controlSummarySnapshot,
        actionPlans: actionPlansSnapshot,
      });

      // 6. Persistir con idempotencia
      const res = await firebaseService.createControlCut(cut);
      setIsSubmittingCut(false);
      setIsCloseModalOpen(false);

      if (res.created) {
        setCutActionMessage({ text: 'Corte cerrado y registrado exitosamente.', isError: false });
      } else {
        setCutActionMessage({ text: 'Corte ya registrado previamente para este período.', isError: false });
      }

      // 7. Refrescar lista de cortes
      loadCuts();
    } catch (err: any) {
      setIsSubmittingCut(false);
      setCutActionMessage({
        text: err?.message || 'Error al registrar el corte inmutable.',
        isError: true,
      });
    }
  };

  const periodLabelForModal =
    periodicity === 'monthly'
      ? `${MONTH_NAMES[closePeriodIndex] || `Mes ${closePeriodIndex + 1}`} (${year})`
      : `Semana ${closePeriodIndex} (${year})`;

  return (
    <div className="rounded-xl border border-white/5 bg-slate-900/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xs font-black uppercase tracking-wider text-cyan-400">
            Comparación A/B de Cortes Históricos
          </h3>
          <p className="text-xs text-slate-400">
            Compara dos snapshots inmutables certificados del mismo tablero para auditar cambios.
          </p>
        </div>

        {/* Botón Cerrar corte (solo visible y ejecutable por usuarios autorizados) */}
        {canCloseCut && (
          <button
            type="button"
            onClick={() => {
              setCutActionMessage(null);
              setIsCloseModalOpen(true);
            }}
            className="min-h-[44px] rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-xs font-black uppercase tracking-wider text-amber-300 hover:bg-amber-500/20"
          >
            Cerrar Corte
          </button>
        )}
      </div>

      {cutActionMessage && (
        <div
          role="status"
          className={`mt-3 rounded-lg border p-3 text-xs font-bold ${
            cutActionMessage.isError
              ? 'border-rose-500/30 bg-rose-950/30 text-rose-300'
              : 'border-emerald-500/30 bg-emerald-950/30 text-emerald-300'
          }`}
        >
          {cutActionMessage.text}
        </div>
      )}

      {/* Selectores */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
        {/* Tablero */}
        <div>
          <label className="text-[10px] font-black uppercase text-slate-400">Tablero</label>
          <select
            value={selectedDashboardId}
            onChange={(e) => setSelectedDashboardId(e.target.value)}
            className="mt-1 w-full min-h-[44px] rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs font-bold text-slate-200"
          >
            {authorizedDashboards.map((d) => (
              <option key={String(d.id)} value={d.id}>
                {d.title}
              </option>
            ))}
          </select>
        </div>

        {/* Periodicidad */}
        <div>
          <label className="text-[10px] font-black uppercase text-slate-400">Periodicidad</label>
          <select
            value={periodicity}
            onChange={(e) => setPeriodicity(e.target.value as 'monthly' | 'weekly')}
            className="mt-1 w-full min-h-[44px] rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs font-bold text-slate-200"
          >
            <option value="monthly">Mensual</option>
            <option value="weekly">Semanal</option>
          </select>
        </div>

        {/* Corte A */}
        <div>
          <label className="text-[10px] font-black uppercase text-slate-400">Corte A (Base)</label>
          <select
            value={selectedCutAId}
            onChange={(e) => setSelectedCutAId(e.target.value)}
            disabled={cuts.length === 0}
            className="mt-1 w-full min-h-[44px] rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs font-bold text-slate-200 disabled:opacity-50"
          >
            <option value="">Selecciona Corte A...</option>
            {cuts.map((c) => (
              <option key={c.cutId} value={c.cutId}>
                {formatCutLabel(c)}
              </option>
            ))}
          </select>
        </div>

        {/* Corte B */}
        <div>
          <label className="text-[10px] font-black uppercase text-slate-400">Corte B (Comparado)</label>
          <select
            value={selectedCutBId}
            onChange={(e) => setSelectedCutBId(e.target.value)}
            disabled={cuts.length === 0}
            className="mt-1 w-full min-h-[44px] rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs font-bold text-slate-200 disabled:opacity-50"
          >
            <option value="">Selecciona Corte B...</option>
            {cuts.map((c) => (
              <option key={c.cutId} value={c.cutId}>
                {formatCutLabel(c)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Acción y feedback */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs">
          {isLoading && <span className="text-cyan-400">Cargando cortes históricos...</span>}
          {!isLoading && cuts.length === 0 && (
            <span className="text-slate-500">No hay cortes históricos registrados para los filtros seleccionados.</span>
          )}
          {!isLoading && cuts.length > 0 && (
            <span className="text-slate-400">{cuts.length} corte(s) histórico(s) inmutable(s) disponible(s).</span>
          )}
          {errorMessage && <p className="mt-1 font-bold text-rose-400">{errorMessage}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {selectedCutAId && (
            <>
              <button
                type="button"
                onClick={async () => {
                  const cut = cuts.find((c) => c.cutId === selectedCutAId);
                  if (!cut) return;
                  const { exportControlCutReport } = await import('../../utils/controlCutExport');
                  await exportControlCutReport(cut, 'pdf');
                }}
                className="min-h-[44px] rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs font-bold text-cyan-300 hover:bg-cyan-500/20"
              >
                Exportar Corte A (PDF)
              </button>
              <button
                type="button"
                onClick={async () => {
                  const cut = cuts.find((c) => c.cutId === selectedCutAId);
                  if (!cut) return;
                  const { exportControlCutReport } = await import('../../utils/controlCutExport');
                  await exportControlCutReport(cut, 'docx');
                }}
                className="min-h-[44px] rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-2 text-xs font-bold text-indigo-300 hover:bg-indigo-500/20"
              >
                Exportar Corte A (DOCX)
              </button>
            </>
          )}

          <button
            type="button"
            onClick={handleCompare}
            disabled={!selectedCutAId || !selectedCutBId || selectedCutAId === selectedCutBId}
            className="min-h-[44px] rounded-lg bg-cyan-600 px-5 py-2 text-xs font-black uppercase tracking-wider text-white shadow-lg shadow-cyan-900/30 hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Comparar Cortes
          </button>
        </div>
      </div>

      {/* Modal de confirmación para Cerrar Corte */}
      {isCloseModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="close-cut-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
        >
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-amber-500/30 bg-slate-900 p-6 shadow-2xl">
            <header className="border-b border-white/10 pb-3">
              <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-300">
                Operación de Cierre Inmutable
              </span>
              <h2 id="close-cut-modal-title" className="mt-2 text-lg font-bold text-white">
                Cerrar Corte — {targetDashboard.title}
              </h2>
            </header>

            <div className="mt-4 space-y-4 text-xs text-slate-300">
              <div className="rounded-xl border border-amber-500/20 bg-amber-950/20 p-3 font-semibold text-amber-200">
                ⚠️ Este corte conservará el estado actual del período y no podrá modificarse ni eliminarse.
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400">
                  Selecciona el período a cerrar
                </label>
                <select
                  value={closePeriodIndex}
                  onChange={(e) => setClosePeriodIndex(Number(e.target.value))}
                  className="mt-1 w-full min-h-[44px] rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs font-bold text-slate-200"
                >
                  {eligiblePeriods.map((p) => (
                    <option key={p.index} value={p.index} disabled={!p.isEligible}>
                      {p.label} {!p.isEligible ? '(No elegible / futuro)' : p.alreadyClosed ? '(Ya cerrado)' : '(Elegible)'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-xl border border-white/5 bg-slate-950/50 p-3 space-y-1">
                <p>
                  <span className="font-bold text-slate-400">Tablero:</span> {targetDashboard.title}
                </p>
                <p>
                  <span className="font-bold text-slate-400">Período:</span> {periodLabelForModal}
                </p>
                <p>
                  <span className="font-bold text-slate-400">KPIs incluidos:</span> {targetDashboard.items?.length || 0}
                </p>
                <p>
                  <span className="font-bold text-slate-400">Periodicidad:</span> {periodicity === 'monthly' ? 'Mensual' : 'Semanal'}
                </p>
              </div>
            </div>

            <footer className="mt-6 flex items-center justify-end gap-3 border-t border-white/10 pt-4">
              <button
                type="button"
                onClick={() => setIsCloseModalOpen(false)}
                disabled={isSubmittingCut}
                className="min-h-[44px] rounded-lg border border-white/10 px-4 py-2 text-xs font-bold text-slate-300 hover:bg-white/10 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleExecuteCloseCut()}
                disabled={isSubmittingCut}
                className="min-h-[44px] rounded-lg bg-amber-600 px-5 py-2 text-xs font-black uppercase tracking-wider text-white shadow-lg shadow-amber-900/30 hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmittingCut ? 'Registrando Corte...' : 'Confirmar Cierre de Corte'}
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Modal de visualización */}
      {comparisonResult && (
        <ControlCutComparisonModal
          comparison={comparisonResult}
          onClose={() => setComparisonResult(null)}
        />
      )}
    </div>
  );
};

