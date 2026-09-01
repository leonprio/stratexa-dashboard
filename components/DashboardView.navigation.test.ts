import { findDashboardItemById } from "../dashboardItemNavigation";

describe("Objectives exact KPI navigation", () => {
  const items = [
    { id: 101, indicator: "PROSPECTOS CONTACTADOS" },
    { id: "income-1", indicator: "INGRESOS" },
  ] as any;

  test("opens the exact target even when its runtime id type differs", () => {
    expect(findDashboardItemById(items, "101")?.indicator).toBe("PROSPECTOS CONTACTADOS");
    expect(findDashboardItemById(items, "income-1")?.indicator).toBe("INGRESOS");
  });

  test("does not silently select a different KPI when target is missing", () => {
    expect(findDashboardItemById(items, "missing")).toBeNull();
  });
});
