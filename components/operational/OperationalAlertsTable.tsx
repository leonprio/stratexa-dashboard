import React, { useState, useMemo } from 'react';
import { DashboardItem } from '../../types';

interface OperationalAlertsTableProps {
  items: (DashboardItem & { dashboardTitle?: string; group?: string; area?: string })[];
}

export const OperationalAlertsTable: React.FC<OperationalAlertsTableProps> = ({ items }) => {
  const [selectedDirection, setSelectedDirection] = useState<string>('TODAS');
  const [selectedArea, setSelectedArea] = useState<string>('TODAS');
  const [selectedRisk, setSelectedRisk] = useState<string>('TODOS');

  // Obtener listas únicas para los filtros
  const directions = useMemo(() => {
    const set = new Set<string>();
    items.forEach(it => {
      if (it.group) set.add(it.group.trim().toUpperCase());
    });
    return ['TODAS', ...Array.from(set).sort()];
  }, [items]);

  const areas = useMemo(() => {
    const set = new Set<string>();
    items.forEach(it => {
      if (it.area) set.add(it.area.trim().toUpperCase());
    });
    return ['TODAS', ...Array.from(set).sort()];
  }, [items]);

  const getAlertColor = (missingPeriods: number): string => {
    if (missingPeriods >= 3) return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
    if (missingPeriods === 2) return 'text-orange-400 bg-orange-500/10 border-orange-500/20';
    if (missingPeriods === 1) return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    return 'text-slate-500 bg-slate-500/10 border-slate-500/20';
  };

  const getAlertLabel = (missingPeriods: number): string => {
    if (missingPeriods >= 3) return 'Crítico (3+)';
    if (missingPeriods === 2) return 'Naranja (2)';
    if (missingPeriods === 1) return 'Amarillo (1)';
    return 'Al día';
  };

  const getRiskLevel = (missingPeriods: number, stalenessDays: number): 'Alto' | 'Medio' | 'Bajo' => {
    if (missingPeriods >= 3 || stalenessDays >= 60) return 'Alto';
    if (missingPeriods >= 1 || stalenessDays >= 15) return 'Medio';
    return 'Bajo';
  };

  const getRiskBadgeColor = (risk: 'Alto' | 'Medio' | 'Bajo'): string => {
    switch (risk) {
      case 'Alto': return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
      case 'Medio': return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
      default: return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    }
  };

  // Filtrar items atrasados o relevantes para alertas
  const alertsData = useMemo(() => {
    return items
      .map(it => {
        const metrics = it.operationalMetrics;
        const missing = metrics?.missingPeriods ?? 0;
        const staleness = metrics?.stalenessDays ?? 0;
        const risk = getRiskLevel(missing, staleness);

        return {
          ...it,
          missingPeriods: missing,
          stalenessDays: staleness,
          captureRate: metrics?.captureRate ?? 100,
          risk
        };
      })
      .filter(it => {
        // Solo mostrar KPIs que tengan al menos 1 periodo vencido o tengan atraso en captura
        if (it.missingPeriods === 0 && it.stalenessDays === 0) return false;

        const matchesDir = selectedDirection === 'TODAS' || it.group?.trim().toUpperCase() === selectedDirection;
        const matchesArea = selectedArea === 'TODAS' || it.area?.trim().toUpperCase() === selectedArea;
        const matchesRisk = selectedRisk === 'TODOS' || it.risk === selectedRisk;

        return matchesDir && matchesArea && matchesRisk;
      })
      .sort((a, b) => b.stalenessDays - a.stalenessDays || b.missingPeriods - a.missingPeriods);
  }, [items, selectedDirection, selectedArea, selectedRisk]);

  return (
    <div className="glass-card rounded-[2rem] p-6 border border-white/5 shadow-2xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col">
          <h3 className="text-base font-black text-white uppercase tracking-wider">KPIs Vencidos sin Captura</h3>
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">
            Detalle y alertas operativas de actualización
          </span>
        </div>

        {/* FILTROS INTERACTIVOS */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest px-1">Dirección</span>
            <select
              value={selectedDirection}
              onChange={e => setSelectedDirection(e.target.value)}
              className="px-3 py-2 bg-slate-950/80 border border-white/10 rounded-xl text-[10px] font-black text-slate-300 uppercase tracking-tight outline-none focus:border-cyan-500 transition-all min-h-[44px]"
            >
              {directions.map(dir => (
                <option key={dir} value={dir}>{dir === 'TODAS' ? 'TODAS LAS DIRECCIONES' : dir}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest px-1">Área</span>
            <select
              value={selectedArea}
              onChange={e => setSelectedArea(e.target.value)}
              className="px-3 py-2 bg-slate-950/80 border border-white/10 rounded-xl text-[10px] font-black text-slate-300 uppercase tracking-tight outline-none focus:border-cyan-500 transition-all min-h-[44px]"
            >
              {areas.map(area => (
                <option key={area} value={area}>{area === 'TODAS' ? 'TODAS LAS ÁREAS' : area}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest px-1">Riesgo</span>
            <select
              value={selectedRisk}
              onChange={e => setSelectedRisk(e.target.value)}
              className="px-3 py-2 bg-slate-950/80 border border-white/10 rounded-xl text-[10px] font-black text-slate-300 uppercase tracking-tight outline-none focus:border-cyan-500 transition-all min-h-[44px]"
            >
              <option value="TODOS">TODOS LOS RIESGOS</option>
              <option value="Alto">RIESGO ALTO</option>
              <option value="Medio">RIESGO MEDIO</option>
              <option value="Bajo">RIESGO BAJO</option>
            </select>
          </div>
        </div>
      </div>

      {/* TABLA PRINCIPAL */}
      <div className="overflow-x-auto pb-4 scrollbar-hide max-w-full">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-950/20">
              <th className="p-3 text-left text-[9px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5 rounded-tl-2xl">Dirección</th>
              <th className="p-3 text-left text-[9px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5">Área</th>
              <th className="p-3 text-left text-[9px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5">Indicador / KPI</th>
              <th className="p-3 text-center text-[9px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5">Vencimiento</th>
              <th className="p-3 text-center text-[9px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5">Atraso</th>
              <th className="p-3 text-center text-[9px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5">Captura</th>
              <th className="p-3 text-center text-[9px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5 rounded-tr-2xl">Riesgo</th>
            </tr>
          </thead>
          <tbody>
            {alertsData.map((item, idx) => (
              <tr
                key={`${item.id}-${idx}`}
                className="hover:bg-white/5 border-b border-white/5 transition-colors"
              >
                <td className="p-3 text-[10px] font-black text-white uppercase tracking-tight truncate max-w-[140px]">
                  {item.group || 'SIN DIRECCIÓN REGISTRADA'}
                </td>
                <td className="p-3 text-[10px] font-black text-slate-400 uppercase tracking-tight truncate max-w-[120px]">
                  {item.area || 'SIN ÁREA REGISTRADA'}
                </td>
                <td className="p-3 text-[11px] font-black text-white uppercase tracking-tight max-w-[280px]">
                  <div className="flex flex-col">
                    <span className="truncate">{item.indicator}</span>
                    <span className="text-[7px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">
                      Pond: {item.weight}% • Unid: {item.unit}
                    </span>
                  </div>
                </td>
                <td className="p-3 text-center">
                  <span className={`text-[9px] font-black px-2.5 py-1 rounded-lg border ${getAlertColor(item.missingPeriods)}`}>
                    {getAlertLabel(item.missingPeriods)}
                  </span>
                </td>
                <td className="p-3 text-center text-[11px] font-black text-white tabular-nums tracking-tighter">
                  {item.stalenessDays} días
                </td>
                <td className="p-3 text-center text-[11px] font-black text-slate-400 tabular-nums">
                  {Math.round(item.captureRate)}%
                </td>
                <td className="p-3 text-center">
                  <span className={`text-[9px] font-black px-2.5 py-1 rounded-lg border ${getRiskBadgeColor(item.risk)}`}>
                    {item.risk}
                  </span>
                </td>
              </tr>
            ))}
            {alertsData.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="p-12 text-center text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-900/10 border-b border-white/5 rounded-b-2xl"
                >
                  🎉 Excelente: No se encontraron KPIs con alertas ni atrasos operativos
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
