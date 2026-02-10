import React, { useEffect, useMemo, useRef, useState } from "react";
import { Dashboard as DashboardType, SystemSettings } from "../types";
import { normalizeGroupName } from "../utils/formatters";

type LayoutMode = "grid" | "compact";

interface DashboardTabsProps {
  dashboards: DashboardType[];
  selectedDashboardId?: number | string | null;
  onSelectDashboard?: (id: number | string) => void;
  settings?: SystemSettings;
  activeDashboardId?: number | string | null;
  onAddDashboard?: () => void;
  onDeleteDashboard?: (id: number) => void;
  isGlobalAdmin?: boolean;
  onUpdateDashboardTitle?: (id: number | string, newTitle: string) => void;
  dashboardLabel?: string;
  layout?: LayoutMode;
  onChangeLayout?: (layout: LayoutMode) => void;
  allowedGroups?: string[];
  activeGroup?: string;
  onGroupChange?: (group: string) => void;
  activeArea?: string;
  onAreaChange?: (area: string) => void;
}

export const DashboardTabs: React.FC<DashboardTabsProps> = ({
  dashboards,
  selectedDashboardId,
  onSelectDashboard,
  settings,
  activeDashboardId,
  onAddDashboard,
  onDeleteDashboard,
  isGlobalAdmin,
  onUpdateDashboardTitle,
  dashboardLabel,
  allowedGroups,
  activeGroup,
  onGroupChange,
  activeArea,
  onAreaChange,
}) => {
  const activeId =
    typeof selectedDashboardId !== "undefined"
      ? selectedDashboardId
      : activeDashboardId ?? null;

  const canAdmin =
    typeof isGlobalAdmin === "boolean"
      ? isGlobalAdmin
      : false;

  const label =
    dashboardLabel ??
    settings?.dashboardLabel ??
    "Tablero";
  void label; // label is assigned but currently not used in the UI sub-components here

  const canEditTitle = canAdmin && typeof onUpdateDashboardTitle === "function";

  const [editingTabId, setEditingTabId] = useState<number | string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);



  useEffect(() => {
    if (editingTabId !== null) inputRef.current?.focus();
  }, [editingTabId]);

  const handleStartEditing = (dashboard: DashboardType) => {
    if (!canEditTitle) return;
    setEditingTabId(dashboard.id as any);
    setEditingTitle(dashboard.title);
  };

  const handleFinishEditing = () => {
    if (!canEditTitle) {
      setEditingTabId(null);
      return;
    }
    if (editingTabId !== null && editingTitle.trim()) {
      onUpdateDashboardTitle?.(editingTabId, editingTitle.trim());
    }
    setEditingTabId(null);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter") handleFinishEditing();
    if (event.key === "Escape") setEditingTabId(null);
  };

  const [selectedGroup, setSelectedGroup] = [
    activeGroup || "TODOS",
    onGroupChange || (() => { })
  ];

  const groups = useMemo(() => {
    // Mapa de Norma -> { NombreOficial, Tableros }
    const map = new Map<string, { officialName: string, items: DashboardType[] }>();

    if (allowedGroups && allowedGroups.length > 0) {
      allowedGroups.forEach(g => {
        const norm = normalizeGroupName(g);
        if (!map.has(norm)) {
          map.set(norm, { officialName: g.trim().toUpperCase(), items: [] });
        }
      });
    }

    dashboards.forEach((d) => {
      const gRaw = ((d as any).group || "GENERAL").toString().trim().toUpperCase();
      const normG = normalizeGroupName(gRaw);

      if (map.has(normG)) {
        map.get(normG)!.items.push(d);
      }
      // 🛡️ REGLA: Si el grupo no es oficial, NO se crea un nuevo grupo en el mapa.
      // Así desaparecen "BAJIO" y "CENTRO" si no existen en Usuarios.
    });

    const items = Array.from(map.entries())
      .map(([normG, data]) => ({
        label: data.officialName,
        originalLabel: data.officialName,
        normalizedLabel: normG,
        items: data.items.sort((a, b) => {
          // Los agregados (agg-) siempre van primero
          const aIsAgg = typeof a.id === 'string' && a.id.startsWith('agg-');
          const bIsAgg = typeof b.id === 'string' && b.id.startsWith('agg-');
          if (aIsAgg && !bIsAgg) return -1;
          if (!aIsAgg && bIsAgg) return 1;
          return ((a as any).orderNumber || 0) - ((b as any).orderNumber || 0);
        })
      }))
      .filter(g => g.items.length > 0) // Solo mostrar si tienen tableros
      .sort((a, b) => a.label.localeCompare(b.label));

    const finalItems = items;
    // La opción TODOS siempre está presente si hay dashboards
    if (dashboards.length > 0) {
      finalItems.unshift({
        label: "TODOS",
        originalLabel: "TODOS",
        normalizedLabel: "TODOS",
        items: dashboards
          .filter(d => typeof d.id !== 'string' || !d.id.startsWith('agg-') || String(d.id).includes('agg-global-total')) // Ocultar agregados excepto el GLOBAL
          .sort((a, b) => {
            if (a.id === -1) return -1;
            if (b.id === -1) return 1;
            return ((a as any).orderNumber || 0) - ((b as any).orderNumber || 0);
          })
      });
    }

    return finalItems;
  }, [dashboards, allowedGroups]);

  // Sincronizar grupo seleccionado con el dashboard activo de forma conservadora
  useEffect(() => {
    // 🛡️ REGLA v2.4.7 (FIX): NO forzamos el salto de TODOS a un grupo específico.
    // Esto permitía que si un usuario tenía 1 solo grupo, nunca pudiera ver la vista "TODOS"
    // la cual puede contener tableros sin grupo o el agregado global.

    // 1. Si no hay grupo seleccionado, intentar poner TODOS por defecto
    if (!activeGroup && groups.length > 0) {
      if (onGroupChange) onGroupChange("TODOS");
      return;
    }
  }, [activeId, dashboards, activeGroup, groups, onGroupChange]);

  const activeGroupItems = useMemo(() => {
    if (!selectedGroup || selectedGroup === "TODOS") {
      // 🛡️ FIX (v2.4.7): Mostrar todos los reales + el Global.
      return dashboards.filter(d => {
        const idStr = String(d.id);
        const isGlobal = idStr.includes('agg-global-total') || d.id === -1;
        const isReal = typeof d.id === 'number' || (typeof d.id === 'string' && !idStr.startsWith('agg-'));
        const isHierarchy = (d as any).isHierarchyRoot === true;
        return isGlobal || isReal || isHierarchy;
      }).sort((a, b) => {
        if (a.id === -1 || String(a.id).includes('agg-global-total')) return -1;
        if (b.id === -1 || String(b.id).includes('agg-global-total')) return 1;
        return ((a as any).orderNumber || 0) - ((b as any).orderNumber || 0);
      });
    }
    // Buscamos por normalización para máxima estabilidad (v2.2.3)
    const normSelected = normalizeGroupName(selectedGroup);

    // 🛡️ REGLA v2.4.5 (HIERARCHY):
    // Incluir tableros cuyo grupo COINCIDA con el seleccionado OR cuyo navigationParent COINCIDA (subgrupos).
    return dashboards.filter(d => {
      const normG = normalizeGroupName(d.group || "");
      const normNavParent = (d as any).navigationParent ? normalizeGroupName((d as any).navigationParent) : null;
      return normG === normSelected || normNavParent === normSelected;
    }).sort((a, b) => {
      // Prioridad 1: Agregado GLOBAL ("agg-global-total")
      const aIsGlobal = String(a.id).includes('agg-global-total') || a.id === -1;
      const bIsGlobal = String(b.id).includes('agg-global-total') || b.id === -1;
      if (aIsGlobal && !bIsGlobal) return -1;
      if (!aIsGlobal && bIsGlobal) return 1;

      // Prioridad 2: El propio agregador del grupo seleccionado (para que aparezca primero que sus subgrupos)
      const aIsSelfAgg = typeof a.id === 'string' && a.id.startsWith('agg-') && normalizeGroupName(a.group || "") === normSelected;
      const bIsSelfAgg = typeof b.id === 'string' && b.id.startsWith('agg-') && normalizeGroupName(b.group || "") === normSelected;
      if (aIsSelfAgg && !bIsSelfAgg) return -1;
      if (!aIsSelfAgg && bIsSelfAgg) return 1;

      // Prioridad 3: Otros agregadores (ej. los hijos)
      const aIsAgg = typeof a.id === 'string' && a.id.startsWith('agg-');
      const bIsAgg = typeof b.id === 'string' && b.id.startsWith('agg-');
      if (aIsAgg && !bIsAgg) return -1;
      if (!aIsAgg && bIsAgg) return 1;

      return ((a as any).orderNumber || 0) - ((b as any).orderNumber || 0);
    });
  }, [selectedGroup, dashboards]);

  const areas = useMemo(() => {
    const set = new Set<string>();
    dashboards.forEach(d => {
      const a = (d as any).area;
      if (a && a.trim()) set.add(a.trim().toUpperCase());
    });
    return ["TODAS", ...Array.from(set).sort()];
  }, [dashboards]);

  const filteredDashboards = useMemo(() => {
    if (!activeArea || activeArea === "TODAS") return activeGroupItems;
    const normArea = activeArea.trim().toUpperCase();
    return activeGroupItems.filter(d => {
      const idStr = String(d.id);
      const isAgg = idStr.startsWith('agg-') || d.id === -1;

      // 🛡️ REGLA v5.1.1: Si es un agregado, solo lo mostramos en el ribbon si es el ACTUALMENTE seleccionado
      // o es el HierarchyRoot del grupo. Esto evita que desaparezca el concentrado al filtrar área.
      if (isAgg) {
        return d.id === activeId || (d as any).isHierarchyRoot === true;
      }
      return (d as any).area?.trim().toUpperCase() === normArea;
    });
  }, [activeGroupItems, activeArea]);

  return (
    <div className="flex flex-col gap-6 mb-8">
      {/* 📊 FILA 1: Ribbon de Tableros (UNEs / Sucursales) (v2.2.4 - Reorder) */}
      <div className="flex items-center gap-2.5 flex-wrap">
        {filteredDashboards.map((dashboard) => (
          <div key={dashboard.id} className="relative group/tab flex-shrink-0">
            {editingTabId === dashboard.id ? (
              <input
                ref={inputRef}
                type="text"
                value={editingTitle}
                onChange={(e) => setEditingTitle(e.target.value)}
                onBlur={handleFinishEditing}
                onKeyDown={handleKeyDown}
                className="px-4 py-2 text-[10px] font-black rounded-xl bg-slate-800 text-white outline-none ring-2 ring-cyan-500 min-w-[150px] shadow-2xl"
              />
            ) : (
              <button
                onClick={() => {
                  // 🛡️ REGLA v2.4.5: Si el dashboard que clickeo tiene un grupo diferente al actual,
                  // es porque estoy navegando a un SUBGRUPO desde un grupo superior.
                  if (dashboard.group && normalizeGroupName(dashboard.group) !== normalizeGroupName(selectedGroup)) {
                    onGroupChange?.(dashboard.group);
                  }
                  onSelectDashboard?.(dashboard.id);
                }}
                onDoubleClick={() => handleStartEditing(dashboard)}

                title={canAdmin ? `ID: ${dashboard.id} | ORDEN: ${(dashboard as any).orderNumber || '?'}` : undefined}
                className={`px-6 py-3 text-[10px] font-black rounded-2xl transition-all border uppercase tracking-[0.2em] whitespace-nowrap ${activeId === dashboard.id
                  ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/50 shadow-[0_0_20px_rgba(34,211,238,0.15)]"
                  : "bg-slate-900/40 border-white/5 text-slate-500 hover:border-white/20 hover:text-slate-300 hover:bg-slate-800/60"
                  }`}
              >
                <div className="flex flex-col items-center gap-0.5">
                  <div className="flex items-center gap-2">
                    <span>{(canAdmin && (dashboard as any).orderNumber && (dashboard as any).orderNumber > 0) ? `${(dashboard as any).orderNumber}. ` : ""}{dashboard.title}</span>
                    {canAdmin && dashboard.id !== -1 && (
                      <span
                        className="opacity-0 group-hover/tab:opacity-100 transition-opacity text-cyan-400/50 hover:text-cyan-400 cursor-pointer p-0.5"
                        onClick={(e) => { e.stopPropagation(); handleStartEditing(dashboard); }}
                        title="Renombrar este tablero"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                        </svg>
                      </span>
                    )}
                  </div>
                  {(dashboard as any).area && (
                    <span className="text-[7px] opacity-70 font-black tracking-widest text-orange-400">
                      {(dashboard as any).area}
                    </span>
                  )}
                </div>
              </button>
            )}

            {canAdmin && editingTabId !== dashboard.id && dashboard.id !== -1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`¿Eliminar tablero "${dashboard.title}"?`)) {
                    onDeleteDashboard?.(dashboard.id as any);
                  }
                }}
                className="absolute -top-1.5 -right-1.5 z-20 p-1 bg-rose-600 text-white rounded-full opacity-0 group-hover/tab:opacity-100 shadow-xl scale-75 hover:scale-100 transition-all"
              >
                <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            )}
          </div>
        ))}

        {canAdmin && typeof onAddDashboard === "function" && (
          <button
            onClick={onAddDashboard}
            className="p-3 px-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-500 hover:text-cyan-400 transition-all ml-1 shadow-lg"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        )}
      </div>

      {/* 🚀 FILA 2: Ribbon de Grupos (Filtro Principal) (v2.2.9 - Smart Visibility) */}
      {groups.filter(g => g.label !== "TODOS").length >= 1 && (
        <div className="flex items-center gap-4 overflow-x-auto pb-4 border-b border-white/5 scrollbar-hide">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] flex-shrink-0 ml-1">Filtro de Grupo:</span>
          <div className="flex items-center gap-2">
            {groups.map((g) => {
              const hierarchyAgg = g.items.find(it => it.isAggregate && it.isHierarchyRoot);
              const isSuperGroup = g.label !== "TODOS" && !!hierarchyAgg;
              const isGlobalMaster = isSuperGroup && String(hierarchyAgg?.id).includes('agg-global-total');
              const isActive = normalizeGroupName(selectedGroup) === (g as any).normalizedLabel;

              return (
                <button
                  key={g.originalLabel ?? "NO_GROUP"}
                  onClick={() => {
                    setSelectedGroup(g.originalLabel);
                    const aggBoard = g.items.find(it => typeof it.id === 'string' && it.id.startsWith('agg-'));
                    if (aggBoard) {
                      onSelectDashboard?.(aggBoard.id);
                    } else if (g.items.length > 0) {
                      onSelectDashboard?.(g.items[0].id);
                    }
                  }}
                  className={`px-5 py-2.5 text-[10px] font-black uppercase tracking-[0.15em] whitespace-nowrap rounded-xl transition-all border flex items-center gap-2 ${isActive
                    ? isGlobalMaster
                      ? "text-purple-400 bg-purple-500/10 border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.2)] ring-1 ring-purple-500/30"
                      : "text-cyan-400 bg-cyan-500/10 border-cyan-500/50 shadow-[0_0_15px_rgba(34,211,238,0.15)] ring-1 ring-cyan-500/20"
                    : "text-slate-500 border-white/5 bg-slate-900/40 hover:text-slate-300 hover:border-white/10 hover:bg-slate-800/60"
                    } ${isSuperGroup ? 'border-dashed border-cyan-500/60' : ''}`}
                >
                  {isGlobalMaster ? <span className="text-[12px]">👑</span> : isSuperGroup ? <span className="text-[12px]">🏢</span> : null}
                  {g.label}
                  {isGlobalMaster ? (
                    <span className="text-[7px] bg-purple-500/20 px-1.5 py-0.5 rounded text-purple-400 ml-1 font-black animate-pulse">MASTER</span>
                  ) : isSuperGroup ? (
                    <span className="text-[7px] bg-cyan-500/20 px-1.5 py-0.5 rounded text-cyan-500 ml-1 font-black">DIR</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 🏢 FILA 3: Ribbon de Áreas (v5.0.2 - Filtro Áreas) */}
      {areas.length > 1 && (
        <div className="flex items-center gap-4 overflow-x-auto pb-4 scrollbar-hide">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] flex-shrink-0 ml-1">Filtrar por Área:</span>
          <div className="flex items-center gap-2">
            {areas.map((a) => (
              <button
                key={a}
                onClick={() => {
                  onAreaChange?.(a);
                  if (a !== "TODAS") {
                    const match = activeGroupItems.find(d => (d as any).area?.trim().toUpperCase() === a.trim().toUpperCase());
                    if (match && (!activeId || String(activeId).startsWith('agg-') || activeId === -1)) {
                      onSelectDashboard?.(match.id);
                    }
                  }
                }}
                className={`px-5 py-2 text-[9px] font-black uppercase tracking-[0.15em] whitespace-nowrap rounded-lg transition-all border ${activeArea === a
                  ? "text-orange-400 bg-orange-500/10 border-orange-500/30 shadow-[0_0_15px_rgba(249,115,22,0.1)] ring-1 ring-orange-500/20"
                  : "text-slate-600 border-white/5 bg-slate-900/20 hover:text-slate-400 hover:border-white/10"
                  }`}
              >
                {a === "TODAS" ? "TODAS LAS ÁREAS" : a}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

