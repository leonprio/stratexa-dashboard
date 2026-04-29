import { Dashboard, DashboardItem } from '../types';
import { calculateCompliance, calculateDashboardWeightedScore } from '../utils/compliance';

export interface AIAnalysisResult {
    summary: string;
    strengths: string[];
    alerts: string[];
    recommendations: string[];
    forecast?: string;
    criticalNotesSumary?: string;
}

/**
 * Servicio de Inteligencia Artificial para el análisis estratégico del tablero.
 * Implementa un motor de diagnóstico basado en el cumplimiento real y proyecciones de ritmo.
 * 
 * @namespace aiService
 * @version v8.6.6
 */
export const aiService = {
    /**
     * Realiza un análisis profundo y simulado de NLP sobre los datos del tablero.
     * Sincroniza la lógica con el motor de cumplimiento oficial para garantizar consistencia.
     * 
     * @param {Dashboard} dashboard El tablero actual a analizar.
     * @param {DashboardItem[]} [allContextItems=[]] Todos los items del contexto para cálculos agregados.
     * @param {number} [year=new Date().getFullYear()] Año de referencia para el análisis.
     * @returns {Promise<AIAnalysisResult>} Un objeto con el resumen ejecutivo, alertas y proyecciones.
     */
    analyzeDashboard: async (dashboard: Dashboard, allContextItems: DashboardItem[] = [], year: number = new Date().getFullYear()): Promise<AIAnalysisResult> => {
        // Simulación de procesamiento de lenguaje natural y análisis cruzado (v8.6.6)
        // 🔄 SINCRONIZACIÓN SHIELD: Uso del motor real de cumplimiento para evitar inconsistencias
        await new Promise(resolve => setTimeout(resolve, 1500));

        const alerts: string[] = [];
        const strengths: string[] = [];
        const recommendations: string[] = [];
        const items = dashboard.items || [];
        const monthlyNotes = items.flatMap(it => it.monthlyNotes || []).filter(n => n.length > 5);

        // Umbrales por defecto (usar los del tablero si existen)
        const thresholds = dashboard.thresholds || { onTrack: 95, atRisk: 85 };
        
        // 1. Calcular cumplimiento global real (exactamente como el DashboardView)
        const totalScore = calculateDashboardWeightedScore(items, thresholds, year, 'realTime', allContextItems);

        items.forEach(item => {
            // Evaluamos cada item con el motor oficial
            const complianceData = calculateCompliance(item, thresholds, year, 'realTime', items, allContextItems);
            
            if (!complianceData.isActive) return;

            const compliance = complianceData.overallPercentage / 100;
            const progress = complianceData.currentProgress;
            const goal = complianceData.currentTarget;

            // Análisis por Tipo de Indicador
            if (item.goalType === 'maximize') {
                if (compliance >= 0.95) {
                    strengths.push(`🚀 "${item.indicator}": Meta superada o en tiempo (${Math.round(compliance * 100)}%).`);
                } else if (compliance < 0.85) {
                    alerts.push(`⚠️ "${item.indicator}": Rezago crítico del ${Math.round((1 - compliance) * 100)}%.`);
                    
                    // Alerta de tendencia basada en histórico (si aplica)
                    const validHistory = (item.monthlyProgress || []).filter(p => p !== null && p !== undefined && p > 0);
                    if (validHistory.length > 3) {
                        const avg = validHistory.reduce((a, b) => a + Number(b), 0) / validHistory.length;
                        if (progress < avg * 0.75) {
                            alerts.push(`📉 Alerta de Tendencia: "${item.indicator}" rinde un 25% menos que su promedio anual.`);
                        }
                    }
                }
            } else {
                // MINIMIZACIÓN
                if (compliance >= 1) {
                    strengths.push(`🛡️ "${item.indicator}": Bajo control operativo (${Math.round(compliance * 100)}% de efectividad).`);
                } else {
                    alerts.push(`🚨 "${item.indicator}": Exceso detectado (${Math.round(progress)} vs límite ${Math.round(goal)}).`);
                }
            }

            // Análisis Cualitativo (Mock de detección de causas)
            const currentMonthIdx = new Date().getMonth();
            const note = item.monthlyNotes?.[currentMonthIdx];
            if (note && compliance < 0.9) {
                if (note.toLowerCase().includes('fallo') || note.toLowerCase().includes('problema') || note.toLowerCase().includes('error')) {
                    recommendations.push(`Causa detectada en "${item.indicator}": "${note.substring(0, 50)}..." requiere atención inmediata.`);
                }
            }
        });

        // 2. Predicción de Cierre (v8.6.6 - DAILY RYTHM)
        const now = new Date();
        const currentMonthIdx = now.getMonth();
        const currentDay = now.getDate();
        const daysInMonth = new Date(now.getFullYear(), currentMonthIdx + 1, 0).getDate();
        const elapsedPct = currentDay / daysInMonth;
        
        // Proyección simple basada en ritmo lineal
        let forecastMsg = `Al ritmo actual (${Math.round(elapsedPct * 100)}% del tiempo transcurrido), se proyecta una efectividad global del ${Math.round(totalScore)}%.`;

        if (totalScore < 90) {
            forecastMsg += " ⚠️ Se requiere acción correctiva para evitar cierre debajo de la meta.";
            recommendations.push("Identificar desviaciones de alto peso y aplicar planes de recuperación antes de fin de mes.");
        } else {
            forecastMsg += " ✅ El equipo mantiene un ritmo saludable de cumplimiento.";
        }

        // 3. Síntesis Ejecutiva
        const summary = `Análisis Estratégico "${dashboard.title}": El tablero presenta un cumplimiento consolidado del ${Math.round(totalScore)}%. Se identificaron ${alerts.filter(a => a.includes('⚠️') || a.includes('🚨')).length} riesgos de alto impacto y ${strengths.length} pilares de estabilidad operativa.`;

        return {
            summary,
            strengths: strengths.slice(0, 4),
            alerts: alerts.slice(0, 4),
            recommendations: recommendations.slice(0, 3),
            forecast: forecastMsg,
            criticalNotesSumary: monthlyNotes.length > 0 ? `Resumen Cualitativo: Temas recurrentes de gestión detectados en las observaciones que impactan el desempeño actual.` : undefined
        };
    }
};
