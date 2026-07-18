import { 
  getKPISnapshotAtMonth, 
  detectAnomalies, 
  calculateStabilityScore, 
  classifyOperationalMaturity,
  buildHistoryAndAuditEngine,
  OperationalSnapshot
} from './operationalHistory';
import { DashboardItem, Dashboard } from '../types';

describe('Operational History & Audit Engine Tests', () => {

  const createMockItem = (override: Partial<DashboardItem> = {}): DashboardItem => {
    return {
      id: 101,
      indicator: 'Mantenimiento preventivo',
      weight: 10,
      unit: '%',
      goalType: 'higher',
      monthlyGoals: [90, 90, 90, 90, 90, 90, 90, 90, 90, 90, 90, 90],
      monthlyProgress: [92, 95, 91, 92, 95, 91, 92, 95, 91, 92, 95, 91],
      operationalMetrics: {
        expectedPeriods: 3,
        capturedPeriods: 3,
        missingPeriods: 0,
        captureRate: 100,
        performanceScore: 100,
        realOperationalScore: 100,
        stalenessDays: 0,
        performanceStatus: 'OnTrack',
        captureStatus: 'OnTrack',
        operationalStatus: 'OnTrack'
      },
      ...override
    } as DashboardItem;
  };

  test('Caso 1: getKPISnapshotAtMonth recorta el avance correctamente y simula el estado del mes m', () => {
    const item = createMockItem({
      monthlyProgress: [90, 95, null, null, null, null, null, null, null, null, null, null]
    });

    const snapshot = getKPISnapshotAtMonth(item, { onTrack: 95, atRisk: 85 }, 2026, 1);

    expect(snapshot.periodIdx).toBe(1);
    expect(snapshot.periodLabel).toBe('FEB');
    expect(snapshot.captureRate).toBe(100); // ENE y FEB están completos
    expect(snapshot.realOperationalScore).toBeGreaterThanOrEqual(95);
  });

  test('Caso 2: detectAnomalies detecta carga masiva, cambios extremos y recuperación sospechosa', () => {
    // 1. Carga masiva tardía (+50% en un mes)
    const snapshotsBulk: OperationalSnapshot[] = [
      { periodIdx: 0, periodLabel: 'ENE', captureRate: 20, realOperationalScore: 20, operationalHealthScore: 20, operationalReliabilityScore: 20, stalenessDays: 45 },
      { periodIdx: 1, periodLabel: 'FEB', captureRate: 90, realOperationalScore: 90, operationalHealthScore: 90, operationalReliabilityScore: 90, stalenessDays: 0 }
    ];
    const anomaliesBulk = detectAnomalies(snapshotsBulk);
    expect(anomaliesBulk.some(a => a.includes('Carga masiva tardía'))).toBe(true);

    // 2. Variación extrema (>= 40%)
    const snapshotsExtreme: OperationalSnapshot[] = [
      { periodIdx: 0, periodLabel: 'ENE', captureRate: 100, realOperationalScore: 95, operationalHealthScore: 95, operationalReliabilityScore: 95, stalenessDays: 0 },
      { periodIdx: 1, periodLabel: 'FEB', captureRate: 100, realOperationalScore: 40, operationalHealthScore: 40, operationalReliabilityScore: 40, stalenessDays: 0 }
    ];
    const anomaliesExtreme = detectAnomalies(snapshotsExtreme);
    expect(anomaliesExtreme.some(a => a.includes('Variación extrema'))).toBe(true);

    // 3. Recuperación sospechosa (<40% a >=95%)
    const snapshotsSuspicious: OperationalSnapshot[] = [
      { periodIdx: 0, periodLabel: 'ENE', captureRate: 100, realOperationalScore: 30, operationalHealthScore: 30, operationalReliabilityScore: 30, stalenessDays: 0 },
      { periodIdx: 1, periodLabel: 'FEB', captureRate: 100, realOperationalScore: 98, operationalHealthScore: 98, operationalReliabilityScore: 98, stalenessDays: 0 }
    ];
    const anomaliesSuspicious = detectAnomalies(snapshotsSuspicious);
    expect(anomaliesSuspicious.some(a => a.includes('Recuperación sospechosa'))).toBe(true);
  });

  test('Caso 3: calculateStabilityScore discrimina correctamente entre KPIs estables y altamente volátiles', () => {
    const stableSnapshots: OperationalSnapshot[] = [
      { periodIdx: 0, periodLabel: 'ENE', captureRate: 100, realOperationalScore: 95, operationalHealthScore: 95, operationalReliabilityScore: 100, stalenessDays: 0 },
      { periodIdx: 1, periodLabel: 'FEB', captureRate: 100, realOperationalScore: 96, operationalHealthScore: 96, operationalReliabilityScore: 100, stalenessDays: 0 },
      { periodIdx: 2, periodLabel: 'MAR', captureRate: 100, realOperationalScore: 95, operationalHealthScore: 95, operationalReliabilityScore: 100, stalenessDays: 0 }
    ];

    const unstableSnapshots: OperationalSnapshot[] = [
      { periodIdx: 0, periodLabel: 'ENE', captureRate: 33, realOperationalScore: 30, operationalHealthScore: 30, operationalReliabilityScore: 30, stalenessDays: 45 },
      { periodIdx: 1, periodLabel: 'FEB', captureRate: 100, realOperationalScore: 95, operationalHealthScore: 95, operationalReliabilityScore: 100, stalenessDays: 0 },
      { periodIdx: 2, periodLabel: 'MAR', captureRate: 50, realOperationalScore: 40, operationalHealthScore: 40, operationalReliabilityScore: 50, stalenessDays: 30 }
    ];

    const stableScore = calculateStabilityScore(stableSnapshots);
    const unstableScore = calculateStabilityScore(unstableSnapshots);

    expect(stableScore).toBeGreaterThan(90);
    expect(unstableScore).toBeLessThan(70);
  });

  test('Caso 4: classifyOperationalMaturity asigna el nivel de madurez correcto', () => {
    expect(classifyOperationalMaturity(98, 97)).toBe('Enterprise');
    expect(classifyOperationalMaturity(88, 86)).toBe('Maduro');
    expect(classifyOperationalMaturity(75, 72)).toBe('Controlado');
    expect(classifyOperationalMaturity(55, 52)).toBe('Básico');
    expect(classifyOperationalMaturity(30, 40)).toBe('Reactivo');
  });

  test('Caso 5: buildHistoryAndAuditEngine compila correctamente excluyendo agregados consolidados', () => {
    const mockDashboards: Dashboard[] = [
      {
        id: 1,
        title: 'Dirección de Operaciones',
        group: 'OPERACIONES',
        area: 'TACTICA',
        year: 2026,
        thresholds: { onTrack: 95, atRisk: 85 },
        items: [
          createMockItem({ id: 501, indicator: 'KPI Estable' }),
          createMockItem({ 
            id: 502, 
            indicator: 'KPI Inestable',
            monthlyProgress: [90, null, null, null, null, null, null, null, null, null, null, null],
            monthlyGoals: [90, 90, 90, 90, 90, 90, 90, 90, 90, 90, 90, 90]
          })
        ]
      },
      {
        id: -1,
        title: 'SÍNTESIS NACIONAL',
        isAggregate: true,
        group: 'SÍNTESIS',
        area: 'GLOBAL',
        thresholds: { onTrack: 95, atRisk: 85 },
        items: []
      }
    ];

    const history = buildHistoryAndAuditEngine(mockDashboards, { onTrack: 95, atRisk: 85 }, 2026);

    // Debe generar exactamente 2 historiales correspondientes a los 2 items, y omitir el agregado -1.
    expect(history.length).toBe(2);
    expect(history[0].indicator).toBe('KPI Estable');
    expect(history[1].indicator).toBe('KPI Inestable');
    
    // El KPI inestable debe tener al menos una anomalía reportada (por falta de datos en meses esperados)
    expect(history[1].snapshots.length).toBeGreaterThan(0);
    expect(history[1].stabilityScore).toBeLessThan(100);
  });

});
