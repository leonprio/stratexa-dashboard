import React, { useMemo, useState, useEffect, useCallback } from "react";
import {
  Dashboard as DashboardType,
  DashboardRole,
  DashboardItem,
  SystemSettings,
  User,
} from "../types";
import { Dashboard } from "./Dashboard";
import { aiService, AIAnalysisResult } from "../services/aiService";
import { AIAnalysisModal } from "./AIAnalysisModal";
import { DashboardMetadataModal } from "./DashboardMetadataModal";
import { PowerPointExportModal } from "./PowerPointExportModal";
import { calculateDashboardWeightedScore, getStatusForPercentage, calculateCapturePct } from "../utils/compliance";
import { ReportCenter } from "./ReportCenter";

import { CurrentPeriodFocus } from "./CurrentPeriodFocus";
import { exportDashboardToExcel } from '../utils/exportUtils';

interface DashboardViewProps {
  dashboard: DashboardType;
  onUpdateItem: (item: DashboardItem) => void;
  userRole: DashboardRole | null;
  isGlobalAdmin: boolean;
  currentUser: User;
  onUpdateMetadata?: (
    id: number | string,
    title: string,
    subtitle: string,
    group: string,
    area: string,
    superGroup?: string,
    targetIndicatorCount?: number
  ) => Promise<void>;
  existingGroups?: string[];
  settings?: SystemSettings;
  layout?: "grid" | "compact";
  year?: number;
  allDashboards?: DashboardType[];
  isDirector?: boolean;
  onOpenWeights?: () => void;
}

/**
 * Vista detallada de un tablero individual o consolidado.
 * Proporciona visualización de KPIs, análisis de IA, herramientas de exportación y gestión de metadatos.
 * 
 * @component
 * @version v9.2.2-CLEAN-UI
 */
export const DashboardView: React.FC<DashboardViewProps> = React.memo(({
  dashboard,
  onUpdateItem,
  userRole,
  isGlobalAdmin,
  currentUser,
  onUpdateMetadata,
  existingGroups = [],
  settings,
  layout = "grid",
  year,
  allDashboards = [],
  isDirector,
  onOpenWeights,
}) => {
  const [isAnalysisOpen, setIsAnalysisOpen] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AIAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [isEditingMetadata, setIsEditingMetadata] = useState(false);
  const [isExportingPPTX, setIsExportingPPTX] = useState(false);
  
  // ✅ items siempre array (evita fallos y deja evidencia clara si viene vacío)
  const safeItems: DashboardItem[] = useMemo(() => dashboard.items ?? [], [dashboard]);

  // 🛡️ REGLA v6.0.2 (CONTEXT PRIORITY): Priorizar indicadores del tablero actual para evitar colisiones de IDs
  const allContextItems: DashboardItem[] = useMemo(() => {
    const local = safeItems;
    if (!allDashboards || allDashboards.length === 0) return local;

    const globals = allDashboards.flatMap(d => d.items || []);
    // Poner 'local' primero asegura que .find(id) devuelva el de este tablero.
    return [...local, ...globals];
  }, [allDashboards, safeItems]);

  const [selectedItemId, setSelectedItemId] = useState<number | string | null>(null);
  const [activeView, setActiveView] = useState<"dashboard" | "reports">("dashboard");

  const isAggregate = (typeof dashboard.id === 'string' && dashboard.id.startsWith('agg-')) || dashboard.id === -1 || dashboard.isAggregate === true;

  // 🛡️ ESTADO LOCAL DE PRECISIÓN (Inicializado con configuración global)
  // 🎯 PREFERENCIA USUARIO: Iniciar en 0 para tablero más limpio
  const [localDecimalPrecision, setLocalDecimalPrecision] = useState<0 | 1 | 2>(0);

  const activeThresholds = useMemo(() => {
    return dashboard.thresholds || settings?.thresholds || { onTrack: 95, atRisk: 85 };
  }, [dashboard, settings]);

  const totalScore = useMemo(() => {
    return calculateDashboardWeightedScore(safeItems, activeThresholds, year, 'realTime', allContextItems);
  }, [safeItems, activeThresholds, year, allContextItems]);

  const totalStatus = getStatusForPercentage(totalScore, activeThresholds);

  // 🎯 CÁLCULO DE CUMPLIMIENTO REGULATORIO / CAPTURA (Sincronizado v5.5.9.3)
  const capturePct = useMemo(() => {
    if (typeof (dashboard as any).capturePct === 'number') return (dashboard as any).capturePct;
    if (typeof (dashboard as any)._capturePct === 'number') return (dashboard as any)._capturePct;
    return calculateCapturePct(dashboard);
  }, [dashboard]);

  const selectedItem = useMemo(() => {
    if (selectedItemId === null) return null;
    return safeItems.find((it) => it.id === selectedItemId) || null;
  }, [selectedItemId, safeItems]);

  const handleCloseFocus = useCallback(() => setSelectedItemId(null), []);

  const displayTitle = useMemo(() => {
    const t = (dashboard as any).title || "";
    // 🛡️ REGLA v7.9.1-INTEGRITY: Limpiar títulos redundantes en la vista principal
    if (isAggregate || t.toUpperCase().includes("SÍNTESIS") || t.toUpperCase().includes("RESUMEN")) {
      const g = (dashboard as any).group || "DIRECCIÓN DE OPERACIONES";
      const cleanGroup = g.toUpperCase().replace("SÍNTESIS", "").replace("GLOBAL", "").trim();
      return `CONSOLIDADO: ${cleanGroup}`;
    }
    return t;
  }, [dashboard, isAggregate]);

  // 🛡️ UX AUTO-SCROLL (v7.8.35-UX): Desplazar la vista al abrir la gestión detallada
  useEffect(() => {
    if (selectedItemId) {
      setTimeout(() => {
        const el = document.getElementById('gestion-detallada-focus');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 150); // Delay para asegurar renderizado de transición
    }
  }, [selectedItemId]);

  const diag = useMemo(() => {
    const d = dashboard;
    const keys = Object.keys(d);
    return {
      year: year ?? null,
      dashboardId: d.id ?? null,
      title: d.title ?? null,
      group: d.group ?? null,
      subtitle: d.subtitle ?? null,
      itemsCount: Array.isArray(safeItems) ? safeItems.length : -1,
      hasItemsProp: Object.prototype.hasOwnProperty.call(d, "items"),
      keys,
      hasItemsByMonth: Object.prototype.hasOwnProperty.call(d, "itemsByMonth"),
      hasIndicators: Object.prototype.hasOwnProperty.call(d, "indicators"),
    };
  }, [dashboard, safeItems, year]);

  if (!dashboard) {
    return (
      <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800 text-slate-200">
        <div className="text-lg font-semibold">Tablero no disponible</div>
        <div className="mt-2 text-slate-400">
          No se recibió información del tablero. Esto suele pasar si aún se están cargando datos.
        </div>
      </div>
    );
  }

  const handleAnalyze = async () => {
    setIsAnalysisOpen(true);
    setIsAnalyzing(true);
    setAnalysisError(null);
    try {
      const result = await aiService.analyzeDashboard({
        ...dashboard,
        items: safeItems,
      } as any);
      setAnalysisResult(result);
    } catch (error) {
      console.error("Error analyzing dashboard:", error);
      setAnalysisError("No se pudo completar el análisis. Intenta de nuevo.");
      setAnalysisResult(null);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleTogglePrecision = () => {
    // Ciclo: 0 -> 1 -> 2 -> 0
    setLocalDecimalPrecision(prev => (prev === 0 ? 1 : prev === 1 ? 2 : 0));
  };

  return (
    <div key={(dashboard as any).id} className="space-y-4 animate-in fade-in duration-700 fill-mode-both">
      {/* HEADER SECTION */}
      <div className="DashboardView_Header flex justify-between items-center border-b border-white/5 pb-2 gap-4">
        <div className="flex items-center gap-6">
          <div className="flex flex-col">
            <div className="flex items-center gap-3">
              <h2
                className="text-2xl font-black text-white uppercase tracking-tight leading-none cursor-help"
                title={isGlobalAdmin ? `Tablero #${(dashboard as any).orderNumber || 'N/A'}` : undefined}
              >
                {displayTitle}
              </h2>
              {isGlobalAdmin && (
                <button
                  onClick={() => setIsEditingMetadata(true)}
                  className="p-2 bg-cyan-500/10 hover:bg-cyan-500 border border-cyan-500/30 rounded-xl text-cyan-400 hover:text-white transition-all hover:scale-110 flex items-center gap-2"
                  title="Configurar Metadatos"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                  </svg>
                  <span className="text-[8px] font-black uppercase">Ficha</span>
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${isAggregate ? 'bg-indigo-500 shadow-[0_0_8px_#6366f1]' : 'bg-cyan-500 shadow-[0_0_8px_#22d3ee]'}`} />
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">
                  {isAggregate ? 'Tablero Consolidado' : 'Dashboard Operativo'}
                </span>
              </div>
              {(dashboard as any).area && (
                <>
                  <span className="text-slate-700 font-black text-[10px]">•</span>
                  <div className="flex items-center gap-1.5 bg-orange-500/10 border border-orange-500/30 px-2 py-0.5 rounded-full">
                    <span className="text-[9px] font-black text-orange-400 uppercase tracking-widest">
                      Área: {(dashboard as any).area}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2 sm:gap-4 w-full lg:w-auto">
          {/* CUMPLIMIENTO GLOBAL BADGE */}
          <div className="flex items-center gap-3 glass-panel px-4 py-1.5 rounded-xl shadow-xl border border-white/5">
            <div className="flex flex-col items-end">
              <span className="text-[8px] sm:text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Cumplimiento Global</span>
              <span className={`text-2xl sm:text-3xl font-black tabular-nums leading-none ${totalStatus === 'OnTrack' ? 'text-emerald-400' : totalStatus === 'AtRisk' ? 'text-amber-400' : 'text-rose-400'}`}>
                {Math.round(totalScore)}%
              </span>
            </div>
            <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 border-slate-950/50 ${totalStatus === 'OnTrack' ? 'bg-emerald-500' : totalStatus === 'AtRisk' ? 'bg-amber-500' : 'bg-rose-500'}`} />
          </div>

          {/* CAPTURA BADGE */}
          {typeof capturePct === 'number' && (
            <div className="flex items-center gap-3 border border-white/5 bg-slate-900/50 px-4 py-1.5 rounded-xl shadow-lg">
              <div className="flex flex-col items-end">
                <span className="text-[8px] sm:text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Captura</span>
                <div className="flex items-center gap-2">
                  <span className={`text-base sm:text-lg font-black tracking-tight ${capturePct === 100 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {capturePct}%
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              onClick={handleAnalyze}
              className="group flex items-center gap-2 bg-gradient-to-br from-indigo-500 via-purple-600 to-fuchsia-600 hover:from-indigo-400 hover:to-fuchsia-500 text-white px-3 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all border border-white/20 active:scale-95 whitespace-nowrap"
            >
              <span className="text-sm">✨</span>
              <span>Audit IA</span>
            </button>

            {(isGlobalAdmin || currentUser.canExportPPT) && (
              <button
                onClick={() => setIsExportingPPTX(true)}
                className="flex items-center gap-2 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white px-3 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95"
              >
                <span className="text-sm">📊</span>
                <span className="hidden sm:inline">Exportar </span>PPTX
              </button>
            )}

            {/* PRECISION TOGGLE */}
            <button
              onClick={handleTogglePrecision}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white px-3 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all border border-white/5 min-w-[50px] justify-center"
              title="Alternar decimales visibles (0, 1 o 2)"
            >
              <span className="text-sm font-black">{localDecimalPrecision === 2 ? '.00' : localDecimalPrecision === 1 ? '.0' : '0'}</span>
            </button>

            <div className="flex bg-slate-900/95 p-0.5 rounded-xl border border-white/10 shadow-2xl backdrop-blur-xl">
              <button
                onClick={() => setActiveView("dashboard")}
                className={`px-4 sm:px-6 py-2 rounded-xl text-[9px] font-extrabold uppercase tracking-widest transition-all duration-500 flex items-center gap-2 ${activeView === 'dashboard' ? 'bg-cyan-600 text-white shadow-[0_0_20px_rgba(8,145,178,0.5)]' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}
              >
                <span>📊</span> <span className="hidden sm:inline">Tablero</span>
              </button>
              <button
                onClick={() => setActiveView("reports")}
                className={`px-4 sm:px-6 py-2 rounded-xl text-[9px] font-extrabold uppercase tracking-widest transition-all duration-500 flex items-center gap-2 ${activeView === 'reports' ? 'bg-indigo-600 text-white shadow-[0_0_20px_rgba(79,70,229,0.5)]' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}
              >
                <span>📑</span> <span className="hidden sm:inline">Reporte</span>
              </button>
            </div>

            {isAggregate && isGlobalAdmin && onOpenWeights && (
              <button
                onClick={onOpenWeights}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all"
              >
                <span className="text-base">⚖️</span>
                <span>Pesos</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {analysisError && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200">
          {analysisError}
        </div>
      )}

      {/* SELECTED ITEM FOCUS SECTION */}
      {selectedItem && (
        <div className="mb-8" id="gestion-detallada-focus">
          <CurrentPeriodFocus
            item={selectedItem}
            globalThresholds={activeThresholds}
            year={year}
            onUpdateItem={onUpdateItem}
            canEdit={(userRole === DashboardRole.Editor && !isAggregate) || isGlobalAdmin}
            onClose={handleCloseFocus}
            allDashboardItems={safeItems}
            decimalPrecision={localDecimalPrecision as 0 | 1 | 2}
          />
        </div>
      )}

      {/* EMPTY STATE */}
      {diag.itemsCount === 0 && (
        <div className="py-12 px-6 rounded-3xl bg-slate-900/30 border-2 border-dashed border-slate-800 text-center flex flex-col items-center">
          <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4 text-3xl">📊</div>
          <h3 className="text-xl font-bold text-white">Tablero Sin Indicadores</h3>
          <p className="text-slate-400 max-w-md mt-2 mb-6 text-sm">Este tablero aún no tiene indicadores asignados.</p>
          {isGlobalAdmin && (
            <button
               onClick={() => (window as any).openIndicatorManager?.()}
               className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg text-xs uppercase tracking-widest transition-all"
            >
              + Gestionar KPIs
            </button>
          )}
        </div>
      )}

      {/* MAIN CONTENT VIEW */}
      {activeView === 'dashboard' ? (
        <Dashboard
          key={`dashboard-${(dashboard as any).id}`}
          data={safeItems}
          onUpdateItem={onUpdateItem}
          globalThresholds={activeThresholds}
          userRoleForDashboard={userRole}
          layout={layout}
          year={year}
          allDashboards={allDashboards}
          isAggregate={isAggregate}
          selectedItemId={selectedItemId}
          onSelectItem={setSelectedItemId}
          decimalPrecision={localDecimalPrecision}
          allContextItems={allContextItems}
          isGlobalAdmin={isGlobalAdmin}
        />
      ) : (
        <ReportCenter
          items={safeItems}
          thresholds={activeThresholds}
          year={year}
          allDashboards={allDashboards}
          currentDashboardId={dashboard.id}
          user={currentUser}
          onClose={() => setActiveView("dashboard")}
          onEditItem={(id) => {
            setSelectedItemId(id);
            setActiveView("dashboard");
          }}
        />
      )}

      {/* MODALS */}
      <AIAnalysisModal
        isOpen={isAnalysisOpen}
        onClose={() => setIsAnalysisOpen(false)}
        analysis={analysisResult}
        isLoading={isAnalyzing}
        title={(dashboard as any).title}
      />

      {(isGlobalAdmin || isDirector) && onUpdateMetadata && (
        <DashboardMetadataModal
          isOpen={isEditingMetadata}
          onClose={() => setIsEditingMetadata(false)}
          currentTitle={(dashboard as any).title}
          currentSubtitle={(dashboard as any).subtitle || ""}
          currentGroup={(dashboard as any).group}
          currentArea={(dashboard as any).area || ""}
          currentSuperGroup={(dashboard as any).superGroup || ""}
          currentTargetIndicatorCount={(dashboard as any).targetIndicatorCount}
          totalIndicatorsCount={safeItems.length}
          onSave={async (title, subtitle, group, area, superGroup, targetCount) => {
            await (onUpdateMetadata as any)((dashboard as any).id, title, subtitle, group, area, superGroup, targetCount);
          }}
          existingGroups={existingGroups}
          groupLabel={settings?.groupLabel || "Agrupación"}
          dashboardLabel={settings?.dashboardLabel || "Tablero"}
        />
      )}

      <PowerPointExportModal
        isOpen={isExportingPPTX}
        onClose={() => setIsExportingPPTX(false)}
        dashboards={allDashboards.length > 0 ? allDashboards : [dashboard]}
        globalThresholds={activeThresholds}
        year={year}
        title={(dashboard as any).title}
      />
    </div>
  );
});

DashboardView.displayName = "DashboardView";
