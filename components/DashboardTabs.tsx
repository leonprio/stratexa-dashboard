import React, { useEffect, useMemo, useRef, useState } from "react";
import { Dashboard as DashboardType, SystemSettings } from "../types";
import { normalizeGroupName } from "../utils/formatters";
import { calculateCapturePct } from "../utils/compliance";

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

export const calculateCapture = (d: DashboardType) => {
  return calculateCapturePct(d);
};

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
  void label;

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

  // 🛡️ REGLA v5.5.7 (SCOPE FIX): Cálculo de etiqueta principal fuera de los memos
  const isMeSuperDirector = useMemo(() => dashboards.some(d => (d as any).isHierarchyRoot), [dashboards]);
  const rootAgg = useMemo(() => dashboards.find(d => (d as any).isHierarchyRoot), [dashboards]);
  // 🛡️ REGLA v5.5.9.1: Los Directores Generales ven SÍNTESIS GLOBAL.
  const mainLabel = useMemo(() => {
    if (rootAgg && rootAgg.group) return rootAgg.group.trim().toUpperCase();
    if (isMeSuperDirector) return "DIRECCIÓN DE OPERACIONES";
    return "TODOS";
  }, [rootAgg, isMeSuperDirector]);

  const groups = useMemo(() => {
    const map = new Map<string, { officialName: string, items: DashboardType[] }>();

    // 1. Inicializar con grupos permitidos (officialGroups de App.tsx)
    if (allowedGroups && allowedGroups.length > 0) {
      allowedGroups.forEach(g => {
        const norm = normalizeGroupName(g);
        if (!map.has(norm)) {
          map.set(norm, { officialName: g.trim().toUpperCase(), items: [] });
        }
      });
    }

    // 2. Distribuir tableros en sus grupos correspondientes
    dashboards.forEach((d) => {
      const gRaw = ((d as any).group || "GENERAL").toString().trim().toUpperCase();
      const normG = normalizeGroupName(gRaw);

      if (map.has(normG)) {
        const dCopy = { ...d };
        (dCopy as any)._capturePct = calculateCapture(dCopy);
        map.get(normG)!.items.push(dCopy);
      } else {
        // Fallback para grupos que no están en allowedGroups pero tienen tableros
        const normGen = normalizeGroupName("GENERAL");
        if (!map.has(normGen)) {
          map.set(normGen, { officialName: "GENERAL", items: [] });
        }
        const dCopy = { ...d };
        (dCopy as any)._capturePct = calculateCapture(dCopy);
        map.get(normGen)!.items.push(dCopy);
      }
    });

    const items = Array.from(map.entries())
      .map(([normG, data]) => {
        const avgCapture = data.items.length > 0
          ? data.items.reduce((acc, d) => acc + ((d as any)._capturePct || 0), 0) / data.items.length
          : 0;

        return {
          label: data.officialName,
          originalLabel: data.officialName,
          normalizedLabel: normG,
          capturePct: avgCapture,
          items: data.items.sort((a, b) => {
            const aIsAgg = typeof a.id === 'string' && a.id.startsWith('agg-');
            const bIsAgg = typeof b.id === 'string' && b.id.startsWith('agg-');
            if (aIsAgg && !bIsAgg) return -1;
            if (!aIsAgg && bIsAgg) return 1;
            return ((a as any).orderNumber || 0) - ((b as any).orderNumber || 0);
          })
        };
      })
      .filter(g => g.items.length > 0 || (allowedGroups && allowedGroups.includes(g.originalLabel)))
      .sort((a, b) => {
        const aIsMain = normalizeGroupName(a.label) === normalizeGroupName(mainLabel);
        const bIsMain = normalizeGroupName(b.label) === normalizeGroupName(mainLabel);
        if (aIsMain && !bIsMain) return -1;
        if (!aIsMain && bIsMain) return 1;
        return a.label.localeCompare(b.label);
      });

    return items;
  }, [dashboards, allowedGroups, mainLabel]);

  const activeGroupItems = useMemo(() => {
    const normSelected = normalizeGroupName(selectedGroup);

    // Si hay un área activa y estamos en "TODAS" o similar, el filtrado de área debe prevalecer
    // pero siempre manteniéndonos dentro del grupo seleccionado para evitar el cruce reportado.

    const currentGroupData = groups.find(g => g.normalizedLabel === normSelected);
    let items = currentGroupData ? [...currentGroupData.items] : [];

    if (activeArea !== "TODAS") {
      items = items.filter(d => {
        const boardArea = (d as any).area ? (d as any).area.trim().toUpperCase() : "TODAS";
        const isGlobalTotal = String(d.id).includes('agg-global-total') || d.id === -1;
        const isHierarchy = (d as any).isHierarchyRoot === true;
        // Los agregados globales y raíces de jerarquía siempre son visibles para dar contexto
        if (isGlobalTotal || isHierarchy) return true;
        return boardArea === activeArea;
      });
    }

    return items;
  }, [selectedGroup, groups, activeArea]);

  const areas = useMemo(() => {
    const set = new Set<string>();
    dashboards.forEach(d => {
      const a = (d as any).area;
      if (a && a.trim()) set.add(a.trim().toUpperCase());
    });
    return ["TODAS", ...Array.from(set).sort()];
  }, [dashboards]);

  const filteredDashboards = useMemo(() => {
    // La lógica de filtrado por área ya está integrada en `groups` y `activeGroupItems`
    // `activeGroupItems` ya contiene los dashboards filtrados por el grupo activo Y el área activa.
    return activeGroupItems;
  }, [activeGroupItems]); // Simplified dependency

  return (
    <div className="flex flex-col gap-6 mb-8">
      {/* 📊 FILA 1: Ribbon de Tableros */}
      <div className="flex items-center gap-2.5 flex-wrap">
        {filteredDashboards.map((dashboard, index) => {
          const isSelected = dashboard.id === activeId;
          const isHierarchy = (dashboard as any).isHierarchyRoot === true;
          const isGlobalTotal = String(dashboard.id).includes('agg-global-total');

          return (
            <div key={dashboard.id} className="relative group/tab flex-shrink-0">
              {editingTabId === dashboard.id ? (
                <input
                  ref={inputRef}
                  type="text"
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  onBlur={handleFinishEditing}
                  onKeyDown={handleKeyDown}
                  className="px-4 py-3 text-[10px] font-black rounded-xl bg-slate-800 text-white outline-none ring-2 ring-cyan-500 min-w-[150px] shadow-2xl"
                  autoFocus
                />
              ) : (
                <button
                  onClick={() => {
                    // Solo cambiar de grupo si es necesario, pero permitir que el ribbon activeGroupItems maneje la persistencia
                    if (dashboard.group && normalizeGroupName(dashboard.group) !== normalizeGroupName(selectedGroup)) {
                      onGroupChange?.(dashboard.group);
                    }
                    onSelectDashboard?.(dashboard.id);
                  }}
                  onDoubleClick={() => handleStartEditing(dashboard)}
                  className={`
                    flex-shrink-0 px-6 py-3 rounded-2xl transition-all duration-500 border relative group overflow-hidden
                    ${isSelected
                      ? 'bg-cyan-500/10 border-cyan-500/50 text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.15)] ring-1 ring-cyan-500/20'
                      : 'bg-slate-900/40 border-white/5 text-slate-500 hover:text-slate-300 hover:border-white/10 hover:bg-slate-800/60'}
                  `}
                >
                  {isSelected && <div className="absolute inset-0 bg-cyan-500/5 animate-pulse" />}
                  <div className="relative flex flex-col items-start gap-1">
                    <div className="flex items-center gap-2">
                      {isGlobalTotal ? (<span>👑</span>) : isHierarchy ? (<span>🏢</span>) : null}
                      <span className="text-[7px] font-black uppercase tracking-[0.2em] opacity-50 group-hover:opacity-100 transition-opacity">
                        {isHierarchy ? 'Agregado' : (isGlobalTotal ? 'Master' : `${(dashboard as any).orderNumber || (index + 1)}. Tablero`)}
                      </span>
                    </div>
                    <span className="text-[11px] font-black uppercase tracking-tight truncate max-w-[160px]">
                      {dashboard.title}
                    </span>
                    {(dashboard as any)._capturePct !== undefined && (
                      <div className="flex items-center gap-2 mt-2 px-2 py-1.5 bg-white/5 rounded-xl border border-white/10 shadow-inner">
                        <div className="h-2 w-10 bg-slate-950 rounded-full overflow-hidden border border-white/5">
                          <div
                            className={`h-full transition-all duration-1000 ${(dashboard as any)._capturePct >= 100 ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : (dashboard as any)._capturePct > 50 ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]' : 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]'}`}
                            style={{ width: `${(dashboard as any)._capturePct}%` }}
                          />
                        </div>
                        <span className={`text-[10px] font-black tracking-widest ${(dashboard as any)._capturePct >= 100 ? 'text-emerald-400' : (dashboard as any)._capturePct > 50 ? 'text-amber-400' : 'text-rose-400'}`}>
                          {Math.round((dashboard as any)._capturePct)}%
                        </span>
                      </div>
                    )}
                    {(dashboard as any).area && (
                      <span className="text-[7px] font-black text-orange-500/80 uppercase tracking-widest mt-0.5">
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
                  className="absolute -top-1.5 -right-1.5 z-20 p-1 bg-rose-600 text-white rounded-full opacity-0 group-hover/tab:opacity-100 shadow-xl scale-75 hover:scale-100 transition-all border border-rose-400/50"
                >
                  <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              )}
            </div>
          );
        })}

        {canAdmin && typeof onAddDashboard === "function" && (
          <button
            onClick={onAddDashboard}
            className="p-3 px-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-500 hover:text-cyan-400 transition-all ml-1"
          >
            <span className="text-[10px] font-black uppercase tracking-widest">+ Nuevo Tablero</span>
          </button>
        )}
      </div>

      {/* 🚀 FILA 2: Ribbon de Grupos */}
      {groups.length > 1 && (
        <div className="flex items-center gap-4 overflow-x-auto pb-4 border-b border-white/5 scrollbar-hide">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] flex-shrink-0 ml-1">Filtro de Grupo:</span>
          <div className="flex items-center gap-2">
            {groups.map((g) => {
              const isActive = normalizeGroupName(selectedGroup) === g.normalizedLabel;
              const isGlobalMaster = normalizeGroupName(g.label) === "SINTESIS" || normalizeGroupName(g.label) === "TODOS";
              const isSuper = g.items.some(it => (it as any).isHierarchyRoot);

              return (
                <button
                  key={g.originalLabel}
                  onClick={() => {
                    onGroupChange?.(g.originalLabel);
                    const firstAgg = g.items.find(it => String(it.id).startsWith('agg-'));
                    if (firstAgg) onSelectDashboard?.(firstAgg.id);
                    else if (g.items.length > 0) onSelectDashboard?.(g.items[0].id);
                  }}
                  className={`px-5 py-2.5 text-[10px] font-black uppercase tracking-[0.15em] whitespace-nowrap rounded-xl transition-all border flex items-center gap-2 ${isActive
                    ? isGlobalMaster ? "text-purple-400 bg-purple-500/10 border-purple-500/50 shadow-lg shadow-purple-500/20" : "text-cyan-400 bg-cyan-500/10 border-cyan-500/50 shadow-lg shadow-cyan-500/20"
                    : "text-slate-500 border-white/5 bg-slate-900/40 hover:text-slate-300 hover:border-white/10"
                    }`}
                >
                  {isGlobalMaster ? <span>👑</span> : isSuper ? <span>🏢</span> : null}
                  <div className="flex flex-col items-start leading-none">
                    <span className="text-[10px] font-black uppercase tracking-[0.15em]">{g.label}</span>
                    <span
                      className={`text-[8px] font-black mt-1 px-1.5 py-0.5 rounded-md leading-none ${(g as any).capturePct >= 100
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : (g as any).capturePct > 0
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-slate-800 text-slate-500'
                        }`}
                    >
                      CAPTURA: {Math.round((g as any).capturePct || 0)}%
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 🏢 FILA 3: Ribbon de Áreas */}
      {areas.length > 1 && (
        <div className="flex items-center gap-4 overflow-x-auto pb-4 scrollbar-hide">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] flex-shrink-0 ml-1">Filtrar por Área:</span>
          <div className="flex items-center gap-2">
            {areas.map((a) => (
              <button
                key={a}
                onClick={() => onAreaChange?.(a)}
                className={`px-5 py-2 text-[9px] font-black uppercase tracking-[0.15em] whitespace-nowrap rounded-lg transition-all border ${activeArea === a
                  ? "text-orange-400 bg-orange-500/10 border-orange-500/30 shadow-lg shadow-orange-500/10"
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
