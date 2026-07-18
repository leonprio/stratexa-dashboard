import { calculateDashboardMonthlyScores, resolveItemValues, calculateOperationalMetrics, attachOperationalMetrics } from "./compliance";
import { DashboardItem } from "../types";

describe("compliance.ts - Recursion & Aggregation", () => {
    const year = 2025;

    // Simular un KPI base con datos
    const baseKPI: DashboardItem = {
        id: "kpi-1",
        indicator: "Ventas",
        indicatorType: "manual",
        monthlyProgress: [100, 200, 300, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        monthlyGoals: [100, 100, 100, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        weight: 10
    } as any;

    // Simular una fórmula que depende del KPI base
    const formulaKPI: DashboardItem = {
        id: "formula-1",
        indicator: "Doble Ventas",
        indicatorType: "formula",
        formula: "{id:kpi-1} * 2",
        weight: 5
    } as any;

    // Simular una fórmula recursiva que depende de la primera fórmula
    const recursiveKPI: DashboardItem = {
        id: "recursive-1",
        indicator: "Cuádruple Ventas",
        indicatorType: "formula",
        formula: "{id:formula-1} * 2",
        weight: 1
    } as any;

    const allItems = [baseKPI, formulaKPI, recursiveKPI];

    test("resolveItemValues should handle deep recursion (v6.2.4-Fix4)", () => {
        const resolved = resolveItemValues(recursiveKPI, allItems, year);
        // Ventas Ene (100) -> Doble (200) -> Cuádruple (400)
        expect(resolved.monthlyProgress[0]).toBe(400);
        // Ventas Feb (200) -> Doble (400) -> Cuádruple (800)
        expect(resolved.monthlyProgress[1]).toBe(800);
    });

    test("calculateDashboardMonthlyScores should use resolved values (BUG Fix5)", () => {
        // En un tablero de "SÍNTESIS", queremos el score mensual de todos los KPIs
        const scores = calculateDashboardMonthlyScores(allItems, { onTrack: 95, atRisk: 80 }, year, 2, allItems);

        // KPI-1: 200/100 = 200%
        // F-1: 400/200 = 200%
        // R-1: 800/400 = 200%
        // Promedio ponderado debería ser 200%
        expect(scores[1]).toBe(200);
    });
});

describe("calculateOperationalMetrics - Modelo Operativo Semáforo KPI (v18.0.0-OPERATIONAL-METRICS)", () => {
    const globalThresholds = { onTrack: 95, atRisk: 80 };

    test("Caso 1: 4 meses vencidos, 2 capturados (90 y 84) -> performance = 87%, capture = 50%, real = 43.5%", () => {
        const item: DashboardItem = {
            id: "kpi-test-1",
            indicator: "Desempeño Operativo",
            monthlyProgress: [90, 84, null, null, 0, 0, 0, 0, 0, 0, 0, 0],
            monthlyGoals: [100, 100, 100, 100, 0, 0, 0, 0, 0, 0, 0, 0],
            weight: 10,
            goalType: "maximize",
            type: "average"
        } as any;

        const mockDate = new Date("2026-05-22T11:00:00Z");
        const OriginalDate = global.Date;
        const spy = jest.spyOn(global, "Date").mockImplementation((...args) => {
            if (args.length > 0) return new (OriginalDate as any)(...args);
            return mockDate;
        });

        const metrics = calculateOperationalMetrics(item, globalThresholds, 2026, "definitive");

        expect(metrics.expectedPeriods).toBe(4);
        expect(metrics.capturedPeriods).toBe(2);
        expect(metrics.missingPeriods).toBe(2);
        expect(metrics.captureRate).toBe(50);
        expect(metrics.performanceScore).toBe(87);
        expect(metrics.realOperationalScore).toBe(43.5);

        spy.mockRestore();
    });

    test("Caso 2: Todos los meses esperados capturados -> realOperationalScore = performanceScore", () => {
        const item: DashboardItem = {
            id: "kpi-test-2",
            indicator: "Desempeño Completo",
            monthlyProgress: [90, 84, 95, 100, 0, 0, 0, 0, 0, 0, 0, 0],
            monthlyGoals: [100, 100, 100, 100, 0, 0, 0, 0, 0, 0, 0, 0],
            weight: 10,
            goalType: "maximize",
            type: "average"
        } as any;

        const mockDate = new Date("2026-05-22T11:00:00Z");
        const OriginalDate = global.Date;
        const spy = jest.spyOn(global, "Date").mockImplementation((...args) => {
            if (args.length > 0) return new (OriginalDate as any)(...args);
            return mockDate;
        });

        const metrics = calculateOperationalMetrics(item, globalThresholds, 2026, "definitive");

        expect(metrics.expectedPeriods).toBe(4);
        expect(metrics.capturedPeriods).toBe(4);
        expect(metrics.captureRate).toBe(100);
        expect(metrics.realOperationalScore).toBe(metrics.performanceScore);

        spy.mockRestore();
    });

    test("Caso 3: Sin meses vencidos (año futuro o inicio en mes actual en realTime sin datos) -> No penalizar", () => {
        const item: DashboardItem = {
            id: "kpi-test-3",
            indicator: "Futuro",
            monthlyProgress: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            monthlyGoals: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            weight: 10,
            goalType: "maximize",
            type: "average"
        } as any;

        const metrics = calculateOperationalMetrics(item, globalThresholds, 2027, "definitive");

        expect(metrics.expectedPeriods).toBe(0);
        expect(metrics.captureRate).toBe(100);
        expect(metrics.realOperationalScore).toBe(metrics.performanceScore);
    });

    test("Caso 4: operationalStartPeriod = MAY -> Abril no cuenta como faltante", () => {
        const item: DashboardItem = {
            id: "kpi-test-4",
            indicator: "Inicio Tardío",
            operationalStartPeriod: "MAY",
            monthlyProgress: [0, 0, 0, 0, 90, 80, 0, 0, 0, 0, 0, 0],
            monthlyGoals: [100, 100, 100, 100, 100, 100, 0, 0, 0, 0, 0, 0],
            weight: 10,
            goalType: "maximize",
            type: "average"
        } as any;

        const mockDate = new Date("2026-07-15T11:00:00Z");
        const OriginalDate = global.Date;
        const spy = jest.spyOn(global, "Date").mockImplementation((...args) => {
            if (args.length > 0) return new (OriginalDate as any)(...args);
            return mockDate;
        });

        const metrics = calculateOperationalMetrics(item, globalThresholds, 2026, "definitive");

        expect(metrics.expectedPeriods).toBe(2);
        expect(metrics.capturedPeriods).toBe(2);
        expect(metrics.missingPeriods).toBe(0);
        expect(metrics.captureRate).toBe(100);
        expect(metrics.realOperationalScore).toBe(85);

        spy.mockRestore();
    });

    test("attachOperationalMetrics should successfully encapsulate metrics in the operationalMetrics field", () => {
        const item: DashboardItem = {
            id: "kpi-test-5",
            indicator: "Encapsulado",
            monthlyProgress: [90, 84, null, null, 0, 0, 0, 0, 0, 0, 0, 0],
            monthlyGoals: [100, 100, 100, 100, 0, 0, 0, 0, 0, 0, 0, 0],
            weight: 10,
            goalType: "maximize",
            type: "average"
        } as any;

        const mockDate = new Date("2026-05-22T11:00:00Z");
        const OriginalDate = global.Date;
        const spy = jest.spyOn(global, "Date").mockImplementation((...args) => {
            if (args.length > 0) return new (OriginalDate as any)(...args);
            return mockDate;
        });

        const attached = attachOperationalMetrics(item, globalThresholds, 2026, "definitive");

        expect(attached.operationalMetrics).toBeDefined();
        expect(attached.operationalMetrics?.performanceScore).toBe(87);
        expect(attached.operationalMetrics?.captureRate).toBe(50);
        expect(attached.operationalMetrics?.realOperationalScore).toBe(43.5);

        spy.mockRestore();
    });
});

