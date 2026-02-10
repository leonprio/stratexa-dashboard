// Constantes globales para la estructura estándar de tableros IPS
// REGLA: Estos valores son la fuente de verdad para nombres e indicadores
// ⚠️ IMPORTANTE: Esta estructura es SOLO para el cliente "ips"
// Otros clientes deben crear sus propios tableros VACÍOS

export const IPS_DASHBOARDS = [
    { num: 1, name: "METRO CENTRO", group: "METROPOLITANA" },
    { num: 2, name: "METRO SUR", group: "METROPOLITANA" },
    { num: 3, name: "METRO NORTE", group: "METROPOLITANA" },
    { num: 4, name: "TOLUCA", group: "CENTRO" },
    { num: 5, name: "GTMI", group: "CENTRO" },
    { num: 6, name: "OCCIDENTE", group: "OCCIDENTE" },
    { num: 7, name: "BAJIO", group: "BAJIO" },
    { num: 8, name: "SLP", group: "BAJIO" },
    { num: 9, name: "SUR", group: "SUR" },
    { num: 10, name: "GOLFO", group: "GOLFO" },
    { num: 11, name: "PENINSULA", group: "PENINSULA" },
    { num: 12, name: "PACIFICO", group: "PACIFICO" },
    { num: 13, name: "NOROESTE", group: "NORTE" },
    { num: 14, name: "NORESTE", group: "NORTE" },
] as const;

// Indicadores estándar SOLO para cliente IPS
// Pesos confirmados por el usuario (5+20+5+20+10+3+4+3+5+5+5+5+5+5 = 100%)
export const IPS_INDICATORS = [
    {
        id: 1,
        indicator: "% Disminución del monto en notas de crédito",
        weight: 5,
        unit: "%",
        type: "average" as const,
        goalType: "maximize" as const,
    },
    {
        id: 2,
        indicator: "Turnos no cubiertos",
        weight: 20,
        unit: "turnos",
        type: "accumulative" as const,
        goalType: "minimize" as const,
    },
    {
        id: 3,
        indicator: "Estado de fuerza",
        weight: 5,
        unit: "%",
        type: "average" as const,
        goalType: "maximize" as const,
    },
    {
        id: 4,
        indicator: "% Retención",
        weight: 20,
        unit: "%",
        type: "average" as const,
        goalType: "maximize" as const,
    },
    {
        id: 5,
        indicator: "Supervisiones físicas",
        weight: 10,
        unit: "unidades",
        type: "accumulative" as const,
        goalType: "maximize" as const,
    },
    {
        id: 6,
        indicator: "APT",
        weight: 3,
        unit: "casos",
        type: "accumulative" as const,
        goalType: "minimize" as const,
    },
    {
        id: 7,
        indicator: "RI",
        weight: 4,
        unit: "casos",
        type: "accumulative" as const,
        goalType: "minimize" as const,
    },
    {
        id: 8,
        indicator: "Minutas",
        weight: 3,
        unit: "unidades",
        type: "accumulative" as const,
        goalType: "maximize" as const,
    },
    {
        id: 9,
        indicator: "Premiaciones",
        weight: 5,
        unit: "unidades",
        type: "accumulative" as const,
        goalType: "maximize" as const,
    },
    {
        id: 10,
        indicator: "Aclaraciones de Nomina",
        weight: 5,
        unit: "aclaraciones",
        type: "accumulative" as const,
        goalType: "minimize" as const,
    },
    {
        id: 11,
        indicator: "% Pases de lista a TSP en AXELIA",
        weight: 5,
        unit: "%",
        type: "average" as const,
        goalType: "maximize" as const,
    },
    {
        id: 12,
        indicator: "Soportes de facturación entregados",
        weight: 5,
        unit: "%",
        type: "average" as const,
        goalType: "maximize" as const,
    },
    {
        id: 13,
        indicator: "% Checklists entregados de parque vehicular",
        weight: 5,
        unit: "%",
        type: "average" as const,
        goalType: "maximize" as const,
    },
    {
        id: 14,
        indicator: "% VIGIMOS Entregados",
        weight: 5,
        unit: "%",
        type: "average" as const,
        goalType: "maximize" as const,
    },
] as const;

// Crear un DashboardItem vacío basado en un indicador IPS
export function createEmptyIPSIndicator(stdIndicator: typeof IPS_INDICATORS[number]) {
    return {
        id: stdIndicator.id,
        indicator: stdIndicator.indicator,
        weight: stdIndicator.weight,
        unit: stdIndicator.unit,
        type: stdIndicator.type,
        goalType: stdIndicator.goalType,
        monthlyGoals: Array(12).fill(null),
        monthlyProgress: Array(12).fill(null),
        monthlyNotes: Array(12).fill(""),
    };
}

// Crear todos los indicadores IPS vacíos para un tablero
export function createEmptyIPSIndicators() {
    return IPS_INDICATORS.map(createEmptyIPSIndicator);
}

// Validar si un número de tablero es válido para IPS (1-14)
export function isValidIPSDashboardNumber(num: number): boolean {
    return num >= 1 && num <= 14;
}

// Obtener info del tablero IPS por número
export function getIPSDashboard(num: number) {
    return IPS_DASHBOARDS.find((d) => d.num === num);
}

export function getIPSDashboardGroup(num: number): string {
    return IPS_DASHBOARDS.find(d => d.num === num)?.group || "General";
}

// ============================================
// LEGACY ALIASES (mantener compatibilidad)
// ============================================
export const STANDARD_DASHBOARDS = IPS_DASHBOARDS;
export const STANDARD_INDICATORS = IPS_INDICATORS;
export const createEmptyIndicators = createEmptyIPSIndicators;
export const createEmptyIndicator = createEmptyIPSIndicator;
