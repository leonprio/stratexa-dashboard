
import React from 'react';
import { DashboardItem, ComplianceStatus, ComplianceThresholds } from '../types';
import { getStatusForPercentage, calculateMonthlyCompliancePercentage } from '../utils/compliance';

interface SummaryDetailsProps {
    item: DashboardItem;
    currentProgress: number;
    currentTarget: number;
    overallCompliance: number;
    globalThresholds: ComplianceThresholds;
    year?: number;
    decimalPrecision?: 1 | 2;
}

const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const colorClasses: Record<ComplianceStatus, string> = {
    "OnTrack": 'bg-green-500',
    "AtRisk": 'bg-yellow-500',
    "OffTrack": 'bg-red-500',
    "Neutral": 'bg-slate-500',
    "InProgress": 'bg-sky-500',
};

// Helper movido adentro o recibido como prop, pero aquí lo redefinimos localmente si no se pasa formatter.
// Mejor es usar el prop decimalPrecision.

export const SummaryDetails = ({ item, currentProgress, currentTarget, overallCompliance, globalThresholds, year, decimalPrecision = 2 }: SummaryDetailsProps) => {
    const { unit, type, monthlyProgress, monthlyGoals, goalType } = item;
    const lowerIsBetter = goalType === 'minimize';

    const formatNumber = (num: number) => {
        return new Intl.NumberFormat('es-MX', {
            minimumFractionDigits: 0,
            maximumFractionDigits: decimalPrecision
        }).format(num);
    };

    const goalLabel = type === 'accumulative' ? `Meta Anual (${unit})` : `Meta Promedio (${unit})`;
    const progressLabel = type === 'accumulative' ? 'Avance Acumulado' : 'Avance Promedio';

    const summaryItems = [
        { label: 'Tipo de Meta', value: lowerIsBetter ? 'Minimizar' : 'Maximizar' },
        { label: goalLabel, value: formatNumber(currentTarget) },
        { label: progressLabel, value: `${formatNumber(currentProgress)} ${unit}` },
        { label: 'Cumplimiento General', value: `${Math.round(overallCompliance)}%`, highlight: true },
    ];

    return (
        <div className="bg-slate-900/50 p-4 rounded-lg h-full flex flex-col">
            {/* General Summary */}
            <div className="space-y-2">
                {summaryItems.map(sItem => (
                    <div key={sItem.label} className="flex justify-between items-center text-sm">
                        <span className="text-slate-400">{sItem.label}:</span>
                        <span className={`font-semibold ${sItem.highlight ? 'text-cyan-400' : 'text-slate-200'}`}>{sItem.value}</span>
                    </div>
                ))}
            </div>

            {/* Monthly Breakdown */}
            <div className="mt-4 pt-4 border-t border-slate-700/50 flex-grow">
                <h5 className="text-sm font-semibold text-slate-300 mb-3">Desglose de Cumplimiento Mensual</h5>
                <div className="space-y-3 max-h-[160px] overflow-y-auto pr-2">
                    {monthlyProgress.map((progress, index) => {
                        const goal = monthlyGoals[index];

                        // Logic to hide future months if it's the current year
                        const currentYear = new Date().getFullYear();
                        const currentMonth = new Date().getMonth();
                        if (year === currentYear && index > currentMonth) return null;
                        if (year && year > currentYear && index > 0) return null; // Future year

                        if (progress === 0 && goal === 0) return null;

                        const monthlyCompliance = calculateMonthlyCompliancePercentage(progress, goal, lowerIsBetter);
                        const safePercentage = Math.max(0, Math.min(100, monthlyCompliance));

                        // 🛡️ LÓGICA DE ESTADO NEUTRAL (v5.0.0)
                        // Si no hay avance Y el mes no ha vencido, mostrar como Neutral
                        const isExpired = year && (year < currentYear || (year === currentYear && index < currentMonth));
                        const hasProgress = progress !== 0;
                        const status = getStatusForPercentage(monthlyCompliance, globalThresholds, hasProgress || isExpired);

                        return (
                            <div key={index} className="text-xs">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="font-semibold text-slate-300">{months[index]}</span>
                                    <span className="font-mono text-slate-400">{formatNumber(progress)} / {formatNumber(goal)}</span>
                                </div>
                                <div className="w-full flex items-center gap-2">
                                    <div className="w-full bg-slate-600 rounded-full h-2 shadow-inner">
                                        <div
                                            className={`h-2 rounded-full transition-all duration-500 ease-out ${colorClasses[status]}`}
                                            style={{ width: `${safePercentage}%` }}
                                        ></div>
                                    </div>
                                    <span className="font-mono text-slate-300 w-10 text-right">{`${Math.round(monthlyCompliance)}%`}</span>
                                </div>
                                {/* Mostrar nota si existe */}
                                {item.monthlyNotes && item.monthlyNotes[index] && (
                                    <div className="mt-1 ml-1 text-[10px] text-cyan-300 italic opacity-80 border-l-2 border-cyan-500/30 pl-2">
                                        &quot;{item.monthlyNotes[index]}&quot;
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};