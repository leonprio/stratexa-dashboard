import React, { useMemo } from 'react';
import { ComplianceStatus } from '../types';
import { formatNumberWithCommas } from '../utils/formatters';

interface LineChartProps {
  progressData: (number | null)[];
  goalData: (number | null)[];
  unit: string;
  type: 'accumulative' | 'average';
  status: ComplianceStatus;
  indicator?: string; // Optional indicator name for unique gradient IDs
  frequency?: 'monthly' | 'weekly';
}

/**
 * Componente LineChart
 * 
 * Visualiza el progreso semanal o mensual frente a la meta mediante un gráfico de líneas
 * fluido con áreas de degradado Reactivas.
 * 
 * @param {LineChartProps} props - Propiedades para los datos y configuración del gráfico.
 * @returns {JSX.Element} Gráfico SVG responsivo.
 */
export const LineChart: React.FC<LineChartProps> = React.memo(({ progressData, goalData, unit: _unit, type, status, indicator = 'chart', frequency = 'monthly' }) => {
  const isWeekly = frequency === 'weekly';
  const numPeriods = progressData.length;
  const [hoveredIdx, setHoveredIdx] = React.useState<number | null>(null);

  const labels = useMemo(() => {
    if (isWeekly) {
      return Array.from({ length: 53 }, (_, i) => `S${i + 1}`);
    }
    return ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  }, [isWeekly]);

  const processLineData = (data: (number | null)[], calculationType: 'accumulative' | 'average') => {
    if (calculationType === 'accumulative') {
      return data.reduce((acc, value, i) => {
        if (value === null || value === undefined) {
          acc.push({ index: i, value: null });
        } else {
          let lastValid = 0;
          for (let prevIdx = i - 1; prevIdx >= 0; prevIdx--) {
            if (acc[prevIdx]?.value !== null) {
              lastValid = acc[prevIdx].value as number;
              break;
            }
          }
          acc.push({ index: i, value: lastValid + value });
        }
        return acc;
      }, [] as { index: number; value: number | null }[]);
    }
    return data.map((value, i) => ({ index: i, value }));
  };

  const plotData = useMemo(() => processLineData(progressData, type), [progressData, type]);
  const goalPlotData = useMemo(() => processLineData(goalData, type), [goalData, type]);

  if (numPeriods === 0) {
    return <div className="text-center text-slate-400 p-4 h-[120px] flex items-center justify-center glass-panel rounded-2xl">No hay datos para mostrar.</div>;
  }

  const colorClasses: Record<ComplianceStatus, { stroke: string; fill: string; area: string; glow: string }> = {
    "OnTrack": { stroke: '#10b981', fill: '#10b981', area: 'rgba(16, 185, 129, 0.04)', glow: 'rgba(16, 185, 129, 0.2)' },
    "AtRisk": { stroke: '#f59e0b', fill: '#f59e0b', area: 'rgba(245, 158, 11, 0.04)', glow: 'rgba(245, 158, 11, 0.2)' },
    "OffTrack": { stroke: '#f43f5e', fill: '#f43f5e', area: 'rgba(244, 63, 94, 0.04)', glow: 'rgba(244, 63, 94, 0.2)' },
    "Neutral": { stroke: '#64748b', fill: '#64748b', area: 'rgba(100, 116, 139, 0.04)', glow: 'rgba(100, 116, 139, 0.2)' },
    "InProgress": { stroke: '#0ea5e9', fill: '#0ea5e9', area: 'rgba(14, 165, 233, 0.04)', glow: 'rgba(14, 165, 233, 0.2)' },
  };

  const { stroke, fill, area, glow } = colorClasses[status];

  const validPlotData = plotData.filter(d => d.value !== null) as { index: number; value: number }[];
  const validGoalData = goalPlotData.filter(d => d.value !== null) as { index: number; value: number }[];

  const allValues = [...validPlotData.map(d => d.value), ...validGoalData.map(d => d.value)];

  const isPercentage = _unit === '%';
  const maxValue = allValues.length > 0 ? Math.max(...allValues, 1) : 100;
  const minValue = allValues.length > 0 ? Math.min(...allValues.filter(v => v !== null)) : 0;

  const range = maxValue - minValue;
  const paddingFactor = range === 0 ? 0.2 : 0.15;

  const yMax = isPercentage ? Math.max(100, Math.ceil(maxValue / 10) * 10) : maxValue + (range * paddingFactor || maxValue * 0.1);
  const yMin = isPercentage ? 0 : Math.max(0, minValue - (range * paddingFactor || 0));

  const formatNumber = (num: number) => formatNumberWithCommas(num, 0);

  // 🛡️ DYNAMIC LEFT PADDING TO PREVENT TEXT CLIPPING FOR LARGE NUMBERS
  const yTickValues = isPercentage
    ? [0, 50, 100, ...(yMax > 100 ? [yMax] : [])]
    : [0, 0.5, 1].map(tick => yMin + (yMax - yMin) * tick);
  const formattedYTicks = yTickValues.map(v => formatNumber(v));
  const maxLabelCharCount = Math.max(...formattedYTicks.map(str => str.length));
  const dynamicLeftPadding = Math.max(65, Math.min(110, maxLabelCharCount * 7.5 + 20));

  const width = 640;
  const height = 170;
  const padding = { top: 20, right: 30, bottom: 28, left: dynamicLeftPadding };

  const xMaxIdx = isWeekly ? (numPeriods > 12 ? 52 : numPeriods - 1) : 11;
  const xScale = (idx: number) => padding.left + (idx / xMaxIdx) * (width - padding.left - padding.right);
  const yScale = (value: number) => {
    if (yMax === yMin) return height / 2;
    const normalizedValue = (value - yMin) / (yMax - yMin);
    return height - padding.bottom - normalizedValue * (height - padding.top - padding.bottom);
  };

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
  const goalLinePath = createSmoothPath(goalPlotData);

  const areaPath = linePath && validPlotData.length > 0 ? `${linePath} L ${xScale(validPlotData[validPlotData.length - 1].index)} ${yScale(yMin)} L ${xScale(validPlotData[0].index)} ${yScale(yMin)} Z` : "";
  const safeId = indicator.replace(/[^a-zA-Z0-9]/g, '_');

  const activeHoveredData = useMemo(() => {
    if (hoveredIdx === null) return null;
    const realPoint = plotData.find(p => p.index === hoveredIdx);
    const goalPoint = goalPlotData.find(p => p.index === hoveredIdx);
    const realVal = realPoint?.value ?? null;
    const goalVal = goalPoint?.value ?? null;
    const gapVal = (realVal !== null && goalVal !== null) ? (realVal - goalVal) : null;

    return {
      periodLabel: labels[hoveredIdx] || `Periodo ${hoveredIdx + 1}`,
      realVal,
      goalVal,
      gapVal,
      x: xScale(hoveredIdx),
      y: realVal !== null ? yScale(realVal) : (goalVal !== null ? yScale(goalVal) : height / 2)
    };
  }, [hoveredIdx, plotData, goalPlotData, labels]);

  return (
    <div className="bg-slate-950/50 p-4 rounded-2xl border border-white/10 shadow-inner relative select-none">
      {/* Visual Legend Header */}
      <div className="flex items-center justify-between mb-2 px-1 text-[11px] font-bold text-slate-300">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-1 rounded-full inline-block" style={{ backgroundColor: stroke }} />
            <span>Real (Avance)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-0.5 border-t-2 border-dashed border-cyan-400 inline-block" />
            <span className="text-cyan-400">{isPercentage ? 'META 100%' : 'Meta (Objetivo)'}</span>
          </div>
        </div>
        {_unit && <span className="text-slate-400 font-mono text-[10px]">Unidad: {_unit}</span>}
      </div>

      <div className="relative">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" aria-labelledby="chart-title" role="img">
          <defs>
            <linearGradient id={`${safeId}-areaGradient`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={area} />
              <stop offset="100%" stopColor="transparent" />
            </linearGradient>
          </defs>

          {/* Grid lines with improved contrast */}
          <g className="text-slate-700/60">
            {yTickValues.map((value, idx) => {
              const y = yScale(value);
              return (
                <line key={idx} x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="currentColor" strokeWidth="1" strokeDasharray="4 4" strokeOpacity={0.4} />
              );
            })}
          </g>

          {/* Meta Line (Dashed) */}
          <path d={goalLinePath} fill="none" stroke="#22d3ee" strokeWidth="2.5" strokeDasharray="6 4" opacity="0.9" strokeLinecap="round" />

          {/* Progress Area Gradient */}
          <path d={areaPath} fill={`url(#${safeId}-areaGradient)`} />

          {/* Real Line (Solid) */}
          <path d={linePath} fill="none" stroke={stroke} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 4px ${glow})` }} />

          {/* Interactive Data Points */}
          {validPlotData.map((d) => {
            const isHovered = hoveredIdx === d.index;
            return (
              <g key={`point-${d.index}`} className="cursor-pointer">
                {/* Touch/Hover expansion target */}
                <circle
                  cx={xScale(d.index)}
                  cy={yScale(d.value)}
                  r="12"
                  fill="transparent"
                  onMouseEnter={() => setHoveredIdx(d.index)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  onFocus={() => setHoveredIdx(d.index)}
                  onBlur={() => setHoveredIdx(null)}
                  tabIndex={0}
                  aria-label={`Periodo ${labels[d.index]}: Real ${formatNumber(d.value)}`}
                />
                <circle
                  cx={xScale(d.index)}
                  cy={yScale(d.value)}
                  r={isHovered ? 6 : 3.5}
                  fill={fill}
                  stroke="#020617"
                  strokeWidth={isHovered ? 2 : 1}
                  className="transition-all duration-200"
                  style={{ filter: `drop-shadow(0 0 8px ${glow})` }}
                />
              </g>
            );
          })}

          {/* Hover indicator line */}
          {activeHoveredData && (
            <line
              x1={activeHoveredData.x}
              x2={activeHoveredData.x}
              y1={padding.top}
              y2={height - padding.bottom}
              stroke="rgba(255, 255, 255, 0.3)"
              strokeWidth="1.5"
              strokeDasharray="3 3"
            />
          )}

          {/* X Axis Labels - High Contrast typography */}
          <g className="text-[11px] font-bold fill-slate-300 uppercase tracking-tight">
            {isWeekly ? (
              labels.map((label, i) => {
                if (i % 4 !== 0 && i !== numPeriods - 1) return null;
                return (
                  <text key={i} x={xScale(i)} y={height - 8} textAnchor="middle">{label}</text>
                );
              })
            ) : (
              labels.slice(0, 12).map((month, i) => (
                <text key={month} x={xScale(i)} y={height - 8} textAnchor="middle">{month}</text>
              ))
            )}
          </g>

          {/* Y Axis Labels - High Contrast typography with dynamic left alignment */}
          <g className="text-[11px] font-bold fill-slate-200 tabular-nums">
            {yTickValues.map((val, idx) => {
              return (
                <text key={idx} x={padding.left - 8} y={yScale(val) + 4} textAnchor="end">{formatNumber(val)}</text>
              );
            })}
          </g>
        </svg>

        {/* Floating Tooltip for Hover / Touch / Focus */}
        {activeHoveredData && (
          <div
            className="absolute z-20 pointer-events-none bg-slate-900/95 border border-cyan-500/40 rounded-xl p-2.5 shadow-2xl backdrop-blur-md text-[11px] text-white flex flex-col gap-1 min-w-[130px] transition-all duration-150"
            style={{
              left: `${Math.min(80, Math.max(10, (activeHoveredData.x / width) * 100))}%`,
              top: '8px',
            }}
          >
            <div className="font-extrabold text-cyan-400 uppercase border-b border-white/10 pb-1 flex justify-between items-center">
              <span>{activeHoveredData.periodLabel}</span>
              {_unit && <span className="text-[9px] text-slate-400">({_unit})</span>}
            </div>
            <div className="flex justify-between items-center text-slate-200">
              <span className="font-semibold text-emerald-400">Real:</span>
              <span className="font-bold tabular-nums">{activeHoveredData.realVal !== null ? formatNumber(activeHoveredData.realVal) : 'N/D'}</span>
            </div>
            <div className="flex justify-between items-center text-slate-200">
              <span className="font-semibold text-cyan-300">Meta:</span>
              <span className="font-bold tabular-nums">{activeHoveredData.goalVal !== null ? formatNumber(activeHoveredData.goalVal) : 'N/D'}</span>
            </div>
            {activeHoveredData.gapVal !== null && (
              <div className="flex justify-between items-center pt-0.5 border-t border-white/5">
                <span className="font-semibold text-slate-400">Brecha:</span>
                <span className={`font-bold tabular-nums ${activeHoveredData.gapVal >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {activeHoveredData.gapVal >= 0 ? '+' : ''}{formatNumber(activeHoveredData.gapVal)}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});
