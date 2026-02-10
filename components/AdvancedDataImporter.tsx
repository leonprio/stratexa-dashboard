import React, { useCallback, useMemo, useState } from "react";
import type { Dashboard as DashboardType, DashboardItem } from "../types";
import { firebaseService } from "../services/firebaseService";
import { exportBulkDataToCSV } from "../utils/exportUtils";

// Los 14 tableros estándar de IPS
const STANDARD_DASHBOARDS = [
    { num: 1, name: "METRO CENTRO" },
    { num: 2, name: "METRO SUR" },
    { num: 3, name: "METRO NORTE" },
    { num: 4, name: "TOLUCA" },
    { num: 5, name: "GTMI" },
    { num: 6, name: "OCCIDENTE" },
    { num: 7, name: "BAJIO" },
    { num: 8, name: "SLP" },
    { num: 9, name: "SUR" },
    { num: 10, name: "GOLFO" },
    { num: 11, name: "PENINSULA" },
    { num: 12, name: "PACIFICO" },
    { num: 13, name: "NOROESTE" },
    { num: 14, name: "NORESTE" },
];

interface AdvancedDataImporterProps {
    dashboards: DashboardType[];
    availableClients: string[];
    selectedClientId: string;
    selectedYear: number;
    onClientChange: (clientId: string) => void;
    onYearChange: (year: number) => void;
    onImportComplete?: () => void;
    onClose: () => void;
}

interface ParsedRow {
    dashboardNum: number;
    indicatorNum: number;
    indicatorName?: string;
    monthlyGoals: number[];
    monthlyProgress: number[];
    rawRow: string[];
}

interface ColumnMapping {
    dashboardNum: number | null; // column index
    indicatorNum: number | null;
    indicatorName: number | null;
    goalStart: number | null; // first goal column (12 consecutive)
    progressStart: number | null; // first progress column (12 consecutive)
}

type ImportStep = "upload" | "mapping" | "preview" | "importing" | "complete" | "json-preview";

export const AdvancedDataImporter: React.FC<AdvancedDataImporterProps> = ({
    dashboards,
    availableClients,
    selectedClientId,
    selectedYear,
    onClientChange,
    onYearChange,
    onImportComplete,
    onClose,
}) => {
    const [step, setStep] = useState<ImportStep>("upload");
    const [file, setFile] = useState<File | null>(null);
    const [rawData, setRawData] = useState<string[][]>([]);
    const [headers, setHeaders] = useState<string[]>([]);
    const [mapping, setMapping] = useState<ColumnMapping>({
        dashboardNum: null,
        indicatorNum: null,
        indicatorName: null,
        goalStart: null,
        progressStart: null,
    });
    const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
    const [errors, setErrors] = useState<string[]>([]);
    const [busy, setBusy] = useState(false);
    const [importResult, setImportResult] = useState<string>("");
    const [jsonBackupData, setJsonBackupData] = useState<DashboardType[] | null>(null);

    // Tableros filtrados por cliente y año
    const filteredDashboards = useMemo(() => {
        return dashboards.filter(
            (d) =>
                d.clientId === selectedClientId &&
                (d.year || 2025) === selectedYear &&
                Number(d.id) > 0 // Excluir consolidados
        );
    }, [dashboards, selectedClientId, selectedYear]);

    // Crear mapeo de número (1-14) a dashboard real
    const dashboardByNumber = useMemo(() => {
        const map = new Map<number, DashboardType>();

        filteredDashboards.forEach((dash) => {
            // Prioridad 1: orderNumber explícito
            if (dash.orderNumber) {
                map.set(dash.orderNumber, dash);
            } else {
                // Prioridad 2: Coincidencia por nombre estándar
                const std = STANDARD_DASHBOARDS.find((s) =>
                    dash.title.toUpperCase().includes(s.name.toUpperCase())
                );
                if (std) {
                    map.set(std.num, dash);
                }
            }
        });

        // Fallback: Si no hay mapeos pero hay 14, mapear por orden de lista
        if (map.size === 0 && filteredDashboards.length > 0) {
            filteredDashboards.slice(0, 14).forEach((dash, idx) => {
                map.set(idx + 1, dash);
            });
        }

        return map;
    }, [filteredDashboards]);

    // Parsear CSV/Excel
    const parseFile = async (f: File): Promise<{ headers: string[]; rows: string[][] }> => {
        const text = await f.text();
        const lines = text
            .split(/\r?\n/)
            .map((l) => l.trim())
            .filter(Boolean);

        // Detectar separador (coma, punto y coma, tab)
        const firstLine = lines[0] || "";
        let separator = ",";
        if (firstLine.includes("\t")) separator = "\t";
        else if (firstLine.includes(";")) separator = ";";

        const allRows = lines.map((line) =>
            line.split(separator).map((x) => x.trim().replace(/^"|"$/g, ""))
        );

        const headers = allRows[0] || [];
        const dataRows = allRows.slice(1);

        return { headers, rows: dataRows };
    };

    // Helper para limpiar números
    const cleanNumeric = (val: string): number => {
        if (!val) return 0;
        // Quitar espacios y símbolos comunes, manejar coma como posible decimal si no hay punto
        let s = val.trim().replace(/[%$]/g, "");
        if (s.includes(",") && !s.includes(".")) {
            s = s.replace(",", ".");
        } else if (s.includes(",") && s.includes(".")) {
            // Caso miles con punto y decimal con coma (o viceversa). 
            // Para simplicidad, quitamos comas de miles.
            s = s.replace(/,/g, "");
        }
        const cleaned = s.replace(/[^0-9.-]/g, "");
        return parseFloat(cleaned) || 0;
    };

    const parseRowsInternal = useCallback((_currentMapping: ColumnMapping, data: string[][]) => {
        const errs: string[] = [];
        const parsed: ParsedRow[] = [];

        data.forEach((row, rowIdx) => {
            // FORMATO FIJO ALTERNADO (26 columnas):
            // 0: Tablero, 1: Indicador, 2: Meta Ene, 3: Prog Ene, 4: Meta Feb, 5: Prog Feb...
            const dashNum = parseInt(row[0] || "0", 10);
            const indNum = parseInt(row[1] || "0", 10);

            if (dashNum < 1 || dashNum > 14) {
                errs.push(`Fila ${rowIdx + 2}: Tablero ${dashNum} inválido (1-14).`);
                return;
            }
            if (!dashboardByNumber.has(dashNum)) {
                errs.push(`Fila ${rowIdx + 2}: Tablero ${dashNum} no existe en ${selectedClientId}/${selectedYear}`);
                return;
            }

            const goals: (number | null)[] = [];
            const progress: (number | null)[] = [];

            const offset = row.length === 27 ? 1 : 0;
            for (let i = 0; i < 12; i++) {
                const mIdx = (2 + offset) + (i * 2);
                const pIdx = (3 + offset) + (i * 2);

                const mCell = row[mIdx];
                const pCell = row[pIdx];

                goals.push(mCell === undefined || mCell === "" ? null : cleanNumeric(mCell));
                progress.push(pCell === undefined || pCell === "" ? null : cleanNumeric(pCell));
            }

            parsed.push({
                dashboardNum: dashNum,
                indicatorNum: indNum,
                monthlyGoals: goals as number[],
                monthlyProgress: progress as number[],
                rawRow: row,
            });
        });

        return { parsed, errs };
    }, [dashboardByNumber, selectedClientId, selectedYear]);

    const handleFileUpload = async (f: File) => {
        setFile(f);
        setBusy(true);
        setErrors([]);

        try {
            if (f.name.endsWith('.json')) {
                const text = await f.text();
                const data = JSON.parse(text) as DashboardType[];
                if (!Array.isArray(data) || data.length === 0) {
                    throw new Error("El archivo JSON no contiene un respaldo válido de tableros.");
                }
                setJsonBackupData(data);
                setStep("json-preview");
                setBusy(false);
                return;
            }

            const { headers, rows } = await parseFile(f);

            const isLegacy = headers.length === 26;
            const isStandard = headers.length === 27;

            if (!isLegacy && !isStandard) {
                setErrors([`El archivo debe contener exactamente 26 o 27 columnas (detectadas: ${headers.length}).`]);
                setBusy(false);
                return;
            }

            setHeaders(headers);
            setRawData(rows);

            const offset = isStandard ? 1 : 0;
            const fixedMapping: ColumnMapping = {
                dashboardNum: 0,
                indicatorNum: 1,
                indicatorName: isStandard ? 2 : null,
                goalStart: 2 + offset,
                progressStart: null, // No se usa en parse fijo
            };

            setMapping(fixedMapping);

            // ⚡ PARSEAR Y SALTAR DIRECTAMENTE
            const { parsed, errs } = parseRowsInternal(fixedMapping, rows);
            if (errs.length > 0) {
                setErrors(errs);
                setStep("mapping"); // Volver a mapeo si hay errores raros
            } else {
                setParsedRows(parsed);
                setStep("preview");
            }
        } catch (err: any) {
            setErrors([`Error al leer: ${err.message}`]);
        } finally {
            setBusy(false);
        }
    };

    const executeJsonRestore = async () => {
        if (!jsonBackupData) return;
        setBusy(true);
        setStep("importing");

        try {
            let count = 0;
            for (const dash of jsonBackupData) {
                // Forzar cliente y año actual si el respaldo es de otro origen (Oportunidad de migración)
                const dashToSave = {
                    ...dash,
                    clientId: selectedClientId,
                    year: selectedYear
                };
                await firebaseService.saveDashboard(dashToSave);
                count++;
            }
            setImportResult(`✅ Restauración exitosa: ${count} tableros restaurados íntegramente para ${selectedClientId} / ${selectedYear}.`);
            setStep("complete");
            onImportComplete?.();
        } catch (err: any) {
            setErrors([`Error en la restauración: ${err.message}`]);
            setStep("json-preview");
        } finally {
            setBusy(false);
        }
    };

    const validateAndPreview = () => {
        const { parsed, errs } = parseRowsInternal(mapping, rawData);
        if (errs.length > 0) {
            setErrors(errs);
        } else {
            setParsedRows(parsed);
            setErrors([]);
            setStep("preview");
        }
    };

    const executeImport = async () => {
        setBusy(true);
        setStep("importing");
        setErrors([]);

        try {
            let updatedCount = 0;
            const updatesByDashboard = new Map<number, DashboardItem[]>();

            // Agrupar actualizaciones por tablero
            for (const parsed of parsedRows) {
                const dashboard = dashboardByNumber.get(parsed.dashboardNum);
                if (!dashboard) continue;

                if (!updatesByDashboard.has(dashboard.id as number)) {
                    // 🛡️ REFUERZO: Cargar los items directamente de Firestore para asegurar que no están vacíos
                    const freshItems = await firebaseService.getDashboardItems(dashboard.id);
                    updatesByDashboard.set(dashboard.id as number, freshItems.length > 0 ? freshItems : [...dashboard.items]);
                }

                const items = updatesByDashboard.get(dashboard.id as number)!;

                // Buscar indicador por número o nombre
                let itemIdx = -1;
                if (parsed.indicatorNum > 0 && parsed.indicatorNum <= items.length) {
                    itemIdx = parsed.indicatorNum - 1;
                } else if (parsed.indicatorName) {
                    itemIdx = items.findIndex(
                        (it) => it.indicator.toLowerCase().includes(parsed.indicatorName!.toLowerCase())
                    );
                }

                if (itemIdx >= 0 && itemIdx < items.length) {
                    items[itemIdx] = {
                        ...items[itemIdx],
                        monthlyGoals: parsed.monthlyGoals.map((g, i) => (g !== null) ? g : (items[itemIdx].monthlyGoals[i] ?? 0)),
                        monthlyProgress: parsed.monthlyProgress.map((p, i) => (p !== null) ? p : (items[itemIdx].monthlyProgress[i] ?? 0)),
                    };
                    updatedCount++;
                }
            }

            // Guardar en Firebase
            for (const [dashId, dashItems] of updatesByDashboard.entries()) {
                await firebaseService.updateDashboardItems(dashId, dashItems);
            }

            setImportResult(
                `✅ Importación exitosa: ${updatedCount} indicadores actualizados en ${updatesByDashboard.size} tableros para ${selectedClientId} / ${selectedYear}`
            );
            setStep("complete");
            onImportComplete?.();
        } catch (err: any) {
            console.error("Import Error:", err);
            setErrors([`Error durante la importación: ${err.message}`]);
            setStep("preview");
        } finally {
            setBusy(false);
        }
    };

    // Componente para seleccionar columna
    const ColumnSelect = ({
        label,
        value,
        onChange,
        required = false,
    }: {
        label: string;
        value: number | null;
        onChange: (val: number | null) => void;
        required?: boolean;
    }) => (
        <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                {label} {required && <span className="text-red-400">*</span>}
            </label>
            <select
                value={value ?? ""}
                onChange={(e) => onChange(e.target.value ? parseInt(e.target.value) : null)}
                className="bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-cyan-500 outline-none"
            >
                <option value="">-- Seleccionar --</option>
                {headers.map((h, idx) => (
                    <option key={idx} value={idx}>
                        Col {idx + 1}: {h || `(vacío)`}
                    </option>
                ))}
            </select>
        </div>
    );

    return (
        <div className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-xl flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-white/10 rounded-[2rem] w-full max-w-5xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/10 bg-gradient-to-r from-cyan-900/20 to-transparent">
                    <div>
                        <h2 className="text-2xl font-black italic uppercase tracking-tighter text-white">
                            Importador Avanzado de Datos
                        </h2>
                        <p className="text-sm text-slate-400 mt-1">
                            Mapea columnas de tu archivo a los 14 tableros estándar
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-3 bg-white/5 hover:bg-white/10 rounded-full transition-all text-slate-400 hover:text-white"
                    >
                        ✕
                    </button>
                </div>

                {/* Progress Steps */}
                <div className="flex items-center gap-2 px-6 py-4 bg-slate-950/50">
                    {["upload", "mapping", "preview", "complete"].map((s, idx) => (
                        <React.Fragment key={s}>
                            <div
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${step === s
                                    ? "bg-cyan-500 text-white"
                                    : idx < ["upload", "mapping", "preview", "complete"].indexOf(step)
                                        ? "bg-green-500/20 text-green-400"
                                        : "bg-white/5 text-slate-500"
                                    }`}
                            >
                                <span className="w-5 h-5 rounded-full bg-current/20 flex items-center justify-center text-[10px]">
                                    {idx + 1}
                                </span>
                                {s === "upload" && "Archivo"}
                                {s === "mapping" && "Mapeo"}
                                {s === "preview" && "Vista Previa"}
                                {s === "complete" && "Listo"}
                            </div>
                            {idx < 3 && <div className="flex-1 h-0.5 bg-white/10" />}
                        </React.Fragment>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {/* Step 1: Upload */}
                    {step === "upload" && (
                        <div className="space-y-6">
                            {/* Client & Year Selectors */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-2 block">
                                        Cliente Destino *
                                    </label>
                                    <select
                                        value={selectedClientId}
                                        onChange={(e) => onClientChange(e.target.value)}
                                        className="w-full bg-slate-950 border-2 border-cyan-500/30 rounded-xl px-4 py-3 text-white font-bold focus:border-cyan-500 outline-none"
                                    >
                                        {availableClients.map((c) => (
                                            <option key={c} value={c}>
                                                {c}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-2 block">
                                        Año Destino *
                                    </label>
                                    <select
                                        value={selectedYear}
                                        onChange={(e) => onYearChange(Number(e.target.value))}
                                        className="w-full bg-slate-950 border-2 border-cyan-500/30 rounded-xl px-4 py-3 text-white font-bold focus:border-cyan-500 outline-none"
                                    >
                                        {[2024, 2025, 2026, 2027].map((y) => (
                                            <option key={y} value={y}>
                                                {y}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Dashboard Status */}
                            <div className="bg-slate-800/50 border border-white/5 rounded-xl p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-sm font-bold text-slate-300">
                                        Tableros disponibles para {selectedClientId} / {selectedYear}:
                                    </span>
                                    <span
                                        className={`px-3 py-1 rounded-full text-xs font-black ${filteredDashboards.length >= 14
                                            ? "bg-green-500/20 text-green-400"
                                            : filteredDashboards.length > 0
                                                ? "bg-yellow-500/20 text-yellow-400"
                                                : "bg-red-500/20 text-red-400"
                                            }`}
                                    >
                                        {filteredDashboards.length} / 14
                                    </span>
                                </div>
                                <div className="grid grid-cols-7 gap-2">
                                    {STANDARD_DASHBOARDS.map((std) => {
                                        const exists = dashboardByNumber.has(std.num);
                                        return (
                                            <div
                                                key={std.num}
                                                className={`p-2 rounded-lg text-center text-[10px] font-bold uppercase ${exists
                                                    ? "bg-green-500/10 text-green-400 border border-green-500/20"
                                                    : "bg-red-500/10 text-red-400 border border-red-500/20"
                                                    }`}
                                                title={std.name}
                                            >
                                                {std.num}. {std.name.split(" ")[0]}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* File Upload */}
                            <div className="border-2 border-dashed border-white/20 rounded-2xl p-8 text-center hover:border-cyan-500/50 transition-all">
                                <div className="text-4xl mb-4 text-cyan-400 drop-shadow-xl">📂</div>
                                <p className="text-lg font-bold text-white mb-2">Sube tu archivo para importar datos</p>
                                <p className="text-sm text-slate-400 mb-4 px-20">Aceptamos archivos <span className="text-green-400 font-bold">.CSV</span> (Actualización masiva) o <span className="text-indigo-400 font-bold">.JSON</span> (Restauración de respaldo completo)</p>
                                <input
                                    type="file"
                                    accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                                    onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                                    className="hidden"
                                    id="file-upload"
                                />
                                <label
                                    htmlFor="file-upload"
                                    className="inline-block px-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-black uppercase tracking-wider rounded-xl cursor-pointer transition-all"
                                >
                                    {busy ? "Procesando..." : "Seleccionar Archivo"}
                                </label>
                            </div>

                            <div className="flex flex-col items-center gap-2">
                                <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">¿No tienes el archivo?</p>
                                <button
                                    onClick={() => exportBulkDataToCSV(dashboards.filter(d => typeof d.id === 'number'), selectedClientId, selectedYear)}
                                    className="text-cyan-400 hover:text-cyan-300 text-xs font-bold underline transition-all"
                                >
                                    Descargar datos actuales para editar en Excel e importar
                                </button>
                            </div>

                            {/* Expected Format */}
                            <div className="bg-slate-800/30 border border-white/5 rounded-xl p-4">
                                <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">
                                    Formato Esperado del Archivo:
                                </h4>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="text-left text-slate-500">
                                                <th className="px-2 py-1 border-b border-white/5">No. Tablero</th>
                                                <th className="px-2 py-1 border-b border-white/5">No. Indicador</th>
                                                <th className="px-2 py-1 border-b border-white/5">Meta Ene</th>
                                                <th className="px-2 py-1 border-b border-white/5">...</th>
                                                <th className="px-2 py-1 border-b border-white/5">Meta Dic</th>
                                                <th className="px-2 py-1 border-b border-white/5">Prog Ene</th>
                                                <th className="px-2 py-1 border-b border-white/5">...</th>
                                                <th className="px-2 py-1 border-b border-white/5">Prog Dic</th>
                                            </tr>
                                        </thead>
                                        <tbody className="text-slate-300">
                                            <tr>
                                                <td className="px-2 py-1">1</td>
                                                <td className="px-2 py-1">1</td>
                                                <td className="px-2 py-1">100</td>
                                                <td className="px-2 py-1">...</td>
                                                <td className="px-2 py-1">100</td>
                                                <td className="px-2 py-1">95</td>
                                                <td className="px-2 py-1">...</td>
                                                <td className="px-2 py-1">102</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Mapping */}
                    {step === "mapping" && (
                        <div className="space-y-6">
                            <div className="bg-slate-800/50 border border-white/10 rounded-xl p-4 mb-4">
                                <p className="text-sm text-slate-300">
                                    <strong className="text-cyan-400">Archivo:</strong> {file?.name} •{" "}
                                    <strong className="text-cyan-400">{rawData.length}</strong> filas de datos •{" "}
                                    <strong className="text-cyan-400">{headers.length}</strong> columnas
                                </p>
                            </div>

                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                <div className="hidden">
                                    <ColumnSelect
                                        label="Número de Tablero (1-14)"
                                        value={mapping.dashboardNum}
                                        onChange={(val) => setMapping({ ...mapping, dashboardNum: val })}
                                        required
                                    />
                                    <ColumnSelect
                                        label="Número de Indicador"
                                        value={mapping.indicatorNum}
                                        onChange={(val) => setMapping({ ...mapping, indicatorNum: val })}
                                    />
                                </div>
                                <ColumnSelect
                                    label="Nombre de Indicador"
                                    value={mapping.indicatorName}
                                    onChange={(val) => setMapping({ ...mapping, indicatorName: val })}
                                />
                                <ColumnSelect
                                    label="1era Columna Metas (ENE)"
                                    value={mapping.goalStart}
                                    onChange={(val) => setMapping({ ...mapping, goalStart: val })}
                                />
                                <ColumnSelect
                                    label="1era Columna Avance (ENE)"
                                    value={mapping.progressStart}
                                    onChange={(val) => setMapping({ ...mapping, progressStart: val })}
                                />
                            </div>

                            {/* Preview of first rows */}
                            <div className="bg-slate-950 border border-white/10 rounded-xl overflow-hidden">
                                <div className="px-4 py-2 bg-white/5 text-xs font-bold text-slate-400 uppercase tracking-wider">
                                    Vista previa de datos (primeras 5 filas)
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="text-left text-slate-500 bg-white/5">
                                                {headers.map((h, idx) => (
                                                    <th
                                                        key={idx}
                                                        className={`px-3 py-2 whitespace-nowrap ${idx === mapping.dashboardNum
                                                            ? "bg-cyan-500/20 text-cyan-300"
                                                            : idx === mapping.indicatorNum || idx === mapping.indicatorName
                                                                ? "bg-purple-500/20 text-purple-300"
                                                                : idx === mapping.goalStart
                                                                    ? "bg-green-500/20 text-green-300"
                                                                    : idx === mapping.progressStart
                                                                        ? "bg-amber-500/20 text-amber-300"
                                                                        : ""
                                                            }`}
                                                    >
                                                        {h || `Col ${idx + 1}`}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {rawData.slice(0, 5).map((row, rIdx) => (
                                                <tr key={rIdx} className="border-t border-white/5">
                                                    {row.map((cell, cIdx) => (
                                                        <td
                                                            key={cIdx}
                                                            className={`px-3 py-2 text-slate-300 whitespace-nowrap ${cIdx === mapping.dashboardNum
                                                                ? "bg-cyan-500/10"
                                                                : cIdx === mapping.indicatorNum || cIdx === mapping.indicatorName
                                                                    ? "bg-purple-500/10"
                                                                    : cIdx === mapping.goalStart
                                                                        ? "bg-green-500/10"
                                                                        : cIdx === mapping.progressStart
                                                                            ? "bg-amber-500/10"
                                                                            : ""
                                                                }`}
                                                        >
                                                            {cell || "-"}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {errors.length > 0 && (
                                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                                    <h4 className="text-sm font-bold text-red-400 mb-2">Errores de validación:</h4>
                                    <ul className="text-xs text-red-300 space-y-1">
                                        {errors.map((e, i) => (
                                            <li key={i}>• {e}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            <div className="flex gap-4">
                                <button
                                    onClick={() => setStep("upload")}
                                    className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl transition-all"
                                >
                                    ← Volver
                                </button>
                                <button
                                    onClick={validateAndPreview}
                                    className="flex-1 px-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-black uppercase tracking-wider rounded-xl transition-all"
                                >
                                    Validar y Previsualizar →
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step: JSON Preview */}
                    {step === "json-preview" && jsonBackupData && (
                        <div className="space-y-6 animate-in fade-in zoom-in duration-300">
                            <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-6 flex items-center gap-6">
                                <div className="text-4xl">📦</div>
                                <div>
                                    <h4 className="text-lg font-bold text-white mb-1">Respaldo JSON Detectado</h4>
                                    <p className="text-sm text-slate-400">Este archivo contiene la estructura completa (tableros e indicadores) de un respaldo previo.</p>
                                </div>
                            </div>

                            <div className="bg-slate-800/40 border border-white/5 rounded-2xl p-6">
                                <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4">Resumen del Contenido:</p>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="bg-black/20 p-4 rounded-xl">
                                        <div className="text-2xl font-black text-indigo-400">{jsonBackupData.length}</div>
                                        <div className="text-[9px] uppercase font-bold text-slate-500">Tableros Totales</div>
                                    </div>
                                    <div className="bg-black/20 p-4 rounded-xl">
                                        <div className="text-2xl font-black text-indigo-400">
                                            {jsonBackupData.reduce((acc, d) => acc + (d.items?.length || 0), 0)}
                                        </div>
                                        <div className="text-[9px] uppercase font-bold text-slate-500">KPIs Totales</div>
                                    </div>
                                    <div className="bg-black/20 p-4 rounded-xl col-span-2">
                                        <div className="text-sm font-bold text-white mb-1">Destino de Restauración:</div>
                                        <div className="text-[10px] text-cyan-400 font-black uppercase">{selectedClientId} / {selectedYear}</div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-6">
                                <p className="text-xs text-amber-200/80 leading-relaxed italic">
                                    ⚠️ <strong>IMPORTANTE:</strong> Al restaurar desde JSON, se sobrescribirán los tableros que tengan el mismo ID. Se recomienda descargar un respaldo del estado actual antes de proceder.
                                </p>
                            </div>

                            <div className="flex gap-4 pt-4">
                                <button
                                    onClick={() => setStep("upload")}
                                    className="px-8 py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-2xl transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={executeJsonRestore}
                                    disabled={busy}
                                    className="flex-1 px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-indigo-900/40 transition-all border border-indigo-500/30"
                                >
                                    {busy ? "Restaurando..." : "Confirmar Restauración Total"}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step 4: Importing */}
                    {step === "preview" && (
                        <div className="space-y-6">
                            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
                                <p className="text-green-400 font-bold">
                                    ✅ Validación exitosa: {parsedRows.length} registros listos para importar
                                </p>
                            </div>

                            {/* Summary by dashboard */}
                            <div className="grid grid-cols-7 gap-2">
                                {STANDARD_DASHBOARDS.map((std) => {
                                    const count = parsedRows.filter((r) => r.dashboardNum === std.num).length;
                                    return (
                                        <div
                                            key={std.num}
                                            className={`p-3 rounded-xl text-center ${count > 0
                                                ? "bg-cyan-500/10 border border-cyan-500/20"
                                                : "bg-slate-800/50 border border-white/5"
                                                }`}
                                        >
                                            <div className="text-lg font-black text-white">{count}</div>
                                            <div className="text-[9px] text-slate-400 uppercase">{std.name}</div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Data preview table */}
                            <div className="bg-slate-950 border border-white/10 rounded-xl overflow-hidden max-h-96 overflow-y-auto">
                                <table className="w-full text-xs">
                                    <thead className="sticky top-0 bg-slate-900">
                                        <tr className="text-left text-slate-400">
                                            <th className="px-3 py-2">Tablero</th>
                                            <th className="px-3 py-2">Indicador</th>
                                            <th className="px-3 py-2">Metas</th>
                                            <th className="px-3 py-2">Progreso</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {parsedRows.slice(0, 50).map((row, idx) => (
                                            <tr key={idx} className="border-t border-white/5">
                                                <td className="px-3 py-2 text-cyan-400 font-bold">
                                                    {row.dashboardNum}. {STANDARD_DASHBOARDS[row.dashboardNum - 1]?.name}
                                                </td>
                                                <td className="px-3 py-2 text-white">
                                                    #{row.indicatorNum} {row.indicatorName && `- ${row.indicatorName}`}
                                                </td>
                                                <td className="px-3 py-2 text-green-400">
                                                    {row.monthlyGoals.filter((g) => g > 0).length} meses con datos
                                                </td>
                                                <td className="px-3 py-2 text-amber-400">
                                                    {row.monthlyProgress.filter((p) => p > 0).length} meses con datos
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {parsedRows.length > 50 && (
                                    <div className="p-3 bg-slate-800 text-center text-xs text-slate-400">
                                        ... y {parsedRows.length - 50} registros más
                                    </div>
                                )}
                            </div>

                            {errors.length > 0 && (
                                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                                    <ul className="text-xs text-red-300 space-y-1">
                                        {errors.map((e, i) => (
                                            <li key={i}>• {e}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            <div className="flex gap-4">
                                <button
                                    onClick={() => setStep("mapping")}
                                    className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl transition-all"
                                >
                                    ← Volver a Mapeo
                                </button>
                                <button
                                    onClick={executeImport}
                                    disabled={busy}
                                    className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-black uppercase tracking-wider rounded-xl transition-all"
                                >
                                    {busy ? "Importando..." : `🚀 Importar ${parsedRows.length} Registros`}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step 4: Importing */}
                    {step === "importing" && (
                        <div className="flex flex-col items-center justify-center py-16">
                            <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mb-6"></div>
                            <p className="text-xl font-bold text-white">Importando datos...</p>
                            <p className="text-sm text-slate-400 mt-2">Por favor espera, esto puede tomar unos segundos.</p>
                        </div>
                    )}

                    {/* Step 5: Complete */}
                    {step === "complete" && (
                        <div className="flex flex-col items-center justify-center py-16">
                            <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mb-6">
                                <span className="text-4xl">✅</span>
                            </div>
                            <h3 className="text-2xl font-black text-white mb-4">¡Importación Completada!</h3>
                            <p className="text-lg text-green-400 mb-8">{importResult}</p>
                            <button
                                onClick={onClose}
                                className="px-8 py-4 bg-cyan-600 hover:bg-cyan-500 text-white font-black uppercase tracking-wider rounded-xl transition-all"
                            >
                                Cerrar
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
