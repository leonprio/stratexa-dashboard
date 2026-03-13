import { calculateDashboardMonthlyScores, resolveItemValues } from "./compliance";
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
