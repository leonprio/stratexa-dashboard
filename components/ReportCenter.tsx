import React, { useMemo } from 'react';
import { DashboardItem, ComplianceThresholds, User } from '../types';
import { calculateCompliance, calculateDashboardWeightedScore, calculateDashboardMonthlyScores, getStatusForPercentage } from '../utils/compliance';
import { ProgressBar } from './ProgressBar';
import { GaugeChart } from './GaugeChart';
import { LineChart } from './LineChart';
import pptxgen from "pptxgenjs";

interface ReportCenterProps {
    items: DashboardItem[];
    thresholds: ComplianceThresholds;
    year?: number;
    allDashboards?: any[];
    currentDashboardId?: number | string;
    onEditItem?: (id: number) => void;
    onClose?: () => void;
    user: User;
}

export const ReportCenter: React.FC<ReportCenterProps> = ({ items, thresholds, year, allDashboards = [], currentDashboardId, user, onEditItem, onClose }) => {
    const isGlobalMode = currentDashboardId === -1 || String(currentDashboardId).startsWith('agg-global');
    const activeDashboard = allDashboards.find(d => d.id === currentDashboardId);
    const activeGroupName = isGlobalMode ? "ESTADO GLOBAL" : (activeDashboard?.group || "GENERAL");

    // 🎯 DETECCIÓN DE CONTEXTO (v5.0.0)
    // Determinar si estamos viendo una UNE individual o un grupo/global
    const isGroupView = isGlobalMode || String(currentDashboardId).startsWith('agg-');
    const isSingleDashboard = !isGroupView && typeof currentDashboardId === 'number';
    const contextLabel = isSingleDashboard ? activeDashboard?.title || "UNE" : activeGroupName;

    const groupDashboards = useMemo(() => {
        if (isGlobalMode) {
            // En modo global, comparamos las UNEs principales
            return allDashboards.filter(d => typeof d.id === 'number');
        }
        return allDashboards.filter(d => (d.group === activeGroupName || d.group === "GENERAL") && (typeof d.id === 'number' || (typeof d.id === 'string' && !d.id.startsWith('agg-'))));
    }, [allDashboards, activeGroupName, isGlobalMode]);

    const totalScore = useMemo(() => {
        return calculateDashboardWeightedScore(items, thresholds, year);
    }, [items, thresholds, year]);

    const totalStatus = getStatusForPercentage(totalScore, thresholds);

    // Calcular datos mensuales solo para meses con datos reales
    const currentMonthIdx = new Date().getMonth();
    const monthlyTrendData = useMemo(() => {
        const scores = calculateDashboardMonthlyScores(items, thresholds, year, currentMonthIdx);
        return scores.map(s => s || 0);
    }, [items, thresholds, year, currentMonthIdx]);

    // Contar meses con datos para decidir si mostrar gráfica
    const monthsWithData = monthlyTrendData.filter((v, idx) => v > 0 && idx <= currentMonthIdx).length;

    const groupRanking = useMemo(() => {
        if (!groupDashboards.length) return [];
        return groupDashboards.map(d => {
            const score = calculateDashboardWeightedScore(d.items || [], thresholds, year);
            return {
                id: d.id,
                title: d.title,
                score,
                status: getStatusForPercentage(score, thresholds)
            };
        }).sort((a, b) => b.score - a.score);
    }, [groupDashboards, thresholds, year]);

    const groupAverage = useMemo(() => {
        if (!groupRanking.length) return 0;
        return groupRanking.reduce((sum, r) => sum + r.score, 0) / groupRanking.length;
    }, [groupRanking]);

    // 🎯 INDICADORES EN RIESGO (para UNE individual - v5.0.0)
    const indicatorStats = useMemo(() => {
        if (!isSingleDashboard) return { onTrack: 0, atRisk: 0, offTrack: 0, neutral: 0, total: 0 };

        let onTrack = 0, atRisk = 0, offTrack = 0, neutral = 0;
        items.forEach(item => {
            const compliance = calculateCompliance(item, thresholds, year);
            if (compliance.complianceStatus === 'OnTrack') onTrack++;
            else if (compliance.complianceStatus === 'AtRisk') atRisk++;
            else if (compliance.complianceStatus === 'OffTrack') offTrack++;
            else neutral++;
        });
        return { onTrack, atRisk, offTrack, neutral, total: items.length };
    }, [items, thresholds, year, isSingleDashboard]);

    const exportToPPTX = async () => {
        const pres = new pptxgen();

        // 🎨 COLORES CORREGIDOS (v5.0.0)
        const blue = "1E293B";
        const cyan = "0891B2";
        const white = "FFFFFF";
        const slate = "64748B";
        const green = "10B981";  // ✅ Verde correcto
        const amber = "F59E0B";  // ⚠️ Amarillo
        const rose = "F43F5E";   // ❌ Rojo

        // Función para obtener color según status
        const getStatusColor = (score: number) => {
            if (score >= thresholds.onTrack) return green;
            if (score >= thresholds.atRisk) return amber;
            return rose;
        };

        // Configuración Global de la Presentación
        pres.layout = 'LAYOUT_WIDE';
        pres.defineSlideMaster({
            title: 'MASTER_SLIDE',
            background: { color: 'F8FAFC' },
            objects: [
                {
                    text: {
                        text: `Prior BI Systems | ${contextLabel} | v5.0`,
                        options: { x: 0.5, y: 6.8, w: 5, h: 0.3, fontSize: 8, color: slate }
                    }
                }
            ]
        });

        // 1. Portada Premium
        const slide1 = pres.addSlide();
        slide1.background = { color: blue };
        slide1.addText(`REPORTE EJECUTIVO DE DESEMPEÑO`, { x: 0.5, y: 2.0, w: '90%', fontSize: 44, color: white, bold: true, align: 'center', fontFace: 'Arial' });
        slide1.addText(contextLabel, { x: 0.5, y: 3.2, w: '90%', fontSize: 32, color: cyan, bold: true, align: 'center' });
        slide1.addText(`Periodo Fiscal ${year}`, { x: 0.5, y: 4.2, w: '90%', fontSize: 18, color: slate, align: 'center' });
        slide1.addShape(pres.ShapeType.rect, { x: 4.5, y: 5.0, w: 2.0, h: 0.05, fill: { color: cyan } });

        // 2. Resumen Ejecutivo - Diferenciado por contexto
        const slide2 = pres.addSlide({ masterName: 'MASTER_SLIDE' });
        slide2.addText(isSingleDashboard ? "RESUMEN DE INDICADORES" : "RESUMEN GENERAL DE CUMPLIMIENTO", {
            x: 0.5, y: 0.3, w: '90%', fontSize: 22, bold: true, color: blue
        });

        // Indicador visual de cumplimiento principal
        slide2.addText(`${Math.round(totalScore)}%`, {
            x: 0.5, y: 1.0, w: 2, fontSize: 56, bold: true,
            color: getStatusColor(totalScore), align: 'center'
        });
        slide2.addText(isSingleDashboard ? "Cumplimiento UNE" : "Cumplimiento Ponderado", {
            x: 0.5, y: 2.0, w: 2, fontSize: 9, color: slate, align: 'center', bold: true
        });

        // Métricas contextuales compactas
        if (isSingleDashboard) {
            // Para UNE individual: mostrar estadísticas de indicadores
            slide2.addText("INDICADORES EN META", { x: 0.5, y: 2.6, w: 2.5, fontSize: 9, color: slate, bold: true });
            slide2.addText(`${indicatorStats.onTrack}/${indicatorStats.total}`, { x: 0.5, y: 2.9, w: 2.5, fontSize: 24, bold: true, color: green });

            slide2.addText("EN RIESGO", { x: 0.5, y: 3.6, w: 2.5, fontSize: 9, color: slate, bold: true });
            slide2.addText(`${indicatorStats.atRisk}`, { x: 0.5, y: 3.9, w: 1, fontSize: 24, bold: true, color: amber });

            slide2.addText("CRÍTICOS", { x: 1.5, y: 3.6, w: 2.5, fontSize: 9, color: slate, bold: true });
            slide2.addText(`${indicatorStats.offTrack}`, { x: 1.5, y: 3.9, w: 1, fontSize: 24, bold: true, color: rose });
        } else {
            // Para Grupo/Global: mostrar ranking de tableros (ajustado para no salirse)
            const rankingHead = [
                { text: '#', options: { fill: { color: blue }, color: white, bold: true } },
                { text: 'Tablero / UNE', options: { fill: { color: blue }, color: white, bold: true } },
                { text: '%', options: { fill: { color: blue }, color: white, bold: true, align: 'center' as const } }
            ];
            const rankingRows = groupRanking.slice(0, 6).map((r, i) => [
                { text: (i + 1).toString() },
                { text: r.title },
                { text: `${Math.round(r.score)}%`, options: { color: getStatusColor(r.score), bold: true, align: 'center' as const } }
            ]);
            slide2.addTable([rankingHead, ...rankingRows], {
                x: 3.0, y: 1.0, w: 9.5, rowH: 0.35,
                fontSize: 10, border: { pt: 0.5, color: 'E2E8F0' }, fill: { color: white }
            });
        }

        // 3. DETALLE POR INDICADOR (solo indicadores del contexto actual)
        reports.forEach((item) => {
            const slide = pres.addSlide({ masterName: 'MASTER_SLIDE' });

            // Título del Indicador
            slide.addText(item.indicator.toUpperCase(), { x: 0.5, y: 0.3, w: '90%', fontSize: 18, bold: true, color: blue });
            slide.addShape(pres.ShapeType.rect, { x: 0.5, y: 0.75, w: 1.5, h: 0.05, fill: { color: cyan } });

            // Métricas Clave
            const compliance = item.compliance;
            const statusColor = getStatusColor(compliance.overallPercentage);

            slide.addText("CUMPLIMIENTO", { x: 0.5, y: 1.2, w: 2.5, fontSize: 9, color: slate, bold: true });
            slide.addText(`${Math.round(compliance.overallPercentage)}%`, { x: 0.5, y: 1.5, w: 2.5, fontSize: 42, bold: true, color: statusColor });

            // Gráfica de Tendencia Mensual (Nativa de PowerPoint)
            const dataChartArea = [
                {
                    name: "Resultado",
                    labels: monthNames,
                    values: (item.monthlyProgress || Array(12).fill(0)).map(v => v || 0)
                },
                {
                    name: "Meta",
                    labels: monthNames,
                    values: (item.monthlyGoals || Array(12).fill(0)).map(v => v || 0)
                }
            ];

            slide.addChart(pres.ChartType.line, dataChartArea, {
                x: 3.5, y: 1.0, w: 9.0, h: 3.0,
                showTitle: false,
                lineDataSymbol: 'circle',
                lineDataSymbolSize: 5,
                chartColors: [cyan, slate],
                valAxisMaxVal: Math.max(...(item.monthlyGoals || []).map(v => v || 100)) * 1.2,
                showLegend: true,
                legendPos: 'b'
            });

            // Sección de ANÁLISIS Y OBSERVACIONES (ajustada para no salirse)
            slide.addText("ANÁLISIS Y OBSERVACIONES", { x: 0.5, y: 4.2, w: '90%', fontSize: 10, bold: true, color: blue });
            slide.addShape(pres.ShapeType.rect, { x: 0.5, y: 4.5, w: '90%', h: 0.02, fill: { color: 'E2E8F0' } });

            const notes = (item.monthlyNotes || [])
                .map((n, i) => n && n.trim() ? `MES ${i + 1}: ${n}` : null)
                .filter(Boolean)
                .slice(-4); // Mostrar las últimas 4 observaciones

            const analysisText = notes.length > 0
                ? notes.join("\n")
                : "No se registraron desviaciones u observaciones críticas.";

            slide.addText(analysisText, {
                x: 0.5, y: 4.7, w: '92%', h: 1.8,
                fontSize: 10,
                color: slate,
                italic: notes.length === 0,
                align: 'left',
                valign: 'top'
            });
        });

        // 4. Slide de Cierre
        const slideFinal = pres.addSlide();
        slideFinal.background = { color: blue };
        slideFinal.addText("FIN DEL REPORTE", { x: 0.5, y: 2.8, w: '90%', fontSize: 36, color: white, bold: true, align: 'center' });
        slideFinal.addText("Generado por Prior BI Agentic Shield v5.0", { x: 0.5, y: 3.6, w: '90%', fontSize: 14, color: cyan, align: 'center' });

        pres.writeFile({ fileName: `Reporte_Ejecutivo_${contextLabel.replace(/\s+/g, '_')}_${year}.pptx` });
    };


    const reports = useMemo(() => {
        return items.map(item => {
            const compliance = calculateCompliance(item, thresholds, year);
            return {
                ...item,
                compliance
            };
        });
    }, [items, thresholds, year]);

    const observations = useMemo(() => {
        const list: { indicator: string, note: string, monthIdx: number }[] = [];
        reports.forEach(item => {
            if (item.monthlyNotes) {
                item.monthlyNotes.forEach((note, idx) => {
                    if (note && note.trim()) {
                        list.push({
                            indicator: item.indicator,
                            note: note,
                            monthIdx: idx
                        });
                    }
                });
            }
        });
        return list.sort((a, b) => b.monthIdx - a.monthIdx);
    }, [reports]);

    const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

    return (
        <div className="flex flex-col gap-6 p-4">
            <div className="flex justify-between items-center bg-slate-950/40 p-4 rounded-3xl border border-white/5 backdrop-blur-md mb-4">
                <div className="flex items-center gap-6">
                    <button
                        onClick={onClose}
                        className="p-3 px-5 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all border border-white/10 flex items-center gap-2 group"
                    >
                        <span className="group-hover:-translate-x-1 transition-transform">←</span>
                        <span className="text-[10px] font-black uppercase tracking-widest">Volver</span>
                    </button>
                    <div className="flex flex-col">
                        <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter leading-none">REPORTE EJECUTIVO</h2>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em]">{contextLabel} | {year}</span>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* 🛡️ PERMISO DE EXPORTACIÓN PPT (v5.0.0) */}
                    {(user.globalRole === 'Admin' || user.canExportPPT) && (
                        <button
                            onClick={exportToPPTX}
                            className="px-6 py-3 rounded-2xl bg-orange-600 hover:bg-orange-500 text-white transition-all shadow-xl shadow-orange-950/20 flex items-center gap-3 active:scale-95 group"
                        >
                            <span className="text-lg group-hover:rotate-12 transition-transform">📊</span>
                            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Exportar PowerPoint</span>
                        </button>
                    )}
                </div>
            </div>

            {/* 🚀 CABECERA EJECUTIVA OPTIMIZADA (v5.0.0) */}
            {/* Layout compacto: 4 columnas con métricas clave */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {/* Velocímetro Compacto */}
                <div className="bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-white/10 p-4 shadow-xl flex flex-col items-center justify-center">
                    <GaugeChart value={totalScore} label={isSingleDashboard ? "Cumplimiento" : "Global"} status={totalStatus} size={140} />
                </div>

                {/* KPI: En Meta - Diferenciado por contexto */}
                <div className="bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-white/10 p-4 shadow-xl">
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-2">
                        {isSingleDashboard ? "Indicadores en Meta" : "Tableros en Meta"}
                    </span>
                    <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-black text-emerald-400">
                            {isSingleDashboard ? indicatorStats.onTrack : groupRanking.filter(r => r.status === 'OnTrack').length}
                        </span>
                        <span className="text-lg font-bold text-slate-500">
                            / {isSingleDashboard ? indicatorStats.total : groupRanking.length}
                        </span>
                    </div>
                    <div className="mt-2 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500"
                            style={{
                                width: `${((isSingleDashboard ? indicatorStats.onTrack : groupRanking.filter(r => r.status === 'OnTrack').length) /
                                    Math.max((isSingleDashboard ? indicatorStats.total : groupRanking.length), 1)) * 100}%`
                            }}
                        />
                    </div>
                </div>

                {/* KPI: En Riesgo - Diferenciado por contexto */}
                <div className="bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-white/10 p-4 shadow-xl">
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-2">
                        {isSingleDashboard ? "Indicadores Riesgo" : "En Riesgo"}
                    </span>
                    <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-black text-amber-400">
                            {isSingleDashboard ? indicatorStats.atRisk : groupRanking.filter(r => r.status === 'AtRisk').length}
                        </span>
                        <span className="text-sm font-bold text-slate-500">
                            {isSingleDashboard ? "KPIs" : "tableros"}
                        </span>
                    </div>
                    <span className="text-[10px] text-rose-400 font-bold mt-1 block">
                        {isSingleDashboard ? indicatorStats.offTrack : groupRanking.filter(r => r.status === 'OffTrack').length} críticos
                    </span>
                </div>

                {/* KPI: Promedio / Total Indicadores */}
                <div className="bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-white/10 p-4 shadow-xl">
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-2">
                        {isSingleDashboard ? "Total KPIs" : "Promedio Grupo"}
                    </span>
                    <div className="flex items-baseline gap-1">
                        {isSingleDashboard ? (
                            <>
                                <span className="text-3xl font-black text-cyan-400">{indicatorStats.total}</span>
                                <span className="text-sm font-bold text-slate-500">indicadores</span>
                            </>
                        ) : (
                            <span className={`text-3xl font-black ${groupAverage >= 95 ? 'text-emerald-400' : groupAverage >= 80 ? 'text-amber-400' : 'text-rose-400'}`}>
                                {Math.round(groupAverage)}%
                            </span>
                        )}
                    </div>
                    <span className="text-[10px] text-cyan-400 font-bold mt-1 block">
                        {isSingleDashboard
                            ? `${indicatorStats.neutral} sin datos aún`
                            : `Meta: 100% | Brecha: ${Math.max(0, 100 - Math.round(groupAverage))} pts`
                        }
                    </span>
                </div>
            </div>

            {/* Gráfica de Tendencia - Solo si hay suficientes datos */}
            {monthsWithData >= 2 ? (
                <div className="bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-white/10 p-4 shadow-xl mb-6">
                    <div className="flex justify-between items-center mb-3">
                        <div className="flex flex-col">
                            <h3 className="text-white font-black text-xs uppercase tracking-[0.15em]">Evolución {year}</h3>
                            <span className="text-[9px] font-bold text-slate-500 uppercase">{contextLabel}</span>
                        </div>
                        <span className="text-[9px] font-bold text-cyan-400 bg-cyan-400/10 px-2 py-1 rounded-full uppercase">
                            {monthNames[currentMonthIdx]} {year}
                        </span>
                    </div>
                    <div className="h-[120px]">
                        <LineChart
                            progressData={monthlyTrendData}
                            goalData={Array(12).fill(100)}
                            unit="%"
                            type="average"
                            status={totalStatus}
                            indicator="dashboard-trend"
                        />
                    </div>
                </div>
            ) : (
                <div className="bg-slate-900/40 rounded-2xl border border-dashed border-slate-700 p-4 mb-6 text-center">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                        📊 Gráfica de tendencia disponible a partir de 2 meses con datos
                    </span>
                </div>
            )}

            {/* Ranking de UNEs / Sucursales */}
            {groupRanking.length > 1 && (
                <div className="bg-slate-900/40 backdrop-blur-md rounded-[2.5rem] border border-white/5 p-8 shadow-2xl">
                    <h3 className="text-white font-black text-xs uppercase tracking-[0.3em] mb-8 flex items-center gap-3">
                        <span className="w-1.5 h-6 bg-indigo-500 rounded-full shadow-[0_0_10px_#6366f1]"></span>
                        Ranking de Desempeño: {activeGroupName}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {groupRanking.slice(0, 4).map((r, idx) => (
                            <div key={r.id} className={`p-6 rounded-2xl border transition-all ${r.id === currentDashboardId ? 'bg-indigo-600/20 border-indigo-500/50 shadow-lg' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}>
                                <div className="flex justify-between items-start mb-4">
                                    <span className="text-[20px] font-black opacity-20">{idx + 1}</span>
                                    {/* 🚦 SEMÁFORO MEJORADO (v4.3.0) */}
                                    <div className="relative">
                                        <div className={`absolute inset-0 rounded-full blur-md opacity-60 ${r.status === 'OnTrack' ? 'bg-emerald-500' : r.status === 'AtRisk' ? 'bg-amber-500' : r.status === 'OffTrack' ? 'bg-rose-500' : 'bg-slate-500'}`} />
                                        <div className={`relative w-6 h-6 rounded-full border-2 border-slate-950/20 ${r.status === 'OnTrack' ? 'bg-emerald-500' : r.status === 'AtRisk' ? 'bg-amber-500' : r.status === 'OffTrack' ? 'bg-rose-500' : 'bg-slate-500'}`} />
                                    </div>
                                </div>
                                <h4 className="text-[11px] font-black text-white uppercase tracking-tight mb-2 truncate">{r.title}</h4>
                                <div className="flex items-baseline gap-1">
                                    <span className={`text-2xl font-black ${r.status === 'OnTrack' ? 'text-emerald-400' : r.status === 'AtRisk' ? 'text-amber-400' : 'text-rose-400'}`}>{Math.round(r.score)}</span>
                                    <span className="text-[10px] font-bold text-slate-500">%</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {observations.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Detalle por Indicador */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-slate-950/40 backdrop-blur-md rounded-[2rem] border border-white/5 p-8 shadow-2xl">
                            <h3 className="text-white font-bold text-xs uppercase tracking-[0.2em] mb-8 flex items-center gap-3">
                                <span className="w-1.5 h-6 bg-cyan-500 rounded-full shadow-[0_0_10px_#22d3ee]"></span>
                                Desglose de Resultados
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                                {reports.map((item) => (
                                    <div key={item.id} className="bg-white/5 p-4 rounded-2xl border border-white/5 hover:bg-white/10 transition-all group">
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="flex flex-col">
                                                <span className="text-white/40 text-[9px] font-black uppercase tracking-widest mb-1">KPI</span>
                                                <span className="text-white text-[11px] font-bold leading-tight group-hover:text-cyan-400 transition-colors">
                                                    {item.indicator}
                                                </span>
                                            </div>
                                            <div className="flex flex-col items-end">
                                                <span className="text-white/40 text-[9px] font-black uppercase tracking-widest mb-1">Valor</span>
                                                <span className="text-white text-xs font-black tabular-nums">
                                                    {Math.round(item.compliance.overallPercentage)}%
                                                </span>
                                            </div>
                                        </div>
                                        <ProgressBar
                                            percentage={item.compliance.overallPercentage}
                                            status={item.compliance.complianceStatus}
                                            showLabel={false}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Feed de Observaciones Críticas */}
                    <div className="bg-slate-950/40 backdrop-blur-md rounded-[2rem] border border-white/5 overflow-hidden shadow-2xl flex flex-col h-[600px]">
                        <div className="bg-white/5 p-6 border-b border-white/5">
                            <h3 className="text-white font-bold text-xs tracking-widest uppercase mb-1 flex items-center gap-2">
                                <span>💬</span> Feedback Ejecutivo
                            </h3>
                            <p className="text-white/30 text-[9px] font-medium uppercase tracking-wider">Últimas alertas y justificaciones</p>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                            {observations.map((obs, idx) => (
                                <div key={idx} className="bg-slate-900/60 rounded-2xl p-4 border border-white/5 hover:border-cyan-500/30 transition-all hover:bg-slate-900/80 group/obs">
                                    <div className="flex justify-between items-center mb-3">
                                        <span className="text-[9px] font-black text-white/50 bg-white/5 px-2 py-1 rounded-md uppercase border border-white/5">{monthNames[obs.monthIdx]}</span>
                                        <div className="flex items-center gap-2">
                                            {onEditItem && (
                                                <button
                                                    onClick={() => onEditItem(reports.find(r => r.indicator === obs.indicator)?.id || 0)}
                                                    className="opacity-0 group-hover/obs:opacity-100 p-1.5 bg-cyan-600/10 text-cyan-400 rounded-lg hover:bg-cyan-600 hover:text-white transition-all scale-90"
                                                    title="Editar este indicador"
                                                >
                                                    ✏️
                                                </button>
                                            )}
                                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 shadow-[0_0_5px_#22d3ee]"></span>
                                        </div>
                                    </div>
                                    <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-tight block mb-2">{obs.indicator}</span>
                                    <p className="text-white/70 text-[11px] leading-relaxed italic border-l-2 border-white/10 pl-3">
                                        &quot;{obs.note}&quot;
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {!observations.length && (
                <div className="bg-slate-950/40 backdrop-blur-md rounded-[2rem] border border-white/5 p-8 shadow-2xl">
                    <h3 className="text-white font-bold text-xs uppercase tracking-[0.2em] mb-8 flex items-center gap-3">
                        <span className="w-1.5 h-6 bg-cyan-500 rounded-full shadow-[0_0_10px_#22d3ee]"></span>
                        Resultados Detallados
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                        {reports.map((item) => (
                            <div key={item.id} className="bg-white/5 p-4 rounded-2xl border border-white/5 hover:bg-white/10 transition-all group">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex flex-col">
                                        <span className="text-white/40 text-[9px] font-black uppercase tracking-widest mb-1">KPI</span>
                                        <span className="text-white text-[11px] font-bold leading-tight group-hover:text-cyan-400 transition-colors">
                                            {item.indicator}
                                        </span>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <span className="text-white/40 text-[9px] font-black uppercase tracking-widest mb-1">Valor</span>
                                        <span className="text-white text-xs font-black tabular-nums">
                                            {Math.round(item.compliance.overallPercentage)}%
                                        </span>
                                    </div>
                                </div>
                                <ProgressBar
                                    percentage={item.compliance.overallPercentage}
                                    status={item.compliance.complianceStatus}
                                    showLabel={false}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
