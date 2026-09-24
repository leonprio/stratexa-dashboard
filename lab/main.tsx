import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { DashboardItem } from '../types';
import { ContinuityWorkspace } from '../components/continuity/ContinuityWorkspace';
import { ActivityManager } from '../components/ActivityManager';
import type { ContinuityPanelPending } from '../components/continuity/ContinuityPanel';
import { createSimpleKpiContinuityCommitment } from '../utils/continuityAdapter';
import '../index.css';

const STORAGE_KEY = 'tablero-e2e-v969';
const ACTIVITY_KPI_ID = 'lab-activity-kpi';
const SIMPLE_KPI_ID = 'lab-simple-kpi';
const SIMPLE_KPI_KEY = `simple-kpi:${SIMPLE_KPI_ID}:monthly:2026:7`;
const ANNUAL_KPI_ID = 'lab-cross-year-kpi';
const ANNUAL_KPI_KEY = `simple-kpi:${ANNUAL_KPI_ID}:monthly:2026:11`;

const emptyMonths = (value: number | null = null) => Array(12).fill(value) as (number | null)[];
const emptyCapturedMonths = () => Array<boolean>(12).fill(false);
const isProductionBuild = Boolean((import.meta as ImportMeta & { env?: { PROD?: boolean } }).env?.PROD);

const activityFixture = (): DashboardItem => ({
  id: ACTIVITY_KPI_ID,
  indicator: 'EVENTOS DE CERTIFICACIÓN',
  weight: 100,
  frequency: 'monthly',
  trackingStartPeriod: { frequency: 'monthly', year: 2026, monthIndex: 7 },
  monthlyGoals: emptyMonths(0).map((v, i) => (i === 7 ? 3 : v)),
  monthlyProgress: emptyMonths(null).map((v, i) => (i === 7 ? 0 : v)),
  monthlyProgressCaptured: emptyCapturedMonths().map((_, i) => i === 7),
  unit: 'eventos',
  type: 'accumulative',
  goalType: 'maximize',
  indicatorType: 'simple',
  isActivityMode: true,
  activityConfig: {
    7: [
      { id: 'test-activity-a', label: 'Actividad A', targetCount: 2, completedCount: 0 },
      { id: 'test-activity-b', label: 'Actividad B', targetCount: 1, completedCount: 0 },
    ],
  },
});

const simpleFixture = (): DashboardItem => {
  const item: DashboardItem = {
    id: SIMPLE_KPI_ID,
    indicator: 'ALIANZAS DE CERTIFICACIÓN',
    weight: 100,
    frequency: 'monthly',
    trackingStartPeriod: { frequency: 'monthly', year: 2026, monthIndex: 7 },
    monthlyGoals: emptyMonths(0).map((v, i) => (i === 7 ? 5 : v)),
    monthlyProgress: emptyMonths(null).map((v, i) => (i === 7 ? 3 : v)),
    monthlyProgressCaptured: emptyCapturedMonths().map((_, i) => i === 7),
    unit: 'alianzas',
    type: 'accumulative',
    goalType: 'maximize',
    indicatorType: 'simple',
    isActivityMode: false,
  };
  const commitment = createSimpleKpiContinuityCommitment(item, 2026, 7);
  return {
    ...item,
    continuityCommitments: {
      [commitment.id]: commitment,
    },
  };
};

const crossYearFixture = (): DashboardItem => {
  const item: DashboardItem = {
    id: ANNUAL_KPI_ID, indicator: 'ALIANZAS DE CERTIFICACIÓN — CRUCE ANUAL', weight: 100, frequency: 'monthly',
    trackingStartPeriod: { frequency: 'monthly', year: 2026, monthIndex: 11 },
    monthlyGoals: emptyMonths(0).map((v, i) => (i === 11 ? 5 : v)),
    monthlyProgress: emptyMonths(null).map((v, i) => (i === 11 ? 3 : v)),
    monthlyProgressCaptured: emptyCapturedMonths().map((_, i) => i === 11), unit: 'alianzas', type: 'accumulative', goalType: 'maximize', indicatorType: 'simple', isActivityMode: false,
  };
  const commitment = createSimpleKpiContinuityCommitment(item, 2026, 11);
  return { ...item, continuityCommitments: { [commitment.id]: { ...commitment, scheduledYear: 2027, scheduledPeriod: 0, progressByTemporalPeriod: { 'monthly:2026:11': 3 } } } };
};

const initialData = () => ({
  activity: activityFixture(),
  simple: simpleFixture(),
  annual: crossYearFixture(),
});

const load = (): { activity: DashboardItem; simple: DashboardItem; annual: DashboardItem } => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialData();
    const parsed = JSON.parse(raw);
    if (!parsed?.activity?.activityConfig?.[7] || !Array.isArray(parsed.activity.activityConfig[7]) || !parsed?.annual?.continuityCommitments) {
      return initialData();
    }
    return parsed;
  } catch {
    return initialData();
  }
};

function LabApp() {
  const [data, setData] = useState<{ activity: DashboardItem; simple: DashboardItem; annual: DashboardItem }>(load);
  const [selected, setSelected] = useState<{ item: DashboardItem; pending: ContinuityPanelPending } | null>(null);
  const [message, setMessage] = useState('');
  const [checklistOpen, setChecklistOpen] = useState(false);

  const localhost = location.hostname === 'localhost' || location.hostname === '127.0.0.1';

  const persist = (next: typeof data) => {
    setData(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (e) {
      console.error('Failed to persist lab data', e);
    }
  };

  const reset = () => {
    const next = initialData();
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    persist(next);
    setSelected(null);
    setMessage('Fixtures restaurados');
  };

  useEffect(() => {
    if (!localhost || isProductionBuild) {
      setMessage('Laboratorio detenido: sólo localhost en desarrollo');
    }
  }, [localhost]);

  const update = (item: DashboardItem) => {
    const key = item.id === ACTIVITY_KPI_ID ? 'activity' : item.id === ANNUAL_KPI_ID ? 'annual' : 'simple';
    const next = { ...data, [key]: item };
    persist(next);
    setSelected((s) => (s ? { ...s, item } : s));
  };

  const open = (item: DashboardItem, sourceActivityId: string, label: string) => {
    setMessage('');
    setSelected({
      item,
      pending: {
        id: sourceActivityId,
        sourceActivityId,
        label,
        periodIndex: item.id === ANNUAL_KPI_ID ? 0 : 7,
        periodLabel: item.id === ANNUAL_KPI_ID ? 'Enero' : 'Agosto',
      },
    });
  };

  if (!localhost || isProductionBuild) {
    return (
      <main style={{ padding: 24, background: '#020617', color: '#e2e8f0', minHeight: '100vh' }}>
        <h1 style={{ fontSize: 24, fontWeight: 900 }}>Laboratorio detenido</h1>
        <p>Requiere desarrollo local en localhost/127.0.0.1.</p>
      </main>
    );
  }

  const simpleGoal = Number(data.simple.monthlyGoals[7] ?? 0);
  const simpleReal = Number(data.simple.monthlyProgress[7] ?? 0);
  const simplePending = Math.max(0, simpleGoal - simpleReal);

  const actProgress = Number(data.activity.monthlyProgress?.[7] ?? 0);

  return (
    <main style={{ minHeight: '100vh', background: '#020617', color: '#e2e8f0', padding: 24, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <header style={{ border: '1px solid #155e75', borderRadius: 16, padding: 20, marginBottom: 20, background: 'rgba(15, 23, 42, 0.7)' }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, letterSpacing: '-0.02em' }}>LABORATORIO DE CERTIFICACIÓN</h1>
        <p style={{ color: '#67e8f9', fontWeight: 700, margin: '8px 0' }}>DATOS FICTICIOS · SIN CONEXIÓN A FIREBASE</p>
        <p style={{ color: '#94a3b8', fontSize: 14, margin: '4px 0 16px' }}>
          Cliente: LABORATORIO CONTINUIDAD · Usuario: Usuario de Certificación · Rol: Certificador de prueba
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            minHeight: 44,
            padding: '10px 18px',
            borderRadius: 12,
            border: '1px solid #06b6d4',
            background: '#0891b2',
            color: '#ffffff',
            fontWeight: 800,
            fontSize: 13,
            cursor: 'pointer',
            letterSpacing: '0.05em',
          }}
        >
          RESTABLECER DATOS DE PRUEBA
        </button>
      </header>

      {message && (
        <div role="status" style={{ padding: '12px 16px', background: '#064e3b', border: '1px solid #059669', borderRadius: 12, marginBottom: 16, color: '#6ee7b7', fontWeight: 700, fontSize: 14 }}>
          {message}
        </div>
      )}

      <section style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        <article style={{ border: '1px solid #334155', borderRadius: 16, padding: 20, background: '#0f172a' }}>
          <h2 style={{ fontSize: 17, fontWeight: 800, margin: '0 0 8px', color: '#f8fafc' }}>EVENTOS DE CERTIFICACIÓN</h2>
          <p style={{ color: '#94a3b8', fontSize: 14, margin: '0 0 16px' }}>
            Agosto 2026 · Meta 3 · Real {actProgress}
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setChecklistOpen(true)}
              style={{ minHeight: 44, padding: '10px 14px', borderRadius: 10, border: '1px solid #06b6d4', background: '#0e7490', color: '#ffffff', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}
            >
              ABRIR CHECKLIST E IMPORTACIÓN
            </button>
            <button
              type="button"
              onClick={() => open(data.activity, 'test-activity-a', 'Actividad A')}
              style={{
                minHeight: 44,
                padding: '10px 14px',
                borderRadius: 10,
                border: '1px solid #3b82f6',
                background: '#1d4ed8',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              ABRIR ACTIVIDAD A (META 2)
            </button>
            <button
              type="button"
              onClick={() => open(data.activity, 'test-activity-b', 'Actividad B')}
              style={{
                minHeight: 44,
                padding: '10px 14px',
                borderRadius: 10,
                border: '1px solid #6366f1',
                background: '#4338ca',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              ABRIR ACTIVIDAD B (META 1)
            </button>
          </div>
        </article>

        <article style={{ border: '1px solid #334155', borderRadius: 16, padding: 20, background: '#0f172a' }}>
          <h2 style={{ fontSize: 17, fontWeight: 800, margin: '0 0 8px', color: '#f8fafc' }}>ALIANZAS DE CERTIFICACIÓN</h2>
          <p style={{ color: '#94a3b8', fontSize: 14, margin: '0 0 16px' }}>
            KPI simple mensual · Agosto 2026 · Meta {simpleGoal} · Real {simpleReal} · Pendiente {simplePending}
          </p>
          <button
            type="button"
            onClick={() => open(data.simple, SIMPLE_KPI_KEY, 'ALIANZAS DE CERTIFICACIÓN')}
            style={{
              minHeight: 44,
              padding: '10px 16px',
              borderRadius: 10,
              border: '1px solid #10b981',
              background: '#047857',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            ABRIR CONTINUIDAD KPI SIMPLE
          </button>
        </article>

        <article style={{ border: '1px solid #334155', borderRadius: 16, padding: 20, background: '#0f172a' }}>
          <h2 style={{ fontSize: 17, fontWeight: 800, margin: '0 0 8px', color: '#f8fafc' }}>CRUCE ANUAL</h2>
          <p style={{ color: '#94a3b8', fontSize: 14, margin: '0 0 16px' }}>Diciembre 2026 · Meta 5 · Real 3 · Pendiente 2 · Continuidad Enero 2027</p>
          <button type="button" onClick={() => open(data.annual, ANNUAL_KPI_KEY, 'ALIANZAS DE CERTIFICACIÓN — CRUCE ANUAL')} style={{ minHeight: 44, padding: '10px 16px', borderRadius: 10, border: '1px solid #f59e0b', background: '#b45309', color: '#fff', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>ABRIR CONTINUIDAD ANUAL</button>
        </article>
      </section>

      {checklistOpen && (
        <ActivityManager
          title={data.activity.indicator}
          subtitle="Agosto 2026 · entorno aislado"
          periodLabel="Ago 2026"
          initialActivities={data.activity.activityConfig?.[7] || []}
          canEdit
          onClose={() => setChecklistOpen(false)}
          onSave={(activities) => {
            const totalGoal = activities.reduce((sum, activity) => sum + activity.targetCount, 0);
            const totalProgress = activities.reduce((sum, activity) => sum + activity.completedCount, 0);
            const monthlyGoals = [...data.activity.monthlyGoals];
            const monthlyProgress = [...data.activity.monthlyProgress];
            monthlyGoals[7] = totalGoal;
            monthlyProgress[7] = totalProgress;
            update({ ...data.activity, activityConfig: { ...data.activity.activityConfig, 7: activities }, monthlyGoals, monthlyProgress });
            setChecklistOpen(false);
            setMessage(`Checklist guardado en el laboratorio: ${activities.length} elementos.`);
          }}
          goalType={data.activity.goalType}
        />
      )}

      {selected && (
        <ContinuityWorkspace
          item={selected.item}
          pending={selected.pending}
          year={selected.item.id === ANNUAL_KPI_ID ? 2027 : 2026}
          isWeekly={false}
          consultedPeriod={selected.item.id === ANNUAL_KPI_ID ? 0 : 7}
          onUpdateItem={update}
          onUpdateKpiProgress={(period, value) => {
            const next = {
              ...selected.item,
              monthlyProgress: [...(selected.item.monthlyProgress || emptyMonths(null))],
              monthlyProgressCaptured: [...(selected.item.monthlyProgressCaptured || emptyCapturedMonths())],
            };
            next.monthlyProgress[period] = value === null ? 0 : value;
            next.monthlyProgressCaptured[period] = value !== null;
            if (selected.item.id === ANNUAL_KPI_ID) {
              const commitments = { ...(next.continuityCommitments || {}) };
              const id = Object.keys(commitments)[0];
              if (id) commitments[id] = { ...commitments[id], progressByTemporalPeriod: { ...(commitments[id].progressByTemporalPeriod || {}), 'monthly:2027:0': value === null ? 0 : value } };
              next.continuityCommitments = commitments;
            }
            update(next);
          }}
          onClose={() => setSelected(null)}
          onSuccess={setMessage}
        />
      )}
    </main>
  );
}

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(<LabApp />);
}
