import { buildLogicalKpiCatalog, resolveStrategicKpiOwnership } from './strategyKpiOwnership';

const item = (id: string, indicator: string, semanticKey?: string) => ({ id, indicator, semanticKey, weight: 100, monthlyGoals: [1], monthlyProgress: [1], unit: 'u', type: 'accumulative', goalType: 'maximize' });

describe('strategic KPI physical and canonical availability', () => {
  it('groups physical dashboard representations into one logical KPI with aliases', () => {
    const dashboards = ['Operativo', 'Resumen Directivo', 'Síntesis Global'].map((title, i) => ({ id: `d${i}`, title, items: [item(`income-${i}`, 'INGRESOS')] })) as any;
    const catalog = buildLogicalKpiCatalog(dashboards);
    expect(catalog).toHaveLength(1);
    expect(catalog[0].physicalAliases).toHaveLength(3);
    expect(catalog[0].item.indicator).toBe('INGRESOS');
  });

  it('marks the assigned physical KPI as occupied', () => {
    const dashboard = { id: 'd1', title: 'Operativo', items: [item('income', 'INGRESOS')] } as any;
    const result = resolveStrategicKpiOwnership([dashboard], [{ id: 'oe1' } as any], [], [{ id: 'a1', strategicObjectiveId: 'oe1', dashboardId: 'd1', itemId: 'income', clientId: 'LEÓN' }]);
    expect(result.occupiedPhysicalKpiKeys.has('d1:income')).toBe(true);
    expect(result.orphanKpis).toHaveLength(0);
  });

  it('excludes a derived copy sharing canonical identity', () => {
    const dashboards = [
      { id: 'd1', title: 'Operativo', items: [item('income', 'INGRESOS', 'income')] },
      { id: 'summary', title: 'Resumen Directivo', items: [item('income-copy', 'INGRESOS', 'income')] }
    ] as any;
    const result = resolveStrategicKpiOwnership(dashboards, [{ id: 'oe1' } as any], [], [{ id: 'a1', strategicObjectiveId: 'oe1', dashboardId: 'd1', itemId: 'income', clientId: 'LEÓN' }]);
    expect(result.canonicalKpis).toHaveLength(1);
    expect(result.occupiedCanonicalKpiIdentities.has('semantic:income')).toBe(true);
    expect(result.orphanKpis).toHaveLength(0);
  });

  it('occupies every logical alias when one physical alias is assigned', () => {
    const dashboards = [
      { id: 'd1', title: 'Operativo', items: [item('income', 'INGRESOS')] },
      { id: 'summary', title: 'Resumen Directivo', items: [item('income-copy', 'INGRESOS')] }
    ] as any;
    const result = resolveStrategicKpiOwnership(dashboards, [{ id: 'oe1' } as any], [], [{ id: 'a1', strategicObjectiveId: 'oe1', dashboardId: 'summary', itemId: 'income-copy', clientId: 'LEÓN' }]);
    expect(result.canonicalKpis).toHaveLength(1);
    expect(result.kpisByStrategicObjective.get('oe1')).toHaveLength(1);
    expect(result.orphanKpis).toHaveLength(0);
  });
});
