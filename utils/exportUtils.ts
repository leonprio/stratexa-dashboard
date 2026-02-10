import { Dashboard, DashboardItem } from "../types";
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

/**
 * Genera un archivo Excel (.xlsx) con formato profesional para un tablero específico.
 * Incluye metadatos, metas, reales y notas detalladas con estilos.
 */
export const exportDashboardToExcel = async (dashboard: Dashboard) => {
    if (!dashboard || !dashboard.items) return;

    const workbook = new ExcelJS.Workbook();
    const sheetName = dashboard.title.replace(/[\\/*[\]:?]/g, '_').substring(0, 31) || "Dashboard";
    const worksheet = workbook.addWorksheet(sheetName);

    const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

    // Definir columnas
    // Se usa un arreglo de objetos para definir claves y anchos iniciales
    const columns: Partial<ExcelJS.Column>[] = [
        { header: 'No.', key: 'index', width: 6 },
        { header: 'Indicador', key: 'indicator', width: 40 },
        { header: 'Unidad', key: 'unit', width: 12 },
        { header: 'Tipo', key: 'type', width: 12 },
        { header: 'Pond. (%)', key: 'weight', width: 12 },
        { header: 'Meta Global', key: 'goalType', width: 15 },
    ];

    // Encabezados dinámicos por mes
    months.forEach((m, i) => {
        columns.push({ header: `Meta ${m}`, key: `goal_${i}`, width: 12 });
        columns.push({ header: `Real ${m}`, key: `real_${i}`, width: 12 });
        columns.push({ header: `Nota ${m}`, key: `note_${i}`, width: 20 });
    });

    worksheet.columns = columns as any;

    // Estilizar encabezado (Fila 1)
    const headerRow = worksheet.getRow(1);
    headerRow.height = 25;
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11, name: 'Calibri' };
    headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1F2937' } // Gris oscuro (slate-800 aprox)
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    // Agregar filas de datos
    dashboard.items.forEach((item: DashboardItem, idx) => {
        const rowData: any = {
            index: idx + 1,
            indicator: item.indicator,
            unit: item.unit,
            type: item.type,
            weight: item.weight,
            goalType: item.goalType === 'minimize' ? "Minimizar" : "Maximizar"
        };

        // Datos mensuales
        for (let i = 0; i < 12; i++) {
            rowData[`goal_${i}`] = item.monthlyGoals[i] ?? 0;
            rowData[`real_${i}`] = item.monthlyProgress[i] ?? 0;
            rowData[`note_${i}`] = item.monthlyNotes?.[i] || "";
        }

        const row = worksheet.addRow(rowData);

        // Estilos alternados y bordes
        const isEven = (idx + 1) % 2 === 0;
        const fillColor = isEven ? 'FFF9FAFB' : 'FFFFFFFF'; // slate-50 vs white

        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            cell.border = {
                top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
            };

            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: fillColor }
            };

            cell.font = { name: 'Calibri', size: 11 };
            cell.alignment = { vertical: 'middle', wrapText: true };

            // Alinear numeros al centro
            if (colNumber === 1 || colNumber >= 4) {
                cell.alignment = { ...cell.alignment, horizontal: 'center' };
            }
        });
    });

    // Generar archivo y descargar
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const fileName = `Export_${dashboard.title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;

    saveAs(blob, fileName);
};

/**
 * Genera un archivo CSV compatible con Excel para un tablero específico.
 * MANTENIDO POR COMPATIBILIDAD
 */
export const exportDashboardToCSV = (dashboard: Dashboard) => {
    if (!dashboard || !dashboard.items) return;

    const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

    // Encabezados
    const headers = [
        "Indicador",
        "Unidad",
        "Tipo",
        "Ponderacion (%)",
        "Tipo de Meta",
        ...months.flatMap(m => [`Meta ${m}`, `Real ${m}`, `Nota ${m}`])
    ];

    const rows = dashboard.items.map((item: DashboardItem) => {
        const row = [
            `"${item.indicator}"`,
            `"${item.unit}"`,
            `"${item.type}"`,
            item.weight,
            item.goalType === 'minimize' ? "Minimizar" : "Maximizar"
        ];

        // Datos mensuales
        for (let i = 0; i < 12; i++) {
            row.push(item.monthlyGoals[i] ?? 0);
            row.push(item.monthlyProgress[i] ?? 0);
            row.push(`"${(item.monthlyNotes?.[i] || "").replace(/"/g, '""')}"`);
        }

        return row.join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\n");
    downloadCSV(csvContent, `Respaldo_${dashboard.title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
};

/**
 * Genera un archivo CSV masivo compatible con el Importador Avanzado.
 * Formato entrelazado: Tablero, Indicador, Nombre, Meta Ene, Real Ene, Meta Feb, Real Feb...
 * Muy útil para ediciones masivas y respaldos de todo el año.
 */
export const exportBulkDataToCSV = (dashboards: Dashboard[], clientName: string, year: number) => {
    if (!dashboards || dashboards.length === 0) return;

    const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

    // Encabezados compatibles con el AdvancedDataImporter (v2.7.1: 27 columnas total)
    const headers = [
        "No. Tablero",
        "No. Indicador",
        "Nombre del Indicador", // Agregado para referencia humana (Col 2)
        ...months.flatMap(m => [`Meta ${m}`, `Real ${m}`])
    ];

    const rows: string[] = [];

    // Ordenar tableros por número de orden para que la exportación sea lógica
    const sortedDashboards = [...dashboards].sort((a, b) => {
        const orderA = (a as any).orderNumber || 999;
        const orderB = (b as any).orderNumber || 999;
        return orderA - orderB;
    });

    sortedDashboards.forEach((db) => {
        if (typeof db.id === 'string' && db.id.startsWith('agg-')) return; // Saltar agregados

        const dbNum = (db as any).orderNumber || 0;

        db.items.forEach((item, index) => {
            const row = [
                dbNum,
                index + 1, // El importador usa base 1 para los indicadores
                `"${item.indicator.replace(/"/g, '""')}"`, // Nombre del indicador
            ];

            // Datos mensuales entrelazados: Meta, Real, Meta, Real...
            for (let i = 0; i < 12; i++) {
                row.push(item.monthlyGoals[i] ?? 0);
                row.push(item.monthlyProgress[i] ?? 0);
            }

            rows.push(row.join(","));
        });
    });

    const csvContent = [headers.join(","), ...rows].join("\n");
    const fileName = `DATOS_MASIVOS_${clientName.replace(/\s+/g, '_')}_${year}.csv`;
    downloadCSV(csvContent, fileName);
};

/**
 * Helper para descargar el contenido como archivo CSV con BOM
 */
const downloadCSV = (content: string, fileName: string) => {
    // Agregar BOM (Byte Order Mark) para que Excel reconozca UTF-8 correctamente
    const blob = new Blob(["\ufeff" + content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

