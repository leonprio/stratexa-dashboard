import { Dashboard, DashboardItem, SystemSettings } from '../types';
import { resolveItemValues, isAccumulativeIndicator, calculateCapturePct } from './compliance';

// Helper para obtener el último valor válido de un array (mes actual o anterior con datos)
const getLastValidValue = (arr: (number | null)[] | undefined): number => {
    if (!arr || !Array.isArray(arr) || arr.length === 0) return 0;

    // 1. Intentar mes actual (si ya tiene dato)
    const currentMonth = new Date().getMonth();
    if (arr[currentMonth] !== null && arr[currentMonth] !== 0) return Number(arr[currentMonth]);

    // 2. Buscar hacia atrás desde el mes actual
    for (let i = currentMonth - 1; i >= 0; i--) {
        if (arr[i] !== null && arr[i] !== 0) return Number(arr[i]);
    }

    // 3. Fallback: Buscar cualquier valor en el futuro (por si acaso se llenó adelantado)
    const futureVal = arr.find(v => v !== null && v !== 0);
    return Number(futureVal) || 0;
};

/**
 * Determina si todos los tableros tienen exactamente los mismos indicadores
 * (mismo conjunto de nombres y la misma configuración básica).
 */
/**
 * Determina si todos los tableros tienen exactamente los mismos indicadores.
 * Además, opcionalmente compara el primer valor de cada indicador para detectar
 * diferencias reales en los datos (evita que tableros con la misma estructura
 * pero valores distintos sean tratados como idénticos).
 */
const haveIdenticalIndicators = (dashboards: Dashboard[]): boolean => {
    if (dashboards.length < 2) return true; // Un solo tablero es "idéntico" a sí mismo
    const reference = dashboards[0].items.map(i => ({
        indicator: i.indicator.trim().toUpperCase(),
        type: i.type,
        goalType: i.goalType,
        unit: i.unit,
    }));
    const refKey = JSON.stringify(reference);
    return dashboards.every(d => {
        const key = JSON.stringify(
            d.items.map(i => ({
                indicator: i.indicator.trim().toUpperCase(),
                type: i.type,
                goalType: i.goalType,
                unit: i.unit,
            }))
        );
        return key === refKey;
    });
};


/**
 * Calculates an aggregated dashboard from a list of dashboards.
 * Items with the same indicator name are grouped together.
 * Values are summed or averaged based on the item's type ('accumulative' or 'average').
 */
export const calculateAggregateDashboard = (
    dashboards: Dashboard[],
    settings?: SystemSettings
): Dashboard => {
    if (!dashboards || !Array.isArray(dashboards) || dashboards.length === 0) {
        return {
            id: -1,
            title: 'Tablero General',
            subtitle: 'Visión Agregada',
            items: [],
            thresholds: { onTrack: 95, atRisk: 85 },
            isAggregate: true
        };
    }

    const firstBoard = dashboards[0];
    const aggregatedItems: DashboardItem[] = [];

    // 🌟 ESTRATEGIA DE PONDERACIÓN GLOBAL (v9.1.0-PRO-FINAL-SHIELDED)
    const strategy = settings?.aggregationStrategy || 'manual';
    const dashboardWeights = new Map<number | string, number>();
    let totalWeightDivisor = 0;

    dashboards.forEach(d => {
        let w = 1;
        if (strategy === 'manual') {
            w = d.dashboardWeight || (settings?.customWeights?.[String(d.id)] ?? 1);
        } else if (strategy === 'indicator' && settings?.indicatorDriver) {
            const driverItem = d.items.find(it =>
                it.indicator.trim().toUpperCase() === settings.indicatorDriver?.trim().toUpperCase()
            );
            w = getLastValidValue(driverItem?.monthlyProgress) || 0.1;
        }
        dashboardWeights.set(String(d.id), w);
        totalWeightDivisor += w;
    });

    if (totalWeightDivisor === 0) totalWeightDivisor = 1;

    // 🔍 SMART MATCH AGGREGATION (v9.1.0-PRO-FINAL-SHIELDED)
    // Agrupar todos los indicadores únicos por nombre normalizado
    const uniqueIndicators = new Map<string, { name: string, representative: DashboardItem, sourceBoards: { board: Dashboard, item: DashboardItem }[] }>();

    dashboards.forEach(d => {
        if (!d || !d.items) return; // 🛡️ BLINDAJE v9.1.0-PRO-FINAL-SHIELDED: Saltar si el tablero está corrupto
        d.items.forEach(item => {
            if (!item || !item.indicator) return; // 🛡️ BLINDAJE v9.1.0-PRO-FINAL-SHIELDED: Saltar si el item está corrupto
            // 🛡️ FIX v9.1.0-PRO-FINAL-SHIELDED: ROBUST NORMALIZATION (handles extra spaces and accents)
            const normName = item.indicator.replace(/\s+/g, ' ').trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            if (!uniqueIndicators.has(normName)) {
                uniqueIndicators.set(normName, {
                    name: item.indicator.trim().toUpperCase(),
                    representative: item,
                    sourceBoards: []
                });
            }
            uniqueIndicators.get(normName)!.sourceBoards.push({ board: d, item });
        });
    });

    // Procesar cada indicador único
    let virtualId = -100;
    uniqueIndicators.forEach((data, _normName) => {
        const base = data.representative;
        const aggItem: DashboardItem = {
            ...base,
            id: virtualId--,
            indicator: data.sourceBoards.length === 1 && dashboards.length > 1
                ? `${data.name} (${data.sourceBoards[0].board.title})`
                : data.name,
            // 🛡️ REGLA v9.1.0-PRO-FINAL-SHIELDED: Guardar orígenes para propagación inversa
            sources: data.sourceBoards.map(sb => ({ boardId: sb.board.id, itemId: sb.item.id }))
        } as any;

        // 🛡️ REGLA v9.1.0-PRO-FINAL-SHIELDED: Inicializar con null para auditoría real
        aggItem.monthlyProgress = new Array(12).fill(null);
        aggItem.monthlyGoals = new Array(12).fill(null);
        if (base.weeklyProgress) aggItem.weeklyProgress = new Array(53).fill(null);
        if (base.weeklyGoals) aggItem.weeklyGoals = new Array(53).fill(null);



        // 🛡️ REGLA v9.1.0-PRO-FINAL-SHIELDED (NUCLEAR RECOVERY):
        // Usamos el helper centralizado para decidir si sumamos o promediamos.
        const effectiveType = isAccumulativeIndicator(data.name, base.type) ? 'accumulative' : 'average';
        aggItem.type = effectiveType; // 👈 CRÍTICO: Persistir en el objeto devuelto

        if (effectiveType === 'accumulative') {
            // SUMA CON PROPAGACIÓN DE NULL
            data.sourceBoards.forEach(({ item, board }) => {
                // 🚀 RESOLVE VALUES FIRST (v9.1.0-PRO-FINAL-SHIELDED)
                // Esto asegura que si es 'Bajas Totales' (Compuesto), usemos el valor calculado y no el 0 de la BD.
                const { monthlyProgress: resolvedProgress, monthlyGoals: resolvedGoals } =
                    resolveItemValues(item, board.items, board.year || new Date().getFullYear());

                resolvedProgress.forEach((v, idx) => {
                    if (idx < 12 && v !== null && v !== undefined) {
                        aggItem.monthlyProgress[idx] = (aggItem.monthlyProgress[idx] || 0) + Number(v);
                    }
                });
                resolvedGoals.forEach((v, idx) => {
                    if (idx < 12 && v !== null && v !== undefined) {
                        aggItem.monthlyGoals[idx] = (aggItem.monthlyGoals[idx] || 0) + Number(v);
                    }
                });

                // Weekly logic remains using raw values for now as resolveItemValues handles weekly aggregation to monthly
                // but doesn't return computed weekly arrays yet. 
                // ⚠️ TODO: If we need computed weekly values for aggregation, we'd need to extend resolveItemValues.
                // For now, Bajas Totales is monthly usually.
                if (item.weeklyProgress && aggItem.weeklyProgress) {
                    item.weeklyProgress.forEach((v, idx) => {
                        if (idx < 53 && v !== null && v !== undefined) {
                            aggItem.weeklyProgress![idx] = (aggItem.weeklyProgress![idx] || 0) + Number(v);
                        }
                    });
                }
                if (item.weeklyGoals && aggItem.weeklyGoals) {
                    item.weeklyGoals.forEach((v, idx) => {
                        if (idx < 53 && v !== null && v !== undefined) {
                            aggItem.weeklyGoals![idx] = (aggItem.weeklyGoals![idx] || 0) + Number(v);
                        }
                    });
                }
            });
        } else {
            // PROMEDIO PONDERADO CON PROPAGACIÓN DE NULL
            const calculateWeightedArr = (isProgress: boolean) => {
                const result = new Array(12).fill(null);
                const precision = settings?.decimalPrecision ?? 2;

                for (let t = 0; t < 12; t++) {
                    let sumVal = 0;
                    let sumW = 0;
                    let hasData = false;

                    data.sourceBoards.forEach(({ board, item }) => {
                        // 🚀 RESOLVE VALUES FIRST (v9.1.0-PRO-FINAL-SHIELDED)
                        // Indispensable para indicadores semanales que no tienen data mensual en la BD.
                        const { monthlyProgress: resolvedProgress, monthlyGoals: resolvedGoals } =
                            resolveItemValues(item, board.items, board.year || new Date().getFullYear());

                        const arr = isProgress ? resolvedProgress : resolvedGoals;
                        const val = arr[t];
                        if (val !== null && val !== undefined) {
                            const w = dashboardWeights.get(String(board.id)) || 0;
                            sumVal += (Number(val) * w);
                            sumW += w;
                            hasData = true;
                        }
                    });

                    if (hasData) {
                        result[t] = sumW > 0 ? Number((sumVal / sumW).toFixed(precision)) : 0;
                    }
                }
                return result;
            };

            aggItem.monthlyProgress = calculateWeightedArr(true);
            aggItem.monthlyGoals = calculateWeightedArr(false);

            if (base.weeklyProgress) {
                const resultW = new Array(53).fill(null);
                for (let t = 0; t < 53; t++) {
                    let sumVal = 0;
                    let sumW = 0;
                    let hasData = false;
                    data.sourceBoards.forEach(({ board, item }) => {
                        const val = item.weeklyProgress ? item.weeklyProgress[t] : null;
                        if (val !== null && val !== undefined) {
                            const w = dashboardWeights.get(String(board.id)) || 0;
                            sumVal += (Number(val) * w);
                            sumW += w;
                            hasData = true;
                        }
                    });
                    if (hasData) {
                        resultW[t] = sumW > 0 ? Number((sumVal / sumW).toFixed(2)) : 0;
                    }
                }
                aggItem.weeklyProgress = resultW;
            }

            if (base.weeklyGoals) {
                const resultG = new Array(53).fill(null);
                for (let t = 0; t < 53; t++) {
                    let sumVal = 0;
                    let sumW = 0;
                    let hasData = false;
                    data.sourceBoards.forEach(({ board, item }) => {
                        const val = item.weeklyGoals ? item.weeklyGoals[t] : null;
                        if (val !== null && val !== undefined) {
                            const w = dashboardWeights.get(String(board.id)) || 0;
                            sumVal += (Number(val) * w);
                            sumW += w;
                            hasData = true;
                        }
                    });
                    if (hasData) {
                        resultG[t] = sumW > 0 ? Number((sumVal / sumW).toFixed(2)) : 0;
                    }
                }
                aggItem.weeklyGoals = resultG;
            }
        }
        aggregatedItems.push(aggItem);
    });

    // 🛡️ FIX v9.1.0-PRO-FINAL-SHIELDED: Final Sort by Order
    // Ensure the aggregated dashboard reflects the semantic order of KPIs
    const sortedItems = aggregatedItems.sort((a, b) => {
        const orderA = a.order !== undefined ? a.order : 9999;
        const orderB = b.order !== undefined ? b.order : 9999;
        return orderA - orderB;
    });

    // 🛡️ REGLA v9.1.0-PRO-FINAL-SHIELDED: Calcular matemáticamente el porcentaje de captura del consolidado
    let totalCapture = 0;
    dashboards.forEach(d => {
        totalCapture += calculateCapturePct(d);
    });
    const avgCapture = dashboards.length > 0 ? Math.round(totalCapture / dashboards.length) : 0;

    return {
        id: -1,
        title: 'Tablero General',
        subtitle: `Consolidado de ${dashboards.length} tableros`,
        items: sortedItems,
        thresholds: firstBoard.thresholds,
        isAggregate: true,
        capturePct: avgCapture
    } as any;
};

