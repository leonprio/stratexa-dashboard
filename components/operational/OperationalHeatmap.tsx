import React, { useState, useMemo } from 'react';
import { HeatmapCell } from '../../utils/operationalControl';
import { ComplianceStatus } from '../../types';

interface OperationalHeatmapProps {
  directions: string[];
  areas: string[];
  matrix: HeatmapCell[];
}

export const OperationalHeatmap: React.FC<OperationalHeatmapProps> = React.memo(({ directions, areas, matrix }) => {
  const [hoveredCell, setHoveredCell] = useState<string | null>(null);

  // Pre-indexación en Map para optimizar a O(1)
  const cellMap = useMemo(() => {
    const map = new Map<string, HeatmapCell>();
    matrix.forEach(cell => {
      map.set(`${cell.direction}||${cell.area}`, cell);
    });
    return map;
  }, [matrix]);

  const getCellDetails = (direction: string, area: string): HeatmapCell => {
    return cellMap.get(`${direction}||${area}`) || {
      direction,
      area,
      captureRate: 100,
      stalenessDays: 0,
      missingPeriods: 0,
      kpisCount: 0,
      status: 'Neutral'
    };
  };

  const getStatusClasses = (status: ComplianceStatus): string => {
    switch (status) {
      case 'OnTrack':
        return 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20';
      case 'InProgress':
        return 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20';
      case 'AtRisk':
        return 'bg-orange-500/10 border-orange-500/30 text-orange-400 hover:bg-orange-500/20';
      case 'OffTrack':
        return 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20 animate-pulse';
      default:
        return 'bg-slate-900/40 border-white/5 text-slate-500 hover:bg-slate-800/40';
    }
  };

  return (
    <div className="glass-card rounded-[2rem] p-6 border border-white/5 shadow-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <h3 className="text-base font-black text-white uppercase tracking-wider">Matriz de Disciplina</h3>
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">
            Visualización cruzada Dirección × Área
          </span>
        </div>
        <div className="flex items-center gap-3 text-[9px] font-black uppercase tracking-wider">
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500/30 border border-emerald-500/50"></span><span className="text-slate-400">Verde (≥95%)</span></div>
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500/30 border border-amber-500/50"></span><span className="text-slate-400">Amarillo (≥85%)</span></div>
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-orange-500/30 border border-orange-500/50"></span><span className="text-slate-400">Naranja (≥70%)</span></div>
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-500/30 border border-rose-500/50"></span><span className="text-slate-400">Rojo (&lt;70% o Atrasado)</span></div>
        </div>
      </div>

      <div className="overflow-x-auto pb-4 scrollbar-hide max-w-full">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="p-3 text-left text-[9px] font-black text-slate-500 uppercase tracking-widest bg-slate-950/20 border border-white/5 rounded-tl-2xl">
                Dirección / Área
              </th>
              {areas.map(area => (
                <th
                  key={area}
                  className="p-3 text-center text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-950/20 border border-white/5 min-w-[120px]"
                >
                  {area}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {directions.map((direction, dIdx) => (
              <tr key={direction} className="hover:bg-white/5 transition-colors">
                <td className="p-3 text-[10px] font-black text-white uppercase tracking-tight bg-slate-950/10 border border-white/5 truncate max-w-[180px]">
                  {direction}
                </td>
                {areas.map(area => {
                  const cell = getCellDetails(direction, area);
                  const cellKey = `${direction}||${area}`;
                  const isHovered = hoveredCell === cellKey;

                  return (
                    <td
                      key={area}
                      className="p-1 border border-white/5 text-center relative"
                      onMouseEnter={() => setHoveredCell(cellKey)}
                      onMouseLeave={() => setHoveredCell(null)}
                    >
                      <div
                        className={`w-full h-12 flex flex-col items-center justify-center rounded-xl border transition-all duration-300 cursor-pointer ${getStatusClasses(cell.status)}`}
                      >
                        {cell.kpisCount > 0 ? (
                          <>
                            <span className="text-xs font-black tracking-tight">{cell.captureRate}%</span>
                            <span className="text-[7px] font-black uppercase opacity-65 tracking-widest mt-0.5">
                              {cell.kpisCount} {cell.kpisCount === 1 ? 'KPI' : 'KPIs'}
                            </span>
                          </>
                        ) : (
                          <span className="text-[8px] font-black tracking-widest opacity-30 uppercase">-</span>
                        )}
                      </div>

                      {/* Tooltip flotante premium */}
                      {isHovered && cell.kpisCount > 0 && (
                        <div className="absolute left-1/2 bottom-full mb-2 -translate-x-1/2 z-50 w-56 bg-slate-950/95 border border-white/10 rounded-2xl p-3 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-2 duration-200">
                          <div className="text-[8px] font-black text-cyan-400 uppercase tracking-widest mb-1.5 border-b border-white/5 pb-1">
                            Detalle de Celda
                          </div>
                          <div className="space-y-1 text-left text-[9px] font-bold text-slate-300">
                            <p className="truncate"><span className="text-slate-500">Dir:</span> {cell.direction}</p>
                            <p className="truncate"><span className="text-slate-500">Área:</span> {cell.area}</p>
                            <div className="flex justify-between mt-2 pt-1 border-t border-white/5">
                              <span>Captura:</span>
                              <span className="font-black text-white">{cell.captureRate}%</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Atraso Promedio:</span>
                              <span className="font-black text-white">{cell.stalenessDays} días</span>
                            </div>
                            <div className="flex justify-between">
                              <span>KPIs Vencidos:</span>
                              <span className="font-black text-white">{cell.missingPeriods}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
});
