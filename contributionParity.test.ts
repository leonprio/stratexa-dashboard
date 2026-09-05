import {
  classifyStrategicContributionKpis,
  resolveStrategicKpiOwnership,
  resolveStrategicKpiContributionPath,
} from "./strategyKpiOwnership";

const dashboard: any = {
  id: "operational",
  title: "Operaciones",
  area: "OPERACIONES",
  items: [
    { id: "direct", indicator: "Costo de Flete", semanticKey: "freight-cost" },
    { id: "via", indicator: "Margen", semanticKey: "margin" },
    { id: "empty", indicator: "KPI sin asignación", semanticKey: "empty" },
  ],
};
const summary: any = {
  ...dashboard,
  id: "summary",
  title: "Resumen",
  isAggregate: true,
  items: dashboard.items.map((item: any) => ({
    ...item,
    id: `${item.id}-summary`,
  })),
};
const objectives: any[] = [
  { id: "oe1", code: "OE01", title: "Resultados", perspectiveId: "p1" },
];
const contributions: any[] = [
  {
    id: "oc1",
    title: "Contribución comercial",
    areaName: "COMERCIAL",
    primaryStrategicObjectiveId: "oe1",
  },
  {
    id: "oc-empty",
    title: "OC sin KPI",
    areaName: "OPERACIONES",
    primaryStrategicObjectiveId: "oe1",
  },
];

function resolve(assignments: any[]) {
  const ownership = resolveStrategicKpiOwnership(
    [dashboard, summary],
    objectives,
    contributions,
    assignments,
  );
  return classifyStrategicContributionKpis(
    ownership,
    contributions,
    assignments,
  );
}

describe("strategic contribution parity classification", () => {
  it("classifies direct and contribution assignments from their real ownership", () => {
    const result = resolve([
      {
        strategicObjectiveId: "oe1",
        dashboardId: "summary",
        itemId: "direct-summary",
      },
      {
        contributionObjectiveId: "oc1",
        dashboardId: "operational",
        itemId: "via",
      },
    ]);
    expect(
      result.directKpisByStrategicObjective
        .get("oe1")
        ?.map((kpi) => kpi.identity),
    ).toEqual(["semantic:freight-cost"]);
    expect(
      result.contributionKpisByContributionObjective
        .get("oc1")
        ?.map((kpi) => kpi.identity),
    ).toEqual(["semantic:margin"]);
  });

  it("never renders one logical KPI in both categories, including aliases", () => {
    const result = resolve([
      {
        strategicObjectiveId: "oe1",
        dashboardId: "summary",
        itemId: "via-summary",
      },
      {
        contributionObjectiveId: "oc1",
        dashboardId: "operational",
        itemId: "via",
      },
    ]);
    expect(result.directKpisByStrategicObjective.get("oe1") || []).toEqual([]);
    expect(
      result.contributionKpisByContributionObjective
        .get("oc1")
        ?.map((kpi) => kpi.identity),
    ).toEqual(["semantic:margin"]);
  });

  it("preserves an OC with no KPI and does not invent an OC for direct KPI", () => {
    const result = resolve([
      {
        strategicObjectiveId: "oe1",
        dashboardId: "operational",
        itemId: "direct",
      },
    ]);
    expect(
      result.directKpisByStrategicObjective
        .get("oe1")
        ?.map((kpi) => kpi.identity),
    ).toEqual(["semantic:freight-cost"]);
    expect(result.contributionKpisByContributionObjective.has("oc-empty")).toBe(
      false,
    );
    expect(result.contributionKpisByContributionObjective.has("oc1")).toBe(
      false,
    );
  });

  it("matches map KPI set with direct union contribution KPI sets", () => {
    const assignments: any[] = [
      {
        strategicObjectiveId: "oe1",
        dashboardId: "summary",
        itemId: "direct-summary",
      },
      {
        contributionObjectiveId: "oc1",
        dashboardId: "operational",
        itemId: "via",
      },
    ];
    const ownership = resolveStrategicKpiOwnership(
      [dashboard, summary],
      objectives,
      contributions,
      assignments,
    );
    const result = classifyStrategicContributionKpis(
      ownership,
      contributions,
      assignments,
    );
    const mapSet = new Set(
      (ownership.kpisByStrategicObjective.get("oe1") || []).map(
        (kpi) => kpi.identity,
      ),
    );
    const contributionSet = new Set(
      [
        ...(result.directKpisByStrategicObjective.get("oe1") || []),
        ...(result.contributionKpisByContributionObjective.get("oc1") || []),
      ].map((kpi) => kpi.identity),
    );
    expect(contributionSet).toEqual(mapSet);
  });

  it("does not infer direct KPIs when all persisted assignments are via OC", () => {
    const result = resolve([
      {
        contributionObjectiveId: "oc1",
        dashboardId: "operational",
        itemId: "direct",
      },
      {
        contributionObjectiveId: "oc1",
        dashboardId: "operational",
        itemId: "via",
      },
    ]);
    expect(result.directKpisByStrategicObjective.size).toBe(0);
    expect(
      result.contributionKpisByContributionObjective
        .get("oc1")
        ?.map((kpi) => kpi.identity),
    ).toEqual(["semantic:freight-cost", "semantic:margin"]);
  });

  it("classifies assignments with an OC as VIA_OC even if a legacy OE field remains", () => {
    const assignments = [
      {
        strategicObjectiveId: "oe1",
        contributionObjectiveId: "oc1",
        dashboardId: "operational",
        itemId: "via",
      },
    ];
    const ownership = resolveStrategicKpiOwnership(
      [dashboard, summary],
      objectives,
      contributions,
      assignments,
    );
    const paths = resolveStrategicKpiContributionPath(ownership, contributions);
    expect(
      paths.find((path) => path.logicalKpi.identity === "semantic:margin")
        ?.path,
    ).toBe("VIA_OC");
    expect(
      classifyStrategicContributionKpis(ownership, contributions, assignments)
        .directKpisByStrategicObjective.size,
    ).toBe(0);
  });

  it("locks the CEMENTOS SIGMA 2026 fixture to one canonical membership set", () => {
    const sigma: any = {
      id: "sigma-comv",
      title: "COMV",
      area: "COMERCIAL Y VENTAS",
      items: [
        "Ventas",
        "Margen de Contribución Neto",
        "Tasa de Retención de Clientes",
        "Cumplimiento de Entregas",
        "Costo de Flete por Tonelada",
        "Índice de Mermas en Tránsito",
        "Rotación de Inventario",
        "Exactitud de Inventario",
        "Días sin Accidentes Incidentes",
      ].map((indicator, index) => ({ id: `kpi-${index + 1}`, indicator, semanticKey: `sigma-${index + 1}` })),
    };
    const sigmaObjectives: any[] = [
      { id: "OE01" }, { id: "OE02" }, { id: "OE03" }, { id: "OE04" }, { id: "OE05" },
    ];
    const sigmaOCs: any[] = [
      { id: "OCCOMV01", primaryStrategicObjectiveId: "OE01" },
      { id: "OCOPAL01", primaryStrategicObjectiveId: "OE04" },
    ];
    const directOwners = ["OE01", undefined, "OE02", "OE02", "OE03", "OE03", undefined, "OE04", "OE05"];
    const assignments: any[] = sigma.items.map((item: any, index: number) =>
      index === 1
        ? { contributionObjectiveId: "OCCOMV01", dashboardId: sigma.id, itemId: item.id }
        : index === 6
          ? { contributionObjectiveId: "OCOPAL01", dashboardId: sigma.id, itemId: item.id }
          : { strategicObjectiveId: directOwners[index], dashboardId: sigma.id, itemId: item.id },
    );
    const ownership = resolveStrategicKpiOwnership([sigma], sigmaObjectives, sigmaOCs, assignments);
    const result = classifyStrategicContributionKpis(ownership, sigmaOCs, assignments);
    expect(result.directKpisByStrategicObjective.get("OE01")?.map((k) => k.item.indicator)).toEqual(["Ventas"]);
    expect(result.directKpisByStrategicObjective.get("OE02")?.map((k) => k.item.indicator)).toEqual(["Tasa de Retención de Clientes", "Cumplimiento de Entregas"]);
    expect(result.directKpisByStrategicObjective.get("OE03")?.map((k) => k.item.indicator)).toEqual(["Costo de Flete por Tonelada", "Índice de Mermas en Tránsito"]);
    expect(result.directKpisByStrategicObjective.get("OE04")?.map((k) => k.item.indicator)).toEqual(["Exactitud de Inventario"]);
    expect(result.directKpisByStrategicObjective.get("OE05")?.map((k) => k.item.indicator)).toEqual(["Días sin Accidentes Incidentes"]);
    expect(result.contributionKpisByContributionObjective.get("OCCOMV01")?.map((k) => k.item.indicator)).toEqual(["Margen de Contribución Neto"]);
    expect(result.contributionKpisByContributionObjective.get("OCOPAL01")?.map((k) => k.item.indicator)).toEqual(["Rotación de Inventario"]);
    const rendered = [...result.directKpisByStrategicObjective.values(), ...result.contributionKpisByContributionObjective.values()].flat().map((k) => k.identity);
    expect(new Set(rendered).size).toBe(9);
    expect(rendered).toHaveLength(9);
  });
});
