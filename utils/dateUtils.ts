// utils/dateUtils.ts

/**
 * Determina el último mes "cerrado" basado en una fecha y un día de cierre.
 * Si hoy es <= cierreDay, el mes cerrado es el antepenúltimo? No.
 * Ejemplo: Si hoy es 3 de Febrero y el cierre es el 5, Enero aún NO está cerrado? 
 * No, usualmente el cierre es para capturar el mes anterior.
 * Si hoy es 3 de Febrero, el mes anterior es Enero.
 * Si hoy es 3 de Febrero y el cierre es el 5, Enero está "En Proceso" pero para efectos de Semáforo 
 * Definitivo podría considerarse aún no vencido.
 */
export const getLastClosedMonthIndex = (date: Date = new Date(), closingDay: number = 5): number => {
    const currentMonth = date.getMonth(); // 0-11
    const currentDay = date.getDate();

    if (currentDay < closingDay) {
        // Si estamos antes del día de cierre, el mes anterior aún está en gracia.
        // El mes cerrado es el tras-anterior.
        return currentMonth - 2;
    }

    // Si ya pasamos el día de cierre, el mes anterior ya debería estar cerrado.
    return currentMonth - 1;
};

/**
 * Determina la última semana "cerrada" (que terminó completamente).
 */
export const getLastClosedWeekIndex = (date: Date = new Date(), startDay: 0 | 1 = 1): number => {
    // Una semana está cerrada si ya pasó su domingo (si empieza lunes).
    // Básicamente, la semana del "getWeekNumber(hoy) - 2" es la última COMPLETA que pasó.
    // Ejemplo: Lunes de semana 10. La semana 9 terminó ayer (Domingo).
    // Entonces la semana 9 es la última cerrada.
    const d = new Date(date);
    const day = d.getDay(); // 0-6

    // Si es Lunes (1) y queremos cerrar la semana anterior (que terminó el Domingo 0)
    // Siempre restamos al menos 1 semana del número actual para tener una semana COMPLETA.
    return -1; // Placeholder for logic
};
