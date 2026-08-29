import { Dashboard, DashboardItem, ComplianceThresholds } from '../types';
import { resolveOperationalIdentity } from './operationalControl';
import { 
  isAccumulativeIndicator, 
  calculateMonthlyCompliancePercentage, 
  parsePeriodToIndex
} from './compliance';

export interface OperationalSnapshot {
  periodIdx: number;
  periodLabel: string;
  captureRate: number;
  realOperationalScore: number;
  operationalHealthScore: number;
  operationalReliabilityScore: number;
  stalenessDays: number;
}

export interface KPIHistory {
  id: string | number;
  indicator: string;
  direction: string;
  area: string;
  snapshots: OperationalSnapshot[];
  stabilityScore: number;
  maturityLevel: 'Reactivo' | 'Básico' | 'Controlado' | 'Maduro' | 'Enterprise';
  anomalies: string[];
  audit: {
    lastUpdatedAt: string;
    lastUpdatedBy: string;
    previousCaptureRate: number;
    previousOperationalScore: number;
    previousHealthScore: number;
    channelIntegrationReady: {
      email: boolean;
      push: boolean;
      whatsapp: boolean;
    };
  };
}

/**
 * Genera un snapshot analítico del KPI a un mes específico de corte.
 * Simula de forma inmutable el estado histórico del mes m evaluando el rango [startIdx, m].
 */
export const getKPISnapshotAtMonth = (
  item: DashboardItem,
  thresholds: ComplianceThresholds,
  year: number,
  m: number
): OperationalSnapshot => {
  const months = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
  
  // 1. Resolver inicio operativo
  let startIdx = 0;
  if (item.operationalStartPeriod !== undefined) {
    startIdx = parsePeriodToIndex(item.operationalStartPeriod);
  }

  // Si startIdx es mayor que el mes solicitado, forzar a startIdx o m
  if (startIdx > m) {
    startIdx = m;
  }

  // 2. Definir rango de evaluación de startIdx a m
  const expectedPeriods = Math.max(0, m - startIdx + 1);

  let capturedPeriods = 0;
  const missingPeriodsList: number[] = [];

  const progressArr = Array.isArray(item.monthlyProgress) ? item.monthlyProgress : Array(12).fill(null);
  const goalsArr = Array.isArray(item.monthlyGoals) ? item.monthlyGoals : Array(12).fill(0);

  for (let idx = startIdx; idx <= m; idx++) {
    const val = progressArr[idx];
    const goal = goalsArr[idx];

    const isNullVal = val === null || val === undefined || val === "" || isNaN(Number(val));
    const isNullGoal = goal === null || goal === undefined || goal === "" || isNaN(Number(goal));
    
    const isGoalZero = Number(goal || 0) === 0;
    const isValZero = Number(val || 0) === 0;

    const isCaptured = !isNullVal && !isNullGoal && !(isGoalZero && isValZero);

    if (isCaptured) {
      capturedPeriods++;
    } else {
      missingPeriodsList.push(idx);
    }
  }

  const missingPeriods = expectedPeriods - capturedPeriods;
  const captureRate = expectedPeriods > 0 ? (capturedPeriods / expectedPeriods) * 100 : 100;

  // Calcular cumplimiento real de este KPI para el rango [startIdx, m]
  const isAccumulative = isAccumulativeIndicator(item.indicator, (item as any).type);
  const lowerIsBetter = item.goalType === 'minimize' || (item as any).type === 'minimize' || (item as any).type === 'lower' || (item as any).type === 'min';

  let realOperationalScore = 0;

  if (expectedPeriods === 0) {
    realOperationalScore = 100;
  } else if (isAccumulative) {
    let sumProgress = 0;
    let sumTarget = 0;

    for (let idx = startIdx; idx <= m; idx++) {
      const val = progressArr[idx];
      const goal = goalsArr[idx];

      const isNullVal = val === null || val === undefined || val === "" || isNaN(Number(val));
      const isNullGoal = goal === null || goal === undefined || goal === "" || isNaN(Number(goal));
      const isGoalZero = Number(goal || 0) === 0;
      const isValZero = Number(val || 0) === 0;
      const isCaptured = !isNullVal && !isNullGoal && !(isGoalZero && isValZero);

      if (isCaptured) {
        sumProgress += Number(val ?? 0);
      }
      sumTarget += Number(goal ?? 0);
    }

    realOperationalScore = calculateMonthlyCompliancePercentage(sumProgress, sumTarget, lowerIsBetter);
  } else {
    let sumCompliance = 0;

    for (let idx = startIdx; idx <= m; idx++) {
      const val = progressArr[idx];
      const goal = goalsArr[idx];

      const isNullVal = val === null || val === undefined || val === "" || isNaN(Number(val));
      const isNullGoal = goal === null || goal === undefined || goal === "" || isNaN(Number(goal));
      const isGoalZero = Number(goal || 0) === 0;
      const isValZero = Number(val || 0) === 0;
      const isCaptured = !isNullVal && !isNullGoal && !(isGoalZero && isValZero);

      if (isCaptured) {
        sumCompliance += calculateMonthlyCompliancePercentage(val, goal, lowerIsBetter);
      } else {
        sumCompliance += 0;
      }
    }

    realOperationalScore = sumCompliance / expectedPeriods;
  }

  realOperationalScore = Math.max(0, Math.min(200, realOperationalScore));

  // Staleness days para el corte m
  let stalenessDays = 0;
  if (missingPeriodsList.length > 0) {
    const oldestMissingMonth = missingPeriodsList[0];
    const today = new Date();
    const endOfMissingMonth = new Date(year, oldestMissingMonth + 1, 0);
    const endOfSnapshotMonth = new Date(year, m + 1, 0);
    
    const referenceDate = today < endOfSnapshotMonth ? today : endOfSnapshotMonth;
    const diffTime = referenceDate.getTime() - endOfMissingMonth.getTime();
    stalenessDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  }

  // Freshness
  const freshness = Math.max(0, 100 - (stalenessDays * 1.66));
  
  // Confiabilidad Operativa
  const reliability = (captureRate === 100 && freshness === 100)
    ? 100
    : Math.max(0, Math.min(100, Math.round((captureRate * 0.40) + (realOperationalScore * 0.30) + (freshness * 0.20))));

  const healthScore = Math.max(0, Math.min(100, Math.round((captureRate * 0.40) + (realOperationalScore * 0.40) + (freshness * 0.20))));

  return {
    periodIdx: m,
    periodLabel: months[m] || `M${m + 1}`,
    captureRate: Math.round(captureRate),
    realOperationalScore: Math.round(realOperationalScore),
    operationalHealthScore: healthScore,
    operationalReliabilityScore: reliability,
    stalenessDays
  };
};

/**
 * Evalúa las anomalías en el historial del KPI.
 */
export const detectAnomalies = (snapshots: OperationalSnapshot[]): string[] => {
  const anomalies: string[] = [];
  if (snapshots.length < 2) return anomalies;

  for (let i = 1; i < snapshots.length; i++) {
    const prev = snapshots[i - 1];
    const curr = snapshots[i];

    // 1. Captura masiva tardía
    if (curr.captureRate - prev.captureRate >= 50) {
      anomalies.push(`Carga masiva tardía detectada en ${curr.periodLabel} (+${Math.round(curr.captureRate - prev.captureRate)}% en un periodo)`);
    }

    // 2. Cambios extremos de cumplimiento
    const scoreDiff = Math.abs(curr.realOperationalScore - prev.realOperationalScore);
    if (scoreDiff >= 40) {
      anomalies.push(`Variación extrema de cumplimiento en ${curr.periodLabel} (${Math.round(prev.realOperationalScore)}% a ${Math.round(curr.realOperationalScore)}%)`);
    }

    // 3. Recuperación sospechosa
    if (prev.realOperationalScore < 40 && curr.realOperationalScore >= 95) {
      anomalies.push(`Recuperación sospechosa en ${curr.periodLabel} (Incremento inmediato a ${Math.round(curr.realOperationalScore)}%)`);
    }

    // 4. Volatilidad extrema consecutiva
    if (i >= 2) {
      const prevPrev = snapshots[i - 2];
      const swing1 = curr.realOperationalScore - prev.realOperationalScore;
      const swing2 = prev.realOperationalScore - prevPrev.realOperationalScore;
      if ((swing1 > 30 && swing2 < -30) || (swing1 < -30 && swing2 > 30)) {
        anomalies.push(`Patrón de volatilidad extrema consecutiva en ${curr.periodLabel}`);
      }
    }
  }

  // 5. Gap operativo activo (bajo cumplimiento + baja carga)
  const last = snapshots[snapshots.length - 1];
  if (last.realOperationalScore < 45 && last.captureRate < 50) {
    anomalies.push(`Brecha crítica: Nula captura (${last.captureRate}%) y bajo cumplimiento real (${last.realOperationalScore}%)`);
  }

  return anomalies;
};

/**
 * Calcula el score de estabilidad histórica del KPI (0 - 100).
 */
export const calculateStabilityScore = (snapshots: OperationalSnapshot[]): number => {
  if (snapshots.length === 0) return 100;
  if (snapshots.length === 1) return snapshots[0].captureRate;

  let sumDiffs = 0;
  let sumCaptureRate = 0;
  let maxStaleness = 0;

  for (let i = 0; i < snapshots.length; i++) {
    sumCaptureRate += snapshots[i].captureRate;
    maxStaleness = Math.max(maxStaleness, snapshots[i].stalenessDays);
    
    if (i > 0) {
      sumDiffs += Math.abs(snapshots[i].realOperationalScore - snapshots[i - 1].realOperationalScore);
    }
  }

  const avgCapture = sumCaptureRate / snapshots.length;
  const avgVariation = sumDiffs / (snapshots.length - 1);

  // Penalización por variación
  const variationScore = Math.max(0, 100 - (avgVariation * 2));
  
  // Penalización por rezago
  const stalenessPenalty = Math.max(0, 100 - (maxStaleness * 1.5));

  const rawStability = (avgCapture * 0.50) + (variationScore * 0.30) + (stalenessPenalty * 0.20);
  return Math.max(0, Math.min(100, Math.round(rawStability)));
};

/**
 * Clasifica la madurez operativa según estabilidad y confiabilidad.
 */
export const classifyOperationalMaturity = (
  stabilityScore: number,
  reliabilityScore: number
): 'Reactivo' | 'Básico' | 'Controlado' | 'Maduro' | 'Enterprise' => {
  const avg = (stabilityScore + reliabilityScore) / 2;
  if (avg >= 95) return 'Enterprise';
  if (avg >= 85) return 'Maduro';
  if (avg >= 70) return 'Controlado';
  if (avg >= 50) return 'Básico';
  return 'Reactivo';
};

/**
 * Construye de forma inmutable la trazabilidad, snapshots y auditoría histórica de los tableros.
 */
export const buildHistoryAndAuditEngine = (
  dashboards: Dashboard[],
  globalThresholds: ComplianceThresholds,
  year: number
): KPIHistory[] => {
  const currentMonthIdx = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const limitIdx = (year === currentYear) ? currentMonthIdx : 11;

  const historyList: KPIHistory[] = [];

  dashboards.forEach(d => {
    if (d.isAggregate || String(d.id).includes('agg-') || d.id === -1) return;

    const identity = resolveOperationalIdentity(d, d.items?.[0] || ({ indicator: '' } as DashboardItem));
    const dirName = identity.direction;
    const areaName = identity.area;
    const thresholds = d.thresholds || globalThresholds;

    (d.items || []).forEach(item => {
      // 1. Resolver inicio operativo (parsear si es necesario)
      let startIdx = 0;
      if (item.operationalStartPeriod !== undefined) {
        if (typeof item.operationalStartPeriod === 'number') {
          startIdx = item.operationalStartPeriod;
        } else {
          startIdx = parseInt(String(item.operationalStartPeriod), 10) || 0;
        }
      }

      // Evitar que el rango sea inválido
      if (startIdx > limitIdx) {
        startIdx = Math.max(0, limitIdx);
      }

      // 2. Generar snapshots mensuales históricos
      const snapshots: OperationalSnapshot[] = [];
      for (let m = startIdx; m <= limitIdx; m++) {
        snapshots.push(getKPISnapshotAtMonth(item, thresholds, year, m));
      }

      // 3. Estabilidad, confiabilidad y madurez
      const stabilityScore = calculateStabilityScore(snapshots);
      const lastSnapshot = snapshots[snapshots.length - 1];
      const lastReliability = lastSnapshot ? lastSnapshot.operationalReliabilityScore : 100;
      const maturityLevel = classifyOperationalMaturity(stabilityScore, lastReliability);

      // 4. Detección de anomalías
      const anomalies = detectAnomalies(snapshots);

      // 5. Auditoría y trazabilidad inmutable
      let lastMonthIdx = -1;
      if (item.monthlyProgress && Array.isArray(item.monthlyProgress)) {
        for (let i = 11; i >= 0; i--) {
          if (item.monthlyProgress[i] !== null && item.monthlyProgress[i] !== undefined) {
            lastMonthIdx = i;
            break;
          }
        }
      }

      const months = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
      const lastMonthName = lastMonthIdx >= 0 && lastMonthIdx < 12 ? months[lastMonthIdx] : 'N/A';

      const lastUpdatedAt = lastMonthIdx >= 0 
        ? `Periodo ${lastMonthName} / ${year}`
        : 'Sin capturas registradas';
      
      const lastUpdatedBy = (item as any).responsible || 'SIN RESPONSABLE REGISTRADO';

      // Histórico comparativo previo
      const previousSnapshot = snapshots.length > 1 ? snapshots[snapshots.length - 2] : null;
      const previousCaptureRate = previousSnapshot ? previousSnapshot.captureRate : 100;
      const previousOperationalScore = previousSnapshot ? previousSnapshot.realOperationalScore : 100;
      const previousHealthScore = previousSnapshot ? previousSnapshot.operationalHealthScore : 100;

      historyList.push({
        id: item.id,
        indicator: item.indicator,
        direction: dirName,
        area: areaName,
        snapshots,
        stabilityScore,
        maturityLevel,
        anomalies,
        audit: {
          lastUpdatedAt,
          lastUpdatedBy,
          previousCaptureRate,
          previousOperationalScore,
          previousHealthScore,
          channelIntegrationReady: {
            email: true,
            push: true,
            whatsapp: true
          }
        }
      });
    });
  });

  return historyList;
};
