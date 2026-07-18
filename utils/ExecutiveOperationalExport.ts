import ExcelJS from "exceljs";
import { Dashboard as DashboardType, DashboardItem, User, GlobalUserRole } from "../types";

/**
 * Genera y descarga un reporte de Excel operativo ejecutivo sumamente pulido, corporativo e imprimible.
 * Este reporte está orientado a directores, responsables de área y administradores (human-friendly).
 * Aplica filtros de seguridad física en base al perfil de usuario para no exponer información fuera de scope.
 */
export const exportToExecutiveExcelJS = async (
  allDashboards: DashboardType[],
  userProfile: User | null,
  clientId: string,
  year: number
): Promise<ArrayBuffer> => {
  const isGlobalAdmin = userProfile?.globalRole === GlobalUserRole.Admin;
  const isDirector = userProfile?.globalRole === GlobalUserRole.Director;

  // 1. Filtrado Estricto de Seguridad en Base a Permisos
  let filteredDashboards = [...allDashboards];

  if (!isGlobalAdmin) {
    if (isDirector) {
      // El Director ve los grupos (Direcciones) asignados en sus subGroups / superGroups o propiedad group
      const allowedGroups = new Set<string>();
      if (userProfile?.group) allowedGroups.add(userProfile.group.trim().toUpperCase());
      if (userProfile?.subGroups) {
        userProfile.subGroups.forEach(g => allowedGroups.add(g.trim().toUpperCase()));
      }
      if (userProfile?.superGroups) {
        userProfile.superGroups.forEach(g => allowedGroups.add(g.trim().toUpperCase()));
      }

      filteredDashboards = allDashboards.filter(d => {
        const dGroup = (d.group || "").trim().toUpperCase();
        return allowedGroups.has(dGroup);
      });
    } else {
      // Un miembro común solo puede exportar los tableros a los que tiene acceso explícito
      const accessibleIds = new Set<string>(Object.keys(userProfile?.dashboardAccess || {}));
      
      filteredDashboards = allDashboards.filter(d => {
        // También filtramos por su área / grupo si estuviera definido
        const isIdAccessible = accessibleIds.has(String(d.id));
        const isAreaMatching = userProfile?.group && d.area && d.area.trim().toUpperCase() === userProfile.group.trim().toUpperCase();
        return isIdAccessible || isAreaMatching;
      });
    }
  }

  // 2. Crear Libro de ExcelJS
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Stratexa Executive Reporting Engine";
  workbook.lastModifiedBy = "Stratexa Executive Reporting Engine";
  workbook.created = new Date();
  workbook.modified = new Date();

  // 3. Estilos Corporativos - Paleta Azul Marino Intenso (Sleek Navy)
  const corporateBlueFill: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1E3A8A" }, // Navy Blue (Blue 900)
  };

  const alertHeaderFill: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF991B1B" }, // Red 800
  };

  const titleFont: Partial<ExcelJS.Font> = {
    name: "Segoe UI",
    size: 16,
    bold: true,
    color: { argb: "FFFFFFFF" },
  };

  const headerFont: Partial<ExcelJS.Font> = {
    name: "Segoe UI",
    size: 11,
    bold: true,
    color: { argb: "FFFFFFFF" },
  };

  const sectionFont: Partial<ExcelJS.Font> = {
    name: "Segoe UI",
    size: 12,
    bold: true,
    color: { argb: "FF1E3A8A" },
  };

  const regularFont: Partial<ExcelJS.Font> = {
    name: "Segoe UI",
    size: 11,
    color: { argb: "FF1E293B" }, // Slate 800
  };

  const boldFont: Partial<ExcelJS.Font> = {
    name: "Segoe UI",
    size: 11,
    bold: true,
    color: { argb: "FF0F172A" },
  };

  const thinBorder: ExcelJS.Borders = {
    top: { style: "thin", color: { argb: "FFE2E8F0" } },
    left: { style: "thin", color: { argb: "FFE2E8F0" } },
    bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
    right: { style: "thin", color: { argb: "FFE2E8F0" } },
  };

  const doubleBottomBorder: ExcelJS.Borders = {
    top: { style: "thin", color: { argb: "FFE2E8F0" } },
    left: { style: "thin", color: { argb: "FFE2E8F0" } },
    bottom: { style: "double", color: { argb: "FF1E3A8A" } },
    right: { style: "thin", color: { argb: "FFE2E8F0" } },
  };

  // Colores de cumplimiento para celdas
  const fillGreen: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCFCE7" } }; // Green 100
  const fillAmber: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FEF3C7" } }; // Amber 100
  const fillRed: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FEE2E2" } }; // Red 100

  const fontGreen: Partial<ExcelJS.Font> = { name: "Segoe UI", size: 11, bold: true, color: { argb: "FF15803D" } };
  const fontAmber: Partial<ExcelJS.Font> = { name: "Segoe UI", size: 11, bold: true, color: { argb: "FFB45309" } };
  const fontRed: Partial<ExcelJS.Font> = { name: "Segoe UI", size: 11, bold: true, color: { argb: "FFB91C1C" } };

  // =========================================================================
  // HOJA 1: RESUMEN EJECUTIVO
  // =========================================================================
  const wsExecutive = workbook.addWorksheet("RESUMEN EJECUTIVO", {
    views: [{ showGridLines: true }],
  });

  // Título
  wsExecutive.mergeCells("A1:G2");
  const titleCell = wsExecutive.getCell("A1");
  titleCell.value = `REPORTE OPERATIVO EJECUTIVO — ${clientId.toUpperCase()} (${year})`;
  titleCell.fill = corporateBlueFill;
  titleCell.font = titleFont;
  titleCell.alignment = { vertical: "middle", horizontal: "center" };

  // Fila de metadatos de impresión
  wsExecutive.getCell("A3").value = "FECHA EXPORTACIÓN:";
  wsExecutive.getCell("A3").font = boldFont;
  wsExecutive.getCell("B3").value = new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString();
  wsExecutive.getCell("B3").font = regularFont;
  wsExecutive.getCell("E3").value = "RESPONSABLE:";
  wsExecutive.getCell("E3").font = boldFont;
  wsExecutive.getCell("F3").value = userProfile?.name || "Usuario del Sistema";
  wsExecutive.getCell("F3").font = regularFont;

  wsExecutive.addRow([]); // Espacio

  // Tabla Principal de Resumen
  wsExecutive.addRow(["RESUMEN DE DESEMPEÑO POR TABLERO"]).font = sectionFont;
  
  const headersExec = [
    "Dirección (Agrupación)",
    "Área Operativa",
    "Tablero de Gestión",
    "Avance Global PAI",
    "Tasa Captura",
    "ROS Promedio",
    "KPIs Críticos"
  ];
  const execRowIndex = 6;
  const execHeaderRow = wsExecutive.getRow(execRowIndex);
  execHeaderRow.values = headersExec;
  execHeaderRow.height = 26;
  execHeaderRow.eachCell((cell) => {
    cell.fill = corporateBlueFill;
    cell.font = headerFont;
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = thinBorder;
  });

  let totalAvance = 0;
  let totalCaptura = 0;
  let totalRos = 0;
  let totalCriticos = 0;
  let validDashboardsCount = 0;

  filteredDashboards.forEach((d) => {
    // Calcular promedios para este dashboard de forma segura
    const items = d.items || [];
    if (items.length === 0) return;

    let sumPerformance = 0;
    let sumCapture = 0;
    let sumRos = 0;
    let countCrit = 0;
    let countMetrics = 0;

    items.forEach((item) => {
      const metrics = item.operationalMetrics;
      if (metrics) {
        sumPerformance += metrics.performanceScore || 0;
        sumCapture += metrics.captureRate || 0;
        sumRos += metrics.realOperationalScore || 0;
        if (metrics.operationalStatus === "OffTrack" || metrics.operationalStatus === "AtRisk" || (metrics.realOperationalScore || 0) < 70) {
          countCrit++;
        }
        countMetrics++;
      }
    });

    const divisor = countMetrics || 1;
    const avgPerf = sumPerformance / divisor;
    const avgCapt = sumCapture / divisor;
    const avgRos = sumRos / divisor;

    totalAvance += avgPerf;
    totalCaptura += avgCapt;
    totalRos += avgRos;
    totalCriticos += countCrit;
    validDashboardsCount++;

    const newRow = wsExecutive.addRow([
      d.group || "Sin Agrupación",
      d.area || "General",
      d.title,
      avgPerf / 100,
      avgCapt / 100,
      avgRos / 100,
      countCrit
    ]);
    
    newRow.height = 22;
    newRow.eachCell((cell, colNumber) => {
      cell.font = regularFont;
      cell.border = thinBorder;

      if (colNumber === 4 || colNumber === 5 || colNumber === 6) {
        cell.numFmt = "0.0%";
        cell.alignment = { horizontal: "right", vertical: "middle" };

        // Coloreado condicional del semáforo
        const valPercent = cell.value as number;
        if (colNumber === 6) { // ROS semáforo
          if (valPercent >= 0.85) {
            cell.fill = fillGreen;
            cell.font = fontGreen;
          } else if (valPercent >= 0.70) {
            cell.fill = fillAmber;
            cell.font = fontAmber;
          } else {
            cell.fill = fillRed;
            cell.font = fontRed;
          }
        }
      } else if (colNumber === 7) {
        cell.alignment = { horizontal: "center", vertical: "middle" };
        if ((cell.value as number) > 0) {
          cell.font = { ...boldFont, color: { argb: "FFB91C1C" } };
          cell.fill = fillRed;
        }
      } else {
        cell.alignment = { horizontal: "left", vertical: "middle" };
      }
    });
  });

  // Fila de Totalizador
  const countDiv = validDashboardsCount || 1;
  const totalRow = wsExecutive.addRow([
    "RESUMEN GENERAL",
    "",
    `${validDashboardsCount} Tablero(s) consolidado(s)`,
    totalAvance / countDiv / 100,
    totalCaptura / countDiv / 100,
    totalRos / countDiv / 100,
    totalCriticos
  ]);
  
  totalRow.height = 24;
  totalRow.eachCell((cell, colNumber) => {
    cell.font = boldFont;
    cell.border = doubleBottomBorder;
    
    if (colNumber === 4 || colNumber === 5 || colNumber === 6) {
      cell.numFmt = "0.0%";
      cell.alignment = { horizontal: "right", vertical: "middle" };
    } else if (colNumber === 7) {
      cell.alignment = { horizontal: "center", vertical: "middle" };
    } else {
      cell.alignment = { horizontal: "left", vertical: "middle" };
    }
  });

  // =========================================================================
  // HOJA 2: KPIs DETALLADOS
  // =========================================================================
  const wsKpis = workbook.addWorksheet("EVALUACIÓN DE INDICADORES", {
    views: [{ showGridLines: true }],
  });

  const headersKpis = [
    "Área / Tablero",
    "Nombre del Indicador (KPI)",
    "Frec.",
    "Peso",
    "Rendimiento PAI",
    "Captura",
    "Real Operational Score (ROS)",
    "Atraso (Días)",
    "Tendencia"
  ];

  wsKpis.addRow(["DESGLOSE OPERATIVO DE KPIs Y CUMPLIMIENTO"]).font = sectionFont;
  wsKpis.addRow([]); // Espacio

  const kpisHeaderRow = wsKpis.getRow(3);
  kpisHeaderRow.values = headersKpis;
  kpisHeaderRow.height = 26;
  kpisHeaderRow.eachCell((cell) => {
    cell.fill = corporateBlueFill;
    cell.font = headerFont;
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = thinBorder;
  });

  filteredDashboards.forEach((d) => {
    const items = d.items || [];
    items.forEach((item) => {
      const metrics = item.operationalMetrics;
      const perf = metrics ? metrics.performanceScore / 100 : 0;
      const capt = metrics ? metrics.captureRate / 100 : 0;
      const ros = metrics ? metrics.realOperationalScore / 100 : 0;
      const delay = metrics ? metrics.stalenessDays : 0;

      // Calcular tendencia visual simple
      let trendSymbol = "● Estable";
      const progressArr = d.periodicity === "weekly" ? (item.weeklyProgress || []) : (item.monthlyProgress || []);
      const validProgress = progressArr.filter(v => v !== null && v !== undefined) as number[];
      if (validProgress.length >= 2) {
        const last = validProgress[validProgress.length - 1];
        const prev = validProgress[validProgress.length - 2];
        if (last > prev) trendSymbol = "▲ Incremento";
        else if (last < prev) trendSymbol = "▼ Descenso";
      }

      const kRow = wsKpis.addRow([
        `${d.area || "General"} — ${d.title}`,
        item.indicator,
        item.frequency === "weekly" ? "Semanal" : "Mensual",
        item.weight / 100,
        perf,
        capt,
        ros,
        delay,
        trendSymbol
      ]);

      kRow.height = 20;
      kRow.eachCell((cell, colIdx) => {
        cell.font = regularFont;
        cell.border = thinBorder;

        if (colIdx === 4 || colIdx === 5 || colIdx === 6 || colIdx === 7) {
          cell.numFmt = "0.0%";
          cell.alignment = { horizontal: "right", vertical: "middle" };
          
          if (colIdx === 7) { // ROS semáforo
            const val = cell.value as number;
            if (val >= 0.85) {
              cell.fill = fillGreen;
              cell.font = fontGreen;
            } else if (val >= 0.70) {
              cell.fill = fillAmber;
              cell.font = fontAmber;
            } else {
              cell.fill = fillRed;
              cell.font = fontRed;
            }
          }
        } else if (colIdx === 8) {
          cell.numFmt = "0";
          cell.alignment = { horizontal: "center", vertical: "middle" };
          if ((cell.value as number) > 7) {
            cell.fill = fillRed;
            cell.font = fontRed;
          }
        } else if (colIdx === 9) {
          cell.alignment = { horizontal: "center", vertical: "middle" };
          if (cell.value?.toString().includes("▲")) {
            cell.font = { ...boldFont, color: { argb: "FF15803D" } };
          } else if (cell.value?.toString().includes("▼")) {
            cell.font = { ...boldFont, color: { argb: "FFB91C1C" } };
          }
        } else {
          cell.alignment = { horizontal: "left", vertical: "middle" };
        }
      });
    });
  });

  // =========================================================================
  // HOJA 3: ALERTAS OPERATIVAS
  // =========================================================================
  const wsAlerts = workbook.addWorksheet("ALERTAS Y DESVÍOS", {
    views: [{ showGridLines: true }],
  });

  const headersAlerts = [
    "Tablero / Área",
    "KPI en Alerta",
    "Tipo de Desviación",
    "Antigüedad (Días)",
    "Criticidad",
    "Notas / Acciones Sugeridas"
  ];

  wsAlerts.addRow(["ALERTA DE DESVIACIONES CRÓNICAS Y ATRASOS DE CAPTURA"]).font = sectionFont;
  wsAlerts.addRow([]); // Espacio

  const alertsHeaderRow = wsAlerts.getRow(3);
  alertsHeaderRow.values = headersAlerts;
  alertsHeaderRow.height = 26;
  alertsHeaderRow.eachCell((cell) => {
    cell.fill = alertHeaderFill;
    cell.font = headerFont;
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = thinBorder;
  });

  let alertCount = 0;

  filteredDashboards.forEach((d) => {
    const items = d.items || [];
    items.forEach((item) => {
      const metrics = item.operationalMetrics;
      if (!metrics) return;

      const isLowRos = metrics.realOperationalScore < 70;
      const isStale = metrics.stalenessDays > 7;

      if (isLowRos || isStale) {
        alertCount++;
        let deviationType = "";
        let criticidad = "Media";
        let suggestions = "";

        if (isLowRos && isStale) {
          deviationType = "Atraso Crítico & Rendimiento Deficiente";
          criticidad = "Alta";
          suggestions = "Fuerce la captura de datos de forma urgente y elabore plan de acción de mejora.";
        } else if (isStale) {
          deviationType = "Atraso de Captura Operativa";
          criticidad = metrics.stalenessDays > 14 ? "Alta" : "Media";
          suggestions = `Registrar datos pendientes. El indicador tiene más de ${metrics.stalenessDays} días sin avance.`;
        } else {
          deviationType = "Desempeño Operativo Bajo (Bajo ROS)";
          criticidad = metrics.realOperationalScore < 50 ? "Alta" : "Media";
          suggestions = "Se requiere revisar la ejecución del indicador. Cumplimiento inferior al 70%.";
        }

        const aRow = wsAlerts.addRow([
          `${d.area || "General"} — ${d.title}`,
          item.indicator,
          deviationType,
          metrics.stalenessDays,
          criticidad,
          suggestions
        ]);

        aRow.height = 22;
        aRow.eachCell((cell, colIdx) => {
          cell.font = regularFont;
          cell.border = thinBorder;

          if (colIdx === 4) {
            cell.numFmt = "0";
            cell.alignment = { horizontal: "center", vertical: "middle" };
          } else if (colIdx === 5) {
            cell.alignment = { horizontal: "center", vertical: "middle" };
            cell.font = boldFont;
            if (cell.value === "Alta") {
              cell.fill = fillRed;
              cell.font = fontRed;
            } else {
              cell.fill = fillAmber;
              cell.font = fontAmber;
            }
          } else {
            cell.alignment = { horizontal: "left", vertical: "middle" };
          }
        });
      }
    });
  });

  if (alertCount === 0) {
    const emptyRow = wsAlerts.addRow(["✅ No se detectaron alertas operativas ni desviaciones crónicas en los tableros seleccionados."]);
    emptyRow.height = 24;
    emptyRow.getCell(1).font = { ...regularFont, bold: true, color: { argb: "FF15803D" } };
    wsAlerts.mergeCells(`A4:F4`);
  }

  // =========================================================================
  // HOJA 4: HISTÓRICO DE CUMPLIMIENTO MENSUAL
  // =========================================================================
  const wsHistory = workbook.addWorksheet("HISTÓRICO MENSUAL", {
    views: [{ showGridLines: true }],
  });

  const monthsHeader = [
    "Área / Tablero",
    "Ene", "Feb", "Mar", "Abr", "May", "Jun",
    "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
    "Promedio"
  ];

  wsHistory.addRow(["TENDENCIA Y COMPORTAMIENTO HISTÓRICO MENSUAL DE RENDIMIENTO"]).font = sectionFont;
  wsHistory.addRow([]); // Espacio

  const histHeaderRow = wsHistory.getRow(3);
  histHeaderRow.values = monthsHeader;
  histHeaderRow.height = 26;
  histHeaderRow.eachCell((cell) => {
    cell.fill = corporateBlueFill;
    cell.font = headerFont;
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = thinBorder;
  });

  filteredDashboards.forEach((d) => {
    // Calcularemos promedios mensuales reales basados en el array `monthlyProgress` de todos los kpis
    const monthlySum = new Array(12).fill(0);
    const monthlyCount = new Array(12).fill(0);

    d.items.forEach((item) => {
      // Usar los valores del progreso de cada mes
      const goals = item.monthlyGoals || [];
      const progress = item.monthlyProgress || [];
      
      for (let m = 0; m < 12; m++) {
        const goal = goals[m];
        const prog = progress[m];
        if (goal !== null && goal !== undefined && goal > 0 && prog !== null && prog !== undefined) {
          const ratio = Math.min(1.5, Math.max(0, prog / goal)); // Limitar entre 0% y 150% para no distorsionar
          monthlySum[m] += ratio;
          monthlyCount[m]++;
        }
      }
    });

    const monthlyAvg = monthlySum.map((sum, idx) => {
      const c = monthlyCount[idx];
      return c > 0 ? sum / c : null;
    });

    // Calcular promedio general del año
    let sumYear = 0;
    let countYear = 0;
    monthlyAvg.forEach(val => {
      if (val !== null) {
        sumYear += val;
        countYear++;
      }
    });
    const avgYear = countYear > 0 ? sumYear / countYear : null;

    const hRow = wsHistory.addRow([
      `${d.area || "General"} — ${d.title}`,
      monthlyAvg[0], monthlyAvg[1], monthlyAvg[2], monthlyAvg[3],
      monthlyAvg[4], monthlyAvg[5], monthlyAvg[6], monthlyAvg[7],
      monthlyAvg[8], monthlyAvg[9], monthlyAvg[10], monthlyAvg[11],
      avgYear
    ]);

    hRow.height = 20;
    hRow.eachCell((cell, colIdx) => {
      cell.font = regularFont;
      cell.border = thinBorder;

      if (colIdx > 1) {
        if (cell.value === null || cell.value === undefined) {
          cell.value = "-";
          cell.alignment = { horizontal: "center", vertical: "middle" };
        } else {
          cell.numFmt = "0.0%";
          cell.alignment = { horizontal: "right", vertical: "middle" };
          
          // Semáforo sutil
          const v = cell.value as number;
          if (v >= 0.85) {
            cell.fill = fillGreen;
            cell.font = fontGreen;
          } else if (v >= 0.70) {
            cell.fill = fillAmber;
            cell.font = fontAmber;
          } else {
            cell.fill = fillRed;
            cell.font = fontRed;
          }
        }
      } else {
        cell.alignment = { horizontal: "left", vertical: "middle" };
      }
    });
  });

  // =========================================================================
  // AJUSTE AUTOMÁTICO DE ANCHO DE COLUMNAS (AUTOFIT)
  // =========================================================================
  const allWorksheets = [wsExecutive, wsKpis, wsAlerts, wsHistory];
  allWorksheets.forEach((ws) => {
    ws.columns?.forEach((column) => {
      let maxLen = 0;
      column.eachCell?.({ includeEmpty: true }, (cell) => {
        // Ignorar filas fusionadas de títulos de secciones y encabezados agrupados
        if (cell.row === 1 || cell.row === 2) return;
        const valStr = cell.value ? cell.value.toString() : "";
        if (valStr.length > maxLen) {
          maxLen = valStr.length;
        }
      });
      // Añadir margen de visualización elegante
      column.width = Math.min(45, Math.max(12, maxLen + 4));
    });
  });

  // Ajustes puntuales manuales
  wsExecutive.getColumn(1).width = 24;
  wsExecutive.getColumn(2).width = 24;
  wsExecutive.getColumn(3).width = 30;
  wsKpis.getColumn(1).width = 30;
  wsKpis.getColumn(2).width = 35;
  wsAlerts.getColumn(1).width = 30;
  wsAlerts.getColumn(2).width = 35;
  wsAlerts.getColumn(6).width = 45;
  wsHistory.getColumn(1).width = 30;

  // 4. Retornar Buffer de Excel compilado
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
};
