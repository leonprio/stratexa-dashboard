import { 
  calculateAlertSeverity, 
  calculateOperationalTrend, 
  calculateOperationalAging, 
  calculateReliabilityScore,
  buildOperationalAlerts
} from './operationalAlerts';
import { DashboardItem, Dashboard } from '../types';

describe('Operational Alerts Engine Tests', () => {

  beforeAll(() => { jest.useFakeTimers(); jest.setSystemTime(new Date('2026-08-29T12:00:00Z')); });
  afterAll(() => { jest.useRealTimers(); });

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

  test('datos vencidos sin evidencia suficiente se clasifican DATOS PENDIENTES, no desempeño crítico', () => {
    const item = createMockItem({
      operationalMetrics: {
        expectedPeriods: 3,
        capturedPeriods: 0,
        missingPeriods: 3,
        captureRate: 0,
        performanceScore: 0,
        realOperationalScore: 0,
        stalenessDays: 65,
        performanceStatus: 'OffTrack',
        captureStatus: 'OffTrack',
        operationalStatus: 'OffTrack'
      }
    });

    const severity = calculateAlertSeverity(item);
    const trend = calculateOperationalTrend(item);
    const aging = calculateOperationalAging(item);

    expect(severity).toBe('DATOS PENDIENTES');
    expect(trend).toBe('NO EVALUABLE');
    expect(aging).toBe('61d+ (Crítico)');
  });

  test('Caso 2: KPI de alto performance pero baja captura debe marcar RIESGO OCULTO', () => {
    const item = createMockItem({
      operationalMetrics: {
        expectedPeriods: 3,
        capturedPeriods: 1,
        missingPeriods: 2,
        captureRate: 33, // baja captura
        performanceScore: 98, // alto desempeño
        realOperationalScore: 32,
        stalenessDays: 35,
        performanceStatus: 'OnTrack',
        captureStatus: 'OffTrack',
        operationalStatus: 'AtRisk'
      }
    });

    const severity = calculateAlertSeverity(item);
    const isHiddenRisk = item.operationalMetrics!.performanceScore >= 90 && item.operationalMetrics!.captureRate < 70;

    expect(severity).toBe('RIESGO OCULTO');
    expect(isHiddenRisk).toBe(true);
  });

  test('Caso 3: KPI actualizado no debe reportar alertas falsas', () => {
    const item = createMockItem();

    const severity = calculateAlertSeverity(item);
    const trend = calculateOperationalTrend(item);
    const aging = calculateOperationalAging(item);
    const reliability = calculateReliabilityScore(item);

    expect(severity).toBe('BAJO CONTROL');
    expect(trend).toBe('ESTABLE');
    expect(aging).toBe('Al día');
    expect(reliability).toBe(100);
  });

  test('Caso 4: calculateReliabilityScore integra tendencias y penalizaciones correctamente', () => {
    const deterioratingItem = createMockItem({
      operationalMetrics: {
        expectedPeriods: 3,
        capturedPeriods: 1,
        missingPeriods: 2,
        captureRate: 33,
        performanceScore: 85,
        realOperationalScore: 28,
        stalenessDays: 45,
        performanceStatus: 'InProgress',
        captureStatus: 'OffTrack',
        operationalStatus: 'OffTrack'
      }
    });

    const score = calculateReliabilityScore(deterioratingItem);
    // score debe penalizar fuertemente por días de retraso, captureRate de 33%, real score de 28% y tendencia deteriorándose.
    expect(score).toBeLessThan(50);
  });

  test('Caso 5: buildOperationalAlerts compila y filtra correctamente tableros consolidados', () => {
    const mockDashboards: Dashboard[] = [
      {
        id: 1,
        title: 'Dirección Médica',
        group: 'MEDICA',
        area: 'SERVICIOS',
        year: 2026,
        items: [
          createMockItem({ id: 201, indicator: 'KPI A' }),
          createMockItem({ 
            id: 202, 
            indicator: 'KPI B', 
            monthlyProgress: [92, null, null, null, null, null, null, null, null, null, null, null], // Solo periodo 0 cargado
            monthlyGoals: [90, 90, 90, 90, 90, 90, 90, 90, 90, 90, 90, 90],
            operationalMetrics: {
              expectedPeriods: 3,
              capturedPeriods: 1,
              missingPeriods: 2,
              captureRate: 33,
              performanceScore: 95,
              realOperationalScore: 31,
              stalenessDays: 32,
              performanceStatus: 'OnTrack',
              captureStatus: 'OffTrack',
              operationalStatus: 'AtRisk'
            }
          })
        ]
      },
      {
        id: -1, // Agregado consolidado, debe omitirse para evitar duplicados
        title: 'SÍNTESIS NACIONAL',
        isAggregate: true,
        group: 'SÍNTESIS',
        area: 'GLOBAL',
        items: []
      }
    ];

    const alerts = buildOperationalAlerts(mockDashboards, { onTrack: 95, atRisk: 85 }, 2026);
    
    // Debería generar exactamente 2 alertas (una para KPI A que está al día y otra para KPI B con rezago).
    // El consolidado nacional con id -1 debe ser totalmente omitido.
    expect(alerts.length).toBe(2);
    const hiddenRisk = alerts.find(alert => alert.indicator === 'KPI B');
    expect(hiddenRisk?.direction).toBe('MEDICA');
    expect(hiddenRisk?.area).toBe('SERVICIOS');
    expect(hiddenRisk?.severity).toBe('RIESGO OCULTO');
  });

  test('mal desempeño certificado con captura suficiente es CRÍTICO', () => {
    const item = createMockItem({ operationalMetrics: { ...createMockItem().operationalMetrics, expectedPeriods: 4, capturedPeriods: 4, missingPeriods: 0, captureRate: 100, performanceScore: 45, realOperationalScore: 45, stalenessDays: 0, performanceStatus: 'OffTrack' } });
    expect(calculateAlertSeverity(item)).toBe('CRÍTICO');
    expect(calculateOperationalTrend(item)).toBe('CRÍTICO');
  });

  test('deterioro moderado certificado requiere atención', () => {
    const item = createMockItem({ operationalMetrics: { ...createMockItem().operationalMetrics, expectedPeriods: 4, capturedPeriods: 4, missingPeriods: 0, captureRate: 100, performanceScore: 82, realOperationalScore: 82, stalenessDays: 0, performanceStatus: 'AtRisk' } });
    expect(calculateAlertSeverity(item)).toBe('REQUIERE ATENCIÓN');
    expect(calculateOperationalTrend(item)).toBe('DETERIORÁNDOSE');
  });

  test('61d+ es una categoría visual y no limita los días reales', () => {
    const item = createMockItem({ operationalMetrics: { ...createMockItem().operationalMetrics, stalenessDays: 145 } });
    expect(calculateOperationalAging(item)).toBe('61d+ (Crítico)');
    expect(item.operationalMetrics?.stalenessDays).toBe(145);
  });

});
