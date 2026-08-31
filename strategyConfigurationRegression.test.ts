import { buildLogicalKpiCatalog, normalizeLogicalKpiLabel, resolveStrategicKpiOwnership } from './strategyKpiOwnership';

const item = (id: string, indicator: string) => ({ id, indicator, weight: 100, monthlyGoals: [1], monthlyProgress: [1], unit: 'u', type: 'accumulative', goalType: 'maximize' });
const dashboard = (id: string, title: string, items: any[]) => ({ id, title, items }) as any;

describe('strategic configuration regression contracts', () => {
  const dashboards = [
    dashboard('op', 'Operativo', [item('income', 'INGRESOS'), item('free', 'KPI LIBRE')]),
    dashboard('summary', 'Resumen Directivo', [item('income-copy', 'INGRESOS'), item('prospects-copy', 'PROSPECTOS CONTACTADOS')]),
    dashboard('synthesis', 'Síntesis Global', [item('income-synthesis', 'INGRESOS'), item('prospects-synthesis', 'PROSPECTOS CONTACTADOS')])
  ];
  const objectives = ['OE01', 'OE02', 'OE03', 'OE04'].map(id => ({ id } as any));
  const contributions = [{ id: 'oc02', primaryStrategicObjectiveId: 'OE02', areaName: 'Operaciones' } as any];

  it('keeps aliases unique and chooses the operational representative', () => {
    const catalog = buildLogicalKpiCatalog(dashboards);
    expect(catalog.map(kpi => kpi.item.indicator)).toEqual(['INGRESOS', 'KPI LIBRE', 'PROSPECTOS CONTACTADOS']);
    expect(catalog[0].physicalAliases).toHaveLength(3);
    expect(catalog[0].dashboard.id).toBe('op');
    expect(normalizeLogicalKpiLabel('  Prospectos   contactados ')).toBe('PROSPECTOS CONTACTADOS');
  });

  it('uses one ownership source for direct, contribution, free and multi-OE conflict cases', () => {
    const assignments = [
      { id: 'a1', strategicObjectiveId: 'OE01', dashboardId: 'summary', itemId: 'income-copy' },
      { id: 'a2', contributionObjectiveId: 'oc02', dashboardId: 'summary', itemId: 'prospects-copy' },
      { id: 'a3', strategicObjectiveId: 'OE03', dashboardId: 'synthesis', itemId: 'prospects-synthesis' }
    ] as any;
    const result = resolveStrategicKpiOwnership(dashboards, objectives, contributions, assignments);
    expect(result.canonicalKpis).toHaveLength(3);
    expect(result.kpisByStrategicObjective.get('OE01')?.map(k => k.item.indicator)).toEqual(['INGRESOS']);
    expect(result.kpisByStrategicObjective.get('OE02')?.map(k => k.item.indicator)).toEqual(['PROSPECTOS CONTACTADOS']);
    expect(result.logicalKpiConflicts.get('label:PROSPECTOS CONTACTADOS')).toEqual(new Set(['OE02', 'OE03']));
    expect(result.orphanKpis.map(k => k.item.indicator)).toEqual(['KPI LIBRE']);
  });

  it('preserves the map/selector partition: aligned is occupied and free is absent from map', () => {
    const result = resolveStrategicKpiOwnership(dashboards, objectives, [], [{ strategicObjectiveId: 'OE04', dashboardId: 'op', itemId: 'free' }] as any);
    const mapped = Array.from(result.kpisByStrategicObjective.values()).flat().map(k => k.identity);
    const available = result.orphanKpis.map(k => k.identity);
    expect(mapped).toContain('label:KPI LIBRE');
    expect(available).toContain('label:INGRESOS');
    expect(new Set(mapped).size).toBe(mapped.length);
    expect(new Set(available).size).toBe(available.length);
  });
});
