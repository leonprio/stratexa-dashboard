import React, { useState, useMemo } from 'react';
import { X, Plus, Trash2, Edit2, ShieldAlert, Check, RefreshCw, Layers, Link as LinkIcon, Compass, Sliders } from 'lucide-react';
import {
  StrategicPerspective,
  StrategicObjective,
  AreaStrategyConfig,
  ContributionObjective,
  ContributionIndicatorAssignment,
  DEFAULT_PERSPECTIVES,
  deriveAreaCodeSuggestion,
  validateAreaCodeUniqueness,
  resolveAreaStrategyConfig
} from '../../strategyTypes';
import { Dashboard as DashboardType, User, GlobalUserRole } from '../../types';
import { strategyService } from '../../services/strategyService';

export interface StrategyConfigModalProps {
  perspectives: StrategicPerspective[];
  objectives: StrategicObjective[];
  areaConfigs: AreaStrategyConfig[];
  contributionObjectives: ContributionObjective[];
  assignments: ContributionIndicatorAssignment[];
  dashboards: DashboardType[];
  selectedClientId: string;
  currentUser?: User;
  onClose: () => void;
  onRefreshData: () => Promise<void>;
}

type ConfigSection = 'perspectives' | 'objectives' | 'areaCodes' | 'contributionObjectives';

export const StrategyConfigModal: React.FC<StrategyConfigModalProps> = ({
  perspectives = DEFAULT_PERSPECTIVES,
  objectives,
  areaConfigs,
  contributionObjectives,
  assignments,
  dashboards,
  selectedClientId,
  currentUser,
  onClose,
  onRefreshData,
}) => {
  const isAdmin = currentUser?.globalRole === GlobalUserRole.Admin;
  const [activeSection, setActiveSection] = useState<ConfigSection>('objectives');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form State: Perspectivas Configurables (4 Slots)
  const [editablePerspectives, setEditablePerspectives] = useState<StrategicPerspective[]>(() => {
    if (perspectives.length > 0) return perspectives;
    return DEFAULT_PERSPECTIVES;
  });

  // Form State: Objetivos Estratégicos (OE)
  const [oePerspectiveId, setOePerspectiveId] = useState<string>(perspectives[0]?.id || 'FINANCIERA');
  const [oeCode, setOeCode] = useState<string>('');
  const [oeTitle, setOeTitle] = useState<string>('');
  const [oeDescription, setOeDescription] = useState<string>('');

  // Form State: Área y Códigos Estables
  const [selectedAreaForConfig, setSelectedAreaForConfig] = useState<string>('');
  const [customAreaCode, setCustomAreaCode] = useState<string>('');

  // Relink explicit state
  const [relinkTargetConfigId, setRelinkTargetConfigId] = useState<string>('');

  // Form State: Objetivos de Contribución (OC)
  const [ocAreaName, setOcAreaName] = useState<string>('');
  const [ocPrimaryOEId, setOcPrimaryOEId] = useState<string>('');
  const [ocTitle, setOcTitle] = useState<string>('');
  const [ocDescription, setOcDescription] = useState<string>('');
  const [selectedKpisForOC, setSelectedKpisForOC] = useState<string[]>([]); // array of "dashboardId_itemId"

  // Extraer todas las áreas organizacionales activas de los tableros
  const availableAreas = useMemo(() => {
    const set = new Set<string>();
    dashboards.forEach(d => {
      if (d.area && d.area.trim()) {
        set.add(d.area.trim().toUpperCase());
      }
    });
    return Array.from(set).sort();
  }, [dashboards]);

  // Inicialización de área seleccionada
  React.useEffect(() => {
    if (availableAreas.length > 0) {
      if (!selectedAreaForConfig) {
        setSelectedAreaForConfig(availableAreas[0]);
        const existing = resolveAreaStrategyConfig(availableAreas[0], areaConfigs);
        setCustomAreaCode(existing?.code || deriveAreaCodeSuggestion(availableAreas[0]));
      }
      if (!ocAreaName) {
        setOcAreaName(availableAreas[0]);
      }
    }
  }, [availableAreas, areaConfigs]);

  // Manejador al cambiar el área en tab de configuración de código de área
  const handleAreaSelectForConfigChange = (area: string) => {
    setSelectedAreaForConfig(area);
    const existing = resolveAreaStrategyConfig(area, areaConfigs);
    setCustomAreaCode(existing?.code || deriveAreaCodeSuggestion(area));
    setRelinkTargetConfigId('');
  };

  // Actualizar perspectiva en estado local
  const handlePerspectiveChange = (index: number, field: keyof StrategicPerspective, value: string) => {
    setEditablePerspectives(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  // Guardar los 4 Slots de Perspectivas
  const handleSavePerspectives = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    try {
      setLoading(true);
      setErrorMsg(null);

      await strategyService.saveAllPerspectives(editablePerspectives, selectedClientId);
      setSuccessMsg('Perspectivas estratégicas guardadas correctamente.');
      await onRefreshData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al guardar perspectivas.');
    } finally {
      setLoading(false);
    }
  };

  // Guardar Objetivo Estratégico (OE)
  const handleSaveOE = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    if (!oeTitle.trim()) {
      setErrorMsg('El título del Objetivo Estratégico es requerido.');
      return;
    }

    try {
      setLoading(true);
      setErrorMsg(null);

      const countInPerspective = objectives.filter(o => o.perspectiveId === oePerspectiveId).length;
      const generatedCode = oeCode.trim() || `OE-${String(countInPerspective + 1).padStart(2, '0')}`;

      await strategyService.saveStrategicObjective({
        perspectiveId: oePerspectiveId,
        code: generatedCode.toUpperCase(),
        title: oeTitle.trim(),
        description: oeDescription.trim(),
        order: countInPerspective + 1,
        clientId: selectedClientId
      });

      setOeCode('');
      setOeTitle('');
      setOeDescription('');
      setSuccessMsg('Objetivo Estratégico (OE) guardado correctamente.');
      await onRefreshData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al guardar Objetivo Estratégico.');
    } finally {
      setLoading(false);
    }
  };

  // Eliminar OE
  const handleDeleteOE = async (oeId: string) => {
    if (!isAdmin) return;
    if (!confirm('¿Eliminar este Objetivo Estratégico?')) return;

    try {
      setLoading(true);
      await strategyService.deleteStrategicObjective(oeId, selectedClientId);
      await onRefreshData();
      setSuccessMsg('Objetivo Estratégico eliminado.');
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Guardar Código de Área Estable / Relink Explicito
  const handleSaveAreaCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    if (!selectedAreaForConfig || !customAreaCode.trim()) {
      setErrorMsg('Selecciona un área y proporciona un código válido.');
      return;
    }

    try {
      setLoading(true);
      setErrorMsg(null);

      const existingConfig = relinkTargetConfigId
        ? areaConfigs.find(c => c.id === relinkTargetConfigId)
        : resolveAreaStrategyConfig(selectedAreaForConfig, areaConfigs);

      const targetIdToUse = relinkTargetConfigId || existingConfig?.id;
      const targetCodeToUse = relinkTargetConfigId && existingConfig
        ? existingConfig.code
        : customAreaCode.trim().toUpperCase();

      const savedConfig = await strategyService.saveAreaConfig(
        selectedAreaForConfig,
        targetCodeToUse,
        selectedClientId,
        targetIdToUse
      );

      setSuccessMsg(`Configuración de área para "${selectedAreaForConfig}" vinculada exitosamente con código "${savedConfig.code}".`);
      setRelinkTargetConfigId('');
      await onRefreshData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al guardar código de área.');
    } finally {
      setLoading(false);
    }
  };

  // Obtener KPIs disponibles para el área seleccionada en OC
  const areaDashboardsAndItems = useMemo(() => {
    if (!ocAreaName) return [];
    const normArea = ocAreaName.trim().toUpperCase();
    const areaCfg = resolveAreaStrategyConfig(normArea, areaConfigs);
    const result: { dashboard: DashboardType; item: any }[] = [];

    dashboards.forEach(d => {
      const dAreaNorm = (d.area || '').trim().toUpperCase();
      const isMatch = dAreaNorm === normArea || (areaCfg && (dAreaNorm === areaCfg.areaName.toUpperCase() || (areaCfg.aliases && areaCfg.aliases.some(a => a.toUpperCase() === dAreaNorm))));

      if (isMatch) {
        (d.items || []).forEach(it => {
          result.push({ dashboard: d, item: it });
        });
      }
    });

    return result;
  }, [dashboards, ocAreaName, areaConfigs]);

  // Toggle KPI selección
  const toggleKpiSelection = (dashId: number | string, itemId: number | string) => {
    const key = `${dashId}_${itemId}`;
    setSelectedKpisForOC(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  // Guardar Objetivo de Contribución (OC) y sus KPIs vinculados
  const handleSaveOC = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    if (!ocAreaName || !ocPrimaryOEId || !ocTitle.trim()) {
      setErrorMsg('Selecciona Área, Objetivo Estratégico Primario y proporciona un título.');
      return;
    }

    try {
      setLoading(true);
      setErrorMsg(null);

      const areaCfg = resolveAreaStrategyConfig(ocAreaName, areaConfigs);

      const savedOC = await strategyService.saveContributionObjective({
        areaName: ocAreaName,
        areaConfigId: areaCfg?.id,
        primaryStrategicObjectiveId: ocPrimaryOEId,
        title: ocTitle.trim(),
        description: ocDescription.trim(),
        clientId: selectedClientId
      });

      // Guardar asignación de KPIs seleccionados
      const kpiItems = selectedKpisForOC.map(key => {
        const [dId, iId] = key.split('_');
        return { dashboardId: dId, itemId: iId };
      });

      await strategyService.saveAssignmentsForOC(savedOC.id, kpiItems, selectedClientId);

      setOcTitle('');
      setOcDescription('');
      setSelectedKpisForOC([]);
      setSuccessMsg(`Objetivo de Contribución ${savedOC.displayCode} creado correctamente.`);
      await onRefreshData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al guardar Objetivo de Contribución.');
    } finally {
      setLoading(false);
    }
  };

  // Eliminar OC
  const handleDeleteOC = async (ocId: string) => {
    if (!isAdmin) return;
    if (!confirm('¿Eliminar este Objetivo de Contribución?')) return;

    try {
      setLoading(true);
      await strategyService.deleteContributionObjective(ocId, selectedClientId);
      await onRefreshData();
      setSuccessMsg('Objetivo de Contribución eliminado.');
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full text-center space-y-4">
          <ShieldAlert className="w-12 h-12 text-amber-500 mx-auto" />
          <h3 className="text-lg font-bold text-white">Acceso Restringido (RBAC)</h3>
          <p className="text-xs text-slate-400">
            La configuración de Perspectivas, Objetivos Estratégicos y Códigos de Área requiere permisos de Administrador.
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-bold"
          >
            Cerrar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="p-6 border-b border-slate-800 bg-slate-950 flex justify-between items-center">
          <div>
            <span className="text-[10px] font-bold tracking-widest text-emerald-400 uppercase">
              Configuración Estratégica (BSC / Matriz de Contribución)
            </span>
            <h2 className="text-xl font-black text-white">Gestión de Arquitectura Estratégica</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950 px-6 gap-2">
          <button
            onClick={() => { setActiveSection('perspectives'); setErrorMsg(null); setSuccessMsg(null); }}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeSection === 'perspectives'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-4 h-4" />
            Perspectivas BSC
          </button>

          <button
            onClick={() => { setActiveSection('objectives'); setErrorMsg(null); setSuccessMsg(null); }}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeSection === 'objectives'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Compass className="w-4 h-4" />
            Objetivos Estratégicos (OE)
          </button>

          <button
            onClick={() => { setActiveSection('areaCodes'); setErrorMsg(null); setSuccessMsg(null); }}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeSection === 'areaCodes'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            Códigos Estables de Área
          </button>

          <button
            onClick={() => { setActiveSection('contributionObjectives'); setErrorMsg(null); setSuccessMsg(null); }}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeSection === 'contributionObjectives'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <LinkIcon className="w-4 h-4" />
            Objetivos de Contribución (OC)
          </button>
        </div>

        {/* Status Messages */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold">
            {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
            {successMsg}
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">

          {/* SECTION 0: PERSPECTIVAS BSC (4 SLOTS CONFIGURABLES) */}
          {activeSection === 'perspectives' && (
            <form onSubmit={handleSavePerspectives} className="max-w-3xl mx-auto space-y-6">
              <div>
                <h3 className="text-base font-bold text-white">Configuración de Perspectivas Estratégicas (4 Slots BSC)</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Personaliza los nombres visibles y descripciones de las 4 perspectivas. Los IDs de slot internos no cambian, garantizando la integridad de los Objetivos Estratégicos.
                </p>
              </div>

              <div className="space-y-4">
                {editablePerspectives.map((p, idx) => (
                  <div key={p.id} className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: p.color || '#3B82F6' }} />
                        <span className="text-xs font-bold text-white uppercase tracking-wider">Slot {idx + 1} ({p.id})</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-semibold text-slate-400 block mb-1">Nombre Visible</label>
                        <input
                          type="text"
                          required
                          value={p.name}
                          onChange={e => handlePerspectiveChange(idx, 'name', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-slate-400 block mb-1">Descripción</label>
                        <input
                          type="text"
                          value={p.description || ''}
                          onChange={e => handlePerspectiveChange(idx, 'description', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white"
                          placeholder="Descripción breve..."
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50"
              >
                {loading ? 'Guardando...' : 'Guardar Configuración de Perspectivas'}
              </button>
            </form>
          )}

          {/* SECTION 1: OBJETIVOS ESTRATÉGICOS (OE) */}
          {activeSection === 'objectives' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* Form de creación de OE */}
              <div className="lg:col-span-1 bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Plus className="w-4 h-4 text-emerald-400" />
                  Nuevo Objetivo Estratégico
                </h3>

                <form onSubmit={handleSaveOE} className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">Perspectiva</label>
                    <select
                      value={oePerspectiveId}
                      onChange={e => setOePerspectiveId(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white"
                    >
                      {perspectives.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">Código (Ej. OE-01)</label>
                    <input
                      type="text"
                      placeholder="Autogenerado si se deja en blanco"
                      value={oeCode}
                      onChange={e => setOeCode(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">Título del OE</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. Maximizar rentabilidad operativa"
                      value={oeTitle}
                      onChange={e => setOeTitle(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">Descripción (Opcional)</label>
                    <textarea
                      rows={3}
                      placeholder="Detalles del objetivo..."
                      value={oeDescription}
                      onChange={e => setOeDescription(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                  >
                    {loading ? 'Guardando...' : 'Crear Objetivo Estratégico'}
                  </button>
                </form>
              </div>

              {/* Lista de OEs registrados por perspectiva */}
              <div className="lg:col-span-2 space-y-4">
                <h3 className="text-sm font-bold text-white">Objetivos Estratégicos Configurados ({objectives.length})</h3>

                {perspectives.map(p => {
                  const pObjectives = objectives.filter(o => o.perspectiveId === p.id);
                  return (
                    <div key={p.id} className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color || '#3B82F6' }} />
                        <h4 className="text-xs font-bold text-white uppercase tracking-wider">{p.name}</h4>
                        <span className="text-[10px] text-slate-500">({pObjectives.length})</span>
                      </div>

                      {pObjectives.length === 0 ? (
                        <p className="text-xs text-slate-500 italic">No hay objetivos en esta perspectiva.</p>
                      ) : (
                        <div className="space-y-2">
                          {pObjectives.map(obj => (
                            <div
                              key={obj.id}
                              className="p-3 bg-slate-900 border border-slate-800 rounded-lg flex items-center justify-between gap-3"
                            >
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded">
                                    {obj.code}
                                  </span>
                                  <h5 className="text-xs font-bold text-white">{obj.title}</h5>
                                </div>
                                {obj.description && (
                                  <p className="text-[11px] text-slate-400 mt-1">{obj.description}</p>
                                )}
                              </div>

                              <button
                                onClick={() => handleDeleteOE(obj.id)}
                                className="text-slate-500 hover:text-red-400 p-1.5 rounded transition-colors shrink-0"
                                title="Eliminar OE"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

            </div>
          )}

          {/* SECTION 2: CÓDIGOS ESTABLES DE ÁREA Y VINCULACIÓN / RELINK EXPLÍCITO */}
          {activeSection === 'areaCodes' && (
            <div className="max-w-2xl mx-auto bg-slate-950 p-6 rounded-xl border border-slate-800 space-y-6">
              <div>
                <h3 className="text-base font-bold text-white">Configuración y Vincular Área (Auto-ID Nativo & Alias)</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Los códigos de área (ej. <code>COM</code>, <code>OPE</code>) identifican de forma estable los Objetivos de Contribución. Si el área organizacional cambia de nombre (ej. a <i>COMERCIAL Y VENTAS</i>), puedes vincularla explícitamente a un área existente sin duplicar registros ni perder la historia.
                </p>
              </div>

              <form onSubmit={handleSaveAreaCode} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Área Organizacional de Tablero</label>
                  <select
                    value={selectedAreaForConfig}
                    onChange={e => handleAreaSelectForConfigChange(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white"
                  >
                    {availableAreas.map(a => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                </div>

                {/* Opción para relink explícito con un área existente */}
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg space-y-2">
                  <label className="text-xs font-semibold text-slate-300 block">
                    Vincular / Relacionar con Área Estratégica Existente (Opcional)
                  </label>
                  <select
                    value={relinkTargetConfigId}
                    onChange={e => {
                      setRelinkTargetConfigId(e.target.value);
                      if (e.target.value) {
                        const targetCfg = areaConfigs.find(c => c.id === e.target.value);
                        if (targetCfg) setCustomAreaCode(targetCfg.code);
                      }
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white"
                  >
                    <option value="">-- Crear nueva entidad estratégica o usar actual --</option>
                    {areaConfigs.map(c => (
                      <option key={c.id} value={c.id}>
                        Vincular a: {c.areaName} (Código: {c.code})
                      </option>
                    ))}
                  </select>
                  {relinkTargetConfigId && (
                    <p className="text-[10px] text-emerald-400 font-semibold">
                      ✓ El área "{selectedAreaForConfig}" compartirá la misma entidad relacional, código e historial de OCs.
                    </p>
                  )}
                </div>

                {!relinkTargetConfigId && (
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      Código de Estrategia Estable (3-4 Letras)
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      placeholder="Ej. COM"
                      value={customAreaCode}
                      onChange={e => setCustomAreaCode(e.target.value.toUpperCase())}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white uppercase tracking-widest font-mono"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                      Sugerencia para {selectedAreaForConfig}: <code>{deriveAreaCodeSuggestion(selectedAreaForConfig)}</code>
                    </p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                >
                  {loading ? 'Guardando...' : relinkTargetConfigId ? 'Confirmar Vinculación Explícita' : 'Guardar Código Estable de Área'}
                </button>
              </form>

              {/* Resumen de códigos y aliases configurados */}
              <div className="pt-4 border-t border-slate-800 space-y-3">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Entidades Estratégicas Registradas</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {availableAreas.map(area => {
                    const cfg = resolveAreaStrategyConfig(area, areaConfigs);
                    const resolvedCode = cfg?.code || deriveAreaCodeSuggestion(area);
                    const isConfigured = !!cfg;

                    return (
                      <div key={area} className="p-3 bg-slate-900 rounded-lg border border-slate-800 flex items-center justify-between">
                        <div>
                          <div className="text-xs font-bold text-white">{area}</div>
                          <div className="text-[10px] text-slate-500">
                            {isConfigured ? (
                              <span>Configurado ({cfg.areaName}{cfg.aliases?.length ? `, Aliases: ${cfg.aliases.join(', ')}` : ''})</span>
                            ) : 'Sugerencia inicial'}
                          </div>
                        </div>
                        <span className="px-2.5 py-1 text-xs font-mono font-black bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded">
                          {resolvedCode}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* SECTION 3: OBJETIVOS DE CONTRIBUCIÓN (OC) */}
          {activeSection === 'contributionObjectives' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* Form para crear OC */}
              <div className="lg:col-span-1 bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Plus className="w-4 h-4 text-emerald-400" />
                  Nuevo Objetivo de Contribución
                </h3>

                <form onSubmit={handleSaveOC} className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">Área Propietaria</label>
                    <select
                      value={ocAreaName}
                      onChange={e => setOcAreaName(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white"
                    >
                      {availableAreas.map(a => (
                        <option key={a} value={a}>{a}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">OE Primario al que Contribuye</label>
                    <select
                      value={ocPrimaryOEId}
                      onChange={e => setOcPrimaryOEId(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white"
                    >
                      <option value="">-- Seleccionar Objetivo Estratégico --</option>
                      {objectives.map(oe => (
                        <option key={oe.id} value={oe.id}>[{oe.code}] {oe.title}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">Título del OC</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. Optimizar tiempos de atención al cliente"
                      value={ocTitle}
                      onChange={e => setOcTitle(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">Descripción (Opcional)</label>
                    <textarea
                      rows={2}
                      placeholder="Alineación operativa..."
                      value={ocDescription}
                      onChange={e => setOcDescription(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white"
                    />
                  </div>

                  {/* Selección de KPIs existentes de esa Área */}
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      Vincular KPIs Operativos del Área ({areaDashboardsAndItems.length} disponibles)
                    </label>

                    {areaDashboardsAndItems.length === 0 ? (
                      <p className="text-xs text-slate-500 italic">No hay KPIs registrados en el área {ocAreaName}.</p>
                    ) : (
                      <div className="max-h-40 overflow-y-auto space-y-1 p-2 bg-slate-900 rounded-lg border border-slate-800">
                        {areaDashboardsAndItems.map(({ dashboard, item }) => {
                          const key = `${dashboard.id}_${item.id}`;
                          const isChecked = selectedKpisForOC.includes(key);

                          return (
                            <label
                              key={key}
                              className="flex items-center gap-2 p-1.5 hover:bg-slate-800/60 rounded cursor-pointer text-xs text-slate-300"
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleKpiSelection(dashboard.id, item.id)}
                                className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500"
                              />
                              <span className="truncate">
                                <strong>[{dashboard.title}]</strong> {item.indicator}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !ocPrimaryOEId}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                  >
                    {loading ? 'Guardando...' : 'Crear Objetivo de Contribución (Atómico)'}
                  </button>
                </form>
              </div>

              {/* Lista de OCs creados */}
              <div className="lg:col-span-2 space-y-4">
                <h3 className="text-sm font-bold text-white">Objetivos de Contribución Configurados ({contributionObjectives.length})</h3>

                {contributionObjectives.length === 0 ? (
                  <div className="p-8 text-center bg-slate-950 rounded-xl border border-slate-800 text-slate-500 text-xs">
                    No hay Objetivos de Contribución creados.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {contributionObjectives.map(oc => {
                      const linkedOE = objectives.find(o => o.id === oc.primaryStrategicObjectiveId);
                      const ocAssignments = assignments.filter(a => a.contributionObjectiveId === oc.id);

                      return (
                        <div
                          key={oc.id}
                          className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex items-start justify-between gap-4"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="px-2.5 py-0.5 text-xs font-mono font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded">
                                {oc.displayCode}
                              </span>
                              <span className="px-2 py-0.5 text-[10px] font-semibold bg-slate-800 text-slate-300 rounded">
                                {oc.areaName}
                              </span>
                              {linkedOE && (
                                <span className="text-[10px] text-emerald-400 font-semibold">
                                  → {linkedOE.code}: {linkedOE.title}
                                </span>
                              )}
                            </div>
                            <h4 className="text-sm font-bold text-white">{oc.title}</h4>
                            {oc.description && (
                              <p className="text-xs text-slate-400">{oc.description}</p>
                            )}
                            <div className="text-[11px] text-slate-500 flex items-center gap-2 pt-1">
                              <span>KPIs vinculados: <strong>{ocAssignments.length}</strong></span>
                            </div>
                          </div>

                          <button
                            onClick={() => handleDeleteOC(oc.id)}
                            className="text-slate-500 hover:text-red-400 p-2 rounded transition-colors shrink-0"
                            title="Eliminar OC"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 text-xs font-bold transition-all"
          >
            Cerrar Configuración
          </button>
        </div>

      </div>
    </div>
  );
};
