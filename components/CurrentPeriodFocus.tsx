import React, { useState, useMemo, useEffect } from 'react';
import { DashboardItem, ComplianceThresholds } from '../types';
import { calculateCompliance, findLastIndexWithData } from '../utils/compliance';
import { getWeekNumber, getYearWeekMapping } from '../utils/weeklyUtils';
import { ProgressBar } from './ProgressBar';
import { LineChart } from './LineChart';
import { SummaryDetails } from './SummaryDetails';
import { ActionPlan } from './ActionPlan';
import { DataEditor } from './DataEditor';
import { ActivityManager } from './ActivityManager';

interface CurrentPeriodFocusProps {
    item: DashboardItem;
    globalThresholds: ComplianceThresholds;
    year?: number;
    onUpdateItem: (updatedItem: DashboardItem) => void;
    canEdit: boolean;
    onClose: () => void;
    allDashboardItems?: DashboardItem[];
}

export const CurrentPeriodFocus: React.FC<CurrentPeriodFocusProps> = ({
    item,
    globalThresholds,
    year,
    onUpdateItem,
    canEdit,
    onClose,
    allDashboardItems = []
}) => {
    // 🛡️ ACTIVE SHIELD: Blindaje contra ítems malformados
    if (!item) return null;

    const [localGoal, setLocalGoal] = useState<string>('');
    const [localActual, setLocalActual] = useState<string>('');
    const [localNote, setLocalNote] = useState<string>('');
    const [isSaving, setIsSaving] = useState(false);
    const [isFullEditMode, setIsFullEditMode] = useState(false);
    const [isActivityManagerOpen, setIsActivityManagerOpen] = useState(false);

    const { indicator, unit, monthlyProgress = [], monthlyGoals = [], monthlyNotes = [], frequency, weeklyProgress = [], weeklyGoals = [], weeklyNotes = [], weekStart, type } = item;

    const isWeekly = frequency === 'weekly';
    const currentYear = new Date().getFullYear();
    const currentMonthIdx = new Date().getMonth();
    const isPastYear = year && year < currentYear;

    const { periodIdx, periodLabel, detailedRange } = useMemo(() => {
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
    }, [isWeekly, isPastYear, monthlyProgress, monthlyGoals, weekStart, year, currentYear, currentMonthIdx]);

    // 🛡️ CÁLCULO EN TIEMPO REAL (v5.3.5)
    // El semáforo del modal ahora responde a lo que el usuario escribe ANTES de guardar.
    const virtualItem = useMemo(() => {
        const v = { ...item };
        const gVal = localGoal === '' ? 0 : parseFloat(localGoal);
        const aVal = localActual === '' ? 0 : parseFloat(localActual);

        if (isWeekly) {
            v.weeklyGoals = [...(item.weeklyGoals || Array(53).fill(null))];
            v.weeklyGoals[periodIdx] = gVal;
            v.weeklyProgress = [...(item.weeklyProgress || Array(53).fill(null))];
            v.weeklyProgress[periodIdx] = aVal;
        } else {
            v.monthlyGoals = [...(item.monthlyGoals || Array(12).fill(0))];
            v.monthlyGoals[periodIdx] = gVal;
            v.monthlyProgress = [...(item.monthlyProgress || Array(12).fill(0))];
            v.monthlyProgress[periodIdx] = aVal;
        }
        return v;
    }, [item, localGoal, localActual, isWeekly, periodIdx]);

    const compliance = useMemo(() => calculateCompliance(virtualItem, globalThresholds, year, 'realTime', allDashboardItems), [virtualItem, globalThresholds, year, allDashboardItems]);

    // 🛡️ REGLA v5.3.5: SINCRONIZACIÓN ESTABLE
    // Solo actualizamos el estado local si el indicador o el periodo cambian.
    // Esto evita que el typing se borre si el padre (App) re-renderiza.
    useEffect(() => {
        const goal = isWeekly ? item.weeklyGoals?.[periodIdx] : item.monthlyGoals?.[periodIdx];
        const actual = isWeekly ? item.weeklyProgress?.[periodIdx] : item.monthlyProgress?.[periodIdx];
        const note = (isWeekly ? item.weeklyNotes?.[periodIdx] : item.monthlyNotes?.[periodIdx]) || '';

        setLocalGoal(goal !== null && goal !== undefined ? goal.toString() : '');
        setLocalActual(actual !== null && actual !== undefined ? actual.toString() : '');
        setLocalNote(note);
    }, [item.id, periodIdx]); // 🔥 DEPENDE SOLO DE ID Y PERIODO

    const handleQuickSave = async () => {
        if (!canEdit) return;
        setIsSaving(true);
        const newGoalVal = localGoal === '' ? null : parseFloat(localGoal);
        const newActualVal = localActual === '' ? null : parseFloat(localActual);
        const updatedItem = { ...item };
        if (isWeekly) {
            const newGoals = [...(weeklyGoals || Array(53).fill(null))];
            const newProgress = [...(weeklyProgress || Array(53).fill(null))];
            const newNotes = [...(weeklyNotes || Array(53).fill(""))];
            newGoals[periodIdx] = newGoalVal;
            newProgress[periodIdx] = newActualVal;
            newNotes[periodIdx] = localNote;
            updatedItem.weeklyGoals = newGoals;
            updatedItem.weeklyProgress = newProgress;
            updatedItem.weeklyNotes = newNotes;
        } else {
            const newGoals = [...monthlyGoals];
            const newProgress = [...monthlyProgress];
            const newNotes = [...(monthlyNotes || Array(12).fill(""))];
            newGoals[periodIdx] = newGoalVal;
            newProgress[periodIdx] = newActualVal;
            newNotes[periodIdx] = localNote;
            updatedItem.monthlyGoals = newGoals;
            updatedItem.monthlyProgress = newProgress;
            updatedItem.monthlyNotes = newNotes;
        }
        onUpdateItem(updatedItem);
        setTimeout(() => setIsSaving(false), 800);
    };

    const formatNumber = (num: number) => {
        return new Intl.NumberFormat('es-MX', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        }).format(num);
    };

    const chartData = useMemo(() => {
        let limitIdx = -1;
        if (isPastYear) {
            limitIdx = isWeekly ? 52 : 11;
        } else if (year === currentYear) {
            limitIdx = periodIdx - 1;
        }

        if (isWeekly) {
            const prog = (weeklyProgress || []).slice(0, limitIdx + 1);
            const goals = (weeklyGoals || []).slice(0, limitIdx + 1);
            return { progress: prog.map(v => v ?? 0), goals: goals.map(v => v ?? 0) };
        } else {
            const prog = (monthlyProgress || []).slice(0, limitIdx + 1);
            const goals = (monthlyGoals || []).slice(0, limitIdx + 1);
            return { progress: prog.map(v => v ?? 0), goals: goals.map(v => v ?? 0) };
        }
    }, [monthlyProgress, monthlyGoals, weeklyProgress, weeklyGoals, isWeekly, year, currentYear, isPastYear, periodIdx]);

    const gap = (parseFloat(localActual) || 0) - (parseFloat(localGoal) || 0);
    const isPositiveGap = item.goalType === 'minimize' ? gap <= 0 : gap >= 0;

    return (
        <div className="relative bg-slate-900/60 backdrop-blur-3xl border border-cyan-500/30 rounded-[3rem] p-6 shadow-2xl animate-in zoom-in-95 duration-500">
            <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="px-3 py-0.5 bg-cyan-500/10 border border-cyan-500/20 rounded-full text-[9px] font-black text-cyan-400 uppercase tracking-widest shadow-lg">
                            FOCO ACTUAL: {periodLabel} {detailedRange && <span className="text-slate-500 ml-1">({detailedRange})</span>}
                        </span>
                        {frequency === 'weekly' && (<span className="px-3 py-0.5 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-[9px] font-black text-indigo-400 uppercase tracking-widest">Semanal</span>)}
                        {!canEdit && (
                            <span className="px-3 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded-full text-[9px] font-black text-amber-500 uppercase tracking-widest animate-pulse">VALORES AGREGADOS</span>
                        )}
                    </div>
                    <h2 className="text-3xl font-black text-white uppercase tracking-tighter italic leading-none">{indicator}</h2>
                </div>
                <div className="flex items-center gap-2">
                    {canEdit && (
                        <button
                            onClick={() => setIsFullEditMode(!isFullEditMode)}
                            className={`px-4 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest border transition-all ${isFullEditMode ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}`}
                        >
                            {isFullEditMode ? 'Ver Histórico' : 'Gestionar Metas'}
                        </button>
                    )}
                    <button onClick={onClose} className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-slate-400 transition-all active:scale-95">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
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
                        onSave={(data) => {
                            onUpdateItem({ ...item, ...data });
                            setIsFullEditMode(false);
                        }}
                    />
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-4">
                        <div className="lg:col-span-8 flex flex-col gap-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className={`bg-slate-950/40 border border-white/5 rounded-[2rem] p-4 transition-all shadow-inner ${canEdit && !item.isActivityMode ? 'focus-within:border-cyan-500/50' : 'opacity-80 grayscale-[0.5]'}`}>
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Meta ({unit})</span>
                                    <input
                                        type="number"
                                        value={localGoal}
                                        onChange={(e) => setLocalGoal(e.target.value)}
                                        disabled={!canEdit || item.isActivityMode}
                                        className="w-full bg-transparent text-4xl font-black text-white tabular-nums outline-none disabled:cursor-not-allowed"
                                        placeholder="0.00"
                                    />
                                    {item.isActivityMode && <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest mt-1 block">Cálculo Automático</span>}
                                </div>
                                <div className={`bg-slate-950/40 border border-white/5 rounded-[2rem] p-4 transition-all shadow-inner ${canEdit && !item.isActivityMode ? 'focus-within:border-emerald-500/50' : 'opacity-80 grayscale-[0.5]'}`}>
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Real ({unit})</span>
                                    <input
                                        type="number"
                                        value={localActual}
                                        onChange={(e) => setLocalActual(e.target.value)}
                                        disabled={!canEdit || item.isActivityMode}
                                        className="w-full bg-transparent text-4xl font-black text-emerald-400 tabular-nums outline-none disabled:cursor-not-allowed"
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>

                            {item.isActivityMode && (
                                <button
                                    onClick={() => setIsActivityManagerOpen(true)}
                                    className="w-full py-4 bg-gradient-to-r from-indigo-600/20 to-purple-600/20 border border-indigo-500/40 rounded-2xl flex items-center justify-between px-6 hover:from-indigo-600/30 hover:to-purple-600/30 transition-all border-dashed"
                                >
                                    <div className="flex flex-col items-start">
                                        <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest leading-none mb-1">Actividades de este periodo</span>
                                        <span className="text-lg font-bold text-white">Gestión Detallada</span>
                                    </div>
                                    <span className="text-xl">📝</span>
                                </button>
                            )}

                            <div className={`bg-slate-950/40 border border-white/5 rounded-[2rem] p-4 shadow-inner ${!canEdit && 'opacity-80'}`}>
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Observaciones</span>
                                <textarea
                                    value={localNote}
                                    onChange={(e) => setLocalNote(e.target.value)}
                                    disabled={!canEdit}
                                    className="w-full bg-transparent text-slate-300 text-base italic outline-none min-h-[60px] resize-none disabled:cursor-not-allowed"
                                    placeholder={canEdit ? "Observaciones del periodo..." : "Sin comentarios."}
                                />
                            </div>

                            {canEdit && (
                                <button
                                    onClick={handleQuickSave}
                                    disabled={isSaving}
                                    className={`w-full py-4 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] transition-all shadow-xl ${isSaving ? 'bg-emerald-600 text-white' : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-900/20 hover:scale-[1.01]'}`}
                                >
                                    {isSaving ? '✓ CAMBIOS GUARDADOS' : `💾 GUARDAR ${isWeekly ? 'SEMANA' : 'MES'}`}
                                </button>
                            )}
                        </div>
                        <div className="lg:col-span-4 flex flex-col">
                            <div className="bg-slate-950/60 border border-cyan-500/20 rounded-[2rem] p-6 flex flex-col justify-center shadow-xl h-full relative overflow-hidden">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">CUMPLIMIENTO ACTUAL</span>
                                    <div className={`w-2.5 h-2.5 rounded-full animate-pulse ${compliance.complianceStatus === 'OnTrack' ? 'bg-emerald-500' : compliance.complianceStatus === 'AtRisk' ? 'bg-amber-500' : compliance.complianceStatus === 'InProgress' ? 'bg-sky-500' : compliance.complianceStatus === 'Neutral' ? 'bg-slate-600' : 'bg-rose-500'}`} />
                                </div>
                                <div className={`text-6xl font-black tabular-nums tracking-tighter leading-none mb-3 ${compliance.complianceStatus === 'OnTrack' ? 'text-emerald-400' : compliance.complianceStatus === 'AtRisk' ? 'text-amber-400' : compliance.complianceStatus === 'InProgress' ? 'text-sky-400' : compliance.complianceStatus === 'Neutral' ? 'text-slate-500' : 'text-rose-400'}`}>
                                    {Math.round(compliance.overallPercentage)}%
                                </div>
                                <ProgressBar percentage={compliance.overallPercentage} status={compliance.complianceStatus as any} showLabel={false} />
                                <div className="mt-6 pt-4 border-t border-white/5 flex justify-between items-center text-[9px] font-black uppercase tracking-widest">
                                    <span className="text-slate-500">Brecha:</span>
                                    <span className={isPositiveGap ? 'text-emerald-400' : 'text-rose-400'}>
                                        {isPositiveGap ? '▲' : '▼'} {formatNumber(Math.abs(gap))} {unit}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mt-4">
                        <div className="bg-slate-950/40 rounded-[2.5rem] p-4 border border-white/5">
                            <div className="p-4 mb-2 flex items-center justify-between">
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">Tendencia: Periodos Vencidos (Línea Punteada = Meta)</span>
                                <span className="px-2 py-1 bg-cyan-500/10 border border-cyan-500/20 rounded text-[8px] font-black text-cyan-400 uppercase tracking-widest">AÑO {year || currentYear}</span>
                            </div>
                            <LineChart
                                progressData={chartData.progress}
                                goalData={chartData.goals}
                                unit={unit}
                                type={type}
                                status={compliance.complianceStatus}
                                indicator={indicator}
                                frequency={frequency}
                            />
                        </div>
                        <div className="bg-slate-950/40 rounded-[2.5rem] p-8 border border-white/5">
                            <SummaryDetails
                                item={item}
                                currentProgress={compliance.currentProgress}
                                currentTarget={compliance.currentTarget}
                                overallCompliance={compliance.overallPercentage}
                                globalThresholds={globalThresholds}
                                year={year}
                                allDashboardItems={allDashboardItems}
                            />
                        </div>
                    </div>

                    <div className="mt-8">
                        <ActionPlan
                            initialRows={item.paiRows}
                            status={compliance.complianceStatus}
                            onSave={(rows) => onUpdateItem({ ...item, paiRows: rows })}
                            canEdit={canEdit}
                            year={year}
                        />
                    </div>
                </>
            )}

            {isActivityManagerOpen && (
                <ActivityManager
                    periodLabel={periodLabel}
                    initialActivities={item.activityConfig?.[periodIdx] || []}
                    canEdit={canEdit}
                    onClose={() => setIsActivityManagerOpen(false)}
                    onSave={(updatedList) => {
                        const updatedItem = { ...item };
                        if (!updatedItem.activityConfig) updatedItem.activityConfig = {};
                        updatedItem.activityConfig[periodIdx] = updatedList;

                        // Recalcular meta/real inmediatamente para este periodo
                        const totalT = updatedList.reduce((s, a) => s + Number(a.targetCount), 0);
                        const totalC = updatedList.reduce((s, a) => s + Number(a.completedCount), 0);

                        if (isWeekly) {
                            if (!updatedItem.weeklyGoals) updatedItem.weeklyGoals = Array(53).fill(null);
                            if (!updatedItem.weeklyProgress) updatedItem.weeklyProgress = Array(53).fill(null);
                            updatedItem.weeklyGoals[periodIdx] = totalT;
                            updatedItem.weeklyProgress[periodIdx] = totalC;
                        } else {
                            updatedItem.monthlyGoals[periodIdx] = totalT;
                            updatedItem.monthlyProgress[periodIdx] = totalC;
                        }

                        onUpdateItem(updatedItem);
                        setIsActivityManagerOpen(false);
                    }}
                />
            )}
        </div>
    );
};
