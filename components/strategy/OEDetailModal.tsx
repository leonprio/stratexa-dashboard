import React, { useState } from 'react';
import { X, ArrowUpRight, ArrowDownRight, Target, Layers, CheckCircle2, AlertTriangle, Info, Compass } from 'lucide-react';
import {
  StrategicObjective,
  StrategicPerspective,
  StrategicObjectiveRelationship,
  ContributionObjective,
  ContributionIndicatorAssignment,
  AreaStrategyConfig
} from '../../strategyTypes';
import { Dashboard as DashboardType, User } from '../../types';
import { calculateCompliance } from '../../utils/compliance';
import { StrategyConfigModal } from './StrategyConfigModal';

export interface OEDetailModalProps {
  objective: StrategicObjective | null;
  perspective?: StrategicPerspective;
  allObjectives: StrategicObjective[];
  relationships: StrategicObjectiveRelationship[];
  contributions?: ContributionObjective[];
  assignments?: ContributionIndicatorAssignment[];
  dashboards?: DashboardType[];
  areaConfigs?: AreaStrategyConfig[];
  selectedClientId?: string;
  currentUser?: User;
  onRefreshData?: () => Promise<void>;
  onClose: () => void;
  onNavigateToDashboard?: (dashboardId: number | string, itemId: number | string) => void;
}

/**
 * Modal de Detalle de Lectura de Objetivo Estratégico (OE).
 *
 * Muestra:
 * - Perspectiva, Código, Título y Descripción del OE.
 * - Red de Causa y Efecto: Relaciones aguas arriba (Causas) y aguas abajo (Efectos).
 * - Objetivos de Contribución vinculados y sus KPIs (si existen).
 * - Funciona perfectamente en Escenario A (sin OCs) y Escenario B (con OCs).
 */
export const OEDetailModal: React.FC<OEDetailModalProps> = ({
  objective,
  perspective,
  allObjectives = [],
  relationships = [],
  contributions = [],
  assignments = [],
  dashboards = [],
  areaConfigs = [],
  onClose,
  onNavigateToDashboard,
  selectedClientId,
  currentUser,
  onRefreshData
}) => {
  const [showOCManager, setShowOCManager] = useState(false);
  if (!objective) return null;

  const nodeColor = perspective?.color || '#3B82F6';

  // Relaciones aguas arriba (Causas: OEs que contribuyen A ESTE OE)
  const upstreamCauses = relationships
    .filter(r => r.targetStrategicObjectiveId === objective.id)
    .map(r => {
      const sourceOE = allObjectives.find(o => o.id === r.sourceStrategicObjectiveId);
      return { rel: r, oe: sourceOE };
    })
    .filter(item => Boolean(item.oe));

  // Relaciones aguas abajo (Efectos: OEs A LOS QUE CONTRIBUYE ESTE OE)
  const downstreamEffects = relationships
    .filter(r => r.sourceStrategicObjectiveId === objective.id)
    .map(r => {
      const targetOE = allObjectives.find(o => o.id === r.targetStrategicObjectiveId);
      return { rel: r, oe: targetOE };
    })
    .filter(item => Boolean(item.oe));

  // OCs vinculados
  const oeOCs = contributions.filter(c => c.primaryStrategicObjectiveId === objective.id && c.status !== 'inactive');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Cabecera Modal con Banda de Perspectiva */}
        <div
          className="p-5 border-b border-slate-100 flex items-start justify-between relative"
          style={{ borderTopWidth: '6px', borderTopColor: nodeColor }}
        >
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span
                className="px-2.5 py-0.5 rounded-md text-xs font-bold tracking-wide"
                style={{ backgroundColor: `${nodeColor}18`, color: nodeColor }}
              >
                {objective.code}
              </span>
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                {perspective?.name || 'Perspectiva Estratégica'}
              </span>
            </div>
            <h3 className="text-xl font-bold text-slate-900 leading-snug">
              {objective.title}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cuerpo del Modal con Desplazamiento Interno */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-700">
          {/* Descripción del OE si existe */}
          {objective.description && (
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
              <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Descripción</h5>
              <p className="text-sm text-slate-700 leading-relaxed">{objective.description}</p>
            </div>
          )}

          {/* Sección 1: Red de Causa y Efecto */}
          <div>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Compass className="w-4 h-4 text-indigo-500" />
              Red de Causa y Efecto (Alineación BSC)
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Causas (Upstream) */}
              <div className="bg-amber-50/50 rounded-xl p-4 border border-amber-200/60">
                <h5 className="text-xs font-semibold text-amber-900 flex items-center gap-1.5 mb-2">
                  <ArrowUpRight className="w-4 h-4 text-amber-600" />
                  Impactos Recibidos (Causas: {upstreamCauses.length})
                </h5>
                {upstreamCauses.length > 0 ? (
                  <ul className="space-y-2 text-xs">
                    {upstreamCauses.map(({ rel, oe }) => (
                      <li key={rel.id} className="bg-white rounded-lg p-2.5 border border-amber-100 shadow-2xl shadow-amber-900/5">
                        <div className="font-bold text-amber-950 flex items-center justify-between">
                          <span>{oe?.code} - {oe?.title}</span>
                        </div>
                        {rel.description && (
                          <p className="text-[11px] text-amber-800 mt-1 italic">{rel.description}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-amber-700/70 italic">No recibe impulso causal directo de otros objetivos.</p>
                )}
              </div>

              {/* Efectos (Downstream) */}
              <div className="bg-emerald-50/50 rounded-xl p-4 border border-emerald-200/60">
                <h5 className="text-xs font-semibold text-emerald-900 flex items-center gap-1.5 mb-2">
                  <ArrowDownRight className="w-4 h-4 text-emerald-600" />
                  Impactos Generados (Efectos: {downstreamEffects.length})
                </h5>
                {downstreamEffects.length > 0 ? (
                  <ul className="space-y-2 text-xs">
                    {downstreamEffects.map(({ rel, oe }) => (
                      <li key={rel.id} className="bg-white rounded-lg p-2.5 border border-emerald-100 shadow-2xl shadow-emerald-900/5">
                        <div className="font-bold text-emerald-950 flex items-center justify-between">
                          <span>{oe?.code} - {oe?.title}</span>
                        </div>
                        {rel.description && (
                          <p className="text-[11px] text-emerald-800 mt-1 italic">{rel.description}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-emerald-700/70 italic">No impulsa directamente a otros objetivos en esta versión.</p>
                )}
              </div>
            </div>
          </div>

          {/* Sección 2: Objetivos de Contribución y Despliegue Operativo */}
          <div>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Target className="w-4 h-4 text-blue-500" />
              Despliegue Operativo por Área ({oeOCs.length} Objetivos de Contribución)
            </h4>

            {oeOCs.length > 0 ? (
              <div className="space-y-3">
                {oeOCs.map(oc => {
                  const ocAssignments = assignments.filter(a => a.contributionObjectiveId === oc.id);
                  const linkedKpis: { dashboard: DashboardType; item: any }[] = [];

                  ocAssignments.forEach(asgn => {
                    const dbMatch = dashboards.find(d => String(d.id) === String(asgn.dashboardId));
                    if (dbMatch) {
                      const itemMatch = (dbMatch.items || []).find(it => String(it.id) === String(asgn.itemId));
                      if (itemMatch) linkedKpis.push({ dashboard: dbMatch, item: itemMatch });
                    }
                  });

                  return (
                    <div key={oc.id} className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="bg-blue-100 text-blue-800 text-xs font-mono font-bold px-2 py-0.5 rounded">
                            {oc.displayCode}
                          </span>
                          <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                            {oc.areaName}
                          </span>
                        </div>
                      </div>
                      <h5 className="text-sm font-semibold text-slate-800 mb-2">{oc.title}</h5>

                      {/* Lista de KPIs vinculados al OC */}
                      {linkedKpis.length > 0 ? (
                        <div className="mt-2 space-y-1.5">
                          {linkedKpis.map(({ dashboard, item }) => {
                            const applicableThresholds = item.thresholds || dashboard.thresholds || { onTrack: 95, atRisk: 85 };
                            const compResult = calculateCompliance(item, applicableThresholds, undefined, 'realTime', dashboard.items || []);
                            const comp = compResult?.overallPercentage;
                            let badge = <span className="text-slate-400 text-xs">-</span>;

                            if (comp !== null && comp !== undefined) {
                              if (comp >= 95) {
                                badge = (
                                  <span className="inline-flex items-center text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                                    <CheckCircle2 className="w-3 h-3 mr-1" /> {comp.toFixed(1)}%
                                  </span>
                                );
                              } else if (comp >= 85) {
                                badge = (
                                  <span className="inline-flex items-center text-xs font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                                    <AlertTriangle className="w-3 h-3 mr-1" /> {comp.toFixed(1)}%
                                  </span>
                                );
                              } else {
                                badge = (
                                  <span className="inline-flex items-center text-xs font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full">
                                    <Info className="w-3 h-3 mr-1" /> {comp.toFixed(1)}%
                                  </span>
                                );
                              }
                            }

                            return (
                              <div
                                key={`${dashboard.id}_${item.id}`}
                                onClick={() => onNavigateToDashboard && onNavigateToDashboard(dashboard.id, item.id)}
                                className="flex items-center justify-between bg-white rounded-lg p-2 border border-slate-200 text-xs hover:border-blue-400 transition-colors cursor-pointer"
                              >
                                <div className="truncate pr-2">
                                  <span className="font-semibold text-slate-700">{item.name || item.indicador}</span>
                                  <span className="text-slate-400 ml-2 text-[11px]">({dashboard.title})</span>
                                </div>
                                {badge}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic">Sin indicadores KPI operativos asociados.</p>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-slate-50 rounded-xl p-4 border border-dashed border-slate-200 text-center space-y-3">
                <p className="text-xs text-slate-500">
                  No hay Objetivos de Contribución registrados.
                </p>
                {currentUser && selectedClientId && onRefreshData && (
                  <button type="button" onClick={() => setShowOCManager(true)} className="inline-flex items-center px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-500">
                    + AGREGAR OBJETIVO DE CONTRIBUCIÓN
                  </button>
                )}
              </div>
            )}
            {oeOCs.length > 0 && currentUser && selectedClientId && onRefreshData && (
              <button type="button" onClick={() => setShowOCManager(true)} className="mt-3 inline-flex items-center px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-500">
                + AGREGAR OBJETIVO DE CONTRIBUCIÓN
              </button>
            )}
          </div>
        </div>

        {/* Pie del Modal */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 transition-colors shadow-sm"
          >
            Cerrar
          </button>
        </div>
      </div>
      {showOCManager && currentUser && selectedClientId && onRefreshData && (
        <StrategyConfigModal
          perspectives={perspective ? [perspective] : []}
          objectives={allObjectives}
          areaConfigs={areaConfigs}
          contributionObjectives={oeOCs}
          assignments={assignments}
          dashboards={dashboards}
          selectedClientId={selectedClientId}
          currentUser={currentUser}
          initialObjectiveId={objective.id}
          onClose={() => setShowOCManager(false)}
          onRefreshData={async () => { await onRefreshData(); }}
        />
      )}
    </div>
  );
};
