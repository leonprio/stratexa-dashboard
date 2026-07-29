import type { DashboardItem, ComplianceThresholds, OperationalMetrics } from "../types";
import { aggregateWeeklyToMonthly, getWeekNumber } from "./weeklyUtils";

// Si en tu proyecto ComplianceStatus es un enum/string union en types,
// no lo importo para no romper compilación por diferencias.
// Mantengo estos strings consistentes con la mayoría de implementaciones.
export type ComplianceStatus = "OnTrack" | "AtRisk" | "OffTrack" | "Neutral" | "InProgress";
export const CURRENT_MONTH_INDEX = new Date().getMonth();

/**
 * 🛡️ HELPER DE ACUMULADOS v9.1.0-PRO-FINAL-SHIELDED (ULTRA-AGGRESSIVE)
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

  // Lista de palabras clave que SIEMPRE se suman (conteo de personas, ventas, montos, etc.)
  const keywords = [
    "BAJA", "ALTA", "VACANTE", "VENTA", "CONTRATACION", "INGRESO",
    "NOTA", "SERVICIO", "SUPERVISION", "PREMIO", "INCIDENCIA", 
    "DISMINUCION", "RECUPERACION", "FALTA", "ACCIDENTE", "RETIRO", "QUEJA",
    "TURNO", "PERSONA", "HORA", "PESO", "MONTO", "CANTIDAD", "TOTAL", "UNIDAD",
    "MONTO", "PESO", "FACTURA", "GASTO", "COSTO", "UTILIDAD", "PUNTOS", "CREDITO",
    "DINERO", "EFECTIVO", "COBRO", "CARGO", "MULTA", "FALTANTE", "SOBRANTE"
  ];
  
  // 🛡️ REGLA v9.1.0-PRO-FINAL-SHIELDED: Si el nombre contiene alguna de estas palabras, es SUMATORIA (Accumulative)
  return keywords.some(key => clean.includes(key));
};

/**
 * 🛡️ REGLA v9.1.0-PRO-FINAL-SHIELDED (SHIELD-UP): Integridad de Datos Nuclear
 * Asegura que un indicador tenga todos sus campos obligatorios antes de procesar o guardar.
 * Evita la pérdida de información por "undefined" o arreglos incompletos.
 */
export const shieldItem = (item: DashboardItem): DashboardItem => {
  if (!item) return {} as DashboardItem;
  
  // 🛡️ v9.1.0-PRO-FINAL-SHIELDED: Crear copia para NO mutar el objeto original (prevención de bugs de React)
  const shielded: DashboardItem = { ...item };

  // 1. Asegurar arreglos de datos mensuales (SOPORTE 12 MESES)
  if (!Array.isArray(shielded.monthlyGoals)) shielded.monthlyGoals = Array(12).fill(0);
  if (!Array.isArray(shielded.monthlyProgress)) shielded.monthlyProgress = Array(12).fill(0);
  
  // 2. Asegurar arreglos de datos semanales si existen
  if (shielded.frequency === 'weekly') {
      if (!Array.isArray(shielded.weeklyGoals)) shielded.weeklyGoals = [];
      if (!Array.isArray(shielded.weeklyProgress)) shielded.weeklyProgress = [];
  }
  
  // 3. Asegurar campos de Modo Actividades
  if (shielded.isActivityMode && !shielded.activityConfig) {
      shielded.activityConfig = {};
  }

  // 4. Sanitización de nombres para evitar colisiones en fórmulas
  if (shielded.indicator) {
      shielded.indicator = shielded.indicator.trim();
  }

  return shielded;
};

/**
 * 🚀 MOTOR DE FÓRMULAS v9.1.0-PRO-FINAL-SHIELDED (DUAL MOTOR + RECURSION SHIELD)
 * Evalúa expresiones aritméticas dinámicas basadas en otros indicadores del tablero.
 * 
 * Soporta tres sintaxis:
 * 1. Sintaxis Simplificada: `{101} + {102}` (NUEVA - omite "id:")
 * 2. Legacy IDs: `{id:101} + {id:102}` (Compatibilidad)
 * 3. Natural Names: `bajas totales / altas` (Case-insensitive, ignora acentos)
 * 
 * @param formula - La expresión aritmética a evaluar.
 * @param allDashboardItems - Lista completa de indicadores para resolver dependencias.
 * @param monthIdx - Índice del mes (0-11) para extraer el valor.
 * @param field - Campo a extraer: 'monthlyProgress' (avance real) o 'monthlyGoals' (meta).
 * @param year - Año de los datos.
 *  * @returns El resultado de la evaluación.
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

    // 🛡️ REGLA v9.1.0-PRO-FINAL-SHIELDED: Soporte Dual de Sintaxis ({101} o {id:101})
    const universalIdRegex = /\{(?:id:)?([\w-]+)\}/g;
    expression = expression.replace(universalIdRegex, (_, id) => {
      const depItem = allDashboardItems.find(it => String(it.id) === String(id));
      if (!depItem) return "0";
      
      const itemId = String(depItem.id);
      if (visitedIds.has(itemId)) return "0";
      
      const { monthlyProgress: childP, monthlyGoals: childG } = resolveItemValues(depItem, allDashboardItems, year, new Set(visitedIds));
      const val = field === 'monthlyProgress' ? childP[monthIdx] : childG[monthIdx];
      return String(Number(val) || 0);
    });

    // 2. 🚀 DETECCIÓN DE NOMBRES INTELIGENTES
    const nameRegex = /[a-záéíóúñ0-9\.\s]+/g;
    const matches = formula.toLowerCase().match(nameRegex);

    if (matches) {
      const sortedMatches = [...new Set(matches.map(m => m.trim()))]
        .filter(m => m.length > 1)
        .sort((a, b) => b.length - a.length);

      sortedMatches.forEach(namePart => {
        const normalize = (s: string) => s.toUpperCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/\./g, "")
          .replace(/\s+/g, "");

        const normTarget = normalize(namePart);
        if (!normTarget) return;

        const depItem = allDashboardItems.find(it => normalize(it.indicator) === normTarget);

        if (depItem) {
          const itemId = String(depItem.id);
          if (visitedIds.has(itemId)) return;

          const { monthlyProgress: childP, monthlyGoals: childG } = resolveItemValues(depItem, allDashboardItems, year, new Set(visitedIds));
          const val = field === 'monthlyProgress' ? childP[monthIdx] : childG[monthIdx];
          
          const escapedName = namePart.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          expression = expression.replace(new RegExp(escapedName, 'g'), String(Number(val) || 0));
        }
      });
    }

    // 3. Sanitización Estricta
    const cleanExpression = expression.replace(/[a-z]/g, '0');
    const finalExpression = cleanExpression.replace(/[^0-9\.\+\-\*\/\(\)\s]/g, '');

    if (!finalExpression || (finalExpression.trim() === "")) return 0;

    // 4. Evaluación segura
    // eslint-disable-next-line no-eval
    const result = Number(eval(finalExpression));

    if (isNaN(result) || !isFinite(result)) return 0;
    return result;
  } catch (e) {
    console.warn(`[SHIELD] Error en fórmula "${formula}":`, e);
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

  // 🛡️ REGLA v9.1.0-PRO-FINAL-SHIELDED: Si el periodo NO ha vencido (mes actual), semáforo temporal
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
  actual: number | null | undefined,
  target: number | null | undefined,
  lowerIsBetter: boolean
): number => {
  const isMissing = actual === null || actual === undefined || (actual as any) === '';
  const a = Number(actual ?? 0);
  const t = Number(target ?? 0);

  // 🛡️ REGLA v9.1.0-PRO-FINAL-SHIELDED (STRICT INTEGRITY):
  // Si falta el avance (null/undefined) pero existe una meta, el cumplimiento es 0%
  // para forzar la captura de información, sin importar el tipo de indicador.
  if (isMissing && t > 0) return 0;

  // ✅ Caso "sin datos" (ambos en 0 o vacíos)
  if (t === 0 && a === 0) return 0;

  if (t === 0) {
    if (lowerIsBetter) return a === 0 ? 100 : 0;
    return a > 0 ? 100 : 0;
  }

  if (!lowerIsBetter) {
    return (a / t) * 100;
  }

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
 * 🚀 RESOLVER VALORES (v9.1.0-PRO-FINAL-SHIELDED): Calcula los valores finales de un indicador
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
    const nextVisited = new Set(visitedIds);
    nextVisited.add(itemId);

    item.componentIds.forEach(compId => {
      const child = contextItems.find(it => String(it.id) === String(compId));
      if (child) {
        // 🚀 RECURSIÓN REAL v9.1.0-PRO-FINAL-SHIELDED: Resolver el valor calculado del hijo usando el stack actualizado
        const { monthlyProgress: childP, monthlyGoals: childG } = resolveItemValues(child, contextItems, year, nextVisited);

        for (let i = 0; i < 12; i++) {
          monthlyProgress[i] = (monthlyProgress[i] || 0) + Number(childP[i] || 0);
          monthlyGoals[i] = (monthlyGoals[i] || 0) + Number(childG[i] || 0);
        }
      }
    });

    return { monthlyProgress, monthlyGoals };
  }
  else if (item.indicatorType === 'formula' && item.formula && contextItems.length > 0) {
    // 🛡️ REGLA v9.4.7 (DERIVED FORMULA CONTRACT):
    // 1. Calcular el avance derivado mes a mes aplicando la fórmula a los avances de las fuentes.
    const nextVisited = new Set(visitedIds);
    nextVisited.add(itemId);
    monthlyProgress = Array(12).fill(0).map((_, i) => evaluateFormula(item.formula!, contextItems, i, 'monthlyProgress', year, nextVisited));
    
    // 2. Determinar la meta derivada mes a mes:
    // Si goalMode es expresamente 'EXPLICIT_TARGET', respetar las metas configuradas.
    // De lo contrario (DERIVED_FROM_SOURCES por defecto), evaluar la fórmula sobre las metas fuente.
    if ((item as any).goalMode === 'EXPLICIT_TARGET') {
      monthlyGoals = [...((item as any).monthlyGoals || [])];
    } else {
      monthlyGoals = Array(12).fill(0).map((_, i) => evaluateFormula(item.formula!, contextItems, i, 'monthlyGoals', year, nextVisited));
    }
  }

  // 🔄 AGREGACIÓN SEMANAL INTERNA
  // 🛡️ REGLA v9.1.0-PRO-FINAL-SHIELDED (COMPOUND SHIELD): No sobreescribir si ya fue calculado por fórmula o composición
  const isCalculated = item.indicatorType === 'compound' || item.indicatorType === 'formula';

  if (item.frequency === 'weekly' && !isCalculated) {
    const startDay = item.weekStart === 'Sun' ? 0 : 1;
    // 🛡️ REGLA v9.1.0-PRO-FINAL-SHIELDED (UNIVERSAL SUM): Usar helper centralizado
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
  // 🛡️ REGLA v9.1.0-PRO-FINAL-SHIELDED: Contexto prioritario
  const lookupContext = contextItems.length > 0 ? contextItems : allDashboardItems;

  // 🚀 REGLA v9.1.0-PRO-FINAL-SHIELDED: Usar resolutor centralizado
  let { monthlyProgress, monthlyGoals } = resolveItemValues(item, lookupContext, year);

  // 🛡️ REGLA v6.0.0: Recorte de semanas para 'weekly' en modo realTime
  // resolveItemValues devuelve todo el año. Aquí aplicamos el timeline 'cut' si es necesario.
  // 🛡️ REGLA v9.1.0-PRO-FINAL-SHIELDED (COMPOUND PROTECTION): No re-calcular si ya es un compuesto/fórmula
  const isCalculated = item.indicatorType === 'compound' || item.indicatorType === 'formula';

  if (item.frequency === 'weekly' && !isCalculated) {
    const startDay = item.weekStart === 'Sun' ? 0 : 1;
    const currentYear = new Date().getFullYear();
    if (year === currentYear) {
      const currentWeek = getWeekNumber(new Date(), startDay);
      const maxWeekIdx = mode === 'realTime' ? (currentWeek - 1) : (currentWeek - 2);

      // Re-agregamos con el límite (es un poco redundante pero seguro para visualización exacta)
      // 🛡️ REGLA v9.1.0-PRO-FINAL-SHIELDED (UNIVERSAL SUM): Usar helper centralizado
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

  // 🛡️ CLAMPING TEMPORAL (v9.1.0-PRO-FINAL-SHIELDED): El semáforo solo considera periodos VENCIDOS.
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

  // 🛡️ REGLA v9.1.0-PRO-FINAL-SHIELDED (FIX): Para años pasados, el índice evaluado es SIEMPRE Diciembre (11)
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

      // 🛡️ AJUSTE v9.1.0-PRO-FINAL-SHIELDED: Si el periodo está abierto (mes actual) y no tiene datos reales aún, 
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
  } else if (item.indicatorType === 'formula' && item.formula && lookupContext.length > 0) {
    // 🛡️ REGLA v9.4.11 (FORMULA_ON_CUMULATED_SOURCES YTD CONTRACT):
    // Para indicadores FÓRMULA, el YTD calcula el avance acumulado y la meta acumulada evaluando la fórmula
    // sobre los acumulados de las fuentes desde el inicio de año hasta el corte.
    const cumulatedItems = lookupContext.map(it => {
      const { monthlyProgress: mP, monthlyGoals: mG } = resolveItemValues(it, lookupContext, year);
      const cumP = mP.slice(0, idx + 1).reduce((sum, v) => sum + Number(v || 0), 0);
      const cumG = mG.slice(0, idx + 1).reduce((sum, v) => sum + Number(v || 0), 0);
      return {
        ...it,
        monthlyProgress: Array(12).fill(cumP),
        monthlyGoals: Array(12).fill(cumG),
      };
    });

    currentProgress = evaluateFormula(item.formula, cumulatedItems, 0, 'monthlyProgress', year);
    if ((item as any).goalMode === 'EXPLICIT_TARGET') {
      currentProgress = Number(monthlyProgress[idx] || 0);
      currentTarget = Number(monthlyGoals[idx] || 0);
    } else {
      currentTarget = evaluateFormula(item.formula, cumulatedItems, 0, 'monthlyGoals', year);
    }
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

  let overallPercentage = calculateMonthlyCompliancePercentage(
    currentProgress,
    currentTarget,
    lowerIsBetter
  );

  // 🛡️ REGLA v9.4.9 (RESULT_IS_COMPLIANCE CONTRACT):
  // Si el indicador es FÓRMULA y su modo de salida es RESULT_IS_COMPLIANCE (por defecto),
  // el avance derivado ya representa el porcentaje de cumplimiento. Se evita el doble cálculo (50% / 50% = 100%).
  if (item.indicatorType === 'formula' && item.formulaOutputMode !== 'VALUE_VS_TARGET') {
    const rawVal = Number(currentProgress || 0);
    // Si el valor es <= 1.0 (ej. 0.5), convertir a 50%. Si ya viene en 50, conservarlo.
    overallPercentage = rawVal <= 1.0 ? Math.round(rawVal * 100) : rawVal;
  }

  // Determinar si el indicador está "activo" este mes (tiene meta capturada)
  const hasTarget = currentTarget !== 0 || currentProgress !== 0;

  // PERIODOS CERRADOS: Un periodo es cerrado si el índice es < al mes actual (o es año pasado)
  // 🛡️ REGLA v9.1.0-PRO-FINAL-SHIELDED (FIX BLUE LIGHTS): Para indicadores SEMANALES, como la agregación ya filtra
  // solo las semanas completadas (maxWeekIdx), el dato resultante es "definitive" para esas semanas.
  // Por lo tanto, consideramos el periodo "cerrado" para que muestre ROJO/VERDE en lugar de AZUL (InProgress).
  const isWeekly = item.frequency === 'weekly';
  const isClosedPeriod = (year < currentYear) ? true : (idx < currentMonthIdx || (isWeekly && mode === 'realTime'));

  // 🛡️ REGLA v9.1.0-PRO-FINAL-SHIELDED: Si NO hay datos capturados (Meta=0 y Progreso=0), el estado es NEUTRAL (Gris), 
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
 * 🎯 AUDITORÍA DE METAS APLICABLES (v9.4.17)
 * Verifica si un conjunto de DashboardItems contiene al menos un KPI con meta válida configurada.
 */
export const hasApplicableGoals = (items: DashboardItem[]): boolean => {
  if (!items || items.length === 0) return false;
  return items.some(item => {
    if (item.isAggregate) return false;
    const isMinimize = item.goalType === 'minimize' || (item as any).type === 'minimize' || (item as any).type === 'lower' || (item as any).type === 'min';
    const goals = item.monthlyGoals || [];
    return goals.some((g: any) => g !== null && g !== undefined && g !== "" && !isNaN(Number(g)) && (isMinimize ? true : Number(g) > 0));
  });
};

/**
 * 🎯 CÁLCULO PONDERADO CANÓNICO DE CAPTURA (v9.4.17)
 * Cuenta los puntos periodo-KPI capturados elegibles sobre el total de puntos elegibles.
 */
export const calculateCaptureMetrics = (
  items: DashboardItem[],
  year: number = new Date().getFullYear()
): { totalCapturedPoints: number; totalCapturablePoints: number; capturePct: number } => {
  if (!items || items.length === 0) {
    return { totalCapturedPoints: 0, totalCapturablePoints: 0, capturePct: 100 };
  }

  const now = new Date();
  const curMonth = now.getMonth();
  const curYear = now.getFullYear();

  if (year > curYear) {
    return { totalCapturedPoints: 0, totalCapturablePoints: 0, capturePct: 100 };
  }

  const isPastYear = year < curYear;
  if (!isPastYear && curMonth === 0) {
    return { totalCapturedPoints: 0, totalCapturablePoints: 0, capturePct: 100 };
  }

  const targetMonthIdx = isPastYear ? 11 : curMonth - 1;

  let totalCapturablePoints = 0;
  let totalCapturedPoints = 0;

  items.forEach((item: DashboardItem) => {
    if (item.isAggregate || item.indicatorType === 'compound' || item.indicatorType === 'formula') return;

    const isWeekly = item.frequency === 'weekly';
    const isMinimize = item.goalType === 'minimize' || (item as any).type === 'minimize' || (item as any).type === 'lower' || (item as any).type === 'min';
    const hasValidGoal = (g: any) => g !== null && g !== undefined && g !== "" && !isNaN(Number(g)) && (isMinimize ? true : Number(g) > 0);

    let goals: any[] = item.monthlyGoals || [];
    let progress: any[] = item.monthlyProgress || [];

    if (isWeekly) {
      const startDay = item.weekStart === 'Sun' ? 0 : 1;
      const aggMode = item.type === 'accumulative' ? 'sum' : 'average';
      progress = aggregateWeeklyToMonthly(item.weeklyProgress || [], year, startDay, undefined, aggMode);
      goals = aggregateWeeklyToMonthly(item.weeklyGoals || [], year, startDay, undefined, aggMode);
    }

    const firstGoalIdx = goals.findIndex(hasValidGoal);

    let startIdx = 0;
    if ((item as any).operationalStartPeriod !== undefined && (item as any).operationalStartPeriod !== null) {
      startIdx = parsePeriodToIndex((item as any).operationalStartPeriod);
    } else {
      if (firstGoalIdx === -1) return;
      startIdx = firstGoalIdx;
    }

    startIdx = Math.max(0, startIdx);
    for (let m = startIdx; m <= targetMonthIdx; m++) {
      let val = progress[m];
      let goal = goals[m];

      const isNullVal = val === null || val === undefined || val === "" || isNaN(Number(val));
      const isNullGoal = goal === null || goal === undefined || goal === "" || isNaN(Number(goal));
      const isGoalZero = Number(goal || 0) === 0;
      const isValZero = Number(val || 0) === 0;

      const hasGoalOrVal = (!isNullGoal && !isGoalZero) || (!isNullVal && !isValZero);
      if (!hasGoalOrVal) continue;

      totalCapturablePoints++;

      const isCaptured = !isNullVal && !isValZero;
      if (isCaptured) {
        totalCapturedPoints++;
      }
    }
  });

  if (totalCapturablePoints === 0) {
    return { totalCapturedPoints: 0, totalCapturablePoints: 0, capturePct: 100 };
  }

  const pct = Math.min(100, Math.round((totalCapturedPoints / totalCapturablePoints) * 100));
  return { totalCapturedPoints, totalCapturablePoints, capturePct: pct };
};

export const calculateCapturePct = (dashboard: any) => {
  const items = dashboard?.items || [];
  const year = dashboard?.year || new Date().getFullYear();
  return calculateCaptureMetrics(items, year).capturePct;
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
    // 🛡️ REGLA v9.1.0-PRO-FINAL-SHIELDED: Pasamos 'items' como contexto local y 'contextItems' como contexto extendido
    const { overallPercentage, isActive } = calculateCompliance(item, globalThresholds, year, mode, items, contextItems);

    if (!isActive) return;

    const cappedPercentage = Math.min(overallPercentage, 200);
    totalWeightedScore += (cappedPercentage * (item.weight || 0));
    totalWeightFound += (item.weight || 0);
  });

  // 🛡️ REGLA v9.1.0-PRO-FINAL-SHIELDED (SHIELD FALLBACK): Si no hay pesos definidos (todos 0), 
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
      // 🚀 REGLA v9.1.0-PRO-FINAL-SHIELDED: Usar resolveItemValues para asegurar recursión en agregados mensuales
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

/**
 * Normaliza un periodo (número o string) a un índice de mes en base 0 (0-11).
 * Soporta números del 1-12 (base 1), 0-11 (base 0) o strings de meses abreviados en español o inglés (ej. "MAY", "ENE").
 */
export const parsePeriodToIndex = (period: any): number => {
  if (period === undefined || period === null) return 0;
  if (typeof period === 'number') {
    if (period >= 1 && period <= 12) {
      return period - 1;
    }
    return Math.max(0, Math.min(11, period));
  }
  if (typeof period === 'string') {
    const clean = period.trim().toUpperCase();
    const months = [
      "ENE", "FEB", "MAR", "ABR", "MAY", "JUN",
      "JUL", "AGO", "SEP", "OCT", "NOV", "DIC",
      "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
      "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"
    ];
    const index = months.indexOf(clean);
    if (index !== -1) {
      return index % 12;
    }
    const num = parseInt(clean, 10);
    if (!isNaN(num)) {
      return Math.max(0, Math.min(11, num - 1));
    }
  }
  return 0;
};

/**
 * 🌟 MOTOR DERIVADO Y ENCAPSULADO PARA CÁLCULO DE MÉTRICAS OPERATIVAS (v18.0.0-OPERATIONAL-METRICS)
 * Calcula de forma independiente el desempeño de captura, meses esperados y el cumplimiento operativo real.
 */
export const calculateOperationalMetrics = (
  item: DashboardItem,
  globalThresholds: ComplianceThresholds,
  year: number = new Date().getFullYear(),
  mode: 'realTime' | 'definitive' = 'realTime',
  contextItems: DashboardItem[] = []
): OperationalMetrics => {
  const shielded = shieldItem(item);
  
  // 1. Resolver los valores reales de metas y avances (soporte para compuestos, fórmulas y semanales)
  const { monthlyProgress, monthlyGoals } = resolveItemValues(shielded, contextItems, year);

  // 2. Obtener el índice de inicio operativo (Part B: inicio por primer periodo con meta efectiva)
  const isMinimize = shielded.goalType === 'minimize' || (shielded as any).type === 'minimize' || (shielded as any).type === 'lower' || (shielded as any).type === 'min';
  const hasValidGoal = (g: any) => g !== null && g !== undefined && g !== "" && !isNaN(Number(g)) && (isMinimize ? true : Number(g) > 0);
  const firstGoalIdx = monthlyGoals.findIndex(hasValidGoal);

  let startPeriodIdx = 0;
  if ((shielded as any).operationalStartPeriod !== undefined && (shielded as any).operationalStartPeriod !== null) {
    startPeriodIdx = parsePeriodToIndex((shielded as any).operationalStartPeriod);
  } else {
    startPeriodIdx = firstGoalIdx >= 0 ? firstGoalIdx : 0;
  }

  // 3. Determinar el límite del periodo a evaluar (limitIdx)
  const currentYear = new Date().getFullYear();
  const currentMonthIdx = new Date().getMonth();

  let limitIdx = 11;
  if (year === currentYear) {
    if (mode === 'realTime') {
      limitIdx = currentMonthIdx;
    } else {
      limitIdx = currentMonthIdx - 1;
    }
  } else if (year > currentYear) {
    limitIdx = -1;
  }

  // 4. Calcular periodos esperados
  const expectedPeriods = Math.max(0, limitIdx - startPeriodIdx + 1);

  let capturedPeriods = 0;
  const missingPeriodsList: number[] = [];

  for (let m = startPeriodIdx; m <= limitIdx; m++) {
    const val = monthlyProgress[m];
    const goal = monthlyGoals[m];

    const isNullVal = val === null || val === undefined || val === "" || isNaN(Number(val));
    const isNullGoal = goal === null || goal === undefined || goal === "" || isNaN(Number(goal));
    
    const isGoalZero = Number(goal || 0) === 0;
    const isValZero = Number(val || 0) === 0;

    const isCaptured = !isNullVal && !isNullGoal && !(isGoalZero && isValZero);

    if (isCaptured) {
      capturedPeriods++;
    } else {
      missingPeriodsList.push(m);
    }
  }

  const missingPeriods = expectedPeriods - capturedPeriods;
  const captureRate = expectedPeriods > 0 ? (capturedPeriods / expectedPeriods) * 100 : 100;

  // 5. Calcular performanceScore tradicional (acotado a meses capturados)
  const itemForPerformance = {
    ...shielded,
    monthlyGoals: shielded.monthlyGoals.map((g, m) => {
      const isExpected = m >= startPeriodIdx && m <= limitIdx;
      if (!isExpected) return g;

      const val = monthlyProgress[m];
      const isNullVal = val === null || val === undefined || val === "" || isNaN(Number(val));
      const isNullGoal = g === null || g === undefined || g === "" || isNaN(Number(g));
      const isGoalZero = Number(g || 0) === 0;
      const isValZero = Number(val || 0) === 0;
      const isCaptured = !isNullVal && !isNullGoal && !(isGoalZero && isValZero);

      return isCaptured ? g : null;
    })
  };
  const traditional = calculateCompliance(itemForPerformance, globalThresholds, year, mode, [], contextItems);
  const performanceScore = traditional.overallPercentage;
  const performanceStatus = traditional.complianceStatus;

  // 6. Calcular realOperationalScore (meses vencidos no capturados como 0% de cumplimiento)
  const isAccumulative = isAccumulativeIndicator(shielded.indicator, shielded.type);
  const lowerIsBetter = shielded.goalType === 'minimize' || (shielded as any).type === 'minimize' || (shielded as any).type === 'lower' || (shielded as any).type === 'min';

  let realOperationalScore = 0;

  if (expectedPeriods === 0) {
    realOperationalScore = performanceScore;
  } else if (isAccumulative) {
    let sumProgress = 0;
    let sumTarget = 0;

    for (let m = startPeriodIdx; m <= limitIdx; m++) {
      const val = monthlyProgress[m];
      const goal = monthlyGoals[m];

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

    for (let m = startPeriodIdx; m <= limitIdx; m++) {
      const val = monthlyProgress[m];
      const goal = monthlyGoals[m];

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

  // 7. Calcular stalenessDays (atraso de captura)
  let stalenessDays = 0;
  if (missingPeriodsList.length > 0) {
    const oldestMissingMonth = missingPeriodsList[0];
    const today = new Date();
    const endOfMissingMonth = new Date(year, oldestMissingMonth + 1, 0);
    const diffTime = today.getTime() - endOfMissingMonth.getTime();
    stalenessDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  }

  // 8. Semáforos
  const thresholds: ComplianceThresholds = (shielded as any).thresholds ?? globalThresholds;
  const captureStatus = getStatusForPercentage(captureRate, thresholds, true, true);
  const operationalStatus = getStatusForPercentage(realOperationalScore, thresholds, true, true);

  return {
    expectedPeriods,
    capturedPeriods,
    missingPeriods,
    captureRate,
    performanceScore,
    realOperationalScore,
    stalenessDays,
    performanceStatus,
    captureStatus,
    operationalStatus
  };
};

/**
 * 🌟 ADJUNTA MÉTRICAS OPERATIVAS DE FORMA INMUTABLE
 * Retorna un nuevo DashboardItem con la propiedad operationalMetrics calculada de forma segura.
 */
export const attachOperationalMetrics = (
  item: DashboardItem,
  globalThresholds: ComplianceThresholds,
  year: number = new Date().getFullYear(),
  mode: 'realTime' | 'definitive' = 'realTime',
  contextItems: DashboardItem[] = []
): DashboardItem => {
  const metrics = calculateOperationalMetrics(item, globalThresholds, year, mode, contextItems);
  return {
    ...item,
    operationalMetrics: metrics
  };
};

