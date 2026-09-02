import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { resolveStrategicKpiOwnership } from "../strategyKpiOwnership";
import { ObjectivesView } from "./ObjectivesView";

const dashboard: any = {
  id: "d1",
  title: "Operaciones",
  thresholds: { onTrack: 90, atRisk: 70 },
  items: [
    {
      id: "k1",
      indicator: "KPI asociado",
      weight: 1,
      monthlyGoals: [100],
      monthlyProgress: [81],
      unit: "%",
      type: "average",
      goalType: "maximize",
    },
    {
      id: "k2",
      indicator: "KPI sin objetivo",
      weight: 1,
      monthlyGoals: [100],
      monthlyProgress: [84],
      unit: "%",
      type: "average",
      goalType: "maximize",
    },
  ],
};
const objective: any = {
  id: "oe1",
  title: "Fortalecer resultados",
  code: "OE-01",
  perspectiveId: "FIN",
  clientId: "IPS",
  order: 1,
};
const contribution: any = {
  id: "oc1",
  title: "Contribución",
  primaryStrategicObjectiveId: "oe1",
  status: "active",
};

describe("ObjectivesView", () => {
  it("muestra KPIs asociados y separa los no vinculados", () => {
    const onNavigateToKpi = jest.fn();
    render(
      <ObjectivesView
        dashboard={dashboard}
        objectives={[objective]}
        perspectives={[{ id: "FIN", name: "Financiera", order: 1 } as any]}
        contributions={[contribution]}
        assignments={[
          {
            id: "a1",
            contributionObjectiveId: "oc1",
            dashboardId: "d1",
            itemId: "k1",
          } as any,
        ]}
        year={2026}
        onNavigateToKpi={onNavigateToKpi}
      />,
    );
    expect(screen.getByText("Fortalecer resultados")).toBeInTheDocument();
    expect(screen.getByText("KPI asociado")).toBeInTheDocument();
    expect(screen.getByText(/81% · REQUIERE ATENCIÓN/)).toBeInTheDocument();
    expect(screen.getByText(/Sin tendencia/)).toBeInTheDocument();
    expect(screen.getByText(/KPIs SIN OBJETIVO ASOCIADO/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /KPI asociado/ }));
    expect(onNavigateToKpi).toHaveBeenCalledWith("d1", "k1");
  });

  it("muestra explícitamente objetivos sin indicadores", () => {
    render(
      <ObjectivesView
        dashboard={{ ...dashboard, items: [] }}
        objectives={[objective]}
        perspectives={[]}
        contributions={[]}
        assignments={[]}
        year={2026}
      />,
    );
    expect(screen.getByText("SIN INDICADORES ASOCIADOS")).toBeInTheDocument();
    expect(screen.getByText("SIN INDICADORES")).toBeInTheDocument();
  });

  it("mantiene la tendencia textual sin renderizar sparklines permanentes", () => {
    const historyDashboard = {
      ...dashboard,
      items: [
        {
          ...dashboard.items[0],
          monthlyProgress: [70, 80, 84],
          monthlyGoals: [100, 100, 100],
        },
      ],
    };
    render(
      <ObjectivesView
        dashboard={historyDashboard}
        objectives={[objective]}
        perspectives={[]}
        contributions={[]}
        assignments={[
          {
            strategicObjectiveId: "oe1",
            dashboardId: "d1",
            itemId: "k1",
          } as any,
        ]}
        year={2026}
      />,
    );
    expect(screen.getByText(/78% · REQUIERE ATENCIÓN/)).toBeInTheDocument();
    expect(screen.getByText(/↑ Mejora/)).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /periodos evaluables/ })).not.toBeInTheDocument();
  });

  it("expande y contrae la tendencia bajo demanda", () => {
    const historyDashboard = { ...dashboard, items: [{ ...dashboard.items[0], monthlyProgress: [70, 80, 84], monthlyGoals: [100, 100, 100] }] };
    render(<ObjectivesView dashboard={historyDashboard} objectives={[objective]} perspectives={[]} contributions={[]} assignments={[{ strategicObjectiveId: "oe1", dashboardId: "d1", itemId: "k1" } as any]} year={2026} />);
    const toggle = screen.getByRole("button", { name: "TENDENCIA" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    const chart = screen.getByRole("img", { name: /Gráfico histórico de KPI asociado/ });
    expect(chart).toBeInTheDocument();
    expect(chart.querySelector("polyline")).toHaveAttribute("stroke-dasharray", "4 5");
    expect(chart.querySelector("circle:last-of-type")).toHaveAttribute("fill", "#fbbf24");
    expect(screen.getByText("Actual")).toBeInTheDocument();
    expect(screen.getByText("78%", { exact: true })).toBeInTheDocument();
    fireEvent.click(toggle);
    expect(screen.queryByRole("img", { name: /Gráfico histórico de KPI asociado/ })).not.toBeInTheDocument();
  });

  it("muestra diagnóstico ejecutivo, ejecución y decisión deterministas", () => {
    render(
      <ObjectivesView
        dashboard={dashboard}
        objectives={[objective]}
        perspectives={[]}
        contributions={[]}
        assignments={[{ strategicObjectiveId: "oe1", dashboardId: "d1", itemId: "k1" } as any]}
        year={2026}
      />,
    );
    expect(screen.getByText("Diagnóstico ejecutivo")).toBeInTheDocument();
    expect(screen.getByText(/principal brecha está en KPI asociado/)).toBeInTheDocument();
    expect(screen.getByText("Ejecución")).toBeInTheDocument();
    expect(screen.getByText("SIN PLAN ACTIVO PARA ESTA DESVIACIÓN")).toBeInTheDocument();
    expect(screen.queryByText("PRÓXIMA DECISIÓN", { exact: true })).not.toBeInTheDocument();
  });

  it("matches map logical ownership across aliases and supports map order reversal", () => {
    const secondary: any = {
      ...dashboard,
      id: "summary",
      title: "Resumen",
      items: [
        { ...dashboard.items[0], id: "income-summary", indicator: "INGRESOS" },
        {
          ...dashboard.items[0],
          id: "apps-summary",
          indicator: "APLICACIONES DESARROLLADAS",
        },
        {
          ...dashboard.items[0],
          id: "activities-summary",
          indicator: "ACTIVIDADES ESTRATÉGICAS",
        },
      ],
    };
    const primary: any = {
      ...dashboard,
      id: "operational",
      items: [
        { ...dashboard.items[0], id: "income", indicator: "INGRESOS" },
        {
          ...dashboard.items[0],
          id: "apps",
          indicator: "APLICACIONES DESARROLLADAS",
        },
        {
          ...dashboard.items[0],
          id: "activities",
          indicator: "ACTIVIDADES ESTRATÉGICAS",
        },
      ],
    };
    const objectives: any[] = [
      {
        ...objective,
        id: "OE01",
        code: "OE01",
        title: "OE01",
        order: 1,
        perspectiveId: "P1",
      },
      {
        ...objective,
        id: "OE03",
        code: "OE03",
        title: "OE03",
        order: 1,
        perspectiveId: "P3",
      },
      {
        ...objective,
        id: "OE04",
        code: "OE04",
        title: "OE04",
        order: 1,
        perspectiveId: "P4",
      },
    ];
    const assignments: any[] = [
      {
        strategicObjectiveId: "OE01",
        dashboardId: "summary",
        itemId: "income-summary",
      },
      {
        strategicObjectiveId: "OE03",
        dashboardId: "summary",
        itemId: "apps-summary",
      },
      {
        strategicObjectiveId: "OE04",
        dashboardId: "operational",
        itemId: "activities",
      },
    ];
    const ownership = resolveStrategicKpiOwnership(
      [primary, secondary],
      objectives,
      [],
      assignments,
    );
    expect(
      ownership.kpisByStrategicObjective
        .get("OE03")
        ?.map((k) => k.item.indicator),
    ).toEqual(["APLICACIONES DESARROLLADAS"]);
    render(
      <ObjectivesView
        dashboard={primary}
        dashboards={[secondary]}
        objectives={objectives}
        perspectives={
          [
            { id: "P1", name: "P1", order: 1 },
            { id: "P3", name: "P3", order: 3 },
            { id: "P4", name: "P4", order: 4 },
          ] as any
        }
        contributions={[]}
        assignments={assignments}
        year={2026}
      />,
    );
    expect(screen.getByText("APLICACIONES DESARROLLADAS")).toBeInTheDocument();
    expect(screen.getByText("ACTIVIDADES ESTRATÉGICAS")).toBeInTheDocument();
    const headings = screen.getAllByRole("heading", { level: 3 });
    expect(headings.map((node) => node.textContent)).toEqual([
      "OE01",
      "OE03",
      "OE04",
    ]);
    fireEvent.click(screen.getByRole("button", { name: /ORDEN DEL MAPA/i }));
    expect(
      screen
        .getAllByRole("heading", { level: 3 })
        .map((node) => node.textContent),
    ).toEqual(["OE04", "OE03", "OE01"]);
  });

  it("expone KPI directos y KPI vía OC sin mezclarlos", () => {
    const viewDashboard: any = {
      ...dashboard,
      area: "OPERACIONES",
      items: [
        { ...dashboard.items[0], id: "direct", indicator: "Costo directo", semanticKey: "direct-kpi" },
        { ...dashboard.items[1], id: "via", indicator: "KPI vía OC", semanticKey: "via-kpi" },
      ],
    };
    render(<ObjectivesView dashboard={viewDashboard} objectives={[objective]} perspectives={[]} contributions={[{ ...contribution, areaName: "OPERACIONES" }, { id: "oc-empty", title: "OC vacío", areaName: "OPERACIONES", primaryStrategicObjectiveId: "oe1" } as any]} assignments={[{ strategicObjectiveId: "oe1", dashboardId: "d1", itemId: "direct" } as any, { contributionObjectiveId: "oc1", dashboardId: "d1", itemId: "via" } as any]} year={2026} />);
    fireEvent.click(screen.getByRole("tab", { name: "CONTRIBUCIÓN" }));
    expect(screen.getByText("Indicadores directos")).toBeInTheDocument();
    expect(screen.getByText("Costo directo")).toBeInTheDocument();
    expect(screen.getByText("KPI vía OC")).toBeInTheDocument();
    expect(screen.getByText("OC vacío")).toBeInTheDocument();
    expect(screen.getByText("SIN INDICADORES")).toBeInTheDocument();
    expect(screen.getByText("Lectura de indicadores directos y contribuciones por área.")).toBeInTheDocument();
  });
});
