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
  activeSuperGroup?: string;
  onSuperGroupChange?: (superGroup: string) => void;
  activeArea?: string;
  onAreaChange?: (area: string) => void;
}

export const calculateCapture = (d: DashboardType & { capturePct?: number }) => {
  if (typeof d.capturePct === 'number') return d.capturePct;
  return calculateCapturePct(d);
};

const DashboardTabsComponent: React.FC<DashboardTabsProps> = ({
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
  activeSuperGroup,
  onSuperGroupChange,
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

  console.log("🔍 DEBUG: Dirección Operaciones render?", dashboards.map(d => d.title));
  console.log("🔍 DEBUG: Tableros Operaciones data?", dashboards.length);

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

  // 🛡️ REGLA v5.9.9 (GLOBAL FIX): Asegurar que siempre exista una vía a la síntesis global
  const isMeSuperDirector = useMemo(() => dashboards.some(d => (d as any).isHierarchyRoot), [dashboards]);
  const rootAgg = useMemo(() => dashboards.find(d => (d as any).isHierarchyRoot), [dashboards]);

  const mainLabel = useMemo(() => {
    // 🛡️ REGLA v6.2.4-Fix2: Si tenemos un título de director oficial, usarlo como etiqueta principal para la síntesis
    if (rootAgg && rootAgg.title) return rootAgg.title.trim().toUpperCase();
    if (rootAgg && rootAgg.group) return normalizeGroupName(rootAgg.group);
    return "SINTESIS";
  }, [rootAgg]);

  const normMain = useMemo(() => normalizeGroupName(mainLabel), [mainLabel]);

  // 🏢 NIVEL 4 (v7.2.1): Descubrimiento de SuperGrupos
  const superGroups = useMemo(() => {
    const set = new Set<string>();
    dashboards.forEach(d => {
      const sg = (d as any).superGroup;
      if (sg && sg.trim()) set.add(sg.trim().toUpperCase());
    });
    const list = Array.from(set).sort();
    return ["TODOS", ...list];
  }, [dashboards]);

  // 🛡️ REGLA v7.2.2 (NORMALIZACIÓN SUPERGRUPO): Asegurar que los grupos hereden el supergrupo normalizado
  const normActiveSuperGroup = useMemo(() => normalizeGroupName(activeSuperGroup || "TODOS"), [activeSuperGroup]);

  const groups = useMemo(() => {
    const map = new Map<string, { officialName: string, items: DashboardType[], superGroup?: string }>();

    // 1. Agregar siempre la SÍNTESIS GLOBAL al inicio si hay agregados o es admin
    // 🛡️ REGLA v7.8.23: Solo mostrar la pestaña SÍNTESIS raíz si no hay superdirectores específicos (aislamiento jerárquico)
    const hasSpecificSuperGroup = dashboards.some(d => (d as any).superGroup && (d as any).isHierarchyRoot);
    if (!hasSpecificSuperGroup && (isMeSuperDirector || isGlobalAdmin)) {
      map.set("SINTESIS", { officialName: mainLabel, items: [] });
    }

    // 2. Inicializar con grupos permitidos
    if (allowedGroups && allowedGroups.length > 0) {
      allowedGroups.forEach(g => {
        const norm = normalizeGroupName(g);
        // 🛡️ REGLA v6.2.4-Fix2: Colapsar si es el grupo raíz (mainLabel) para evitar botones duplicados
        if (norm === "SINTESIS" || norm === normMain) return;
        if (!map.get(norm)) {
          map.set(norm, { officialName: g.trim().toUpperCase(), items: [] });
        }
      });
    }

    // 3. Distribuir tableros
    dashboards.forEach((d) => {
      const isGlobalRoot = (d as any).isHierarchyRoot;
      const gRaw = ((d as any).group || "GENERAL").toString();
      const normG = normalizeGroupName(gRaw);
      const dSuperRaw = (d as any).superGroup;
      const dSuperNorm = dSuperRaw ? dSuperRaw.trim().toUpperCase() : undefined;

      // 🛡️ REGLA v6.2.4-Fix4: Lógica de destino UNIFICADA para evitar Duplicados
      const belongsToSintesis = isGlobalRoot || normG === normMain;
      const targetKey = belongsToSintesis ? "SINTESIS" : normG;

      if (map.has(targetKey)) {
        const dCopy = { ...d };
        (dCopy as any)._capturePct = calculateCapture(dCopy);
        map.get(targetKey)!.items.push(dCopy);
        // Guardamos el supergrupo original (ya capitalizado) para el grupo
        if (!map.get(targetKey)!.superGroup && dSuperNorm) {
          map.get(targetKey)!.superGroup = dSuperNorm;
        }
      } else {
        const normGen = normalizeGroupName("GENERAL");
        if (!map.has(normGen)) map.set(normGen, { officialName: "GENERAL", items: [], superGroup: dSuperNorm });
        const dCopy = { ...d };
        (dCopy as any)._capturePct = calculateCapture(dCopy);
        map.get(normGen)!.items.push(dCopy);
      }
    });

    return Array.from(map.entries())
      .map(([normG, data]) => {
        const avgCapture = data.items.length > 0
          ? data.items.reduce((acc, d) => acc + ((d as any)._capturePct || 0), 0) / data.items.length
          : 0;

        return {
          label: data.officialName,
          originalLabel: data.officialName,
          normalizedLabel: normG,
          capturePct: avgCapture,
          superGroup: data.superGroup,
          items: data.items.sort((a, b) => {
            const aIsAgg = typeof a.id === 'string' && a.id.startsWith('agg-');
            const bIsAgg = typeof b.id === 'string' && b.id.startsWith('agg-');
            if (aIsAgg && !bIsAgg) return -1;
            if (!aIsAgg && bIsAgg) return 1;
            return ((a as any).orderNumber || 0) - ((b as any).orderNumber || 0);
          })
        };
      })
      .filter(g => g.items.length > 0 || g.normalizedLabel === "SINTESIS" || (allowedGroups && allowedGroups.some(ag => normalizeGroupName(ag) === g.normalizedLabel)))
      .sort((a, b) => {
        if (a.normalizedLabel === "SINTESIS") return -1;
        if (b.normalizedLabel === "SINTESIS") return 1;
        return a.label.localeCompare(b.label);
      });
  }, [dashboards, allowedGroups, isMeSuperDirector, isGlobalAdmin, mainLabel]); // added mainLabel dep

  const activeGroupItems = useMemo(() => {
    const normSelected = normalizeGroupName(selectedGroup);

    const currentGroupData = groups.find(g => g.normalizedLabel === normSelected);
    let items = currentGroupData ? [...currentGroupData.items] : [];

    // 🛡️ REGLA v6.2.4-Fix6 (TRANSVERSAL GENERAL):
    // La pestaña GENERAL ahora también se considera una vista consolidada para recuperar su funcionalidad catch-all.
    const isSintesis = normSelected === "SINTESIS" || normSelected === "TODOS" || normSelected === "GENERAL";
    const isSuperGroup = currentGroupData?.items.some(it => (it as any).isHierarchyRoot);

    if (isSintesis || isSuperGroup) {
      const seenIds = new Set(items.map(d => String(d.id)));
      groups.forEach(g => {
        if (g.normalizedLabel !== "SINTESIS" && g.normalizedLabel !== "TODOS") {
          g.items.forEach(child => {
            const childId = String(child.id);
            if (!seenIds.has(childId)) {
              seenIds.add(childId);
              items.push(child);
            }
          });
        }
      });

      console.log(`📊 [AREA-AUDIT] Vista SINTESIS consolidada: ${items.length} tableros totales de ${groups.length - 1} subgrupos`);
    }

    // Filtrar por área (aplica en SINTESIS, GENERAL y grupos individuales)
    if (activeArea !== "TODAS") {
      items = items.filter(d => {
        const boardArea = (d as any).area ? (d as any).area.trim().toUpperCase() : "";

        // 🛡️ REGLA v6.2.4: Tableros sin área explícita no deben contaminar vistas de áreas específicas.
        // Solo son visibles en "TODAS LAS ÁREAS".
        if (!boardArea) return false;

        const isGlobalTotal = String(d.id).includes('agg-global-total') || d.id === -1;
        const isHierarchy = (d as any).isHierarchyRoot === true;
        // Los agregados globales y raíces de jerarquía siempre son visibles para dar contexto
        if (isGlobalTotal || isHierarchy) return true;
        return boardArea === activeArea;
      });
    }

    // 📊 Logging de diagnóstico post-filtrado
    const areaCount = new Map<string, number>();
    items.forEach(d => {
      const a = (d as any).area ? (d as any).area.trim().toUpperCase() : "SIN_AREA";
      areaCount.set(a, (areaCount.get(a) || 0) + 1);
    });
    console.log(`📊 [AREA-AUDIT] Resultado final: ${items.length} tableros visibles. Distribución por área:`, Object.fromEntries(areaCount));

    return items;
  }, [selectedGroup, groups, activeArea]);

  // 🛡️ SINCRONIZACIÓN v7.2.2: Auto-ajuste de grupo al cambiar SuperGrupo (Nivel 4)
  useEffect(() => {
    if (!activeSuperGroup || activeSuperGroup === "TODOS") return;

    const normSel = normalizeGroupName(selectedGroup);
    const isValid = groups.some(g =>
      (g.normalizedLabel === normSel || (g.normalizedLabel === "SINTESIS" && normSel === normalizeGroupName(mainLabel || "SINTESIS"))) &&
      (g.normalizedLabel === "SINTESIS" || g.superGroup === activeSuperGroup)
    );

    if (!isValid) {
      const firstValid = groups.find(g => g.normalizedLabel === "SINTESIS" || g.superGroup === activeSuperGroup);
      if (firstValid) {
        onGroupChange?.(firstValid.originalLabel);
      }
    }
  }, [activeSuperGroup, groups, selectedGroup, onGroupChange, mainLabel]);

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
    <div className="flex flex-col gap-10 mb-12">
      {/* 🛡️ PANEL DE CONTROL DE JERARQUÍA (Senior UX: Context-First) */}
      <div className="bg-slate-900/40 backdrop-blur-xl border border-white/5 rounded-[2.5rem] p-8 shadow-2xl space-y-8">

        {/* 🏢 FILA 0: SUPREME HIERARCHY (Nivel 4) */}
        {superGroups.length > 1 && (
          <div className="flex flex-col gap-3" role="tablist" aria-label="Jerarquía Nivel 4">
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-black text-rose-500 uppercase tracking-[0.4em] flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                NIVEL 4: GRUPO DE GRUPOS
              </span>
              {activeSuperGroup && activeSuperGroup !== "TODOS" && (
                <span className="text-[9px] font-bold text-rose-300/50 bg-rose-500/5 px-3 py-1 rounded-full border border-rose-500/20">
                  Filtro Supreme Activo
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide mask-linear-right">
              {superGroups.map((sg) => {
                const isActive = (activeSuperGroup || "TODOS") === sg;
                return (
                  <button
                    key={sg}
                    onClick={() => onSuperGroupChange?.(sg)}
                    className={`px-6 py-3 text-[10px] font-black uppercase tracking-[0.2em] whitespace-nowrap rounded-2xl transition-all border-2 flex items-center gap-3 ${isActive
                      ? "text-rose-400 bg-rose-500/10 border-rose-500/40 shadow-[0_0_30px_rgba(244,63,94,0.15)] ring-1 ring-rose-500/20"
                      : "text-slate-500 border-white/5 bg-slate-950/40 hover:text-slate-300 hover:border-white/10 hover:bg-slate-900"
                      }`}
                    role="tab"
                    aria-selected={isActive}
                  >
                    <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.8)]' : 'bg-slate-700'}`}></span>
                    {sg === "TODOS" ? "TODOS LOS GRUPOS SUPERIORES" : sg}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 🚀 FILA 2: GRUPOS OPERATIVOS (Nivel 3) */}
        {groups.length > 1 && (
          <div className="flex flex-col gap-3" role="tablist" aria-label="Jerarquía Nivel 3">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] px-1">NIVEL 3: {settings?.groupLabel || "FILTRO DE GRUPO"}</span>
            <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide mask-linear-right">
              {groups
                .filter(g => {
                  if (!activeSuperGroup || activeSuperGroup === "TODOS") return true;
                  if (g.normalizedLabel === "SINTESIS") return true;
                  // Comparación robusta contra el supergrupo seleccionado
                  return g.superGroup === activeSuperGroup;
                })
                .map((g) => {
                  const normSel = normalizeGroupName(selectedGroup);
                  const isActive = (normSel === g.normalizedLabel) || (g.normalizedLabel === "SINTESIS" && normSel === normMain);
                  const isGlobalMaster = g.normalizedLabel === "SINTESIS" || g.normalizedLabel === "TODOS";
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
                      className={`px-5 py-3 text-[10px] font-black uppercase tracking-[0.15em] whitespace-nowrap rounded-2xl transition-all border flex items-center gap-3 ${isActive
                        ? isGlobalMaster
                          ? "text-purple-400 bg-purple-500/10 border-purple-500/50 shadow-lg shadow-purple-500/20"
                          : "text-cyan-400 bg-cyan-500/10 border-cyan-500/50 shadow-lg shadow-cyan-500/20"
                        : "text-slate-500 border-white/5 bg-slate-950/20 hover:text-slate-300 hover:border-white/10 hover:bg-slate-900/60"
                        }`}
                      role="tab"
                      aria-selected={isActive}
                    >
                      {isGlobalMaster ? <span className="text-sm">👑</span> : isSuper ? <span className="text-sm">🏢</span> : null}
                      <div className="flex flex-col items-start leading-tight">
                        <div className="flex items-center gap-2">
                          <span className="uppercase">{g.label}</span>
                          <span className="text-[8px] bg-white/5 border border-white/5 px-2 py-0.5 rounded-lg text-slate-400">
                            {g.items.length}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="w-12 h-1 bg-slate-950 rounded-full overflow-hidden">
                            <div className="h-full bg-cyan-500/40" style={{ width: `${g.capturePct}%` }}></div>
                          </div>
                          <span className="text-[8px] font-black text-cyan-500/70">
                            CAPTURA: {Math.round(g.capturePct || 0)}%
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
            </div>
          </div>
        )}

        {/* 🏢 FILA 3: FILTRO DE ÁREA (Nivel 2 - Transversal) */}
        {areas.length > 1 && (
          <div className="flex flex-col gap-3" role="tablist" aria-label="Filtro Transversal">
            <span className="text-[10px] font-black text-slate-600 uppercase tracking-[0.4em] px-1">ÁREAS / SEGMENTOS</span>
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {areas.map((a) => (
                <button
                  key={a}
                  onClick={() => onAreaChange?.(a)}
                  className={`px-5 py-2.5 text-[9px] font-black uppercase tracking-[0.2em] whitespace-nowrap rounded-xl transition-all border ${activeArea === a
                    ? "text-orange-400 bg-orange-500/10 border-orange-500/40 shadow-lg shadow-orange-500/10"
                    : "text-slate-600 border-white/5 bg-slate-950/20 hover:text-slate-400 hover:border-white/10"
                    }`}
                  role="tab"
                  aria-selected={activeArea === a}
                >
                  {a === "TODAS" ? "TODAS LAS ÁREAS" : a}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 📊 FILA 1 DESPLAZADA: GRID DE TABLEROS (Nivel 1 - Ejecución) */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between px-2">
          <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.5em] flex items-center gap-3">
            {label}s Disponibles
          </h4>
          <span className="text-[10px] font-bold text-slate-600">
            Mostrando {filteredDashboards.length} de {dashboards.length}
          </span>
        </div>

        <div className="flex items-center gap-4 flex-wrap" role="tablist" aria-label="Tableros disponibles">
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
                    className="px-5 py-4 text-[11px] font-black rounded-3xl bg-slate-800 text-white outline-none ring-2 ring-cyan-500 min-w-[200px] shadow-2xl"
                    aria-label={`Editar título de tablero ${dashboard.title}`}
                    autoFocus
                  />
                ) : (
                  <button
                    onClick={() => {
                      if (dashboard.group && normalizeGroupName(dashboard.group) !== normalizeGroupName(selectedGroup)) {
                        onGroupChange?.(dashboard.group);
                      }
                      onSelectDashboard?.(dashboard.id);
                    }}
                    onDoubleClick={() => handleStartEditing(dashboard)}
                    className={`
                      flex-shrink-0 px-8 py-5 rounded-[2rem] transition-all duration-500 border relative group overflow-hidden min-w-[180px]
                      ${isSelected
                        ? (isHierarchy
                          ? 'bg-amber-500/15 border-amber-500/60 text-amber-400 shadow-[0_15px_40px_rgba(245,158,11,0.25)] ring-1 ring-amber-500/30'
                          : 'bg-cyan-500/15 border-cyan-500/60 text-cyan-400 shadow-[0_15px_40px_rgba(6,182,212,0.2)] ring-1 ring-cyan-500/20')
                        : (isHierarchy
                          ? 'bg-slate-900/60 border-amber-500/20 text-slate-400 hover:border-amber-500/40'
                          : 'bg-slate-900/40 border-white/5 text-slate-500 hover:text-slate-300 hover:border-white/10 hover:bg-slate-800/60 hover:translate-y-[-2px]')}
                    `}
                    role="tab"
                    aria-selected={isSelected}
                    aria-label={`Tablero ${dashboard.title}`}
                  >
                    {isSelected && <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-transparent animate-pulse" />}
                    <div className="relative flex flex-col items-start gap-1">
                      <div className="flex items-center gap-2 mb-1">
                        {isGlobalTotal ? (<span className="text-sm">👑</span>) : isHierarchy ? (<span className="text-sm">🏢</span>) : null}
                        <span className="text-[7px] font-black uppercase tracking-[0.3em] opacity-50 group-hover:opacity-100 transition-opacity">
                          {isHierarchy ? 'Síntesis Agregada' : (isGlobalTotal ? 'Master Board' : `${(dashboard as any).orderNumber || (index + 1)}. ${label}`)}
                        </span>
                      </div>
                      <span className="text-[13px] font-black uppercase tracking-tight truncate max-w-[200px]">
                        {dashboard.title}
                      </span>
                      {(dashboard as any)._capturePct !== undefined && (
                        <div className="flex items-center gap-3 mt-4 w-full px-3 py-2 bg-black/40 rounded-2xl border border-white/5 shadow-inner">
                          <div className="h-1.5 flex-grow bg-slate-900 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all duration-1000 ${(dashboard as any)._capturePct >= 100 ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : (dashboard as any)._capturePct > 50 ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]' : 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]'}`}
                              style={{ width: `${(dashboard as any)._capturePct}%` }}
                            />
                          </div>
                          <span className={`text-[10px] font-black tracking-widest min-w-[35px] text-right ${(dashboard as any)._capturePct >= 100 ? 'text-emerald-400' : (dashboard as any)._capturePct > 50 ? 'text-amber-400' : 'text-rose-400'}`}>
                            {Math.round((dashboard as any)._capturePct)}%
                          </span>
                        </div>
                      )}
                      {(dashboard as any).area && (
                        <div className="flex items-center gap-2 mt-2">
                          <span className="w-1 h-1 rounded-full bg-orange-500/60"></span>
                          <span className="text-[8px] font-black text-orange-500/80 uppercase tracking-widest">
                            {(dashboard as any).area}
                          </span>
                        </div>
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
                    className="absolute -top-2 -right-2 z-20 w-7 h-7 flex items-center justify-center bg-rose-600 text-white rounded-full opacity-0 group-hover/tab:opacity-100 shadow-2xl scale-75 hover:scale-100 transition-all border border-rose-400/50 hover:bg-rose-500"
                    aria-label={`Eliminar tablero ${dashboard.title}`}
                  >
                    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
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
              className="px-8 py-5 rounded-[2rem] bg-slate-900/40 hover:bg-cyan-500/10 border border-dashed border-white/10 text-slate-500 hover:text-cyan-400 transition-all ml-2 group"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl group-hover:rotate-90 transition-transform">+</span>
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">{dashboardLabel ? `Nuevo ${dashboardLabel}` : '+ Nuevo Tablero'}</span>
              </div>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export const DashboardTabs = React.memo(DashboardTabsComponent);
