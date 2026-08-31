import React, { useState, useMemo } from 'react';
import { Settings, Layers, Target, Compass, Plus, Info, CheckCircle2, AlertTriangle, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import {
  StrategicPerspective,
  StrategicObjective,
  AreaStrategyConfig,
  ContributionObjective,
  ContributionIndicatorAssignment,
  StrategicObjectiveRelationship,
  DEFAULT_PERSPECTIVES,
  deriveAreaCodeSuggestion,
  resolveAreaStrategyConfig
} from '../../strategyTypes';
import { Dashboard as DashboardType, User, GlobalUserRole } from '../../types';
import { calculateCompliance } from '../../utils/compliance';
import { ContributionDetailModal } from './ContributionDetailModal';
import { StrategyConfigModal } from './StrategyConfigModal';
import { StrategyMapView } from './StrategyMapView';

export interface ContributionMatrixViewProps {
  perspectives: StrategicPerspective[];
  objectives: StrategicObjective[];
  areaConfigs: AreaStrategyConfig[];
  contributionObjectives: ContributionObjective[];
  assignments: ContributionIndicatorAssignment[];
  relationships?: StrategicObjectiveRelationship[];
  dashboards: DashboardType[];
  selectedClientId: string;
  currentUser?: User;
  onRefreshData: () => Promise<void>;
  onSaveRelationship?: (rel: { sourceStrategicObjectiveId: string; targetStrategicObjectiveId: string; description?: string }) => Promise<void>;
  onDeleteRelationship?: (relationshipId: string) => Promise<void>;
  onNavigateToDashboard?: (dashboardId: number | string, itemId: number | string) => void;
}

/**
 * Vista de Matriz de Contribución Estratégica (BSC / Fundamentos de Estrategia).
 *
 * - Filas: Perspectiva -> Objetivos Estratégicos (OE).
 * - Columnas: Áreas organizacionales de negocio.
 * - Celda vacía: Muestra "No contribuye" (sin persistir datos ficticios).
 * - Celda poblada: Soporta explícitamente MÚLTIPLES Objetivos de Contribución (OC).
 * - Múltiples KPIs: NO promedia porcentajes entre indicadores heterogéneos. Despliega distribución por estatus.
 * - Mapeo de Aliases: Resuelve columnas y OCs utilizando resolveAreaStrategyConfig.
 */
export const ContributionMatrixView: React.FC<ContributionMatrixViewProps> = ({
  perspectives = DEFAULT_PERSPECTIVES,
  objectives = [],
  areaConfigs = [],
  contributionObjectives = [],
  assignments = [],
  relationships = [],
  dashboards = [],
  selectedClientId,
  currentUser,
  onRefreshData,
  onSaveRelationship,
  onDeleteRelationship,
  onNavigateToDashboard,
}) => {
  const isAdmin = currentUser?.globalRole === GlobalUserRole.Admin;

  const [subView, setSubView] = useState<'matrix' | 'map'>('map');
  const [selectedOCForDetail, setSelectedOCForDetail] = useState<ContributionObjective | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [selectedAreaFilter, setSelectedAreaFilter] = useState<string>('TODAS');

  const handleCloseConfig = async () => {
    setShowConfigModal(false);
    await onRefreshData();
  };

  // Obtener todas las áreas únicas activas de los tableros
  const activeAreas = useMemo(() => {
    const set = new Set<string>();
    dashboards.forEach(d => {
      if (d.area && d.area.trim()) {
        set.add(d.area.trim().toUpperCase());
      }
    });
    const sorted = Array.from(set).sort();
    return sorted.length > 0 ? sorted : ['OPERACIONES', 'COMERCIAL', 'FINANZAS'];
  }, [dashboards]);

  // Filtrar áreas según selección de la barra superior
  const visibleAreas = useMemo(() => {
    if (selectedAreaFilter === 'TODAS') return activeAreas;
    return activeAreas.filter(a => a === selectedAreaFilter);
  }, [activeAreas, selectedAreaFilter]);

  // Usar perspectivas pasadas o fallback a las 4 por defecto
  const activePerspectives = perspectives.length > 0 ? perspectives : DEFAULT_PERSPECTIVES;

  // Resolver KPIs vinculados para un OC específico (Solo Lectura)
  const getLinkedKpisForOC = (ocId: string) => {
    const ocAssignments = assignments.filter(a => a.contributionObjectiveId === ocId);
    const result: { dashboard: DashboardType; item: any }[] = [];

    ocAssignments.forEach(asgn => {
      const dbMatch = dashboards.find(d => String(d.id) === String(asgn.dashboardId));
      if (dbMatch) {
        const itemMatch = (dbMatch.items || []).find(it => String(it.id) === String(asgn.itemId));
        if (itemMatch) {
          result.push({ dashboard: dbMatch, item: itemMatch });
        }
      }
    });

    return result;
  };

  // Calcular métricas de resumen para un OC sin promediar porcentajes si hay múltiples KPIs
  const getOCSummaryMetrics = (ocId: string) => {
    const linked = getLinkedKpisForOC(ocId);

    if (linked.length === 0) {
      return { kpiCount: 0, mode: 'none' as const, singleCompliance: null, onTrackCount: 0, atRiskCount: 0, offTrackCount: 0 };
    }

    if (linked.length === 1) {
      const first = linked[0];
      const applicableThresholds = first.item.thresholds || first.dashboard.thresholds || { onTrack: 95, atRisk: 85 };
      const compResult = calculateCompliance(first.item, applicableThresholds, undefined, 'realTime', first.dashboard.items || []);
      const comp = compResult?.overallPercentage;
      return {
        kpiCount: 1,
        mode: 'single' as const,
        singleCompliance: comp,
        onTrackCount: comp !== null && comp !== undefined && comp >= 95 ? 1 : 0,
        atRiskCount: comp !== null && comp !== undefined && comp >= 85 && comp < 95 ? 1 : 0,
        offTrackCount: comp !== null && comp !== undefined && comp < 85 ? 1 : 0
      };
    }

    let onTrackCount = 0;
    let atRiskCount = 0;
    let offTrackCount = 0;

    linked.forEach(({ dashboard, item }) => {
      const applicableThresholds = item.thresholds || dashboard.thresholds || { onTrack: 95, atRisk: 85 };
      const compResult = calculateCompliance(item, applicableThresholds, undefined, 'realTime', dashboard.items || []);
      const comp = compResult?.overallPercentage;
      if (comp !== null && comp !== undefined) {
        if (comp >= 95) onTrackCount++;
        else if (comp >= 85) atRiskCount++;
        else offTrackCount++;
      }
    });

    return {
      kpiCount: linked.length,
      mode: 'multiple' as const,
      singleCompliance: null,
      onTrackCount,
      atRiskCount,
      offTrackCount
    };
  };

  return (
    <div className="space-y-6">

      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded">
              v9.5.1
            </span>
            <span className="text-xs font-semibold text-slate-400">BSC & Fundamentos de Estrategia</span>
          </div>
          <h1 className="text-2xl font-black text-white mt-1 tracking-tight">Estrategia Organizacional (BSC)</h1>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl">
            Visualización de relaciones causa-efecto en el Mapa Estratégico y alineación de Objetivos de Contribución por área.
          </p>

          {/* Selector de Sub-vistas (Pestañas) */}
          <div className="flex items-center gap-2 mt-4">
            <button
              onClick={() => setSubView('map')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
                subView === 'map'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              Mapa Estratégico (Causa-Efecto)
            </button>
            <button
              onClick={() => setSubView('matrix')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
                subView === 'matrix'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Matriz de Contribución
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 shrink-0">
          {subView === 'matrix' && (
            <select
              value={selectedAreaFilter}
              onChange={e => setSelectedAreaFilter(e.target.value)}
              className="bg-slate-950 border border-slate-700 text-xs font-semibold text-white rounded-lg px-3 py-2 focus:ring-emerald-500"
            >
              <option value="TODAS">Todas las Áreas ({activeAreas.length})</option>
              {activeAreas.map(a => (
                <option key={a} value={a}>Área: {a}</option>
              ))}
            </select>
          )}

          {isAdmin && (
            <button
              onClick={() => setShowConfigModal(true)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-emerald-950/40"
            >
              <Settings className="w-4 h-4" />
              Configurar Estrategia
            </button>
          )}
        </div>
      </div>

      {/* Renderizado según Sub-vista seleccionada (Mapa Estratégico o Matriz) */}
      {subView === 'map' ? (
        <StrategyMapView
          perspectives={activePerspectives}
          objectives={objectives}
          relationships={relationships}
          areaConfigs={areaConfigs}
          contributions={contributionObjectives}
          assignments={assignments}
          dashboards={dashboards}
          isAdmin={isAdmin}
          currentUser={currentUser}
          selectedClientId={selectedClientId}
          onRefreshData={onRefreshData}
          onSaveRelationship={onSaveRelationship}
          onDeleteRelationship={onDeleteRelationship}
          onNavigateToDashboard={onNavigateToDashboard}
        />
      ) : objectives.length === 0 ? (
        <div className="p-12 bg-slate-900 border border-slate-800 rounded-xl text-center space-y-4">
          <Compass className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-white">No hay Objetivos Estratégicos Configurados</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Configura las 4 perspectivas BSC y los Objetivos Estratégicos (OE) para visualizar la matriz de contribución organizacional.
          </p>
          {isAdmin && (
            <button
              onClick={() => setShowConfigModal(true)}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold"
            >
              Configurar Ahora
            </button>
          )}
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-slate-950 border-b border-slate-800">
                  <th className="p-4 text-xs font-black uppercase text-slate-400 w-80 sticky left-0 bg-slate-950 z-10">
                    Perspectiva / Objetivos Estratégicos (OE)
                  </th>
                  {visibleAreas.map(areaName => {
                    const cfg = resolveAreaStrategyConfig(areaName, areaConfigs);
                    const code = cfg?.code || deriveAreaCodeSuggestion(areaName);

                    return (
                      <th key={areaName} className="p-4 text-xs font-black uppercase text-slate-300 min-w-[220px]">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 font-mono text-[11px] bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded">
                            {code}
                          </span>
                          <span>{areaName}</span>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-800/60">
                {activePerspectives.map(p => {
                  const pObjectives = objectives.filter(o => o.perspectiveId === p.id);
                  if (pObjectives.length === 0) return null;

                  return (
                    <React.Fragment key={p.id}>
                      {/* Fila Encabezado de Perspectiva */}
                      <tr className="bg-slate-950/80 border-y border-slate-800">
                        <td
                          colSpan={visibleAreas.length + 1}
                          className="p-3 text-xs font-bold uppercase tracking-wider text-white"
                          style={{ borderLeft: `4px solid ${p.color || '#3B82F6'}` }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color || '#3B82F6' }} />
                              <span>Perspectiva: {p.name}</span>
                            </div>
                            {p.description && (
                              <span className="text-[10px] text-slate-400 font-normal italic hidden md:inline">
                                {p.description}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Filas de Objetivos Estratégicos (OE) */}
                      {pObjectives.map(oe => (
                        <tr key={oe.id} className="hover:bg-slate-950/40 transition-colors">
                          {/* Columna OE */}
                          <td className="p-4 align-top sticky left-0 bg-slate-900 border-r border-slate-800/80 z-10 space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded">
                                {oe.code}
                              </span>
                              <h4 className="text-xs font-bold text-white">{oe.title}</h4>
                            </div>
                            {oe.description && (
                              <p className="text-[11px] text-slate-400">{oe.description}</p>
                            )}
                          </td>

                          {/* Celdas por Área */}
                          {visibleAreas.map(areaName => {
                            const normArea = areaName.trim().toUpperCase();
                            const areaCfg = resolveAreaStrategyConfig(normArea, areaConfigs);

                            // Buscar OCs pertenecientes a este Área (por areaConfigId o por snapshot areaName/alias) y vinculados a este OE
                            const cellOCs = contributionObjectives.filter(
                              oc =>
                                ((areaCfg && oc.areaConfigId === areaCfg.id) ||
                                  oc.areaName.trim().toUpperCase() === normArea) &&
                                oc.primaryStrategicObjectiveId === oe.id
                            );

                            return (
                              <td key={areaName} className="p-3 align-top border-r border-slate-800/40">
                                {cellOCs.length === 0 ? (
                                  <div className="py-4 text-center">
                                    <span className="text-[11px] font-medium text-slate-600 italic">
                                      No contribuye
                                    </span>
                                  </div>
                                ) : (
                                  <div className="space-y-2">
                                    {cellOCs.map(oc => {
                                      const metrics = getOCSummaryMetrics(oc.id);

                                      return (
                                        <div
                                          key={oc.id}
                                          onClick={() => setSelectedOCForDetail(oc)}
                                          className="p-3 rounded-lg bg-slate-950 border border-slate-800 hover:border-blue-500/50 cursor-pointer transition-all hover:scale-[1.01] shadow-sm group space-y-2"
                                        >
                                          <div className="flex items-start justify-between gap-2">
                                            <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded shrink-0">
                                              {oc.displayCode}
                                            </span>
                                            <span className="text-[10px] font-semibold text-slate-400 group-hover:text-blue-400 transition-colors">
                                              Ver detalle →
                                            </span>
                                          </div>

                                          <h5 className="text-xs font-bold text-white line-clamp-2">{oc.title}</h5>

                                          {/* Métrica / Distribución sin promedios inventados */}
                                          <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-900">
                                            <span>{metrics.kpiCount} KPI{metrics.kpiCount !== 1 ? 's' : ''}</span>
                                            {metrics.mode === 'single' ? (
                                              <span
                                                className="font-bold"
                                                style={{
                                                  color: metrics.singleCompliance === null ? '#94A3B8' : metrics.singleCompliance >= 95 ? '#10B981' : metrics.singleCompliance >= 85 ? '#F59E0B' : '#EF4444'
                                                }}
                                              >
                                                {metrics.singleCompliance !== null ? `${metrics.singleCompliance.toFixed(1)}%` : 'N/D'}
                                              </span>
                                            ) : metrics.mode === 'multiple' ? (
                                              <div className="flex items-center gap-1.5 font-semibold text-[9px]">
                                                {metrics.onTrackCount > 0 && (
                                                  <span className="text-emerald-400" title={`${metrics.onTrackCount} KPI(s) Al día`}>
                                                    {metrics.onTrackCount} Al día
                                                  </span>
                                                )}
                                                {metrics.atRiskCount > 0 && (
                                                  <span className="text-amber-400" title={`${metrics.atRiskCount} KPI(s) En riesgo`}>
                                                    {metrics.atRiskCount} Atención
                                                  </span>
                                                )}
                                                {metrics.offTrackCount > 0 && (
                                                  <span className="text-red-400" title={`${metrics.offTrackCount} KPI(s) Fuera de meta`}>
                                                    {metrics.offTrackCount} Fuera
                                                  </span>
                                                )}
                                              </div>
                                            ) : (
                                              <span className="text-slate-500">Sin datos</span>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal de Detalle READ-ONLY */}
      {selectedOCForDetail && (
        <ContributionDetailModal
          oc={selectedOCForDetail}
          oe={objectives.find(o => o.id === selectedOCForDetail.primaryStrategicObjectiveId) || null}
          perspective={activePerspectives.find(p => p.id === (objectives.find(o => o.id === selectedOCForDetail.primaryStrategicObjectiveId)?.perspectiveId)) || null}
          linkedKpis={getLinkedKpisForOC(selectedOCForDetail.id)}
          onClose={() => setSelectedOCForDetail(null)}
          onNavigateToDashboard={onNavigateToDashboard}
        />
      )}

      {/* Modal de Configuración Administrativa */}
      {showConfigModal && (
        <StrategyConfigModal
          perspectives={activePerspectives}
          objectives={objectives}
          areaConfigs={areaConfigs}
          contributionObjectives={contributionObjectives}
          assignments={assignments}
          dashboards={dashboards}
          selectedClientId={selectedClientId}
          currentUser={currentUser}
          onClose={handleCloseConfig}
          onRefreshData={onRefreshData}
        />
      )}

    </div>
  );
};
