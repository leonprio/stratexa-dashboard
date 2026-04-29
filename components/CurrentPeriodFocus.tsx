import React, { useState, useMemo, useEffect } from 'react';
import { DashboardItem, ComplianceThresholds } from '../types';
import { calculateCompliance, findLastIndexWithData } from '../utils/compliance';
import { getWeekNumber, getYearWeekMapping } from '../utils/weeklyUtils';
import { ProgressBar } from './ProgressBar';
import { LineChart } from './LineChart';
import { ActionPlan } from './ActionPlan';
import { DataEditor } from './DataEditor';
import { ActivityManager } from './ActivityManager';
import { formatNumberWithCommas, parseFormattedNumber } from '../utils/formatters';

interface CurrentPeriodFocusProps {
    item: DashboardItem;
    globalThresholds: ComplianceThresholds;
    year?: number;
    onUpdateItem: (updatedItem: DashboardItem) => void;
    canEdit: boolean;
    onClose: () => void;
    allDashboardItems?: DashboardItem[];
    decimalPrecision?: 0 | 1 | 2;
}

export const CurrentPeriodFocus: React.FC<CurrentPeriodFocusProps> = ({
    item,
    globalThresholds,
    year,
    onUpdateItem,
    canEdit,
    onClose,
    allDashboardItems = [],
    decimalPrecision = 2
}) => {
    // 🛡️ ACTIVE SHIELD: Blindaje contra ítems malformados
    const [localGoal, setLocalGoal] = useState<string>('');
    const [localActual, setLocalActual] = useState<string>('');
    const [localNote, setLocalNote] = useState<string>('');
    const [isSaving, setIsSaving] = useState(false);
    const [isFullEditMode, setIsFullEditMode] = useState(false);
    const [isActivityManagerOpen, setIsActivityManagerOpen] = useState(false);
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
        const goal = isWeekly ? item.weeklyGoals?.[currentIdx] : item.monthlyGoals?.[currentIdx];
        const actual = isWeekly ? item.weeklyProgress?.[currentIdx] : item.monthlyProgress?.[currentIdx];
        const note = (isWeekly ? item.weeklyNotes?.[currentIdx] : item.monthlyNotes?.[currentIdx]) || '';

        // Solo actualizar si los valores son realmente diferentes para no interrumpir la edición local incipiente
        const strGoal = goal !== null && goal !== undefined ? goal.toString() : '';
        const strActual = actual !== null && actual !== undefined ? actual.toString() : '';
        
        if (strGoal !== localGoal || strActual !== localActual || note !== localNote) {
            setLocalGoal(strGoal);
            setLocalActual(strActual);
            setLocalNote(note);
        }
        
        // Sincronizar el modo de actividad
        if (item.isActivityMode !== undefined) {
          setActivityMode(item.isActivityMode);
        }
    }, [item, currentIdx, isWeekly]);

    const chartData = useMemo(() => {
        if (!item) return { progress: [], goals: [] };
        let limitIdx = -1;
        if (isPastYear) {
            limitIdx = isWeekly ? 52 : 11;
        } else if (year === currentYear) {
            const idxNow = isWeekly 
                ? getWeekNumber(new Date(), weekStart === 'Sun' ? 0 : 1) - 1 
                : new Date().getMonth();
            limitIdx = Math.max(idxNow - 1, currentIdx); // Mostrar hasta el periodo que el usuario está consultando
        }

        if (isWeekly) {
            const prog = (weeklyProgress || []).slice(0, limitIdx + 1);
            const goals = (weeklyGoals || []).slice(0, limitIdx + 1);
            return { progress: prog.map(v => (v !== null && v !== undefined) ? v : null), goals: goals.map(v => (v !== null && v !== undefined) ? v : null) };
        } else {
            const prog = (monthlyProgress || []).slice(0, limitIdx + 1);
            const goals = (monthlyGoals || []).slice(0, limitIdx + 1);
            return { progress: prog.map(v => (v !== null && v !== undefined) ? v : null), goals: goals.map(v => (v !== null && v !== undefined) ? v : null) };
        }
    }, [monthlyProgress, monthlyGoals, weeklyProgress, weeklyGoals, isWeekly, year, currentYear, isPastYear, currentIdx, item, weekStart]);

    const handleQuickSave = async () => {
        if (!canEdit || !item) return;
        setIsSaving(true);
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
        onUpdateItem(updatedItem);
        setTimeout(() => setIsSaving(false), 800);
    };

    const formatNumber = (num: number) => {
        return formatNumberWithCommas(num, decimalPrecision);
    };

    if (!item) return null;

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
            <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
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

                    {canEdit && (
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
                        year={year}
                        canEdit={canEdit}
                        onCancel={() => setIsFullEditMode(false)}
                        onSave={(data, autoSave) => {
                            onUpdateItem({ ...item, ...data });
                            if (!autoSave) setIsFullEditMode(false);
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
                                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">Meta ({unit})</span>
                                        <span className="text-[10px] font-black text-cyan-400 tabular-nums">{localGoal !== '' ? formatNumberWithCommas(localGoal, decimalPrecision) : '0'}</span>
                                    </div>
                                    <input
                                        type="text"
                                        inputMode="decimal"
                                        value={isGoalFocused ? localGoal : formatNumberWithCommas(localGoal, decimalPrecision)}
                                        onFocus={() => setIsGoalFocused(true)}
                                        onBlur={() => setIsGoalFocused(false)}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setLocalGoal(val);
                                        }}
                                        id="goal-input"
                                        disabled={!canEdit || activityMode}
                                        className="w-full bg-transparent text-2xl font-black text-white tabular-nums outline-none disabled:opacity-50"
                                        placeholder="0.00"
                                    />
                                     {activityMode && <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest mt-1 block">Cálculo Automático (Elementos)</span>}
                                </div>
                                <div className={`bg-slate-950/40 border border-white/5 rounded-2xl p-3 transition-all ${canEdit && !activityMode ? 'focus-within:border-emerald-500/50' : 'opacity-80 grayscale-[0.5]'}`}>
                                    <div className="flex justify-between items-center mb-1.5">
                                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">Real ({unit})</span>
                                        <span className="text-[10px] font-black text-emerald-400 tabular-nums">{localActual !== '' ? formatNumberWithCommas(localActual, decimalPrecision) : '0'}</span>
                                    </div>
                                    <input
                                        type="text"
                                        inputMode="decimal"
                                        value={isActualFocused ? localActual : formatNumberWithCommas(localActual, decimalPrecision)}
                                        onFocus={() => setIsActualFocused(true)}
                                        onBlur={() => setIsActualFocused(false)}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setLocalActual(val);
                                        }}
                                        id="actual-input"
                                        disabled={!canEdit || activityMode}
                                        className="w-full bg-transparent text-2xl font-black text-white tabular-nums outline-none disabled:cursor-not-allowed"
                                        placeholder="0.00"
                                    />
                                     {activityMode && <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest mt-1 block">Sincronizado con Elementos</span>}
                                </div>
                            </div>

                            {activityMode && (
                                <button
                                    onClick={() => setIsActivityManagerOpen(true)}
                                    className="w-full py-3 bg-gradient-to-r from-indigo-600/20 to-purple-600/20 border border-indigo-500/40 rounded-xl flex items-center justify-between px-6 hover:from-indigo-600/30 hover:to-purple-600/30 transition-all border-dashed"
                                >
                                    <div className="flex flex-col items-start">
                                         <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest leading-none mb-1">Elementos de este periodo</span>
                                        <span className="text-lg font-bold text-white">Gestión Detallada</span>
                                    </div>
                                    <span className="text-xl">📝</span>
                                </button>
                            )}

                            <div className={`bg-slate-950/40 border border-white/5 rounded-2xl p-3 ${!canEdit && 'opacity-80'}`}>
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Observaciones</span>
                                <textarea
                                    value={localNote}
                                    onChange={(e) => setLocalNote(e.target.value)}
                                    disabled={!canEdit}
                                    className="w-full bg-transparent text-slate-300 text-sm italic outline-none min-h-[40px] resize-none disabled:cursor-not-allowed"
                                    placeholder={canEdit ? "Observaciones del periodo..." : "Sin comentarios."}
                                />
                            </div>

                            {canEdit && (
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
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">CUMPLIMIENTO</span>
                                    </div>
                                    <span className={`text-4xl font-black tabular-nums tracking-tighter leading-none ${compliance.complianceStatus === 'OnTrack' ? 'text-emerald-400' : compliance.complianceStatus === 'AtRisk' ? 'text-amber-400' : compliance.complianceStatus === 'InProgress' ? 'text-sky-400' : compliance.complianceStatus === 'Neutral' ? 'text-slate-500' : 'text-rose-400'}`}>
                                        {Math.round(compliance.overallPercentage)}%
                                    </span>
                                </div>
                                <div className="flex flex-col items-end">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Brecha Actual</span>
                                    <span className={`text-lg font-black ${isPositiveGap ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {isPositiveGap ? '▲' : '▼'} {formatNumber(Math.abs(gap))} {unit}
                                    </span>
                                </div>
                            </div>
                            
                            <div className="bg-slate-950/40 rounded-2xl p-3 border border-white/5 flex-grow flex flex-col justify-center">
                                <div className="mb-2 flex items-center justify-between">
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">Tendencia Histórica (Línea Punteada = Meta)</span>
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
