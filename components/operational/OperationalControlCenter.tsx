import React, { useMemo, useState } from 'react';
import { Dashboard, DashboardItem, ComplianceThresholds } from '../../types';
import {
  calculateOperationalHealth,
  buildOperationalRanking,
  buildOperationalMatrix,
  enrichDashboardsWithOperationalMetrics
} from '../../utils/operationalControl';
import { OperationalHeatmap } from './OperationalHeatmap';
import { OperationalRanking } from './OperationalRanking';
import { OperationalAlertsTable } from './OperationalAlertsTable';
import { OperationalAlertsCenter } from './OperationalAlertsCenter';
import { OperationalHistoryCenter } from './OperationalHistoryCenter';

interface OperationalControlCenterProps {
  dashboards: Dashboard[];
  currentDashboard: Dashboard;
  globalThresholds: ComplianceThresholds;
  year: number;
}

export const OperationalControlCenter: React.FC<OperationalControlCenterProps> = ({
  dashboards,
  currentDashboard,
  globalThresholds,
  year
}) => {
  const [activeSubView, setActiveSubView] = useState<'heatmap' | 'rankings' | 'alerts' | 'alerts-engine' | 'history-engine'>('heatmap');

  // Asegurar que tengamos datos de todos los tableros relevantes
  const relevantDashboards = useMemo(() => {
    // Si estamos en un dashboard consolidado, usamos allDashboards. Si no, solo el actual.
    const list = dashboards.length > 0 ? dashboards : [currentDashboard];
    return list;
  }, [dashboards, currentDashboard]);

  // Enriquecer en caliente
  const enrichedDashboards = useMemo(() => {
    return enrichDashboardsWithOperationalMetrics(relevantDashboards, globalThresholds, year);
  }, [relevantDashboards, globalThresholds, year]);

  // Todos los indicadores individuales a nivel nacional/consolidado
  const allKPIs = useMemo(() => {
    const list: (DashboardItem & { group?: string; area?: string })[] = [];
    enrichedDashboards.forEach(d => {
      if (d.isAggregate || String(d.id).includes('agg-') || d.id === -1) return;
      (d.items || []).forEach(item => {
        list.push({
          ...item,
          group: d.group || 'GENERAL',
          area: d.area || 'OPERACIONES'
        });
      });
    });
    return list;
  }, [enrichedDashboards]);

  // Cálculos analíticos de utilidades
  const globalHealthScore = useMemo(() => {
    return calculateOperationalHealth(allKPIs);
  }, [allKPIs]);

  const rankings = useMemo(() => {
    return buildOperationalRanking(enrichedDashboards, globalThresholds, year, true);
  }, [enrichedDashboards, globalThresholds, year]);

  const heatmap = useMemo(() => {
    return buildOperationalMatrix(enrichedDashboards, globalThresholds, year, true);
  }, [enrichedDashboards, globalThresholds, year]);

  // Métricas del Header Ejecutivo
  const headerMetrics = useMemo(() => {
    const totalDirections = heatmap.directions.length;
    const totalAreas = heatmap.areas.length;

    // 1. Direcciones al día (captureRate = 100%)
    const directionsOnTrack = rankings.directions.top.filter(d => d.captureRate >= 100).length;

    // 2. Áreas atrasadas (áreas con al menos 1 KPI vencido o captureRate < 95)
    const areasDelayed = rankings.areas.delayed.filter(a => a.missingPeriods > 0 || a.captureRate < 95).length;

    // 3. KPIs vencidos sin captura (suma total de periodos faltantes)
    const totalMissingPeriods = allKPIs.reduce((sum, item) => sum + (item.operationalMetrics?.missingPeriods || 0), 0);

    // 4. Captura nacional % (promedio de todos los kpis)
    const totalCaptured = allKPIs.reduce((sum, item) => sum + (item.operationalMetrics?.captureRate || 100), 0);
    const nationalCaptureRate = allKPIs.length > 0 ? Math.round(totalCaptured / allKPIs.length) : 100;

    // 5. Riesgo operativo global (semáforo en base a salud operativa)
    let riskLevel: 'Bajo' | 'Medio' | 'Alto' = 'Bajo';
    if (globalHealthScore < 75) riskLevel = 'Alto';
    else if (globalHealthScore < 90) riskLevel = 'Medio';

    return {
      directionsOnTrack,
      totalDirections,
      areasDelayed,
      totalAreas,
      totalMissingPeriods,
      nationalCaptureRate,
      riskLevel
    };
  }, [allKPIs, rankings, heatmap, globalHealthScore]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* HEADER ANALÍTICO / TARJETAS EJECUTIVAS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        
        {/* CARD 1: DIRECCIONES AL DÍA */}
        <div className="glass-card rounded-2xl p-5 border border-white/5 bg-slate-900/40 flex flex-col justify-between min-h-[120px] hover:scale-[1.02] transition-transform">
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none">
            Direcciones al Día
          </span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-black text-white tabular-nums tracking-tighter">
              {headerMetrics.directionsOnTrack}
            </span>
            <span className="text-xs font-bold text-slate-500">
              de {headerMetrics.totalDirections}
            </span>
          </div>
          <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest mt-2 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Disciplina al 100%
          </span>
        </div>

        {/* CARD 2: ÁREAS ATRASADAS */}
        <div className="glass-card rounded-2xl p-5 border border-white/5 bg-slate-900/40 flex flex-col justify-between min-h-[120px] hover:scale-[1.02] transition-transform">
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none">
            Áreas Atrasadas
          </span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-black text-rose-400 tabular-nums tracking-tighter">
              {headerMetrics.areasDelayed}
            </span>
            <span className="text-xs font-bold text-slate-500">
              de {headerMetrics.totalAreas}
            </span>
          </div>
          <span className="text-[8px] font-black text-rose-400 uppercase tracking-widest mt-2 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
            Requiere Atención
          </span>
        </div>

        {/* CARD 3: KPIs VENCIDOS */}
        <div className="glass-card rounded-2xl p-5 border border-white/5 bg-slate-900/40 flex flex-col justify-between min-h-[120px] hover:scale-[1.02] transition-transform">
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none">
            KPIs Vencidos sin Captura
          </span>
          <div className="flex items-baseline mt-2">
            <span className="text-3xl font-black text-amber-400 tabular-nums tracking-tighter">
              {headerMetrics.totalMissingPeriods}
            </span>
            <span className="text-xs font-bold text-slate-500 ml-1">periodos</span>
          </div>
          <span className="text-[8px] font-black text-amber-400 uppercase tracking-widest mt-2 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            Rezago en Actualización
          </span>
        </div>

        {/* CARD 4: CAPTURA NACIONAL */}
        <div className="glass-card rounded-2xl p-5 border border-white/5 bg-slate-900/40 flex flex-col justify-between min-h-[120px] hover:scale-[1.02] transition-transform">
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none">
            Disciplina Nacional
          </span>
          <div className="flex items-baseline mt-2">
            <span className={`text-3xl font-black tabular-nums tracking-tighter ${headerMetrics.nationalCaptureRate >= 95 ? 'text-emerald-400' : 'text-amber-400'}`}>
              {headerMetrics.nationalCaptureRate}%
            </span>
          </div>
          <div className="w-full bg-slate-950 h-1.5 rounded-full mt-2 overflow-hidden">
            <div
              className={`h-full ${headerMetrics.nationalCaptureRate >= 95 ? 'bg-emerald-500' : 'bg-amber-500'}`}
              style={{ width: `${headerMetrics.nationalCaptureRate}%` }}
            ></div>
          </div>
        </div>

        {/* CARD 5: RIESGO OPERATIVO GLOBAL */}
        <div className="glass-card rounded-2xl p-5 border border-white/5 bg-slate-900/40 flex flex-col justify-between min-h-[120px] hover:scale-[1.02] transition-transform">
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none">
            Riesgo Operativo Global
          </span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className={`text-3xl font-black uppercase tracking-tighter ${headerMetrics.riskLevel === 'Alto' ? 'text-rose-400' : headerMetrics.riskLevel === 'Medio' ? 'text-amber-400' : 'text-emerald-400'}`}>
              {headerMetrics.riskLevel}
            </span>
          </div>
          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-2">
            Salud: <span className="font-black text-white">{globalHealthScore}%</span>
          </span>
        </div>

      </div>

      {/* TABS DE SUB-SECCIONES */}
      <div className="flex flex-wrap gap-2 bg-slate-950 p-1.5 rounded-2xl border border-white/10 shadow-2xl backdrop-blur-xl w-fit">
        <button
          onClick={() => setActiveSubView('heatmap')}
          className={`px-6 py-2.5 rounded-xl text-[9px] font-extrabold uppercase tracking-widest transition-all duration-500 flex items-center gap-2 min-h-[44px] ${activeSubView === 'heatmap' ? 'bg-cyan-600 text-white shadow-[0_0_20px_rgba(8,145,178,0.5)]' : 'text-slate-500 hover:text-slate-300'}`}
        >
          <span>🗺️</span> <span>Mapa de Calor</span>
        </button>
        <button
          onClick={() => setActiveSubView('rankings')}
          className={`px-6 py-2.5 rounded-xl text-[9px] font-extrabold uppercase tracking-widest transition-all duration-500 flex items-center gap-2 min-h-[44px] ${activeSubView === 'rankings' ? 'bg-indigo-600 text-white shadow-[0_0_20px_rgba(79,70,229,0.5)]' : 'text-slate-500 hover:text-slate-300'}`}
        >
          <span>🏆</span> <span>Rankings de Disciplina</span>
        </button>
        <button
          onClick={() => setActiveSubView('alerts')}
          className={`px-6 py-2.5 rounded-xl text-[9px] font-extrabold uppercase tracking-widest transition-all duration-500 flex items-center gap-2 min-h-[44px] ${activeSubView === 'alerts' ? 'bg-orange-600 text-white shadow-[0_0_20px_rgba(234,88,12,0.5)]' : 'text-slate-500 hover:text-slate-300'}`}
        >
          <span>🚨</span> <span>Alertas de Atraso</span>
        </button>
        <button
          onClick={() => setActiveSubView('alerts-engine')}
          className={`px-6 py-2.5 rounded-xl text-[9px] font-extrabold uppercase tracking-widest transition-all duration-500 flex items-center gap-2 min-h-[44px] ${activeSubView === 'alerts-engine' ? 'bg-purple-600 text-white shadow-[0_0_20px_rgba(147,51,234,0.5)]' : 'text-slate-500 hover:text-slate-300'}`}
        >
          <span>🛡️</span> <span>Alertas Activas</span>
        </button>
        <button
          onClick={() => setActiveSubView('history-engine')}
          className={`px-6 py-2.5 rounded-xl text-[9px] font-extrabold uppercase tracking-widest transition-all duration-500 flex items-center gap-2 min-h-[44px] ${activeSubView === 'history-engine' ? 'bg-indigo-700 text-white shadow-[0_0_20px_rgba(79,70,229,0.5)]' : 'text-slate-500 hover:text-slate-300'}`}
        >
          <span>⏳</span> <span>Historial Operativo</span>
        </button>
      </div>

      {/* DESPLIEGUE DE SUB-VISTAS */}
      <div className="space-y-4">
        {activeSubView === 'heatmap' && (
          <OperationalHeatmap
            directions={heatmap.directions}
            areas={heatmap.areas}
            matrix={heatmap.matrix}
          />
        )}

        {activeSubView === 'rankings' && (
          <OperationalRanking
            rankings={rankings}
          />
        )}

        {activeSubView === 'alerts' && (
          <OperationalAlertsTable
            items={allKPIs}
          />
        )}

        {activeSubView === 'alerts-engine' && (
          <OperationalAlertsCenter
            dashboards={relevantDashboards}
            globalThresholds={globalThresholds}
            year={year}
          />
        )}

        {activeSubView === 'history-engine' && (
          <OperationalHistoryCenter
            dashboards={relevantDashboards}
            globalThresholds={globalThresholds}
            year={year}
          />
        )}
      </div>

    </div>
  );
};
