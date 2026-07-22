import React, { useMemo, useState } from 'react';
import { Dashboard, ComplianceThresholds } from '../../types';
import { buildHistoryAndAuditEngine, KPIHistory, OperationalSnapshot } from '../../utils/operationalHistory';

interface OperationalHistoryCenterProps {
  dashboards: Dashboard[];
  globalThresholds: ComplianceThresholds;
  year: number;
}

export const OperationalHistoryCenter: React.FC<OperationalHistoryCenterProps> = ({
  dashboards,
  globalThresholds,
  year
}) => {
  const [viewMode, setViewMode] = useState<'KPI' | 'DIRECCION' | 'AREA'>('KPI');
  const [selectedTarget, setSelectedTarget] = useState<string>('');

  // Compilar todo el historial usando el motor analítico
  const fullHistory = useMemo(() => {
    return buildHistoryAndAuditEngine(dashboards, globalThresholds, year);
  }, [dashboards, globalThresholds, year]);

  // Obtener los objetivos disponibles según el modo seleccionado
  const filterTargets = useMemo(() => {
    const targets = new Set<string>();
    fullHistory.forEach(h => {
      if (viewMode === 'KPI') targets.add(h.indicator.trim());
      else if (viewMode === 'DIRECCION') targets.add(h.direction.trim());
      else if (viewMode === 'AREA') targets.add(h.area.trim());
    });
    const sorted = Array.from(targets).sort();
    return sorted;
  }, [fullHistory, viewMode]);

  // Seleccionar automáticamente el primer elemento si cambia el modo
  React.useEffect(() => {
    if (filterTargets.length > 0) {
      setSelectedTarget(filterTargets[0]);
    } else {
      setSelectedTarget('');
    }
  }, [filterTargets]);

  // Consolidar snapshots e historial del target seleccionado
  const activeHistory = useMemo(() => {
    if (!selectedTarget) return null;

    if (viewMode === 'KPI') {
      return fullHistory.find(h => h.indicator.trim() === selectedTarget) || null;
    }

    // Para Dirección o Área, debemos consolidar los snapshots de todos los KPIs pertenecientes
    const matches = fullHistory.filter(h => {
      if (viewMode === 'DIRECCION') return h.direction.trim() === selectedTarget;
      return h.area.trim() === selectedTarget;
    });

    if (matches.length === 0) return null;

    // Obtener los periodos disponibles
    const periodIndices = Array.from(new Set(
      matches.flatMap(m => m.snapshots.map(s => s.periodIdx))
    )).sort((a, b) => a - b);

    const months = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

    // Consolidar snapshots promediando métricas de forma segura
    const snapshots: OperationalSnapshot[] = periodIndices.map(pIdx => {
      const activeKPIs = matches.filter(m => m.snapshots.some(s => s.periodIdx === pIdx));
      const count = activeKPIs.length;

      let sumCapture = 0;
      let sumReal = 0;
      let sumHealth = 0;
      let sumReliability = 0;
      let sumStaleness = 0;

      activeKPIs.forEach(kpi => {
        const snap = kpi.snapshots.find(s => s.periodIdx === pIdx)!;
        sumCapture += snap.captureRate;
        sumReal += snap.realOperationalScore;
        sumHealth += snap.operationalHealthScore;
        sumReliability += snap.operationalReliabilityScore;
        sumStaleness += snap.stalenessDays;
      });

      return {
        periodIdx: pIdx,
        periodLabel: months[pIdx] || `M${pIdx + 1}`,
        captureRate: count > 0 ? Math.round(sumCapture / count) : 100,
        realOperationalScore: count > 0 ? Math.round(sumReal / count) : 100,
        operationalHealthScore: count > 0 ? Math.round(sumHealth / count) : 100,
        operationalReliabilityScore: count > 0 ? Math.round(sumReliability / count) : 100,
        stalenessDays: count > 0 ? Math.round(sumStaleness / count) : 0
      };
    });

    // Calcular estabilidad y madurez consolidada
    const stabilitySum = matches.reduce((sum, m) => sum + m.stabilityScore, 0);
    const avgStability = matches.length > 0 ? Math.round(stabilitySum / matches.length) : 100;

    const lastSnapshot = snapshots[snapshots.length - 1];
    const lastReliability = lastSnapshot ? lastSnapshot.operationalReliabilityScore : 100;

    const avgMaturity = (avgStability + lastReliability) / 2;
    let maturityLevel: 'Reactivo' | 'Básico' | 'Controlado' | 'Maduro' | 'Enterprise' = 'Controlado';
    if (avgMaturity >= 95) maturityLevel = 'Enterprise';
    else if (avgMaturity >= 85) maturityLevel = 'Maduro';
    else if (avgMaturity >= 70) maturityLevel = 'Controlado';
    else if (avgMaturity >= 50) maturityLevel = 'Básico';
    else maturityLevel = 'Reactivo';

    // Consolidar anomalías
    const anomalies = Array.from(new Set(matches.flatMap(m => m.anomalies)));

    // Simulación de auditoría consolidada
    const lastUpdatedAt = lastSnapshot ? `Periodo ${lastSnapshot.periodLabel} / ${year}` : 'N/A';
    const lastUpdatedBy = matches[0]?.audit?.lastUpdatedBy || 'Coordinador Operativo';

    const previousSnapshot = snapshots.length > 1 ? snapshots[snapshots.length - 2] : null;
    const previousCaptureRate = previousSnapshot ? previousSnapshot.captureRate : 100;
    const previousOperationalScore = previousSnapshot ? previousSnapshot.realOperationalScore : 100;
    const previousHealthScore = previousSnapshot ? previousSnapshot.operationalHealthScore : 100;

    return {
      indicator: selectedTarget,
      direction: viewMode === 'DIRECCION' ? selectedTarget : 'CONSOLIDADO',
      area: viewMode === 'AREA' ? selectedTarget : 'CONSOLIDADO',
      snapshots,
      stabilityScore: avgStability,
      maturityLevel,
      anomalies,
      audit: {
        lastUpdatedAt,
        lastUpdatedBy,
        previousCaptureRate,
        previousOperationalScore,
        previousHealthScore,
        channelIntegrationReady: {
          email: true,
          push: true,
          whatsapp: true
        }
      }
    } as KPIHistory;

  }, [selectedTarget, viewMode, fullHistory, year]);

  // Colores HSL para Madurez Operativa
  const getMaturityBadgeClass = (level: string): string => {
    switch (level) {
      case 'Enterprise': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.2)]';
      case 'Maduro': return 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30';
      case 'Controlado': return 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20';
      case 'Básico': return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
      default: return 'text-rose-400 bg-rose-500/10 border-rose-500/30 animate-pulse';
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* SECCIÓN 1: SELECTOR DE VISTA Y CONTROLES TÁCTILES */}
      <div className="glass-card rounded-[2rem] p-6 border border-white/5 bg-slate-900/40 shadow-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex flex-col">
          <h3 className="text-base font-black text-white uppercase tracking-wider">Histórico y Auditoría Operativa</h3>
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">
            Evolución, estabilidad, anomalías y madurez operativa de indicadores
          </span>
        </div>

        {/* CONTROLES TÁCTILES >= 44px */}
        <div className="flex flex-wrap items-center gap-4">
          
          {/* Selector de Nivel de Análisis */}
          <div className="flex bg-slate-950 p-1 rounded-xl border border-white/5">
            {(['KPI', 'DIRECCION', 'AREA'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all min-h-[44px] flex items-center justify-center ${viewMode === mode ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}
              >
                {mode === 'DIRECCION' ? 'Dirección' : mode === 'AREA' ? 'Área' : 'KPI'}
              </button>
            ))}
          </div>

          {/* Selector del Elemento Target */}
          <div className="flex flex-col gap-1">
            <select
              value={selectedTarget}
              onChange={e => setSelectedTarget(e.target.value)}
              className="px-4 py-2 bg-slate-950/80 border border-white/10 rounded-xl text-[10px] font-black text-slate-300 uppercase tracking-tight outline-none focus:border-indigo-500 transition-all min-h-[44px] min-w-[200px]"
            >
              {filterTargets.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

        </div>
      </div>

      {activeHistory && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* COLUMNA 1 & 2: TIMELINE HISTÓRICO EJECUTIVO */}
          <div className="lg:col-span-2 space-y-6">
            
            <div className="glass-card rounded-[2rem] p-6 border border-white/5 shadow-xl space-y-6">
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Línea de Tiempo de Snapshots
                </span>
                <span className="text-[9px] font-black text-slate-500 uppercase">
                  Corte: Año {year}
                </span>
              </div>

              {/* LISTADO DE SNAPSHOTS MENSUALES (TIMELINE COMPACTO) */}
              <div className="space-y-4">
                {activeHistory.snapshots.map((snap, idx) => {
                  
                  // Comparación de cambio mensual en Score Real Operativo
                  let trendIcon = '➡️';
                  let trendColor = 'text-slate-500';
                  if (idx > 0) {
                    const prevSnap = activeHistory.snapshots[idx - 1];
                    const diff = snap.realOperationalScore - prevSnap.realOperationalScore;
                    if (diff > 2) {
                      trendIcon = '📈';
                      trendColor = 'text-emerald-400';
                    } else if (diff < -2) {
                      trendIcon = '📉';
                      trendColor = 'text-rose-400 animate-pulse';
                    }
                  }

                  return (
                    <div 
                      key={snap.periodIdx} 
                      className="p-4 bg-slate-950/40 border border-white/5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-white/5 transition-colors"
                    >
                      {/* MES / PERIODO */}
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-xs font-black text-indigo-400">
                          {snap.periodLabel}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-white uppercase tracking-wider">Corte Mensual</span>
                          <span className="text-[8px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">
                            Periodo {snap.periodIdx + 1}
                          </span>
                        </div>
                      </div>

                      {/* DETALLE COMPACTO DE MÉTRICAS */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8 flex-1 md:justify-items-center">
                        
                        {/* DISCIPLINA DE CAPTURA */}
                        <div className="flex flex-col">
                          <span className="text-[7px] text-slate-500 font-black uppercase tracking-widest">Disciplina</span>
                          <span className="text-xs font-black text-white mt-0.5 tabular-nums">
                            {snap.captureRate}%
                          </span>
                          <div className="w-16 bg-slate-900 h-1 rounded-full overflow-hidden mt-1">
                            <div className="h-full bg-cyan-500" style={{ width: `${snap.captureRate}%` }}></div>
                          </div>
                        </div>

                        {/* CUMPLIMIENTO OPERATIVO REAL */}
                        <div className="flex flex-col">
                          <span className="text-[7px] text-slate-500 font-black uppercase tracking-widest">Cump. Real</span>
                          <span className="text-xs font-black text-white mt-0.5 tabular-nums flex items-center gap-1">
                            {snap.realOperationalScore}% <span className={`text-[9px] ${trendColor}`}>{trendIcon}</span>
                          </span>
                        </div>

                        {/* SALUD OPERATIVA */}
                        <div className="flex flex-col">
                          <span className="text-[7px] text-slate-500 font-black uppercase tracking-widest">Salud Op.</span>
                          <span className="text-xs font-black text-indigo-400 mt-0.5 tabular-nums">
                            {snap.operationalHealthScore}%
                          </span>
                        </div>

                        {/* CONFIABILIDAD */}
                        <div className="flex flex-col">
                          <span className="text-[7px] text-slate-500 font-black uppercase tracking-widest">Confiabilidad</span>
                          <span className={`text-xs font-black mt-0.5 tabular-nums ${snap.operationalReliabilityScore >= 90 ? 'text-emerald-400' : snap.operationalReliabilityScore >= 70 ? 'text-amber-400' : 'text-rose-400'}`}>
                            {snap.operationalReliabilityScore}%
                          </span>
                        </div>

                      </div>

                      {/* AGING / RETRASO */}
                      <div className="text-right text-[9px] font-black text-slate-500 tabular-nums">
                        {snap.stalenessDays === 0 ? (
                          <span className="text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">Al día</span>
                        ) : (
                          <span className="text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded">
                            {snap.stalenessDays}d Atraso
                          </span>
                        )}
                      </div>

                    </div>
                  );
                })}
              </div>

            </div>

            {/* SECCIÓN DE DETECCIÓN DE ANOMALÍAS HISTÓRICAS */}
            <div className="glass-card rounded-[2rem] p-6 border border-white/5 shadow-xl space-y-4">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block border-b border-white/5 pb-3">
                Detección de Anomalías de Carga y Gaps
              </span>
              
              <div className="space-y-3">
                {activeHistory.anomalies.map((anom, idx) => (
                  <div key={idx} className="p-3 bg-rose-500/5 border border-rose-500/20 rounded-2xl flex items-start gap-2.5">
                    <span className="text-rose-400 text-xs mt-0.5">⚠️</span>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-extrabold text-rose-400 uppercase tracking-wide">Comportamiento Irregular</span>
                      <span className="text-[10px] font-bold text-slate-300 mt-0.5 leading-tight">{anom}</span>
                    </div>
                  </div>
                ))}

                {activeHistory.anomalies.length === 0 && (
                  <div className="p-4 text-center text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    ✅ Sin anomalías ni gaps detectados en el periodo
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* COLUMNA 3: PANEL EJECUTIVO DE ESTABILIDAD & AUDITORÍA */}
          <div className="space-y-6">
            
            {/* TARJETA 1: SCORE DE ESTABILIDAD */}
            <div className="glass-card rounded-[2rem] p-6 border border-white/5 shadow-xl space-y-6">
              <div className="text-center space-y-2">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                  Estabilidad Histórica
                </span>
                
                <div className="relative w-36 h-36 mx-auto flex items-center justify-center">
                  {/* Gauge circular simplificado usando gradientes CSS */}
                  <div className="absolute inset-0 rounded-full border-[10px] border-slate-950 flex items-center justify-center">
                    <div className="flex flex-col items-center">
                      <span className="text-3xl font-black text-white tabular-nums tracking-tighter">
                        {activeHistory.stabilityScore}%
                      </span>
                      <span className="text-[6px] text-slate-500 font-black uppercase tracking-widest mt-0.5">
                        Stability
                      </span>
                    </div>
                  </div>
                </div>

                <p className="text-[9px] font-bold text-slate-400 max-w-[200px] mx-auto mt-2 leading-snug">
                  Mide consistencia de carga de datos, volatilidad mensual y desvíos de captura del indicador.
                </p>
              </div>

              {/* BADGE DE MADUREZ OPERATIVA */}
              <div className="border-t border-white/5 pt-5 space-y-2 flex flex-col items-center">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                  Nivel de Madurez
                </span>
                <span className={`text-[11px] font-black px-4 py-1.5 rounded-xl border tracking-widest ${getMaturityBadgeClass(activeHistory.maturityLevel)}`}>
                  ⭐ {activeHistory.maturityLevel}
                </span>
              </div>
            </div>

            {/* TARJETA 2: CAPA DE AUDITORÍA */}
            <div className="glass-card rounded-[2rem] p-6 border border-white/5 shadow-xl space-y-4">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block border-b border-white/5 pb-3">
                Auditoría de Modificaciones
              </span>
              
              <div className="space-y-4">
                
                {/* Datos de última actualización */}
                <div className="flex justify-between items-center text-[10px] font-bold text-slate-300">
                  <span className="text-slate-500 uppercase text-[8px] font-black">Última Carga:</span>
                  <span className="text-right">{activeHistory.audit.lastUpdatedAt}</span>
                </div>

                <div className="flex justify-between items-center text-[10px] font-bold text-slate-300">
                  <span className="text-slate-500 uppercase text-[8px] font-black">Cargado Por:</span>
                  <span className="text-right text-indigo-400">{activeHistory.audit.lastUpdatedBy}</span>
                </div>

                {/* Comparativo de auditoría previo */}
                <div className="border-t border-white/5 pt-4 space-y-3">
                  <span className="text-[7px] text-slate-500 font-black uppercase tracking-widest block">
                    Comparativa de Auditoría (vs Periodo Previo)
                  </span>

                  <div className="flex justify-between items-center text-[10px] font-bold text-slate-300">
                    <span className="text-slate-400">Captura Previa:</span>
                    <span className="tabular-nums">{activeHistory.audit.previousCaptureRate}%</span>
                  </div>

                  <div className="flex justify-between items-center text-[10px] font-bold text-slate-300">
                    <span className="text-slate-400">Cumplimiento Previo:</span>
                    <span className="tabular-nums">{activeHistory.audit.previousOperationalScore}%</span>
                  </div>

                  <div className="flex justify-between items-center text-[10px] font-bold text-slate-300">
                    <span className="text-slate-400">Salud Previa:</span>
                    <span className="tabular-nums">{activeHistory.audit.previousHealthScore}%</span>
                  </div>
                </div>

              </div>
            </div>

            {/* TARJETA 3: INTEGRACIÓN Y AUTOMATIZACIÓN DE CANALES */}
            <div className="glass-card rounded-[2rem] p-6 border border-white/5 shadow-xl space-y-4">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block border-b border-white/5 pb-3">
                Canales de Automatización (Mock)
              </span>

              <div className="space-y-3">
                
                {/* Email integration */}
                <div className="flex items-center justify-between p-2 bg-slate-950/40 border border-white/5 rounded-xl">
                  <div className="flex items-center gap-2">
                    <span className="text-xs">✉️</span>
                    <span className="text-[9px] font-black text-slate-300 uppercase tracking-wider">Email Alerts</span>
                  </div>
                  <span className="text-[7px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded font-black uppercase">
                    Preparado
                  </span>
                </div>

                {/* Push notification */}
                <div className="flex items-center justify-between p-2 bg-slate-950/40 border border-white/5 rounded-xl">
                  <div className="flex items-center gap-2">
                    <span className="text-xs">🔔</span>
                    <span className="text-[9px] font-black text-slate-300 uppercase tracking-wider">Push Alerts</span>
                  </div>
                  <span className="text-[7px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded font-black uppercase">
                    Preparado
                  </span>
                </div>

                {/* WhatsApp escalamiento */}
                <div className="flex items-center justify-between p-2 bg-slate-950/40 border border-white/5 rounded-xl">
                  <div className="flex items-center gap-2">
                    <span className="text-xs">💬</span>
                    <span className="text-[9px] font-black text-slate-300 uppercase tracking-wider">WhatsApp Link</span>
                  </div>
                  <span className="text-[7px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded font-black uppercase">
                    Preparado
                  </span>
                </div>

                <p className="text-[8px] font-bold text-slate-500 text-center leading-normal mt-2">
                  Estructura preparada para disparar flujos de escalamiento automáticos basados en criticidad.
                </p>
              </div>
            </div>

          </div>

        </div>
      )}

    </div>
  );
};
