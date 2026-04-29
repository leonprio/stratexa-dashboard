import { calculateOfficialGroups } from './dashboardLogic';
import { DashboardRole } from '../types';
import { normalizeGroupName } from './formatters';

describe('calculateOfficialGroups', () => {
    const mockUser = (overrides = {}) => ({
        id: 'u1',
        name: 'Test',
        clientId: 'IPS',
        globalRole: 'Director',
        directorTitle: 'Director Financiero',
        subGroups: [],
        dashboardAccess: {},
        ...overrides
    });

    const mockDashboard = (overrides = {}) => ({
        id: Math.random().toString(),
        title: 'Dash',
        group: 'FINANZAS',
        clientId: 'IPS',
        items: [],
        ...overrides
    });

    test('debe de-duplicar grupos por normalización', () => {
        const userProfile = mockUser({ directorTitle: 'Frontera Norte' });
        const users = [userProfile];
        const dashboards = [
            mockDashboard({ group: 'Dirección Frontera Norte' })
        ];

        const groups = calculateOfficialGroups(users as any, dashboards as any, userProfile as any, false, 'IPS');

        // Expect strict deduplication to ONE key
        // normalize('Frontera Norte') -> 'NORTE'
        // normalize('Dirección Frontera Norte') -> 'NORTE'
        expect(groups).toHaveLength(1);
        expect(groups[0]).toMatch(/^(NORTE|FRONTERA NORTE|DIRECCIÓN FRONTERA NORTE|DIRECTOR FRONTERA NORTE)$/);
    });

    test('debe de-duplicar "Operaciones" vs "Dirección de Operaciones"', () => {
        const userProfile = mockUser({ directorTitle: 'Dirección de Operaciones' });
        const users = [userProfile];
        const dashboards = [
            mockDashboard({ group: 'Operaciones' })
        ];

        const groups = calculateOfficialGroups(users as any, dashboards as any, userProfile as any, false, 'IPS');

        expect(groups).toHaveLength(1);
        expect(groups[0]).toMatch(/^(OPERACIONES|DIRECCIÓN OPERACIONES|DIRECCIÓN DE OPERACIONES|DIRECTOR DE OPERACIONES)$/);
    });

    test('debe manejar visibilidad de "Dirección Operaciones" para Director de Ops', () => {
        const userProfile = mockUser({
            directorTitle: 'Director Operaciones',
            group: 'SINTESIS',
            subGroups: [],
            dashboardAccess: {}
        });
        const users = [userProfile];
        const dashboards = [
            mockDashboard({ id: '99', group: 'Operaciones' })
        ];

        // isGlobalAdmin = false
        const groups = calculateOfficialGroups(users as any, dashboards as any, userProfile as any, false, 'IPS');

        console.log("DEBUG: groups for Ops Director", groups);

        // Debe ver Operaciones porque su título lo dice, aunque no tenga acceso explícito al dashboard 99?
        // Actualmente App.tsx dice: userIsOps && !groups.some(...) -> push("DIRECCIÓN OPERACIONES")
        expect(groups[0]).toMatch(/^(DIRECCIÓN OPERACIONES|DIRECTOR OPERACIONES)$/);
    });

    test('debe mostrar todos los grupos para Admin Global', () => {
        const userProfile = mockUser({ globalRole: 'Admin' });
        const users = [userProfile];
        const dashboards = [
            mockDashboard({ group: 'GRUPO A' }),
            mockDashboard({ group: 'GRUPO B' })
        ];

        const groups = calculateOfficialGroups(users as any, dashboards as any, userProfile as any, true, 'IPS');

        expect(groups).toContain('GRUPO A');
        expect(groups).toContain('GRUPO B');
    });

    test('no debe mostrar grupos sin acceso para directores normales', () => {
        const userProfile = mockUser({
            directorTitle: 'Director A',
            dashboardAccess: {}
        });
        const users = [userProfile];
        const dashboards = [
            mockDashboard({ id: 'd1', group: 'GRUPO A' }),
            mockDashboard({ id: 'd2', group: 'GRUPO B' })
        ];

        const groups = calculateOfficialGroups(users as any, dashboards as any, userProfile as any, false, 'IPS');

        expect(groups).toContain('DIRECTOR A');
        expect(groups).not.toContain('GRUPO B');
    });
});
