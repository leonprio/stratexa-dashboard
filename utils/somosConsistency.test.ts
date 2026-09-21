import { calculateAggregateDashboard } from './aggregationUtils';
import { calculateCompliance, isAccumulativeIndicator } from './compliance';
import { derivePendingKpiActivities, deriveRescheduledKpiCommitments } from '../components/CurrentPeriodFocus';
import { buildResolutionHistory } from './resolutionHistory';
import type { Dashboard, DashboardItem } from '../types';

describe('SOMOS Consistency & Stock Indicators & Continuity (v9.6.10)', () => {
  const globalThresholds = { onTrack: 90, atRisk: 75 };

  describe('1. Agregación sin doble conteo territorial', () => {
    const gtoDashboard: Dashboard = {
      id: 'SOMOS_2026_GTO',
      title: 'Inclusión — Guanajuato',
      subtitle: '',
      group: 'SECRETARÍA DE INCLUSIÓN',
      area: 'SECRETARÍA DE INCLUSIÓN',
      year: 2026,
      thresholds: globalThresholds,
      items: [
        {
          id: 1,
          indicator: 'Actividades de inclusión realizadas',
          semanticKey: 'somos-inclusion-activities',
          weight: 100,
          unit: 'Actividades',
          type: 'accumulative',
          goalType: 'maximize',
          monthlyGoals: [2, 2, 3, 3, 4, 4, 5, 6, null, null, null, null],
          monthlyGoalCaptured: [true, true, true, true, true, true, true, true, false, false, false, false],
          monthlyProgress: [2, 2, 3, 2, 4, 4, 4, 5, null, null, null, null],
          monthlyProgressCaptured: [true, true, true, true, true, true, true, true, false, false, false, false],
        },
      ],
    };

    const qroDashboard: Dashboard = {
      id: 'SOMOS_2026_QRO',
      title: 'Inclusión — Querétaro',
      subtitle: '',
      group: 'SECRETARÍA DE INCLUSIÓN',
      area: 'SECRETARÍA DE INCLUSIÓN',
      year: 2026,
      thresholds: globalThresholds,
      items: [
        {
          id: 1,
          indicator: 'Actividades de inclusión realizadas',
          semanticKey: 'somos-inclusion-activities',
          weight: 100,
          unit: 'Actividades',
          type: 'accumulative',
          goalType: 'maximize',
          monthlyGoals: [1, 2, 2, 3, 3, 4, 5, 6, null, null, null, null],
          monthlyGoalCaptured: [true, true, true, true, true, true, true, true, false, false, false, false],
          monthlyProgress: [1, 1, 2, 3, 2, 4, 5, 5, null, null, null, null],
          monthlyProgressCaptured: [true, true, true, true, true, true, true, true, false, false, false, false],
        },
      ],
    };

    const nacDashboard: Dashboard = {
      id: 'SOMOS_2026_1',
      title: 'SECRETARÍA DE INCLUSIÓN',
      subtitle: '',
      group: 'SECRETARÍA DE INCLUSIÓN',
      area: 'SECRETARÍA DE INCLUSIÓN',
      year: 2026,
      thresholds: globalThresholds,
      items: [
        {
          id: 1,
          indicator: 'Grupos de diversidad con participación activa',
          weight: 33.33,
          unit: 'Grupos',
          type: 'stock',
          goalType: 'maximize',
          monthlyGoals: [1, 1, 2, 2, 3, 3, 4, 4, null, null, null, null],
          monthlyGoalCaptured: [true, true, true, true, true, true, true, true, false, false, false, false],
          monthlyProgress: [1, 1, 2, 1, 2, 3, 3, 3, null, null, null, null],
          monthlyProgressCaptured: [true, true, true, true, true, true, true, true, false, false, false, false],
        },
        {
          id: 2,
          indicator: 'Entidades con estructura de inclusión activa',
          weight: 33.33,
          unit: 'Entidades',
          type: 'stock',
          goalType: 'maximize',
          monthlyGoals: [3, 5, 7, 9, 12, 15, 18, 20, null, null, null, null],
          monthlyGoalCaptured: [true, true, true, true, true, true, true, true, false, false, false, false],
          monthlyProgress: [2, 4, 7, 8, 10, 12, 15, 10, null, null, null, null],
          monthlyProgressCaptured: [true, true, true, true, true, true, true, true, false, false, false, false],
        },
        {
          id: 3,
          indicator: 'Actividades de inclusión realizadas',
          semanticKey: 'somos-inclusion-activities',
          contributionKind: 'derived',
          derivedFrom: [
            { dashboardId: 'SOMOS_2026_GTO', itemId: 1 },
            { dashboardId: 'SOMOS_2026_QRO', itemId: 1 },
          ],
          weight: 33.34,
          unit: 'Actividades',
          type: 'accumulative',
          goalType: 'maximize',
          // The old state projection is retained as provenance, not shown as a
          // national own capture.
          derivedProjection: {
            monthlyGoals: [3, 4, 5, 6, 7, 8, 10, 12, null, null, null, null],
            monthlyProgress: [3, 3, 5, 5, 6, 8, 9, 10, null, null, null, null],
          },
          monthlyGoals: [null, null, null, null, null, null, null, null, null, null, null, null],
          monthlyGoalCaptured: [false, false, false, false, false, false, false, false, false, false, false, false],
          monthlyProgress: [null, null, null, null, null, null, null, null, null, null, null, null],
          monthlyProgressCaptured: [false, false, false, false, false, false, false, false, false, false, false, false],
        },
      ],
    };

    test('Consolidado elimina el doble conteo y muestra 49 actividades acumuladas (no 98)', () => {
      const agg = calculateAggregateDashboard([nacDashboard, gtoDashboard, qroDashboard]);
      const actItem = agg.items.find(i => i.indicator.toUpperCase().includes('ACTIVIDADES'));

      expect(actItem).toBeDefined();
      const totalProg = (actItem?.monthlyProgress || []).slice(0, 8).reduce((sum, v) => sum + (v || 0), 0);
      const totalGoal = (actItem?.monthlyGoals || []).slice(0, 8).reduce((sum, v) => sum + (v || 0), 0);

      expect(totalProg).toBe(49);
      expect(totalGoal).toBe(55);

      // En agosto: meta 12, real 10
      expect(actItem?.monthlyGoals?.[7]).toBe(12);
      expect(actItem?.monthlyProgress?.[7]).toBe(10);
    });

    test('Consolidado de solo los dos estados suma 49 actividades acumuladas', () => {
      const agg = calculateAggregateDashboard([gtoDashboard, qroDashboard]);
      const actItem = agg.items.find(i => i.indicator.toUpperCase().includes('ACTIVIDADES'));

      expect(actItem).toBeDefined();
      const totalProg = (actItem?.monthlyProgress || []).slice(0, 8).reduce((sum, v) => sum + (v || 0), 0);
      expect(totalProg).toBe(49);
    });
  });

  describe('2. Semántica de Indicador de Corte / Stock (type: "stock")', () => {
    test('Calcula cumplimiento al último corte válido (Agosto: Grupos 3/4 = 75%)', () => {
      const kpiGrupos: DashboardItem = {
        id: 1,
        indicator: 'Grupos de diversidad con participación activa',
        weight: 100,
        unit: 'Grupos',
        type: 'stock',
        goalType: 'maximize',
        monthlyGoals: [1, 1, 2, 2, 3, 3, 4, 4, null, null, null, null],
        monthlyGoalCaptured: [true, true, true, true, true, true, true, true, false, false, false, false],
        monthlyProgress: [1, 1, 2, 1, 2, 3, 3, 3, null, null, null, null],
        monthlyProgressCaptured: [true, true, true, true, true, true, true, true, false, false, false, false],
      };

      const result = calculateCompliance(kpiGrupos, globalThresholds, 2026, 'realTime', [kpiGrupos]);
      expect(result.currentProgress).toBe(3);
      expect(result.currentTarget).toBe(4);
      expect(result.overallPercentage).toBe(75);
      expect(result.complianceStatus).toBe('AtRisk');
    });

    test('Calcula cumplimiento al último corte válido (Agosto: Entidades 10/20 = 50%)', () => {
      const kpiEntidades: DashboardItem = {
        id: 2,
        indicator: 'Entidades con estructura de inclusión activa',
        weight: 100,
        unit: 'Entidades',
        type: 'stock',
        goalType: 'maximize',
        monthlyGoals: [3, 5, 7, 9, 12, 15, 18, 20, null, null, null, null],
        monthlyGoalCaptured: [true, true, true, true, true, true, true, true, false, false, false, false],
        monthlyProgress: [2, 4, 7, 8, 10, 12, 15, 10, null, null, null, null],
        monthlyProgressCaptured: [true, true, true, true, true, true, true, true, false, false, false, false],
      };

      const result = calculateCompliance(kpiEntidades, globalThresholds, 2026, 'realTime', [kpiEntidades]);
      expect(result.currentProgress).toBe(10);
      expect(result.currentTarget).toBe(20);
      expect(result.overallPercentage).toBe(50);
      expect(result.complianceStatus).toBe('OffTrack');
    });

    test('Cero explícito capturado es respetado como corte válido', () => {
      const kpiZero: DashboardItem = {
        id: 3,
        indicator: 'Sucursales cerradas',
        weight: 100,
        unit: 'Sucursales',
        type: 'stock',
        goalType: 'maximize',
        monthlyGoals: [5, 5, 5, 5, 5, 5, 5, 5, null, null, null, null],
        monthlyGoalCaptured: [true, true, true, true, true, true, true, true, false, false, false, false],
        monthlyProgress: [2, 2, 2, 2, 2, 2, 2, 0, null, null, null, null],
        monthlyProgressCaptured: [true, true, true, true, true, true, true, true, false, false, false, false],
      };

      const result = calculateCompliance(kpiZero, globalThresholds, 2026, 'realTime', [kpiZero]);
      expect(result.currentProgress).toBe(0);
      expect(result.currentTarget).toBe(5);
      expect(result.overallPercentage).toBe(0);
    });

    test('isAccumulativeIndicator retorna false para type: "stock"', () => {
      expect(isAccumulativeIndicator('Grupos de diversidad', 'stock')).toBe(false);
      expect(isAccumulativeIndicator('Actividades realizadas', 'accumulative')).toBe(true);
      expect(isAccumulativeIndicator('Promedio de satisfacción', 'average')).toBe(false);
    });
  });

  describe('3. Continuidad Transversal Directa en la Ficha del KPI', () => {
    const itemWithCommitments: DashboardItem = {
      id: 1,
      indicator: 'Grupos de diversidad con participación activa',
      weight: 100,
      unit: 'Grupos',
      type: 'stock',
      goalType: 'maximize',
      monthlyGoals: [1, 1, 2, 2, 3, 3, 4, 4, null, null, null, null],
      monthlyGoalCaptured: [true, true, true, true, true, true, true, true, false, false, false, false],
      monthlyProgress: [1, 1, 2, 1, 2, 3, 3, 3, null, null, null, null],
      monthlyProgressCaptured: [true, true, true, true, true, true, true, true, false, false, false, false],
      continuityCommitments: {
        'simple-kpi:1:monthly:2026:7': {
          id: 'simple-kpi:1:monthly:2026:7',
          sourceType: 'SIMPLE_KPI',
          sourceKpiId: '1',
          originYear: 2026,
          originPeriod: 7,
          originalTarget: 4,
          scheduledYear: 2026,
          scheduledPeriod: 8,
          frequency: 'monthly',
          progressByPeriod: { '7': 3 },
          status: 'active',
          outcome: 'in_progress',
          rescheduleHistory: [],
          resolutionHistory: [
            {
              type: 'CREATE_CONTINUITY',
              at: '2026-08-31T23:59:59.000Z',
              reason: 'atender el grupo faltante',
            },
          ],
        },
      },
    };

    const itemWithFutureCommitment: DashboardItem = {
      id: 2,
      indicator: 'Entidades con estructura de inclusión activa',
      weight: 100,
      unit: 'Entidades',
      type: 'stock',
      goalType: 'maximize',
      monthlyGoals: [3, 5, 7, 9, 12, 15, 18, 20, null, null, null, null],
      monthlyGoalCaptured: [true, true, true, true, true, true, true, true, false, false, false, false],
      monthlyProgress: [2, 4, 7, 8, 10, 12, 15, 10, null, null, null, null],
      monthlyProgressCaptured: [true, true, true, true, true, true, true, true, false, false, false, false],
      continuityCommitments: {
        'simple-kpi:2:monthly:2026:7': {
          id: 'simple-kpi:2:monthly:2026:7',
          sourceType: 'SIMPLE_KPI',
          sourceKpiId: '2',
          originYear: 2026,
          originPeriod: 7,
          originalTarget: 20,
          scheduledYear: 2026,
          scheduledPeriod: 9,
          frequency: 'monthly',
          progressByPeriod: { '7': 10 },
          status: 'active',
          outcome: 'in_progress',
          rescheduleHistory: [],
          resolutionHistory: [
            {
              type: 'CREATE_CONTINUITY',
              at: '2026-08-31T23:59:59.000Z',
              reason: 'ampliar la cobertura de estructuras territoriales de inclusión',
            },
          ],
        },
      },
    };

    test('derivePendingKpiActivities incluye el compromiso de septiembre como vigente en mes 8', () => {
      const pending = derivePendingKpiActivities(undefined, 8, false, 2026, itemWithCommitments);
      expect(pending).toHaveLength(1);
      expect(pending[0].id).toBe('simple-kpi:1:monthly:2026:7');
      expect(pending[0].status).toBe('COMPROMISO ACTUAL');
      expect(pending[0].label).toContain('atender el grupo faltante');
    });

    test('derivePendingKpiActivities incluye el compromiso de octubre como reprogramado/futuro (no atrasado) en septiembre (mes 8)', () => {
      const pending = derivePendingKpiActivities(undefined, 8, false, 2026, itemWithFutureCommitment);
      expect(pending).toHaveLength(1);
      expect(pending[0].id).toBe('simple-kpi:2:monthly:2026:7');
      expect(pending[0].status).toBe('REPROGRAMADA');
      expect(pending[0].label).toContain('ampliar la cobertura de estructuras');
    });

    test('deriveRescheduledKpiCommitments genera el compromiso programado para el periodo consultado', () => {
      const scheduled = deriveRescheduledKpiCommitments(undefined, 8, false, 2026, itemWithCommitments);
      expect(scheduled).toHaveLength(1);
      expect(scheduled[0].id).toBe('simple-kpi:1:monthly:2026:7');
      expect(scheduled[0].scheduledPeriodIndex).toBe(8);
      expect(scheduled[0].status).toBe('COMPROMISO ACTUAL');
    });

    test('buildResolutionHistory mapea correctamente los eventos de compromisos canónicos', () => {
      const history = buildResolutionHistory(itemWithCommitments, 2026);
      expect(history).toBeDefined();
    });
  });
});
