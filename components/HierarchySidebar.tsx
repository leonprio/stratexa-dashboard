import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Dashboard as DashboardType, SystemSettings, User } from '../types';
import { normalizeGroupName } from '../utils/formatters';
import { calculateCapture } from './DashboardTabs';

// ─────────────────────────────────────────────────────
// 🏗️ HierarchySidebar v7.4.0 – UNIVERSAL CORE
// Arquitectura:
//   1. Filtro de Áreas (chips al inicio - UX001 compliant)
//   2. Árbol jerárquico (Superdirector → Grupos → Tableros)
//   3. GENERAL (Auto-expansión inteligente)
// ─────────────────────────────────────────────────────

interface HierarchySidebarProps {
    dashboards: DashboardType[];
    selectedDashboardId: number | string | null;
    onSelectDashboard: (id: number | string) => void;
    settings?: SystemSettings;
    isGlobalAdmin: boolean;
    isDirector: boolean;
    isCollapsed: boolean;
    onToggleCollapse: () => void;
    onAddDashboard?: () => void;
    onDeleteDashboard?: (id: number | string) => void;
    allUsers: User[];
    userProfile: User | null;
    selectedClientId: string;
}

interface TreeNode {
    id: string;
    label: string;
    level: 'supergroup' | 'group' | 'dashboard';
    capturePct: number;
    count: number;
    children: TreeNode[];
    dashboardId?: number | string;
    isAggregate?: boolean;
}

// ═══════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════

const ChevronIcon = ({ isOpen }: { isOpen: boolean }) => (
    <div className="w-11 h-11 flex items-center justify-center -m-4">
        <svg className={`w-3 h-3 text-slate-500 transition-transform duration-300 ${isOpen ? 'rotate-90' : ''}`} viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
        </svg>
    </div>
);

const CaptureBar = ({ pct }: { pct: number }) => {
    const color = pct >= 100 ? 'bg-emerald-500' : pct > 50 ? 'bg-amber-500' : 'bg-rose-500';
    const textColor = pct >= 100 ? 'text-emerald-400' : pct > 50 ? 'text-amber-400' : 'text-rose-400';
    return (
        <div className="flex items-center gap-1.5 w-full">
            <div className="flex-grow h-1 bg-slate-900 rounded-full overflow-hidden">
                <div className={`h-full ${color} transition-all duration-700`} style={{ width: `${Math.min(pct, 100)}%` }} />
            </div>
            <span className={`text-[8px] font-black ${textColor} min-w-[24px] text-right tabular-nums`}>
                {Math.round(pct)}%
            </span>
        </div>
    );
};

/**
 * Componente de barra lateral jerárquica para la navegación de la estructura organizacional.
 * Implementa el "Hierarchy Shield" para equilibrar la síntesis global con la supervisión regional.
 * 
 * @component
 * @param {HierarchySidebarProps} props - Propiedades del componente.
 * @param {DashboardType[]} props.dashboards - Lista de todos los tableros disponibles para el cliente actual.
 * @param {number | string | null} props.selectedDashboardId - ID del tablero seleccionado actualmente.
 * @param {Function} props.onSelectDashboard - Callback para seleccionar un tablero.
 * @param {SystemSettings} [props.settings] - Configuraciones del sistema (umbrales, etc.).
 * @param {boolean} props.isGlobalAdmin - Indica si el usuario es administrador global.
 * @param {boolean} props.isDirector - Indica si el usuario tiene rol de director.
 * @param {boolean} props.isCollapsed - Estado actual de colapso de la barra lateral.
 * @param {Function} props.onToggleCollapse - Callback para alternar el colapso de la barra lateral.
 * @param {Function} [props.onAddDashboard] - Callback para añadir un nuevo tablero.
 * @param {Function} [props.onDeleteDashboard] - Callback para eliminar un tablero.
 * @param {User[]} props.allUsers - Lista de todos los usuarios (para gestión de accesos).
 * @param {User | null} props.userProfile - Perfil del usuario autenticado.
 * @param {string} props.selectedClientId - ID del cliente seleccionado actualmente.
 * 
 * @security PLATINUM SHIELD - Aislamiento de datos multi-inquilino activo.
 * @version v7.8.28-UX-ELITE
 * 
 * @returns {JSX.Element} El componente de la barra lateral.
 */
export /**
 * Componente HierarchySidebar
 * 
 * Gestiona el árbol jerárquico de navegación (Superdirector -> Grupos -> Tableros).
 * Incluye lógica de cálculo de porcentajes de captura en tiempo real por nodo.
 */
const HierarchySidebar: React.FC<HierarchySidebarProps> = React.memo(({ 
    dashboards, selectedDashboardId, onSelectDashboard, settings,
    isGlobalAdmin, isDirector, isCollapsed, onToggleCollapse,
    onAddDashboard, onDeleteDashboard, allUsers, userProfile, selectedClientId
}) => {
    // 🛡️ MOTOR DE PERSISTENCIA (v7.8.16):
    // Se utiliza un mapeo Record<string, boolean> en lugar de un Set para garantizar
    // que el estado sea serializable y resistente a comparaciones superficiales de React.
    const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>(() => {
        const saved = localStorage.getItem('expNodes_v3');
        return saved ? JSON.parse(saved) : {};
    });
    const [selectedArea, setSelectedArea] = useState<string>('TODAS');
    const hasInitialized = useRef(false);
    const prevDashboardId = useRef<string | null>(null);

    useEffect(() => {
        localStorage.setItem('expNodes_v3', JSON.stringify(expandedNodes));
    }, [expandedNodes]);

    const toggleNode = useCallback((id: string) => {
        setExpandedNodes(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
    }, []);

    const versionLabel = "v7.9.0-INTEGRITY-UX";
    const label = settings?.dashboardLabel || 'Tablero';
    const clientNorm = (selectedClientId || 'IPS').trim().toUpperCase();

    const realDashboards = useMemo(() =>
        dashboards.filter(d => !String(d.id).startsWith('agg-')),
        [dashboards]
    );

    const availableAreas = useMemo(() => {
        const areas = new Set<string>();
        realDashboards.forEach(d => {
            const a = ((d as any).area || '').toString().trim().toUpperCase();
            if (a) areas.add(a);
        });
        return Array.from(areas).sort();
    }, [realDashboards]);

    const areaFilteredDashboards = useMemo(() => {
        if (selectedArea === 'TODAS') return realDashboards;
        return realDashboards.filter(d => {
            const a = ((d as any).area || '').toString().trim().toUpperCase();
            const g = normalizeGroupName(d.group || 'GENERAL');
            // 🛡️ REGLA v7.8.10: El grupo GENERAL siempre es visible para garantizar acceso transversal
            return a === selectedArea || g === 'GENERAL';
        });
    }, [realDashboards, selectedArea]);

    const tree = useMemo(() => {
        const nodes: TreeNode[] = [];
        const mySubGroupsNorm = (userProfile?.subGroups || []).map(sg => normalizeGroupName(sg));
        const isMeSuperDirector = isDirector && mySubGroupsNorm.length > 0;
        const myGroupNorm = userProfile?.directorTitle
            ? normalizeGroupName(userProfile.directorTitle)
            : userProfile?.group ? normalizeGroupName(userProfile.group) : '';

        const visibleGroupsNorm = new Set<string>();
        const hasVisibilityFilter = !isGlobalAdmin && !isMeSuperDirector;
        if (hasVisibilityFilter) {
            if (myGroupNorm) visibleGroupsNorm.add(myGroupNorm);
            if (userProfile?.dashboardAccess) {
                dashboards.forEach(d => {
                    if (userProfile.dashboardAccess[d.id] || (d.originalId && userProfile.dashboardAccess[d.originalId])) {
                        const g = normalizeGroupName(d.group || '');
                        if (g) visibleGroupsNorm.add(g);
                    }
                });
            }
        }

        const dashboardsByGroup = new Map<string, DashboardType[]>();
        areaFilteredDashboards.forEach(d => {
            const g = normalizeGroupName(d.group || 'GENERAL');
            if (!dashboardsByGroup.has(g)) dashboardsByGroup.set(g, []);
            dashboardsByGroup.get(g)!.push(d);
        });

        const aggByNormGroup = new Map<string, DashboardType>();
        dashboards.filter(d => String(d.id).startsWith('agg-') && !String(d.id).includes('agg-global-total') && !String(d.id).includes('agg-super-'))
            .forEach(d => {
                // 🛡️ REGLA v7.8.11: Normalización coherente con buildGroupChildren
                const normG = normalizeGroupName(d.group || 'GENERAL');
                if (normG) aggByNormGroup.set(normG, d);
            });

        const assignedGroups = new Set<string>();
        const superDirectors = allUsers.filter(u =>
            u.globalRole === 'Director' &&
            (u.clientId || 'IPS').trim().toUpperCase() === clientNorm &&
            u.subGroups && u.subGroups.length > 0
        );

        const buildGroupChildren = (sgName: string): { node: TreeNode; dashCount: number; avgCap: number } | null => {
            const sgNorm = normalizeGroupName(sgName);
            assignedGroups.add(sgNorm);
            if (hasVisibilityFilter && !visibleGroupsNorm.has(sgNorm)) return null;
            const groupDashboards = dashboardsByGroup.get(sgNorm) || [];
            if (groupDashboards.length === 0 && selectedArea !== 'TODAS') return null;
            const groupAgg = aggByNormGroup.get(sgNorm);
            const dashChildren: TreeNode[] = [];
            
            [...groupDashboards].sort((a, b) => ((a as any).orderNumber || 0) - ((b as any).orderNumber || 0))
                .forEach(d => {
                    dashChildren.push({
                        id: `d-${String(d.id)}`, label: d.title, level: 'dashboard',
                        capturePct: calculateCapture(d), count: 1, children: [],
                        dashboardId: d.id, isAggregate: false
                    });
                });
            const avgCap = groupDashboards.length > 0
                ? groupDashboards.reduce((acc, d) => acc + calculateCapture(d), 0) / groupDashboards.length : 0;

            return {
                node: { 
                    id: `g-${sgNorm}`, 
                    label: sgName.trim().toUpperCase(), 
                    level: 'group', 
                    capturePct: groupAgg ? calculateCapture(groupAgg) : avgCap, 
                    count: groupDashboards.length, 
                    children: dashChildren,
                    dashboardId: groupAgg?.id,
                    isAggregate: !!groupAgg
                },
                dashCount: groupDashboards.length, avgCap
            };
        };

        superDirectors.forEach(sd => {
            const sdTitle = (sd.directorTitle || sd.name || 'DIRECTOR').trim().toUpperCase();
            const sdNorm = normalizeGroupName(sdTitle);
            if (hasVisibilityFilter) {
                return; // 🛡️ v7.8.18: Si tiene filtro (es decir, no es Admin ni SuperDirector), no se envuelve en SuperGrupos. Sus grupos caerán en 'orphans' (raíz).
            }
            const groupChildren: TreeNode[] = [];
            let totalDash = 0, totalCap = 0, capCount = 0;
            (sd.subGroups || []).forEach(sgName => {
                const result = buildGroupChildren(sgName);
                if (!result) return;
                groupChildren.push(result.node);
                totalDash += result.dashCount;
                totalCap += result.avgCap;
                capCount++;
            });
            if (groupChildren.length === 0) return;

            const sdAgg = dashboards.find(d => {
                const dId = String(d.id);
                const isSuperAgg = dId.startsWith('agg-super-') && dId.includes(sdNorm);
                const isMyGlobalAgg = (userProfile?.email === sd.email) && dId.includes('agg-global-total');
                return isSuperAgg || isMyGlobalAgg;
            });

            // 🛡️ UX REFLUX: Aplanamiento agresivo para directores con un único tablero
            if (groupChildren.length === 1 && !sdAgg) {
                const singleGroup = groupChildren[0];
                if (singleGroup.children.length === 1 && !singleGroup.children[0].isAggregate) {
                    nodes.push(singleGroup.children[0]);
                    return;
                }
            }
            nodes.push({
                id: `sg-${sdNorm}`,
                label: sdTitle,
                level: 'supergroup',
                capturePct: sdAgg ? ((sdAgg as any).capturePct || calculateCapture(sdAgg)) : (capCount > 0 ? totalCap / capCount : 0),
                count: totalDash,
                children: groupChildren,
                dashboardId: sdAgg?.id,
                isAggregate: !!sdAgg
            });
        });

        const orphans: TreeNode[] = [];
        dashboardsByGroup.forEach((dashes, normG) => {
            if (assignedGroups.has(normG) || normG === 'SINTESIS' || normG === 'TODOS') return;
            if (hasVisibilityFilter && !visibleGroupsNorm.has(normG)) return;

            const originalName = (dashes[0]?.group || (normG === 'GENERAL' ? 'GENERAL' : normG));
            const result = buildGroupChildren(originalName);
            if (result) {
                // 🛡️ UX REFLUX: Si el grupo solo tiene un tablero, lo aplanamos al nivel superior
                if (result.node.children.length === 1 && !result.node.children[0].isAggregate) {
                    orphans.push(result.node.children[0]);
                } else {
                    orphans.push(result.node);
                }
            }
        });

        // 🛡️ Agregar Agregado Global (GENERAL) al inicio
        // 🛡️ v7.8.23: REGLA DE AISLAMIENTO — Solo mostrar SINTESIS GLOBAL si eres Admin Global (Developer) 
        // y NO tienes un supergrupo asignado que ya cumpla esa función para ti.
        const globalAgg = dashboards.find(d => String(d.id).includes('agg-global-total'));
        const hasSpecificSuperDirectorAccess = superDirectors.length > 0;

        if (globalAgg && isGlobalAdmin && !hasSpecificSuperDirectorAccess && realDashboards.length > 1 && availableAreas.length > 1) {
            nodes.unshift({
                id: 'sg-GLOBAL-GENERAL',
                label: `★ CONSOLIDADO DIRECTIVO GLOBAL`,
                level: 'supergroup',
                capturePct: calculateCapture(globalAgg),
                count: realDashboards.length,
                children: [],
                dashboardId: globalAgg.id
            });
        }

        nodes.push(...orphans);
        return nodes;
    }, [dashboards, areaFilteredDashboards, allUsers, userProfile, isGlobalAdmin, isDirector, clientNorm, selectedArea, realDashboards.length]);

    // 🛡️ REGLA v7.8.16: Sincronización de expansión NO DESTRUCTIVA
    // ADVERTENCIA: No añadir dependencias que no sean estrictamente necesarias.
    // Este efecto solo debe dispararse cuando cambia el dashboard seleccionado
    // para asegurar que el nodo correspondiente sea visible sin cerrar los demás.
    useEffect(() => {
        if (!selectedDashboardId || tree.length === 0) return;
        const selStr = String(selectedDashboardId);

        if (selStr !== prevDashboardId.current) {
            prevDashboardId.current = selStr;

            const newExpansions: Record<string, boolean> = {};
            const findAndExpand = (nodes: TreeNode[]): boolean => {
                let found = false;
                for (const node of nodes) {
                    const isTarget = (node.dashboardId && String(node.dashboardId) === selStr);
                    const childHasTarget = node.children.length > 0 && findAndExpand(node.children);
                    if (isTarget || childHasTarget) {
                        if (node.children.length > 0) newExpansions[node.id] = true;
                        found = true;
                    }
                }
                return found;
            };

            findAndExpand(tree);
            if (Object.keys(newExpansions).length > 0) {
                setExpandedNodes(prev => ({ ...prev, ...newExpansions }));
            }
        }
    }, [selectedDashboardId, tree]);

    // Inicialización automática inteligente
    useEffect(() => {
        if (!hasInitialized.current && tree.length > 0) {
            hasInitialized.current = true;
            // Solo auto-expandimos si NO hay un dashboard seleccionado ya (ej: carga inicial profunda)
            if (!selectedDashboardId) {
                setExpandedNodes(prev => ({ ...prev, [tree[0].id]: true }));
            }
        }
    }, [tree, selectedDashboardId]);

    // const isGeneralExpanded = expandedNodes.has('__general__'); // Redundant section removed

    if (isCollapsed) {
        return (
            <aside className="w-full md:w-14 flex-shrink-0 bg-slate-950/90 backdrop-blur-xl border-b md:border-b-0 md:border-r border-white/[0.04] flex flex-row md:flex-col items-center py-2 md:py-4 px-4 md:px-0 gap-3 sticky top-0 z-40 transition-all duration-300 overflow-x-auto min-h-[60px] md:h-screen">
                <button onClick={onToggleCollapse} className="flex-shrink-0 w-9 h-9 rounded-lg bg-slate-800/60 border border-white/[0.06] flex items-center justify-center text-slate-500 hover:text-cyan-400 transition-all" title="Expandir">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
                </button>
                <div className="h-6 w-[1px] md:w-6 md:h-[1px] bg-white/[0.04] flex-shrink-0" />
                {tree.filter(n => n.level === 'supergroup').map(node => (
                    <button key={node.id} onClick={() => { if (node.dashboardId) onSelectDashboard(node.dashboardId); onToggleCollapse(); }} className="flex-shrink-0 w-11 h-11 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-lg shadow-lg active:scale-90 transition-all" title={node.label}>🏢</button>
                ))}
                <div className="mx-auto md:mx-0 md:mt-auto" />
                <button onClick={() => {
                    const gAgg = tree.find(n => n.id === 'sg-GLOBAL-GENERAL');
                    if (gAgg?.dashboardId) onSelectDashboard(gAgg.dashboardId);
                    onToggleCollapse();
                }} className="flex-shrink-0 w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 text-lg hover:bg-amber-500/20 transition-all shadow-lg active:scale-95" title="GENERAL">🌐</button>
            </aside>
        );
    }

    return (
        <aside className="w-full md:w-[280px] flex-shrink-0 bg-slate-950/95 backdrop-blur-xl border-b md:border-b-0 md:border-r border-white/[0.04] flex flex-col sticky top-0 max-h-[50vh] md:max-h-screen md:h-screen z-40 transition-all duration-300 overflow-hidden">
            <div className="px-4 py-3 border-b border-white/[0.04] flex items-center justify-between flex-shrink-0">
                <div>
                    <h3 className="text-[10px] font-black text-white uppercase tracking-[0.25em]">Navegación</h3>
                    <p className="text-[8px] text-slate-600 font-bold uppercase tracking-widest mt-0.5">{realDashboards.length} {label}s · {availableAreas.length} Áreas</p>
                </div>
                <button onClick={onToggleCollapse} className="w-7 h-7 rounded-md bg-slate-800/60 border border-white/[0.06] flex items-center justify-center text-slate-500 hover:text-cyan-400 transition-all">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                </button>
            </div>

            {availableAreas.length > 0 && (
                <div className="px-3 py-2.5 border-b border-white/[0.04] flex-shrink-0">
                    <p className="text-[7px] font-black text-slate-600 uppercase tracking-[0.2em] mb-1.5">Área Funcional</p>
                    <div className="flex flex-wrap gap-1">
                        <button onClick={() => setSelectedArea('TODAS')} className={`px-4 py-2 rounded text-[10px] font-bold uppercase tracking-wider transition-all min-h-[44px] min-w-[60px] ${selectedArea === 'TODAS' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-slate-800/60 text-slate-500 border border-white/[0.04] hover:text-slate-300'}`}>Todas</button>
                        {availableAreas.map(area => (
                            <button key={area} onClick={() => setSelectedArea(area)} className={`px-4 py-2 rounded text-[10px] font-bold uppercase tracking-wider transition-all min-h-[44px] min-w-[80px] ${selectedArea === area ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800/60 text-slate-500 border border-white/[0.04] hover:text-slate-300'}`}>{area}</button>
                        ))}
                    </div>
                </div>
            )}

            <nav className="flex-grow overflow-y-auto overflow-x-hidden py-2 custom-scrollbar">
                {tree.map(node => (
                    <TreeNodeRenderer key={node.id} node={node} depth={0} expandedNodes={expandedNodes} toggleNode={toggleNode} selectedDashboardId={selectedDashboardId} onSelectDashboard={onSelectDashboard} isGlobalAdmin={isGlobalAdmin} onDeleteDashboard={onDeleteDashboard} />
                ))}

                {isGlobalAdmin && onAddDashboard && (
                    <div className="px-3 py-2 mt-1">
                        <button onClick={onAddDashboard} className="w-full px-3 py-2.5 rounded-lg bg-transparent hover:bg-cyan-500/5 border border-dashed border-white/[0.06] text-[8px] font-black uppercase tracking-widest">+ Nuevo {label}</button>
                    </div>
                )}

            </nav>
            <div className="px-4 py-2 border-t border-white/[0.04] flex-shrink-0 bg-slate-950">
                <div className="text-[7px] text-slate-700 font-bold uppercase tracking-[0.3em] text-center">v8.7.2 · CRITICAL NUCLEAR SHIELD</div>
            </div>
        </aside>
    );
});

interface TreeNodeRendererProps {
    node: TreeNode;
    depth: number;
    expandedNodes: Record<string, boolean>;
    toggleNode: (id: string) => void;
    selectedDashboardId: number | string | null;
    onSelectDashboard: (id: number | string) => void;
    isGlobalAdmin: boolean;
    onDeleteDashboard?: (id: number | string) => void;
}

const TreeNodeRenderer: React.FC<TreeNodeRendererProps> = ({ node, depth, expandedNodes, toggleNode, selectedDashboardId, onSelectDashboard, isGlobalAdmin, onDeleteDashboard }) => {
    const isExpanded = !!expandedNodes[node.id];
    const hasChildren = node.children.length > 0;
    const isSelected = node.dashboardId && String(node.dashboardId) === String(selectedDashboardId);
    const pl = depth * 16 + 12;

    if (node.level === 'supergroup') {
        return (
            <div>
                <div className={`flex items-center gap-0 transition-all ${isSelected ? 'bg-rose-500/10' : 'hover:bg-white/[0.03]'}`} style={{ paddingLeft: `${pl}px` }}>
                    {hasChildren ? <button onClick={() => toggleNode(node.id)} className="p-1.5 hover:bg-white/10 rounded"><ChevronIcon isOpen={isExpanded} /></button> : <span className="w-8" />}
                    <button onClick={() => { if (node.dashboardId) onSelectDashboard(node.dashboardId); }} className="flex-grow flex items-center gap-2 py-3 pr-3 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]" />
                        <div className="flex-grow min-w-0 text-left">
                            <div className={`text-[11px] font-black uppercase tracking-[0.1em] truncate ${isSelected ? 'text-rose-300' : 'text-rose-400/90'}`}>{node.label}</div>
                            <div className="mt-1"><CaptureBar pct={node.capturePct} /></div>
                        </div>
                    </button>
                </div>
                {isExpanded && <div>{node.children.map(child => <TreeNodeRenderer key={child.id} node={child} depth={depth + 1} expandedNodes={expandedNodes} toggleNode={toggleNode} selectedDashboardId={selectedDashboardId} onSelectDashboard={onSelectDashboard} isGlobalAdmin={isGlobalAdmin} />)}</div>}
            </div>
        );
    }

    if (node.level === 'group') {
        return (
            <div>
                <div className={`flex items-center gap-0 transition-all ${isSelected ? 'bg-cyan-500/8' : 'hover:bg-white/[0.03]'}`} style={{ paddingLeft: `${pl}px` }}>
                    {hasChildren ? <button onClick={() => toggleNode(node.id)} className="p-1.5 hover:bg-white/10 rounded"><ChevronIcon isOpen={isExpanded} /></button> : <span className="w-6" />}
                    <button onClick={() => { if (hasChildren && !isExpanded) toggleNode(node.id); if (node.dashboardId) onSelectDashboard(node.dashboardId); else if (node.children[0]?.dashboardId) onSelectDashboard(node.children[0].dashboardId); }} className="flex-grow flex items-center gap-2 py-2.5 pr-3 min-w-0 text-left">
                        <span className="w-2 h-2 rounded-full bg-cyan-500/70" />
                        <div className="flex-grow min-w-0">
                            <div className={`text-[10px] font-black uppercase tracking-[0.06em] truncate ${isSelected ? 'text-cyan-400' : 'text-slate-300'}`}>{node.label}</div>
                            <div className="mt-0.5"><CaptureBar pct={node.capturePct} /></div>
                        </div>
                    </button>
                </div>
                {isExpanded && <div>{node.children.map(child => <TreeNodeRenderer key={child.id} node={child} depth={depth + 1} expandedNodes={expandedNodes} toggleNode={toggleNode} selectedDashboardId={selectedDashboardId} onSelectDashboard={onSelectDashboard} isGlobalAdmin={isGlobalAdmin} />)}</div>}
            </div>
        );
    }

    return (
        <button onClick={() => node.dashboardId && onSelectDashboard(node.dashboardId)} className={`w-full flex items-center gap-2.5 px-3 py-2 transition-all text-left ${isSelected ? 'bg-cyan-500/10 border-r-[3px] border-r-cyan-400' : 'hover:bg-white/[0.04]'}`} style={{ paddingLeft: `${pl}px` }}>
            <span className={`w-1.5 h-1.5 rounded-full ${node.isAggregate ? 'bg-amber-500 shadow-[0_0_4px_rgba(245,158,11,0.4)]' : isSelected ? 'bg-cyan-400' : 'bg-slate-600'}`} />
            <div className="flex-grow min-w-0">
                <div className={`text-[10px] truncate ${node.isAggregate ? 'text-amber-300 font-extrabold uppercase' : isSelected ? 'text-white font-bold' : 'text-slate-400 font-semibold'}`}>{node.label}</div>
                {typeof node.capturePct === 'number' && <div className="mt-0.5"><CaptureBar pct={node.capturePct} /></div>}
            </div>
        </button>
    );
};

export default HierarchySidebar;

// Estilos de Scroll v7.4.1
const scrollStyles = `
  .custom-scrollbar::-webkit-scrollbar {
    width: 4px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: rgba(15, 23, 42, 0.1);
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(51, 65, 85, 0.5);
    border-radius: 10px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgba(6, 182, 212, 0.5);
  }
`;

if (typeof document !== 'undefined') {
    const style = document.createElement('style');
    style.textContent = scrollStyles;
    document.head.appendChild(style);
}
