import React, { useState, useMemo, useRef, useEffect, useLayoutEffect, useId, useCallback } from 'react';
import { Settings, Compass, Layers, Info, CheckCircle2, AlertTriangle, Plus } from 'lucide-react';
import {
  StrategicPerspective,
  StrategicObjective,
  StrategicObjectiveRelationship,
  AreaStrategyConfig,
  ContributionObjective,
  ContributionIndicatorAssignment,
  DEFAULT_PERSPECTIVES
} from '../../strategyTypes';
import { Dashboard as DashboardType, User } from '../../types';
import { StrategicObjectiveNode } from './StrategicObjectiveNode';
import { OEDetailModal } from './OEDetailModal';
import { RelationshipEditorModal } from './RelationshipEditorModal';
import { resolveStrategicKpiOwnership } from '../../strategyKpiOwnership';

export interface StrategyMapViewProps {
  perspectives?: StrategicPerspective[];
  objectives?: StrategicObjective[];
  relationships?: StrategicObjectiveRelationship[];
  areaConfigs?: AreaStrategyConfig[];
  contributions?: ContributionObjective[];
  assignments?: ContributionIndicatorAssignment[];
  dashboards?: DashboardType[];
  isAdmin?: boolean;
  currentUser?: User;
  selectedClientId: string;
  onRefreshData?: () => Promise<void>;
  onSaveRelationship?: (rel: { sourceStrategicObjectiveId: string; targetStrategicObjectiveId: string; description?: string }) => Promise<void>;
  onDeleteRelationship?: (relationshipId: string) => Promise<void>;
  onNavigateToDashboard?: (dashboardId: number | string, itemId: number | string) => void;
}

interface NodeBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Vista de Mapa Estratégico BSC de 4 Perspectivas con Relaciones Visuales de Causa y Efecto.
 *
 * Características principales:
 * 1. Soporta Escenario A (Solo OEs) y Escenario B (OE + OCs + Indicadores).
 * 2. Cuatro carriles horizontales basados en la configuración de perspectivas.
 * 3. Overlay SVG con conectores/flechas direccionales de causa y efecto.
 * 4. Interacción: Clic para abrir detalle en lectura (`OEDetailModal`).
 * 5. Administración: Botón "Editar Relaciones" para Administradores (`RelationshipEditorModal`).
 * 6. Vista Responsiva: Adaptación móvil apilada manteniendo trazabilidad completa de relaciones.
 */
export const StrategyMapView: React.FC<StrategyMapViewProps> = ({
  perspectives = DEFAULT_PERSPECTIVES,
  objectives = [],
  relationships = [],
  areaConfigs = [],
  contributions = [],
  assignments = [],
  dashboards = [],
  isAdmin = false,
  currentUser,
  selectedClientId,
  onRefreshData,
  onSaveRelationship,
  onDeleteRelationship,
  onNavigateToDashboard
}) => {
  const [selectedOE, setSelectedOE] = useState<StrategicObjective | null>(null);
  const [hoveredOEId, setHoveredOEId] = useState<string | null>(null);
  const [showEditorModal, setShowEditorModal] = useState(false);
  const ownership = useMemo(() => resolveStrategicKpiOwnership(dashboards, objectives, contributions, assignments), [dashboards, objectives, contributions, assignments]);
  const occupiedKpiIdentities = useMemo(() => new Set(ownership.ownershipByCanonicalKpi.keys()), [ownership]);
  const displayedKpis = useMemo(() => Array.from(ownership.kpisByStrategicObjective.values()).flat(), [ownership]);
  const visibleOccupiedPhysicalKpiKeys = useMemo(() => new Set(displayedKpis.map(kpi => kpi.physicalKey)), [displayedKpis]);
  const visibleOccupiedCanonicalKpiIdentities = useMemo(() => new Set(displayedKpis.map(kpi => kpi.identity)), [displayedKpis]);

  // Generador de ID de instancia único y sanitizado para marcadores SVG
  const rawInstanceId = useId();
  const instanceId = useMemo(() => rawInstanceId.replace(/[^a-zA-Z0-9_-]/g, '_'), [rawInstanceId]);
  const defaultMarkerId = `arrowhead-default-${instanceId}`;
  const activeMarkerId = `arrowhead-active-${instanceId}`;

  // Referencias DOM para cálculo de coordenadas del SVG Overlay
  const containerRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [nodePositions, setNodePositions] = useState<Record<string, NodeBounds>>({});
  const rafIdRef = useRef<number | null>(null);

  // Perspectivas activas ordenadas
  const sortedPerspectives = useMemo(() => {
    const list = perspectives.length > 0 ? perspectives : DEFAULT_PERSPECTIVES;
    return [...list].sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [perspectives]);

  // Recalcular posiciones de los nodos para las flechas del SVG Overlay con requestAnimationFrame
  const updateNodePositions = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
    }
    rafIdRef.current = requestAnimationFrame(() => {
      if (!containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const newPositions: Record<string, NodeBounds> = {};

      Object.keys(nodeRefs.current).forEach(oeId => {
        const el = nodeRefs.current[oeId];
        if (el) {
          const rect = el.getBoundingClientRect();
          newPositions[oeId] = {
            x: rect.left - containerRect.left + containerRef.current!.scrollLeft,
            y: rect.top - containerRect.top + containerRef.current!.scrollTop,
            width: rect.width,
            height: rect.height
          };
        }
      });

      setNodePositions(newPositions);
    });
  }, []);

  useLayoutEffect(() => {
    updateNodePositions();

    const handleWindowResize = () => updateNodePositions();
    window.addEventListener('resize', handleWindowResize, { passive: true });

    const containerEl = containerRef.current;
    let resizeObserver: ResizeObserver | null = null;

    if (containerEl) {
      containerEl.addEventListener('scroll', updateNodePositions, { passive: true });
      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => {
          updateNodePositions();
        });
        resizeObserver.observe(containerEl);
      }
    }

    return () => {
      window.removeEventListener('resize', handleWindowResize);
      if (containerEl) {
        containerEl.removeEventListener('scroll', updateNodePositions);
      }
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [objectives, perspectives, relationships, updateNodePositions]);

  // Nodos de causa/efecto activos respecto al nodo en hover/seleccionado
  const activeRelationships = useMemo(() => {
    const activeId = hoveredOEId || selectedOE?.id;
    if (!activeId) return { causeIds: new Set<string>(), effectIds: new Set<string>(), relIds: new Set<string>() };

    const causeIds = new Set<string>();
    const effectIds = new Set<string>();
    const relIds = new Set<string>();

    relationships.forEach(r => {
      if (r.targetStrategicObjectiveId === activeId) {
        causeIds.add(r.sourceStrategicObjectiveId);
        relIds.add(r.id);
      }
      if (r.sourceStrategicObjectiveId === activeId) {
        effectIds.add(r.targetStrategicObjectiveId);
        relIds.add(r.id);
      }
    });

    return { causeIds, effectIds, relIds };
  }, [hoveredOEId, selectedOE, relationships]);

  return (
    <div className="space-y-6">
      {/* Barra de Título y Acciones del Mapa Estratégico */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <Compass className="w-6 h-6 text-indigo-600" />
            <h2 className="text-xl font-bold text-slate-900">Mapa Estratégico BSC</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Visualización interactiva de causalidad y alineación estratégica en 4 perspectivas.
          </p>
        </div>

        {/* Acciones de Administración */}
        {isAdmin && onSaveRelationship && onDeleteRelationship && (
          <button
            onClick={() => setShowEditorModal(true)}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-sm transition-colors flex items-center gap-2 shrink-0"
          >
            <Settings className="w-4 h-4" />
            Editar Relaciones
          </button>
        )}
      </div>

      {/* Banner Informativo si existen OEs pero no relaciones */}
      {objectives.length > 0 && relationships.length === 0 && (
        <div className="bg-indigo-50/70 border border-indigo-200/80 rounded-2xl p-4 flex items-center justify-between gap-3 text-xs text-indigo-900">
          <div className="flex items-center gap-2.5">
            <Info className="w-5 h-5 text-indigo-600 shrink-0" />
            <span>
              <strong>Objetivos cargados correctamente.</strong> No existen relaciones de causa y efecto registradas aún.
              {isAdmin ? ' Utiliza el botón "Editar Relaciones" para conectar los Objetivos Estratégicos.' : ''}
            </span>
          </div>
        </div>
      )}

      {/* Estado Vacío cuando no existen OEs configurados */}
      {objectives.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 border border-slate-200 shadow-sm text-center max-w-lg mx-auto my-8">
          <Compass className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800 mb-1">Sin Objetivos Estratégicos</h3>
          <p className="text-xs text-slate-500 mb-4">
            No se han registrado Objetivos Estratégicos en el catálogo para esta empresa.
          </p>
        </div>
      ) : (
        /* Contenedor del Mapa Estratégico (Escritorio / Tablet con Overlay SVG) */
        <div className="relative bg-slate-50/50 rounded-2xl border border-slate-200/80 p-6 overflow-x-auto" ref={containerRef}>
          {/* Overlay SVG para Renderizado de Flechas Direccionales */}
          <svg className="absolute inset-0 pointer-events-none w-full h-full z-10">
            <defs>
              <marker
                id={defaultMarkerId}
                markerWidth="8"
                markerHeight="8"
                refX="7"
                refY="4"
                orient="auto"
              >
                <polygon points="0 0, 8 4, 0 8" fill="#94A3B8" />
              </marker>
              <marker
                id={activeMarkerId}
                markerWidth="9"
                markerHeight="9"
                refX="8"
                refY="4.5"
                orient="auto"
              >
                <polygon points="0 0, 9 4.5, 0 9" fill="#4F46E5" />
              </marker>
            </defs>

            {/* Dibujar Conectores */}
            {relationships.map(rel => {
              const srcPos = nodePositions[rel.sourceStrategicObjectiveId];
              const tgtPos = nodePositions[rel.targetStrategicObjectiveId];

              if (!srcPos || !tgtPos) return null;

              const isActive = activeRelationships.relIds.has(rel.id);

              // Coordenadas limpias de anclaje
              const x1 = srcPos.x + srcPos.width / 2;
              const y1 = srcPos.y + (srcPos.y < tgtPos.y ? srcPos.height : 0);
              const x2 = tgtPos.x + tgtPos.width / 2;
              const y2 = tgtPos.y + (tgtPos.y > srcPos.y ? 0 : tgtPos.height);

              const controlY1 = y1 + (y2 - y1) / 2;
              const controlY2 = y1 + (y2 - y1) / 2;

              const pathData = `M ${x1} ${y1} C ${x1} ${controlY1}, ${x2} ${controlY2}, ${x2} ${y2}`;

              return (
                <path
                  key={rel.id}
                  d={pathData}
                  fill="none"
                  stroke={isActive ? '#4F46E5' : '#CBD5E1'}
                  strokeWidth={isActive ? 3 : 1.5}
                  strokeDasharray={isActive ? 'none' : 'none'}
                  markerEnd={isActive ? `url(#${activeMarkerId})` : `url(#${defaultMarkerId})`}
                  className="transition-all duration-200"
                />
              );
            })}
          </svg>

          {/* Renderizado de 4 Carriles Horizontales de Perspectivas */}
          <div className="space-y-6 relative z-20">
            {sortedPerspectives.map(persp => {
              const perspObjectives = objectives
                .filter(o => o.perspectiveId === persp.id)
                .sort((a, b) => (a.order || 0) - (b.order || 0));

              return (
                <div
                  key={persp.id}
                  className="bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-slate-200/80 shadow-xs"
                >
                  {/* Etiqueta de la Perspectiva */}
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: persp.color || '#3B82F6' }}
                    />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      {persp.name}
                    </h3>
                    <span className="text-[11px] font-medium text-slate-400 font-mono">
                      ({perspObjectives.length} objetivos)
                    </span>
                  </div>

                  {/* Fila Nodos OE en el carril */}
                  {perspObjectives.length > 0 ? (
                    <div className="flex flex-wrap gap-4 items-center">
                      {perspObjectives.map(oe => {
                        const isSel = selectedOE?.id === oe.id;
                        const isHov = hoveredOEId === oe.id;
                        const isCause = activeRelationships.causeIds.has(oe.id);
                        const isEffect = activeRelationships.effectIds.has(oe.id);

                        return (
                          <div
                            key={oe.id}
                            ref={el => {
                              nodeRefs.current[oe.id] = el;
                            }}
                          >
                            <StrategicObjectiveNode
                              objective={oe}
                              perspective={persp}
                              contributions={contributions}
                              assignments={assignments}
                              dashboards={dashboards}
                              isSelected={isSel}
                              isHovered={isHov}
                              isCause={isCause}
                              isEffect={isEffect}
                              onClick={() => setSelectedOE(oe)}
                              onMouseEnter={() => setHoveredOEId(oe.id)}
                              onMouseLeave={() => setHoveredOEId(null)}
                            />
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 italic py-2">
                      Sin objetivos definidos en esta perspectiva.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal de Detalle de OE en Lectura */}
      {selectedOE && (
        <OEDetailModal
          objective={selectedOE}
          perspective={perspectives.find(p => p.id === selectedOE.perspectiveId)}
          perspectives={perspectives}
          allObjectives={objectives}
          relationships={relationships}
          contributions={contributions}
          assignments={assignments}
          dashboards={dashboards}
          currentObjectiveAlignedKpis={ownership.kpisByStrategicObjective.get(selectedOE.id) || []}
          occupiedKpiIdentities={occupiedKpiIdentities}
          occupiedPhysicalKpiKeys={ownership.occupiedPhysicalKpiKeys}
          visibleOccupiedPhysicalKpiKeys={visibleOccupiedPhysicalKpiKeys}
          visibleOccupiedCanonicalKpiIdentities={visibleOccupiedCanonicalKpiIdentities}
          areaConfigs={areaConfigs}
          selectedClientId={selectedClientId}
          currentUser={currentUser}
          onRefreshData={onRefreshData}
          onClose={() => setSelectedOE(null)}
          onNavigateToDashboard={onNavigateToDashboard}
        />
      )}

      {/* Modal de Administración de Relaciones */}
      {showEditorModal && isAdmin && onSaveRelationship && onDeleteRelationship && (
        <RelationshipEditorModal
          isOpen={showEditorModal}
          onClose={() => {
            setShowEditorModal(false);
            if (onRefreshData) onRefreshData();
          }}
          objectives={objectives}
          perspectives={perspectives}
          relationships={relationships}
          clientId={selectedClientId}
          onSaveRelationship={onSaveRelationship}
          onDeleteRelationship={onDeleteRelationship}
        />
      )}
    </div>
  );
};
