import React, { useState } from 'react';
import { OperationalActorMetrics } from '../../utils/operationalControl';

interface OperationalRankingProps {
  rankings: {
    directions: {
      top: OperationalActorMetrics[];
      delayed: OperationalActorMetrics[];
    };
    areas: {
      top: OperationalActorMetrics[];
      delayed: OperationalActorMetrics[];
    };
  };
}

export const OperationalRanking: React.FC<OperationalRankingProps> = React.memo(({ rankings }) => {
  const [activeTab, setActiveTab] = useState<'directions' | 'areas'>('directions');

  const activeRankings = activeTab === 'directions' ? rankings.directions : rankings.areas;
  const labelSingular = activeTab === 'directions' ? 'Dirección' : 'Área';
  const labelPlural = activeTab === 'directions' ? 'Direcciones' : 'Áreas';

  const getHealthColor = (score: number): string => {
    if (score >= 95) return 'text-emerald-400';
    if (score >= 85) return 'text-amber-400';
    if (score >= 70) return 'text-orange-400';
    return 'text-rose-400';
  };

  const getCaptureBadgeColor = (rate: number): string => {
    if (rate >= 95) return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400';
    if (rate >= 85) return 'bg-amber-500/10 border-amber-500/20 text-amber-400';
    if (rate >= 70) return 'bg-orange-500/10 border-orange-500/20 text-orange-400';
    return 'bg-rose-500/10 border-rose-500/20 text-rose-400';
  };

  return (
    <div className="glass-card rounded-[2rem] p-6 border border-white/5 shadow-2xl space-y-6">
      
      {/* HEADER DE RANKINGS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col">
          <h3 className="text-base font-black text-white uppercase tracking-wider">
            Rankings de Disciplina y Carga
          </h3>
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">
            Evaluación comparativa de salud operativa y consistencia de datos
          </span>
        </div>

        {/* SELECTOR DE NIVEL (DIRECCIÓN / ÁREA) */}
        <div className="flex bg-slate-950 p-1 rounded-xl border border-white/5 shadow-inner w-fit">
          <button
            onClick={() => setActiveTab('directions')}
            className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all duration-300 min-h-[44px] min-w-[120px] ${
              activeTab === 'directions'
                ? 'bg-slate-900 text-cyan-400 shadow-md border border-white/5'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            Por Dirección
          </button>
          <button
            onClick={() => setActiveTab('areas')}
            className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all duration-300 min-h-[44px] min-w-[120px] ${
              activeTab === 'areas'
                ? 'bg-slate-900 text-cyan-400 shadow-md border border-white/5'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            Por Área
          </button>
        </div>
      </div>

      {/* CONTENEDOR EN GRID DOS COLUMNAS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* COLUMNA 1: TOP ACTUALIZADOS / COMPROMETIDOS */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-white/5 pb-3">
            <span className="text-lg">🏆</span>
            <div className="flex flex-col">
              <h4 className="text-xs font-black text-white uppercase tracking-wider">
                Top Actualizados ({labelPlural})
              </h4>
              <span className="text-[8px] font-bold text-emerald-400 uppercase tracking-widest mt-0.5">
                Máxima disciplina y actualización al día
              </span>
            </div>
          </div>

          <div className="space-y-3">
            {activeRankings.top.slice(0, 5).map((actor, idx) => (
              <div
                key={`${actor.name}-top-${idx}`}
                className="group relative flex items-center justify-between p-4 bg-slate-950/40 rounded-2xl border border-white/5 hover:border-emerald-500/20 hover:bg-slate-950/60 transition-all duration-300"
              >
                {/* Ranking Medal/Number */}
                <div className="flex items-center gap-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs ${
                    idx === 0 ? 'bg-amber-400/20 text-amber-400 border border-amber-400/30' :
                    idx === 1 ? 'bg-slate-300/20 text-slate-300 border border-slate-300/30' :
                    idx === 2 ? 'bg-amber-700/20 text-amber-600 border border-amber-700/30' :
                    'bg-slate-800/40 text-slate-400 border border-white/5'
                  }`}>
                    {idx + 1}
                  </div>
                  
                  <div className="flex flex-col">
                    <span className="text-xs font-black text-white uppercase tracking-tight truncate max-w-[180px]">
                      {actor.name}
                    </span>
                    <span className="text-[8px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">
                      {actor.kpisCount} KPIs asignados • Atraso: {actor.stalenessDays}d prom
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Capture Rate Badge */}
                  <span className={`text-[9px] font-black px-2 py-1 rounded-md border ${getCaptureBadgeColor(actor.captureRate)}`}>
                    {actor.captureRate}% Cap.
                  </span>

                  {/* Health Score */}
                  <div className="text-right">
                    <span className={`text-sm font-black tabular-nums tracking-tighter ${getHealthColor(actor.healthScore)}`}>
                      {actor.healthScore}%
                    </span>
                    <span className="block text-[7px] text-slate-500 font-black uppercase tracking-widest leading-none">
                      Salud
                    </span>
                  </div>
                </div>
              </div>
            ))}
            {activeRankings.top.length === 0 && (
              <div className="text-center py-8 text-[10px] font-black uppercase tracking-widest text-slate-600">
                Sin datos disponibles
              </div>
            )}
          </div>
        </div>

        {/* COLUMNA 2: TOP ATRASADOS / RIESGO */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-white/5 pb-3">
            <span className="text-lg">⚠️</span>
            <div className="flex flex-col">
              <h4 className="text-xs font-black text-white uppercase tracking-wider">
                Top Atrasados o con Rezago
              </h4>
              <span className="text-[8px] font-bold text-rose-400 uppercase tracking-widest mt-0.5">
                Mayor retraso en carga y riesgo operativo
              </span>
            </div>
          </div>

          <div className="space-y-3">
            {activeRankings.delayed.slice(0, 5).map((actor, idx) => (
              <div
                key={`${actor.name}-del-${idx}`}
                className="group relative flex items-center justify-between p-4 bg-slate-950/40 rounded-2xl border border-white/5 hover:border-rose-500/20 hover:bg-slate-950/60 transition-all duration-300"
              >
                {/* Ranking Badge */}
                <div className="flex items-center gap-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs ${
                    idx === 0 ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40' :
                    idx === 1 ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
                    idx === 2 ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30' :
                    'bg-slate-800/40 text-slate-400 border border-white/5'
                  }`}>
                    {idx + 1}
                  </div>
                  
                  <div className="flex flex-col">
                    <span className="text-xs font-black text-white uppercase tracking-tight truncate max-w-[180px]">
                      {actor.name}
                    </span>
                    <span className="text-[8px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">
                      {actor.kpisCount} KPIs asignados • Atraso: {actor.stalenessDays}d prom
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Capture Rate Badge */}
                  <span className={`text-[9px] font-black px-2 py-1 rounded-md border ${getCaptureBadgeColor(actor.captureRate)}`}>
                    {actor.captureRate}% Cap.
                  </span>

                  {/* Health Score */}
                  <div className="text-right">
                    <span className={`text-sm font-black tabular-nums tracking-tighter ${getHealthColor(actor.healthScore)}`}>
                      {actor.healthScore}%
                    </span>
                    <span className="block text-[7px] text-slate-500 font-black uppercase tracking-widest leading-none">
                      Salud
                    </span>
                  </div>
                </div>
              </div>
            ))}
            {activeRankings.delayed.length === 0 && (
              <div className="text-center py-8 text-[10px] font-black uppercase tracking-widest text-slate-600">
                Sin datos disponibles
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
});
