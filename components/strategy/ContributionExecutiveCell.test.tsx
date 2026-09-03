import React from "react";
import { render, screen } from "@testing-library/react";
import { ContributionExecutiveCell } from "./ContributionExecutiveCell";

const kpi = { identity: "d-i", item: { id: "i", indicator: "Ventas" } as any, dashboard: { id: "d" } as any, score: 92, status: "BAJO CONTROL" };

describe("ContributionExecutiveCell", () => {
  it("renders no-contribution content", () => { render(<ContributionExecutiveCell code="OC01" title="Sin vínculo" kpis={[]} status="NO EVALUABLE" />); expect(screen.getByText("SIN INDICADORES")).toBeInTheDocument(); });
  it("renders logical KPI status and deduplicated input", () => { render(<ContributionExecutiveCell code="OC01" title="Impulsar ventas" kpis={[kpi]} status="BAJO CONTROL" />); expect(screen.getByText("Ventas")).toBeInTheDocument(); expect(screen.getByText(/92% · BAJO CONTROL/)).toBeInTheDocument(); });
  it("opens the exact KPI from the cell", () => { const navigate = jest.fn(); render(<ContributionExecutiveCell code="OC01" title="Impulsar ventas" kpis={[kpi]} status="BAJO CONTROL" onNavigateToKpi={navigate} />); screen.getByRole("button", { name: "VER KPI" }).click(); expect(navigate).toHaveBeenCalledWith("d", "i"); });
});
