import React from 'react';
import { Dashboard as DashboardType, SystemSettings } from '../types';
import { firebaseService } from '../services/firebaseService';
import { exportBulkDataToCSV } from '../utils/exportUtils';

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
}

/**
 * Componente ClientSettings.
 * Modal de administración de configuraciones avanzadas del sistema y 
 * herramientas de gestión nuclear por cliente (creación, copia y borrado profundo).
 * Optimizado con React.memo.
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
}) => {
  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-xl flex justify-center items-start p-4 overflow-y-auto" onClick={() => setActiveAdminSection("none")}>
      <div className="bg-slate-900 border border-white/10 rounded-[2rem] w-full max-w-4xl p-8 shadow-3xl ring-1 ring-cyan-500/20 my-8" onClick={(e) => e.stopPropagation()}>
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-cyan-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-cyan-500/20">
            <span className="text-2xl">⚙️</span>
          </div>
          <h2 className="text-3xl font-black italic uppercase tracking-tighter mb-2 text-white">Configuración del Sistema</h2>
          <p className="text-slate-400 text-sm">
            Cliente: <span className="text-cyan-400 font-bold">{selectedClientId}</span> •
            Año: <span className="text-cyan-400 font-bold">{selectedYear}</span>
          </p>
        </div>

        <div className="space-y-6">
          {/* Vista de los Tableros Numerados - Cualquier cliente con tableros */}
          {(dashboards.length > 0 || selectedClientId.toUpperCase() === 'IPS') && (
            <div className="bg-slate-800/40 border border-white/5 rounded-2xl p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-[10px] font-black text-cyan-500 uppercase tracking-widest flex items-center gap-2">
                  <span>📊</span> Tableros para {selectedClientId}/{selectedYear}
                </h3>
                <button
                  onClick={async () => {
                    await handleFixOrder();
                    alert("✅ Tableros renumerados correctamente (1, 2, 3...)");
                  }}
                  className="px-3 py-1 bg-cyan-500/10 border border-cyan-500/30 rounded-lg text-[8px] font-black text-cyan-400 hover:bg-cyan-500 hover:text-white transition-all uppercase"
                >
                  Renumerar 1, 2, 3...
                </button>
              </div>

              <div className="grid grid-cols-7 gap-2">
                {(() => {
                  const isIPS = (selectedClientId || "").trim().toUpperCase() === "IPS";
                  const clientYearDashboards = dashboards.filter(d => !String(d.id).startsWith('agg-')).sort((a, b) => (Number((a).orderNumber) || 0) - (Number((b).orderNumber) || 0));

                  // Si es IPS, mostramos el grid de 14 tradicional
                  if (isIPS) {
                    const STANDARD_NAMES = ["METRO CENTRO", "METRO SUR", "METRO NORTE", "TOLUCA", "GTMI", "OCCIDENTE", "BAJIO", "SLP", "SUR", "GOLFO", "PENINSULA", "PACIFICO", "NOROESTE", "NORESTE"];
                    return STANDARD_NAMES.map((stdName, idx) => {
                      const dash = clientYearDashboards.find(d => (d).orderNumber === (idx + 1));
                      const exists = !!dash;
                      return (
                        <div key={idx} className={`p-2 rounded-lg text-center transition-all ${exists ? "bg-green-500/10 border border-green-500/20" : "bg-red-500/10 border border-red-500/20"}`}>
                          <div className={`text-lg font-black ${exists ? "text-green-400" : "text-red-400"}`}>{idx + 1}</div>
                          <div className="text-[8px] text-slate-400 uppercase truncate">{exists ? dash.title.split(" ")[0] : stdName.split(" ")[0]}</div>
                        </div>
                      );
                    });
                  }

                  // Si es cualquier otro cliente, mostramos cuadrícula dinámica de lo que realmente existe
                  return clientYearDashboards.map((dash, idx) => (
                    <div key={dash.id} className="p-2 rounded-lg text-center bg-cyan-500/10 border border-cyan-500/20 hover:border-cyan-500/50 transition-all">
                      <div className="text-lg font-black text-cyan-400">{(dash).orderNumber || (idx + 1)}</div>
                      <div className="text-[8px] text-slate-400 uppercase truncate">{dash.title}</div>
                    </div>
                  ));
                })()}
              </div>
              <p className="text-[9px] text-slate-500 mt-3 text-center">
                <span className="text-green-400">■</span> Existe • <span className="text-red-400">■</span> Falta •
                Total: {dashboards.filter(d => Number(d.id) > 0).length} tableros
              </p>
            </div>
          )}

          {/* Respaldo de Seguridad */}
          <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-2xl p-6">
            <h3 className="text-[10px] font-black text-cyan-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <span>💾</span> Respaldo de Seguridad (Garantía de Datos)
            </h3>
            <p className="text-xs text-slate-300 mb-4">Descarga una copia completa de todos los tableros, indicadores e información capturada para este cliente y año en formato JSON. Puedes usar este archivo como respaldo antes de realizar cambios masivos.</p>
            <button
              onClick={handleDownloadBackup}
              className="w-full py-3 bg-cyan-600/20 hover:bg-cyan-600/40 text-cyan-400 border border-cyan-500/30 font-black rounded-xl shadow-lg transition-all uppercase tracking-widest text-[10px] mb-3"
            >
              Descargar Respaldo Completo (.JSON)
            </button>
            <button
              onClick={() => exportBulkDataToCSV(dashboards.filter(d => !String(d.id).startsWith('agg-')), selectedClientId, selectedYear)}
              className="w-full py-3 bg-green-600 hover:bg-green-500 text-white font-black rounded-xl shadow-lg transition-all uppercase tracking-widest text-[10px]"
              title="Exporta un archivo CSV compatible con el Importador Avanzado para realizar ediciones masivas."
            >
              Exportar Datos Masivos (Excel / CSV)
            </button>
          </div>

          {/* Opciones de Restablecimiento - SOLO PARA IPS */}
          {(selectedClientId.toUpperCase() === 'IPS') && (
            <div className="bg-slate-800/40 border border-amber-500/20 rounded-2xl p-6">
              <h3 className="text-[10px] font-black text-amber-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <span>🔄</span> Restablecer Estructura Estándar IPS
              </h3>

              <div className="grid grid-cols-1 gap-4">
                <button
                  onClick={async () => {
                    const ok = confirm(`¿Restablecer SOLO los nombres de los tableros IPS?\n\nAño: ${selectedYear}\n\n✅ Esto corregirá los títulos a la estructura estándar.\n✅ MANTIENE todos los indicadores y datos intactos.`);
                    if (ok) {
                      try {
                        const result = await firebaseService.resetDashboardNamesOnly(selectedClientId, selectedYear);
                        alert(`✅ ${result.updatedCount} tableros actualizados.`);
                        window.location.reload();
                      } catch (err: any) {
                        alert(`❌ Error: ${err.message}`);
                      }
                    }
                  }}
                  className="p-4 bg-slate-950 border border-amber-500/30 rounded-xl text-left hover:border-amber-500 transition-all group"
                >
                  <div className="text-amber-400 font-black text-sm mb-1 group-hover:text-amber-300">
                    Corregir Solo Nombres
                  </div>
                  <p className="text-[10px] text-slate-400">Restablece los nombres a la estructura estándar IPS. Mantiene indicadores y datos.</p>
                </button>
              </div>
            </div>
          )}

          {/* 🛡️ LIMPIEZA NUCLEAR (v5.2.2) */}
          <div className="bg-red-950/20 border border-red-500/30 rounded-2xl p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 rotate-12 scale-150">☣️</div>
            <h3 className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <span>☢️</span> Zona de Riesgo: Limpieza Nuclear
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={async () => {
                  const ok = confirm(`⚠️ ⚛️ LIMPIEZA OPERATIVA (AVANCES)\n\n¿Seguro que deseas BORRAR TODOS LOS AVANCES de ${selectedClientId} para el año ${selectedYear}?\n\n- Los nombres, metas y pesos NO se tocan.\n- El ahorro/progreso de cada mes va a 0.\n\nEscribe 'ELIMINAR' para confirmar:`);
                  if (ok && prompt("Confirmación de seguridad:") === "ELIMINAR") {
                    setLoadingDashboards(true);
                    try {
                      await firebaseService.resetDashboardDataOnly(selectedClientId, selectedYear);
                      alert("✅ Datos operativos borrados. Reiniciando...");
                      window.location.reload();
                    } catch (err: any) { alert("❌ Error: " + err.message); }
                    finally { setLoadingDashboards(false); }
                  }
                }}
                className="p-4 bg-slate-950/80 border border-rose-500/40 rounded-xl text-left hover:border-rose-400 transition-all group"
              >
                <div className="text-rose-400 font-black text-xs mb-1 group-hover:text-rose-300 uppercase">Borrar Avances</div>
                <p className="text-[9px] text-slate-500">Limpia el progreso real del año.</p>
              </button>

              <button
                onClick={async () => {
                  const ok = confirm(`⚠️ ⚛️ LIMPIEZA DE METAS (PLANIFICACIÓN)\n\n¿Seguro que deseas BORRAR TODAS LAS METAS de ${selectedClientId} para el año ${selectedYear}?\n\n- Los indicadores y avances se mantienen.\n- Las metas de todos los meses irán a 0.\n\nEscribe 'METAS' para confirmar:`);
                  if (ok && prompt("Confirmación de seguridad:") === "METAS") {
                    setLoadingDashboards(true);
                    try {
                      await firebaseService.resetDashboardGoalsOnly(selectedClientId, selectedYear);
                      alert("✅ Metas borradas satisfactoriamente. Reiniciando...");
                      window.location.reload();
                    } catch (err: any) { alert("❌ Error: " + err.message); }
                    finally { setLoadingDashboards(false); }
                  }
                }}
                className="p-4 bg-slate-950/80 border border-amber-500/40 rounded-xl text-left hover:border-amber-400 transition-all group"
              >
                <div className="text-amber-400 font-black text-xs mb-1 group-hover:text-amber-300 uppercase">Borrar Metas</div>
                <p className="text-[9px] text-slate-500">Limpia objetivos mensuales y semanales.</p>
              </button>

              <button
                onClick={async () => {
                  const ok = confirm(`🚨 ⚛️ ELIMINACIÓN TOTAL (NUCLEAR)\n\n¿Seguro que deseas ELIMINAR COMPLETAMENTE todos los tableros de ${selectedClientId} para el año ${selectedYear}?\n\nSe borrará: ESTRUCTURA, METAS Y AVANCES.\n\nEscribe 'NUCLEAR' para confirmar:`);
                  if (ok && prompt("Confirmación de seguridad:") === "NUCLEAR") {
                    setLoadingDashboards(true);
                    try {
                      await firebaseService.deleteClientYearData(selectedClientId, selectedYear);
                      alert("✅ Estructura eliminada satisfactoriamente.");
                      window.location.reload();
                    } catch (err: any) { alert("❌ Error: " + err.message); }
                    finally { setLoadingDashboards(false); }
                  }
                }}
                className="p-4 bg-red-900/10 border border-red-500/50 rounded-xl text-left hover:bg-red-900/20 transition-all group md:col-span-full xl:col-span-1"
              >
                <div className="text-red-500 font-black text-xs mb-1 group-hover:text-red-400 uppercase">Borrado Nuclear Total</div>
                <p className="text-[9px] text-rose-400/70 font-bold">⚠️ Irreversible: Borra el año completo del cliente.</p>
              </button>
            </div>
          </div>

          {/* Generación de Nuevo Año */}
          <div className="bg-slate-800/40 border border-cyan-500/20 rounded-2xl p-6">
            <h3 className="text-[10px] font-black text-cyan-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <span>📅</span> Generar Nuevo Año
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Copiar desde año anterior */}
              <button
                onClick={async () => {
                  if (!selectedClientId || selectedClientId === 'all') {
                    alert("Selecciona un cliente específico primero.");
                    return;
                  }
                  const fromYear = selectedYear - 1;
                  const toYear = selectedYear;
                  const ok = confirm(`¿Generar ${toYear} copiando estructura de ${fromYear}?\n\nCliente: ${selectedClientId}\nOrigen: ${fromYear}\nDestino: ${toYear}\n\nSe copiarán los tableros con todos sus indicadores, pero con metas=0 y progreso=0.`);
                  if (ok) {
                    try {
                      const result = await firebaseService.generateYearForClient(selectedClientId, fromYear, toYear);
                      alert(`✅ ¡Año ${toYear} generado!\n\n• ${result.createdDashboards} tableros creados\n• ${result.indicatorsPerDashboard} indicadores por tablero\n• ${result.totalIndicators} indicadores totales\n• Todos con metas y progreso en 0`);
                      window.location.reload();
                    } catch (err: any) {
                      alert(`❌ Error: ${err.message}`);
                    }
                  }
                }}
                className="p-4 bg-slate-950 border border-cyan-500/30 rounded-xl text-left hover:border-cyan-500 transition-all group"
              >
                <div className="text-cyan-400 font-black text-sm mb-1 group-hover:text-cyan-300">
                  Copiar desde {selectedYear - 1}
                </div>
                <p className="text-[10px] text-slate-400">
                  Crea {selectedYear} con la misma estructura que {selectedYear - 1}, datos vacíos.
                </p>
              </button>

              {/* Crear estructura - DIFERENTE para IPS vs otros clientes */}
              {selectedClientId.toUpperCase() === 'IPS' ? (
                <button
                  onClick={async () => {
                    const ok = confirm(`¿Crear estructura IPS estándar desde CERO?\n\nCliente: IPS\nAño: ${selectedYear}\n\nSe crearán los 14 tableros IPS con los 14 indicadores estándar, todos con datos vacíos.`);
                    if (ok) {
                      try {
                        const result = await firebaseService.createIPSStructure(selectedYear);
                        alert(`✅ ¡Estructura IPS creada!\n\n• ${result.createdDashboards} tableros creados\n• ${result.indicatorsPerDashboard} indicadores por tablero\n• ${result.totalIndicators} indicadores totales`);
                        window.location.reload();
                      } catch (err: any) {
                        alert(`❌ Error: ${err.message}`);
                      }
                    }
                  }}
                  className="p-4 bg-slate-950 border border-green-500/30 rounded-xl text-left hover:border-green-500 transition-all group"
                >
                  <div className="text-green-400 font-black text-sm mb-1 group-hover:text-green-300">
                    Crear Estructura IPS
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Crea 14 tableros IPS con 14 indicadores estándar (solo para IPS).
                  </p>
                </button>
              ) : (
                <button
                  onClick={async () => {
                    if (!selectedClientId || selectedClientId === 'all') {
                      alert("Selecciona un cliente específico primero.");
                      return;
                    }
                    const countStr = prompt(`¿Cuántos tableros vacíos deseas crear para ${selectedClientId}/${selectedYear}?\n\nIngresa un número (ej: 5, 10, 14):`, "5");
                    if (!countStr) return;
                    const count = parseInt(countStr, 10);
                    if (isNaN(count) || count < 1 || count > 50) {
                      alert("Ingresa un número válido entre 1 y 50.");
                      return;
                    }
                    const ok = confirm(`¿Crear ${count} tableros VACÍOS?\n\nCliente: ${selectedClientId}\nAño: ${selectedYear}\n\nLos tableros se crearán sin indicadores. Podrás agregar indicadores manualmente después.`);
                    if (ok) {
                      try {
                        const result = await firebaseService.createMultipleEmptyDashboards(selectedClientId, selectedYear, count);
                        alert(`✅ ¡Tableros creados!\n\n• ${result.createdDashboards} tableros vacíos creados\n• Sin indicadores (agrégalos manualmente)`);
                        window.location.reload();
                      } catch (err: any) {
                        alert(`❌ Error: ${err.message}`);
                      }
                    }
                  }}
                  className="p-4 bg-slate-950 border border-green-500/30 rounded-xl text-left hover:border-green-500 transition-all group"
                >
                  <div className="text-green-400 font-black text-sm mb-1 group-hover:text-green-300">
                    Crear Tableros Vacíos
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Crea tableros sin indicadores para {selectedClientId} (los configuras tú).
                  </p>
                </button>
              )}
            </div>
          </div>

        </div>

        {/* Zona Peligrosa */}
        <div className="bg-slate-800/40 border border-red-500/20 rounded-2xl p-6 mt-6">
          <h3 className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <span>⚠️</span> Zona Peligrosa
          </h3>
          <button
            onClick={async () => {
              if (!selectedClientId || selectedClientId === 'all') {
                alert("Selecciona un cliente específico primero.");
                return;
              }
              const ok = confirm(`⚠️ ELIMINAR TODOS LOS DATOS ⚠️\n\nCliente: ${selectedClientId}\nAño: ${selectedYear}\n\nEsta acción eliminará PERMANENTEMENTE todos los tableros e indicadores de ${selectedClientId}/${selectedYear}.\n\n¿Estás ABSOLUTAMENTE seguro?`);
              if (ok) {
                const ok2 = confirm("ÚLTIMA ADVERTENCIA: No hay forma de recuperar estos datos. ¿Proceder con la eliminación?");
                if (ok2) {
                  try {
                    const result = await firebaseService.deleteClientYearData(selectedClientId, selectedYear);
                    alert(`✅ Eliminados ${result.deletedCount} tableros de ${selectedClientId}/${selectedYear}.`);
                    window.location.reload();
                  } catch (err: any) {
                    alert(`❌ Error: ${err.message}`);
                  }
                }
              }
            }}
            className="w-full p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-left hover:bg-red-500/20 transition-all group"
          >
            <div className="text-red-400 font-black text-sm mb-1">Eliminar TODO ({selectedClientId}/{selectedYear})</div>
            <p className="text-[10px] text-slate-400">Borra todos los tableros del cliente y año seleccionado. IRREVERSIBLE.</p>
          </button>

          <button
            onClick={async () => {
              if (!selectedClientId || selectedClientId === 'all') {
                alert("Selecciona un cliente específico primero.");
                return;
              }
              const ok = confirm(`🚨 ELIMINACIÓN GLOBAL DE CLIENTE 🚨\n\nEliminarás: "${selectedClientId}" de TODOS los años.\n\nEsta acción es DEFINITIVA y borrará absolutamente todos sus tableros e historial del sistema.\n\n¿Deseas proceder?`);
              if (ok) {
                const safetyCheck = prompt(`Escribe el nombre del cliente "${selectedClientId}" para confirmar la eliminación total:`);
                if (safetyCheck?.toUpperCase() === selectedClientId.toUpperCase()) {
                  try {
                    const result = await firebaseService.deleteClientGlobally(selectedClientId);
                    alert(`✅ Cliente eliminado globalmente. Se borraron ${result.deletedCount} tableros en total.`);
                    window.location.reload();
                  } catch (err: any) {
                    alert(`❌ Error: ${err.message}`);
                  }
                } else {
                  alert("Confirmación incorrecta. Operación cancelada.");
                }
              }
            }}
            className="w-full mt-4 p-4 bg-red-950/40 border border-red-500/50 rounded-xl text-left hover:bg-red-900/40 transition-all group"
          >
            <div className="text-red-500 font-black text-sm mb-1">🔥 ELIMINAR CLIENTE GLOBALMENTE</div>
            <p className="text-[10px] text-slate-400">Elimina el historial completo (todos los años) de este cliente. Solo para administradores.</p>
          </button>

        </div>

        {/* Gestión de Datos Operativos */}
        <div className="mt-6">
          <div className="bg-slate-800/40 border border-white/5 rounded-2xl p-6 mb-6">
            <h3 className="text-[10px] font-black text-cyan-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <span>🛠️</span> Gestión de Datos Operativos
            </h3>

            <div className="grid gap-4">
              <button
                onClick={async () => {
                  const targetClient = selectedClientId.trim().toUpperCase();
                  const allAreas = [...new Set(
                    allRawDashboards
                      .filter(d => !String(d.id).startsWith('agg-') && d.id !== -1 &&
                        String(d.clientId || "IPS").toUpperCase() === targetClient &&
                        Number(d.year || selectedYear) === Number(selectedYear))
                      .map(d => ((d as any).area || "").trim().toUpperCase())
                      .filter(a => a.length > 0)
                  )];

                  let selectedArea: string | undefined = undefined;

                  if (allAreas.length > 0) {
                    const choice = prompt(
                      `🏢 SISTEMA DE ÁREAS (v5.5.3)\n\nÁreas disponibles: ${allAreas.join(', ')}\n\nEscribe el nombre del ÁREA para limpiar solo es tableros, o 'TODOS' para limpiar todo el cliente.`
                    );
                    if (!choice) return;
                    if (choice.trim().toUpperCase() === 'TODOS') selectedArea = undefined;
                    else {
                      const match = allAreas.find(a => a === choice.trim().toUpperCase());
                      selectedArea = match || choice.trim().toUpperCase();
                    }
                  }

                  const ok = confirm(`¿⚠️ LIMPIAR DATOS DE OPERACIÓN?\n\nCliente: ${selectedClientId}\n${selectedArea ? `Área: ${selectedArea}` : ''}\n\nEsto borrará los avances mensuales cargados. Útil para reiniciar captura.`);
                  if (ok) {
                    const result = await firebaseService.resetDashboardDataOnly(selectedClientId, selectedYear, selectedArea);
                    alert(`Limpieza realizada en ${result.resetDashboards} tableros.`);
                    window.location.reload();
                  }
                }}
                className="p-4 bg-red-900/20 border border-red-500/30 rounded-xl text-left hover:bg-red-900/40 transition-all"
              >
                <h4 className="text-red-400 font-bold text-xs uppercase mb-1">🧹 Limpiar Datos Operativos</h4>
                <p className="text-[10px] text-slate-400">Reinicia los valores de avance a cero. No borra indicadores.</p>
              </button>
            </div>
          </div>



          {/* Terminología Personalizada */}
          <div className="bg-slate-800/40 border border-white/5 rounded-2xl p-6">
            <h3 className="text-[10px] font-black text-cyan-500 uppercase tracking-widest mb-4">🏷️ Terminología Personalizada</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">Nombre de Grupos</label>
                <input
                  defaultValue={settings?.groupLabel}
                  onBlur={(e) => handleUpdateSystemSettings({ groupLabel: e.target.value })}
                  className="w-full bg-slate-900 border border-white/10 rounded-lg p-2 text-xs text-white"
                  placeholder="Ej: Dirección"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">Nombre de Tableros</label>
                <input
                  defaultValue={settings?.dashboardLabel}
                  onBlur={(e) => handleUpdateSystemSettings({ dashboardLabel: e.target.value })}
                  className="w-full bg-slate-900 border border-white/10 rounded-lg p-2 text-xs text-white"
                  placeholder="Ej: UNE"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8">
          <button
            onClick={() => setActiveAdminSection("none")}
            className="w-full py-4 bg-cyan-600 hover:bg-cyan-500 text-white font-black uppercase tracking-widest rounded-xl transition-all shadow-xl shadow-cyan-900/20 active:scale-[0.98]"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
});
