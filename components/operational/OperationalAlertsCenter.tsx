import React, { useMemo, useState } from 'react';
import { Dashboard, DashboardItem, ComplianceThresholds } from '../../types';
import { buildOperationalAlerts, OperationalAlert, AlertSeverity, OperationalTrend } from '../../utils/operationalAlerts';

interface OperationalAlertsCenterProps {
  dashboards: Dashboard[];
  globalThresholds: ComplianceThresholds;
  year: number;
  compact?: boolean;
}

export const OperationalAlertsCenter: React.FC<OperationalAlertsCenterProps> = ({
  dashboards,
  globalThresholds,
  year,
  compact = false
}) => {
  const [selectedSeverity, setSelectedSeverity] = useState<string>('TODAS');
  const [selectedDirection, setSelectedDirection] = useState<string>('TODAS');
  const [selectedArea, setSelectedArea] = useState<string>('TODAS');

  // Compilar todas las alertas utilizando el motor analítico
  const allAlerts = useMemo(() => {
    return buildOperationalAlerts(dashboards, globalThresholds, year);
  }, [dashboards, globalThresholds, year]);

  // Listas para poblar filtros
  const directions = useMemo(() => {
    const set = new Set<string>();
    allAlerts.forEach(a => {
      if (a.direction) set.add(a.direction.trim().toUpperCase());
    });
    return ['TODAS', ...Array.from(set).sort()];
  }, [allAlerts]);

  const areas = useMemo(() => {
    const set = new Set<string>();
    allAlerts.forEach(a => {
      if (a.area) set.add(a.area.trim().toUpperCase());
    });
    return ['TODAS', ...Array.from(set).sort()];
  }, [allAlerts]);

  // Alertas filtradas
  const filteredAlerts = useMemo(() => {
    return allAlerts.filter(a => {
      const matchSeverity = selectedSeverity === 'TODAS' || a.severity === selectedSeverity;
      const matchDir = selectedDirection === 'TODAS' || a.direction === selectedDirection;
      const matchArea = selectedArea === 'TODAS' || a.area === selectedArea;

      return matchSeverity && matchDir && matchArea;
    });
  }, [allAlerts, selectedSeverity, selectedDirection, selectedArea]);

  // Métricas analíticas ejecutivas del alerts engine
  const executiveMetrics = useMemo(() => {
    const total = allAlerts.length;
    const critical = allAlerts.filter(a => a.severity === 'CRÍTICO').length;
    const high = allAlerts.filter(a => a.severity === 'REQUIERE ATENCIÓN').length;
    const medium = allAlerts.filter(a => a.severity === 'DATOS PENDIENTES').length;
    
    // Conteo de riesgos ocultos
    const hiddenRisks = allAlerts.filter(a => a.isHiddenRisk).length;

    // Conteo de KPIs deteriorándose
    const deteriorating = allAlerts.filter(a => a.isDeteriorating).length;

    // Promedio de confiabilidad operativa a nivel nacional
    const totalReliability = allAlerts.reduce((sum, a) => sum + a.reliabilityScore, 0);
    const avgReliabilityScore = total > 0 ? Math.round(totalReliability / total) : 100;

    return {
      total,
      critical,
      high,
      medium,
      hiddenRisks,
      deteriorating,
      avgReliabilityScore
    };
  }, [allAlerts]);

  // Clasificación de color por severidad
  const getSeverityClasses = (severity: AlertSeverity): string => {
    switch (severity) {
      case 'CRÍTICO': return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
      case 'REQUIERE ATENCIÓN': return 'text-orange-400 bg-orange-500/10 border-orange-500/30';
      case 'DATOS PENDIENTES': return 'text-amber-300 bg-amber-500/10 border-amber-500/30';
      case 'RIESGO OCULTO': return 'text-violet-300 bg-violet-500/10 border-violet-500/30';
      default: return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    }
  };

  // Clasificación de color por tendencia
  const getTrendIconAndColor = (trend: OperationalTrend) => {
    switch (trend) {
      case 'DETERIORÁNDOSE': return { icon: '📉', color: 'text-orange-400 bg-orange-500/5' };
      case 'CRÍTICO': return { icon: '🚨', color: 'text-rose-400 bg-rose-500/5 animate-pulse' };
      case 'NO EVALUABLE': return { icon: '—', color: 'text-slate-400 bg-slate-500/5' };
      default: return { icon: '➡️', color: 'text-slate-400 bg-slate-500/5' };
    }
  };

  // Renderizar Sparkline compacto mensual de 12 bloques (Enero a Diciembre)
  const renderSparkline = (alert: OperationalAlert) => {
    const months = ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
    
    // Simular los bloques de captura
    // Los meses con datos se pintan verdes, sin datos rojos/grises, futuros grises
    // Usamos el número de missingPeriods para simular los bloques finales vacíos
    const expected = alert.missingPeriods + Math.round(alert.captureRate * 0.12);
    const captured = Math.round(alert.captureRate * 0.12);

    return (
      <div className="flex gap-1.5 items-center justify-center">
        {months.map((m, idx) => {
          let blockBg = 'bg-slate-800/40 border border-white/5';
          let title = `Periodo ${m} - Fuera de rango`;

          if (idx < expected) {
            if (idx < captured) {
              blockBg = 'bg-emerald-500/60 border border-emerald-500/40 shadow-[0_0_4px_rgba(16,185,129,0.3)]';
              title = `Periodo ${m} - CAPTURADO`;
            } else {
              blockBg = 'bg-rose-500/60 border border-rose-500/40 animate-pulse';
              title = `Periodo ${m} - VENCIDO SIN CAPTURA`;
            }
          }

          return (
            <div
              key={idx}
              className={`w-4 h-5 rounded-[3px] text-[9px] font-black flex items-center justify-center text-white/90 cursor-help transition-all ${blockBg}`}
              title={title}
            >
              {m}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* SECCIÓN 1: HEADER EJECUTIVO DEL ENGINE */}
      {!compact && <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        
        {/* CARD 1: CONFIABILIDAD OPERATIVA PROMEDIO */}
        <div className="glass-card rounded-2xl p-5 border border-white/5 bg-slate-900/40 flex flex-col justify-between min-h-[120px] hover:scale-[1.02] transition-transform">
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none">
            Confiabilidad Operativa
          </span>
          <div className="flex items-baseline mt-2 gap-2">
            <span className={`text-3xl font-black tabular-nums tracking-tighter ${executiveMetrics.avgReliabilityScore >= 90 ? 'text-emerald-400' : 'text-amber-400'}`}>
              {executiveMetrics.avgReliabilityScore}%
            </span>
          </div>
          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-2">
            Score consolidado
          </span>
        </div>

        {/* CARD 2: ALERTAS CRÍTICAS */}
        <div className="glass-card rounded-2xl p-5 border border-white/5 bg-slate-900/40 flex flex-col justify-between min-h-[120px] hover:scale-[1.02] transition-transform">
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none">
            Alertas Críticas Activas
          </span>
          <div className="flex items-baseline mt-2">
            <span className="text-3xl font-black text-rose-400 tabular-nums tracking-tighter">
              {executiveMetrics.critical}
            </span>
            <span className="text-xs font-bold text-slate-500 ml-1">bloqueados</span>
          </div>
          <span className="text-[8px] font-black text-rose-400 uppercase tracking-widest mt-2 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
            Acción Inmediata Requerida
          </span>
        </div>

        {/* CARD 3: KPIs EN DETERIORO */}
        <div className="glass-card rounded-2xl p-5 border border-white/5 bg-slate-900/40 flex flex-col justify-between min-h-[120px] hover:scale-[1.02] transition-transform">
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none">
            KPIs Deteriorándose
          </span>
          <div className="flex items-baseline mt-2">
            <span className="text-3xl font-black text-orange-400 tabular-nums tracking-tighter">
              {executiveMetrics.deteriorating}
            </span>
            <span className="text-xs font-bold text-slate-500 ml-1">indicadores</span>
          </div>
          <span className="text-[8px] font-black text-orange-400 uppercase tracking-widest mt-2">
            Tendencia de captura negativa
          </span>
        </div>

        {/* CARD 4: RIESGOS OCULTOS DETECTADOS */}
        <div className="glass-card rounded-2xl p-5 border border-white/5 bg-slate-900/40 flex flex-col justify-between min-h-[120px] hover:scale-[1.02] transition-transform">
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none">
            Riesgos Ocultos Detectados
          </span>
          <div className="flex items-baseline mt-2">
            <span className="text-3xl font-black text-amber-400 tabular-nums tracking-tighter">
              {executiveMetrics.hiddenRisks}
            </span>
            <span className="text-xs font-bold text-slate-500 ml-1">casos</span>
          </div>
          <span className="text-[8px] font-black text-amber-400 uppercase tracking-widest mt-2">
            Alto performance + baja captura
          </span>
        </div>

        {/* CARD 5: EFICIENCIA GLOBAL DE RESPUESTA */}
        <div className="glass-card rounded-2xl p-5 border border-white/5 bg-slate-900/40 flex flex-col justify-between min-h-[120px] hover:scale-[1.02] transition-transform">
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none">
            Alertas Totales del Sistema
          </span>
          <div className="flex items-baseline mt-2">
            <span className="text-3xl font-black text-cyan-400 tabular-nums tracking-tighter">
              {executiveMetrics.total}
            </span>
          </div>
          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-2">
            Alertas de Rezago Histórico
          </span>
        </div>

      </div>}

      {/* SECCIÓN 2: ALERTS CENTER CON FILTROS E INTERFAZ PREMIUM */}
      <div className="glass-card rounded-[2rem] p-6 border border-white/5 shadow-2xl space-y-6">
        
        {/* FILTROS INTERACTIVOS TÁCTILES */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-5">
          <div className="flex flex-col">
            <h3 className="text-base font-black text-white uppercase tracking-wider">{compact ? 'Requiere atención' : 'Centro de Alertas Activas'}</h3>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">
              Monitoreo ejecutivo de rezagos y deterioro en tiempo real
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            
            {/* Filtro Severidad */}
            <div className="flex flex-col gap-1">
              <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest px-1">Criticidad</span>
              <select
                value={selectedSeverity}
                onChange={e => setSelectedSeverity(e.target.value)}
                className="px-3 py-2 bg-slate-950/80 border border-white/10 rounded-xl text-[10px] font-black text-slate-300 uppercase tracking-tight outline-none focus:border-cyan-500 transition-all min-h-[44px]"
              >
                <option value="TODAS">TODAS LAS CRITICIDADES</option>
                <option value="CRÍTICO">CRÍTICO</option>
                <option value="REQUIERE ATENCIÓN">REQUIERE ATENCIÓN</option>
                <option value="DATOS PENDIENTES">DATOS PENDIENTES</option>
                <option value="RIESGO OCULTO">RIESGO OCULTO</option>
                <option value="BAJO CONTROL">BAJO CONTROL</option>
              </select>
            </div>

            {/* Filtro Dirección */}
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

            {/* Filtro Área */}
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

          </div>
        </div>

        {/* DETECCIÓN DE RIESGOS DESTACADOS */}
        {filteredAlerts.some(a => a.isHiddenRisk) && (
          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl space-y-2">
            <span className="text-[9px] font-black text-amber-400 uppercase tracking-widest flex items-center gap-1">
              <span>⚠️</span> RIESGO OCULTO DETECTADO
            </span>
            <p className="text-[10px] font-bold text-slate-300">
              Existen indicadores que presentan metas con alto rendimiento reportado, pero con una disciplina de carga de datos crítica. Esto enmascara el cumplimiento operacional real de la dirección correspondiente.
            </p>
          </div>
        )}

        {/* TABLA ULTRA DENSA DE ALERTAS Y TRAZABILIDAD */}
        <div className="overflow-x-auto pb-4 scrollbar-hide max-w-full">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-950/20">
                <th className="p-3 text-left text-[9px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5 rounded-tl-2xl">Origen / KPI</th>
                <th className="p-3 text-center text-[9px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5">Criticidad</th>
                <th className="p-3 text-center text-[9px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5">Resultado</th>
                <th className="p-3 text-center text-[9px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5">Datos</th>
                <th className="p-3 text-center text-[9px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5">Confiabilidad</th>
                <th className="p-3 text-center text-[9px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5">Trazabilidad operativa</th>
                <th className="p-3 text-center text-[9px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5 rounded-tr-2xl">Aging</th>
              </tr>
            </thead>
            <tbody>
              {filteredAlerts.map((alert, idx) => {
                const trend = getTrendIconAndColor(alert.trend);

                return (
                  <tr key={`${alert.id}-${idx}`} className="hover:bg-white/5 border-b border-white/5 transition-colors">
                    
                    {/* ORIGEN Y NOMBRE DE KPI */}
                    <td className="p-3 text-[11px] font-black text-white uppercase tracking-tight max-w-[260px]">
                      <div className="flex flex-col">
                        <span className="truncate">{alert.indicator}</span>
                        <span className="text-[7px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">
                          {alert.direction} • {alert.area}
                        </span>
                      </div>
                    </td>

                    {/* CRITICIDAD */}
                    <td className="p-3 text-center">
                      <span className={`text-[9px] font-black px-2.5 py-1 rounded-lg border ${getSeverityClasses(alert.severity)}`}>
                        {alert.severity}
                      </span>
                    </td>

                    {/* TENDENCIA */}
                    <td className="p-3 text-center">
                      <span className={`text-[9px] font-black px-2 py-1 rounded-lg ${trend.color} flex items-center justify-center gap-1 w-fit mx-auto`}>
                        <span>{trend.icon}</span> <span>{alert.performanceLabel}</span>
                      </span>
                    </td>

                    {/* SPARKLINE COMPACTO */}
                    <td className="p-3 text-center">
                      <div className="flex flex-col items-center gap-1"><span className={`rounded px-2 py-1 text-[8px] font-black ${alert.dataStatus === 'AL DÍA' ? 'text-emerald-400' : alert.dataStatus === 'PENDIENTE' ? 'text-amber-300' : 'text-slate-300'}`}>{alert.dataStatus}</span>{renderSparkline(alert)}</div>
                    </td>

                    {/* CONFIDENCE SCORE */}
                    <td className="p-3 text-center">
                      <div className="flex flex-col items-center">
                        <span className={`text-xs font-black tabular-nums tracking-tighter ${alert.reliabilityScore >= 90 ? 'text-emerald-400' : alert.reliabilityScore >= 70 ? 'text-amber-400' : 'text-rose-400'}`}>
                          {alert.reliabilityScore}%
                        </span>
                        <span className="text-[6px] text-slate-500 font-black uppercase tracking-widest">
                          Confiabilidad
                        </span>
                      </div>
                    </td>

                    {/* TRAZABILIDAD (FUTURA AUTOMATIZACIÓN) */}
                    <td className="p-3 text-center text-[9px] font-bold text-slate-400 max-w-[180px] truncate">
                      <div className="flex flex-col items-start leading-tight">
                        <span className="text-[8px] text-slate-400 font-black uppercase">Última actualización:</span>
                        <span className="text-white truncate max-w-full">{alert.traceability.lastOperationalChange}</span>
                        <span className="text-[8px] text-slate-400 font-black uppercase mt-0.5">
                          Actualizado por {alert.traceability.lastUpdatedBy}
                        </span>
                      </div>
                    </td>

                    {/* AGING OPERATIVO */}
                    <td className="p-3 text-center text-[10px] font-black text-white tabular-nums">
                      <span className={`px-2 py-0.5 rounded ${alert.stalenessDays >= 60 ? 'bg-rose-500/10 text-rose-400' : 'bg-slate-900/60 text-slate-300'}`}>
                        {alert.agingLabel}
                      </span>
                    </td>

                  </tr>
                );
              })}

              {filteredAlerts.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="p-12 text-center text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-900/10 border-b border-white/5 rounded-b-2xl"
                  >
                    🎉 Todo en orden: No se encontraron alertas operativas para el filtro actual
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </div>

    </div>
  );
};
