import { User, DashboardItem, GlobalUserRole, DashboardRole, Dashboard as DashboardType } from '../types';

export const initialUsers: User[] = [
    { id: 'user_admin', name: 'Administrador Principal', email: 'admin@prior.com', globalRole: GlobalUserRole.Admin, dashboardAccess: {} },
    { id: 'user_editor', name: 'Editor de Contenido', email: 'editor@prior.com', globalRole: GlobalUserRole.Member, dashboardAccess: { 1: DashboardRole.Editor } },
    { id: 'user_viewer', name: 'Visualizador', email: 'viewer@prior.com', globalRole: GlobalUserRole.Member, dashboardAccess: { 1: DashboardRole.Viewer } },
];

export const initialDashboardData: DashboardItem[] = [
    { id: 1, indicator: '% Disminución del monto en notas de crédito', weight: 5, monthlyGoals: [60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60], monthlyProgress: [41, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], unit: '%', type: 'average', goalType: 'maximize' },
    { id: 2, indicator: 'Turnos no cubiertos', weight: 13, monthlyGoals: [5, 5, 5, 4, 4, 4, 3, 3, 3, 2, 2, 2], monthlyProgress: [6, 5, 7, 4, 5, 3, 4, 2, 0, 0, 0, 0], unit: 'turnos', type: 'accumulative', goalType: 'minimize' },
    { id: 3, indicator: 'Estado de fuerza', weight: 5, monthlyGoals: [95, 95, 95, 95, 95, 95, 95, 95, 95, 95, 95, 95], monthlyProgress: [96, 95, 94, 97, 98, 95, 96, 97, 0, 0, 0, 0], unit: '%', type: 'average', goalType: 'maximize' },
    { id: 4, indicator: '% Retención', weight: 15, monthlyGoals: [90, 90, 92, 92, 92, 92, 95, 95, 95, 95, 95, 95], monthlyProgress: [88, 89, 91, 92, 90, 93, 94, 95, 0, 0, 0, 0], unit: '%', type: 'average', goalType: 'maximize' },
    { id: 5, indicator: 'Supervisiones físicas', weight: 10, monthlyGoals: [50, 50, 50, 60, 60, 60, 70, 70, 70, 80, 80, 80], monthlyProgress: [45, 55, 52, 65, 62, 68, 70, 75, 0, 0, 0, 0], unit: 'unidades', type: 'accumulative', goalType: 'maximize' },
    { id: 6, indicator: 'APT', weight: 2, monthlyGoals: [3, 3, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1], monthlyProgress: [4, 3, 2, 3, 2, 1, 2, 1, 0, 0, 0, 0], unit: 'casos', type: 'accumulative', goalType: 'minimize' },
    { id: 7, indicator: 'RI', weight: 3, monthlyGoals: [2, 2, 2, 1, 1, 1, 1, 0, 0, 0, 0, 0], monthlyProgress: [3, 2, 1, 2, 1, 0, 1, 0, 0, 0, 0, 0], unit: 'casos', type: 'accumulative', goalType: 'minimize' },
    { id: 8, indicator: 'Minutas', weight: 2, monthlyGoals: [20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20], monthlyProgress: [18, 22, 20, 21, 19, 25, 23, 24, 0, 0, 0, 0], unit: 'unidades', type: 'accumulative', goalType: 'maximize' },
    { id: 9, indicator: 'Premiaciones', weight: 5, monthlyGoals: [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10], monthlyProgress: [8, 9, 10, 11, 12, 10, 11, 13, 0, 0, 0, 0], unit: 'unidades', type: 'accumulative', goalType: 'maximize' },
    { id: 10, indicator: 'Aclaraciones de Nomina', weight: 5, monthlyGoals: [5, 4, 4, 4, 3, 3, 3, 3, 2, 2, 2, 2], monthlyProgress: [6, 4, 5, 3, 4, 2, 3, 2, 0, 0, 0, 0], unit: 'aclaraciones', type: 'accumulative', goalType: 'minimize' },
    { id: 11, indicator: '% Pases de lista a TSP en AXELIA', weight: 5, monthlyGoals: [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100], monthlyProgress: [98, 99, 100, 100, 99, 100, 100, 100, 0, 0, 0, 0], unit: '%', type: 'average', goalType: 'maximize' },
    { id: 12, indicator: 'Soportes de facturación entregados', weight: 5, monthlyGoals: [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100], monthlyProgress: [100, 100, 90, 100, 100, 100, 95, 100, 0, 0, 0, 0], unit: '%', type: 'average', goalType: 'maximize' },
    { id: 13, indicator: '% Cheklists entregados de parque vehicular', weight: 5, monthlyGoals: [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100], monthlyProgress: [95, 98, 99, 100, 100, 100, 100, 100, 0, 0, 0, 0], unit: '%', type: 'average', goalType: 'maximize' },
    { id: 14, indicator: '% VIGIMOS Entregados', weight: 5, monthlyGoals: [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100], monthlyProgress: [90, 95, 98, 99, 100, 100, 100, 100, 0, 0, 0, 0], unit: '%', type: 'average', goalType: 'maximize' }
];

const dashboardTitles = [
    'M CENTRO', 'M SUR', 'M NORTE', 'TOLUCA', 'GTMI', 'OCCIDENTE', 'QUERÉTARO',
    'SLP', 'SUR', 'GOLFO', 'PENINSULA', 'PACIFICO', 'NOROESTE', 'NORTE'
];

export const initialDashboards: DashboardType[] = dashboardTitles.map((title, index) => {
    const newId = index + 1;
    const newItems = JSON.parse(JSON.stringify(initialDashboardData));
    if (index > 0) {
        newItems.forEach((item: DashboardItem) => {
            item.monthlyProgress = Array(12).fill(0);
        });
    }
    return {
        id: newId,
        title: title,
        subtitle: 'Seguimiento de indicadores clave de rendimiento.',
        items: newItems,
        thresholds: { onTrack: 95, atRisk: 80 }
    };
});
