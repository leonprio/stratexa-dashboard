import React, { useMemo } from 'react';
import { ComplianceStatus } from '../types';

interface LineChartProps {
  progressData: number[];
  goalData: number[];
  unit: string;
  type: 'accumulative' | 'average';
  status: ComplianceStatus;
  indicator?: string; // Optional indicator name for unique gradient IDs
  frequency?: 'monthly' | 'weekly';
}

export const LineChart = ({ progressData, goalData, unit: _unit, type, status, indicator = 'chart', frequency = 'monthly' }: LineChartProps) => {
  const isWeekly = frequency === 'weekly';
  const numPeriods = progressData.length;

  const labels = useMemo(() => {
    if (isWeekly) {
      // Labels for weeks: S1, S2, S3...
      return Array.from({ length: 53 }, (_, i) => `S${i + 1}`);
    }
    return ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
  }, [isWeekly]);

  const processLineData = (data: number[], calculationType: 'accumulative' | 'average') => {
    if (calculationType === 'accumulative') {
      return data.reduce((acc, value, i) => {
        const accumulatedValue = (acc[i - 1]?.value || 0) + value;
        acc.push({ index: i, value: accumulatedValue });
        return acc;
      }, [] as { index: number; value: number }[]);
    }
    return data.map((value, i) => ({ index: i, value }));
  };

  const plotData = useMemo(() => processLineData(progressData, type), [progressData, type]);
  const goalPlotData = useMemo(() => processLineData(goalData, type), [goalData, type]);

  if (numPeriods === 0) {
    return <div className="text-center text-slate-400 p-4 h-[220px] flex items-center justify-center glass-panel rounded-2xl">No hay datos para mostrar.</div>;
  }

  const colorClasses: Record<ComplianceStatus, { stroke: string; fill: string; area: string; glow: string }> = {
    "OnTrack": { stroke: '#10b981', fill: '#10b981', area: 'rgba(16, 185, 129, 0.15)', glow: 'rgba(16, 185, 129, 0.4)' },
    "AtRisk": { stroke: '#f59e0b', fill: '#f59e0b', area: 'rgba(245, 158, 11, 0.15)', glow: 'rgba(245, 158, 11, 0.4)' },
    "OffTrack": { stroke: '#f43f5e', fill: '#f43f5e', area: 'rgba(244, 63, 94, 0.15)', glow: 'rgba(244, 63, 94, 0.4)' },
    "Neutral": { stroke: '#64748b', fill: '#64748b', area: 'rgba(100, 116, 139, 0.15)', glow: 'rgba(100, 116, 139, 0.4)' },
    "InProgress": { stroke: '#0ea5e9', fill: '#0ea5e9', area: 'rgba(14, 165, 233, 0.15)', glow: 'rgba(14, 165, 233, 0.4)' },
  };

  const { stroke, fill, area, glow } = colorClasses[status];

  const width = 600;
  const height = 280;
  const padding = { top: 30, right: 30, bottom: 40, left: 60 };

  // 🎯 ESCALA DINÁMICA INTELIGENTE (v5.2.2 - FIX)
  // No filtramos por currentMonthIdx internamente para permitir ver años pasados completos.
  // Confiamos en los datos que vienen del padre o los mostramos todos si es acumulado.
  const validPlotData = plotData.filter(d => d.value !== null);
  const validGoalData = goalPlotData.filter(d => d.value !== null);

  const allValues = [...validPlotData.map(d => d.value), ...validGoalData.map(d => d.value)];

  // Si no hay datos, usar valores por defecto para evitar NaN
  const maxValue = allValues.length > 0 ? Math.max(...allValues, 1) : 100;
  // Para el mínimo, consideramos la meta si no hay progreso
  const minValue = allValues.length > 0 ? Math.min(...allValues.filter(v => v !== null)) : 0;

  // Rango y margen
  const range = maxValue - minValue;
  const paddingFactor = range === 0 ? 0.2 : 0.15; // 15% de margen

  const yMax = maxValue + (range * paddingFactor || maxValue * 0.1);
  const yMin = Math.max(0, minValue - (range * paddingFactor || 0));

  // 🛡️ X Domain: El dominio siempre es el año completo o el total de semanas
  const xMaxIdx = isWeekly ? (numPeriods > 12 ? 52 : numPeriods - 1) : 11;
  const xScale = (idx: number) => padding.left + (idx / xMaxIdx) * (width - padding.left - padding.right);
  const yScale = (value: number) => {
    if (yMax === yMin) return height / 2;
    const normalizedValue = (value - yMin) / (yMax - yMin);
    return height - padding.bottom - normalizedValue * (height - padding.top - padding.bottom);
  };

  // Helper for cubic-bezier path
  const createSmoothPath = (data: { index: number, value: number }[]) => {
    if (data.length === 0) return "";
    return data.reduce((path, point, i, arr) => {
      if (i === 0) return `M ${xScale(point.index)} ${yScale(point.value)}`;
      const prev = arr[i - 1];
      const cx1 = xScale(prev.index + (point.index - prev.index) / 2);
      const cy1 = yScale(prev.value);
      const cx2 = xScale(prev.index + (point.index - prev.index) / 2);
      const cy2 = yScale(point.value);
      return `${path} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${xScale(point.index)} ${yScale(point.value)}`;
    }, "");
  };

  const linePath = createSmoothPath(validPlotData);
  // La meta siempre se muestra completa si existe
  const goalLinePath = createSmoothPath(goalPlotData);

  const areaPath = linePath && validPlotData.length > 0 ? `${linePath} L ${xScale(validPlotData[validPlotData.length - 1].index)} ${yScale(yMin)} L ${xScale(validPlotData[0].index)} ${yScale(yMin)} Z` : "";
  const safeId = indicator.replace(/[^a-zA-Z0-9]/g, '_');

  const formatNumber = (num: number) => new Intl.NumberFormat('es-MX', { notation: 'compact', compactDisplay: 'short', maximumFractionDigits: 1 }).format(num);

  // 🛡️ Labels a mostrar: Para semanas, mostramos solo hitos para no saturar
  // visibleLabels was unused and conditional

  return (
    <div className="bg-slate-950/40 p-5 rounded-2xl border border-white/5 shadow-inner">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" aria-labelledby="chart-title" role="img">
        <defs>
          <linearGradient id={`${safeId}-areaGradient`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={area} />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
        </defs>

        <g className="text-white/5">
          {[0, 0.25, 0.5, 0.75, 1].map(tick => {
            const value = yMin + (yMax - yMin) * tick;
            const y = yScale(value);
            return (
              <line key={tick} x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="currentColor" strokeWidth="1" strokeDasharray="4 4" />
            )
          })}
        </g>

        <path d={goalLinePath} fill="none" stroke="#22d3ee" strokeWidth="2.5" strokeDasharray="8 6" opacity="0.85" strokeLinecap="round" />
        <path d={areaPath} fill={`url(#${safeId}-areaGradient)`} />
        <path d={linePath} fill="none" stroke={stroke} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 8px ${glow})` }} />

        {validPlotData.map((d) => (
          <g key={`point-${d.index}`} className="group/point">
            <circle
              cx={xScale(d.index)}
              cy={yScale(d.value)}
              r="3"
              fill={fill}
              className="transition-all duration-300 group-hover/point:r-6"
              style={{ filter: `drop-shadow(0 0 10px ${glow})` }}
            />
          </g>
        ))}

        <g className="text-[9px] font-black fill-slate-500 uppercase tracking-tighter">
          {isWeekly ? (
            labels.map((label, i) => {
              if (i % 4 !== 0 && i !== numPeriods - 1) return null;
              return (
                <text key={i} x={xScale(i)} y={height - 10} textAnchor="middle">{label}</text>
              );
            })
          ) : (
            labels.slice(0, 12).map((month, i) => (
              <text key={month} x={xScale(i)} y={height - 10} textAnchor="middle">{month}</text>
            ))
          )}
        </g>

        <g className="text-[9px] font-black fill-slate-600 tabular-nums">
          {[0, 0.5, 1].map(tick => {
            const val = yMin + (yMax - yMin) * tick;
            return (
              <text key={tick} x={padding.left - 10} y={yScale(val) + 4} textAnchor="end">{formatNumber(val)}</text>
            )
          })}
        </g>
      </svg>
    </div>
  );
};
