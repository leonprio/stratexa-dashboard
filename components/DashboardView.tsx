import React, { useMemo, useState } from "react";
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
// ActionPlan was unused
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
    area: string
  ) => Promise<void>;
  existingGroups?: string[];
  settings?: SystemSettings;
  layout?: "grid" | "compact";
  year?: number;
  allDashboards?: DashboardType[];
  isDirector?: boolean;
  onOpenWeights?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
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
  const [analysisResult, setAnalysisResult] = useState<AIAnalysisResult | null>(
    null
  );
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [isEditingMetadata, setIsEditingMetadata] = useState(false);
  const [isExportingPPTX, setIsExportingPPTX] = useState(false);
  // ✅ items siempre array (evita fallos y deja evidencia clara si viene vacío)
  const safeItems: DashboardItem[] = useMemo(() => dashboard.items ?? [], [dashboard]);

  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [activeView, setActiveView] = useState<"dashboard" | "reports">("dashboard");

  const isAggregate = (typeof dashboard.id === 'string' && dashboard.id.startsWith('agg-')) || dashboard.id === -1 || dashboard.isAggregate === true;

  // 🛡️ ESTADO LOCAL DE PRECISIÓN (Inicializado con configuración global)
  // Permite a CUALQUIER USUARIO cambiar temporalmente la vista de decimales
  const [localDecimalPrecision, setLocalDecimalPrecision] = useState<1 | 2>(() => settings?.decimalPrecision || 2);

  const activeThresholds = useMemo(() => {
    return dashboard.thresholds || settings?.thresholds || { onTrack: 95, atRisk: 85 };
  }, [dashboard, settings]);

  const totalScore = useMemo(() => {
    return calculateDashboardWeightedScore(safeItems, activeThresholds, year);
  }, [safeItems, activeThresholds, year]);

  const totalStatus = getStatusForPercentage(totalScore, activeThresholds);

  // 🎯 CÁLCULO DE CUMPLIMIENTO REGULATORIO / CAPTURA (Sincronizado v5.5.9.3)
  const capturePct = useMemo(() => {
    if (isAggregate) return null;
    return calculateCapturePct(dashboard);
  }, [dashboard, isAggregate]);

  // Sincronizar si cambia settings (opcional, pero buena práctica si settings carga asíncrono)
  // React.useEffect(() => {
  //   if (settings?.decimalPrecision) setLocalDecimalPrecision(settings.decimalPrecision);
  // }, [settings?.decimalPrecision]);

  const selectedItem = useMemo(() => {
    if (selectedItemId === null) return null;
    return safeItems.find((it) => it.id === selectedItemId) || null;
  }, [selectedItemId, safeItems]);

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

  // ✅ Protección anti-blank (MOVIDO DESPUÉS DE HOOKS)
  if (!dashboard) {
    return (
      <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800 text-slate-200">
        <div className="text-lg font-semibold">Tablero no disponible</div>
        <div className="mt-2 text-slate-400">
          No se recibió información del tablero. Esto suele pasar si aún se
          están cargando datos o si el tablero seleccionado no existe para el
          año elegido.
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

  return (
    <div key={(dashboard as any).id} className="space-y-6 animate-in fade-in duration-700 fill-mode-both">
      <div className="DashboardView_Header flex justify-between items-center border-b border-white/5 pb-4 gap-4">
        <div className="flex items-center gap-6">
          <div className="flex flex-col">
            <div className="flex items-center gap-3">
              <h2
                className="text-3xl font-black text-white uppercase tracking-tight leading-none cursor-help"
                title={isGlobalAdmin ? `Tablero #${(dashboard as any).orderNumber || 'N/A'}` : undefined}
              >
                {(dashboard as any).title}
              </h2>
              {isGlobalAdmin && (
                <button
                  onClick={() => {
                    console.log("🛠️ Metadata Modal Triggered");
                    setIsEditingMetadata(true);
                  }}
                  className="p-2 bg-cyan-500/10 hover:bg-cyan-500 border border-cyan-500/30 rounded-xl text-cyan-400 hover:text-white transition-all hover:scale-110 flex items-center gap-2"
                  title="Configurar Título, Grupo y Área Funcional"
                  aria-label="Abrir configuración de área y metadatos del tablero"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                  </svg>
                  <span className="text-[9px] font-black uppercase">Configurar Área</span>
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
          <div
            className="flex items-center gap-3 sm:gap-4 glass-panel px-4 sm:px-6 py-2 sm:py-3 rounded-2xl shadow-2xl"
            role="group"
            aria-label="Resumen de cumplimiento global"
          >
            <div className="flex flex-col items-end">
              <span className="text-[8px] sm:text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Cumplimiento Global</span>
              <span
                className={`text-3xl sm:text-4xl font-black tabular-nums leading-none ${totalStatus === 'OnTrack' ? 'text-emerald-400 drop-shadow-[0_0_12px_rgba(16,185,129,0.4)]' : totalStatus === 'AtRisk' ? 'text-amber-400 drop-shadow-[0_0_12px_rgba(245,158,11,0.4)]' : 'text-rose-400 drop-shadow-[0_0_12px_rgba(244,63,94,0.4)]'}`}
                aria-label={`Valor: ${Math.round(totalScore)} por ciento. Estado: ${totalStatus === 'OnTrack' ? 'En Tiempo' : totalStatus === 'AtRisk' ? 'En Riesgo' : 'Critico'}`}
              >
                {Math.round(totalScore)}%
              </span>
            </div>
            <div className="relative">
              <div className={`absolute inset-0 rounded-full blur-[8px] opacity-40 animate-pulse ${totalStatus === 'OnTrack' ? 'bg-emerald-500' : totalStatus === 'AtRisk' ? 'bg-amber-500' : 'bg-rose-500'}`} aria-hidden="true" />
              <div className={`relative w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 border-slate-950/50 ${totalStatus === 'OnTrack' ? 'bg-emerald-500' : totalStatus === 'AtRisk' ? 'bg-amber-500' : 'bg-rose-500'}`} aria-hidden="true" />
            </div>
          </div>

          {/* 🎯 BADGE DE CAPTURA (v5.5.3) */}
          {!isAggregate && capturePct !== null && (
            <div
              className="flex items-center gap-3 sm:gap-4 border border-white/5 bg-slate-900/50 px-4 sm:px-5 py-2 sm:py-3 rounded-2xl shadow-xl"
              role="group"
              aria-label="Estado de captura de indicadores"
            >
              <div className="flex flex-col items-end">
                <span className="text-[8px] sm:text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Captura</span>
                <div className="flex items-center gap-2">
                  <span className={`text-lg sm:text-xl font-black tracking-tight ${capturePct === 100 ? 'text-emerald-400' : capturePct > 0 ? 'text-amber-400' : 'text-slate-500'}`}>
                    {capturePct}%
                  </span>
                  <div
                    className="h-1 w-8 sm:h-1.5 sm:w-12 bg-slate-800 rounded-full overflow-hidden"
                    role="progressbar"
                    aria-valuenow={capturePct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div
                      className={`h-full transition-all duration-1000 ${capturePct === 100 ? 'bg-emerald-500' : capturePct > 0 ? 'bg-amber-500' : 'bg-slate-700'}`}
                      style={{ width: `${capturePct}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              onClick={handleAnalyze}
              className="group flex items-center gap-2 bg-gradient-to-br from-indigo-500 via-purple-600 to-fuchsia-600 hover:from-indigo-400 hover:to-fuchsia-500 text-white px-4 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all border border-white/20 shadow-xl shadow-purple-900/40 active:scale-95 whitespace-nowrap"
              aria-label="Ejecutar análisis inteligente con IA del tablero"
            >
              <span className="text-base group-hover:rotate-12 transition-transform drop-shadow-lg" aria-hidden="true">✨</span>
              <span className="drop-shadow-md">Audit IA</span>
            </button>

            {(isGlobalAdmin || currentUser.canExportPPT) && (
              <button
                onClick={() => setIsExportingPPTX(true)}
                className="flex items-center gap-2 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white px-4 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all border border-white/10 shadow-lg shadow-orange-900/40 active:scale-95"
                title="Exportar presentación ejecutiva a PowerPoint"
              >
                <span className="text-base">📊</span>
                <span className="hidden sm:inline">Exportar </span>PPTX
              </button>
            )}

            <button
              onClick={() => setLocalDecimalPrecision(prev => prev === 1 ? 2 : 1)}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white px-3 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all border border-white/5"
              title="Alternar decimales visibles (1 o 2)"
              aria-label={`Mostrar ${localDecimalPrecision === 1 ? 'dos' : 'un'} decimales`}
            >
              <span className="text-base" aria-hidden="true">.{localDecimalPrecision === 1 ? '0' : '00'}</span>
            </button>

            <div className="flex bg-slate-900/95 p-1 rounded-2xl border border-white/10 shadow-2xl backdrop-blur-xl">
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
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all border border-white/10 shadow-lg shadow-indigo-900/40 active:scale-95"
                title="Configurar pesos de los tableros que alimentan este consolidado"
              >
                <span className="text-base">⚖️</span>
                <span>Pesos</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ✅ Si la IA falla, no rompemos UI */}
      {analysisError && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200">
          {analysisError}
        </div>
      )}

      {/* ✅ Estado inicial amigable (Empty State) */}
      {/* 🚀 FOCO EN PERIODO ACTUAL (v2.6.0) */}
      {selectedItem && (
        <div className="mb-8">
          <CurrentPeriodFocus
            item={selectedItem}
            globalThresholds={activeThresholds}
            year={year}
            onUpdateItem={(updated) => {
              onUpdateItem(updated);
              // No cerramos el foco para permitir ver el efecto del cambio
            }}
            canEdit={userRole === DashboardRole.Editor && !isAggregate}
            onClose={() => setSelectedItemId(null)}
            allDashboardItems={safeItems}
          />
        </div>
      )}

      {(diag.itemsCount === 0 || diag.itemsCount === -1) && (
        <div className="py-12 px-6 rounded-3xl bg-slate-900/30 border-2 border-dashed border-slate-800 text-center flex flex-col items-center">
          <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4 text-3xl">
            📊
          </div>
          <h3 className="text-xl font-bold text-white">Tablero Nuevo</h3>
          <p className="text-slate-400 max-w-md mt-2 mb-6 text-sm">
            Este tablero está listo pero aún no tiene indicadores asignados. Usa el botón &quot;KPIs&quot; (Gestión de Indicadores) en el menú superior para agregar métricas.
          </p>
          {isGlobalAdmin && (
            <button
              onClick={() => (window as any).openIndicatorManager?.()}
              className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg text-xs uppercase tracking-widest transition-all shadow-lg shadow-cyan-900/20"
            >
              + Agregar Indicadores
            </button>
          )}
        </div>
      )}

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
          currentTargetIndicatorCount={(dashboard as any).targetIndicatorCount}
          totalIndicatorsCount={safeItems.length}
          onSave={async (title, subtitle, group, area, targetCount) => {
            await (onUpdateMetadata as any)((dashboard as any).id, title, subtitle, group, area, targetCount);
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
};
