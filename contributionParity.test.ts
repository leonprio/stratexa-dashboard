import { classifyStrategicContributionKpis, resolveStrategicKpiOwnership } from './strategyKpiOwnership';

const dashboard: any = {
  id: 'operational',
  title: 'Operaciones',
  area: 'OPERACIONES',
  items: [
    { id: 'direct', indicator: 'Costo de Flete', semanticKey: 'freight-cost' },
    { id: 'via', indicator: 'Margen', semanticKey: 'margin' },
    { id: 'empty', indicator: 'KPI sin asignación', semanticKey: 'empty' },
  ],
};
const summary: any = {
  ...dashboard,
  id: 'summary',
  title: 'Resumen',
  isAggregate: true,
  items: dashboard.items.map((item: any) => ({ ...item, id: `${item.id}-summary` })),
};
const objectives: any[] = [{ id: 'oe1', code: 'OE01', title: 'Resultados', perspectiveId: 'p1' }];
const contributions: any[] = [
  { id: 'oc1', title: 'Contribución comercial', areaName: 'COMERCIAL', primaryStrategicObjectiveId: 'oe1' },
  { id: 'oc-empty', title: 'OC sin KPI', areaName: 'OPERACIONES', primaryStrategicObjectiveId: 'oe1' },
];

function resolve(assignments: any[]) {
  const ownership = resolveStrategicKpiOwnership([dashboard, summary], objectives, contributions, assignments);
  return classifyStrategicContributionKpis(ownership, contributions, assignments);
}

describe('strategic contribution parity classification', () => {
  it('classifies direct and contribution assignments from their real ownership', () => {
    const result = resolve([
      { strategicObjectiveId: 'oe1', dashboardId: 'summary', itemId: 'direct-summary' },
      { contributionObjectiveId: 'oc1', dashboardId: 'operational', itemId: 'via' },
    ]);
    expect(result.directKpisByStrategicObjective.get('oe1')?.map(kpi => kpi.identity)).toEqual(['semantic:freight-cost']);
    expect(result.contributionKpisByContributionObjective.get('oc1')?.map(kpi => kpi.identity)).toEqual(['semantic:margin']);
  });

  it('never renders one logical KPI in both categories, including aliases', () => {
    const result = resolve([
      { strategicObjectiveId: 'oe1', dashboardId: 'summary', itemId: 'via-summary' },
      { contributionObjectiveId: 'oc1', dashboardId: 'operational', itemId: 'via' },
    ]);
    expect(result.directKpisByStrategicObjective.get('oe1')?.map(kpi => kpi.identity)).toEqual(['semantic:margin']);
    expect(result.contributionKpisByContributionObjective.get('oc1')).toEqual([]);
  });

  it('preserves an OC with no KPI and does not invent an OC for direct KPI', () => {
    const result = resolve([{ strategicObjectiveId: 'oe1', dashboardId: 'operational', itemId: 'direct' }]);
    expect(result.directKpisByStrategicObjective.get('oe1')?.map(kpi => kpi.identity)).toEqual(['semantic:freight-cost']);
    expect(result.contributionKpisByContributionObjective.has('oc-empty')).toBe(false);
    expect(result.contributionKpisByContributionObjective.has('oc1')).toBe(false);
  });

  it('matches map KPI set with direct union contribution KPI sets', () => {
    const assignments: any[] = [
      { strategicObjectiveId: 'oe1', dashboardId: 'summary', itemId: 'direct-summary' },
      { contributionObjectiveId: 'oc1', dashboardId: 'operational', itemId: 'via' },
    ];
    const ownership = resolveStrategicKpiOwnership([dashboard, summary], objectives, contributions, assignments);
    const result = classifyStrategicContributionKpis(ownership, contributions, assignments);
    const mapSet = new Set((ownership.kpisByStrategicObjective.get('oe1') || []).map(kpi => kpi.identity));
    const contributionSet = new Set([
      ...(result.directKpisByStrategicObjective.get('oe1') || []),
      ...(result.contributionKpisByContributionObjective.get('oc1') || []),
    ].map(kpi => kpi.identity));
    expect(contributionSet).toEqual(mapSet);
  });
});
