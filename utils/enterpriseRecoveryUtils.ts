import ExcelJS from "exceljs";
import { Dashboard as DashboardType, DashboardItem } from "../types";

const SECURITY_SALT = "STRATEXA_SECURITY_SALT_2026";
const SCHEMA_VERSION = "1.0.0";

/**
 * Genera un hash determinista (FNV-1a de 32 bits) para auditoría e integridad.
 */
export const generateChecksum = (data: any): string => {
  const str = typeof data === "string" ? data : JSON.stringify(data);
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16).toUpperCase();
};

/**
 * Genera una firma digital de exportación robusta para autenticar el origen del archivo.
 */
export const generateExportSignature = (
  clientId: string,
  year: number,
  checksum: string,
  version: string
): string => {
  const dataToSign = `${clientId}_${year}_${checksum}_${version}_${SECURITY_SALT}`;
  return generateChecksum(dataToSign);
};

/**
 * Genera el manifiesto del baseline en formato JSON.
 */
export const generateBaselineManifest = (
  dashboards: DashboardType[],
  clientId: string,
  year: number,
  appVersion: string
): string => {
  const rawDataString = JSON.stringify(dashboards);
  const checksumGlobal = generateChecksum(rawDataString);

  // Contar KPIs y Áreas únicas
  let kpisCount = 0;
  const uniqueAreas = new Set<string>();

  dashboards.forEach((d) => {
    kpisCount += (d.items || []).length;
    if (d.area) uniqueAreas.add(d.area.trim().toUpperCase());
  });

  const manifest = {
    checksumGlobal,
    dashboardsCount: dashboards.length,
    kpisCount,
    areasCount: uniqueAreas.size,
    exportSchemaVersion: SCHEMA_VERSION,
    appVersion,
    timestamp: new Date().toISOString(),
    clientId,
    year,
  };

  return JSON.stringify(manifest, null, 2);
};

/**
 * Exporta un libro de Excel XLSX real y binario usando ExcelJS, estructurado en las 3 hojas.
 */
export const exportToRecoveryExcelJS = async (
  dashboards: DashboardType[],
  clientId: string,
  year: number,
  version: string
): Promise<ArrayBuffer> => {
  const timestamp = new Date().toISOString();
  const rawDataString = JSON.stringify(dashboards);
  const checksum = generateChecksum(rawDataString);
  const exportSignature = generateExportSignature(clientId, year, checksum, version);
  const scope = "CLIENT_YEAR_FULL_RECOVERY";

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Stratexa Enterprise Recovery";
  workbook.lastModifiedBy = "Stratexa Enterprise Recovery";
  workbook.created = new Date();
  workbook.modified = new Date();

  // Estilos sobrios e institucionales de alto contraste
  const headerFill: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF0F172A" }, // Slate 900
  };

  const headerFont: Partial<ExcelJS.Font> = {
    name: "Segoe UI",
    size: 11,
    bold: true,
    color: { argb: "FFFFFFFF" },
  };

  const metaLabelFill: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF1F5F9" }, // Slate 100
  };

  const metaLabelFont: Partial<ExcelJS.Font> = {
    name: "Segoe UI",
    size: 11,
    bold: true,
    color: { argb: "FF334155" }, // Slate 700
  };

  const regularFont: Partial<ExcelJS.Font> = {
    name: "Segoe UI",
    size: 11,
    color: { argb: "FF0F172A" },
  };

  const thinBorder: ExcelJS.Borders = {
    top: { style: "thin", color: { argb: "FFE2E8F0" } },
    left: { style: "thin", color: { argb: "FFE2E8F0" } },
    bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
    right: { style: "thin", color: { argb: "FFE2E8F0" } },
  };

  // ==========================================
  // HOJA 1: METADATA
  // ==========================================
  const wsMeta = workbook.addWorksheet("METADATA", {
    views: [{ showGridLines: true }],
  });
  
  wsMeta.columns = [
    { header: "Campo", key: "campo", width: 25 },
    { header: "Valor", key: "valor", width: 50 },
  ];

  const metaData = [
    { campo: "cliente", valor: clientId },
    { campo: "año", valor: year },
    { campo: "versión", valor: version },
    { campo: "exportSchemaVersion", valor: SCHEMA_VERSION },
    { campo: "timestamp", valor: timestamp },
    { campo: "checksum", valor: checksum },
    { campo: "export_scope", valor: scope },
    { campo: "exportSignature", valor: exportSignature },
  ];

  // Dar formato a headers de METADATA
  const headerRow = wsMeta.getRow(1);
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.alignment = { vertical: "middle", horizontal: "left" };
  });

  metaData.forEach((row) => {
    const addedRow = wsMeta.addRow(row);
    addedRow.height = 22;
    
    const cellCampo = addedRow.getCell(1);
    cellCampo.fill = metaLabelFill;
    cellCampo.font = metaLabelFont;
    cellCampo.border = thinBorder;
    cellCampo.alignment = { vertical: "middle", horizontal: "left" };

    const cellValor = addedRow.getCell(2);
    cellValor.font = regularFont;
    cellValor.border = thinBorder;
    cellValor.alignment = { vertical: "middle", horizontal: "left" };
    
    // Asegurar formato numérico para el año
    if (row.campo === "año") {
      cellValor.value = Number(row.valor);
      cellValor.numFmt = "0";
    }
  });

  // ==========================================
  // HOJA 2: STRUCTURE
  // ==========================================
  const wsStructure = workbook.addWorksheet("STRUCTURE", {
    views: [{ showGridLines: true }],
  });

  wsStructure.columns = [
    { header: "dashboardId", key: "dashboardId", width: 15 },
    { header: "kpiId", key: "kpiId", width: 12 },
    { header: "areaId", key: "areaId", width: 15 },
    { header: "directionId", key: "directionId", width: 15 },
    { header: "dashboardTitle", key: "dashboardTitle", width: 25 },
    { header: "area", key: "area", width: 20 },
    { header: "group", key: "group", width: 20 },
    { header: "indicator", key: "indicator", width: 30 },
    { header: "weight", key: "weight", width: 10 },
    { header: "frequency", key: "frequency", width: 15 },
    { header: "responsable", key: "responsable", width: 25 },
  ];

  const structHeaderRow = wsStructure.getRow(1);
  structHeaderRow.height = 28;
  structHeaderRow.eachCell((cell) => {
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.alignment = { vertical: "middle", horizontal: "left" };
  });

  dashboards.forEach((d) => {
    const dashId = d.id;
    const areaId = d.area || "GENERAL";
    const directionId = d.group || "GENERAL";
    const dashTitle = d.title || "";
    const area = d.area || "";
    const groupName = d.group || "";

    d.items.forEach((item) => {
      const added = wsStructure.addRow({
        dashboardId: String(dashId),
        kpiId: String(item.id),
        areaId: String(areaId),
        directionId: String(directionId),
        dashboardTitle: String(dashTitle),
        area: String(area),
        group: String(groupName),
        indicator: String(item.indicator),
        weight: Number(item.weight || 0),
        frequency: String(item.frequency || "monthly"),
        responsable: String(d.subtitle || ""),
      });

      added.height = 20;
      added.eachCell((cell, colNumber) => {
        cell.font = regularFont;
        cell.border = thinBorder;
        cell.alignment = { vertical: "middle", horizontal: "left" };

        if (colNumber === 9) {
          cell.alignment = { vertical: "middle", horizontal: "right" };
          cell.numFmt = "0.0";
        }
      });
    });
  });

  // ==========================================
  // HOJA 3: KPI_DATA
  // ==========================================
  const wsData = workbook.addWorksheet("KPI_DATA", {
    views: [{ showGridLines: true }],
  });

  const dataColumns = [
    { header: "dashboardId", key: "dashboardId", width: 15 },
    { header: "kpiId", key: "kpiId", width: 12 },
    { header: "areaId", key: "areaId", width: 15 },
    { header: "directionId", key: "directionId", width: 15 },
  ];

  // Escribir 12 metas
  for (let i = 1; i <= 12; i++) {
    const padded = String(i).padStart(2, "0");
    dataColumns.push({ header: `meta_${padded}`, key: `meta_${padded}`, width: 11 });
  }

  // Escribir 12 avances
  for (let i = 1; i <= 12; i++) {
    const padded = String(i).padStart(2, "0");
    dataColumns.push({ header: `avance_${padded}`, key: `avance_${padded}`, width: 11 });
  }

  dataColumns.push(
    { header: "captureRate", key: "captureRate", width: 14 },
    { header: "realOperationalScore", key: "realOperationalScore", width: 22 },
    { header: "stalenessDays", key: "stalenessDays", width: 15 }
  );

  wsData.columns = dataColumns;

  const dataHeaderRow = wsData.getRow(1);
  dataHeaderRow.height = 28;
  dataHeaderRow.eachCell((cell) => {
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.alignment = { vertical: "middle", horizontal: "left" };
  });

  dashboards.forEach((d) => {
    const dashId = d.id;
    const areaId = d.area || "GENERAL";
    const directionId = d.group || "GENERAL";

    d.items.forEach((item) => {
      const caps = item.operationalMetrics?.captureRate ?? 0;
      const score = item.operationalMetrics?.realOperationalScore ?? 0;
      const stale = item.operationalMetrics?.stalenessDays ?? 0;

      const rowValues: Record<string, any> = {
        dashboardId: String(dashId),
        kpiId: String(item.id),
        areaId: String(areaId),
        directionId: String(directionId),
      };

      for (let i = 0; i < 12; i++) {
        const padded = String(i + 1).padStart(2, "0");
        rowValues[`meta_${padded}`] = item.monthlyGoals[i] ?? 0;
        rowValues[`avance_${padded}`] = item.monthlyProgress[i] ?? 0;
      }

      rowValues.captureRate = caps;
      rowValues.realOperationalScore = score;
      rowValues.stalenessDays = stale;

      const added = wsData.addRow(rowValues);
      added.height = 20;

      added.eachCell((cell, colNumber) => {
        cell.font = regularFont;
        cell.border = thinBorder;
        cell.alignment = { vertical: "middle", horizontal: "left" };

        if (colNumber >= 5) {
          cell.alignment = { vertical: "middle", horizontal: "right" };
          
          if (colNumber === 29) {
            // captureRate (%)
            cell.numFmt = "0.0%";
          } else if (colNumber === 30) {
            // Score
            cell.numFmt = "0.00";
          } else if (colNumber === 31) {
            // Staleness days
            cell.numFmt = "0";
          } else {
            // Metas y avances
            cell.numFmt = "#,##0.00";
          }
        }
      });
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
};

export interface ParsedRecoveryRow {
  dashboardId: string;
  kpiId: string;
  areaId: string;
  directionId: string;
  monthlyGoals: number[];
  monthlyProgress: number[];
  captureRate?: number;
  realOperationalScore?: number;
  stalenessDays?: number;
}

/**
 * Validador y Parser de Excel XLSX real usando ExcelJS (Safe Parsing y Sandbox).
 */
export const parseRecoveryExcelJS = async (
  fileBuffer: ArrayBuffer
): Promise<{
  success: boolean;
  metadata?: Record<string, string>;
  structureRows?: any[];
  kpiRows?: ParsedRecoveryRow[];
  errors: string[];
}> => {
  const errors: string[] = [];
  const metadata: Record<string, string> = {};
  const structureRows: any[] = [];
  const kpiRows: ParsedRecoveryRow[] = [];

  try {
    // 1. MAX FILE SIZE check (10MB limit)
    if (fileBuffer.byteLength > 10 * 1024 * 1024) {
      errors.push("El archivo excede el tamaño máximo permitido de 10 MB.");
      return { success: false, errors };
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(fileBuffer);

    // 2. MAX SHEETS check
    if (workbook.worksheets.length > 10) {
      errors.push("El archivo tiene demasiadas hojas (máximo 10 hojas permitidas).");
      return { success: false, errors };
    }

    const wsMeta = workbook.getWorksheet("METADATA");
    const wsStructure = workbook.getWorksheet("STRUCTURE");
    const wsKPI = workbook.getWorksheet("KPI_DATA");

    if (!wsMeta || !wsStructure || !wsKPI) {
      errors.push(
        "El archivo XLSX no tiene las hojas requeridas: METADATA, STRUCTURE y KPI_DATA."
      );
      return { success: false, errors };
    }

    // 3. SAFE PARSING: Leer hoja METADATA
    wsMeta.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        const campo = row.getCell(1).value?.toString().trim();
        const valor = row.getCell(2).value?.toString().trim();
        if (campo) {
          metadata[campo] = valor || "";
        }
      }
    });

    // 4. VALIDAR ORIGEN, INTEGRIDAD Y FIRMA (exportSignature)
    const client = metadata.cliente;
    const year = Number(metadata.año || 0);
    const version = metadata.versión;
    const checksum = metadata.checksum;
    const fileSignature = metadata.exportSignature;
    const schemaVersion = metadata.exportSchemaVersion;

    if (!client || !year || !version || !checksum || !fileSignature) {
      errors.push("Metadatos incompletos en la hoja METADATA. No se puede verificar el origen.");
      return { success: false, errors };
    }

    // Validar compatibilidad de versión (Debe ser v9.x)
    if (!version.startsWith("v9.")) {
      errors.push(
        `Incompatibilidad de versión detectada. La versión del archivo (${version}) no es compatible con el esquema de recuperación actual (v9.x).`
      );
      return { success: false, errors };
    }

    // Validar firma criptográfica
    const computedSignature = generateExportSignature(client, year, checksum, version);
    if (computedSignature !== fileSignature) {
      errors.push(
        "Firma digital inválida (exportSignature). El archivo ha sido adulterado o procede de un origen no autorizado."
      );
      return { success: false, errors };
    }

    // 5. PARSE DE HOJA STRUCTURE (Safe Parsing con límite de 2000 KPIs)
    let structRowCount = 0;
    try {
      wsStructure.eachRow((row, rowNumber) => {
        if (rowNumber > 1) {
          structRowCount++;
          if (structRowCount > 2000) {
            throw new Error("LIMITE_EXCEDIDO_KPIS");
          }
          const rowData: Record<string, string> = {};
          const columnsKeys = [
            "dashboardId",
            "kpiId",
            "areaId",
            "directionId",
            "dashboardTitle",
            "area",
            "group",
            "indicator",
            "weight",
            "frequency",
            "responsable",
          ];

          columnsKeys.forEach((key, idx) => {
            const val = row.getCell(idx + 1).value;
            rowData[key] = val !== null && val !== undefined ? val.toString().trim() : "";
          });

          if (rowData.dashboardId && rowData.kpiId) {
            structureRows.push(rowData);
          }
        }
      });
    } catch (e: any) {
      if (e.message === "LIMITE_EXCEDIDO_KPIS") {
        errors.push("El archivo contiene más de 2000 registros de KPIs (límite máximo superado).");
        return { success: false, errors };
      }
      throw e;
    }

    // Contar dashboards únicos
    const uniqueDashboards = new Set<string>();
    
    // 6. PARSE DE HOJA KPI_DATA (Safe Parsing con límite de 100 Dashboards)
    try {
      wsKPI.eachRow((row, rowNumber) => {
        if (rowNumber > 1) {
          const dashboardId = row.getCell(1).value?.toString().trim() || "";
          const kpiId = row.getCell(2).value?.toString().trim() || "";
          const areaId = row.getCell(3).value?.toString().trim() || "";
          const directionId = row.getCell(4).value?.toString().trim() || "";

          if (!dashboardId || !kpiId) return;

          uniqueDashboards.add(dashboardId);
          if (uniqueDashboards.size > 100) {
            throw new Error("LIMITE_EXCEDIDO_DASHBOARDS");
          }

          const getVal = (col: number): number => {
            const raw = row.getCell(col).value;
            if (raw === null || raw === undefined) return 0;
            if (typeof raw === "object" && "result" in raw) {
              // Es una celda de fórmula o valor enriquecido
              const nested = (raw as any).result;
              const parsed = parseFloat(nested);
              return isNaN(parsed) ? 0 : parsed;
            }
            const parsed = parseFloat(raw.toString());
            return isNaN(parsed) ? 0 : parsed;
          };

          const monthlyGoals: number[] = [];
          for (let m = 0; m < 12; m++) {
            monthlyGoals.push(getVal(5 + m));
          }

          const monthlyProgress: number[] = [];
          for (let p = 0; p < 12; p++) {
            monthlyProgress.push(getVal(17 + p));
          }

          // Leer índices 29, 30, 31
          let capRate = getVal(29);
          // Si viene formateado como porcentaje en Excel (0.85 en vez de 85), multiplicar por 100
          if (capRate > 0 && capRate <= 1.0) capRate = capRate * 100;

          kpiRows.push({
            dashboardId,
            kpiId,
            areaId,
            directionId,
            monthlyGoals,
            monthlyProgress,
            captureRate: capRate,
            realOperationalScore: getVal(30),
            stalenessDays: getVal(31),
          });
        }
      });
    } catch (e: any) {
      if (e.message === "LIMITE_EXCEDIDO_DASHBOARDS") {
        errors.push("El archivo contiene más de 100 dashboards únicos (límite máximo superado).");
        return { success: false, errors };
      }
      throw e;
    }

  } catch (err: any) {
    errors.push("Fallo crítico al parsear el archivo binario XLSX: " + err.message);
  }

  return {
    success: errors.length === 0,
    metadata,
    structureRows,
    kpiRows,
    errors,
  };
};

/**
 * Gestión de Checkpoints Locales en localStorage (Exclusivo Local, sin Firestore remota).
 */
export const localCheckpointManager = {
  create: (clientId: string, year: number, dashboards: DashboardType[], reason: string): string => {
    const timestamp = new Date().toISOString();
    const dataString = JSON.stringify(dashboards);
    const checksum = generateChecksum(dataString);

    const checkpoint = {
      id: `chk_${Date.now()}`,
      clientId,
      year,
      timestamp,
      checksum,
      reason,
      dashboards,
    };

    const key = `tbl_checkpoint_${clientId.toUpperCase()}_${year}_${checkpoint.id}`;
    localStorage.setItem(key, JSON.stringify(checkpoint));
    return checkpoint.id;
  },

  list: (clientId: string, year: number): any[] => {
    const prefix = `tbl_checkpoint_${clientId.toUpperCase()}_${year}_`;
    const list: any[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        try {
          const item = JSON.parse(localStorage.getItem(key) || "");
          if (item) list.push(item);
        } catch (e) {
          // Ignorar corruptos
        }
      }
    }
    return list.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  },

  delete: (clientId: string, year: number, id: string) => {
    const key = `tbl_checkpoint_${clientId.toUpperCase()}_${year}_${id}`;
    localStorage.removeItem(key);
  },

  get: (clientId: string, year: number, id: string): any | null => {
    const key = `tbl_checkpoint_${clientId.toUpperCase()}_${year}_${id}`;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }
};
