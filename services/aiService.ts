import { Dashboard } from '../types';

export interface AIAnalysisResult {
    summary: string;
    strengths: string[];
    alerts: string[];
    recommendations: string[];
    forecast?: string;
    criticalNotesSumary?: string;
}

export const aiService = {
    analyzeDashboard: async (dashboard: Dashboard): Promise<AIAnalysisResult> => {
        // Simulación de procesamiento de lenguaje natural y análisis cruzado (v3.9.0)
        await new Promise(resolve => setTimeout(resolve, 2000));

        const alerts: string[] = [];
        const strengths: string[] = [];
        const recommendations: string[] = [];
        const monthlyNotes = (dashboard.items || []).flatMap(it => it.monthlyNotes || []).filter(n => n.length > 5);

        let totalProgressCurrentMonth = 0;
        let totalGoalCurrentMonth = 0;
        const currentMonthIdx = new Date().getMonth();

        dashboard.items.forEach(item => {
            const progress = item.monthlyProgress[currentMonthIdx] || 0;
            const goal = item.monthlyGoals[currentMonthIdx] || 0;
            totalProgressCurrentMonth += progress;
            totalGoalCurrentMonth += goal;

            // Análisis de Brecha y Tendencia
            const compliance = goal > 0 ? (progress / goal) : 0;
            const avgHistorical = item.monthlyProgress.filter(p => p > 0).reduce((a, b) => a + b, 0) / (item.monthlyProgress.filter(p => p > 0).length || 1);

            if (item.goalType === 'maximize') {
                if (compliance >= 1) {
                    strengths.push(`🚀 "${item.indicator}": Meta mensual superada (${Math.round(compliance * 100)}%).`);
                } else if (compliance < 0.85) {
                    alerts.push(`⚠️ "${item.indicator}": Rezago crítico del ${Math.round((1 - compliance) * 100)}%.`);
                    if (progress < avgHistorical * 0.8) {
                        alerts.push(`📉 Alerta de Tendencia: "${item.indicator}" está rindiendo un 20% menos que su propio promedio histórico.`);
                    }
                }
            } else {
                if (progress <= goal) {
                    strengths.push(`🛡️ "${item.indicator}": Bajo control operativo (${progress} vs max ${goal}).`);
                } else {
                    alerts.push(`🚨 "${item.indicator}": Desvío detectado del ${Math.round(((progress / goal) - 1) * 100)}%.`);
                }
            }

            // Análisis "Cualitativo" (Mock de detección de causas)
            const note = item.monthlyNotes[currentMonthIdx];
            if (note && compliance < 1) {
                if (note.toLowerCase().includes('fallo') || note.toLowerCase().includes('problema') || note.toLowerCase().includes('error')) {
                    recommendations.push(`Causa detectada en "${item.indicator}": La incidencia reportada ("${note.substring(0, 30)}...") requiere intervención técnica inmediata.`);
                }
            }
        });

        // Predicción de Cierre (Forecasting v3.9.0)
        const currentDay = new Date().getDate();
        const daysInMonth = new Date(new Date().getFullYear(), currentMonthIdx + 1, 0).getDate();
        const pace = currentDay / daysInMonth;
        const projectedFinal = (totalProgressCurrentMonth / pace);
        const projectedCompliance = totalGoalCurrentMonth > 0 ? (projectedFinal / totalGoalCurrentMonth) : 0;

        let forecastMsg = `Al ritmo actual (${Math.round(pace * 100)}% del tiempo transcurrido), se proyecta un cierre de mes al ${Math.round(projectedCompliance * 100)}% de efectividad global.`;

        if (projectedCompliance < 0.9) {
            forecastMsg += " ⚠️ Se requiere acción correctiva para evitar cierre en Rojo.";
            recommendations.push("Acelerar cierres operativos en la última semana para mitigar la brecha proyectada.");
        } else {
            forecastMsg += " ✅ El equipo mantiene un ritmo saludable hacia el 100%.";
        }

        // Síntesis Ejecutiva (Nivel CEO)
        const summary = `Análisis Estratégico "${dashboard.title}": El tablero presenta un cumplimiento actual del ${Math.round((totalGoalCurrentMonth > 0 ? totalProgressCurrentMonth / totalGoalCurrentMonth : 0) * 100)}%. Se identificaron ${alerts.filter(a => a.includes('⚠️') || a.includes('🚨')).length} riesgos operativos y ${strengths.length} pilares de estabilidad.`;

        return {
            summary,
            strengths: strengths.slice(0, 4),
            alerts: alerts.slice(0, 4),
            recommendations: recommendations.slice(0, 3),
            forecast: forecastMsg,
            criticalNotesSumary: monthlyNotes.length > 0 ? `Resumen de Incidencias: Se detectaron temas recurrentes relacionados con "${monthlyNotes[0].split(' ')[0]}" que impactan el desempeño.` : undefined
        };
    }
};
