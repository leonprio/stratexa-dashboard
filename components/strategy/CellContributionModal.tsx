import React, { useState, useMemo, useEffect } from "react";
import {
  X,
  Plus,
  Trash2,
  Edit2,
  Check,
  Building2,
  Target,
  Compass,
  Layers,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  ShieldAlert,
} from "lucide-react";
import {
  StrategicPerspective,
  StrategicObjective,
  AreaStrategyConfig,
  ContributionObjective,
  ContributionIndicatorAssignment,
  deriveAreaCodeSuggestion,
  resolveAreaStrategyConfig,
} from "../../strategyTypes";
import { Dashboard as DashboardType, User, GlobalUserRole, DashboardItem } from "../../types";
import { strategyService } from "../../services/strategyService";
import {
  contributionPickerCatalog,
  contributionPickerCandidates,
  isOperationalDashboard,
} from "../../contributionConfiguration";
import { formatNumberWithCommas } from "../../utils/formatters";
import { calculateCompliance } from "../../utils/compliance";

export interface CellContributionModalProps {
  areaName: string;
  areaConfigs: AreaStrategyConfig[];
  oe: StrategicObjective;
  perspective?: StrategicPerspective | null;
  cellOCs: ContributionObjective[];
  assignments: ContributionIndicatorAssignment[];
  dashboards: DashboardType[];
  selectedClientId: string;
  currentUser?: User;
  onClose: () => void;
  onRefreshData: () => Promise<void>;
  onNavigateToDashboard?: (
    dashboardId: number | string,
    itemId: number | string,
  ) => void;
  initialEditingOCId?: string | null;
  initialFormOpen?: boolean;
}

export const CellContributionModal: React.FC<CellContributionModalProps> = ({
  areaName,
  areaConfigs,
  oe,
  perspective,
  cellOCs,
  assignments,
  dashboards,
  selectedClientId,
  currentUser,
  onClose,
  onRefreshData,
  onNavigateToDashboard,
  initialEditingOCId = null,
  initialFormOpen = false,
}) => {
  const isAdmin = currentUser?.globalRole === GlobalUserRole.Admin;

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const initialOC = useMemo(() => {
    return initialEditingOCId
      ? cellOCs.find((o) => o.id === initialEditingOCId)
      : null;
  }, [initialEditingOCId, cellOCs]);

  // Form State
  const [isFormOpen, setIsFormOpen] = useState(
    initialFormOpen || cellOCs.length === 0 || !!initialEditingOCId,
  );
  const [editingOCId, setEditingOCId] = useState<string | null>(
    initialEditingOCId,
  );
  const [ocTitle, setOcTitle] = useState<string>(initialOC?.title || "");
  const [ocDescription, setOcDescription] = useState<string>(
    initialOC?.description || "",
  );
  const [selectedKpisForOC, setSelectedKpisForOC] = useState<string[]>([]); // array of "dashboardId_itemId"
  const [assignmentBaseline, setAssignmentBaseline] = useState<
    ContributionIndicatorAssignment[]
  >([]);
  const [freshAssignments, setFreshAssignments] = useState<
    ContributionIndicatorAssignment[] | null
  >(null);
  const [pendingDeleteOC, setPendingDeleteOC] = useState<ContributionObjective | null>(
    null,
  );

  const normArea = areaName.trim().toUpperCase();
  const areaCfg = resolveAreaStrategyConfig(normArea, areaConfigs);
  const areaCode = areaCfg?.code || deriveAreaCodeSuggestion(normArea);

  // KPIs disponibles en tableros operativos de esta Área
  const activeAssignments = freshAssignments || assignments;
  const operationalCatalog = useMemo(
    () => contributionPickerCatalog(dashboards, selectedClientId),
    [dashboards, selectedClientId],
  );

  const areaDashboardsAndItems = useMemo(
    () =>
      contributionPickerCandidates(
        dashboards,
        selectedClientId,
        normArea,
        areaConfigs,
        editingOCId,
        activeAssignments,
      ),
    [
      dashboards,
      selectedClientId,
      normArea,
      areaConfigs,
      editingOCId,
      activeAssignments,
    ],
  );

  // Inicializar edición si se pasa initialEditingOCId
  useEffect(() => {
    if (initialEditingOCId) {
      const oc = cellOCs.find((o) => o.id === initialEditingOCId);
      if (oc) {
        startEditOC(oc);
      }
    }
  }, [initialEditingOCId]);

  const startEditOC = async (oc: ContributionObjective) => {
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    let persisted: ContributionIndicatorAssignment[] = [];
    try {
      persisted = await strategyService.getAssignments(selectedClientId);
    } catch (error: any) {
      persisted = assignments;
    }
    setFreshAssignments(persisted);
    setAssignmentBaseline(
      persisted.filter((a) => a.contributionObjectiveId === oc.id),
    );
    setEditingOCId(oc.id);
    setOcTitle(oc.title);
    setOcDescription(oc.description || "");
    setSelectedKpisForOC(
      persisted
        .filter((a) => a.contributionObjectiveId === oc.id)
        .map((a) => `${a.dashboardId}_${a.itemId}`),
    );
    setIsFormOpen(true);
    setLoading(false);
  };

  const cancelForm = () => {
    setEditingOCId(null);
    setOcTitle("");
    setOcDescription("");
    setSelectedKpisForOC([]);
    setIsFormOpen(false);
    setErrorMsg(null);
  };

  const toggleKpiSelection = (
    dashId: number | string,
    itemId: number | string,
  ) => {
    const key = `${dashId}_${itemId}`;
    setSelectedKpisForOC((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  const handleSaveOC = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    if (!ocTitle.trim()) {
      setErrorMsg("Proporciona un título para el Objetivo de Contribución.");
      return;
    }

    try {
      setLoading(true);
      setErrorMsg(null);

      // Asegurar que el área tenga configuración registrada si es necesario
      let targetAreaCfg = areaCfg;
      if (!targetAreaCfg && normArea !== "GENERAL") {
        targetAreaCfg = await strategyService.saveAreaConfig(
          normArea,
          areaCode,
          selectedClientId,
        );
      }

      const existingOC = cellOCs.find((oc) => oc.id === editingOCId);
      const definitionUnchanged =
        existingOC &&
        existingOC.areaName === normArea &&
        existingOC.primaryStrategicObjectiveId === oe.id &&
        existingOC.title === ocTitle.trim() &&
        (existingOC.description || "") === ocDescription.trim();

      const kpiItems = selectedKpisForOC.map((key) => {
        const candidate = operationalCatalog.find((kpi) =>
          kpi.physicalAliases.some(
            (alias) => `${alias.dashboard.id}_${alias.item.id}` === key,
          ),
        );
        const selectedAlias = candidate?.physicalAliases.find(
          (alias) => `${alias.dashboard.id}_${alias.item.id}` === key,
        );
        if (!selectedAlias || !candidate) {
          throw new Error(
            "Existe una asignación no resoluble. Revisa su identidad operativa.",
          );
        }
        return {
          dashboardId: selectedAlias.dashboard.id,
          itemId: selectedAlias.item.id,
          logicalKpiId: candidate.identity,
          year: selectedAlias.dashboard.year,
          physicalAliases: candidate.physicalAliases.map((alias) => ({
            dashboardId: alias.dashboard.id,
            itemId: alias.item.id,
          })),
        };
      });

      const savedOC = definitionUnchanged
        ? existingOC
        : await strategyService.saveContributionObjective({
            id: editingOCId || undefined,
            areaName: normArea,
            areaConfigId: targetAreaCfg?.id,
            primaryStrategicObjectiveId: oe.id,
            title: ocTitle.trim(),
            description: ocDescription.trim(),
            clientId: selectedClientId,
          });

      await strategyService.saveAssignmentsForOC(
        savedOC.id,
        kpiItems,
        selectedClientId,
        {
          expectedAssignments: editingOCId ? assignmentBaseline : [],
        },
      );

      const persisted = await strategyService.getAssignments(selectedClientId);
      setFreshAssignments(persisted);
      await onRefreshData();

      setSuccessMsg(
        `Objetivo de Contribución ${savedOC.displayCode} ${
          editingOCId ? "actualizado" : "guardado"
        } con éxito.`,
      );
      setEditingOCId(null);
      setOcTitle("");
      setOcDescription("");
      setSelectedKpisForOC([]);
      setIsFormOpen(false);
    } catch (err: any) {
      setErrorMsg(err.message || "Error al guardar Objetivo de Contribución.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteOC = async () => {
    if (!isAdmin || !pendingDeleteOC) return;

    try {
      setLoading(true);
      setErrorMsg(null);
      await strategyService.deleteContributionObjective(
        pendingDeleteOC.id,
        selectedClientId,
      );
      await onRefreshData();
      setSuccessMsg(
        `Objetivo de Contribución ${pendingDeleteOC.displayCode} eliminado.`,
      );
      setPendingDeleteOC(null);
      if (editingOCId === pendingDeleteOC.id) {
        cancelForm();
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Error al eliminar Objetivo de Contribución.");
    } finally {
      setLoading(false);
    }
  };

  // Resolver KPIs vinculados para cada OC
  const getLinkedKpisForOC = (ocId: string) => {
    const ocAssignments = activeAssignments.filter(
      (a) => a.contributionObjectiveId === ocId,
    );
    const result: { dashboard: DashboardType; item: DashboardItem }[] = [];

    ocAssignments.forEach((asgn) => {
      const dbMatch = dashboards.find(
        (d) => String(d.id) === String(asgn.dashboardId),
      );
      if (dbMatch) {
        const itemMatch = (dbMatch.items || []).find(
          (it) => String(it.id) === String(asgn.itemId),
        );
        if (itemMatch) {
          result.push({ dashboard: dbMatch, item: itemMatch });
        }
      }
    });

    return result;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header con Contexto Bloqueado: Área y OE */}
        <div className="p-6 border-b border-slate-800 bg-slate-950 flex justify-between items-start">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-1 text-xs font-bold rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-1.5 font-mono">
                <Building2 className="w-3.5 h-3.5" />
                {areaCode} · {normArea}
              </span>
              <span className="px-2.5 py-1 text-xs font-bold rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5 font-mono">
                <Target className="w-3.5 h-3.5" />
                {oe.code}
              </span>
              {perspective && (
                <span
                  className="px-2.5 py-0.5 text-xs font-semibold rounded-md text-white flex items-center gap-1.5"
                  style={{ backgroundColor: perspective.color || "#3B82F6" }}
                >
                  <Compass className="w-3.5 h-3.5" />
                  {perspective.name}
                </span>
              )}
            </div>

            <h2 className="text-xl font-black text-white tracking-tight">
              Objetivos de Contribución: {oe.title}
            </h2>
            {oe.description && (
              <p className="text-xs text-slate-400 leading-relaxed max-w-2xl">
                {oe.description}
              </p>
            )}
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-200">
          {/* Mensajes de Alerta */}
          {errorMsg && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
          {successMsg && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-xs font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Lista de Objetivos de Contribución existentes en esta celda */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-400" />
                Objetivos de Contribución ({cellOCs.length})
              </h3>
              {isAdmin && !isFormOpen && (
                <button
                  onClick={() => {
                    cancelForm();
                    setIsFormOpen(true);
                  }}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Nuevo Objetivo de Contribución
                </button>
              )}
            </div>

            {cellOCs.length === 0 && !isFormOpen ? (
              <div className="p-8 text-center bg-slate-950/60 rounded-xl border border-slate-800/80 text-slate-400 space-y-3">
                <p className="text-sm font-medium text-slate-300">
                  No hay Objetivos de Contribución registrados para el Área{" "}
                  <strong className="text-white">{normArea}</strong> hacia{" "}
                  <strong className="text-emerald-400">{oe.code}</strong>.
                </p>
                {isAdmin && (
                  <button
                    onClick={() => setIsFormOpen(true)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold inline-flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    + Agregar objetivo
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {cellOCs.map((oc) => {
                  const linkedKpis = getLinkedKpisForOC(oc.id);
                  const isBeingEdited = editingOCId === oc.id;

                  return (
                    <div
                      key={oc.id}
                      className={`p-4 rounded-xl border transition-all ${
                        isBeingEdited
                          ? "bg-slate-900 border-emerald-500 ring-1 ring-emerald-500/50"
                          : "bg-slate-950/80 border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 text-xs font-bold rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">
                              {oc.displayCode}
                            </span>
                            <h4 className="text-sm font-bold text-white">
                              {oc.title}
                            </h4>
                          </div>
                          {oc.description && (
                            <p className="text-xs text-slate-400">
                              {oc.description}
                            </p>
                          )}
                        </div>

                        {/* Acciones de administración */}
                        {isAdmin && (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => startEditOC(oc)}
                              disabled={loading}
                              className="px-2.5 py-1 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg flex items-center gap-1 transition-colors"
                              title="Editar objetivo y asignaciones de KPIs"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              Editar
                            </button>
                            <button
                              onClick={() => setPendingDeleteOC(oc)}
                              disabled={loading}
                              className="px-2.5 py-1 text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg flex items-center gap-1 transition-colors"
                              title="Eliminar objetivo de contribución"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Eliminar
                            </button>
                          </div>
                        )}
                      </div>

                      {/* KPIs vinculados al OC */}
                      <div className="mt-3 pt-3 border-t border-slate-900 space-y-2">
                        <div className="flex items-center justify-between text-xs text-slate-400">
                          <span className="font-semibold">
                            KPIs Vinculados ({linkedKpis.length}):
                          </span>
                        </div>

                        {linkedKpis.length === 0 ? (
                          <span className="text-[11px] text-slate-500 italic block">
                            Sin KPIs operativos asignados.
                          </span>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                            {linkedKpis.map(({ dashboard, item }) => (
                              <div
                                key={`${dashboard.id}_${item.id}`}
                                className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800/80 text-xs flex items-center justify-between gap-2"
                              >
                                <div className="truncate">
                                  <div className="text-[10px] text-slate-500 truncate">
                                    {dashboard.title}
                                  </div>
                                  <div className="text-xs font-semibold text-white truncate">
                                    {item.indicator}
                                  </div>
                                </div>
                                {onNavigateToDashboard && (
                                  <button
                                    onClick={() =>
                                      onNavigateToDashboard(
                                        dashboard.id,
                                        item.id,
                                      )
                                    }
                                    className="p-1 text-slate-400 hover:text-white shrink-0"
                                    title="Ver en Tablero"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Formulario de Alta / Edición (Admin Only) */}
          {isAdmin && isFormOpen && (
            <form
              onSubmit={handleSaveOC}
              className="p-5 bg-slate-950 border border-emerald-500/30 rounded-xl space-y-4 shadow-lg animate-in fade-in duration-200"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  {editingOCId
                    ? "Editar Objetivo de Contribución"
                    : "Nuevo Objetivo de Contribución"}
                </h3>
                <button
                  type="button"
                  onClick={cancelForm}
                  className="text-xs text-slate-400 hover:text-slate-200"
                >
                  Cancelar
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Título del Objetivo de Contribución *
                  </label>
                  <input
                    type="text"
                    value={ocTitle}
                    onChange={(e) => setOcTitle(e.target.value)}
                    placeholder="Título del objetivo de contribución..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Descripción / Propósito (Opcional)
                  </label>
                  <textarea
                    value={ocDescription}
                    onChange={(e) => setOcDescription(e.target.value)}
                    placeholder="Descripción del objetivo..."
                    rows={2}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                  />
                </div>

                {/* Selector de KPIs Operativos del Área */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Asignar Indicadores Operativos (KPIs de {normArea})
                  </label>

                  {areaDashboardsAndItems.length === 0 ? (
                    <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-lg text-xs text-slate-400 italic">
                      No hay KPIs disponibles o no asignados a otros OCs en los
                      tableros operativos de esta área.
                    </div>
                  ) : (
                    <div className="max-h-48 overflow-y-auto space-y-1.5 bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                      {areaDashboardsAndItems.map(
                        ({ dashboard, item, candidate }) => {
                          const key = `${dashboard.id}_${item.id}`;
                          const isSelected = selectedKpisForOC.includes(key);

                          return (
                            <label
                              key={key}
                              className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors text-xs ${
                                isSelected
                                  ? "bg-emerald-500/10 border border-emerald-500/30 text-white"
                                  : "hover:bg-slate-800/60 text-slate-300 border border-transparent"
                              }`}
                            >
                              <div className="flex items-center gap-2.5 truncate">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() =>
                                    toggleKpiSelection(dashboard.id, item.id)
                                  }
                                  className="rounded border-slate-700 text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5 bg-slate-800"
                                />
                                <div className="truncate">
                                  <div className="font-semibold truncate">
                                    {item.indicator}
                                  </div>
                                  <div className="text-[10px] text-slate-500 truncate">
                                    {dashboard.title} · {item.type} (
                                    {item.unit || "-"})
                                  </div>
                                </div>
                              </div>
                            </label>
                          );
                        },
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Botones de acción del formulario */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={cancelForm}
                  disabled={loading}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-950/40 transition-colors"
                >
                  {loading ? (
                    <span>Guardando...</span>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>
                        {editingOCId ? "Actualizar Objetivo" : "Guardar Objetivo"}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Modal de Confirmación de Eliminación */}
          {pendingDeleteOC && (
            <div className="p-4 bg-red-950/40 border border-red-500/40 rounded-xl space-y-3">
              <div className="flex items-center gap-2 text-red-400 text-xs font-bold">
                <AlertTriangle className="w-4 h-4" />
                <span>
                  ¿Confirmas la eliminación del Objetivo de Contribución{" "}
                  {pendingDeleteOC.displayCode}?
                </span>
              </div>
              <p className="text-xs text-slate-300">
                {pendingDeleteOC.title}
              </p>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPendingDeleteOC(null)}
                  disabled={loading}
                  className="px-3 py-1 text-xs font-bold bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleDeleteOC}
                  disabled={loading}
                  className="px-3 py-1 text-xs font-bold bg-red-600 text-white rounded-lg hover:bg-red-500"
                >
                  {loading ? "Eliminando..." : "Eliminar Definitivamente"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 text-xs font-bold transition-all"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
