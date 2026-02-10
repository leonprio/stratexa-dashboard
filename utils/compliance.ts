// utils/compliance.ts
import type { DashboardItem, ComplianceThresholds } from "../types";
import { aggregateWeeklyToMonthly, getWeekNumber } from "./weeklyUtils";

// Si en tu proyecto ComplianceStatus es un enum/string union en types,
// no lo importo para no romper compilación por diferencias.
// Mantengo estos strings consistentes con la mayoría de implementaciones.
export type ComplianceStatus = "OnTrack" | "AtRisk" | "OffTrack" | "Neutral" | "InProgress";
export const CURRENT_MONTH_INDEX = new Date().getMonth();

/**
 * 🚀 MOTOR DE FÓRMULAS v6.0.0
 * Evalúa expresiones aritméticas dinámicas basadas en otros indicadores.
 * Soporta variables por ID: {id:101} o por nombre (slugified).
 */
export const evaluateFormula = (
  formula: string,
  allDashboardItems: DashboardItem[],
  monthIdx: number,
  field: 'monthlyProgress' | 'monthlyGoals' = 'monthlyProgress'
): number => {
  if (!formula) return 0;

  try {
    let expression = formula;

    // 1. Reemplazar {id:XXX} con el valor real
    const idRegex = /\{id:([^}]+)\}/g;
    expression = expression.replace(idRegex, (_, id) => {
      const depItem = allDashboardItems.find(it => String(it.id) === String(id));
      if (!depItem) return "0";
      const val = (depItem as any)[field]?.[monthIdx];
      return String(Number(val) || 0);
    });

    // 2. Limpieza básica por seguridad (solo permitir números y operadores)
    // eslint-disable-next-line no-useless-escape
    if (/[^0-9\.\+\-\*\/\(\)\s]/.test(expression)) {
      console.warn(`[FORMULA] Expresión insegura omitida: ${expression}`);
      return 0;
    }

    // 3. Evaluación aritmética segura
    // eslint-disable-next-line no-eval
    const result = eval(expression);
    return isFinite(result) ? result : 0;
  } catch (e) {
    console.error(`[FORMULA] Error evaluando "${formula}":`, e);
    return 0;
  }
};

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
    // v5.5.9.4-PRO+ • INTEGRITY GUARANTEED
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

  return `Hay meses con datos incompletos (meta sin avance o avance sin meta): ${missing.join(", ")}.`;
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
  mode: 'realTime' | 'definitive' = 'realTime',
  allDashboardItems: DashboardItem[] = []
) => {
  let monthlyProgress = [...((item as any).monthlyProgress || [])];
  let monthlyGoals = [...((item as any).monthlyGoals || [])];

  // 🛡️ REGLA v6.0.0 (INTELLIGENT INDICATORS)
  // Si el indicador es compuesto o fórmula, sobreescribimos los valores locales con cálculos dinámicos
  if (item.indicatorType === 'compound' && item.componentIds && allDashboardItems.length > 0) {
    monthlyProgress = Array(12).fill(0);
    monthlyGoals = Array(12).fill(0);

    item.componentIds.forEach(compId => {
      const child = allDashboardItems.find(it => String(it.id) === String(compId));
      if (child) {
        for (let i = 0; i < 12; i++) {
          monthlyProgress[i] += Number(child.monthlyProgress?.[i] || 0);
          monthlyGoals[i] += Number(child.monthlyGoals?.[i] || 0);
        }
      }
    });
  } else if (item.indicatorType === 'formula' && item.formula && allDashboardItems.length > 0) {
    monthlyProgress = Array(12).fill(0).map((_, i) => evaluateFormula(item.formula!, allDashboardItems, i, 'monthlyProgress'));
    monthlyGoals = Array(12).fill(0).map((_, i) => evaluateFormula(item.formula!, allDashboardItems, i, 'monthlyGoals'));
  }

  // 🔄 AGREGACIÓN SEMANAL: Si el indicador es semanal, transformamos a mensual para el semáforo
  // 🔄 AGREGACIÓN SEMANAL: Si el indicador es semanal, transformamos a mensual para el semáforo
  if (item.frequency === 'weekly') {
    const startDay = item.weekStart === 'Sun' ? 0 : 1;
    let maxWeekIdx: number | undefined = undefined;

    // 🛡️ REGLA v6.0.0: En modo realTime permitimos ver la semana actual. En modo definitivo, solo periodos cerrados.
    const currentYear = new Date().getFullYear();
    if (year === currentYear) {
      const currentWeek = getWeekNumber(new Date(), startDay);
      maxWeekIdx = mode === 'realTime' ? (currentWeek - 1) : (currentWeek - 2);
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
    if (mode === 'realTime') {
      // 🚀 REAL-TIME: Permitimos el mes actual si hay datos
      limitIdx = currentMonthIdx;
    } else {
      // 🔒 DEFINITIVO: Solo meses estrictamente cerrados
      limitIdx = currentMonthIdx - 1;
    }
  } else if (year > currentYear) {
    limitIdx = -1; // Año futuro, nada cuenta
  }

  const lastIdxWithData = findLastIndexWithData(monthlyProgress, monthlyGoals);

  // 🛡️ REGLA v5.3.6 (FIX): Para años pasados, el índice evaluado es SIEMPRE Diciembre (11)
  // independientemente del mes actual del sistema. Se previene el cap en el mes actual.
  let idx = 0;
  if (mode === 'definitive') {
    idx = limitIdx;
  } else {
    if (year < currentYear) {
      idx = 11;
    } else if (year > currentYear) {
      idx = -1; // Futuro
    } else {
      // Año actual
      idx = Math.min(lastIdxWithData >= 0 ? lastIdxWithData : 0, currentMonthIdx);

      // 🛡️ AJUSTE v4.2.1: Si el periodo está abierto (mes actual) y no tiene datos reales aún, 
      // bajamos el índice al mes anterior para no castigar el acumulado con una meta sin avance.
      if (idx === currentMonthIdx && Number(monthlyProgress[idx] || 0) === 0 && Number(monthlyGoals[idx] || 0) !== 0) {
        idx = Math.max(0, idx - 1);
      }
    }
  }

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
  // 🛡️ REGLA v5.4.0 (FIX BLUE LIGHTS): Para indicadores SEMANALES, como la agregación ya filtra
  // solo las semanas completadas (maxWeekIdx), el dato resultante es "definitive" para esas semanas.
  // Por lo tanto, consideramos el periodo "cerrado" para que muestre ROJO/VERDE en lugar de AZUL (InProgress).
  const isWeekly = item.frequency === 'weekly';
  const isClosedPeriod = (year < currentYear) ? true : (idx < currentMonthIdx || (isWeekly && mode === 'realTime'));

  // 🛡️ REGLA v5.2.3: Si NO hay datos capturados (Meta=0 y Progreso=0), el estado es NEUTRAL (Gris), 
  // independientemente de si el periodo está abierto o cerrado.
  const complianceStatus = hasTarget
    ? getStatusForPercentage(overallPercentage, thresholds, true, isClosedPeriod)
    : "Neutral";

  return {
    currentProgress,
    currentTarget,
    overallPercentage,
    complianceStatus,
    isActive: hasTarget
  };
};

/**
 * 🎯 CÁLCULO DE CAPTURA (v5.5.9.4 - ULTRA PRECISION)
 * Audita si los indicadores tienen datos cargados para los periodos vencidos.
 * REGLA DE ORO: Un indicador (0,0) NO es captura, es un placeholder vacío.
 */
export const calculateCapturePct = (dashboard: any) => {
  const items = dashboard.items || [];
  if (items.length === 0) return 100;

  const now = new Date();
  const curMonth = now.getMonth();
  const curYear = now.getFullYear();
  const dYear = dashboard.year || curYear;

  if (dYear > curYear) return 100;

  const isPastYear = dYear < curYear;
  if (!isPastYear && curMonth === 0) return 100; // Nada que auditar en Enero del año actual

  const targetMonthIdx = isPastYear ? 11 : curMonth - 1;

  let capturedCount = 0;
  items.forEach((item: any) => {
    const val = item.monthlyProgress?.[targetMonthIdx];
    const goal = item.monthlyGoals?.[targetMonthIdx];

    // 🛡️ REGLA v5.5.9.4: No es captura si es nulo, vacío, o el par estándar (0,0)
    const isNull = val === null || val === undefined || val === "" || isNaN(val);
    const isDefaultZero = Number(val) === 0 && Number(goal || 0) === 0;

    if (!isNull && !isDefaultZero) {
      capturedCount++;
    }
  });

  // La base de cálculo es la meta manual (mínima cantidad de KPIs esperados)
  // o el total de indicadores si no hay meta.
  const totalTarget = dashboard.targetIndicatorCount && dashboard.targetIndicatorCount > 0
    ? dashboard.targetIndicatorCount
    : items.length;

  if (totalTarget === 0) return 100;

  // No permitir que el porcentaje baje de 0 o suba de 100 injustificadamente
  const pct = (capturedCount / totalTarget) * 100;
  return Math.min(100, Math.round(pct));
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
    // 🛡️ REGLA v6.0.0: Pasamos 'items' como contexto para indicadores inteligentes
    const { overallPercentage, isActive } = calculateCompliance(item, globalThresholds, year, mode, items);

    if (!isActive) return;

    const cappedPercentage = Math.min(overallPercentage, 200);
    totalWeightedScore += (cappedPercentage * (item.weight || 0));
    totalWeightFound += (item.weight || 0);
  });

  if (totalWeightFound === 0) return 0;

  return Number((totalWeightedScore / totalWeightFound).toFixed(1));
};

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
      // 🛡️ REGLA v6.0.0 (SIMPLIFIED CONTEXT): Para gráficas mensuales, evaluamos según tipo
      let p = Number(item.monthlyProgress?.[m] ?? 0);
      let g = Number(item.monthlyGoals?.[m] ?? 0);

      if (item.indicatorType === 'compound' && item.componentIds) {
        p = 0; g = 0;
        item.componentIds.forEach(compId => {
          const child = items.find(it => String(it.id) === String(compId));
          if (child) {
            p += Number(child.monthlyProgress?.[m] || 0);
            g += Number(child.monthlyGoals?.[m] || 0);
          }
        });
      } else if (item.indicatorType === 'formula' && item.formula) {
        p = evaluateFormula(item.formula, items, m, 'monthlyProgress');
        g = evaluateFormula(item.formula, items, m, 'monthlyGoals');
      }

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
