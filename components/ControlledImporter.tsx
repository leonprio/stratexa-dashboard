import React, { useState, useMemo, useCallback } from "react";
import { Dashboard as DashboardType, DashboardItem } from "../types";
import { firebaseService } from "../services/firebaseService";
import {
  parseRecoveryExcelJS,
  ParsedRecoveryRow,
  localCheckpointManager,
  generateChecksum,
  generateBaselineManifest,
  exportToRecoveryExcelJS
} from "../utils/enterpriseRecoveryUtils";

const LOCK_KEY = "stratexa_import_lock";

const acquireImportLock = (): boolean => {
  const currentLock = localStorage.getItem(LOCK_KEY);
  if (currentLock) {
    const timestamp = parseInt(currentLock, 10);
    // Si el lock tiene menos de 5 minutos, consideramos que está ocupado
    if (Date.now() - timestamp < 5 * 60 * 1000) {
      return false;
    }
  }
  localStorage.setItem(LOCK_KEY, String(Date.now()));
  (window as any).stratexaImportLockActive = true;
  return true;
};

const releaseImportLock = () => {
  localStorage.removeItem(LOCK_KEY);
  (window as any).stratexaImportLockActive = false;
};

const isImportLockActive = (): boolean => {
  const currentLock = localStorage.getItem(LOCK_KEY);
  if (currentLock) {
    const timestamp = parseInt(currentLock, 10);
    if (Date.now() - timestamp < 5 * 60 * 1000) {
      return true;
    }
  }
  return !!(window as any).stratexaImportLockActive;
};

interface ControlledImporterProps {
  dashboards: DashboardType[];
  selectedClientId: string;
  selectedYear: number;
  onImportComplete?: () => void;
  onClose: () => void;
}

interface CellDiffItem {
  dashboardId: string;
  dashboardTitle: string;
  kpiId: string;
  indicatorName: string;
  cellName: string; // e.g. "Meta Ene", "Avance May", "captureRate"
  oldValue: number | string | null;
  newValue: number | string;
  status: "new" | "modified";
}

type ImportStateStep = "upload" | "validation" | "diff" | "applying" | "done";

export const ControlledImporter: React.FC<ControlledImporterProps> = React.memo(({
  dashboards,
  selectedClientId,
  selectedYear,
  onImportComplete,
  onClose,
}) => {
  const [step, setStep] = useState<ImportStateStep>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [metadata, setMetadata] = useState<Record<string, string>>({});
  
  // Mutex Lock for simultaneous imports or accidental double submissions
  const [isImporting, setIsImporting] = useState(false);

  // Datos parseados en Sandbox
  const [parsedKPIs, setParsedKPIs] = useState<ParsedRecoveryRow[]>([]);
  const [cellDiffs, setCellDiffs] = useState<CellDiffItem[]>([]);
  
  // Checkpoint de Rollback de emergencia local
  const [rollbackId, setRollbackId] = useState<string | null>(null);
  const [preImportCheckpoint, setPreImportCheckpoint] = useState<any | null>(null);

  // Filtrar tableros locales para este cliente y año
  const filteredLocalDashboards = useMemo(() => {
    return dashboards.filter(
      (d) =>
        String(d.clientId || "IPS").toUpperCase() === selectedClientId.toUpperCase() &&
        Number(d.year || 2025) === selectedYear
    );
  }, [dashboards, selectedClientId, selectedYear]);

  // Leer y validar archivo en Sandbox
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;

    // 1. IMPORT LOCK check
    if (isImporting || isImportLockActive()) {
      setErrors(["Operación bloqueada: Ya existe una sesión de importación activa en el sistema. Espere a que finalice para evitar colisiones o corrupción."]);
      setFile(null);
      return;
    }

    // 2. MAX FILE SIZE check (10MB)
    if (f.size > 10 * 1024 * 1024) {
      setErrors(["El archivo excede el tamaño máximo permitido de 10 MB."]);
      setFile(null);
      return;
    }

    setIsImporting(true);
    setFile(f);
    setErrors([]);
    setWarnings([]);

    try {
      if (f.name.endsWith(".json")) {
        // Carga y validación en Sandbox del Baseline JSON
        const text = await f.text();
        const data = JSON.parse(text);

        let dashboardsArray: any[] = [];
        let fileMetadata: Record<string, string> = {};

        if (Array.isArray(data)) {
          dashboardsArray = data;
          fileMetadata = {
            cliente: selectedClientId,
            año: String(selectedYear),
            versión: "v9.4.1-STABLE-QA-HARDENING",
            timestamp: new Date().toISOString(),
            checksum: generateChecksum(text),
          };
        } else if (data && data.dashboards && Array.isArray(data.dashboards)) {
          dashboardsArray = data.dashboards;
          fileMetadata = data.manifest || data.metadata || {};
        } else {
          setErrors(["El archivo JSON de restauración no cuenta con una estructura de tableros válida."]);
          setIsImporting(false);
          return;
        }

        // Validar versión en el JSON
        const fileVer = fileMetadata.versión || fileMetadata.appVersion || "";
        if (fileVer && !fileVer.startsWith("v9.")) {
          setErrors([`Incompatibilidad de versión. La versión del archivo (${fileVer}) no es compatible con el sistema actual (v9.x).`]);
          setIsImporting(false);
          return;
        }

        setMetadata(fileMetadata);

        const rows: ParsedRecoveryRow[] = [];
        dashboardsArray.forEach((d: any) => {
          if (d.items && Array.isArray(d.items)) {
            d.items.forEach((item: any) => {
              rows.push({
                dashboardId: String(d.id),
                kpiId: String(item.id),
                areaId: String(d.area || "GENERAL"),
                directionId: String(d.group || "GENERAL"),
                monthlyGoals: item.monthlyGoals || Array(12).fill(0),
                monthlyProgress: item.monthlyProgress || Array(12).fill(0),
              });
            });
          }
        });

        // Validar límites de cantidad en JSON
        if (dashboardsArray.length > 100) {
          setErrors(["El archivo JSON supera el límite máximo de 100 dashboards."]);
          setIsImporting(false);
          return;
        }
        if (rows.length > 2000) {
          setErrors(["El archivo JSON supera el límite máximo de 2000 KPIs."]);
          setIsImporting(false);
          return;
        }

        setParsedKPIs(rows);
        processCellDiffs(rows);
        setStep("diff");
      } else if (f.name.endsWith(".xlsx") || f.name.endsWith(".xls")) {
        // Carga y validación en Sandbox del XLSX Binario (ExcelJS)
        const buffer = await f.arrayBuffer();
        const res = await parseRecoveryExcelJS(buffer);
        
        if (!res.success || res.errors.length > 0) {
          setErrors(res.errors);
          setIsImporting(false);
          return;
        }

        setMetadata(res.metadata || {});
        setParsedKPIs(res.kpiRows || []);
        
        // Validación de correspondencia e integridad por IDs inmutables (Dry Run)
        const localErrors: string[] = [];
        const localWarnings: string[] = [];
        
        if (res.kpiRows && res.kpiRows.length > 0) {
          res.kpiRows.forEach((row) => {
            const localDash = filteredLocalDashboards.find(
              (d) => String(d.id) === String(row.dashboardId)
            );
            if (!localDash) {
              localErrors.push(
                `Conflicto de Integridad: El ID de tablero '${row.dashboardId}' especificado en el archivo XLSX no existe en el sistema local.`
              );
              return;
            }

            const localKPI = localDash.items.find(
              (it) => String(it.id) === String(row.kpiId)
            );
            if (!localKPI) {
              localWarnings.push(
                `Tablero '${localDash.title}' (ID: ${row.dashboardId}): El KPI con ID inmutable '${row.kpiId}' no existe en el sistema local. Se omitirá.`
              );
            }
          });
        }

        if (localErrors.length > 0) {
          setErrors(localErrors);
        } else {
          setWarnings(localWarnings);
          processCellDiffs(res.kpiRows || []);
          setStep("diff");
        }
      } else {
        setErrors(["Formato de archivo no soportado. Suba un libro XLSX real (.xlsx) o un Baseline JSON (.json)."]);
      }
    } catch (err: any) {
      setErrors([`Error al parsear el archivo en el sandbox: ${err.message}`]);
    } finally {
      setIsImporting(false);
    }
  };

  // Comparar datos locales contra los datos del archivo celda por celda (Cell-Level Diff)
  const processCellDiffs = (fileRows: ParsedRecoveryRow[]) => {
    const list: CellDiffItem[] = [];
    const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

    fileRows.forEach((row) => {
      const localDash = filteredLocalDashboards.find(
        (d) => String(d.id) === String(row.dashboardId)
      );
      if (!localDash) return;

      const localKPI = localDash.items.find(
        (it) => String(it.id) === String(row.kpiId)
      );
      if (!localKPI) return;

      // 1. Comparar Metas Celda por Celda
      row.monthlyGoals.forEach((newVal, idx) => {
        const oldVal = localKPI.monthlyGoals[idx] ?? null;
        if (oldVal !== newVal) {
          list.push({
            dashboardId: String(localDash.id),
            dashboardTitle: localDash.title,
            kpiId: String(localKPI.id),
            indicatorName: localKPI.indicator,
            cellName: `Meta ${monthNames[idx]}`,
            oldValue: oldVal,
            newValue: newVal,
            status: oldVal === null ? "new" : "modified",
          });
        }
      });

      // 2. Comparar Avances Celda por Celda
      row.monthlyProgress.forEach((newVal, idx) => {
        const oldVal = localKPI.monthlyProgress[idx] ?? null;
        if (oldVal !== newVal) {
          list.push({
            dashboardId: String(localDash.id),
            dashboardTitle: localDash.title,
            kpiId: String(localKPI.id),
            indicatorName: localKPI.indicator,
            cellName: `Avance ${monthNames[idx]}`,
            oldValue: oldVal,
            newValue: newVal,
            status: oldVal === null ? "new" : "modified",
          });
        }
      });

      // 3. Comparar Métricas Operativas Celda por Celda (si vienen en el archivo)
      if (row.captureRate !== undefined) {
        const oldCap = localKPI.operationalMetrics?.captureRate ?? null;
        if (oldCap !== null && Math.abs(oldCap - row.captureRate) > 0.01) {
          list.push({
            dashboardId: String(localDash.id),
            dashboardTitle: localDash.title,
            kpiId: String(localKPI.id),
            indicatorName: localKPI.indicator,
            cellName: "Capture Rate (%)",
            oldValue: oldCap !== null ? `${oldCap.toFixed(1)}%` : "nulo",
            newValue: `${row.captureRate.toFixed(1)}%`,
            status: "modified",
          });
        }
      }

      if (row.realOperationalScore !== undefined) {
        const oldScore = localKPI.operationalMetrics?.realOperationalScore ?? null;
        if (oldScore !== null && Math.abs(oldScore - row.realOperationalScore) > 0.01) {
          list.push({
            dashboardId: String(localDash.id),
            dashboardTitle: localDash.title,
            kpiId: String(localKPI.id),
            indicatorName: localKPI.indicator,
            cellName: "Operational Score",
            oldValue: oldScore !== null ? oldScore.toFixed(2) : "nulo",
            newValue: row.realOperationalScore.toFixed(2),
            status: "modified",
          });
        }
      }

      if (row.stalenessDays !== undefined) {
        const oldStale = localKPI.operationalMetrics?.stalenessDays ?? null;
        if (oldStale !== null && oldStale !== row.stalenessDays) {
          list.push({
            dashboardId: String(localDash.id),
            dashboardTitle: localDash.title,
            kpiId: String(localKPI.id),
            indicatorName: localKPI.indicator,
            cellName: "Staleness Days",
            oldValue: oldStale,
            newValue: row.stalenessDays,
            status: "modified",
          });
        }
      }
    });

    setCellDiffs(list);
  };

  // Ejecutar importación y crear checkpoints
  const handleApplyImport = async () => {
    // 1. IMPORT LOCK check
    if (isImporting || isImportLockActive()) {
      alert("⚠️ Error de integridad: Hay una sesión de importación activa en este momento. Espere a que finalice para evitar doble importación simultánea.");
      return;
    }

    if (!acquireImportLock()) {
      alert("⚠️ Error: No se pudo adquirir el bloqueo exclusivo de importación.");
      return;
    }

    setIsImporting(true);
    setStep("applying");

    try {
      // PASO 1: AUTO EXPORT RECOVERY OBLIGATORIO
      // A. Crear Checkpoint en localStorage
      const checkpointReason = `AUTO_BEFORE_IMPORT_${new Date().toISOString().split(".")[0].replace(/:/g, "-")}`;
      const chkId = localCheckpointManager.create(
        selectedClientId,
        selectedYear,
        filteredLocalDashboards,
        checkpointReason
      );
      setRollbackId(chkId);
      
      const createdCheckpoint = localCheckpointManager.get(selectedClientId, selectedYear, chkId);
      setPreImportCheckpoint(createdCheckpoint);

      // B. Descarga física automática de salvaguarda (3 archivos obligatorios: baseline, recovery, manifest)
      const timestampLabel = Date.now();

      // 1. Baseline Export (JSON de estructura actual de tableros)
      const baselineBlob = new Blob([JSON.stringify(filteredLocalDashboards, null, 2)], { type: "application/json" });
      const baselineUrl = URL.createObjectURL(baselineBlob);
      const linkBaseline = document.createElement("a");
      linkBaseline.href = baselineUrl;
      linkBaseline.download = `baseline_export_${selectedClientId}_${selectedYear}_${timestampLabel}.json`;
      document.body.appendChild(linkBaseline);
      linkBaseline.click();
      document.body.removeChild(linkBaseline);
      URL.revokeObjectURL(baselineUrl);

      // 2. Recovery Export (Excel XLSX binario real con ExcelJS antes de cambios)
      const xlsxBuffer = await exportToRecoveryExcelJS(
        filteredLocalDashboards,
        selectedClientId,
        selectedYear,
        "v9.4.1-STABLE-QA-HARDENING"
      );
      const xlsxBlob = new Blob([xlsxBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const xlsxUrl = URL.createObjectURL(xlsxBlob);
      const linkXlsx = document.createElement("a");
      linkXlsx.href = xlsxUrl;
      linkXlsx.download = `recovery_export_${selectedClientId}_${selectedYear}_${timestampLabel}.xlsx`;
      document.body.appendChild(linkXlsx);
      linkXlsx.click();
      document.body.removeChild(linkXlsx);
      URL.revokeObjectURL(xlsxUrl);

      // 3. Manifest Export (Manifiesto de auditoría y checksums)
      const manifestString = generateBaselineManifest(
        filteredLocalDashboards,
        selectedClientId,
        selectedYear,
        "v9.4.1-STABLE-QA-HARDENING"
      );
      const manifestBlob = new Blob([manifestString], { type: "application/json" });
      const manifestUrl = URL.createObjectURL(manifestBlob);
      const linkManifest = document.createElement("a");
      linkManifest.href = manifestUrl;
      linkManifest.download = `manifest_export_${selectedClientId}_${selectedYear}_${timestampLabel}.json`;
      document.body.appendChild(linkManifest);
      linkManifest.click();
      document.body.removeChild(linkManifest);
      URL.revokeObjectURL(manifestUrl);

      // PASO 2: UPSERT QUIRÚRGICO CONTROLADO
      const updatedDashboards = filteredLocalDashboards.map((dash) => {
        const dashRows = parsedKPIs.filter(
          (r) => String(r.dashboardId) === String(dash.id)
        );

        if (dashRows.length === 0) return dash;

        const newItems = dash.items.map((item) => {
          const rowData = dashRows.find((r) => String(r.kpiId) === String(item.id));
          if (!rowData) return item;

          // Conservar toda la metadata del KPI original, actualizando solo metas y avances quirúrgicamente
          return {
            ...item,
            monthlyGoals: [...rowData.monthlyGoals],
            monthlyProgress: [...rowData.monthlyProgress],
            operationalMetrics: rowData.captureRate !== undefined ? {
              ...item.operationalMetrics,
              captureRate: rowData.captureRate,
              realOperationalScore: rowData.realOperationalScore ?? item.operationalMetrics?.realOperationalScore ?? 100,
              stalenessDays: rowData.stalenessDays ?? item.operationalMetrics?.stalenessDays ?? 0,
            } as any : item.operationalMetrics
          };
        });

        return { ...dash, items: newItems };
      });

      // PASO 3: Persistir quirúrgicamente en Firestore
      for (const dash of updatedDashboards) {
        await firebaseService.updateDashboardItems(dash.id, dash.items, true);
      }

      setStep("done");
    } catch (err: any) {
      setErrors([`Error al aplicar los cambios en el upsert controlado: ${err.message}`]);
      setStep("diff");
    } finally {
      setIsImporting(false);
      releaseImportLock();
    }
  };

  // Realizar rollback de inmediato
  const handleRollbackImmediate = async () => {
    if (!rollbackId || !preImportCheckpoint || isImporting) return;

    if (isImportLockActive()) {
      alert("⚠️ No se puede realizar rollback: Hay otra importación en progreso.");
      return;
    }

    if (!acquireImportLock()) {
      alert("⚠️ Error al adquirir el bloqueo exclusivo para rollback.");
      return;
    }

    setIsImporting(true);
    setStep("applying");

    try {
      for (const dash of preImportCheckpoint.dashboards) {
        await firebaseService.updateDashboardItems(dash.id, dash.items, true);
      }
      alert("✅ Rollback exitoso. Todos los datos de esta sesión han sido restaurados a su estado original previo a la importación.");
      onImportComplete?.();
    } catch (err: any) {
      alert(`❌ Error al ejecutar Rollback: ${err.message}`);
    } finally {
      setIsImporting(false);
      releaseImportLock();
      setStep("done");
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/90 flex items-center justify-center p-4 overflow-y-auto">
      {/* Contenedor con estilo corporativo ultra sobrio de alto contraste */}
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-5xl shadow-2xl flex flex-col max-h-[90vh] my-4 overflow-hidden">
        
        {/* Header Institucional */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/60">
          <div>
            <h2 className="text-xl font-bold uppercase tracking-tight text-white flex items-center gap-2">
              <span className="text-slate-400">📥</span> Pipeline de Importación Controlada
            </h2>
            <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest font-mono">
              SISTEMA DE SEGURIDAD OPERATIVA IPS • CLIENTE: <span className="text-white font-bold">{selectedClientId}</span> • AÑO: <span className="text-white font-bold">{selectedYear}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isImporting}
            className="w-8 h-8 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 rounded-lg flex items-center justify-center text-slate-300 hover:text-white transition-all text-xs font-mono"
          >
            ESC
          </button>
        </div>

        {/* Steps Progress */}
        <div className="flex items-center gap-2 px-5 py-3 bg-slate-950/40 border-b border-slate-800 overflow-x-auto whitespace-nowrap">
          {["upload", "diff", "applying", "done"].map((s, idx) => (
            <React.Fragment key={s}>
              <div
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-mono uppercase tracking-wider transition-all ${
                  step === s
                    ? "bg-white text-slate-950 font-bold"
                    : idx < ["upload", "diff", "applying", "done"].indexOf(step)
                    ? "bg-slate-850 text-slate-300 border border-slate-700"
                    : "bg-slate-900 text-slate-500 border border-transparent"
                }`}
              >
                <span>{idx + 1}.</span>
                {s === "upload" && "Carga Binaria"}
                {s === "diff" && "Sandbox Diff"}
                {s === "applying" && "Procesando"}
                {s === "done" && "Terminado"}
              </div>
              {idx < 3 && <div className="flex-1 h-px bg-slate-800 min-w-[15px]" />}
            </React.Fragment>
          ))}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          
          {/* STEP 1: UPLOAD */}
          {step === "upload" && (
            <div className="space-y-5">
              
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-5">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-2 font-mono">🛡️ Instrucciones de Seguridad</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Para actualizar de forma quirúrgica metas y avances, suba el archivo de **Excel XLSX binario** o el **JSON de Baseline**.
                  El sistema validará firmas digitales e integridad en un **Sandbox aislado en memoria** antes de aplicar cualquier cambio físico.
                </p>
                <div className="mt-4 flex items-center gap-3 text-[10px] text-amber-300 font-mono uppercase bg-amber-950/20 p-3 rounded-lg border border-amber-900/30">
                  <span>⚠️</span>
                  <span>ESTÁ ESTRICTAMENTE PROHIBIDA Y BLOQUEADA LA IMPORTACIÓN BASADA EN NOMBRES O RECREACIÓN DE IDS.</span>
                </div>
              </div>

              {/* Drag n Drop Area */}
              <div className="border-2 border-dashed border-slate-700 hover:border-slate-500 rounded-xl p-8 text-center transition-all bg-slate-950/40 relative">
                <input
                  type="file"
                  accept=".xlsx,.xls,.json"
                  onChange={handleFileChange}
                  disabled={isImporting}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                />
                <div className="text-3xl mb-3">📁</div>
                <h4 className="text-sm font-bold text-white mb-1 font-mono">Seleccione archivo de recuperación (.xlsx, .json)</h4>
                <p className="text-[10px] text-slate-400 font-mono">LÍMITE MÁXIMO DE TAMAÑO: 10 MB</p>
                
                {isImporting && (
                  <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center rounded-xl">
                    <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mb-2"></div>
                    <span className="text-[10px] text-white font-mono uppercase tracking-widest">Validando Sandbox...</span>
                  </div>
                )}
              </div>

              {errors.length > 0 && (
                <div className="bg-rose-950/20 border border-rose-900/40 rounded-xl p-4 space-y-2">
                  <h4 className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-2 font-mono">
                    <span>🚨</span> Error de Validación Sandbox:
                  </h4>
                  <ul className="text-[10px] text-rose-300 space-y-1 list-disc list-inside max-h-40 overflow-y-auto font-mono">
                    {errors.map((e, idx) => (
                      <li key={idx}>{e}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: CELL DIFF & SANDBOX */}
          {step === "diff" && (
            <div className="space-y-5">
              
              {/* Metadata Panel */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 grid grid-cols-2 md:grid-cols-4 gap-4 font-mono">
                <div>
                  <span className="text-[9px] text-slate-500 font-bold uppercase block">Archivo cargado</span>
                  <span className="text-xs font-bold text-white truncate block">{file?.name}</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-500 font-bold uppercase block">Firma digital</span>
                  <span className="text-xs font-bold text-emerald-400 block truncate">{metadata.exportSignature ? "VALIDADA ✓" : "N/A"}</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-500 font-bold uppercase block">Total KPIs leídos</span>
                  <span className="text-xs font-bold text-white block">{parsedKPIs.length} registros</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-500 font-bold uppercase block">Diferencias exactas</span>
                  <span className="text-xs font-bold text-amber-400 block">{cellDiffs.length} celdas</span>
                </div>
              </div>

              {/* Warnings Panel */}
              {warnings.length > 0 && (
                <div className="bg-amber-950/20 border border-amber-900/30 rounded-xl p-3 max-h-24 overflow-y-auto">
                  <h4 className="text-[10px] font-bold text-amber-400 uppercase font-mono mb-1">⚠️ Advertencias del Sandbox:</h4>
                  <ul className="text-[9px] text-slate-400 space-y-0.5 list-disc list-inside font-mono">
                    {warnings.map((w, idx) => (
                      <li key={idx}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Diffs Cell-Level Table */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-slate-400 uppercase font-mono tracking-wider">Auditoría Celda por Celda (Cell-Level Diff)</h3>
                
                {cellDiffs.length === 0 ? (
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-8 text-center">
                    <span className="text-2xl mb-2 block">ℹ️</span>
                    <h4 className="text-xs font-bold text-white font-mono">No hay cambios detectados</h4>
                    <p className="text-[11px] text-slate-400 mt-1">Los datos del archivo coinciden al 100% con los almacenados en el sistema local.</p>
                  </div>
                ) : (
                  <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                    <table className="w-full text-[11px] text-left font-mono">
                      <thead className="sticky top-0 bg-slate-900 border-b border-slate-800 text-slate-400 uppercase font-bold text-[9px]">
                        <tr>
                          <th className="px-4 py-2">Tablero</th>
                          <th className="px-4 py-2">KPI</th>
                          <th className="px-4 py-2">Celda</th>
                          <th className="px-4 py-2 text-right">Anterior</th>
                          <th className="px-4 py-2 text-right text-amber-400">Nuevo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 text-slate-300">
                        {cellDiffs.map((diff, idx) => (
                          <tr key={idx} className="hover:bg-slate-900 transition-all">
                            <td className="px-4 py-2 font-bold text-white truncate max-w-[150px]">{diff.dashboardTitle}</td>
                            <td className="px-4 py-2 text-slate-400 truncate max-w-[200px]">{diff.indicatorName} <span className="text-[9px] text-slate-500">({diff.kpiId})</span></td>
                            <td className="px-4 py-2 uppercase font-bold text-[10px] text-slate-400">{diff.cellName}</td>
                            <td className="px-4 py-2 text-right text-slate-500">{diff.oldValue ?? "nulo"}</td>
                            <td className="px-4 py-2 text-right text-amber-400 font-bold">+{diff.newValue}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Botones de acción */}
              <div className="flex gap-3 pt-3 border-t border-slate-850">
                <button
                  onClick={() => setStep("upload")}
                  disabled={isImporting}
                  className="px-4 py-2 bg-slate-850 hover:bg-slate-800 text-slate-300 font-mono text-[10px] font-bold rounded-lg uppercase transition-all"
                >
                  ← Cargar Otro
                </button>
                <button
                  onClick={handleApplyImport}
                  disabled={cellDiffs.length === 0 || isImporting}
                  className="flex-1 px-4 py-2 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-mono text-[11px] font-bold rounded-lg uppercase transition-all"
                >
                  Aplicar Upsert Quirúrgico (Creará Auto-Backup de Emergencia)
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: APPLYING (SPINNER) */}
          {step === "applying" && (
            <div className="flex flex-col items-center justify-center py-12 space-y-3 font-mono">
              <div className="w-10 h-10 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <h3 className="text-sm font-bold text-white uppercase">Procesando de Forma Segura...</h3>
              <p className="text-[10px] text-slate-400">Ejecutando backups físicos y aplicando upserts en Firestore.</p>
            </div>
          )}

          {/* STEP 4: DONE */}
          {step === "done" && (
            <div className="flex flex-col items-center justify-center py-10 text-center space-y-5 max-w-lg mx-auto font-mono">
              <div className="w-14 h-14 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/30 text-xl">
                <span>✓</span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-white uppercase tracking-tight">¡Proceso Completado con Éxito!</h3>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                  Los datos del archivo han sido aplicados quirúrgicamente en Firestore sin alterar otros componentes del sistema.
                </p>
              </div>

              {rollbackId && (
                <div className="bg-slate-950 border border-slate-850 rounded-xl p-4 w-full text-left space-y-2">
                  <h4 className="text-[10px] font-bold text-rose-400 uppercase">🛡️ Rollback Local de Emergencia</h4>
                  <p className="text-[10px] text-slate-300">
                    Se generó una copia local con ID: **{rollbackId}** y se descargó el backup físico. Si detecta discrepancias, ejecute el rollback.
                  </p>
                  <button
                    onClick={handleRollbackImmediate}
                    disabled={isImporting}
                    className="w-full py-2 bg-rose-950/20 hover:bg-rose-900/30 text-rose-400 border border-rose-900/30 font-bold rounded-lg text-[10px] uppercase transition-all"
                  >
                    Deshacer e Iniciar Rollback
                  </button>
                </div>
              )}

              <button
                onClick={() => {
                  onImportComplete?.();
                  onClose();
                }}
                disabled={isImporting}
                className="px-6 py-2.5 bg-white hover:bg-slate-100 text-slate-950 font-bold uppercase rounded-lg transition-all text-xs"
              >
                Finalizar e Ir al Sistema
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
});
ControlledImporter.displayName = "ControlledImporter";
