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
import { Dashboard as DashboardType, User, GlobalUserRole } from '../../types';
import { calculateCompliance } from '../../utils/compliance';
import { StrategyConfigModal } from './StrategyConfigModal';
import { strategyService } from '../../services/strategyService';

export interface OEDetailModalProps {
  objective: StrategicObjective | null;
  perspective?: StrategicPerspective;
  perspectives?: StrategicPerspective[];
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
  perspectives = [],
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
  const [showEditOE, setShowEditOE] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(false);
  const [loadingOE, setLoadingOE] = useState(false);
  const [oeError, setOeError] = useState<string | null>(null);
  const [showDirectAlignment, setShowDirectAlignment] = useState(false);
  const [directKpis, setDirectKpis] = useState<string[]>([]);
  const [kpiSearch, setKpiSearch] = useState('');
  const [editPerspectiveId, setEditPerspectiveId] = useState(objective.perspectiveId);
  const [editTitle, setEditTitle] = useState(objective.title);
  const [editDescription, setEditDescription] = useState(objective.description || '');

  const canManageOE = currentUser?.globalRole === GlobalUserRole.Admin && Boolean(selectedClientId && onRefreshData);

  const allKpis = dashboards.flatMap(d => (d.items || []).map(item => ({ dashboard: d, item })));
  const currentDirectKeys = new Set(assignments.filter(a => a.strategicObjectiveId === objective?.id).map(a => `${a.dashboardId}_${a.itemId}`));
  const ocOwnerById = new Map(contributions.map(oc => [oc.id, oc.primaryStrategicObjectiveId]));
  const occupiedByOtherOE = new Set(assignments.filter(a => {
    const owner = a.strategicObjectiveId || (a.contributionObjectiveId ? ocOwnerById.get(a.contributionObjectiveId) : undefined);
    return owner && owner !== objective?.id;
  }).map(a => `${a.dashboardId}_${a.itemId}`));
  const viaCurrentOC = new Set(assignments.filter(a => a.contributionObjectiveId && ocOwnerById.get(a.contributionObjectiveId) === objective?.id).map(a => `${a.dashboardId}_${a.itemId}`));
  const visibleKpis = allKpis.filter(({ dashboard, item }) => {
    const key = `${dashboard.id}_${item.id}`;
    if (occupiedByOtherOE.has(key) || viaCurrentOC.has(key)) return false;
    const text = `${item.indicator || item.name || ''} ${dashboard.title || ''}`.toLowerCase();
    return text.includes(kpiSearch.toLowerCase());
  });
  const openDirectAlignment = () => {
    setDirectKpis(Array.from(currentDirectKeys));
    setKpiSearch('');
    setOeError(null);
    setShowDirectAlignment(true);
  };
  const saveDirectAlignment = async () => {
    if (!selectedClientId || !onRefreshData) return;
    try {
      setLoadingOE(true);
      await strategyService.saveDirectAssignmentsForOE(objective.id, directKpis.map(key => { const [dashboardId, itemId] = key.split('_'); return { dashboardId, itemId }; }), selectedClientId);
      await onRefreshData();
      setShowDirectAlignment(false);
    } catch (error: any) {
      setOeError(error.message || 'No fue posible alinear los indicadores.');
    } finally { setLoadingOE(false); }
  };

  const openEditOE = () => {
    setEditPerspectiveId(objective.perspectiveId);
    setEditTitle(objective.title);
    setEditDescription(objective.description || '');
    setOeError(null);
    setShowEditOE(true);
  };

  const saveEditedOE = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canManageOE || !onRefreshData || !selectedClientId || !editTitle.trim()) return;
    try {
      setLoadingOE(true);
      setOeError(null);
      await strategyService.saveStrategicObjective({
        id: objective.id,
        perspectiveId: editPerspectiveId,
        code: objective.code,
        title: editTitle.trim(),
        description: editDescription.trim(),
        order: objective.order,
        clientId: selectedClientId
      });
      await onRefreshData();
      setShowEditOE(false);
    } catch (error: any) {
      setOeError(error.message || 'No fue posible actualizar el objetivo estratégico.');
    } finally {
      setLoadingOE(false);
    }
  };

  const deleteOE = async () => {
    if (!canManageOE || !onRefreshData || !selectedClientId) return;
    try {
      setLoadingOE(true);
      setOeError(null);
      await strategyService.deleteStrategicObjective(objective.id, selectedClientId);
      setPendingDelete(false);
      onClose();
      await onRefreshData();
    } catch (error: any) {
      setOeError(error.message || 'No fue posible eliminar el objetivo estratégico.');
      setPendingDelete(false);
    } finally {
      setLoadingOE(false);
    }
  };
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
            {canManageOE && (
              <div className="flex items-center gap-2 mt-3">
                <button type="button" onClick={openDirectAlignment} className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-[11px] font-bold hover:bg-indigo-500">ALINEAR INDICADORES</button>
                <button type="button" onClick={openEditOE} className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-[11px] font-bold hover:bg-blue-500">EDITAR OBJETIVO</button>
                <button type="button" onClick={() => { setOeError(null); setPendingDelete(true); }} className="px-3 py-1.5 rounded-lg bg-red-50 text-red-700 border border-red-200 text-[11px] font-bold hover:bg-red-100">ELIMINAR OBJETIVO</button>
              </div>
            )}
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
      {showEditOE && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/50 p-6">
          <form onSubmit={saveEditedOE} className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">Editar objetivo estratégico</h3>
            <div><label className="text-xs font-semibold text-slate-600">Código</label><input value={objective.code} readOnly className="w-full mt-1 rounded-lg border border-slate-200 bg-slate-100 p-2 text-xs font-mono text-slate-600" /></div>
            <div><label className="text-xs font-semibold text-slate-600">Perspectiva</label><select value={editPerspectiveId} onChange={e => setEditPerspectiveId(e.target.value)} className="w-full mt-1 rounded-lg border border-slate-200 p-2 text-xs text-slate-800">{perspectives.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
            <div><label className="text-xs font-semibold text-slate-600">Título</label><input required value={editTitle} onChange={e => setEditTitle(e.target.value)} className="w-full mt-1 rounded-lg border border-slate-200 p-2 text-xs text-slate-800" /></div>
            <div><label className="text-xs font-semibold text-slate-600">Descripción</label><textarea value={editDescription} onChange={e => setEditDescription(e.target.value)} rows={3} className="w-full mt-1 rounded-lg border border-slate-200 p-2 text-xs text-slate-800" /></div>
            {oeError && <p className="text-xs text-red-600">{oeError}</p>}
            <div className="flex justify-end gap-2"><button type="button" onClick={() => setShowEditOE(false)} className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold">CANCELAR</button><button type="submit" disabled={loadingOE} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold">{loadingOE ? 'GUARDANDO...' : 'GUARDAR'}</button></div>
          </form>
        </div>
      )}
      {pendingDelete && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/50 p-6">
          <div className="w-full max-w-md rounded-xl border border-red-200 bg-white p-5 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">ELIMINAR OBJETIVO ESTRATÉGICO</h3>
            <p className="text-xs text-slate-600"><strong>{objective.code}</strong> — {objective.title}</p>
            <p className="text-xs text-slate-600">Esta acción eliminará el objetivo. Si tiene relaciones u Objetivos de Contribución asociados, la eliminación será bloqueada.</p>
            {oeError && <p className="text-xs text-red-600">{oeError}</p>}
            <div className="flex justify-end gap-2"><button type="button" onClick={() => setPendingDelete(false)} className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold">CANCELAR</button><button type="button" onClick={deleteOE} disabled={loadingOE} className="px-4 py-2 rounded-lg bg-red-600 text-white text-xs font-bold">{loadingOE ? 'ELIMINANDO...' : 'ELIMINAR'}</button></div>
          </div>
        </div>
      )}
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
                      {canManageOE && <button type="button" onClick={() => setShowOCManager(true)} className="mb-2 px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold">ADMINISTRAR INDICADORES</button>}

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
          initialSection="contributionObjectives"
          onClose={() => setShowOCManager(false)}
          onRefreshData={async () => { await onRefreshData(); }}
        />
      )}
      {showDirectAlignment && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/60 p-6">
          <div className="w-full max-w-xl rounded-xl bg-white p-5 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">ALINEAR INDICADORES A {objective.code}</h3>
            <p className="text-xs text-slate-500">Selecciona los KPI que deben aparecer directamente bajo este objetivo.</p>
            <input value={kpiSearch} onChange={e => setKpiSearch(e.target.value)} placeholder="Buscar indicador..." className="w-full rounded-lg border border-slate-200 p-2 text-xs text-slate-800" />
            <div className="max-h-64 overflow-y-auto space-y-1 rounded-lg border border-slate-200 p-2">
              {visibleKpis.length === 0 ? <p className="p-4 text-center text-xs text-slate-500">No hay indicadores disponibles.</p> : visibleKpis.map(({ dashboard, item }) => { const key = `${dashboard.id}_${item.id}`; return <label key={key} className="flex items-center gap-2 rounded-lg p-2 text-xs text-slate-700 hover:bg-slate-50"><input type="checkbox" checked={directKpis.includes(key)} onChange={() => setDirectKpis(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])} /><span><strong>{item.indicator || item.name}</strong><span className="ml-2 text-slate-400">({dashboard.title})</span></span></label>; })}
            </div>
            {oeError && <p className="text-xs text-red-600">{oeError}</p>}
            <div className="flex justify-end gap-2"><button type="button" onClick={() => setShowDirectAlignment(false)} className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold">CANCELAR</button><button type="button" onClick={saveDirectAlignment} disabled={loadingOE} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold">{loadingOE ? 'GUARDANDO...' : 'GUARDAR ALINEACIÓN'}</button></div>
          </div>
        </div>
      )}
    </div>
  );
};
