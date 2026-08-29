import { Dashboard, DashboardItem, ComplianceThresholds } from '../types';
import {
  calculateOperationalHealth,
  enrichDashboardsWithOperationalMetrics,
  buildOperationalRanking,
  buildOperationalMatrix,
  resolveOperationalIdentity
} from './operationalControl';

describe('Operational Control Center Analytics Engine', () => {
  const globalThresholds: ComplianceThresholds = { onTrack: 95, atRisk: 85 };

  it('uses Dashboard as the canonical source for direction, area and KPI labels', () => {
    const identity = resolveOperationalIdentity({ id: 1, title: 'Tablero', subtitle: '', items: [], thresholds: globalThresholds, group: 'Dirección Norte', area: 'Ventas', clientId: 'CLIENTE' }, { ...mockItem1 });
    expect(identity).toEqual({ client: 'CLIENTE', direction: 'DIRECCIÓN NORTE', area: 'VENTAS', indicator: 'INDICADOR TEST 1' });
    expect(resolveOperationalIdentity({ id: 2, title: 'Tablero', subtitle: '', items: [], thresholds: globalThresholds }, { ...mockItem1 }).area).toBe('SIN ÁREA REGISTRADA');
  });

  const mockItem1: DashboardItem = {
    id: 'kpi-1',
    indicator: 'INDICADOR TEST 1',
    weight: 50,
    unit: '%',
    type: 'accumulative',
    goalType: 'maximize',
    monthlyGoals: [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100],
    monthlyProgress: [90, 95, null, null, null, null, null, null, null, null, null, null],
    operationalStartPeriod: 0
  };

  const mockItem2: DashboardItem = {
    id: 'kpi-2',
    indicator: 'INDICADOR TEST 2',
    weight: 50,
    unit: '%',
    type: 'accumulative',
    goalType: 'maximize',
    monthlyGoals: [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100],
    monthlyProgress: [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100],
    operationalStartPeriod: 0
  };

  const mockDashboard: Dashboard = {
    id: 'board-1',
    title: 'TABLERO DIRECCION A',
    subtitle: 'SUBTITLE',
    group: 'DIRECCION A',
    area: 'AREA X',
    items: [mockItem1, mockItem2],
    thresholds: globalThresholds,
    year: 2026
  };

  test('calculateOperationalHealth should return 100 for empty items', () => {
    expect(calculateOperationalHealth([])).toBe(100);
  });

  test('enrichDashboardsWithOperationalMetrics should securely inject operationalMetrics in items', () => {
    const enriched = enrichDashboardsWithOperationalMetrics([mockDashboard], globalThresholds, 2026);
    expect(enriched[0].items[0].operationalMetrics).toBeDefined();
    expect(enriched[0].items[1].operationalMetrics).toBeDefined();
    expect(enriched[0].items[1].operationalMetrics!.captureRate).toBe(100);
  });

  test('buildOperationalRanking should categorize TOP and DELAYED directions and areas correctly', () => {
    const ranking = buildOperationalRanking([mockDashboard], globalThresholds, 2026);
    
    expect(ranking.directions.top).toBeDefined();
    expect(ranking.directions.delayed).toBeDefined();
    expect(ranking.areas.top).toBeDefined();
    
    expect(ranking.directions.top.length).toBe(1);
    expect(ranking.directions.top[0].name).toBe('DIRECCION A');
    expect(ranking.areas.top[0].name).toBe('AREA X');
  });

  test('buildOperationalMatrix should compile direction x area heatmap cell data correctly', () => {
    const result = buildOperationalMatrix([mockDashboard], globalThresholds, 2026);
    
    expect(result.directions).toContain('DIRECCION A');
    expect(result.areas).toContain('AREA X');
    expect(result.matrix.length).toBe(1);
    expect(result.matrix[0].direction).toBe('DIRECCION A');
    expect(result.matrix[0].area).toBe('AREA X');
  });
});
