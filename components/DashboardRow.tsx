import React, { useState, useMemo } from 'react';
import { DashboardItem, DashboardRole, ComplianceThresholds } from '../types';
import { ProgressBar } from './ProgressBar';

import { LineChart } from './LineChart';
import { DataEditor } from './DataEditor';
import { ActionPlan } from './ActionPlan';
import { SummaryDetails } from './SummaryDetails';
import { calculateCompliance, findLastIndexWithData, getMissingMonthsWarning, getOverdueWarning } from '../utils/compliance';

interface DashboardRowProps {
  item: DashboardItem;
  onUpdateItem: (item: DashboardItem) => void;
  globalThresholds: ComplianceThresholds;
  userRoleForDashboard: DashboardRole | null;
  layout?: 'grid' | 'compact';
  year?: number;
  isAggregate?: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
  decimalPrecision?: 1 | 2;
  allDashboardItems?: DashboardItem[];
}

export const DashboardRow: React.FC<DashboardRowProps> = React.memo(({ item, onUpdateItem, globalThresholds, userRoleForDashboard, layout = 'grid', year, isAggregate = false, isSelected = false, onSelect, decimalPrecision = 2 as 1 | 2, allDashboardItems = [] }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // 🛡️ ACTIVE SHIELD: Blindaje contra ítems malformados
  if (!item || !item.indicator) {
    return (
      <div className="glass-card rounded-2xl p-4 border border-red-500/20 bg-red-500/5 text-red-400 text-xs italic">
        ⚠️ Registro omitido por inconsistencia en los datos
      </div>
    );
  }

  const { indicator, unit, weight, monthlyProgress, monthlyGoals, type } = item;

  const { currentProgress, currentTarget, overallPercentage, complianceStatus } = useMemo(() =>
    calculateCompliance(item, globalThresholds, year, 'realTime', allDashboardItems),
    [item, globalThresholds, year, allDashboardItems]);

  const missingDataWarning = useMemo(() => getMissingMonthsWarning(monthlyProgress, monthlyGoals), [monthlyProgress, monthlyGoals]);

  // Solo mostrar warning de vencido si estamos en el año actual
  const overdueWarning = useMemo(() => {
    const currentYear = new Date().getFullYear();
    if (year && year !== currentYear) return null;
    return getOverdueWarning(monthlyProgress, monthlyGoals);
  }, [monthlyProgress, monthlyGoals, year]);

  const chartData = useMemo(() => {
    const lastDataIndex = findLastIndexWithData(monthlyProgress, monthlyGoals);
    if (lastDataIndex === -1) {
      return { progress: [], goals: [] };
    }
    const sliceIndex = lastDataIndex + 1;
    return {
      progress: monthlyProgress.slice(0, sliceIndex),
      goals: monthlyGoals.slice(0, sliceIndex)
    };
  }, [monthlyProgress, monthlyGoals]);

  const formatNumber = useMemo(() => (num: number) => {
    return new Intl.NumberFormat('es-MX', {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimalPrecision
    }).format(num);
  }, [decimalPrecision]);

  // Handle Compact Layout Rendering
  if (layout === 'compact' && !isExpanded) {
    return (
      <div
        onClick={(e) => { e.stopPropagation(); onSelect?.(); setIsExpanded(true); }}
        className={`glass-card rounded-2xl p-5 cursor-pointer transition-all group flex items-center justify-between gap-6 shadow-xl hover:shadow-cyan-500/10 active:scale-95 border ${isSelected ? 'border-cyan-500 shadow-cyan-500/20' : 'border-white/5'}`}
      >
        <div className="flex-grow min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500/50" />
            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">KPI</span>
          </div>
          <h4 className="text-xs font-black text-white uppercase tracking-tight line-clamp-1 group-hover:text-cyan-400 transition-colors">
            {indicator}
          </h4>
        </div>

        <div className="flex items-center gap-6 flex-shrink-0">
          <div className="flex flex-col items-end">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-white tabular-nums tracking-tighter">
                {formatNumber(currentProgress)}
              </span>
              <span className="text-[8px] font-bold text-slate-600 uppercase tracking-widest leading-none">
                {unit}
              </span>
            </div>
            <span className={`text-[10px] font-black tabular-nums leading-none tracking-widest ${complianceStatus === 'OnTrack' ? 'text-emerald-400' : complianceStatus === 'AtRisk' ? 'text-amber-400' : complianceStatus === 'InProgress' ? 'text-sky-400' : complianceStatus === 'Neutral' ? 'text-slate-500' : 'text-rose-400'}`}>
              {Math.round(overallPercentage)}%
            </span>
          </div>
          <div className="relative w-5 h-5">
            <div className={`absolute inset-0 rounded-full blur-[8px] opacity-40 ${complianceStatus === 'OnTrack' ? 'bg-emerald-500' : complianceStatus === 'AtRisk' ? 'bg-amber-500' : complianceStatus === 'InProgress' ? 'bg-sky-500' : complianceStatus === 'Neutral' ? 'bg-slate-600' : 'bg-rose-500'}`} />
            <div className={`relative w-full h-full rounded-full border border-slate-950/20 ${complianceStatus === 'OnTrack' ? 'bg-emerald-500' : complianceStatus === 'AtRisk' ? 'bg-amber-500' : complianceStatus === 'InProgress' ? 'bg-sky-500' : complianceStatus === 'Neutral' ? 'bg-slate-600' : 'bg-rose-500'}`} />
          </div>
        </div>
      </div>
    );
  }

  const handleToggleExpand = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, a, input, select, textarea')) return;

    // 🚀 FOCO v2.6.0: Al hacer clic, seleccionamos. Si ya estaba expandido, contraemos.
    if (isExpanded) {
      setIsExpanded(false);
    } else {
      onSelect?.();
      setIsExpanded(true);
    }

    if (isEditing) setIsEditing(false);
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
  }

  const handleSave = (data: Partial<DashboardItem>) => {
    const updatedItem = {
      ...item,
      monthlyGoals: data.monthlyGoals || item.monthlyGoals,
      monthlyProgress: data.monthlyProgress || item.monthlyProgress,
      monthlyNotes: data.monthlyNotes || item.monthlyNotes,
      weeklyGoals: data.weeklyGoals || item.weeklyGoals,
      weeklyProgress: data.weeklyProgress || item.weeklyProgress,
      weeklyNotes: data.weeklyNotes || item.weeklyNotes,
    };
    onUpdateItem(updatedItem);
    setIsEditing(false);
  };

  const handleSavePlan = (rows: any[]) => {
    onUpdateItem({ ...item, paiRows: rows });
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const canEdit = userRoleForDashboard === DashboardRole.Editor && !isAggregate;

  return (
    <div
      className={`glass-card rounded-2xl shadow-2xl flex flex-col transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] hover:scale-[1.01] ${isExpanded ? 'md:col-span-2 xl:col-span-full ring-2 ring-cyan-500/50 bg-slate-900/60' : ''} ${isSelected ? 'ring-2 ring-cyan-500' : ''}`}
    >
      <div className="p-5 cursor-pointer flex flex-col flex-grow" onClick={handleToggleExpand}>
        <div className="flex justify-between items-start gap-3">
          <div className="flex flex-col gap-1.5 flex-1">
            <div className="flex items-center gap-3 mb-1">
              <span className="text-[10px] font-black text-cyan-500 uppercase tracking-widest leading-none bg-cyan-500/10 px-2 py-1 rounded-md border border-cyan-500/20">KPI</span>
              {item.indicatorType && item.indicatorType !== 'simple' && (
                <div className="flex items-center gap-1.5 bg-indigo-400/10 px-2 py-1 rounded-md border border-indigo-400/20">
                  <span className="text-[8px] font-black text-indigo-400 uppercase tracking-tighter">
                    {item.indicatorType === 'formula' ? 'Fórmula' : 'Agregado'}
                  </span>
                </div>
              )}
            </div>
            <h3 className="font-black text-white text-xl sm:text-2xl uppercase tracking-tight leading-[1.05] hover:text-cyan-400 transition-colors line-clamp-2">
              {indicator}
            </h3>
          </div>
          <div className="flex-shrink-0 flex items-center gap-3">
            {layout === 'compact' && isExpanded && (
              <button
                onClick={(e) => { e.stopPropagation(); setIsExpanded(false); }}
                className="bg-white/10 hover:bg-white/20 p-2.5 rounded-2xl transition-all border border-white/5"
                title="Contraer"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                </svg>
              </button>
            )}
          </div>
        </div>

        <div className="flex-grow flex flex-col justify-end mt-8">
          <div className="flex justify-between items-end gap-6">
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 uppercase font-black tracking-[0.2em] mb-2 opacity-80">Rendimiento Real</span>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl sm:text-5xl font-black text-white tabular-nums tracking-tighter drop-shadow-2xl">
                  {formatNumber(currentProgress)}
                </span>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest italic">{unit}</span>
              </div>
            </div>

            <div className="flex flex-col items-end">
              <span className="text-[10px] text-slate-500 uppercase font-black tracking-[0.2em] mb-2 opacity-80">Objetivo</span>
              <div className="flex items-baseline gap-1.5 bg-white/5 px-3 py-1.5 rounded-xl border border-white/5">
                <span className="text-xl font-black text-slate-300 tabular-nums">{formatNumber(currentTarget)}</span>
                <span className="text-[9px] font-bold text-slate-600 uppercase tracking-wider">{unit}</span>
              </div>
            </div>
          </div>

          <div className="mt-8 space-y-4">
            <ProgressBar percentage={overallPercentage} status={complianceStatus} />
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="p-4 sm:p-5 border-t border-slate-700/50 bg-slate-900/30 rounded-b-xl">
          {isEditing ? (
            <DataEditor
              item={item}
              onSave={handleSave}
              onCancel={handleCancelEdit}
              canEdit={canEdit}
            />
          ) : (
            <>
              <div className="flex justify-between items-center mb-4">
                <div className="text-xs text-slate-400">
                  Ponderación: <span className="font-bold text-slate-200">{weight}%</span>
                </div>
                {canEdit && !isAggregate && (
                  <button
                    onClick={handleEditClick}
                    className="px-4 py-2 rounded-md bg-slate-600 hover:bg-slate-500 transition-colors text-sm font-semibold"
                  >
                    Capturar Datos
                  </button>
                )}
              </div>
              {missingDataWarning && (
                <div className="bg-yellow-900/50 text-yellow-300 p-3 rounded-lg text-sm mb-4 border border-yellow-700/50 flex items-start gap-3">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5">
                    <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 15a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm-1.5-4.25a.75.75 0 0 1 1.5 0V14a.75.75 0 0 1-1.5 0v-3.25Z" clipRule="evenodd" />
                  </svg>
                  <p>{missingDataWarning}</p>
                </div>
              )}

              {overdueWarning && (
                <div className="bg-red-900/50 text-red-300 p-3 rounded-lg text-sm mb-4 border border-red-700/50 flex items-start gap-3 animate-pulse">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                  </svg>
                  <p className="font-bold">{overdueWarning}</p>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <LineChart
                  progressData={chartData.progress}
                  goalData={chartData.goals}
                  unit={unit}
                  type={type}
                  status={complianceStatus}
                  indicator={indicator}
                />
                <SummaryDetails
                  item={item}
                  currentProgress={currentProgress}
                  currentTarget={currentTarget}
                  overallCompliance={overallPercentage}
                  globalThresholds={globalThresholds}
                  year={year}
                  decimalPrecision={decimalPrecision}
                  allDashboardItems={allDashboardItems}
                />
              </div>

              {/* ACTION PROTOCOL SECTION */}
              <ActionPlan
                initialRows={item.paiRows}
                status={complianceStatus}
                onSave={handleSavePlan}
                canEdit={canEdit}
                year={year}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
});

DashboardRow.displayName = 'DashboardRow';
