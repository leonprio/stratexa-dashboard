import React, { useState, useMemo, useEffect } from 'react';
import { DashboardItem, ComplianceThresholds } from '../types';
import { RelatedActionPlans } from './RelatedActionPlans';
import { calculateCompliance, findLastIndexWithData, resolveItemValues } from '../utils/compliance';
import { getWeekNumber, getYearWeekMapping } from '../utils/weeklyUtils';
import { ProgressBar } from './ProgressBar';
import { LineChart } from './LineChart';
import { ActionPlan } from './ActionPlan';
import { DataEditor } from './DataEditor';
import { ActivityManager } from './ActivityManager';
import { formatNumberWithCommas, parseFormattedNumber, formatIndicatorValue } from '../utils/formatters';

interface CurrentPeriodFocusProps {
    item: DashboardItem;
    globalThresholds: ComplianceThresholds;
    year?: number;
    onUpdateItem: (updatedItem: DashboardItem) => Promise<void> | void;
    canEdit: boolean;
    onClose: () => void;
    allDashboardItems?: DashboardItem[];
    decimalPrecision?: 0 | 1 | 2;
    dashboardId?: number | string;
    clientId?: string;
}

export interface PendingKpiActivity { id: string; sourceActivityId: string; label: string; periodIndex: number; periodLabel: string; commitmentLabel?: string; rescheduleHistory?: { fromYear: number; fromPeriodType: 'monthly' | 'weekly'; fromPeriodIndex: number; toYear: number; toPeriodType: 'monthly' | 'weekly'; toPeriodIndex: number; changedAt: string }[]; status: 'PENDIENTE' | 'ATENCIÓN' | 'ATRASADA' | 'REPROGRAMADA' | 'COMPROMISO ACTUAL'; }
export interface RescheduledKpiCommitment extends PendingKpiActivity { scheduledPeriodIndex: number; scheduledPeriodLabel: string; }
export const deriveRescheduledKpiCommitments = (activityConfig: DashboardItem['activityConfig'], periodIndex: number, isWeekly: boolean, year: number): RescheduledKpiCommitment[] => {
    if (!activityConfig) return [];
    const labels = isWeekly ? (index: number) => `S${index + 1}` : (index: number) => ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][index] || `P${index + 1}`;
    return Object.entries(activityConfig).flatMap(([period, raw]) => {
        if (!Array.isArray(raw)) return [];
        return raw.filter(a => a.resolution?.resolutionStatus === 'rescheduled' && a.resolution.scheduledResolutionYear === year && a.resolution.scheduledResolutionPeriodType === (isWeekly ? 'weekly' : 'monthly') && a.resolution.scheduledResolutionPeriodIndex === periodIndex && Number(a.completedCount) < Number(a.targetCount)).map(a => ({ id: `${period}:${a.id}`, sourceActivityId: a.id, label: a.label, periodIndex: Number(period), periodLabel: `${labels(Number(period))} · ${year}`, scheduledPeriodIndex: periodIndex, scheduledPeriodLabel: `${labels(periodIndex)} · ${year}`, status: 'ATENCIÓN' as const }));
    });
};
export const RescheduledCommitmentsSection: React.FC<{ commitments: RescheduledKpiCommitment[]; onManage: (commitment: RescheduledKpiCommitment) => void }> = ({ commitments, onManage }) => commitments.length === 0 ? null : <section className="rounded-xl border border-cyan-500/20 bg-slate-950/40 p-3"><h3 className="text-[9px] font-black uppercase tracking-widest text-cyan-300">COMPROMISOS REPROGRAMADOS ({commitments.length})</h3>{commitments.map(commitment => <div key={commitment.id} className="mt-2 flex items-center justify-between gap-3"><div><p className="text-xs text-slate-200">{commitment.label}</p><p className="text-[10px] text-slate-500">Origen: {commitment.periodLabel} → Compromiso: {commitment.scheduledPeriodLabel}</p><div className="mt-1 flex gap-1"><span className="rounded border border-cyan-500/30 px-1.5 py-0.5 text-[8px] font-black text-cyan-300">REPROGRAMADA</span><span className="rounded border border-slate-600 px-1.5 py-0.5 text-[8px] font-black text-slate-400">NO SUMA A META</span></div></div><button onClick={() => onManage(commitment)} className="rounded-lg border border-cyan-500/30 px-3 py-2 text-[9px] font-black text-cyan-300">GESTIONAR</button></div>)}</section>;
export const applyOperationalReschedule = (activityConfig: DashboardItem['activityConfig'], originPeriodIndex: number, activityId: string, scheduledPeriodIndex: number, isWeekly: boolean, year: number): DashboardItem['activityConfig'] => {
    const config = { ...(activityConfig || {}) };
    const source = [...(config[originPeriodIndex] || [])];
    const index = source.findIndex(activity => activity.id === activityId);
    if (index < 0) return config;
    const previous = source[index].resolution || {};
    const nextType = isWeekly ? 'weekly' : 'monthly';
    const history = [...(previous.rescheduleHistory || []), ...(previous.scheduledResolutionPeriodIndex === undefined ? [{ fromYear: year, fromPeriodType: nextType, fromPeriodIndex: originPeriodIndex, toYear: year, toPeriodType: nextType, toPeriodIndex: scheduledPeriodIndex, changedAt: new Date().toISOString() }] : [{ fromYear: previous.scheduledResolutionYear || year, fromPeriodType: previous.scheduledResolutionPeriodType || nextType, fromPeriodIndex: previous.scheduledResolutionPeriodIndex, toYear: year, toPeriodType: nextType, toPeriodIndex: scheduledPeriodIndex, changedAt: new Date().toISOString() }])];
    source[index] = { ...source[index], resolution: { ...previous, resolutionStatus: 'rescheduled', scheduledResolutionYear: year, scheduledResolutionPeriodType: nextType, scheduledResolutionPeriodIndex: scheduledPeriodIndex, rescheduleHistory: history } };
    config[originPeriodIndex] = source;
    return config;
};
export const derivePendingKpiActivities = (activityConfig: DashboardItem['activityConfig'], currentIndex: number, isWeekly: boolean, year: number): PendingKpiActivity[] => {
    if (!activityConfig) return [];
    const labels = isWeekly ? (index: number) => `S${index + 1}` : (index: number) => ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][index] || `P${index + 1}`;
    const pending = Object.entries(activityConfig).flatMap(([period, raw]) => {
        const periodIndex = Number(period);
        if (!Number.isFinite(periodIndex) || periodIndex > currentIndex || !Array.isArray(raw)) return [];
        return raw
            .filter(activity => Number(activity.completedCount) < Number(activity.targetCount) && !['completed_later', 'discarded'].includes(activity.resolution?.resolutionStatus || ''))
            .map(activity => {
                const scheduled = activity.resolution?.resolutionStatus === 'rescheduled' ? activity.resolution.scheduledResolutionPeriodIndex : undefined;
                const scheduledYear = activity.resolution?.scheduledResolutionYear || year;
                const origin = `${labels(periodIndex)} · ${year}`;
                const commitment = scheduled === undefined ? undefined : `${labels(scheduled)} · ${scheduledYear}`;
                return {
                    id: `${periodIndex}:${activity.id}`,
                    sourceActivityId: activity.id,
                    label: activity.label,
                    periodIndex,
                    periodLabel: commitment ? `ORIGEN ${origin} → COMPROMISO ${commitment}` : origin,
                    commitmentLabel: commitment,
                    rescheduleHistory: activity.resolution?.rescheduleHistory,
                    status: scheduled === undefined
                        ? (periodIndex < currentIndex ? 'ATRASADA' as const : Number(activity.completedCount) > 0 ? 'ATENCIÓN' as const : 'PENDIENTE' as const)
                        : scheduled < currentIndex ? 'ATRASADA' as const : scheduled === currentIndex ? 'COMPROMISO ACTUAL' as const : 'REPROGRAMADA' as const
                };
            });
    });
    return Array.from(pending.reduce((unique, activity) => unique.set(activity.id, unique.get(activity.id) || activity), new Map<string, PendingKpiActivity>()).values());
};

export const CurrentPeriodFocus: React.FC<CurrentPeriodFocusProps> = ({
    item,
    globalThresholds,
    year,
    onUpdateItem,
    canEdit,
    onClose,
    allDashboardItems = [],
    decimalPrecision = 0,
    dashboardId,
    clientId
}) => {
    // 🛡️ ACTIVE SHIELD: Blindaje contra ítems malformados
    const [localGoal, setLocalGoal] = useState<string>('');
    const [localActual, setLocalActual] = useState<string>('');
    const [localNote, setLocalNote] = useState<string>('');
    const [isSaving, setIsSaving] = useState(false);
    const [isFullEditMode, setIsFullEditMode] = useState(false);
    const [isActivityManagerOpen, setIsActivityManagerOpen] = useState(false);
    const [activityTab, setActivityTab] = useState<'current' | 'pending'>('current');
    const [managedPending, setManagedPending] = useState<PendingKpiActivity | null>(null);
    const [pendingAction, setPendingAction] = useState<'idle' | 'complete' | 'discard' | 'reschedule'>('idle');
    const [rescheduleTarget, setRescheduleTarget] = useState<number>(0);
    const [pendingNote, setPendingNote] = useState('');
    const [pendingSaving, setPendingSaving] = useState(false);
    const [pendingError, setPendingError] = useState('');
    const [pendingFeedback, setPendingFeedback] = useState('');
    const [activityMode, setActivityMode] = useState(item.isActivityMode || false);
    const [isGoalFocused, setIsGoalFocused] = useState(false);
    const [isActualFocused, setIsActualFocused] = useState(false);

    const { indicator, unit, monthlyProgress = [], monthlyGoals = [], monthlyNotes = [], frequency, weeklyProgress = [], weeklyGoals = [], weeklyNotes = [], weekStart, type } = item || { 
        indicator: '', unit: '', monthlyProgress: [], monthlyGoals: [], monthlyNotes: [], frequency: 'monthly', weeklyProgress: [], weeklyGoals: [], weeklyNotes: [], weekStart: 'Mon', type: 'simple'
    };

    // 🛡️ NAVEGACIÓN DE PERIODOS (v7.9.0-INTEGRITY)
    const [activePeriodIdx, setActivePeriodIdx] = useState<number>(-1);

    const isWeekly = frequency === 'weekly';
    const currentYear = new Date().getFullYear();
    const currentMonthIdx = new Date().getMonth();
    const isPastYear = year && year < currentYear;

    const { periodIdx, periodLabel, detailedRange } = useMemo(() => {
        if (!item) return { periodIdx: 0, periodLabel: '', detailedRange: '' };
        const startDayNumeric = weekStart === 'Sun' ? 0 : 1;
        const mapping = getYearWeekMapping(year || currentYear, startDayNumeric);

        if (isWeekly) {
            const week = getWeekNumber(new Date(), startDayNumeric);
            const idx = isPastYear ? 51 : Math.max(0, Math.min(52, week - 1));
            const range = mapping[idx];
            const rangeStr = range ?
                `${range.startDate.toLocaleDateString('es', { day: '2-digit' })} al ${range.endDate.toLocaleDateString('es', { day: '2-digit', month: 'long' })}` :
                "";
            return { periodIdx: idx, periodLabel: `Semana ${idx + 1}`, detailedRange: rangeStr };
        } else {
            const lastWithData = findLastIndexWithData(monthlyProgress, monthlyGoals);
            const idx = isPastYear ? 11 : (lastWithData >= 0 ? lastWithData : Math.max(0, currentMonthIdx - 1));
            const monthNames = ["Enero", "Febrero", "Marzo", "Abril", " Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
            return { periodIdx: idx, periodLabel: monthNames[idx], detailedRange: "" };
        }
    }, [isWeekly, isPastYear, monthlyProgress, monthlyGoals, weekStart, year, currentYear, currentMonthIdx, item]);

    // 🛡️ Sincronización inicial del periodo activo
    useEffect(() => {
        if (activePeriodIdx === -1) {
            setActivePeriodIdx(periodIdx);
        }
    }, [periodIdx]);

    // Usar activePeriodIdx para todo lo visual
    const currentIdx = activePeriodIdx === -1 ? periodIdx : activePeriodIdx;
    const pendingKpiActivities = useMemo(() => derivePendingKpiActivities(item?.activityConfig, currentIdx, isWeekly, year || currentYear), [item?.activityConfig, currentIdx, isWeekly, year, currentYear]);
    const rescheduledCommitments = useMemo(() => deriveRescheduledKpiCommitments(item?.activityConfig, currentIdx, isWeekly, year || currentYear), [item?.activityConfig, currentIdx, isWeekly, year, currentYear]);

    useEffect(() => { if (pendingAction === 'reschedule') setRescheduleTarget(currentIdx); }, [pendingAction, currentIdx]);

    const resolvePendingActivity = async (pending: PendingKpiActivity, status: 'completed_later' | 'discarded', note = '') => {
        if (status === 'discarded' && !note.trim()) return;
        setPendingSaving(true); setPendingError('');
        const config = { ...(item.activityConfig || {}) };
        const source = [...(config[pending.periodIndex] || [])];
        const index = source.findIndex(a => a.id === pending.sourceActivityId);
        if (index < 0) { setPendingSaving(false); return; }
        source[index] = { ...source[index], resolution: { resolutionStatus: status, resolvedAt: new Date().toISOString(), resolvedYear: year || currentYear, resolvedPeriodType: isWeekly ? 'weekly' : 'monthly', resolvedPeriodIndex: currentIdx, ...(status === 'discarded' ? { resolutionNote: note.trim() } : {}) } };
        try { await onUpdateItem({ ...item, activityConfig: { ...config, [pending.periodIndex]: source } }); }
        catch { setPendingError('No se pudo guardar la resolución.'); setPendingSaving(false); return; }
        setPendingSaving(false); setManagedPending(null); setPendingAction('idle'); setPendingNote(''); setPendingFeedback(status === 'discarded' ? 'Actividad descartada' : 'Actividad completada');
    };

    const reschedulePendingActivity = async (pending: PendingKpiActivity) => {
        if (rescheduleTarget < currentIdx) return;
        setPendingSaving(true); setPendingError('');
        const config = applyOperationalReschedule(item.activityConfig, pending.periodIndex, pending.sourceActivityId, rescheduleTarget, isWeekly, year || currentYear);
        try { await onUpdateItem({ ...item, activityConfig: config }); }
        catch { setPendingError('No se pudo guardar la reprogramación.'); setPendingSaving(false); return; }
        setPendingSaving(false); setManagedPending(null); setPendingAction('idle');
    };

    const currentPeriodLabel = useMemo(() => {
        if (isWeekly) return `Semana ${currentIdx + 1}`;
        const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
        return monthNames[currentIdx];
    }, [isWeekly, currentIdx]);

    const virtualItem = useMemo(() => {
        if (!item) return null;
        const v = { ...item };
        const gVal = localGoal === '' ? 0 : parseFloat(localGoal);
        const aVal = localActual === '' ? 0 : parseFloat(localActual);

        if (isWeekly) {
            v.weeklyGoals = [...(item.weeklyGoals || Array(53).fill(null))];
            v.weeklyGoals[currentIdx] = gVal;
            v.weeklyProgress = [...(item.weeklyProgress || Array(53).fill(null))];
            v.weeklyProgress[currentIdx] = aVal;
        } else {
            v.monthlyGoals = [...(item.monthlyGoals || Array(12).fill(0))];
            v.monthlyGoals[currentIdx] = gVal;
            v.monthlyProgress = [...(item.monthlyProgress || Array(12).fill(0))];
            v.monthlyProgress[currentIdx] = aVal;
        }
        return v;
    }, [item, localGoal, localActual, isWeekly, currentIdx]);

    const compliance = useMemo(() => {
        if (!virtualItem) return { currentProgress: 0, currentTarget: 0, overallPercentage: 0, complianceStatus: 'Neutral' };
        return calculateCompliance(virtualItem, globalThresholds, year, 'realTime', allDashboardItems);
    }, [virtualItem, globalThresholds, year, allDashboardItems]);

    useEffect(() => {
        if (!item) return;
        const isCalculatedItem = item.indicatorType === 'formula' || item.indicatorType === 'compound';
        
        let goal: any = null;
        let actual: any = null;

        if (isCalculatedItem && allDashboardItems.length > 0) {
            const { monthlyProgress: mP, monthlyGoals: mG } = resolveItemValues(item, allDashboardItems, year);
            goal = mG[currentIdx];
            actual = mP[currentIdx];
        } else {
            goal = isWeekly ? item.weeklyGoals?.[currentIdx] : item.monthlyGoals?.[currentIdx];
            actual = isWeekly ? item.weeklyProgress?.[currentIdx] : item.monthlyProgress?.[currentIdx];
        }

        const note = (isWeekly ? item.weeklyNotes?.[currentIdx] : item.monthlyNotes?.[currentIdx]) || '';

        const strGoal = goal !== null && goal !== undefined ? goal.toString() : '';
        const strActual = actual !== null && actual !== undefined ? actual.toString() : '';
        
        if (strGoal !== localGoal || strActual !== localActual || note !== localNote) {
            setLocalGoal(strGoal);
            setLocalActual(strActual);
            setLocalNote(note);
        }
        
        if (item.isActivityMode !== undefined) {
          setActivityMode(item.isActivityMode);
        }
    }, [item, currentIdx, isWeekly, allDashboardItems, year]);

    const chartData = useMemo(() => {
        if (!item) return { progress: [], goals: [] };
        const isCalculatedItem = item.indicatorType === 'formula' || item.indicatorType === 'compound';

        let resolvedP = monthlyProgress;
        let resolvedG = monthlyGoals;

        if (isCalculatedItem && allDashboardItems.length > 0) {
            const res = resolveItemValues(item, allDashboardItems, year);
            resolvedP = res.monthlyProgress;
            resolvedG = res.monthlyGoals;
        }

        let limitIdx = -1;
        if (isPastYear) {
            limitIdx = isWeekly ? 52 : 11;
        } else if (year === currentYear) {
            const idxNow = isWeekly 
                ? getWeekNumber(new Date(), weekStart === 'Sun' ? 0 : 1) - 1 
                : new Date().getMonth();
            limitIdx = Math.max(idxNow - 1, currentIdx);
        }

        if (isWeekly) {
            const prog = (weeklyProgress || []).slice(0, limitIdx + 1);
            const goals = (weeklyGoals || []).slice(0, limitIdx + 1);
            return { progress: prog.map(v => (v !== null && v !== undefined) ? v : null), goals: goals.map(v => (v !== null && v !== undefined) ? v : null) };
        } else {
            const prog = (resolvedP || []).slice(0, limitIdx + 1);
            const goals = (resolvedG || []).slice(0, limitIdx + 1);
            return { progress: prog.map(v => (v !== null && v !== undefined) ? v : null), goals: goals.map(v => (v !== null && v !== undefined) ? v : null) };
        }
    }, [monthlyProgress, monthlyGoals, weeklyProgress, weeklyGoals, isWeekly, year, currentYear, isPastYear, currentIdx, item, weekStart]);

    const handleQuickSave = async () => {
        if (!canEdit || !item) return;
        setIsSaving(true);
        try {
            const newGoalVal = parseFormattedNumber(localGoal);
            const newActualVal = parseFormattedNumber(localActual);
            const updatedItem = {
                ...item,
                isActivityMode: activityMode,
                activityConfig: item.activityConfig || {}
            };
            if (isWeekly) {
                const newGoals = [...(weeklyGoals || Array(53).fill(null))];
                const newProgress = [...(weeklyProgress || Array(53).fill(null))];
                const newNotes = [...(weeklyNotes || Array(53).fill(""))];
                newGoals[currentIdx] = newGoalVal;
                newProgress[currentIdx] = newActualVal;
                newNotes[currentIdx] = localNote;
                updatedItem.weeklyGoals = newGoals;
                updatedItem.weeklyProgress = newProgress;
                updatedItem.weeklyNotes = newNotes;
            } else {
                const newGoals = [...monthlyGoals];
                const newProgress = [...monthlyProgress];
                const newNotes = [...(monthlyNotes || Array(12).fill(""))];
                newGoals[currentIdx] = newGoalVal;
                newProgress[currentIdx] = newActualVal;
                newNotes[currentIdx] = localNote;
                updatedItem.monthlyGoals = newGoals;
                updatedItem.monthlyProgress = newProgress;
                updatedItem.monthlyNotes = newNotes;
            }
            await onUpdateItem(updatedItem);
            onClose();
        } catch (err) {
            console.error("Error al guardar periodo:", err);
        } finally {
            setIsSaving(false);
        }
    };

    const formatNumber = (num: number) => {
        return formatNumberWithCommas(num, decimalPrecision);
    };

    useEffect(() => {
        const el = document.getElementById('gestion-detallada-focus');
        const container = el?.closest('.overflow-y-auto') || el?.parentElement;
        if (el && container && container !== document.body && container !== document.documentElement) {
            container.scrollTop = 0;
        }
    }, [item.id]);

    if (!item) return null;

    const isCalculated = item.indicatorType === 'formula' || item.indicatorType === 'compound';
    const effectiveCanEdit = canEdit && !isCalculated;
    const gap = (parseFormattedNumber(localActual) || 0) - (parseFormattedNumber(localGoal) || 0);
    const isPositiveGap = item.goalType === 'minimize' ? gap <= 0 : gap >= 0;

    const handlePrevPeriod = () => {
        const min = 0;
        setActivePeriodIdx(prev => Math.max(min, (prev === -1 ? periodIdx : prev) - 1));
    };

    const handleNextPeriod = () => {
        const max = isWeekly ? 52 : 11;
        setActivePeriodIdx(prev => Math.min(max, (prev === -1 ? periodIdx : prev) + 1));
    };

    return (
        <div id="gestion-detallada-focus" className="relative bg-slate-900/40 backdrop-blur-3xl border border-cyan-500/40 rounded-[2.5rem] p-4 md:p-6 animate-in zoom-in-95 duration-500 z-10 scroll-mt-24">
            <div className="sticky top-16 z-30 bg-slate-950/95 backdrop-blur-md p-4 rounded-3xl border border-slate-800 shadow-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
                <div className="flex-1 w-full">
                    <div className="flex flex-wrap items-center gap-3 mb-4">
                        {/* Period Selector UX001 Compliant */}
                        <div className="flex items-center bg-slate-950/80 rounded-2xl border border-white/5 p-1">
                            <button 
                                onClick={handlePrevPeriod}
                                className="w-11 h-11 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-all active:scale-90"
                                aria-label="Periodo anterior"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 0 010 1.414L9.414 10l3.293 3.293a1 0 01-1.414 1.414l-4-4a1 0 010-1.414l4-4a1 0 011.414 0z" clipRule="evenodd" /></svg>
                            </button>
                            
                            <div className="px-6 flex flex-col items-center min-w-[140px]">
                                <span className="text-[7px] font-black text-cyan-500 uppercase tracking-[0.2em] mb-0.5">Periodo Consultado</span>
                                <span className="text-xs font-black text-white uppercase tracking-widest">{currentPeriodLabel}</span>
                            </div>

                            <button 
                                onClick={handleNextPeriod}
                                className="w-11 h-11 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-all active:scale-90"
                                aria-label="Siguiente periodo"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 0 010-1.414L10.586 10 7.293 6.707a1 0 011.414-1.414l4 4a1 0 010 1.414l-4 4a1 0 01-1.414 0z" clipRule="evenodd" /></svg>
                            </button>
                        </div>

                        {currentIdx !== periodIdx && (
                            <button 
                                onClick={() => setActivePeriodIdx(periodIdx)}
                                className="px-3 py-1.5 bg-rose-500/10 border border-rose-500/20 rounded-full text-[8px] font-black text-rose-400 uppercase tracking-widest hover:bg-rose-500/20 transition-all"
                            >
                                Reestablecer Actual
                            </button>
                        )}

                        <div className="flex-grow" />

                        {frequency === 'weekly' && (<span className="px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-[9px] font-black text-indigo-400 uppercase tracking-widest">Semanal</span>)}
                        {!canEdit && (
                            <span className="px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full text-[9px] font-black text-amber-500 uppercase tracking-widest">Solo Lectura</span>
                        )}
                    </div>
                    
                    <div className="flex items-center gap-4">
                        <div className="w-1 bg-cyan-500 self-stretch rounded-full" />
                        <h2 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tighter italic leading-none">{indicator}</h2>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {/* 🛡️ MASTER TOGGLE: MODO ACTIVIDADES */}
                    <button
                        onClick={() => setActivityMode(!activityMode)}
                        className={`px-4 py-4 rounded-2xl border transition-all flex items-center gap-2 group ${activityMode ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-400' : 'bg-slate-800/40 border-white/5 text-slate-500 hover:text-slate-300'}`}
                        title="Activar/Desactivar el Gestor de Actividades para este indicador"
                    >
                        <span className="text-sm">{activityMode ? '✅' : '☐'}</span>
                        <span className="text-[10px] font-black uppercase tracking-widest leading-none">Modo Actividades</span>
                    </button>



                    <button
                        onClick={() => setIsFullEditMode(true)}
                        className="px-6 py-4 bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-cyan-500/20 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
                        title="Ver todos los meses del año para este indicador"
                    >
                        <span>📅</span>
                        VISTA ANUAL
                    </button>

                    {effectiveCanEdit && (
                        <button
                            onClick={handleQuickSave}
                            disabled={isSaving}
                            className={`
                                group relative flex items-center gap-3 px-8 py-4 rounded-2xl transition-all duration-300 font-black uppercase tracking-widest text-[10px]
                                ${isSaving 
                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' 
                                    : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 hover:scale-105 active:scale-95'}
                            `}
                        >
                            {isSaving ? (
                                <>
                                    <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                    Guardado
                                </>
                            ) : 'Guardar Cambios'}
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        className="px-6 h-12 flex items-center justify-center bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-400 hover:bg-rose-500 hover:text-white transition-all active:scale-90 font-black uppercase tracking-widest text-[10px] gap-2"
                        title="Cerrar gestión detallada"
                    >
                        <span>✕</span>
                        CERRAR
                    </button>
                </div>
            </div>

            {isFullEditMode ? (
                <div className="animate-in fade-in slide-in-from-top-4">
                    <DataEditor
                        item={item}
                        allDashboardItems={allDashboardItems}
                        year={year}
                        canEdit={canEdit}
                        onCancel={() => setIsFullEditMode(false)}
                        onSave={async (data, autoSave) => {
                            const updated = { ...item, ...data };
                            await onUpdateItem(updated);
                            if (!autoSave) {
                                setIsFullEditMode(false);
                                onClose();
                            }
                        }}
                    />
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 mb-3">
                        <div className="lg:col-span-6 flex flex-col gap-3">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className={`bg-slate-950/40 border border-white/5 rounded-2xl p-3 transition-all ${canEdit && !activityMode ? 'focus-within:border-cyan-500/50' : 'opacity-80 grayscale-[0.5]'}`}>
                                    <div className="flex justify-between items-center mb-1.5">
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Meta del Periodo ({unit})</span>
                                        <span className="text-[10px] font-black text-cyan-400 tabular-nums">{localGoal !== '' ? formatIndicatorValue(parseFormattedNumber(localGoal), unit, 0, item.indicatorType === 'formula') : 'SIN DATOS'}</span>
                                    </div>
                                    <input
                                        type="text"
                                        inputMode="decimal"
                                        value={isGoalFocused ? localGoal : (localGoal !== '' ? formatIndicatorValue(parseFormattedNumber(localGoal), unit, 0, item.indicatorType === 'formula') : '')}
                                        onFocus={() => setIsGoalFocused(true)}
                                        onBlur={() => setIsGoalFocused(false)}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setLocalGoal(val);
                                        }}
                                        id="goal-input"
                                        disabled={!effectiveCanEdit || activityMode}
                                        className="w-full bg-transparent text-2xl font-black text-white tabular-nums outline-none disabled:opacity-50"
                                        placeholder="0.00"
                                    />
                                     {activityMode && <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest mt-1 block">Cálculo Automático (Elementos)</span>}
                                     {isCalculated && <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest mt-1 block">⚡ MODO: AUTOMÁTICO — CALCULADO DESDE INDICADORES FUENTE</span>}
                                </div>
                                <div className={`bg-slate-950/40 border border-white/5 rounded-2xl p-3 transition-all ${effectiveCanEdit && !activityMode ? 'focus-within:border-emerald-500/50' : 'opacity-80 grayscale-[0.5]'}`}>
                                    <div className="flex justify-between items-center mb-1.5">
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Real del Periodo ({unit})</span>
                                        <span className="text-[10px] font-black text-emerald-400 tabular-nums">{localActual !== '' ? formatIndicatorValue(parseFormattedNumber(localActual), unit, 0, item.indicatorType === 'formula') : 'SIN DATOS'}</span>
                                    </div>
                                    <input
                                        type="text"
                                        inputMode="decimal"
                                        value={isActualFocused ? localActual : (localActual !== '' ? formatIndicatorValue(parseFormattedNumber(localActual), unit, 0, item.indicatorType === 'formula') : '')}
                                        onFocus={() => setIsActualFocused(true)}
                                        onBlur={() => setIsActualFocused(false)}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setLocalActual(val);
                                        }}
                                        id="actual-input"
                                        disabled={!effectiveCanEdit || activityMode}
                                        className="w-full bg-transparent text-2xl font-black text-white tabular-nums outline-none disabled:cursor-not-allowed"
                                        placeholder="0.00"
                                    />
                                     {activityMode && <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest mt-1 block">Sincronizado con Elementos</span>}
                                     {isCalculated && <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest mt-1 block">⚡ MODO: AUTOMÁTICO</span>}
                                </div>
                            </div>

                            {activityTab === 'current' && <RescheduledCommitmentsSection commitments={rescheduledCommitments} onManage={c => { const found = pendingKpiActivities.find(p => p.id === c.id); if (found) { setManagedPending(found); setActivityTab('pending'); setPendingAction('idle'); } }} />}

                            {activityMode && (<div className="space-y-2"><div className="flex gap-1 rounded-xl border border-indigo-500/20 bg-slate-950/50 p-1"><button onClick={() => setActivityTab('current')} className={`flex-1 rounded-lg px-3 py-2 text-[9px] font-black uppercase tracking-widest ${activityTab === 'current' ? 'bg-indigo-600/40 text-indigo-200' : 'text-slate-500'}`}>Período actual</button><button onClick={() => setActivityTab('pending')} className={`flex-1 rounded-lg px-3 py-2 text-[9px] font-black uppercase tracking-widest ${activityTab === 'pending' ? 'bg-amber-500/30 text-amber-200' : 'text-slate-500'}`}>Pendientes {pendingKpiActivities.length > 0 ? `(${pendingKpiActivities.length})` : ''}</button></div>{activityTab === 'current' ? <button
                                    onClick={() => setIsActivityManagerOpen(true)}
                                    className="w-full py-3 bg-gradient-to-r from-indigo-600/20 to-purple-600/20 border border-indigo-500/40 rounded-xl flex items-center justify-between px-6 hover:from-indigo-600/30 hover:to-purple-600/30 transition-all border-dashed"
                                >
                                    <div className="flex flex-col items-start">
                                         <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest leading-none mb-1">Elementos de este periodo</span>
                                        <span className="text-lg font-bold text-white">Gestión Detallada</span>
                                    </div>
                                    <span className="text-xl">📝</span>
                                </button> : <div className="rounded-xl border border-amber-500/20 bg-slate-950/40 p-3">{pendingKpiActivities.length === 0 ? <p className="text-center text-[10px] font-black uppercase tracking-widest text-slate-500">No hay actividades pendientes</p> : <div className="space-y-2">{pendingKpiActivities.map(activity => <React.Fragment key={activity.id}><div onClick={() => canEdit && (setManagedPending(activity), setPendingAction('idle'), setPendingError(''))} className="flex cursor-pointer items-center justify-between gap-3 border-b border-white/5 pb-2 last:border-0 last:pb-0" role="button" tabIndex={0}><span className="truncate text-xs text-slate-200">{activity.label} <span className="ml-2 rounded border border-amber-500/30 px-2 py-1 text-[9px] text-amber-300">GESTIONAR</span></span><span className="shrink-0 text-[10px] font-black uppercase text-slate-400">{activity.periodLabel} · <span className={activity.status === 'ATRASADA' ? 'text-rose-400' : activity.status === 'ATENCIÓN' ? 'text-amber-300' : 'text-slate-400'}>{activity.status}</span></span></div>{managedPending?.id === activity.id && <div className="mb-2 rounded-xl border border-cyan-500/30 bg-slate-900 p-3"><p className="text-xs font-bold text-white">{activity.label}</p><p className="text-[10px] text-slate-400">ORIGEN · {activity.periodLabel}</p>{pendingAction === 'idle' && <div className="mt-2 flex gap-2"><button onClick={() => setPendingAction('complete')} className="rounded bg-emerald-600 px-2 py-2 text-[9px] font-black text-white">✓ COMPLETAR AHORA</button><button onClick={() => setPendingAction('reschedule')} className="rounded bg-cyan-600 px-2 py-2 text-[9px] font-black text-white">→ REPROGRAMAR</button><button onClick={() => setPendingAction('discard')} className="rounded bg-rose-600 px-2 py-2 text-[9px] font-black text-white">× DESCARTAR</button><button onClick={() => setManagedPending(null)} className="rounded bg-slate-700 px-2 py-2 text-[9px] font-black text-white">CANCELAR</button></div>}{pendingAction === 'reschedule' && <div className="mt-2"><p className="text-xs font-bold text-white">REPROGRAMAR ACTIVIDAD</p><select value={rescheduleTarget} onChange={e => setRescheduleTarget(Number(e.target.value))} className="mt-2 w-full rounded bg-slate-950 p-2 text-xs text-white">{Array.from({ length: (isWeekly ? 53 : 12) - currentIdx }, (_, i) => currentIdx + i).map(idx => <option key={idx} value={idx}>{isWeekly ? `Semana ${idx + 1}` : ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][idx]}</option>)}</select><button disabled={pendingSaving} onClick={() => void reschedulePendingActivity(activity)} className="mr-2 mt-2 rounded bg-cyan-600 px-2 py-2 text-[9px] font-black text-white">{pendingSaving ? 'Guardando...' : 'CONFIRMAR REPROGRAMACIÓN'}</button><button onClick={() => setPendingAction('idle')} className="mt-2 rounded bg-slate-700 px-2 py-2 text-[9px] font-black text-white">CANCELAR</button></div>}{pendingAction === 'complete' && <div className="mt-2"><p className="text-xs text-white">¿Confirmar como completada en el período actual?</p><button disabled={pendingSaving} onClick={() => void resolvePendingActivity(activity, 'completed_later')} className="mr-2 mt-2 rounded bg-emerald-600 px-2 py-2 text-[9px] font-black text-white">{pendingSaving ? 'Guardando...' : 'CONFIRMAR'}</button><button onClick={() => setPendingAction('idle')} className="mt-2 rounded bg-slate-700 px-2 py-2 text-[9px] font-black text-white">CANCELAR</button></div>}{pendingAction === 'discard' && <div className="mt-2"><label className="text-[9px] font-black text-slate-300">MOTIVO DEL DESCARTE<textarea value={pendingNote} onChange={e => setPendingNote(e.target.value)} className="mt-1 w-full rounded bg-slate-950 p-2 text-xs text-white" /></label><button disabled={pendingSaving || !pendingNote.trim()} onClick={() => void resolvePendingActivity(activity, 'discarded', pendingNote)} className="mr-2 mt-2 rounded bg-rose-600 px-2 py-2 text-[9px] font-black text-white">{pendingSaving ? 'Guardando...' : 'CONFIRMAR DESCARTE'}</button><button onClick={() => setPendingAction('idle')} className="mt-2 rounded bg-slate-700 px-2 py-2 text-[9px] font-black text-white">CANCELAR</button></div>}{pendingError && <p className="mt-2 text-[10px] text-rose-300">{pendingError}</p>}</div>}</React.Fragment>)}</div>}</div>}</div>)}

                            <div className={`bg-slate-950/40 border border-white/5 rounded-2xl p-3 ${(!canEdit || isCalculated) && 'opacity-80'}`}>
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Observaciones</span>
                                <textarea
                                    value={localNote}
                                    onChange={(e) => setLocalNote(e.target.value)}
                                    disabled={!canEdit || isCalculated}
                                    className="w-full bg-transparent text-slate-300 text-sm italic outline-none min-h-[40px] resize-none disabled:cursor-not-allowed"
                                    placeholder={isCalculated ? "Observaciones derivadas automáticamente." : (canEdit ? "Observaciones del periodo..." : "Sin comentarios.")}
                                />
                            </div>

                            {effectiveCanEdit && (
                                <button
                                    onClick={handleQuickSave}
                                    disabled={isSaving}
                                    className={`w-full py-3 rounded-xl font-black uppercase tracking-[0.2em] text-[10px] transition-all ${isSaving ? 'bg-emerald-600 text-white' : 'bg-cyan-600 hover:bg-cyan-500 text-white hover:scale-[1.01]'}`}
                                >
                                    {isSaving ? '✓ CAMBIOS GUARDADOS' : `💾 GUARDAR ${isWeekly ? 'SEMANA' : 'MES'}`}
                                </button>
                            )}
                        </div>
                        
                        {/* RIGHT COLUMN: Visuals (Chart & Compliance) */}
                        <div className="lg:col-span-6 flex flex-col gap-3">
                            <div className="bg-slate-950/60 border border-cyan-500/20 rounded-2xl p-4 flex items-center justify-between">
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className={`w-2.5 h-2.5 rounded-full animate-pulse ${compliance.complianceStatus === 'OnTrack' ? 'bg-emerald-500' : compliance.complianceStatus === 'AtRisk' ? 'bg-amber-500' : compliance.complianceStatus === 'InProgress' ? 'bg-sky-500' : compliance.complianceStatus === 'Neutral' ? 'bg-slate-600' : 'bg-rose-500'}`} />
                                        <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest leading-none">
                                            {type === 'accumulative' ? 'CUMPLIMIENTO YTD (ACUMULADO)' : 'CUMPLIMIENTO YTD'}
                                        </span>
                                    </div>
                                    <span className={`text-4xl font-black tabular-nums tracking-tighter leading-none ${compliance.complianceStatus === 'OnTrack' ? 'text-emerald-400' : compliance.complianceStatus === 'AtRisk' ? 'text-amber-400' : compliance.complianceStatus === 'InProgress' ? 'text-sky-400' : compliance.complianceStatus === 'Neutral' ? 'text-slate-500' : 'text-rose-400'}`}>
                                        {Math.round(compliance.overallPercentage)}%
                                    </span>
                                    <span className="text-[8px] font-bold text-slate-400 mt-1 block">
                                        (Acumulado anual al periodo de corte)
                                    </span>
                                </div>
                                <div className="flex flex-col items-end">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Brecha del Periodo</span>
                                    <span className={`text-lg font-black ${isPositiveGap ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {isPositiveGap ? '▲' : '▼'} {isCalculated ? `${(Math.abs(gap) * 100).toFixed(1)} pp` : `${formatNumberWithCommas(Math.abs(gap), 0)} ${unit}`}
                                    </span>
                                    <span className="text-[8px] font-bold text-slate-500 mt-0.5">
                                        ({currentPeriodLabel})
                                    </span>
                                </div>
                            </div>
                            
                            <div className="bg-slate-950/40 rounded-2xl p-3 border border-white/5 flex-grow flex flex-col justify-center">
                                <div className="mb-2 flex items-center justify-between">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Tendencia Histórica (Línea Punteada = Meta)</span>
                                </div>
                                <LineChart
                                    progressData={chartData.progress}
                                    goalData={chartData.goals}
                                    unit={unit}
                                    type={type as any}
                                    status={compliance.complianceStatus as any}
                                    indicator={indicator}
                                    frequency={frequency}
                                />
                            </div>
                        </div>
                    </div>



                    <div className="mt-4">
                        <ActionPlan
                            initialRows={item.paiRows}
                            status={compliance.complianceStatus as any}
                            onSave={(rows) => onUpdateItem({ ...item, paiRows: rows })}
                            canEdit={canEdit}
                            year={year}
                        />
                        {dashboardId !== undefined && (
                            <RelatedActionPlans
                                indicatorId={item.id}
                                dashboardId={dashboardId}
                                clientId={clientId}
                                year={year || new Date().getFullYear()}
                                periodType={isWeekly ? 'weekly' : 'monthly'}
                                periodIndex={currentIdx}
                                canEdit={canEdit}
                            />
                        )}
                    </div>
                </>
            )}

            {isActivityManagerOpen && (
                <ActivityManager
                    title={indicator}
                    subtitle={`Periodo: ${currentPeriodLabel}`}
                    goalType={item.goalType}
                    initialActivities={Array.isArray(item.activityConfig?.[currentIdx]) ? item.activityConfig[currentIdx] as any : (item.activityConfig?.[currentIdx] ? Object.values(item.activityConfig[currentIdx]) : [])}
                    canEdit={canEdit}
                    onClose={() => setIsActivityManagerOpen(false)}
                    onSave={(updatedList) => {
                        console.log(`💾 [FOCUS] Confirmando lista de actividades: ${updatedList.length} items.`);
                        const updatedItem = { ...item };
                        updatedItem.activityConfig = { ...updatedItem.activityConfig };
                        updatedItem.activityConfig[currentIdx] = updatedList;
                        
                        // 🛡️ REGLA v7.9.5: Forzar persistencia del modo actividades
                        updatedItem.isActivityMode = true;

                        // Recalcular meta/real inmediatamente para este periodo
                        const totalT = updatedList.reduce((s: number, a: any) => s + Number(a.targetCount), 0) as number;
                        const totalC = updatedList.reduce((s: number, a: any) => s + Number(a.completedCount), 0) as number;

                        if (isWeekly) {
                            updatedItem.weeklyGoals = updatedItem.weeklyGoals ? [...updatedItem.weeklyGoals] : Array(53).fill(null);
                            updatedItem.weeklyProgress = updatedItem.weeklyProgress ? [...updatedItem.weeklyProgress] : Array(53).fill(null);
                            updatedItem.weeklyGoals[currentIdx] = totalT;
                            updatedItem.weeklyProgress[currentIdx] = totalC;
                        } else {
                            updatedItem.monthlyGoals = updatedItem.monthlyGoals ? [...updatedItem.monthlyGoals] : Array(12).fill(0);
                            updatedItem.monthlyProgress = updatedItem.monthlyProgress ? [...updatedItem.monthlyProgress] : Array(12).fill(0);
                            updatedItem.monthlyGoals[currentIdx] = totalT;
                            updatedItem.monthlyProgress[currentIdx] = totalC;
                        }

                        onUpdateItem(updatedItem);
                        setIsActivityManagerOpen(false);
                    }}
                />
            )}
        </div>
    );
};
