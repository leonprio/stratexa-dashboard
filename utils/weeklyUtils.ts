// utils/weeklyUtils.ts

/**
 * Obtiene el número de semana del año para una fecha dada.
 * @param date fecha a evaluar
 * @param startDay 0 para Domingo, 1 para Lunes
 */
export const getWeekNumber = (date: Date, startDay: 0 | 1 = 1): number => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || (startDay === 1 ? 7 : 0);
    if (startDay === 1) {
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    } else {
        d.setUTCDate(d.getUTCDate() + 3 - dayNum);
    }
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return weekNo;
};

/**
 * Devuelve un array de objetos representando las semanas que componen un año dado.
 * Cada objeto tiene fecha de inicio, fin y a qué meses pertenece (y qué porcentaje de días en cada uno).
 */
export interface WeekMapping {
    weekIndex: number; // 0-52
    startDate: Date;
    endDate: Date;
    monthContributions: { [monthIdx: number]: number }; // monthIdx (0-11) -> weight (0-1)
}

export const getYearWeekMapping = (year: number, startDay: 0 | 1 = 1): WeekMapping[] => {
    const weeks: WeekMapping[] = [];
    const current = new Date(year, 0, 1);

    // Retroceder hasta el inicio de la primera semana
    const day = current.getDay(); // 0 (Dom) - 6 (Sab)
    const diff = (day < startDay ? (day + 7) : day) - startDay;
    current.setDate(current.getDate() - diff);

    for (let w = 0; w < 53; w++) {
        const weekStart = new Date(current);
        const weekEnd = new Date(current);
        weekEnd.setDate(weekEnd.getDate() + 6);

        const contributions: { [m: number]: number } = {};

        const temp = new Date(weekStart);
        for (let d = 0; d < 7; d++) {
            const currentYear = temp.getFullYear();
            let effectiveMonth = temp.getMonth();

            // 🛡️ REGLA DE CONSERVACIÓN (v2.2.6): 
            // Si la semana es parte del Tablero {year}, no podemos "perder" días en el limbo del año anterior/siguiente.
            if (currentYear < year) effectiveMonth = 0;
            else if (currentYear > year) effectiveMonth = 11;

            contributions[effectiveMonth] = (contributions[effectiveMonth] || 0) + (1 / 7);
            temp.setDate(temp.getDate() + 1);
        }

        if (Object.keys(contributions).length > 0) {
            weeks.push({
                weekIndex: w,
                startDate: weekStart,
                endDate: weekEnd,
                monthContributions: contributions
            });
        }

        current.setDate(current.getDate() + 7);
        if (current.getFullYear() > year && current.getMonth() > 0) break;
    }
    return weeks;
};

/**
 * Agrega datos semanales a mensuales basándose en la proporción de días.
 */
export const aggregateWeeklyToMonthly = (
    weeklyValues: (number | null)[],
    year: number,
    startDay: 0 | 1 = 1,
    maxWeek?: number,
    mode: 'average' | 'sum' = 'average'
): (number | null)[] => {
    const mapping = getYearWeekMapping(year, startDay);
    const monthlyItems = Array(12).fill(0);
    const monthlyWeights = Array(12).fill(0);

    mapping.forEach((week, idx) => {
        if (maxWeek !== undefined && idx > maxWeek) return;
        const val = weeklyValues[idx];
        if (val === null || val === undefined) return;

        Object.entries(week.monthContributions).forEach(([mIdx, weight]) => {
            const m = parseInt(mIdx);
            monthlyItems[m] += (val * weight);
            monthlyWeights[m] += weight;
        });
    });

    return monthlyItems.map((val, i) => {
        if (monthlyWeights[i] === 0) return null;
        // Si es suma (acumulativo), queremos el total absoluto contribuido al mes.
        // NO dividimos por el peso del tiempo.
        // Ejemplo: Venta de 100 en una semana que cae 50% en Enero.
        // Enero recibe 50. Enero NO recibe 50 / 0.5 = 100.
        if (mode === 'sum') return val;

        // Si es promedio (tasa), normalizamos por el peso temporal.
        return val / monthlyWeights[i];
    });
};
