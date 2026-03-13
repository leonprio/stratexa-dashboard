// utils/compliance.ts
import type { DashboardItem, ComplianceThresholds } from "../types";
import { aggregateWeeklyToMonthly, getWeekNumber } from "./weeklyUtils";

// Si en tu proyecto ComplianceStatus es un enum/string union en types,
// no lo importo para no romper compilación por diferencias.
// Mantengo estos strings consistentes con la mayoría de implementaciones.
export type ComplianceStatus = "OnTrack" | "AtRisk" | "OffTrack" | "Neutral" | "InProgress";
export const CURRENT_MONTH_INDEX = new Date().getMonth();

/**
 * 🛡️ HELPER DE ACUMULADOS v7.6.0 (ULTRA-AGGRESSIVE)
 * Determina si un indicador debe sumarse (acumulativo) basándose en su nombre o tipo explícito.
 */
export const isAccumulativeIndicator = (indicatorName: string | undefined, type?: string): boolean => {
  if (type === 'accumulative') return true;
  if (!indicatorName) return false;

  // Normalización agresiva: sin acentos, sin espacios extras, todo mayúsculas.
  const clean = indicatorName.toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]/g, "");

  // Lista de palabras clave que SIEMPRE se suman (conteo de personas, ventas, etc.)
  const keywords = ["BAJA", "ALTA", "VACANTE", "VENTA", "CONTRATACION", "INGRESO"];
  return keywords.some(key => clean.includes(key));
};

/**
 * 🚀 MOTOR DE FÓRMULAS v7.2.1 (INTELLIGENT NAMES)
 * Evalúa expresiones aritméticas dinámicas basadas en otros indicadores del tablero.
 * 
 * Soporta dos sintaxis:
 * 1. Legacy IDs: `{id:101} + {id:102}`
 * 2. Natural Names: `bajas totales / altas` (Case-insensitive, ignora acentos)
 * 
 * @param formula - La expresión aritmética a evaluar.
 * @param allDashboardItems - Lista completa de indicadores para resolver dependencias.
 * @param monthIdx - Índice del mes (0-11) para extraer el valor.
 * @param field - Campo a extraer: 'monthlyProgress' (avance real) o 'monthlyGoals' (meta).
 * @param year - Año de los datos.
 * @param visitedIds - Set para evitar recursión infinita en fórmulas circulares.
 * @returns El resultado numérico de la evaluación.
 */
export const evaluateFormula = (
  formula: string,
  allDashboardItems: DashboardItem[],
  monthIdx: number,
  field: 'monthlyProgress' | 'monthlyGoals' = 'monthlyProgress',
  year: number = new Date().getFullYear(),
  visitedIds: Set<string> = new Set()
): number => {
  if (!formula) return 0;

  try {
    let expression = formula.toLowerCase();

    // 1. Reemplazar {id:XXX} con el valor real (Compatibilidad Legacy)
    const idRegex = /\{id:([^}]+)\}/g;
    expression = expression.replace(idRegex, (_, id) => {
      const depItem = allDashboardItems.find(it => String(it.id) === String(id));
      if (!depItem) return "0";
      const { monthlyProgress: childP, monthlyGoals: childG } = resolveItemValues(depItem, allDashboardItems, year, visitedIds);
      const val = field === 'monthlyProgress' ? childP[monthIdx] : childG[monthIdx];
      return String(Number(val) || 0);
    });

    // 2. 🚀 DETECCIÓN DE NOMBRES INTELIGENTES (v7.2.2 - DOT SUPPORT)
    // Buscamos palabras que NO sean operadores o números y tratamos de matchearlas con indicadores
    // Soporta puntos (.) para nombres como "Edo. Fza."
    const nameRegex = /[a-záéíóúñ0-9\.\s]+/g;
    const matches = formula.toLowerCase().match(nameRegex);

    if (matches) {
      // Ordenar por longitud descendente para evitar colisiones (greedy match)
      const sortedMatches = [...new Set(matches.map(m => m.trim()))]
        .filter(m => m.length > 1) // nombres de al menos 2 chars
        .sort((a, b) => b.length - a.length);

      sortedMatches.forEach(namePart => {
        // Normalización para match (quitar acentos, puntos y espacios extras)
        const normalize = (s: string) => s.toUpperCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/\./g, "") // removemos puntos para el match
          .replace(/\s+/g, "");

        const normTarget = normalize(namePart);
        if (!normTarget) return;

        const depItem = allDashboardItems.find(it => normalize(it.indicator) === normTarget);

        if (depItem) {
          const { monthlyProgress: childP, monthlyGoals: childG } = resolveItemValues(depItem, allDashboardItems, year, visitedIds);
          const val = field === 'monthlyProgress' ? childP[monthIdx] : childG[monthIdx];

          // Reemplazamos el nombre literal con el valor numérico
          const escapedName = namePart.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          // Usamos Regex con "bordes" simulados para no reemplazar partes de palabras
          expression = expression.replace(new RegExp(escapedName, 'g'), String(Number(val) || 0));
        }
      });
    }

    // 3. Limpieza y validación final por seguridad
    // Si después de los reemplazos quedan letras, es que un nombre no fue resuelto.
    const hasUnresolvedNames = /[a-z]/.test(expression);
    if (hasUnresolvedNames) {
      console.warn(`[FORMULA] Indicador(es) no encontrado(s) en: ${expression}`);
      return 0;
    }

    // Solo permitir números, operadores básicos y paréntesis
    if (/[^0-9\.\+\-\*\/\(\)\s]/.test(expression)) {
      console.warn(`[FORMULA] Caracteres no permitidos detectados: ${expression}`);
      return 0;
    }

    // 4. Evaluación aritmética segura con protección contra división por cero
     
    const result = Number(eval(expression));

    // Si el resultado es NaN o Infinity (división por cero), devolvemos 0
    if (isNaN(result) || !isFinite(result)) return 0;

    return result;
  } catch (e) {
    console.error(`[FORMULA] Error crítico evaluando "${formula}":`, e);
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
/**
 * 🚀 RESOLVER VALORES (v6.2.2): Calcula los valores finales de un indicador
 * basándose en sus dependencias (Hijos o Fórmulas).
 * Esto es CRÍTICO para que la agregación use los valores calculados y no los ceros de la BD.
 */
export const resolveItemValues = (
  item: DashboardItem,
  contextItems: DashboardItem[],
  year: number,
  visitedIds: Set<string> = new Set()
): { monthlyProgress: number[]; monthlyGoals: number[] } => {
  const itemId = String(item.id);
  if (visitedIds.has(itemId)) {
    return { monthlyProgress: Array(12).fill(0), monthlyGoals: Array(12).fill(0) };
  }
  visitedIds.add(itemId);

  let monthlyProgress = [...((item as any).monthlyProgress || [])];
  let monthlyGoals = [...((item as any).monthlyGoals || [])];

  // Identificar si es compuesto o fórmula y si tenemos contexto
  if (item.indicatorType === 'compound' && item.componentIds && contextItems.length > 0) {
    monthlyProgress = Array(12).fill(0);
    monthlyGoals = Array(12).fill(0);

    item.componentIds.forEach(compId => {
      const child = contextItems.find(it => String(it.id) === String(compId));
      if (child) {
        // 🚀 RECURSIÓN REAL v7.8.2: Resolver el valor calculado del hijo (incluyendo su propia agregación semanal o composición)
        const { monthlyProgress: childP, monthlyGoals: childG } = resolveItemValues(child, contextItems, year, visitedIds);

        for (let i = 0; i < 12; i++) {
          monthlyProgress[i] = (monthlyProgress[i] || 0) + Number(childP[i] || 0);
          monthlyGoals[i] = (monthlyGoals[i] || 0) + Number(childG[i] || 0);
        }
      }
    });

    return { monthlyProgress, monthlyGoals };
  }
  else if (item.indicatorType === 'formula' && item.formula && contextItems.length > 0) {
    // 🛡️ REGLA v6.2.4-Fix5: No persistir visitedIds entre meses
    monthlyProgress = Array(12).fill(0).map((_, i) => evaluateFormula(item.formula!, contextItems, i, 'monthlyProgress', year, new Set([itemId])));
    monthlyGoals = Array(12).fill(0).map((_, i) => evaluateFormula(item.formula!, contextItems, i, 'monthlyGoals', year, new Set([itemId])));
  }

  // 🔄 AGREGACIÓN SEMANAL INTERNA
  // 🛡️ REGLA v7.8.1 (COMPOUND SHIELD): No sobreescribir si ya fue calculado por fórmula o composición
  const isCalculated = item.indicatorType === 'compound' || item.indicatorType === 'formula';

  if (item.frequency === 'weekly' && !isCalculated) {
    const startDay = item.weekStart === 'Sun' ? 0 : 1;
    // 🛡️ REGLA v7.5.2 (UNIVERSAL SUM): Usar helper centralizado
    const aggMode = isAccumulativeIndicator(item.indicator, item.type) ? 'sum' : 'average';

    monthlyProgress = aggregateWeeklyToMonthly(item.weeklyProgress || [], year, startDay, undefined, aggMode);
    monthlyGoals = aggregateWeeklyToMonthly(item.weeklyGoals || [], year, startDay, undefined, aggMode);
  }

  return { monthlyProgress, monthlyGoals };
};

export const calculateCompliance = (
  item: DashboardItem,
  globalThresholds: ComplianceThresholds,
  year: number = new Date().getFullYear(),
  mode: 'realTime' | 'definitive' = 'realTime',
  allDashboardItems: DashboardItem[] = [],
  contextItems: DashboardItem[] = []
) => {
  // 🛡️ REGLA v6.0.1: Contexto prioritario
  const lookupContext = contextItems.length > 0 ? contextItems : allDashboardItems;

  // 🚀 REGLA v6.2.2: Usar resolutor centralizado
  let { monthlyProgress, monthlyGoals } = resolveItemValues(item, lookupContext, year);

  // 🛡️ REGLA v6.0.0: Recorte de semanas para 'weekly' en modo realTime
  // resolveItemValues devuelve todo el año. Aquí aplicamos el timeline 'cut' si es necesario.
  // 🛡️ REGLA v7.8.3 (COMPOUND PROTECTION): No re-calcular si ya es un compuesto/fórmula
  const isCalculated = item.indicatorType === 'compound' || item.indicatorType === 'formula';

  if (item.frequency === 'weekly' && !isCalculated) {
    const startDay = item.weekStart === 'Sun' ? 0 : 1;
    const currentYear = new Date().getFullYear();
    if (year === currentYear) {
      const currentWeek = getWeekNumber(new Date(), startDay);
      const maxWeekIdx = mode === 'realTime' ? (currentWeek - 1) : (currentWeek - 2);

      // Re-agregamos con el límite (es un poco redundante pero seguro para visualización exacta)
      // 🛡️ REGLA v7.5.2 (UNIVERSAL SUM): Usar helper centralizado
      const aggMode = isAccumulativeIndicator(item.indicator, item.type) ? 'sum' : 'average';

      monthlyProgress = aggregateWeeklyToMonthly(item.weeklyProgress || [], year, startDay, maxWeekIdx, aggMode);
      monthlyGoals = aggregateWeeklyToMonthly(item.weeklyGoals || [], year, startDay, maxWeekIdx, aggMode);
    }
  }

  // Identificar si es acumulativo
  // 🛡️ REGLA v7.5.2 (UNIVERSAL SUM): Usar helper centralizado
  const isAccumulative = isAccumulativeIndicator(item.indicator, item.type);

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

  // 1. EL PERÍODO VENCIDO SIEMPRE ES EL ÚLTIMO MES CALENDARIO CERRADO
  const targetMonthIdx = isPastYear ? 11 : curMonth - 1;

  let totalCapturablePoints = 0;
  let totalCapturedPoints = 0;

  items.forEach((item: any) => {
    // Solo contar items base (ignoramos agregados o calculados por sistema)
    if (item.isAggregate || item.indicatorType === 'compound' || item.indicatorType === 'formula') return;

    const isWeekly = item.frequency === 'weekly';
    const isMinimize = item.goalType === 'minimize' || item.type === 'minimize' || item.type === 'lower' || item.type === 'min';

    // 2. EXCLUIR KPIs SIN META: "Tiene al menos una META configurada para el año"
    const hasAnyGoalThisYear = isWeekly
      ? (item.weeklyGoals || []).some((g: any) => g !== null && g !== undefined && g !== "" && (isMinimize ? true : Number(g) > 0))
      : (item.monthlyGoals || []).some((g: any) => g !== null && g !== undefined && g !== "" && (isMinimize ? true : Number(g) > 0));

    if (!hasAnyGoalThisYear) {
      return; // No se cuenta en absoluto, es un KPI sin meta
    }

    // 3. Evaluar la captura mes por mes hasta el mes vencido
    for (let m = 0; m <= targetMonthIdx; m++) {
      totalCapturablePoints++;

      let val = item.monthlyProgress?.[m];
      let goal = item.monthlyGoals?.[m];

      if (isWeekly) {
        const startDay = item.weekStart === 'Sun' ? 0 : 1;
        const aggMode = item.type === 'accumulative' ? 'sum' : 'average';
        const aggProgress = aggregateWeeklyToMonthly(item.weeklyProgress || [], dYear, startDay, undefined, aggMode);
        const aggGoals = aggregateWeeklyToMonthly(item.weeklyGoals || [], dYear, startDay, undefined, aggMode);
        val = aggProgress[m];
        goal = aggGoals[m];
      }

      const isNull = val === null || val === undefined || val === "" || isNaN(Number(val));
      const isGoalZero = Number(goal || 0) === 0;
      const isValZero = Number(val) === 0;

      // 4. Regla Estricta: Si es nulo o si es el default (Meta=0 y Real=0), NO se considera capturado
      const isCaptured = !isNull && !(isGoalZero && isValZero);

      if (isCaptured) {
        totalCapturedPoints++;
      }
    }
  });

  // Si después del filtro no quedaron puntos capturables, el tablero está al 100% (no debe nada)
  if (totalCapturablePoints === 0) return 100;

  const pct = (totalCapturedPoints / totalCapturablePoints) * 100;
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
  mode: 'realTime' | 'definitive' = 'realTime',
  contextItems: DashboardItem[] = []
) => {
  if (!items || items.length === 0) return 0;

  let totalWeightedScore = 0;
  let totalWeightFound = 0;

  items.forEach(item => {
    // 🛡️ REGLA v6.0.1: Pasamos 'items' como contexto local y 'contextItems' como contexto extendido
    const { overallPercentage, isActive } = calculateCompliance(item, globalThresholds, year, mode, items, contextItems);

    if (!isActive) return;

    const cappedPercentage = Math.min(overallPercentage, 200);
    totalWeightedScore += (cappedPercentage * (item.weight || 0));
    totalWeightFound += (item.weight || 0);
  });

  // 🛡️ REGLA v6.1.2 (SHIELD FALLBACK): Si no hay pesos definidos (todos 0), 
  // asumimos que todos valen lo mismo (1) para no mostrar un Fulfillment de 0%.
  if (totalWeightFound === 0) {
    items.forEach(item => {
      const { overallPercentage, isActive } = calculateCompliance(item, globalThresholds, year, mode, items, contextItems);
      if (!isActive) return;
      totalWeightedScore += Math.min(overallPercentage, 200);
      totalWeightFound += 1;
    });
  }

  if (totalWeightFound === 0) return 0; // Guardrail final

  return Number((totalWeightedScore / totalWeightFound).toFixed(1));
};

export const calculateDashboardMonthlyScores = (
  items: DashboardItem[],
  globalThresholds: ComplianceThresholds,
  year: number = new Date().getFullYear(),
  limitMonthIdx: number = 11,
  contextItems: DashboardItem[] = []
) => {
  const scores: (number | null)[] = Array(12).fill(null);
  const lookupContext = contextItems.length > 0 ? contextItems : items;

  for (let m = 0; m <= limitMonthIdx; m++) {
    let monthlyWeightedSum = 0;
    let monthlyWeightTotal = 0;
    let hasAnyData = false;

    items.forEach(item => {
      // 🚀 REGLA v6.2.4-Fix5: Usar resolveItemValues para asegurar recursión en agregados mensuales
      const { monthlyProgress: resP, monthlyGoals: resG } = resolveItemValues(item, lookupContext, year);

      const p = Number(resP[m] ?? 0);
      const g = Number(resG[m] ?? 0);

      if (p === 0 && g === 0) return;

      const lowerIsBetter = item.goalType === 'minimize';
      const monthlyPct = calculateMonthlyCompliancePercentage(p, g, lowerIsBetter);
      const cappedPct = Math.min(monthlyPct, 200);

      monthlyWeightedSum += (cappedPct * (item.weight || 0));
      monthlyWeightTotal += (item.weight || 0);
      hasAnyData = true;
    });

    if (hasAnyData && monthlyWeightTotal === 0) {
      // Fallback a pesos iguales para la vista mensual si no hay pesos definidos
      let sum = 0; let count = 0;
      items.forEach(it => {
        const p = Number(it.monthlyProgress?.[m] ?? 0);
        const g = Number(it.monthlyGoals?.[m] ?? 0);
        if (p || g) { count++; sum += Math.min(calculateMonthlyCompliancePercentage(p, g, it.goalType === 'minimize'), 200); }
      });
      if (count > 0) scores[m] = Number((sum / count).toFixed(1));
    } else if (hasAnyData && monthlyWeightTotal > 0) {
      scores[m] = Number((monthlyWeightedSum / monthlyWeightTotal).toFixed(1));
    }
  }

  return scores;
};
