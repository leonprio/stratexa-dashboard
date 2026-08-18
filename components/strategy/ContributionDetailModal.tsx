import React from 'react';
import { X, ExternalLink, Target, Building2, Compass, Layers, CheckCircle2, AlertTriangle, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { ContributionObjective, StrategicObjective, StrategicPerspective } from '../../strategyTypes';
import { DashboardItem, Dashboard as DashboardType } from '../../types';
import { formatNumberWithCommas } from '../../utils/formatters';
import { calculateCompliance } from '../../utils/compliance';

export interface ContributionDetailModalProps {
  oc: ContributionObjective | null;
  oe: StrategicObjective | null;
  perspective: StrategicPerspective | null;
  linkedKpis: { dashboard: DashboardType; item: DashboardItem }[];
  onClose: () => void;
  onNavigateToDashboard?: (dashboardId: number | string, itemId: number | string) => void;
}

/**
 * Modal de Detalle del Objetivo de Contribución (OC).
 *
 * 🚨 REGLA VISTA READ-ONLY: Este modal es strictly de SOLO LECTURA.
 * No genera caminos alternativos de edición para Metas, Reales, Fórmulas, PAI o Actividades.
 * La edición de KPIs se realiza únicamente en la vista original del tablero.
 */
export const ContributionDetailModal: React.FC<ContributionDetailModalProps> = ({
  oc,
  oe,
  perspective,
  linkedKpis,
  onClose,
  onNavigateToDashboard,
}) => {
  if (!oc) return null;

  // Evaluación individual/distribución de estatus de KPIs vinculados (solo lectura)
  const defaultThresholds = { onTrack: 95, atRisk: 85 };

  const kpiEvaluations = linkedKpis.map(({ item }) => {
    const compResult = calculateCompliance(item, defaultThresholds);
    return compResult;
  });

  const onTrackCount = kpiEvaluations.filter(e => e.overallPercentage >= 95).length;
  const atRiskCount = kpiEvaluations.filter(e => e.overallPercentage >= 85 && e.overallPercentage < 95).length;
  const offTrackCount = kpiEvaluations.filter(e => e.overallPercentage < 85).length;

  const singleCompliance = linkedKpis.length === 1 ? kpiEvaluations[0]?.overallPercentage : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

        {/* Modal Header */}
        <div className="p-6 border-b border-slate-800 bg-slate-950 flex justify-between items-start">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1 text-xs font-bold tracking-wider rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20">
                {oc.displayCode}
              </span>
              <span className="px-2.5 py-0.5 text-xs font-semibold rounded-md bg-slate-800 text-slate-300 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                {oc.areaName}
              </span>
              {perspective && (
                <span
                  className="px-2.5 py-0.5 text-xs font-semibold rounded-md text-white flex items-center gap-1.5"
                  style={{ backgroundColor: perspective.color || '#3B82F6' }}
                >
                  <Compass className="w-3.5 h-3.5" />
                  {perspective.name}
                </span>
              )}
            </div>
            <h2 className="text-xl font-black text-white tracking-tight">{oc.title}</h2>
            {oc.description && (
              <p className="text-xs text-slate-400 leading-relaxed max-w-2xl">{oc.description}</p>
            )}
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-200">

          {/* OE Vinculado */}
          {oe && (
            <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-start gap-3">
              <Target className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-[10px] font-bold tracking-widest text-emerald-400 uppercase">
                  Objetivo Estratégico Primario ({oe.code})
                </span>
                <h4 className="text-sm font-bold text-white mt-0.5">{oe.title}</h4>
                {oe.description && (
                  <p className="text-xs text-slate-400 mt-1">{oe.description}</p>
                )}
              </div>
            </div>
          )}

          {/* Resumen de Cumplimiento / Estatus (Solo Lectura) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-xs font-medium text-slate-400">KPIs Vinculados</span>
                <div className="text-2xl font-black text-white mt-1">{linkedKpis.length}</div>
              </div>
              <Layers className="w-8 h-8 text-slate-600" />
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-xs font-medium text-slate-400">Desempeño Operativo</span>
                {linkedKpis.length === 1 ? (
                  <div className="text-2xl font-black mt-1" style={{
                    color: singleCompliance === null ? '#94A3B8' : singleCompliance >= 95 ? '#10B981' : singleCompliance >= 85 ? '#F59E0B' : '#EF4444'
                  }}>
                    {singleCompliance !== null ? `${singleCompliance.toFixed(1)}%` : 'N/D'}
                  </div>
                ) : linkedKpis.length > 1 ? (
                  <div className="text-xs font-bold text-slate-200 mt-2 space-y-0.5">
                    {onTrackCount > 0 && <span className="text-emerald-400 block">{onTrackCount} Al día (≥95%)</span>}
                    {atRiskCount > 0 && <span className="text-amber-400 block">{atRiskCount} Atención (85-94%)</span>}
                    {offTrackCount > 0 && <span className="text-red-400 block">{offTrackCount} Fuera de meta (&lt;85%)</span>}
                  </div>
                ) : (
                  <div className="text-sm font-bold text-slate-500 mt-1">Sin Datos</div>
                )}
              </div>
              {linkedKpis.length === 1 && singleCompliance !== null && singleCompliance >= 95 ? (
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
              ) : (
                <AlertTriangle className="w-8 h-8 text-amber-500" />
              )}
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-xs font-medium text-slate-400">Estado de Seguimiento</span>
                <div className="text-sm font-bold text-slate-300 mt-1">
                  {linkedKpis.length > 0 ? 'En Seguimiento' : 'Sin KPIs Asignados'}
                </div>
              </div>
              <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
            </div>
          </div>

          {/* Lista de Indicadores Operativos Vinculados */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
              Indicadores Operativos Asociados (Solo Lectura)
            </h3>

            {linkedKpis.length === 0 ? (
              <div className="p-8 text-center bg-slate-950/40 rounded-xl border border-slate-800/60 text-slate-500 text-sm">
                No hay indicadores operativos vinculados a este Objetivo de Contribución.
              </div>
            ) : (
              <div className="space-y-3">
                {linkedKpis.map(({ dashboard, item }) => {
                  const compResult = calculateCompliance(item, defaultThresholds);
                  const currentGoal = compResult.currentTarget;
                  const currentProgress = compResult.currentProgress;
                  const comp = compResult.overallPercentage;

                  return (
                    <div
                      key={`${dashboard.id}_${item.id}`}
                      className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 hover:border-slate-700 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="space-y-1 max-w-md">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-semibold text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                            {dashboard.title}
                          </span>
                          <span className="text-[10px] text-slate-500">ID: {item.id}</span>
                        </div>
                        <h4 className="text-sm font-bold text-white">{item.indicator}</h4>
                        <div className="text-xs text-slate-400 flex items-center gap-3">
                          <span>Unidad: <strong className="text-slate-300">{item.unit || '-'}</strong></span>
                          <span>Tipo: <strong className="text-slate-300">{item.type}</strong></span>
                        </div>
                      </div>

                      {/* Métricas Operativas */}
                      <div className="flex items-center gap-6 text-right shrink-0">
                        <div>
                          <div className="text-[10px] text-slate-400 uppercase font-semibold">Meta (Mes)</div>
                          <div className="text-xs font-bold text-slate-200">
                            {currentGoal !== null && currentGoal !== undefined ? formatNumberWithCommas(currentGoal) : 'N/D'}
                          </div>
                        </div>

                        <div>
                          <div className="text-[10px] text-slate-400 uppercase font-semibold">Real (Mes)</div>
                          <div className="text-xs font-bold text-slate-200">
                            {currentProgress !== null && currentProgress !== undefined ? formatNumberWithCommas(currentProgress) : 'N/D'}
                          </div>
                        </div>

                        <div>
                          <div className="text-[10px] text-slate-400 uppercase font-semibold">Cumplimiento</div>
                          <div className="text-xs font-black" style={{
                            color: comp === null ? '#94A3B8' : comp >= 95 ? '#10B981' : comp >= 85 ? '#F59E0B' : '#EF4444'
                          }}>
                            {comp !== null ? `${comp.toFixed(1)}%` : 'N/D'}
                          </div>
                        </div>

                        {/* Botón Navegar al Tablero Original */}
                        {onNavigateToDashboard && (
                          <button
                            onClick={() => onNavigateToDashboard(dashboard.id, item.id)}
                            className="p-2 rounded-lg bg-blue-600/10 text-blue-400 hover:bg-blue-600/20 border border-blue-500/20 transition-all flex items-center gap-1 text-xs font-semibold ml-2"
                            title="Ir al tablero original para editar"
                          >
                            <ExternalLink className="w-4 h-4" />
                            <span className="hidden sm:inline">Ver en Tablero</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 text-xs font-bold transition-all"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
