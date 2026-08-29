import { Dashboard, DashboardItem, ComplianceThresholds } from '../types';
import { enrichDashboardsWithOperationalMetrics, resolveOperationalIdentity } from './operationalControl';

export type AlertSeverity = 'CRÍTICO' | 'ALTO' | 'MEDIO' | 'BAJO' | 'NINGUNO';
export type OperationalTrend = 'MEJORANDO' | 'ESTABLE' | 'DETERIORÁNDOSE' | 'CRÍTICO';

export interface OperationalAlert {
  id: string | number;
  indicator: string;
  direction: string;
  area: string;
  severity: AlertSeverity;
  trend: OperationalTrend;
  agingLabel: string;
  reliabilityScore: number;
  captureRate: number;
  stalenessDays: number;
  missingPeriods: number;
  performanceScore: number;
  realOperationalScore: number;
  isOvertRisk: boolean; // Alerta Roja: 3+ periodos vencidos
  isHiddenRisk: boolean; // Riesgo Oculto: Alto desempeño + baja captura
  isDeteriorating: boolean; // Deterioro Operativo: Caída de captureRate o consistencia
  traceability: {
    lastUpdatedAt: string;
    lastUpdatedBy: string;
    lastOperationalChange: string;
  };
}

/**
 * Calcula la severidad de la alerta en base a periodos faltantes y riesgos cruzados.
 */
export const calculateAlertSeverity = (item: DashboardItem): AlertSeverity => {
  const m = item.operationalMetrics;
  if (!m) return 'NINGUNO';

  const missing = m.missingPeriods;
  const captureRate = m.captureRate;
  const performanceScore = m.performanceScore;

  // 1. Alerta Crítica: 3+ periodos vencidos o retraso mayor a 60 días
  if (missing >= 3 || m.stalenessDays >= 60) return 'CRÍTICO';

  // 2. Alerta Alta: 2 periodos vencidos o Riesgo Oculto (alto kpi, baja captura)
  const isHiddenRisk = performanceScore >= 90 && captureRate < 70;
  if (missing === 2 || isHiddenRisk || m.stalenessDays >= 30) return 'ALTO';

  // 3. Alerta Media: 1 periodo vencido
  if (missing === 1 || m.stalenessDays > 5) return 'MEDIO';

  // 4. Alerta Baja: Carga irregular o rezago mínimo
  if (captureRate < 95) return 'BAJO';

  return 'NINGUNO';
};

/**
 * Determina la tendencia operativa en base al patrón de capturas recientes y días de atraso.
 */
export const calculateOperationalTrend = (item: DashboardItem): OperationalTrend => {
  const m = item.operationalMetrics;
  if (!m) return 'ESTABLE';

  const missing = m.missingPeriods;
  const staleness = m.stalenessDays;
  const captureRate = m.captureRate;

  // Si tiene un retraso severo acumulándose
  if (missing >= 3 || staleness >= 60) return 'CRÍTICO';

  // Simular análisis de consistencia de los últimos 3 meses esperados
  // Si captureRate es bajo o hay retrasos en aumento, se está deteriorando
  if (missing >= 1 && staleness >= 30) return 'DETERIORÁNDOSE';
  if (captureRate < 75 && missing > 0) return 'DETERIORÁNDOSE';

  // Si tiene retraso pero menor a 15 días y captureRate es alto
  if (missing > 0 && staleness <= 15 && captureRate >= 85) return 'MEJORANDO';

  // Totalmente al día
  if (missing === 0 && staleness === 0 && captureRate >= 95) return 'ESTABLE';

  return 'ESTABLE';
};

/**
 * Clasifica la antigüedad o envejecimiento (aging) del rezago de captura.
 */
export const calculateOperationalAging = (item: DashboardItem): string => {
  const m = item.operationalMetrics;
  if (!m || m.stalenessDays === 0) return 'Al día';

  const days = m.stalenessDays;
  if (days <= 15) return '1-15d (Reciente)';
  if (days <= 30) return '16-30d (Moderado)';
  if (days <= 60) return '31-60d (Severo)';
  return '61d+ (Crítico)';
};

/**
 * Calcula el score de confiabilidad operativa (operationalReliabilityScore).
 * Integra captureRate (40%), realOperationalScore (30%), freshness (20%) y penalización/bono de tendencia (10%).
 */
export const calculateReliabilityScore = (item: DashboardItem): number => {
  const m = item.operationalMetrics;
  if (!m) return 100;

  const captureRate = m.captureRate;
  const realScore = m.realOperationalScore;

  // Freshness: 0 días = 100%, 60 días o más = 0%
  const freshness = Math.max(0, 100 - (m.stalenessDays * 1.66));

  // Si está perfectamente al día (captureRate = 100 y freshness = 100), la confiabilidad es 100%
  if (captureRate === 100 && freshness === 100) {
    return 100;
  }

  // Bono/penalización por tendencia
  const trend = calculateOperationalTrend(item);
  let trendAdjustment = 0;
  if (trend === 'MEJORANDO') trendAdjustment = 10;
  if (trend === 'DETERIORÁNDOSE') trendAdjustment = -10;
  if (trend === 'CRÍTICO') trendAdjustment = -20;

  const rawScore = (captureRate * 0.40) + (realScore * 0.30) + (freshness * 0.20) + (trendAdjustment * 0.10);
  
  // Acotar matemáticamente entre 0 y 100
  return Math.max(0, Math.min(100, Math.round(rawScore)));
};

/**
 * Construye de forma inmutable la lista completa de alertas operativas del sistema.
 */
export const buildOperationalAlerts = (
  dashboards: Dashboard[],
  globalThresholds: ComplianceThresholds,
  year: number
): OperationalAlert[] => {
  const enriched = enrichDashboardsWithOperationalMetrics(dashboards, globalThresholds, year);
  const alerts: OperationalAlert[] = [];

  enriched.forEach(d => {
    // Evitar duplicar agregando tableros consolidados en el listado unitario
    if (d.isAggregate || String(d.id).includes('agg-') || d.id === -1) return;

    (d.items || []).forEach(item => {
      const identity = resolveOperationalIdentity(d, item);
      const m = item.operationalMetrics;
      if (!m) return;

      const severity = calculateAlertSeverity(item);
      const trend = calculateOperationalTrend(item);
      const agingLabel = calculateOperationalAging(item);
      const reliabilityScore = calculateReliabilityScore(item);

      const isOvertRisk = m.missingPeriods >= 3;
      const isHiddenRisk = m.performanceScore >= 90 && m.captureRate < 70;
      const isDeteriorating = trend === 'DETERIORÁNDOSE' || trend === 'CRÍTICO';

      // Simulación inmutable de trazabilidad operativa
      // Busca el último mes cargado para simular lastUpdatedAt
      let lastMonthIdx = -1;
      if (item.progress && typeof item.progress === 'object') {
        const keys = Object.keys(item.progress).map(Number).sort((a, b) => b - a);
        const validKey = keys.find(k => item.progress[k] !== null && item.progress[k] !== undefined);
        if (validKey !== undefined) lastMonthIdx = validKey;
      }

      const months = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
      const lastMonthName = lastMonthIdx >= 0 && lastMonthIdx < 12 ? months[lastMonthIdx] : 'N/A';
      
      const lastUpdatedAt = lastMonthIdx >= 0 
        ? `Periodo ${lastMonthName} / 2026`
        : 'Sin capturas registradas';
      
      const lastUpdatedBy = item.responsible || 'SIN RESPONSABLE REGISTRADO';
      const lastOperationalChange = lastMonthIdx >= 0 
        ? `Carga de datos periodo ${lastMonthName}`
        : 'KPI creado en sistema';

      alerts.push({
        id: item.id,
        indicator: item.indicator,
        direction: identity.direction,
        area: identity.area,
        severity,
        trend,
        agingLabel,
        reliabilityScore,
        captureRate: m.captureRate,
        stalenessDays: m.stalenessDays,
        missingPeriods: m.missingPeriods,
        performanceScore: m.performanceScore,
        realOperationalScore: m.realOperationalScore,
        isOvertRisk,
        isHiddenRisk,
        isDeteriorating,
        traceability: {
          lastUpdatedAt,
          lastUpdatedBy,
          lastOperationalChange
        }
      });
    });
  });

  // Ordenar por nivel de severidad y luego por días de atraso
  const severityWeight = { 'CRÍTICO': 4, 'ALTO': 3, 'MEDIO': 2, 'BAJO': 1, 'NINGUNO': 0 };
  return alerts.sort((a, b) => {
    return (severityWeight[b.severity] || 0) - (severityWeight[a.severity] || 0) || b.stalenessDays - a.stalenessDays;
  });
};
