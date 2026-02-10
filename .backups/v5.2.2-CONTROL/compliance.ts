// utils/compliance.ts
import type { DashboardItem, ComplianceThresholds } from "../types";
import { aggregateWeeklyToMonthly, getWeekNumber } from "./weeklyUtils";

// Si en tu proyecto ComplianceStatus es un enum/string union en types,
// no lo importo para no romper compilación por diferencias.
// Mantengo estos strings consistentes con la mayoría de implementaciones.
export type ComplianceStatus = "OnTrack" | "AtRisk" | "OffTrack" | "Neutral" | "InProgress";
export const CURRENT_MONTH_INDEX = new Date().getMonth();

/**
 * Devuelve el estatus (semaforo) a partir de un porcentaje (0-100+)
 */
export const getStatusForPercentage = (
  percentage: number,
  thresholds?: ComplianceThresholds,
  isActive: boolean = true,
  isClosedPeriod: boolean = true
): ComplianceStatus => {
  if (!isActive) return "Neutral";

  // 🛡️ REGLA v4.2.0: Si el periodo NO ha vencido (mes actual), semáforo temporal
  if (!isClosedPeriod) return "InProgress";

  const onTrack = thresholds?.onTrack ?? 95;
  const atRisk = thresholds?.atRisk ?? 80;

  if (!Number.isFinite(percentage)) return "OffTrack";
  if (percentage >= onTrack) return "OnTrack";
  if (percentage >= atRisk) return "AtRisk";
  return "OffTrack";
};

/**
 * Calcula porcentaje de cumplimiento mensual.
 * Soporta indicadores "lower is better" (mientras más bajo, mejor).
 *
 * REGLA CRÍTICA (integridad):
 * - Si target === 0 y actual === 0 => 0% (sin datos)  ✅ (evita el 200%)
 */
export const calculateMonthlyCompliancePercentage = (
  actual: number,
  target: number,
  lowerIsBetter: boolean
): number => {
  const a = Number(actual ?? 0);
  const t = Number(target ?? 0);

  // ✅ Caso "sin datos"
  if (t === 0 && a === 0) return 0;

  if (t === 0) {
    // Si la meta es 0, solo tiene sentido para "lower is better":
    // - si actual == 0 => perfecto; si no => 0
    if (lowerIsBetter) return a === 0 ? 100 : 0;
    // Para "higher is better": si meta 0 y hay avance, consideramos 100; si no, 0
    return a > 0 ? 100 : 0;
  }

  if (!lowerIsBetter) {
    // higher is better
    return (a / t) * 100;
  }

  // lower is better:
  // Si actual <= meta => 100 o más (mejor que meta)
  // Si actual > meta => <100
  // Usamos t/a cuando a>0, si a==0 entonces es excelente
  if (a === 0) return 100;
  return (t / a) * 100;
};

/**
 * Encuentra el último índice donde exista algún dato (meta o avance)
 * distinto de 0 (o no vacío).
 */
export const findLastIndexWithData = (
  monthlyProgress: Array<number | null | undefined>,
  monthlyGoals: Array<number | null | undefined>
): number => {
  const len = Math.max(monthlyProgress?.length ?? 0, monthlyGoals?.length ?? 0);
  for (let i = len - 1; i >= 0; i--) {
    const p = Number(monthlyProgress?.[i] ?? 0);
    const g = Number(monthlyGoals?.[i] ?? 0);
    if (p !== 0 || g !== 0) return i;
  }
  return -1;
};

/**
 * Devuelve un warning legible cuando hay meses incompletos
 * (meta sin avance o avance sin meta).
 */
export const getMissingMonthsWarning = (
  monthlyProgress: Array<number | null | undefined>,
  monthlyGoals: Array<number | null | undefined>
): string | null => {
  const months = [
    "Ene", "Feb", "Mar", "Abr", "May", "Jun",
    "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"
  ];

  const len = Math.max(monthlyProgress?.length ?? 0, monthlyGoals?.length ?? 0);
  if (len === 0) return null;

  const missing: string[] = [];

  for (let i = 0; i < len && i < 12; i++) {
    const p = Number(monthlyProgress?.[i] ?? 0);
    const g = Number(monthlyGoals?.[i] ?? 0);

    // Si uno existe y el otro no, lo marcamos como incompleto
    const hasP = p !== 0;
    const hasG = g !== 0;

    if ((hasP && !hasG) || (!hasP && hasG)) {
      missing.push(months[i] ?? `Mes ${i + 1}`);
    }
  }

  if (missing.length === 0) return null;

  return `Hay meses con datos incompletos (meta sin avance o avance sin meta): ${missing.join(
    ", "
  )}.`;
};

/**
 * Devuelve un warning si hay meses ANTERIORES al actual
 * que no tienen ni meta ni avance (están en 0).
 */
export const getOverdueWarning = (
  monthlyProgress: Array<number | null | undefined>,
  monthlyGoals: Array<number | null | undefined>
): string | null => {
  const months = [
    "Ene", "Feb", "Mar", "Abr", "May", "Jun",
    "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"
  ];

  const currentMonthIdx = new Date().getMonth(); // 0-11
  const missing: string[] = [];

  // Checar solo hasta el mes anterior al actual
  for (let i = 0; i < currentMonthIdx; i++) {
    const p = Number(monthlyProgress?.[i] ?? 0);
    const g = Number(monthlyGoals?.[i] ?? 0);

    // Si ambos son 0, asumimos que no se capturó nada
    if (p === 0 && g === 0) {
      missing.push(months[i]);
    }
  }

  if (missing.length === 0) return null;

  return `⚠️ Periodo vencido: No hay datos capturados en ${missing.join(", ")}.`;
};


/**
 * Calcula cumplimiento del indicador considerando:
 * - monthlyGoals / monthlyProgress (12 meses)
 * - frequency (si es weekly, agrega semanas a meses proporcionalmente)
 * - tipo del indicador (lower is better vs higher is better)
 * - umbrales globales (o del item si existen)
 *
 * Retorna el "mes actual" como el último con datos (meta o avance),
 * y porcentaje global con base en ese mes.
 */
export const calculateCompliance = (
  item: DashboardItem,
  globalThresholds: ComplianceThresholds,
  year: number = new Date().getFullYear(),
  mode: 'realTime' | 'definitive' = 'realTime'
) => {
  let monthlyProgress = (item as any).monthlyProgress ?? [];
  let monthlyGoals = (item as any).monthlyGoals ?? [];

  // 🔄 AGREGACIÓN SEMANAL: Si el indicador es semanal, transformamos a mensual para el semáforo
  // 🔄 AGREGACIÓN SEMANAL: Si el indicador es semanal, transformamos a mensual para el semáforo
  if (item.frequency === 'weekly') {
    const startDay = item.weekStart === 'Sun' ? 0 : 1;
    let maxWeekIdx: number | undefined = undefined;

    // Si estamos en el año actual, limitamos hasta la semana ANTERIOR a la actual (periodo vencido)
    if (year === new Date().getFullYear()) {
      maxWeekIdx = getWeekNumber(new Date(), startDay) - 2;
      // Si maxWeekIdx es -1, no se incluirá ninguna semana (solo periodos cerrados)
    }

    // Determinar modo de agregación basado en el tipo de indicador
    const aggMode = item.type === 'accumulative' ? 'sum' : 'average';

    monthlyProgress = aggregateWeeklyToMonthly(item.weeklyProgress || [], year, startDay, maxWeekIdx, aggMode);
    monthlyGoals = aggregateWeeklyToMonthly(item.weeklyGoals || [], year, startDay, maxWeekIdx, aggMode);
  }

  // Identificar si es acumulativo
  const isAccumulative = item.type === 'accumulative';

  // Identificar si es minización
  const lowerIsBetter = item.goalType === 'minimize' || (item as any).type === 'minimize' || (item as any).type === 'lower' || (item as any).type === 'min';

  // Umbrales: primero del item (si existen), si no globales
  const thresholds: ComplianceThresholds =
    (item as any).thresholds ?? globalThresholds;

  const currentYear = new Date().getFullYear();
  const currentMonthIdx = new Date().getMonth();

  // 🛡️ CLAMPING TEMPORAL (v2.2.3): El semáforo solo considera periodos VENCIDOS.
  let limitIdx = 11; // Por defecto todo el año (para años pasados)
  if (year === currentYear) {
    // Si es semanal, la agregación ya filtró las semanas abiertas. Permitimos el mes actual.
    if (item.frequency === 'weekly') {
      limitIdx = currentMonthIdx;
    } else {
      // Para mensual, estrictamente meses cerrados. (Si es Enero, limitIdx será -1)
      limitIdx = currentMonthIdx - 1;
    }
  } else if (year > currentYear) {
    limitIdx = -1; // Año futuro, nada cuenta
  }

  const lastIdxWithData = findLastIndexWithData(monthlyProgress, monthlyGoals);
  // 🛡️ MODOS DE CÁLCULO (v4.2.0): 
  // - Permite ver el mes actual si tiene datos, pero lo marca como "abierto".
  const idx = mode === 'definitive'
    ? limitIdx
    : Math.min(lastIdxWithData >= 0 ? lastIdxWithData : 0, currentMonthIdx); // Permitimos hasta hoy si hay datos

  let currentProgress = 0;
  let currentTarget = 0;

  if (idx === -1) {
    // Año futuro o sin periodos válidos
    currentProgress = 0;
    currentTarget = 0;
  } else if (isAccumulative) {
    // ➕ SUMATORIA: Sumar desde enero hasta el índice límite
    for (let i = 0; i <= idx; i++) {
      currentProgress += Number(monthlyProgress[i] ?? 0);
      currentTarget += Number(monthlyGoals[i] ?? 0);
    }
  } else {
    let sumProgress = 0;
    let sumTarget = 0;
    let count = 0;

    for (let i = 0; i <= idx; i++) {
      const p = Number(monthlyProgress[i] ?? 0);
      const g = Number(monthlyGoals[i] ?? 0);

      if (g !== 0 || p !== 0) {
        sumProgress += p;
        sumTarget += g;
        count++;
      }
    }

    if (count > 0) {
      currentProgress = sumProgress / count;
      currentTarget = sumTarget / count;
    } else {
      currentProgress = 0;
      currentTarget = 0;
    }
  }

  const overallPercentage = calculateMonthlyCompliancePercentage(
    currentProgress,
    currentTarget,
    lowerIsBetter
  );

  // Determinar si el indicador está "activo" este mes (tiene meta capturada)
  const hasTarget = currentTarget !== 0 || currentProgress !== 0;

  // PERIODOS CERRADOS: Un periodo es cerrado si el índice es < al mes actual (o es año pasado)
  const isClosedPeriod = (year < currentYear) ? true : (idx < currentMonthIdx);

  const complianceStatus = getStatusForPercentage(overallPercentage, thresholds, hasTarget, isClosedPeriod);

  return {
    currentProgress,
    currentTarget,
    overallPercentage,
    complianceStatus,
    isActive: hasTarget
  };
};

/**
 * Calcula el puntaje total ponderado de un tablero.
 * Soma (Cumplimiento_Item * Peso_Item) / 100
 */
export const calculateDashboardWeightedScore = (
  items: DashboardItem[],
  globalThresholds: ComplianceThresholds,
  year: number = new Date().getFullYear(),
  mode: 'realTime' | 'definitive' = 'realTime'
) => {
  if (!items || items.length === 0) return 0;

  let totalWeightedScore = 0;
  let totalWeightFound = 0;

  items.forEach(item => {
    const { overallPercentage, isActive } = calculateCompliance(item, globalThresholds, year, mode);

    // 🛡️ PRORRATEO DINÁMICO: Si el indicador no tiene meta/datos para el periodo, 
    // su peso se redistribuye entre los demás al no sumarlo al denominador.
    if (!isActive) return;

    const cappedPercentage = Math.min(overallPercentage, 200);
    totalWeightedScore += (cappedPercentage * (item.weight || 0));
    totalWeightFound += (item.weight || 0);
  });

  if (totalWeightFound === 0) return 0;

  // Normalizamos el score final basado EN LOS PESOS ACTIVOS
  return Number((totalWeightedScore / totalWeightFound).toFixed(1));
};

/**
 * Calcula los puntajes mensuales ponderados de un tablero (v4.1.4).
 * Útil para gráficas de tendencia que respeten la redistribución de pesos por periodo.
 */
export const calculateDashboardMonthlyScores = (
  items: DashboardItem[],
  globalThresholds: ComplianceThresholds,
  year: number = new Date().getFullYear(),
  limitMonthIdx: number = 11
) => {
  const scores: (number | null)[] = Array(12).fill(null);

  for (let m = 0; m <= limitMonthIdx; m++) {
    let monthlyWeightedSum = 0;
    let monthlyWeightTotal = 0;
    let hasAnyData = false;

    items.forEach(item => {
      const p = Number(item.monthlyProgress?.[m] ?? 0);
      const g = Number(item.monthlyGoals?.[m] ?? 0);

      // Si no hay meta ni avance este mes, este item NO cuenta para este mes
      if (p === 0 && g === 0) return;

      const lowerIsBetter = item.goalType === 'minimize';
      const monthlyPct = calculateMonthlyCompliancePercentage(p, g, lowerIsBetter);
      const cappedPct = Math.min(monthlyPct, 200);

      monthlyWeightedSum += (cappedPct * (item.weight || 0));
      monthlyWeightTotal += (item.weight || 0);
      hasAnyData = true;
    });

    if (hasAnyData && monthlyWeightTotal > 0) {
      scores[m] = Number((monthlyWeightedSum / monthlyWeightTotal).toFixed(1));
    }
  }

  return scores;
};
