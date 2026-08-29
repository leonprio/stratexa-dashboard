import { Dashboard, DashboardItem, ComplianceThresholds } from '../types';
import { enrichDashboardsWithOperationalMetrics, resolveOperationalIdentity } from './operationalControl';
import { isOperationalPeriodCaptured } from './compliance';
import { getWeekNumber } from './weeklyUtils';

export type AlertSeverity = 'CRÍTICO' | 'REQUIERE ATENCIÓN' | 'DATOS PENDIENTES' | 'RIESGO OCULTO' | 'BAJO CONTROL' | 'SIN OBLIGACIÓN';
export type OperationalTrend = 'ESTABLE' | 'DETERIORÁNDOSE' | 'CRÍTICO' | 'NO EVALUABLE';
export type OperationalDataStatus = 'AL DÍA' | 'DATOS INCOMPLETOS' | 'DATOS VENCIDOS' | 'SIN DATOS' | 'SIN OBLIGACIÓN';

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
  dataStatus: OperationalDataStatus;
  performanceLabel: 'AL DÍA' | 'DESVIACIÓN' | 'CRÍTICO' | 'NO EVALUABLE';
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
  if (!m || m.expectedPeriods === 0) return 'SIN OBLIGACIÓN';

  const missing = m.missingPeriods;
  const captureRate = m.captureRate;
  const performanceScore = m.performanceScore;

  const isHiddenRisk = performanceScore >= 90 && captureRate < 70;
  if (m.capturedPeriods === 0) return 'DATOS PENDIENTES';
  if (performanceScore < 70) return 'CRÍTICO';
  if (performanceScore < 90) return 'REQUIERE ATENCIÓN';
  if (isHiddenRisk) return 'RIESGO OCULTO';
  if (missing > 0 || m.stalenessDays > 5) return 'DATOS PENDIENTES';
  return 'BAJO CONTROL';
};

/**
 * Determina la tendencia operativa en base al patrón de capturas recientes y días de atraso.
 */
export const calculateOperationalTrend = (item: DashboardItem): OperationalTrend => {
  const m = item.operationalMetrics;
  if (!m || m.expectedPeriods === 0 || m.capturedPeriods === 0) return 'NO EVALUABLE';

  if (m.performanceScore < 70) return 'CRÍTICO';
  if (m.performanceScore < 90) return 'DETERIORÁNDOSE';
  return 'ESTABLE';
};

export const calculateOperationalDataStatus = (item: DashboardItem): OperationalDataStatus => {
  const m = item.operationalMetrics;
  if (!m || m.expectedPeriods === 0) return 'SIN OBLIGACIÓN';
  if (m.capturedPeriods === 0) return 'SIN DATOS';
  if (m.stalenessDays >= 30 || m.missingPeriods >= 2) return 'DATOS VENCIDOS';
  if (m.missingPeriods > 0 || m.stalenessDays > 5) return 'DATOS INCOMPLETOS';
  return 'AL DÍA';
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
 * Mide únicamente suficiencia y actualidad de evidencia: captura (70%) y frescura (30%).
 */
export const calculateReliabilityScore = (item: DashboardItem): number => {
  const m = item.operationalMetrics;
  if (!m) return 100;

  const captureRate = m.captureRate;
  if (m.expectedPeriods === 0) return 100;
  const freshness = Math.max(0, 100 - (m.stalenessDays * 1.66));

  // Si está perfectamente al día (captureRate = 100 y freshness = 100), la confiabilidad es 100%
  if (captureRate === 100 && freshness === 100) {
    return 100;
  }

  // Bono/penalización por tendencia
  const rawScore = (captureRate * 0.70) + (freshness * 0.30);
  
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
      const dataStatus = calculateOperationalDataStatus(item);

      const isOvertRisk = m.missingPeriods >= 3;
      const isHiddenRisk = m.performanceScore >= 90 && m.captureRate < 70;
      const isDeteriorating = trend === 'DETERIORÁNDOSE' || trend === 'CRÍTICO';

      // Simulación inmutable de trazabilidad operativa
      // Busca el último mes cargado para simular lastUpdatedAt
      const lastCapture = findLastOperationalCapture(item, year);
      const lastUpdatedAt = lastCapture
        ? `${lastCapture.periodLabel} / ${year}`
        : 'Sin capturas registradas';
      
      const lastUpdatedBy = item.responsible || 'SIN RESPONSABLE REGISTRADO';
      const lastOperationalChange = lastCapture
        ? `Última captura: ${lastCapture.periodLabel}`
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
        dataStatus,
        performanceLabel: trend === 'NO EVALUABLE' ? 'NO EVALUABLE' : trend === 'CRÍTICO' ? 'CRÍTICO' : trend === 'DETERIORÁNDOSE' ? 'DESVIACIÓN' : 'AL DÍA',
        traceability: {
          lastUpdatedAt,
          lastUpdatedBy,
          lastOperationalChange
        }
      });
    });
  });

  // Ordenar por nivel de severidad y luego por días de atraso
  const severityWeight = { 'CRÍTICO': 6, 'REQUIERE ATENCIÓN': 5, 'RIESGO OCULTO': 4, 'DATOS PENDIENTES': 3, 'BAJO CONTROL': 2, 'SIN OBLIGACIÓN': 1 };
  return alerts.sort((a, b) => {
    return (severityWeight[b.severity] || 0) - (severityWeight[a.severity] || 0) || b.stalenessDays - a.stalenessDays;
  });
};

export const findLastOperationalCapture = (item: DashboardItem, year: number, today = new Date()): { periodIndex: number; periodLabel: string } | null => {
  const weekly = item.frequency === 'weekly';
  const progress = weekly ? item.weeklyProgress : item.monthlyProgress;
  const goals = weekly ? item.weeklyGoals : item.monthlyGoals;
  if (!Array.isArray(progress) || !Array.isArray(goals)) return null;
  const currentYear = today.getFullYear();
  const cutoff = year < currentYear ? progress.length - 1 : year > currentYear ? -1 : weekly ? getWeekNumber(today, item.weekStart === 'Sun' ? 0 : 1) - 1 : today.getMonth();
  for (let index = Math.min(cutoff, progress.length - 1); index >= 0; index--) {
    if (isOperationalPeriodCaptured(progress[index], goals[index])) return { periodIndex: index, periodLabel: weekly ? `S${index + 1}` : ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'][index] };
  }
  return null;
};
