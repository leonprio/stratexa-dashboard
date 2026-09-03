import React, { useEffect, useMemo, useState } from 'react';
import { Dashboard, DashboardItem, ComplianceThresholds, User } from '../types';
import type { StrategicObjective } from '../strategyTypes';
import { calculateDashboardMonthlyScores, calculateDashboardWeightedScore, calculateCaptureMetrics, getStatusForPercentage } from '../utils/compliance';
import { buildOperationalAlerts } from '../utils/operationalAlerts';
import { firebaseService } from '../services/firebaseService';
import { LineChart } from './LineChart';
import { resolvePreviousComparablePeriod } from '../utils/reportSynthesis';

export const calculateGapToTarget = (actual: number, target = 100): number => Math.max(0, Math.round(target) - Math.round(actual));

interface ReportCenterProps {
    items: DashboardItem[];
    thresholds: ComplianceThresholds;
    year?: number;
    allDashboards?: Dashboard[];
    currentDashboardId?: number | string;
    objectives?: StrategicObjective[];
    onEditItem?: (id: number | string) => void;
    onClose?: () => void;
    onNavigateToControl?: () => void;
    onNavigateToObjectives?: () => void;
    user: User;
}

const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const isPhysical = (dashboard: Dashboard) => dashboard.isAggregate !== true && dashboard.id !== -1 && !String(dashboard.id).startsWith('agg-');

export const ReportCenter: React.FC<ReportCenterProps> = React.memo(({ items, thresholds, year = new Date().getFullYear(), allDashboards = [], currentDashboardId, objectives = [], onClose, onNavigateToControl, onNavigateToObjectives, user }) => {
    const activeDashboard = allDashboards.find(d => String(d.id) === String(currentDashboardId));
    const isGlobalMode = currentDashboardId === -1 || String(currentDashboardId).startsWith('agg-');
    const contextLabel = isGlobalMode ? 'CONSOLIDADO' : activeDashboard?.title || 'TABLERO';
    const physicalDashboards = useMemo(() => allDashboards.filter(isPhysical), [allDashboards]);
    const reportDashboards = physicalDashboards.length ? physicalDashboards : (activeDashboard && isPhysical(activeDashboard) ? [activeDashboard] : []);
    const globalScore = useMemo(() => calculateDashboardWeightedScore(items, thresholds, year), [items, thresholds, year]);
    const capture = useMemo(() => calculateCaptureMetrics(items, year).capturePct, [items, year]);
    const alerts = useMemo(() => buildOperationalAlerts(reportDashboards, thresholds, year).filter(alert => !['BAJO CONTROL', 'SIN OBLIGACIÓN'].includes(alert.severity)), [reportDashboards, thresholds, year]);
    const areaComparison = useMemo(() => reportDashboards.map(dashboard => ({ dashboard, score: calculateDashboardWeightedScore(dashboard.items || [], thresholds, year) })).sort((a, b) => a.score - b.score), [reportDashboards, thresholds, year]);
    const latestAllowedIndex = year === new Date().getFullYear() ? new Date().getMonth() : 11;
    const monthlyScores = useMemo(() => calculateDashboardMonthlyScores(items, thresholds, year, latestAllowedIndex), [items, thresholds, year, latestAllowedIndex]);
    const comparable = useMemo(() => resolvePreviousComparablePeriod(monthlyScores, latestAllowedIndex), [monthlyScores, latestAllowedIndex]);
    const validTrend = monthlyScores.filter(score => typeof score === 'number' && Number.isFinite(score)).length >= 3;
    const [activePlans, setActivePlans] = useState(0);

    useEffect(() => {
        let active = true;
        void Promise.all(reportDashboards.map(dashboard => firebaseService.getActiveActionPlansForDashboard(dashboard.id, dashboard.clientId))).then(groups => {
            if (active) setActivePlans(groups.flat().length);
        }).catch(() => { if (active) setActivePlans(0); });
        return () => { active = false; };
    }, [reportDashboards]);

    const observations = useMemo(() => items.flatMap(item => (item.monthlyNotes || []).map((note, index) => note?.trim() ? { indicator: item.indicator, note: note.trim(), index } : null).filter(Boolean) as { indicator: string; note: string; index: number }[]).sort((a, b) => b.index - a.index).slice(0, 3), [items]);
    const status = getStatusForPercentage(globalScore, thresholds);
    const deltaTone = comparable.delta === null ? 'text-slate-400' : comparable.delta > 0 ? 'text-emerald-400' : comparable.delta < 0 ? 'text-rose-400' : 'text-slate-300';
    const periodLabel = comparable.priorPeriodIndex === null ? 'Sin periodo comparable' : `${monthNames[comparable.priorPeriodIndex]} ${year}`;

    return <div className="flex flex-col gap-4 p-4">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/5 bg-slate-950/40 p-3"><div className="flex items-center gap-3"><button onClick={onClose} className="rounded-lg border border-white/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-300">← Volver</button><div><h2 className="text-lg font-black uppercase tracking-tight text-white">Reporte ejecutivo</h2><span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">{contextLabel} · {year}</span></div></div>{false && (user.globalRole === 'Admin' || user.canExportPPT) && <button type="button">Exportar PowerPoint</button>}</header>
        <section aria-labelledby="report-state" className="rounded-xl border border-white/5 bg-slate-900/40 p-3"><h3 id="report-state" className="mb-2 text-[10px] font-black uppercase tracking-widest text-cyan-400">1. Estado ejecutivo</h3><div className="grid grid-cols-2 gap-2 lg:grid-cols-4"><Metric label="Cumplimiento global" value={`${Math.round(globalScore)}%`} tone={status === 'OnTrack' ? 'text-emerald-400' : status === 'AtRisk' ? 'text-amber-400' : 'text-rose-400'} /><Metric label="Captura / confiabilidad" value={`${Math.round(capture)}%`} tone={capture >= 90 ? 'text-emerald-400' : 'text-amber-400'} /><Metric label="KPI en excepción" value={alerts.length} tone={alerts.length ? 'text-rose-400' : 'text-emerald-400'} /><Metric label="Planes activos" value={activePlans} tone="text-cyan-400" /></div></section>
        <section aria-labelledby="report-change" className="rounded-xl border border-white/5 bg-slate-900/40 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><h3 id="report-change" className="text-[10px] font-black uppercase tracking-widest text-cyan-400">2. Qué cambió</h3><span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Actual · {monthNames[latestAllowedIndex]} {year}</span></div><div className="mt-2 flex flex-wrap items-baseline gap-3"><span className="text-2xl font-black text-white">{Math.round(globalScore)}%</span><span className="text-[10px] uppercase tracking-widest text-slate-500">vs {periodLabel}</span><span className={`text-lg font-black ${deltaTone}`}>{comparable.delta === null ? 'Sin comparación' : `${comparable.delta > 0 ? '+' : ''}${comparable.delta} pts`}</span></div>{validTrend && <div className="mt-3 w-full min-w-0"><LineChart progressData={monthlyScores} goalData={monthlyScores.map(() => 100)} unit="%" type="average" status={status} indicator="report-trend" /></div>}</section>
        <section aria-labelledby="report-decision" className="rounded-xl border border-white/5 bg-slate-900/40 p-3"><h3 id="report-decision" className="mb-2 text-[10px] font-black uppercase tracking-widest text-cyan-400">3. Dónde concentrar la decisión</h3><div className="grid grid-cols-1 gap-2 md:grid-cols-3">{areaComparison.map(({ dashboard, score }) => <div key={dashboard.id} className="flex items-center justify-between rounded-lg border border-white/5 bg-slate-950/40 px-3 py-2"><div><p className="text-[10px] font-black uppercase text-white">{dashboard.area || dashboard.title}</p><p className="text-[9px] text-slate-500">{getStatusForPercentage(score, thresholds)}</p></div><span className="text-lg font-black text-white">{Math.round(score)}%</span></div>)}</div>{areaComparison.length > 0 && alerts.length > 0 && <p className="mt-2 text-[10px] text-slate-400">La lectura operativa requiere revisar {alerts.length} KPI en excepción; el detalle está en Control.</p>}</section>
        <section aria-labelledby="report-context" className="rounded-xl border border-white/5 bg-slate-900/40 p-3"><h3 id="report-context" className="mb-2 text-[10px] font-black uppercase tracking-widest text-cyan-400">4. Contexto y acciones</h3><div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-400"><span>{objectives.length} objetivos estratégicos disponibles</span><span>·</span><span>{alerts.length} excepciones KPI</span><span>·</span><span>{activePlans} planes correctivos activos</span></div>{observations.length > 0 && <div className="mt-3 space-y-1.5">{observations.map((observation, index) => <p key={`${observation.indicator}-${index}`} className="truncate text-[10px] text-slate-400"><span className="font-bold text-slate-300">{observation.indicator}:</span> {observation.note}</p>)}</div>}<div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={onNavigateToObjectives} className="rounded-lg border border-violet-500/30 px-3 py-2 text-[10px] font-black uppercase text-violet-300">VER OBJETIVOS</button><button type="button" onClick={onNavigateToControl} className="rounded-lg border border-cyan-500/30 px-3 py-2 text-[10px] font-black uppercase text-cyan-300">VER CONTROL</button></div></section>
    </div>;
});

const Metric = ({ label, value, tone }: { label: string; value: string | number; tone: string }) => <div className="rounded-lg border border-white/5 bg-slate-950/40 px-3 py-2"><p className="text-[8px] font-black uppercase tracking-widest text-slate-500">{label}</p><p className={`mt-1 text-xl font-black tabular-nums ${tone}`}>{value}</p></div>;
