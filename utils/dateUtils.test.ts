import { getLastClosedMonthIndex } from './dateUtils';

describe('dateUtils', () => {
    describe('getLastClosedMonthIndex', () => {
        test('debe retornar el mes anterior si hoy es después del día de cierre', () => {
            // 10 de Febrero (Index 1)
            const date = new Date(2026, 1, 10);
            // El cierre fue el día 5. Enero (Index 0) ya está cerrado.
            expect(getLastClosedMonthIndex(date, 5)).toBe(0);
        });

        test('debe retornar dos meses atrás si hoy es antes del día de cierre', () => {
            // 3 de Febrero (Index 1)
            const date = new Date(2026, 1, 3);
            // El cierre es el día 5. Enero (Index 0) aún no cierra "oficialmente" en este flujo.
            // Retorna Diciembre del año anterior (Index -1)
            expect(getLastClosedMonthIndex(date, 5)).toBe(-1);
        });

        test('debe usar el día de cierre por defecto (5)', () => {
            const datePost = new Date(2026, 1, 6);
            expect(getLastClosedMonthIndex(datePost)).toBe(0);

            const datePre = new Date(2026, 1, 4);
            expect(getLastClosedMonthIndex(datePre)).toBe(-1);
        });
    });
});
