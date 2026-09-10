import React, { useState } from 'react';
import {
  formatResolutionHistoryItem,
  getContinuitySnapshot,
  reduceContinuity,
  type ContinuityCommitment,
} from '../utils/continuityEngine';

const MONTH_NAMES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

const initialCommitment = (): ContinuityCommitment => ({
  id: 'c1',
  sourceType: 'ACTIVITY_KPI',
  sourceKpiId: 'k1',
  sourceActivityId: 'a1',
  originYear: 2026,
  originPeriod: 7, // Agosto
  originalTarget: 20,
  scheduledYear: 2026,
  scheduledPeriod: 7, // Agosto
  progressByPeriod: { 7: 5 },
  status: 'active',
  outcome: 'in_progress',
  rescheduleHistory: [],
  resolutionHistory: [
    {
      type: 'CREATE_CONTINUITY' as any,
      period: 7,
      value: 5,
      at: new Date().toISOString(),
    },
  ],
});

export const ContinuityEngineHarness: React.FC = () => {
  const [state, setState] = useState<ContinuityCommitment>(initialCommitment);
  const [inputValue, setInputValue] = useState<string>('');
  const [editProgressValue, setEditProgressValue] = useState<string>('');
  const [targetReachedValue, setTargetReachedValue] = useState<string>('');
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modal / Inline Panel states
  const [showCorrectionPanel, setShowCorrectionPanel] = useState<boolean>(false);
  const [showTargetReachedModal, setShowTargetReachedModal] = useState<boolean>(false);
  const [showCloseUnmetModal, setShowCloseUnmetModal] = useState<boolean>(false);
  const [showDiscardModal, setShowDiscardModal] = useState<boolean>(false);

  const snapshot = getContinuitySnapshot(state);
  const isActive = state.status === 'active';
  const isGoalReached = snapshot.isTargetReached;

  const getTargetReachedPeriodInfo = () => {
    const currentHasProgress = (state.progressByPeriod[state.scheduledPeriod] ?? 0) > 0;
    if (currentHasProgress) {
      const nextPeriod = state.scheduledPeriod + 1;
      const nextYear = nextPeriod > 11 ? state.scheduledYear + 1 : state.scheduledYear;
      const normalizedPeriod = nextPeriod > 11 ? 0 : nextPeriod;
      return {
        year: nextYear,
        period: normalizedPeriod,
        needsReschedule: true,
        periodName: MONTH_NAMES[normalizedPeriod],
      };
    }
    return {
      year: state.scheduledYear,
      period: state.scheduledPeriod,
      needsReschedule: false,
      periodName: MONTH_NAMES[state.scheduledPeriod],
    };
  };

  const handleAction = (action: () => void) => {
    try {
      setErrorMessage(null);
      setInfoMessage(null);
      action();
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.message === 'CANNOT_COMPLETE_UNMET') {
          setErrorMessage(
            'No se puede completar como meta alcanzada cuando el progreso es inferior a la meta original. Utilice "Cerrar sin alcanzar la meta".'
          );
        } else if (err.message === 'NO_ACTIVE_RESCHEDULE') {
          setErrorMessage('No hay ninguna reprogramación activa para deshacer.');
        } else {
          setErrorMessage(err.message);
        }
      } else {
        setErrorMessage(String(err));
      }
    }
  };

  const handleReset = () => {
    setState(initialCommitment());
    setInputValue('');
    setEditProgressValue('');
    setTargetReachedValue('');
    setErrorMessage(null);
    setInfoMessage(null);
    setShowCorrectionPanel(false);
    setShowTargetReachedModal(false);
    setShowCloseUnmetModal(false);
    setShowDiscardModal(false);
  };

  const handleRecordProgress = () => {
    const num = Number(inputValue);
    if (isNaN(num)) {
      setErrorMessage('El valor ingresado debe ser un número');
      return;
    }
    handleAction(() => {
      const nextState = reduceContinuity(state, {
        type: 'RECORD_PROGRESS',
        period: state.scheduledPeriod,
        value: num,
      });
      setState(nextState);
      setInputValue('');
      setShowCorrectionPanel(false);
    });
  };

  const handleReschedule = () => {
    handleAction(() => {
      const nextPeriod = state.scheduledPeriod + 1;
      const nextYear = nextPeriod > 11 ? state.scheduledYear + 1 : state.scheduledYear;
      const normalizedPeriod = nextPeriod > 11 ? 0 : nextPeriod;
      const nextState = reduceContinuity(state, {
        type: 'RESCHEDULE',
        year: nextYear,
        period: normalizedPeriod,
      });
      setState(nextState);
      setShowCorrectionPanel(false);
    });
  };

  const handleUndoReschedule = () => {
    const currentProgress = state.progressByPeriod[state.scheduledPeriod] ?? 0;
    if (currentProgress > 0) {
      setShowCorrectionPanel(true);
      setEditProgressValue(String(currentProgress));
      setErrorMessage(null);
      return;
    }

    handleAction(() => {
      const nextState = reduceContinuity(state, { type: 'UNDO_RESCHEDULE' });
      setState(nextState);
      setShowCorrectionPanel(false);
    });
  };

  const handleVoidAndUndo = () => {
    handleAction(() => {
      const nextState = reduceContinuity(state, {
        type: 'VOID_AND_UNDO_RESCHEDULE',
        reason: 'Anulación de avance para reversión de periodo',
      });
      setState(nextState);
      setShowCorrectionPanel(false);
    });
  };

  const handleEditProgress = () => {
    const num = Number(editProgressValue);
    if (isNaN(num)) {
      setErrorMessage('El valor ingresado debe ser un número');
      return;
    }
    handleAction(() => {
      const nextState = reduceContinuity(state, {
        type: 'ADJUST_PERIOD_PROGRESS',
        period: state.scheduledPeriod,
        value: num,
        reason: 'Ajuste manual de avance en periodo de compromiso',
      });
      setState(nextState);
      setShowCorrectionPanel(false);
    });
  };

  // Flow: REGISTRAR META ALCANZADA
  const handleOpenTargetReached = () => {
    setTargetReachedValue(String(snapshot.remainingTarget));
    setShowTargetReachedModal(true);
    setErrorMessage(null);
    setInfoMessage(null);
  };

  const handleConfirmTargetReached = () => {
    const num = Number(targetReachedValue);
    if (isNaN(num) || num < 0) {
      setErrorMessage('El valor ingresado debe ser un número válido mayor o igual a cero');
      return;
    }

    handleAction(() => {
      let next = state;
      const targetInfo = getTargetReachedPeriodInfo();

      // 1. If current period already has progress, reschedule to next period first
      if (targetInfo.needsReschedule) {
        next = reduceContinuity(next, {
          type: 'RESCHEDULE',
          year: targetInfo.year,
          period: targetInfo.period,
        });
      }

      // 2. Record progress in target period
      next = reduceContinuity(next, {
        type: 'RECORD_PROGRESS',
        period: targetInfo.period,
        value: num,
      });

      const nextSnapshot = getContinuitySnapshot(next);
      if (nextSnapshot.isTargetReached) {
        // 3. Complete if target reached
        next = reduceContinuity(next, { type: 'COMPLETE' });
        setState(next);
        setShowTargetReachedModal(false);
        setInfoMessage('¡Meta alcanzada y compromiso completado exitosamente!');
      } else {
        // Did not reach target (e.g. entered 6 instead of 8)
        setState(next);
        setShowTargetReachedModal(false);
        setInfoMessage(
          `Avance registrado. Aún faltan ${nextSnapshot.remainingTarget} unidades para alcanzar la meta.`
        );
      }
    });
  };

  // Flow: CERRAR SIN ALCANZAR LA META
  const handleOpenCloseUnmet = () => {
    setShowCloseUnmetModal(true);
    setErrorMessage(null);
  };

  const handleConfirmCloseUnmet = () => {
    handleAction(() => {
      const nextState = reduceContinuity(state, { type: 'CLOSE_UNMET' });
      setState(nextState);
      setShowCloseUnmetModal(false);
      setInfoMessage('Seguimiento cerrado formalmente sin alcanzar la meta.');
    });
  };

  // Flow: DESCARTAR
  const handleOpenDiscard = () => {
    setShowDiscardModal(true);
    setErrorMessage(null);
  };

  const handleConfirmDiscard = () => {
    handleAction(() => {
      const nextState = reduceContinuity(state, { type: 'DISCARD' });
      setState(nextState);
      setShowDiscardModal(false);
      setInfoMessage('Compromiso descartado.');
    });
  };

  // Flow: REABRIR
  const handleReopen = () => {
    handleAction(() => {
      const nextState = reduceContinuity(state, { type: 'REOPEN' });
      setState(nextState);
      setInfoMessage('Compromiso reabierto.');
    });
  };

  const getStatusLabel = () => {
    switch (state.status) {
      case 'active':
        return 'ACTIVO';
      case 'completed':
        return 'COMPLETADO';
      case 'closed':
        return 'CERRADO SIN ALCANZAR LA META';
      case 'discarded':
        return 'DESCARTADO';
      default:
        return state.status;
    }
  };

  const getStatusColor = () => {
    switch (state.status) {
      case 'active':
        return '#22c55e';
      case 'completed':
        return '#38bdf8';
      case 'closed':
        return '#f59e0b';
      case 'discarded':
        return '#f87171';
      default:
        return '#cbd5e1';
    }
  };

  const activeReschedules = (state.rescheduleHistory || []).filter(
    (r) => r.status === 'active'
  );
  const lastActiveReschedule =
    activeReschedules.length > 0
      ? activeReschedules[activeReschedules.length - 1]
      : null;
  const targetPreviousMonthName = lastActiveReschedule
    ? MONTH_NAMES[lastActiveReschedule.fromPeriod]
    : 'periodo anterior';

  const targetReachedInfo = getTargetReachedPeriodInfo();

  return (
    <main
      data-testid="continuity-harness-root"
      style={{
        fontFamily: 'system-ui, -apple-system, sans-serif',
        padding: '24px 16px',
        maxWidth: 760,
        margin: '0 auto',
        color: '#f8fafc',
        background: '#0b0f19',
        minHeight: '100vh',
        boxSizing: 'border-box',
      }}
    >
      {/* Header */}
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          borderBottom: '1px solid #1e293b',
          paddingBottom: 16,
          marginBottom: 20,
        }}
      >
        <div>
          <span
            style={{
              display: 'inline-block',
              padding: '2px 8px',
              borderRadius: 4,
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.05em',
              background: '#3b82f6',
              color: 'white',
              marginBottom: 4,
            }}
          >
            MOTOR DE CONTINUIDAD V1
          </span>
          <h1 style={{ fontSize: 24, margin: '4px 0 0', fontWeight: 800 }}>
            Continuity Engine Harness
          </h1>
        </div>

        <button
          onClick={handleReset}
          data-testid="btn-reset"
          style={{
            minHeight: 44,
            padding: '8px 16px',
            background: '#334155',
            color: '#f1f5f9',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          REINICIAR
        </button>
      </header>

      {/* Info notification */}
      {infoMessage && (
        <div
          role="status"
          data-testid="info-alert"
          style={{
            background: '#064e3b',
            border: '1px solid #10b981',
            color: '#d1fae5',
            padding: '12px 16px',
            borderRadius: 8,
            marginBottom: 16,
            fontSize: 14,
          }}
        >
          {infoMessage}
        </div>
      )}

      {/* Error alert if any */}
      {errorMessage && (
        <div
          role="alert"
          data-testid="error-alert"
          style={{
            background: '#7f1d1d',
            border: '1px solid #ef4444',
            color: '#fee2e2',
            padding: '12px 16px',
            borderRadius: 8,
            marginBottom: 16,
            fontSize: 14,
          }}
        >
          <strong>Aviso:</strong> {errorMessage}
        </div>
      )}

      {/* Status and Goal Banner */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#1e293b',
          padding: '12px 16px',
          borderRadius: 8,
          marginBottom: 20,
        }}
      >
        <div>
          <span style={{ fontSize: 13, color: '#94a3b8' }}>ESTADO: </span>
          <strong
            data-testid="status-value"
            style={{
              fontSize: 14,
              color: getStatusColor(),
              textTransform: 'uppercase',
            }}
          >
            {getStatusLabel()}
          </strong>
        </div>

        {isGoalReached && (
          <span
            data-testid="badge-goal-reached"
            style={{
              background: '#15803d',
              color: '#f0fdf4',
              padding: '4px 12px',
              borderRadius: 9999,
              fontWeight: 700,
              fontSize: 13,
              border: '1px solid #22c55e',
            }}
          >
            META ALCANZADA
          </span>
        )}
      </div>

      {/* Metrics Card */}
      <section
        style={{
          background: '#111827',
          border: '1px solid #1f2937',
          borderRadius: 12,
          padding: 20,
          marginBottom: 24,
        }}
      >
        <h2 style={{ fontSize: 16, margin: '0 0 16px', color: '#cbd5e1' }}>
          Métricas de Continuidad (Snapshot Directo)
        </h2>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 16,
          }}
        >
          <div style={{ background: '#1e293b', padding: 12, borderRadius: 8 }}>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>Meta original</div>
            <div
              data-testid="metric-original-target"
              style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}
            >
              {state.originalTarget}
            </div>
          </div>

          <div style={{ background: '#1e293b', padding: 12, borderRadius: 8 }}>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>Periodo origen</div>
            <div
              data-testid="metric-origin-period"
              style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}
            >
              {MONTH_NAMES[state.originPeriod]} {state.originYear}
            </div>
          </div>

          <div style={{ background: '#1e293b', padding: 12, borderRadius: 8 }}>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>Periodo compromiso</div>
            <div
              data-testid="metric-scheduled-period"
              style={{ fontSize: 16, fontWeight: 700, marginTop: 4, color: '#38bdf8' }}
            >
              {MONTH_NAMES[state.scheduledPeriod]} {state.scheduledYear}
            </div>
          </div>

          <div style={{ background: '#1e293b', padding: 12, borderRadius: 8 }}>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>Acumulado anterior</div>
            <div
              data-testid="metric-previous-cumulative"
              style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}
            >
              {snapshot.previousCumulative}
            </div>
          </div>

          <div style={{ background: '#1e293b', padding: 12, borderRadius: 8 }}>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>Avance del periodo</div>
            <div
              data-testid="metric-current-progress"
              style={{ fontSize: 20, fontWeight: 700, marginTop: 4, color: '#a855f7' }}
            >
              +{snapshot.currentPeriodProgress}
            </div>
          </div>

          <div style={{ background: '#1e293b', padding: 12, borderRadius: 8 }}>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>Acumulado</div>
            <div
              data-testid="metric-cumulative"
              style={{ fontSize: 20, fontWeight: 700, marginTop: 4, color: '#10b981' }}
            >
              {snapshot.cumulativeProgress} / {state.originalTarget}
            </div>
          </div>

          <div style={{ background: '#1e293b', padding: 12, borderRadius: 8 }}>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>Pendiente</div>
            <div
              data-testid="metric-remaining"
              style={{ fontSize: 20, fontWeight: 700, marginTop: 4, color: '#f59e0b' }}
            >
              {snapshot.remainingTarget}
            </div>
          </div>

          <div style={{ background: '#1e293b', padding: 12, borderRadius: 8 }}>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>Cumplimiento</div>
            <div
              data-testid="metric-fulfillment"
              style={{ fontSize: 20, fontWeight: 700, marginTop: 4, color: '#06b6d4' }}
            >
              {snapshot.fulfillmentPercent}%
            </div>
          </div>
        </div>
      </section>

      {/* Confirmation Panel: REGISTRAR META ALCANZADA */}
      {showTargetReachedModal && (
        <section
          data-testid="target-reached-panel"
          style={{
            background: '#064e3b',
            border: '2px solid #10b981',
            borderRadius: 12,
            padding: 20,
            marginBottom: 24,
          }}
        >
          <h3 style={{ margin: '0 0 8px', fontSize: 16, color: '#d1fae5', fontWeight: 700 }}>
            Registrar Meta Alcanzada
          </h3>
          <p style={{ margin: '0 0 6px', fontSize: 14, color: '#a7f3d0' }}>
            Faltan <strong>{snapshot.remainingTarget} unidades</strong> para alcanzar la meta.
          </p>
          <p style={{ margin: '0 0 14px', fontSize: 13, color: '#6ee7b7' }}>
            Confirma el avance obtenido en {targetReachedInfo.periodName} {targetReachedInfo.year}:
          </p>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
            <input
              type="number"
              aria-label={`Avance de ${targetReachedInfo.periodName}`}
              placeholder="Avance obtenido"
              value={targetReachedValue}
              onChange={(e) => setTargetReachedValue(e.target.value)}
              data-testid="input-target-reached-val"
              style={{
                flex: 1,
                minWidth: 120,
                minHeight: 44,
                padding: '8px 12px',
                background: '#022c22',
                border: '1px solid #059669',
                borderRadius: 8,
                color: 'white',
                fontSize: 16,
              }}
            />
            <button
              onClick={handleConfirmTargetReached}
              data-testid="btn-confirm-target-reached"
              style={{
                minHeight: 44,
                padding: '8px 18px',
                background: '#10b981',
                color: '#022c22',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: 14,
              }}
            >
              CONFIRMAR AVANCE
            </button>
            <button
              onClick={() => setShowTargetReachedModal(false)}
              data-testid="btn-cancel-target-reached"
              style={{
                minHeight: 44,
                padding: '8px 16px',
                background: '#334155',
                color: '#e2e8f0',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 13,
              }}
            >
              CANCELAR
            </button>
          </div>
        </section>
      )}

      {/* Confirmation Panel: CERRAR SIN ALCANZAR LA META */}
      {showCloseUnmetModal && (
        <section
          data-testid="close-unmet-panel"
          style={{
            background: '#451a03',
            border: '2px solid #f59e0b',
            borderRadius: 12,
            padding: 20,
            marginBottom: 24,
          }}
        >
          <h3 style={{ margin: '0 0 8px', fontSize: 16, color: '#fde68a', fontWeight: 700 }}>
            La meta no fue alcanzada
          </h3>
          <p style={{ margin: '0 0 6px', fontSize: 14, color: '#fef3c7' }}>
            Resultado final: <strong>{snapshot.cumulativeProgress} de {state.originalTarget}</strong>.
          </p>
          <p style={{ margin: '0 0 6px', fontSize: 14, color: '#fef3c7' }}>
            Cumplimiento: <strong>{snapshot.fulfillmentPercent}%</strong>. Brecha:{' '}
            <strong>{snapshot.remainingTarget} unidades</strong>.
          </p>
          <p style={{ margin: '0 0 16px', fontSize: 13, color: '#fde68a' }}>
            ¿Cerrar el seguimiento conservando estos resultados?
          </p>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={handleConfirmCloseUnmet}
              data-testid="btn-confirm-close-unmet"
              style={{
                minHeight: 44,
                padding: '8px 18px',
                background: '#f59e0b',
                color: '#451a03',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: 14,
              }}
            >
              CONFIRMAR CIERRE
            </button>
            <button
              onClick={() => setShowCloseUnmetModal(false)}
              data-testid="btn-cancel-close-unmet"
              style={{
                minHeight: 44,
                padding: '8px 16px',
                background: '#334155',
                color: '#e2e8f0',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 13,
              }}
            >
              CANCELAR
            </button>
          </div>
        </section>
      )}

      {/* Confirmation Panel: DESCARTAR */}
      {showDiscardModal && (
        <section
          data-testid="discard-panel"
          style={{
            background: '#450a0a',
            border: '2px solid #ef4444',
            borderRadius: 12,
            padding: 20,
            marginBottom: 24,
          }}
        >
          <h3 style={{ margin: '0 0 8px', fontSize: 16, color: '#fecaca', fontWeight: 700 }}>
            Descartar este compromiso
          </h3>
          <p style={{ margin: '0 0 16px', fontSize: 13, color: '#fee2e2' }}>
            Esta acción indica que el compromiso deja de ser aplicable. No significa que la meta haya
            sido incumplida.
          </p>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={handleConfirmDiscard}
              data-testid="btn-confirm-discard"
              style={{
                minHeight: 44,
                padding: '8px 18px',
                background: '#dc2626',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: 14,
              }}
            >
              CONFIRMAR DESCARTE
            </button>
            <button
              onClick={() => setShowDiscardModal(false)}
              data-testid="btn-cancel-discard"
              style={{
                minHeight: 44,
                padding: '8px 16px',
                background: '#334155',
                color: '#e2e8f0',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 13,
              }}
            >
              CANCELAR
            </button>
          </div>
        </section>
      )}

      {/* Interactive Correction Panel when Undo requires correction */}
      {showCorrectionPanel && (
        <section
          data-testid="correction-panel"
          style={{
            background: '#1e1b4b',
            border: '2px solid #6366f1',
            borderRadius: 12,
            padding: 20,
            marginBottom: 24,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 8,
            }}
          >
            <span style={{ fontSize: 18 }}>⚠️</span>
            <h3 style={{ margin: 0, fontSize: 16, color: '#e0e7ff', fontWeight: 700 }}>
              No se puede deshacer todavía
            </h3>
          </div>

          <p style={{ margin: '0 0 8px', fontSize: 14, color: '#c7d2fe' }}>
            <strong>{MONTH_NAMES[state.scheduledPeriod]}</strong> tiene un avance registrado de{' '}
            <strong>{state.progressByPeriod[state.scheduledPeriod]} unidades</strong>.
          </p>
          <p style={{ margin: '0 0 16px', fontSize: 13, color: '#a5b4fc' }}>
            Para volver a <strong>{targetPreviousMonthName}</strong>, primero corrige ese avance sin
            eliminar el historial.
          </p>

          {/* Edit progress input within panel */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
            <input
              type="number"
              aria-label="Corregir avance"
              placeholder="Nuevo valor"
              value={editProgressValue}
              onChange={(e) => setEditProgressValue(e.target.value)}
              data-testid="input-edit-progress"
              style={{
                flex: 1,
                minWidth: 120,
                minHeight: 44,
                padding: '8px 12px',
                background: '#0f172a',
                border: '1px solid #4338ca',
                borderRadius: 8,
                color: 'white',
                fontSize: 16,
              }}
            />
            <button
              onClick={handleEditProgress}
              data-testid="btn-confirm-edit-progress"
              style={{
                minHeight: 44,
                padding: '8px 16px',
                background: '#4f46e5',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 13,
              }}
            >
              CORREGIR AVANCE
            </button>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={handleVoidAndUndo}
              data-testid="btn-void-and-undo"
              style={{
                minHeight: 44,
                padding: '8px 16px',
                background: '#dc2626',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              ANULAR AVANCE Y VOLVER
            </button>

            <button
              onClick={() => setShowCorrectionPanel(false)}
              data-testid="btn-cancel-correction"
              style={{
                minHeight: 44,
                padding: '8px 16px',
                background: '#334155',
                color: '#e2e8f0',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 13,
              }}
            >
              CANCELAR
            </button>
          </div>
        </section>
      )}

      {/* Actions */}
      <section
        style={{
          background: '#111827',
          border: '1px solid #1f2937',
          borderRadius: 12,
          padding: 20,
          marginBottom: 24,
        }}
      >
        <h2 style={{ fontSize: 16, margin: '0 0 16px', color: '#cbd5e1' }}>
          Acciones de Continuidad
        </h2>

        {/* Record Progress Input Group */}
        <div style={{ marginBottom: 20 }}>
          <label
            htmlFor="progress-input"
            style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 6 }}
          >
            Registrar avance para {MONTH_NAMES[state.scheduledPeriod]} {state.scheduledYear}:
          </label>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input
              id="progress-input"
              aria-label="Avance del periodo"
              type="number"
              placeholder="Ej. 7"
              value={inputValue}
              disabled={!isActive}
              onChange={(e) => setInputValue(e.target.value)}
              data-testid="input-progress"
              style={{
                flex: 1,
                minWidth: 140,
                minHeight: 44,
                padding: '8px 12px',
                background: isActive ? '#1e293b' : '#0f172a',
                border: '1px solid #334155',
                borderRadius: 8,
                color: 'white',
                fontSize: 16,
              }}
            />
            <button
              onClick={handleRecordProgress}
              disabled={!isActive || inputValue === ''}
              data-testid="btn-record-progress"
              style={{
                minHeight: 44,
                padding: '8px 18px',
                background: isActive && inputValue !== '' ? '#2563eb' : '#1e293b',
                color: isActive && inputValue !== '' ? '#ffffff' : '#64748b',
                border: 'none',
                borderRadius: 8,
                cursor: isActive && inputValue !== '' ? 'pointer' : 'not-allowed',
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              REGISTRAR AVANCE
            </button>
          </div>
        </div>

        {/* Dynamic Buttons Grid based on State & Fulfillment */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
            gap: 10,
          }}
        >
          {/* Active state controls */}
          {isActive && (
            <>
              {/* REGISTRAR META ALCANZADA (Replaces ambiguous COMPLETAR) */}
              <button
                onClick={handleOpenTargetReached}
                data-testid="btn-register-target-reached"
                style={{
                  minHeight: 44,
                  padding: '8px 14px',
                  background: '#16a34a',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: 13,
                }}
              >
                REGISTRAR META ALCANZADA
              </button>

              <button
                onClick={handleReschedule}
                data-testid="btn-reschedule"
                style={{
                  minHeight: 44,
                  padding: '8px 14px',
                  background: '#0284c7',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 13,
                }}
              >
                REPROGRAMAR
              </button>

              <button
                onClick={handleUndoReschedule}
                data-testid="btn-undo-reschedule"
                style={{
                  minHeight: 44,
                  padding: '8px 14px',
                  background: '#475569',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 13,
                }}
              >
                DESHACER REPROGRAMACIÓN
              </button>

              {/* CERRAR SIN ALCANZAR LA META */}
              <button
                onClick={handleOpenCloseUnmet}
                data-testid="btn-close-unmet"
                style={{
                  minHeight: 44,
                  padding: '8px 14px',
                  background: '#d97706',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: 13,
                }}
              >
                CERRAR SIN ALCANZAR LA META
              </button>

              <button
                onClick={handleOpenDiscard}
                data-testid="btn-discard"
                style={{
                  minHeight: 44,
                  padding: '8px 14px',
                  background: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 13,
                }}
              >
                DESCARTAR
              </button>
            </>
          )}

          {/* Terminal state: REABRIR */}
          {!isActive && (
            <button
              onClick={handleReopen}
              data-testid="btn-reopen"
              style={{
                minHeight: 44,
                padding: '8px 14px',
                background: '#2563eb',
                color: '#ffffff',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: 14,
                gridColumn: '1 / -1',
              }}
            >
              REABRIR COMPROMISO
            </button>
          )}
        </div>
      </section>

      {/* Stepwise Reschedule History & Humanized Resolution History */}
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: 16,
        }}
      >
        {/* Reschedule History */}
        <div
          style={{
            background: '#111827',
            border: '1px solid #1f2937',
            borderRadius: 12,
            padding: 20,
          }}
        >
          <h2 style={{ fontSize: 15, margin: '0 0 12px', color: '#cbd5e1' }}>
            Historial de Reprogramaciones ({(state.rescheduleHistory || []).length})
          </h2>
          <ul
            data-testid="reschedule-history-list"
            style={{
              margin: 0,
              paddingLeft: 20,
              fontSize: 13,
              color: '#94a3b8',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            {(state.rescheduleHistory || []).map((r, i) => (
              <li
                key={r.id || i}
                data-testid={`reschedule-item-${i}`}
                style={{
                  textDecoration: r.status === 'undone' ? 'line-through' : 'none',
                  color: r.status === 'undone' ? '#64748b' : '#38bdf8',
                }}
              >
                <strong>R{i + 1}:</strong> {MONTH_NAMES[r.fromPeriod]} {r.fromYear} &rarr;{' '}
                {MONTH_NAMES[r.toPeriod]} {r.toYear}{' '}
                <span
                  style={{
                    fontSize: 11,
                    padding: '1px 5px',
                    borderRadius: 4,
                    background: r.status === 'active' ? '#0369a1' : '#334155',
                    color: 'white',
                    marginLeft: 6,
                  }}
                >
                  {r.status === 'active' ? 'ACTIVA' : 'REVERTIDA'}
                </span>
              </li>
            ))}
            {(state.rescheduleHistory || []).length === 0 && (
              <li style={{ color: '#64748b', listStyleType: 'none' }}>
                Sin reprogramaciones registradas.
              </li>
            )}
          </ul>
        </div>

        {/* Humanized History of Management */}
        <div
          style={{
            background: '#111827',
            border: '1px solid #1f2937',
            borderRadius: 12,
            padding: 20,
          }}
        >
          <h2 style={{ fontSize: 15, margin: '0 0 12px', color: '#cbd5e1' }}>
            HISTORIAL DE GESTIÓN ({state.resolutionHistory.length})
          </h2>
          <ul
            data-testid="history-list"
            style={{
              margin: 0,
              paddingLeft: 20,
              fontSize: 13,
              color: '#94a3b8',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            {state.resolutionHistory.map((h, i) => (
              <li key={i} data-testid={`history-item-${i}`}>
                <span
                  style={{
                    fontWeight: 600,
                    color:
                      h.type === 'RECORD_PROGRESS'
                        ? '#c084fc'
                        : h.type === 'ADJUST_PERIOD_PROGRESS'
                        ? '#e879f9'
                        : h.type === 'VOID_PERIOD_PROGRESS'
                        ? '#f43f5e'
                        : h.type === 'RESCHEDULE'
                        ? '#38bdf8'
                        : h.type === 'UNDO_RESCHEDULE'
                        ? '#fbbf24'
                        : h.type === 'COMPLETE'
                        ? '#4ade80'
                        : h.type === 'CLOSE_UNMET'
                        ? '#fb923c'
                        : h.type === 'DISCARD'
                        ? '#f87171'
                        : '#60a5fa',
                  }}
                >
                  {formatResolutionHistoryItem(h, MONTH_NAMES)}
                </span>
                <span style={{ color: '#64748b', marginLeft: 8, fontSize: 12 }}>
                  [{new Date(h.at).toLocaleTimeString()}]
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
};
