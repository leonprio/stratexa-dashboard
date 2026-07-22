import React, { useState, useEffect, useMemo } from 'react';
import { Dashboard as DashboardType, SystemSettings, User } from '../types';
import { firebaseService } from '../services/firebaseService';
import { exportBulkDataToCSV } from '../utils/exportUtils';
import {
  exportToRecoveryExcelJS,
  localCheckpointManager,
  generateBaselineManifest,
  generateChecksum
} from '../utils/enterpriseRecoveryUtils';
import { exportToExecutiveExcelJS } from '../utils/ExecutiveOperationalExport';

export interface ClientSettingsProps {
  dashboards: DashboardType[];
  selectedClientId: string;
  selectedYear: number;
  setActiveAdminSection: (section: string) => void;
  handleFixOrder: () => Promise<void>;
  handleDownloadBackup: () => void;
  settings?: SystemSettings;
  handleUpdateSystemSettings: (updates: Partial<SystemSettings>) => Promise<void>;
  setLoadingDashboards: (loading: boolean) => void;
  allRawDashboards: DashboardType[];
  currentUser?: User;
}

type ConfigTab = 'exports' | 'imports' | 'recovery' | 'maintenance' | 'nuclear';

/**
 * Componente ClientSettings Rediseñado.
 * Capa Enterprise v9.4.1-STABLE-QA-HARDENING.
 * Diseño sobrio e institucional, sin animaciones ni efectos distractores, alto contraste.
 */
export const ClientSettings: React.FC<ClientSettingsProps> = React.memo(({
  dashboards,
  selectedClientId,
  selectedYear,
  setActiveAdminSection,
  handleFixOrder,
  handleDownloadBackup,
  settings,
  handleUpdateSystemSettings,
  setLoadingDashboards,
  allRawDashboards,
  currentUser,
}) => {
  const [activeTab, setActiveTab] = useState<ConfigTab>('exports');
  
  // Checkpoint manual states
  const [chkReason, setChkReason] = useState('');
  const [checkpoints, setCheckpoints] = useState<any[]>([]);

  // Nuclear Zone typing confirm states
  const [confirmAvancesText, setConfirmAvancesText] = useState('');
  const [confirmMetasText, setConfirmMetasText] = useState('');
  const [confirmNuclearText, setConfirmNuclearText] = useState('');

  // Dashboard individual seleccionado para exportación diferencial
  const [selectedIndividualDashId, setSelectedIndividualDashId] = useState<string>('');

  // Cargar checkpoints locales
  const loadLocalCheckpoints = () => {
    const list = localCheckpointManager.list(selectedClientId, selectedYear);
    setCheckpoints(list);
  };

  useEffect(() => {
    loadLocalCheckpoints();
  }, [selectedClientId, selectedYear]);

  // Lista de tableros reales editables para el selector diferencial
  const realDashboards = useMemo(() => {
    return dashboards.filter(d => !String(d.id).startsWith('agg-') && d.id !== -1);
  }, [dashboards]);

  useEffect(() => {
    if (realDashboards.length > 0 && !selectedIndividualDashId) {
      setSelectedIndividualDashId(String(realDashboards[0].id));
    }
  }, [realDashboards, selectedIndividualDashId]);

  // Generar y descargar el Excel XLSX Binario Real
  const handleExportRecoveryExcelJS = async (scope: 'consolidado' | 'direccion' | 'area' | 'individual') => {
    let targetDashboards = realDashboards;

    if (scope === 'direccion') {
      const userDir = currentUser?.group || '';
      targetDashboards = realDashboards.filter(
        d => (d.group || '').trim().toUpperCase() === userDir.trim().toUpperCase()
      );
    } else if (scope === 'area') {
      const userArea = currentUser?.area || '';
      targetDashboards = realDashboards.filter(
        d => (d.area || '').trim().toUpperCase() === userArea.trim().toUpperCase()
      );
    } else if (scope === 'individual') {
      targetDashboards = realDashboards.filter(
        d => String(d.id) === String(selectedIndividualDashId)
      );
    }

    if (targetDashboards.length === 0) {
      alert("No se encontraron tableros válidos que coincidan con la sección seleccionada.");
      return;
    }

    try {
      setLoadingDashboards(true);
      const buffer = await exportToRecoveryExcelJS(
        targetDashboards,
        selectedClientId,
        selectedYear,
        "v9.4.1-STABLE-QA-HARDENING"
      );

      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `recovery_${scope}_${selectedClientId}_${selectedYear}_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert("❌ Error al generar archivo XLSX binario: " + err.message);
    } finally {
      setLoadingDashboards(false);
    }
  };

  // Descargar el baseline_manifest.json
  const handleDownloadManifest = () => {
    try {
      const manifestContent = generateBaselineManifest(
        realDashboards,
        selectedClientId,
        selectedYear,
        "v9.4.1-STABLE-QA-HARDENING"
      );
      const blob = new Blob([manifestContent], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `baseline_manifest_${selectedClientId}_${selectedYear}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert("❌ Error al generar el manifiesto: " + err.message);
    }
  };

  // Exportar el reporte operativo ejecutivo (human-friendly)
  const handleExportExecutiveExcelJS = async () => {
    try {
      setLoadingDashboards(true);
      const buffer = await exportToExecutiveExcelJS(
        allRawDashboards,
        currentUser || null,
        selectedClientId,
        selectedYear
      );

      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `reporte_ejecutivo_${selectedClientId}_${selectedYear}_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert("❌ Error al generar el reporte operativo ejecutivo: " + err.message);
    } finally {
      setLoadingDashboards(false);
    }
  };

  // Crear checkpoint manual
  const handleCreateManualCheckpoint = () => {
    if (!chkReason.trim()) {
      alert("Por favor ingresa una descripción para el checkpoint.");
      return;
    }
    localCheckpointManager.create(
      selectedClientId,
      selectedYear,
      realDashboards,
      `MANUAL: ${chkReason}`
    );
    setChkReason('');
    loadLocalCheckpoints();
    alert("✅ Checkpoint creado de forma local.");
  };

  // Restaurar checkpoint local
  const handleRestoreCheckpoint = async (id: string) => {
    const chk = localCheckpointManager.get(selectedClientId, selectedYear, id);
    if (!chk) return;

    if (confirm(`¿Restaurar checkpoint del ${new Date(chk.timestamp).toLocaleString()}? \n\nMotivo: ${chk.reason}\n\n⚠️ Sobrescribirá temporalmente los datos locales en Firestore previo a recargar.`)) {
      setLoadingDashboards(true);
      try {
        // Guardar checkpoint preventivo PRE-RESTORE de seguridad
        localCheckpointManager.create(
          selectedClientId,
          selectedYear,
          realDashboards,
          `AUTO_PRE_RESTORE_${id}`
        );

        for (const dash of chk.dashboards) {
          await firebaseService.updateDashboardItems(dash.id, dash.items, true);
        }
        alert("✅ Datos restaurados con éxito. Recargando pantalla...");
        window.location.reload();
      } catch (err: any) {
        alert("❌ Error en restauración: " + err.message);
      } finally {
        setLoadingDashboards(false);
      }
    }
  };

  // Eliminar checkpoint local de la lista
  const handleDeleteCheckpoint = (id: string) => {
    if (confirm("¿Eliminar este checkpoint de la base local?")) {
      localCheckpointManager.delete(selectedClientId, selectedYear, id);
      loadLocalCheckpoints();
    }
  };

  // Generar checkpoint de seguridad atómico antes de una acción nuclear
  const capturePreNuclearCheckpoint = (actionName: string) => {
    localCheckpointManager.create(
      selectedClientId,
      selectedYear,
      realDashboards,
      `AUTO_PRE_NUCLEAR_${actionName.toUpperCase()}`
    );
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/95 flex justify-center items-start p-4 overflow-y-auto" onClick={() => setActiveAdminSection("none")}>
      {/* Contenedor ultra sobrio institucional de alto contraste */}
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-4xl p-6 shadow-2xl my-6 text-slate-100 font-mono" onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div className="text-left mb-6 pb-4 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold uppercase tracking-tight text-white">Configuración del Sistema</h2>
            <p className="text-slate-400 text-xs mt-1 uppercase font-mono tracking-widest">
              CLIENTE: <span className="text-white font-bold">{selectedClientId}</span> •
              AÑO: <span className="text-white font-bold">{selectedYear}</span> •
              VERS: <span className="text-white font-bold">v9.4.1-STABLE-QA-HARDENING</span>
            </p>
          </div>
          <button
            onClick={() => setActiveAdminSection("none")}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold uppercase rounded-lg transition-all"
          >
            Cerrar Panel
          </button>
        </div>

        {/* Navigation Tabs (EXPORTS, IMPORTS, RECOVERY, MAINTENANCE, NUCLEAR) */}
        <div className="flex bg-slate-950 border border-slate-800 p-1 rounded-xl mb-6 overflow-x-auto whitespace-nowrap">
          {(['exports', 'imports', 'recovery', 'maintenance', 'nuclear'] as ConfigTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2.5 px-4 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                activeTab === tab
                  ? 'bg-white text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {tab === 'exports' && '📥 Exports'}
              {tab === 'imports' && '📤 Imports'}
              {tab === 'recovery' && '💾 Recovery'}
              {tab === 'maintenance' && '🔧 Maint'}
              {tab === 'nuclear' && '⚠️ Nuclear'}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="space-y-5 min-h-[300px]">
          
          {/* TAB 1: EXPORTS */}
          {activeTab === 'exports' && (
            <div className="space-y-5">
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-5">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-2 font-mono">
                  📥 Exportación Diferencial Recovery-Ready (XLSX Binario)
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed mb-4">
                  Descarga un libro de Excel XLSX real estructurado en 3 hojas (METADATA, STRUCTURE, KPI_DATA).
                  Contiene metadatos, firmas de autenticidad e IDs inmutables requeridos para la recuperación humana controlada.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                  
                  {/* Exportar Consolidado */}
                  <div className="p-4 bg-slate-900 border border-slate-800 rounded-lg flex flex-col justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-white uppercase font-mono">1. Consolidado Global</h4>
                      <p className="text-[10px] text-slate-400 mt-1">Exporta todos los tableros del cliente en el periodo seleccionado.</p>
                    </div>
                    <button
                      onClick={() => handleExportRecoveryExcelJS('consolidado')}
                      className="mt-4 w-full py-2 bg-slate-800 hover:bg-slate-700 text-[10px] font-bold uppercase rounded-lg border border-slate-700 transition-all text-center"
                    >
                      Descargar Consolidado
                    </button>
                  </div>

                  {/* Exportar por Dirección */}
                  <div className="p-4 bg-slate-900 border border-slate-800 rounded-lg flex flex-col justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-white uppercase font-mono">2. Por Dirección (Grupo)</h4>
                      <p className="text-[10px] text-slate-400 mt-1">
                        Exporta solo tableros asignados a la Dirección: <span className="text-emerald-400 font-bold">{currentUser?.group || "GENERAL"}</span>.
                      </p>
                    </div>
                    <button
                      onClick={() => handleExportRecoveryExcelJS('direccion')}
                      className="mt-4 w-full py-2 bg-slate-800 hover:bg-slate-700 text-[10px] font-bold uppercase rounded-lg border border-slate-700 transition-all transition-all text-center"
                    >
                      Descargar por Dirección
                    </button>
                  </div>

                  {/* Exportar por Área */}
                  <div className="p-4 bg-slate-900 border border-slate-800 rounded-lg flex flex-col justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-white uppercase font-mono">3. Por Área Operativa</h4>
                      <p className="text-[10px] text-slate-400 mt-1">
                        Exporta solo tableros de tu Área: <span className="text-emerald-400 font-bold">{currentUser?.area || "GENERAL"}</span>.
                      </p>
                    </div>
                    <button
                      onClick={() => handleExportRecoveryExcelJS('area')}
                      className="mt-4 w-full py-2 bg-slate-800 hover:bg-slate-700 text-[10px] font-bold uppercase rounded-lg border border-slate-700 transition-all transition-all text-center"
                    >
                      Descargar por Área
                    </button>
                  </div>

                  {/* Exportar Dashboard Individual */}
                  <div className="p-4 bg-slate-900 border border-slate-800 rounded-lg flex flex-col justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-white uppercase font-mono">4. Dashboard Individual</h4>
                      <p className="text-[10px] text-slate-400 mt-1">Exporta quirúrgicamente un único dashboard seleccionado por ID inmutable.</p>
                      
                      <select
                        value={selectedIndividualDashId}
                        onChange={(e) => setSelectedIndividualDashId(e.target.value)}
                        className="mt-2 w-full bg-slate-950 border border-slate-850 rounded-lg px-2 py-1.5 text-[10px] text-white outline-none"
                      >
                        {realDashboards.map((d) => (
                          <option key={d.id} value={d.id}>
                            [{d.id}] {d.title}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={() => handleExportRecoveryExcelJS('individual')}
                      disabled={!selectedIndividualDashId}
                      className="mt-4 w-full py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-[10px] font-bold uppercase rounded-lg border border-slate-700 transition-all text-center"
                    >
                      Descargar Dashboard
                    </button>
                  </div>

                </div>

                {/* Manifiesto y Json general */}
                <div className="mt-5 pt-4 border-t border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-3 bg-slate-900 border border-slate-850 rounded-lg flex items-center justify-between">
                    <div>
                      <h4 className="text-[11px] font-bold text-white font-mono uppercase">Descargar Manifiesto Forense</h4>
                      <p className="text-[9px] text-slate-500 mt-0.5">Archivo baseline_manifest.json global.</p>
                    </div>
                    <button
                      onClick={handleDownloadManifest}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-300 text-[9px] font-bold uppercase rounded-lg border border-slate-700 transition-all"
                    >
                      Descargar JSON
                    </button>
                  </div>

                  <div className="p-3 bg-slate-900 border border-slate-850 rounded-lg flex items-center justify-between">
                    <div>
                      <h4 className="text-[11px] font-bold text-white font-mono uppercase">Copia de Seguridad JSON</h4>
                      <p className="text-[9px] text-slate-500 mt-0.5">Archivo completo estructurado portable.</p>
                    </div>
                    <button
                      onClick={handleDownloadBackup}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-300 text-[9px] font-bold uppercase rounded-lg border border-slate-700 transition-all"
                    >
                      Descargar Backup
                    </button>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* TAB 2: IMPORTS */}
          {activeTab === 'imports' && (
            <div className="space-y-5">
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-6 text-center py-12">
                <span className="text-3xl block mb-3">📤</span>
                <h3 className="text-sm font-bold text-white uppercase font-mono tracking-wider">Pipeline de Importación Controlada</h3>
                <p className="text-xs text-slate-400 max-w-lg mx-auto mt-2 leading-relaxed font-mono">
                  Acceso directo a la carga aislada (Sandbox) para ficheros XLSX binarios reales y JSON Baselines.
                  El pipeline procesará firmas, detectará diferencias detalladas y creará copias de seguridad automáticas previas a la persistencia.
                </p>

                <button
                  onClick={() => setActiveAdminSection("import")}
                  className="mt-6 px-6 py-2.5 bg-white hover:bg-slate-100 text-slate-950 font-bold rounded-lg text-xs uppercase tracking-wider transition-all"
                >
                  Abrir Pipeline de Importación
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: RECOVERY */}
          {activeTab === 'recovery' && (
            <div className="space-y-5">
              {/* Crear checkpoint manual */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-2 font-mono">💾 Crear Checkpoint de Recuperación Local</h3>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={chkReason}
                    onChange={(e) => setChkReason(e.target.value)}
                    placeholder="Descripción (ej. Antes de reordenar UNE Toluca)"
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-slate-500 transition-all font-mono"
                  />
                  <button
                    onClick={handleCreateManualCheckpoint}
                    className="px-4 py-2 bg-slate-850 hover:bg-slate-800 text-white font-bold rounded-lg text-xs uppercase tracking-wider transition-all"
                  >
                    Guardar
                  </button>
                </div>
              </div>

              {/* Lista de checkpoints locales */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">🔄 Snapshots de Recuperación Local ({checkpoints.length})</h3>
                
                {checkpoints.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-4 font-mono">No se encontraron checkpoints locales en este navegador.</p>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {checkpoints.map((chk) => (
                      <div key={chk.id} className="bg-slate-900 border border-slate-850 rounded-lg p-3 flex items-center justify-between gap-4 font-mono">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] text-slate-400 font-bold">{chk.id}</span>
                            <span className="text-[9px] text-slate-500">•</span>
                            <span className="text-[9px] text-slate-400">{new Date(chk.timestamp).toLocaleString()}</span>
                          </div>
                          <h4 className="text-xs font-bold text-white mt-0.5 uppercase tracking-tight">{chk.reason}</h4>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={() => handleRestoreCheckpoint(chk.id)}
                            className="px-2.5 py-1 bg-emerald-950/20 hover:bg-emerald-900/30 text-emerald-400 border border-emerald-900/30 rounded-lg text-[9px] font-bold uppercase transition-all"
                          >
                            Restaurar
                          </button>
                          <button
                            onClick={() => handleDeleteCheckpoint(chk.id)}
                            className="px-2.5 py-1 bg-rose-950/20 hover:bg-rose-900/30 text-rose-400 border border-rose-900/30 rounded-lg text-[9px] font-bold uppercase transition-all"
                          >
                            Eliminar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: MAINTENANCE */}
          {activeTab === 'maintenance' && (
            <div className="space-y-5">
              
              {/* Estructura y Orden */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                    📊 Tableros de Control {selectedClientId}/{selectedYear}
                  </h3>
                  <button
                    onClick={async () => {
                      await handleFixOrder();
                      alert("✅ Tableros renumerados correctamente.");
                    }}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-lg text-[9px] font-bold text-white uppercase transition-all"
                  >
                    Renumerar Tableros
                  </button>
                </div>

                <div className="grid grid-cols-7 gap-2 font-mono">
                  {(() => {
                    const isIPS = (selectedClientId || "").trim().toUpperCase() === "IPS";
                    const clientYearDashboards = dashboards.filter(d => !String(d.id).startsWith('agg-')).sort((a, b) => (Number((a).orderNumber) || 0) - (Number((b).orderNumber) || 0));

                    if (isIPS) {
                      const STANDARD_NAMES = ["METRO CENTRO", "METRO SUR", "METRO NORTE", "TOLUCA", "GTMI", "OCCIDENTE", "BAJIO", "SLP", "SUR", "GOLFO", "PENINSULA", "PACIFICO", "NOROESTE", "NORESTE"];
                      return STANDARD_NAMES.map((stdName, idx) => {
                        const dash = clientYearDashboards.find(d => (d).orderNumber === (idx + 1));
                        const exists = !!dash;
                        return (
                          <div key={idx} className={`p-2 rounded-lg text-center ${exists ? "bg-emerald-950/20 border border-emerald-900/30" : "bg-rose-950/20 border border-rose-900/30"}`}>
                            <div className={`text-xs font-bold ${exists ? "text-emerald-400" : "text-rose-400"}`}>{idx + 1}</div>
                            <div className="text-[8px] text-slate-400 uppercase truncate mt-0.5">{exists ? dash.title.split(" ")[0] : stdName.split(" ")[0]}</div>
                          </div>
                        );
                      });
                    }

                    return clientYearDashboards.map((dash, idx) => (
                      <div key={dash.id} className="p-2 rounded-lg text-center bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all">
                        <div className="text-xs font-bold text-white">{(dash).orderNumber || (idx + 1)}</div>
                        <div className="text-[8px] text-slate-400 uppercase truncate mt-0.5">{dash.title}</div>
                      </div>
                    ));
                  })()}
                </div>
              </div>

              {/* Terminología Personalizada */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-3 font-mono">🏷️ Terminología Personalizada</h3>
                <div className="grid grid-cols-2 gap-4 font-mono">
                  <div>
                    <label className="text-[9px] font-bold text-slate-500 block mb-1">Nombre de Agrupaciones</label>
                    <input
                      defaultValue={settings?.groupLabel}
                      onBlur={(e) => handleUpdateSystemSettings({ groupLabel: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white outline-none focus:border-slate-500 font-mono"
                      placeholder="Ej: Dirección"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-slate-500 block mb-1">Nombre de Tableros</label>
                    <input
                      defaultValue={settings?.dashboardLabel}
                      onBlur={(e) => handleUpdateSystemSettings({ dashboardLabel: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white outline-none focus:border-slate-500 font-mono"
                      placeholder="Ej: UNE"
                    />
                  </div>
                </div>
              </div>

              {/* Exportación Operativa Ejecutiva (Human-Friendly) */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 mt-5">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-2 font-mono text-cyan-400">
                  📥 Exportación Operativa Ejecutiva (Human-Friendly)
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed mb-4">
                  Descarga un reporte corporativo, limpio y listo para impresión o juntas de consejo directivo. 
                  Este libro de Excel XLSX está estilizado con semáforos ejecutivos y organizado en hojas legibles: Resumen Ejecutivo, Evaluación de KPIs, Alertas Operativas y Tendencia Histórica.
                </p>

                <div className="grid grid-cols-1 gap-4 mt-2">
                  <div className="p-4 bg-slate-900 border border-slate-850 rounded-lg flex flex-col justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-white uppercase font-mono">Reporte Corporativo Completo (XLSX)</h4>
                      <p className="text-[10px] text-slate-400 mt-1">
                        Genera el informe ejecutivo aplicando filtros de seguridad integrados. Los directores y responsables de área descargarán únicamente la información operativa dentro de su ámbito de competencia legal.
                      </p>
                    </div>
                    <button
                      onClick={handleExportExecutiveExcelJS}
                      className="mt-4 w-full py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold uppercase rounded-lg border border-cyan-700 transition-all text-center flex items-center justify-center gap-2"
                    >
                      <span>📊</span> Generar y Descargar Reporte Ejecutivo
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: NUCLEAR (ZONA DE MÁXIMO RIESGO) */}
          {activeTab === 'nuclear' && (
            <div className="space-y-5">
              
              <div className="bg-rose-950/20 border border-rose-900/40 rounded-xl p-5 relative overflow-hidden font-mono">
                <h3 className="text-xs font-bold text-rose-400 uppercase tracking-wider mb-2">
                  ☢️ Zona de Máximo Riesgo: Limpieza Nuclear
                </h3>
                <p className="text-[11px] text-slate-300 leading-relaxed mb-5">
                  Las acciones en esta sección son destructivas y de impacto inmediato.
                  Se exige una **doble confirmación y una validación exacta por texto**. Antes de cada ejecución se creará un checkpoint local de rollback automáticamente.
                </p>

                <div className="space-y-5">
                  
                  {/* Acción 1: Borrar Avances */}
                  <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-850 space-y-3">
                    <div>
                      <h4 className="text-[11px] font-bold text-rose-400 uppercase">🧹 Borrar Avances Operativos</h4>
                      <p className="text-[9px] text-slate-500 mt-0.5">Limpia el progreso capturado por los usuarios en el año actual (los indicadores y metas se preservan).</p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        value={confirmAvancesText}
                        onChange={(e) => setConfirmAvancesText(e.target.value)}
                        placeholder="Escribe 'BORRAR AVANCES' para habilitar"
                        className="flex-1 bg-slate-900 border border-slate-850 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-rose-500 font-mono"
                      />
                      <button
                        disabled={confirmAvancesText !== "BORRAR AVANCES"}
                        onClick={async () => {
                          if (confirm("⚠️ ¿Confirmar borrado completo de avances del año?")) {
                            setLoadingDashboards(true);
                            try {
                              capturePreNuclearCheckpoint("borrar_avances");
                              await firebaseService.resetDashboardDataOnly(selectedClientId, selectedYear);
                              alert("✅ Avances borrados con éxito.");
                              window.location.reload();
                            } catch (err: any) { alert("❌ Error: " + err.message); }
                            finally { setLoadingDashboards(false); }
                          }
                        }}
                        className="px-4 py-1.5 bg-rose-950 hover:bg-rose-900 disabled:opacity-20 disabled:cursor-not-allowed border border-rose-900/40 text-rose-300 font-bold rounded-lg text-[9px] uppercase transition-all"
                      >
                        Ejecutar Limpieza
                      </button>
                    </div>
                  </div>

                  {/* Acción 2: Borrar Metas */}
                  <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-850 space-y-3">
                    <div>
                      <h4 className="text-[11px] font-bold text-amber-400 uppercase">🎯 Borrar Objetivos / Metas</h4>
                      <p className="text-[9px] text-slate-500 mt-0.5">Limpia las metas planificadas a cero en todos los tableros del cliente en el año actual.</p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        value={confirmMetasText}
                        onChange={(e) => setConfirmMetasText(e.target.value)}
                        placeholder="Escribe 'BORRAR METAS' para habilitar"
                        className="flex-1 bg-slate-900 border border-slate-850 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-amber-500 font-mono"
                      />
                      <button
                        disabled={confirmMetasText !== "BORRAR METAS"}
                        onClick={async () => {
                          if (confirm("⚠️ ¿Confirmar borrado completo de metas planificadas del año?")) {
                            setLoadingDashboards(true);
                            try {
                              capturePreNuclearCheckpoint("borrar_metas");
                              await firebaseService.resetDashboardGoalsOnly(selectedClientId, selectedYear);
                              alert("✅ Metas borradas con éxito.");
                              window.location.reload();
                            } catch (err: any) { alert("❌ Error: " + err.message); }
                            finally { setLoadingDashboards(false); }
                          }
                        }}
                        className="px-4 py-1.5 bg-amber-950 hover:bg-amber-900 disabled:opacity-20 disabled:cursor-not-allowed border border-amber-900/40 text-amber-300 font-bold rounded-lg text-[9px] uppercase transition-all"
                      >
                        Ejecutar Limpieza
                      </button>
                    </div>
                  </div>

                  {/* Acción 3: Borrado Nuclear Total */}
                  <div className="bg-rose-950/40 p-4 rounded-xl border border-rose-900/30 space-y-3">
                    <div>
                      <h4 className="text-[11px] font-bold text-rose-500 uppercase">🚨 Borrado Estructural Nuclear</h4>
                      <p className="text-[9px] text-rose-400 font-bold">⚠️ ELIMINACIÓN TOTAL E IRREVERSIBLE: Elimina tableros, indicadores, metas e historial del cliente del periodo seleccionado.</p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        value={confirmNuclearText}
                        onChange={(e) => setConfirmNuclearText(e.target.value)}
                        placeholder="Escribe 'CONFIRMAR NUCLEAR' para habilitar"
                        className="flex-1 bg-slate-900 border border-slate-850 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-rose-500 font-mono"
                      />
                      <button
                        disabled={confirmNuclearText !== "CONFIRMAR NUCLEAR"}
                        onClick={async () => {
                          if (confirm("🚨 ¿CONFIRMAR ELIMINACIÓN GLOBAL IRREVERSIBLE DE ESTE PERIODO?")) {
                            setLoadingDashboards(true);
                            try {
                              capturePreNuclearCheckpoint("nuclear_total");
                              await firebaseService.deleteClientYearData(selectedClientId, selectedYear);
                              alert("✅ Estructura del cliente y año eliminada correctamente.");
                              window.location.reload();
                            } catch (err: any) { alert("❌ Error: " + err.message); }
                            finally { setLoadingDashboards(false); }
                          }
                        }}
                        className="px-4 py-1.5 bg-rose-700 hover:bg-rose-600 disabled:opacity-20 disabled:cursor-not-allowed text-white font-bold rounded-lg text-[9px] uppercase transition-all"
                      >
                        Ejecutar Nuclear
                      </button>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer Close Button */}
        <div className="mt-6 pt-4 border-t border-slate-800">
          <button
            onClick={() => setActiveAdminSection("none")}
            className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-xs font-bold uppercase rounded-lg border border-slate-700 transition-all text-center"
          >
            Cerrar Panel de Configuración
          </button>
        </div>
      </div>
    </div>
  );
});
ClientSettings.displayName = "ClientSettings";
