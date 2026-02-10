import PptxGenJS from 'pptxgenjs';
import { Dashboard, DashboardItem, ComplianceThresholds } from '../types';
import { calculateCompliance } from './compliance';

/**
 * Configuración de exportación a PowerPoint
 * Permite al administrador controlar qué elementos se incluyen
 */
export interface PowerPointExportConfig {
    includeExecutiveSummary: boolean;
    includeCharts: boolean;
    includeTrafficLights: boolean;
    includeDetailedSlides: boolean;
    includeRanking: boolean;
    includeTrendAnalysis: boolean;
    includeActionPlans: boolean;
    theme: 'dark' | 'light' | 'corporate';
}

/**
 * Configuración por defecto
 */
export const DEFAULT_PPTX_CONFIG: PowerPointExportConfig = {
    includeExecutiveSummary: true,
    includeCharts: true,
    includeTrafficLights: true,
    includeDetailedSlides: true,
    includeRanking: true,
    includeTrendAnalysis: true,
    includeActionPlans: false, // Por defecto desactivado para no sobrecargar
    theme: 'dark'
};

/**
 * Temas de color para PowerPoint
 */
const THEMES = {
    dark: {
        background: '0F172A', // slate-900
        cardBg: '1E293B', // slate-800
        text: 'FFFFFF',
        textSecondary: 'CBD5E1', // slate-300
        textMuted: '64748B', // slate-500
        accent: '06B6D4', // cyan-500
        success: '10B981', // emerald-500
        warning: 'F59E0B', // amber-500
        danger: 'EF4444', // rose-500
    },
    light: {
        background: 'FFFFFF',
        cardBg: 'F8FAFC', // slate-50
        text: '0F172A', // slate-900
        textSecondary: '475569', // slate-600
        textMuted: '94A3B8', // slate-400
        accent: '0284C7', // sky-600
        success: '059669', // emerald-600
        warning: 'D97706', // amber-600
        danger: 'DC2626', // rose-600
    },
    corporate: {
        background: '1A1A2E',
        cardBg: '16213E',
        text: 'FFFFFF',
        textSecondary: 'E0E0E0',
        textMuted: '9E9E9E',
        accent: '0F4C75',
        success: '3282B8',
        warning: 'FFE66D',
        danger: 'FF6B6B',
    }
};

/**
 * Genera insights ejecutivos automáticos usando análisis de datos
 */
function generateExecutiveInsights(
    dashboards: Dashboard[],
    globalThresholds: ComplianceThresholds,
    year?: number
): {
    overallCompliance: number;
    insights: string[];
    recommendations: string[];
    topPerformers: Array<{ name: string; score: number }>;
    atRisk: Array<{ name: string; score: number }>;
    trend: 'up' | 'down' | 'stable';
} {
    const currentMonth = new Date().getMonth();

    // Calcular cumplimiento de cada dashboard
    const dashboardScores = dashboards
        .filter(d => typeof d.id === 'number') // Solo dashboards reales
        .map(dashboard => {
            const items = dashboard.items || [];
            if (items.length === 0) return { name: dashboard.title, score: 0, items: [] };

            const itemScores = items.map(item => {
                const { overallPercentage } = calculateCompliance(item, globalThresholds, year);
                return overallPercentage;
            });

            const avgScore = itemScores.reduce((sum, s) => sum + s, 0) / itemScores.length;
            return { name: dashboard.title, score: Math.round(avgScore), items };
        });

    const overallCompliance = Math.round(
        dashboardScores.reduce((sum, d) => sum + d.score, 0) / dashboardScores.length
    );

    const insights: string[] = [];
    const recommendations: string[] = [];

    // Insight 1: Desempeño general
    if (overallCompliance >= 100) {
        insights.push(`✅ Excelente desempeño: ${overallCompliance}% de cumplimiento global, superando la meta.`);
        insights.push(`🎯 ${dashboardScores.filter(d => d.score >= 100).length} de ${dashboardScores.length} unidades alcanzaron o superaron sus objetivos.`);
    } else if (overallCompliance >= globalThresholds.onTrack) {
        insights.push(`✓ Desempeño sólido: ${overallCompliance}% de cumplimiento, dentro del rango objetivo.`);
        recommendations.push('Identificar y replicar las mejores prácticas de las unidades con mejor desempeño.');
    } else if (overallCompliance >= globalThresholds.atRisk) {
        insights.push(`⚠️ Atención requerida: ${overallCompliance}% de cumplimiento, por debajo del objetivo.`);
        recommendations.push('Implementar plan de acción inmediato para las unidades con desempeño crítico.');
        recommendations.push('Realizar análisis de causa raíz en los indicadores de bajo rendimiento.');
    } else {
        insights.push(`🚨 Situación crítica: ${overallCompliance}% de cumplimiento, requiere intervención urgente.`);
        recommendations.push('Convocar reunión ejecutiva de emergencia para definir acciones correctivas.');
        recommendations.push('Reasignar recursos a las áreas más críticas.');
    }

    // Insight 2: Variabilidad
    const scores = dashboardScores.map(d => d.score);
    const mean = scores.reduce((sum, s) => sum + s, 0) / scores.length;
    const variance = scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / scores.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev > 20) {
        insights.push(`📊 Alta variabilidad detectada (σ=${stdDev.toFixed(1)}%). Existe oportunidad de estandarizar procesos.`);
        recommendations.push('Realizar benchmarking interno para identificar factores de éxito.');
    } else if (stdDev < 10) {
        insights.push(`📈 Desempeño consistente entre unidades (σ=${stdDev.toFixed(1)}%).`);
    }

    // Insight 3: Tendencia (comparar mes actual vs anterior)
    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (currentMonth > 0) {
        const currentMonthAvg = dashboardScores.map(d => {
            const items = d.items;
            const currentProgress = items.reduce((sum, item) =>
                sum + (item.monthlyProgress[currentMonth] || 0), 0) / items.length;
            const currentGoal = items.reduce((sum, item) =>
                sum + (item.monthlyGoals[currentMonth] || 1), 0) / items.length;
            return (currentProgress / currentGoal) * 100;
        }).reduce((sum, s) => sum + s, 0) / dashboardScores.length;

        const prevMonthAvg = dashboardScores.map(d => {
            const items = d.items;
            const prevProgress = items.reduce((sum, item) =>
                sum + (item.monthlyProgress[currentMonth - 1] || 0), 0) / items.length;
            const prevGoal = items.reduce((sum, item) =>
                sum + (item.monthlyGoals[currentMonth - 1] || 1), 0) / items.length;
            return (prevProgress / prevGoal) * 100;
        }).reduce((sum, s) => sum + s, 0) / dashboardScores.length;

        const change = currentMonthAvg - prevMonthAvg;
        if (change > 5) {
            trend = 'up';
            insights.push(`📈 Tendencia positiva: mejora de ${change.toFixed(1)}% respecto al mes anterior.`);
        } else if (change < -5) {
            trend = 'down';
            insights.push(`📉 Tendencia negativa: disminución de ${Math.abs(change).toFixed(1)}% respecto al mes anterior.`);
            recommendations.push('Investigar causas de la disminución y ajustar estrategias.');
        }
    }

    // Top Performers
    const topPerformers = dashboardScores
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);

    // At Risk
    const atRisk = dashboardScores
        .filter(d => d.score < globalThresholds.onTrack)
        .sort((a, b) => a.score - b.score)
        .slice(0, 3);

    if (atRisk.length > 0) {
        insights.push(`⚠️ ${atRisk.length} unidades requieren atención inmediata.`);
    }

    return {
        overallCompliance,
        insights,
        recommendations,
        topPerformers,
        atRisk,
        trend
    };
}

/**
 * Exporta un dashboard o grupo de dashboards a PowerPoint profesional
 */
export async function exportToPowerPoint(
    dashboards: Dashboard[],
    globalThresholds: ComplianceThresholds,
    config: PowerPointExportConfig = DEFAULT_PPTX_CONFIG,
    year?: number,
    title: string = 'Dashboard Ejecutivo'
): Promise<void> {
    const pptx = new PptxGenJS();
    const theme = THEMES[config.theme];

    // Configuración global
    pptx.author = 'StrateXa - IA Prior';
    pptx.company = 'Prior Consultoría';
    pptx.subject = title;
    pptx.title = title;

    // Definir layout maestro
    pptx.defineLayout({ name: 'CUSTOM', width: 10, height: 5.625 });
    pptx.layout = 'CUSTOM';

    // 1. PORTADA
    const coverSlide = pptx.addSlide();
    coverSlide.background = { color: theme.background };

    coverSlide.addText(title.toUpperCase(), {
        x: 0.5,
        y: 1.5,
        w: 9,
        h: 1,
        fontSize: 48,
        bold: true,
        color: theme.text,
        align: 'center',
        fontFace: 'Arial'
    });

    const currentDate = new Date().toLocaleDateString('es-MX', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    coverSlide.addText(currentDate, {
        x: 0.5,
        y: 2.8,
        w: 9,
        h: 0.5,
        fontSize: 20,
        color: theme.textSecondary,
        align: 'center',
        fontFace: 'Arial'
    });

    coverSlide.addText('Generado por StrateXa - IA Prior', {
        x: 0.5,
        y: 4.8,
        w: 9,
        h: 0.3,
        fontSize: 12,
        color: theme.textMuted,
        align: 'center',
        italic: true,
        fontFace: 'Arial'
    });

    // 2. RESUMEN EJECUTIVO
    if (config.includeExecutiveSummary) {
        const insights = generateExecutiveInsights(dashboards, globalThresholds, year);
        const summarySlide = pptx.addSlide();
        summarySlide.background = { color: theme.background };

        // Título
        summarySlide.addText('RESUMEN EJECUTIVO', {
            x: 0.5,
            y: 0.3,
            w: 9,
            h: 0.5,
            fontSize: 32,
            bold: true,
            color: theme.text,
            fontFace: 'Arial'
        });

        // Cumplimiento Global (Grande y destacado)
        const complianceColor = insights.overallCompliance >= 100 ? theme.success :
            insights.overallCompliance >= globalThresholds.onTrack ? theme.warning :
                theme.danger;

        summarySlide.addShape('roundRect', {
            x: 0.5,
            y: 1,
            w: 3,
            h: 1.5,
            fill: { color: theme.cardBg },
            line: { color: complianceColor, width: 3 }
        });

        summarySlide.addText('CUMPLIMIENTO GLOBAL', {
            x: 0.5,
            y: 1.1,
            w: 3,
            h: 0.3,
            fontSize: 12,
            color: theme.textMuted,
            align: 'center',
            fontFace: 'Arial'
        });

        summarySlide.addText(`${insights.overallCompliance}%`, {
            x: 0.5,
            y: 1.5,
            w: 3,
            h: 0.8,
            fontSize: 60,
            bold: true,
            color: complianceColor,
            align: 'center',
            fontFace: 'Arial'
        });

        // Insights Clave
        let yPos = 1;
        summarySlide.addText('📊 INSIGHTS CLAVE', {
            x: 3.8,
            y: yPos,
            w: 5.7,
            h: 0.4,
            fontSize: 14,
            bold: true,
            color: theme.accent,
            fontFace: 'Arial'
        });

        yPos += 0.5;
        insights.insights.slice(0, 4).forEach((insight, i) => {
            summarySlide.addText(`• ${insight}`, {
                x: 3.8,
                y: yPos,
                w: 5.7,
                h: 0.35,
                fontSize: 11,
                color: theme.textSecondary,
                fontFace: 'Arial',
                valign: 'top'
            });
            yPos += 0.4;
        });

        // Recomendaciones
        if (insights.recommendations.length > 0) {
            yPos += 0.2;
            summarySlide.addText('💡 RECOMENDACIONES', {
                x: 3.8,
                y: yPos,
                w: 5.7,
                h: 0.4,
                fontSize: 14,
                bold: true,
                color: theme.warning,
                fontFace: 'Arial'
            });

            yPos += 0.5;
            insights.recommendations.slice(0, 3).forEach((rec) => {
                summarySlide.addText(`• ${rec}`, {
                    x: 3.8,
                    y: yPos,
                    w: 5.7,
                    h: 0.35,
                    fontSize: 10,
                    color: theme.textSecondary,
                    fontFace: 'Arial',
                    valign: 'top'
                });
                yPos += 0.35;
            });
        }

        // Top Performers (Abajo izquierda)
        if (config.includeRanking && insights.topPerformers.length > 0) {
            summarySlide.addText('🏆 TOP DESEMPEÑO', {
                x: 0.5,
                y: 2.8,
                w: 3,
                h: 0.3,
                fontSize: 12,
                bold: true,
                color: theme.success,
                fontFace: 'Arial'
            });

            let rankY = 3.2;
            insights.topPerformers.forEach((item, i) => {
                summarySlide.addShape('rect', {
                    x: 0.5,
                    y: rankY,
                    w: 2.5,
                    h: 0.35,
                    fill: { color: theme.success, transparency: 85 }
                });

                summarySlide.addText(`${i + 1}. ${item.name}`, {
                    x: 0.6,
                    y: rankY + 0.05,
                    w: 1.8,
                    h: 0.25,
                    fontSize: 10,
                    bold: true,
                    color: theme.text,
                    fontFace: 'Arial'
                });

                summarySlide.addText(`${item.score}%`, {
                    x: 2.5,
                    y: rankY + 0.05,
                    w: 0.4,
                    h: 0.25,
                    fontSize: 10,
                    bold: true,
                    color: theme.success,
                    align: 'right',
                    fontFace: 'Arial'
                });

                rankY += 0.4;
            });
        }

        // At Risk (Abajo derecha)
        if (insights.atRisk.length > 0) {
            summarySlide.addText('⚠️ REQUIEREN ATENCIÓN', {
                x: 3.8,
                y: yPos + 0.3,
                w: 5.7,
                h: 0.3,
                fontSize: 12,
                bold: true,
                color: theme.danger,
                fontFace: 'Arial'
            });

            let riskY = yPos + 0.7;
            insights.atRisk.forEach((item) => {
                summarySlide.addShape('rect', {
                    x: 3.8,
                    y: riskY,
                    w: 5.7,
                    h: 0.35,
                    fill: { color: theme.danger, transparency: 85 }
                });

                summarySlide.addText(item.name, {
                    x: 3.9,
                    y: riskY + 0.05,
                    w: 4.5,
                    h: 0.25,
                    fontSize: 10,
                    bold: true,
                    color: theme.text,
                    fontFace: 'Arial'
                });

                summarySlide.addText(`${item.score}%`, {
                    x: 8.8,
                    y: riskY + 0.05,
                    w: 0.6,
                    h: 0.25,
                    fontSize: 10,
                    bold: true,
                    color: theme.danger,
                    align: 'right',
                    fontFace: 'Arial'
                });

                riskY += 0.4;
            });
        }
    }

    // 3. RANKING DE DESEMPEÑO (con semáforos)
    if (config.includeRanking && config.includeTrafficLights) {
        const rankingSlide = pptx.addSlide();
        rankingSlide.background = { color: theme.background };

        rankingSlide.addText('RANKING DE DESEMPEÑO', {
            x: 0.5,
            y: 0.3,
            w: 9,
            h: 0.5,
            fontSize: 32,
            bold: true,
            color: theme.text,
            fontFace: 'Arial'
        });

        // Calcular scores y ordenar
        const scores = dashboards
            .filter(d => typeof d.id === 'number')
            .map(dashboard => {
                const items = dashboard.items || [];
                if (items.length === 0) return { name: dashboard.title, score: 0 };

                const itemScores = items.map(item => {
                    const { overallPercentage } = calculateCompliance(item, globalThresholds, year);
                    return overallPercentage;
                });

                const avgScore = itemScores.reduce((sum, s) => sum + s, 0) / itemScores.length;
                return { name: dashboard.title, score: Math.round(avgScore) };
            })
            .sort((a, b) => b.score - a.score);

        // Tabla de ranking
        const tableData: any[] = [
            [
                { text: '#', options: { bold: true, fontSize: 14, color: theme.text, fill: theme.cardBg } },
                { text: 'UNIDAD / TABLERO', options: { bold: true, fontSize: 14, color: theme.text, fill: theme.cardBg } },
                { text: 'CUMPLIMIENTO', options: { bold: true, fontSize: 14, color: theme.text, fill: theme.cardBg, align: 'center' } },
                { text: 'ESTADO', options: { bold: true, fontSize: 14, color: theme.text, fill: theme.cardBg, align: 'center' } }
            ]
        ];

        scores.forEach((item, index) => {
            const statusColor = item.score >= 100 ? theme.success :
                item.score >= globalThresholds.onTrack ? theme.warning :
                    theme.danger;

            const statusText = item.score >= 100 ? '●' :
                item.score >= globalThresholds.onTrack ? '●' :
                    '●';

            tableData.push([
                { text: `${index + 1}`, options: { fontSize: 12, color: theme.textSecondary } },
                { text: item.name, options: { fontSize: 12, color: theme.text, bold: true } },
                { text: `${item.score}%`, options: { fontSize: 14, color: statusColor, bold: true, align: 'center' } },
                { text: statusText, options: { fontSize: 32, color: statusColor, align: 'center' } }
            ]);
        });

        rankingSlide.addTable(tableData, {
            x: 0.5,
            y: 1,
            w: 9,
            h: 4,
            colW: [0.5, 5, 1.5, 2],
            border: { pt: 1, color: theme.textMuted },
            fill: { color: theme.background },
            fontSize: 12,
            fontFace: 'Arial'
        });
    }

    // 4. GRÁFICA DE TENDENCIA
    if (config.includeCharts && config.includeTrendAnalysis) {
        const trendSlide = pptx.addSlide();
        trendSlide.background = { color: theme.background };

        trendSlide.addText('TENDENCIA DE DESEMPEÑO 2026', {
            x: 0.5,
            y: 0.3,
            w: 9,
            h: 0.5,
            fontSize: 32,
            bold: true,
            color: theme.text,
            fontFace: 'Arial'
        });

        // Calcular datos de tendencia mensual
        const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const currentMonth = new Date().getMonth();

        const monthlyData = months.slice(0, currentMonth + 1).map((month, i) => {
            const avgCompliance = dashboards
                .filter(d => typeof d.id === 'number')
                .map(dashboard => {
                    const items = dashboard.items || [];
                    const progress = items.reduce((sum, item) => sum + (item.monthlyProgress[i] || 0), 0) / items.length;
                    const goal = items.reduce((sum, item) => sum + (item.monthlyGoals[i] || 1), 0) / items.length;
                    return (progress / goal) * 100;
                })
                .reduce((sum, s) => sum + s, 0) / dashboards.filter(d => typeof d.id === 'number').length;

            return Math.round(avgCompliance);
        });

        // Crear gráfica de líneas
        const chartData = [
            {
                name: 'Cumplimiento Real',
                labels: months.slice(0, currentMonth + 1),
                values: monthlyData
            },
            {
                name: 'Meta (100%)',
                labels: months.slice(0, currentMonth + 1),
                values: Array(currentMonth + 1).fill(100)
            }
        ];

        trendSlide.addChart('line', chartData, {
            x: 0.5,
            y: 1.2,
            w: 9,
            h: 3.8,
            chartColors: [theme.success, theme.accent],
            showLegend: true,
            legendPos: 'b',
            showTitle: false,
            valAxisMaxVal: Math.max(...monthlyData, 100) * 1.1,
            valAxisMinVal: 0,
            catAxisLabelFontSize: 11,
            valAxisLabelFontSize: 11,
            dataLabelFontSize: 10,
            showValue: true,
            lineDataSymbol: 'circle',
            lineDataSymbolSize: 8,
            lineSize: 3
        });
    }

    // 5. SLIDES DETALLADOS POR DASHBOARD
    if (config.includeDetailedSlides) {
        for (const dashboard of dashboards.filter(d => typeof d.id === 'number')) {
            const detailSlide = pptx.addSlide();
            detailSlide.background = { color: theme.background };

            // Título del dashboard
            detailSlide.addText(dashboard.title.toUpperCase(), {
                x: 0.5,
                y: 0.3,
                w: 9,
                h: 0.5,
                fontSize: 28,
                bold: true,
                color: theme.text,
                fontFace: 'Arial'
            });

            // Calcular cumplimiento del dashboard
            const items = dashboard.items || [];
            const dashboardCompliance = items.length > 0
                ? Math.round(items.reduce((sum, item) => {
                    const { overallPercentage } = calculateCompliance(item, globalThresholds, year);
                    return sum + overallPercentage;
                }, 0) / items.length)
                : 0;

            // Badge de cumplimiento
            const badgeColor = dashboardCompliance >= 100 ? theme.success :
                dashboardCompliance >= globalThresholds.onTrack ? theme.warning :
                    theme.danger;

            detailSlide.addShape('roundRect', {
                x: 8,
                y: 0.25,
                w: 1.5,
                h: 0.6,
                fill: { color: badgeColor },
                line: { width: 0 }
            });

            detailSlide.addText(`${dashboardCompliance}%`, {
                x: 8,
                y: 0.35,
                w: 1.5,
                h: 0.4,
                fontSize: 24,
                bold: true,
                color: 'FFFFFF',
                align: 'center',
                fontFace: 'Arial'
            });

            // Tabla de indicadores
            const indicatorTableData: any[] = [
                [
                    { text: 'INDICADOR', options: { bold: true, fontSize: 11, color: theme.text, fill: theme.cardBg } },
                    { text: 'REAL', options: { bold: true, fontSize: 11, color: theme.text, fill: theme.cardBg, align: 'center' } },
                    { text: 'META', options: { bold: true, fontSize: 11, color: theme.text, fill: theme.cardBg, align: 'center' } },
                    { text: '%', options: { bold: true, fontSize: 11, color: theme.text, fill: theme.cardBg, align: 'center' } },
                    { text: '●', options: { bold: true, fontSize: 11, color: theme.text, fill: theme.cardBg, align: 'center' } }
                ]
            ];

            items.slice(0, 8).forEach(item => {
                const { currentProgress, currentTarget, overallPercentage, complianceStatus } =
                    calculateCompliance(item, globalThresholds, year);

                const statusColor = complianceStatus === 'OnTrack' ? theme.success :
                    complianceStatus === 'AtRisk' ? theme.warning :
                        theme.danger;

                indicatorTableData.push([
                    { text: item.indicator, options: { fontSize: 10, color: theme.text } },
                    { text: currentProgress.toFixed(1), options: { fontSize: 10, color: theme.textSecondary, align: 'center' } },
                    { text: currentTarget.toFixed(1), options: { fontSize: 10, color: theme.textMuted, align: 'center' } },
                    { text: `${Math.round(overallPercentage)}%`, options: { fontSize: 11, color: statusColor, bold: true, align: 'center' } },
                    { text: '●', options: { fontSize: 20, color: statusColor, align: 'center' } }
                ]);
            });

            detailSlide.addTable(indicatorTableData, {
                x: 0.5,
                y: 1.1,
                w: 9,
                h: 3.8,
                colW: [4.5, 1.2, 1.2, 1, 1.1],
                border: { pt: 1, color: theme.textMuted },
                fill: { color: theme.background },
                fontSize: 10,
                fontFace: 'Arial'
            });

            if (items.length > 8) {
                detailSlide.addText(`+ ${items.length - 8} indicadores más...`, {
                    x: 0.5,
                    y: 5,
                    w: 9,
                    h: 0.3,
                    fontSize: 10,
                    color: theme.textMuted,
                    italic: true,
                    align: 'center',
                    fontFace: 'Arial'
                });
            }
        }
    }

    // Generar y descargar
    const fileName = `${title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pptx`;
    await pptx.writeFile({ fileName });
}
