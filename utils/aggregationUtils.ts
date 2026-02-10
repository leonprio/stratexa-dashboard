import { Dashboard, DashboardItem, SystemSettings } from '../types';

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

    // 🌟 ESTRATEGIA DE PONDERACIÓN GLOBAL (v3.0.0)
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

    // 🔍 SMART MATCH AGGREGATION (v5.1.2)
    // Agrupar todos los indicadores únicos por nombre normalizado
    const uniqueIndicators = new Map<string, { name: string, representative: DashboardItem, sourceBoards: { board: Dashboard, item: DashboardItem }[] }>();

    dashboards.forEach(d => {
        if (!d || !d.items) return; // 🛡️ BLINDAJE v5.3.6: Saltar si el tablero está corrupto
        d.items.forEach(item => {
            if (!item || !item.indicator) return; // 🛡️ BLINDAJE v5.3.6: Saltar si el item está corrupto
            const normName = item.indicator.trim().toUpperCase();
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
                ? `${data.representative.indicator} (${data.sourceBoards[0].board.title})`
                : data.representative.indicator
        };

        // 🛡️ REGLA v5.5.9.5: Inicializar con null para auditoría real
        aggItem.monthlyProgress = new Array(12).fill(null);
        aggItem.monthlyGoals = new Array(12).fill(null);
        if (base.weeklyProgress) aggItem.weeklyProgress = new Array(53).fill(null);
        if (base.weeklyGoals) aggItem.weeklyGoals = new Array(53).fill(null);

        if (aggItem.type === 'accumulative') {
            // SUMA CON PROPAGACIÓN DE NULL
            data.sourceBoards.forEach(({ item }) => {
                item.monthlyProgress.forEach((v, idx) => {
                    if (idx < 12 && v !== null && v !== undefined) {
                        aggItem.monthlyProgress[idx] = (aggItem.monthlyProgress[idx] || 0) + Number(v);
                    }
                });
                item.monthlyGoals.forEach((v, idx) => {
                    if (idx < 12 && v !== null && v !== undefined) {
                        aggItem.monthlyGoals[idx] = (aggItem.monthlyGoals[idx] || 0) + Number(v);
                    }
                });
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
                        const val = isProgress ? item.monthlyProgress[t] : item.monthlyGoals[t];
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

    return {
        id: -1,
        title: 'Tablero General',
        subtitle: `Consolidado de ${dashboards.length} tableros`,
        items: aggregatedItems,
        thresholds: firstBoard.thresholds,
        isAggregate: true
    };
};

