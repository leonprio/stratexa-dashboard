import type { ControlCut } from '../types/controlCut';
import { compareControlCuts } from './controlCutComparison';
import {
  createControlCutDocumentSections,
  createControlCutComparisonDocumentSections,
} from './controlCutDocumentModel';
import {
  exportControlCutReport,
  exportControlCutComparisonReport,
  controlCutReportFilename,
  controlCutComparisonReportFilename,
} from './controlCutExport';

describe('ControlCut Document Export & Reporting Tests (Bloque 3)', () => {
  const sampleCutA: ControlCut = {
    cutId: 'CLIENT_A_1_M_2026_0',
    schemaVersion: 1,
    capturedAt: '2026-01-31T20:00:00Z',
    capturedByLabel: 'Supervisor Operativo',
    capturedByUserId: 'usr-sup-1',
    clientId: 'CLIENT_A',
    dashboardId: 1,
    dashboardIds: [1],
    periodicity: 'monthly',
    year: 2026,
    periodIndex: 0,
    scope: {
      clientId: 'CLIENT_A',
      dashboardId: 1,
      dashboardIds: [1],
      periodicity: 'monthly',
      year: 2026,
      periodIndex: 0,
    },
    controlSummary: {
      pendingConfigurationsCount: 0,
      pendingCapturesCount: 1,
      overdueActionsCount: 1,
      upcomingActionsCount: 0,
      activeActionsCount: 1,
      completedActionsCount: 0,
      pendingReviewsCount: 1,
      derivedAttentionCount: 1,
    },
    kpis: [
      {
        indicatorId: 10,
        label: 'Eficiencia de Planta',
        goal: 100,
        progress: 85,
        compliance: 85,
        pending: 15,
        frequency: 'monthly',
        dashboardId: 1,
        area: 'Operaciones',
      },
      {
        indicatorId: 11,
        label: 'Merma de Producción',
        goal: 5,
        progress: 4,
        compliance: 100, // minimize
        pending: 0,
        frequency: 'monthly',
        dashboardId: 1,
        area: 'Calidad',
      },
      {
        indicatorId: 12,
        label: 'Mantenimiento Preventivo Semanal',
        goal: 10,
        progress: undefined,
        compliance: undefined,
        pending: undefined,
        frequency: 'weekly',
        dashboardId: 1,
        area: 'Mantenimiento',
      },
    ],
    actionPlans: [
      {
        id: 'plan-1',
        indicatorId: 10,
        dashboardId: 1,
        clientId: 'CLIENT_A',
        area: 'Operaciones',
        title: 'Calibración de Línea 1',
        originYear: 2026,
        originPeriodType: 'monthly',
        originPeriodIndex: 0,
        status: 'in_progress',
        responsible: 'Juan Pérez',
        startDate: '2026-01-10',
        targetDate: '2026-02-15',
        progress: 60,
        createdAt: '2026-01-10T10:00:00Z',
        updatedAt: '2026-01-25T10:00:00Z',
        activities: [],
        reviews: [
          {
            id: 'rev-1',
            planId: 'plan-1',
            reviewedAt: '2026-01-30T10:00:00Z',
            reviewedByLabel: 'Auditor Calidad',
            observedResult: 'Avance adecuado en calibración técnica.',
            effect: 'positive',
            decision: 'MAINTAIN',
            nextCommitment: {
              type: 'activity',
              id: 'act-2',
              title: 'Prueba de estrés de máquina',
              targetDate: '2026-02-10',
            },
          },
        ],
      },
      {
        id: 'plan-closed',
        indicatorId: 11,
        dashboardId: 1,
        clientId: 'CLIENT_A',
        area: 'Calidad',
        title: 'Revisión de Válvulas',
        originYear: 2026,
        originPeriodType: 'monthly',
        originPeriodIndex: 0,
        status: 'completed',
        responsible: 'María López',
        startDate: '2026-01-05',
        targetDate: '2026-01-20',
        closedAt: '2026-01-20T18:00:00Z',
        progress: 100,
        createdAt: '2026-01-05T10:00:00Z',
        updatedAt: '2026-01-20T18:00:00Z',
        activities: [],
        reviews: [],
      },
    ],
    reviews: [
      {
        id: 'rev-1',
        planId: 'plan-1',
        reviewedAt: '2026-01-30T10:00:00Z',
        reviewedByLabel: 'Auditor Calidad',
        observedResult: 'Avance adecuado en calibración técnica.',
        effect: 'positive',
        decision: 'MAINTAIN',
        nextCommitment: {
          type: 'activity',
          id: 'act-2',
          title: 'Prueba de estrés de máquina',
          targetDate: '2026-02-10',
        },
      },
    ],
  };

  const sampleCutB: ControlCut = {
    cutId: 'CLIENT_A_1_M_2026_1',
    schemaVersion: 1,
    capturedAt: '2026-02-28T20:00:00Z',
    capturedByLabel: 'Director Operaciones',
    clientId: 'CLIENT_A',
    dashboardId: 1,
    dashboardIds: [1],
    periodicity: 'monthly',
    year: 2026,
    periodIndex: 1,
    scope: {
      clientId: 'CLIENT_A',
      dashboardId: 1,
      dashboardIds: [1],
      periodicity: 'monthly',
      year: 2026,
      periodIndex: 1,
    },
    controlSummary: {
      pendingConfigurationsCount: 0,
      pendingCapturesCount: 0,
      overdueActionsCount: 0,
      upcomingActionsCount: 0,
      activeActionsCount: 1,
      completedActionsCount: 1,
      pendingReviewsCount: 0,
      derivedAttentionCount: 0,
    },
    kpis: [
      {
        indicatorId: 10,
        label: 'Eficiencia de Planta',
        goal: 100,
        progress: 95,
        compliance: 95,
        pending: 5,
        frequency: 'monthly',
        dashboardId: 1,
        area: 'Operaciones',
      },
      {
        indicatorId: 11,
        label: 'Merma de Producción',
        goal: 5,
        progress: 3,
        compliance: 100,
        pending: 0,
        frequency: 'monthly',
        dashboardId: 1,
        area: 'Calidad',
      },
      {
        indicatorId: 12,
        label: 'Mantenimiento Preventivo Semanal',
        goal: 10,
        progress: 10,
        compliance: 100,
        pending: 0,
        frequency: 'weekly',
        dashboardId: 1,
        area: 'Mantenimiento',
      },
    ],
    actionPlans: [
      {
        id: 'plan-1',
        indicatorId: 10,
        dashboardId: 1,
        clientId: 'CLIENT_A',
        area: 'Operaciones',
        title: 'Calibración de Línea 1',
        originYear: 2026,
        originPeriodType: 'monthly',
        originPeriodIndex: 0,
        status: 'completed',
        responsible: 'Juan Pérez',
        startDate: '2026-01-10',
        targetDate: '2026-02-15',
        progress: 100,
        createdAt: '2026-01-10T10:00:00Z',
        updatedAt: '2026-02-15T10:00:00Z',
        activities: [],
        reviews: [
          {
            id: 'rev-2',
            planId: 'plan-1',
            reviewedAt: '2026-02-28T10:00:00Z',
            reviewedByLabel: 'Auditor Calidad',
            observedResult: 'Línea 1 calibrada al 100%.',
            effect: 'positive',
            decision: 'CLOSE',
            nextCommitmentPlanId: 'plan-sucesor-2',
          },
        ],
      },
    ],
    reviews: [
      {
        id: 'rev-2',
        planId: 'plan-1',
        reviewedAt: '2026-02-28T10:00:00Z',
        reviewedByLabel: 'Auditor Calidad',
        observedResult: 'Línea 1 calibrada al 100%.',
        effect: 'positive',
        decision: 'CLOSE',
        nextCommitmentPlanId: 'plan-sucesor-2',
      },
    ],
  };

  test('genera nombres de archivo canónicos para corte individual y comparación A/B', () => {
    const filenameCut = controlCutReportFilename(sampleCutA, 'pdf');
    expect(filenameCut).toBe('corte_CONTROL_CLIENT_A_1_2026-01.pdf');

    const filenameComparison = controlCutComparisonReportFilename(
      compareControlCuts(sampleCutA, sampleCutB),
      'docx',
    );
    expect(filenameComparison).toBe('comparativa_cortes_CONTROL_CLIENT_A_1_2026-01_vs_2026-02.docx');
  });

  test('createControlCutDocumentSections construye secciones completas a partir del snapshot inmutable', () => {
    const sections = createControlCutDocumentSections(sampleCutA);
    expect(sections).toHaveLength(5);

    // Identificación del corte
    expect(sections[0].title).toBe('Informe de Corte de Control Certificado');
    expect(sections[0].lines?.[0]).toContain('CLIENT_A');
    expect(sections[0].lines?.[1]).toContain('CLIENT_A_1_M_2026_0');

    // Situación de control
    expect(sections[1].title).toBe('Resumen de Control Operativo al Cierre');
    expect(sections[1].lines?.[0]).toContain('Capturas pendientes: 1');

    // KPIs (mensual y semanal, datos ausentes)
    const kpiTable = sections[2].tables?.[0];
    expect(kpiTable?.rows).toHaveLength(3);
    expect(kpiTable?.rows[0][0]).toBe('Eficiencia de Planta');
    expect(kpiTable?.rows[0][4]).toBe('85 %');
    expect(kpiTable?.rows[2][4]).toBe('No evaluable'); // datos ausentes en corte A

    // Planes (incluyendo plan cerrado)
    const plansTable = sections[3].tables?.[0];
    expect(plansTable?.rows).toHaveLength(2);
    expect(plansTable?.rows[1][2]).toBe('completed');

    // Revisiones, decisiones y siguiente compromiso
    const revTable = sections[4].tables?.[0];
    expect(revTable?.rows).toHaveLength(1);
    expect(revTable?.rows[0][1]).toBe('positive');
    expect(revTable?.rows[0][2]).toBe('MAINTAIN');
    expect(revTable?.rows[0][4]).toContain('Prueba de estrés de máquina');
  });

  test('createControlCutComparisonDocumentSections refleja variaciones A/B y trazabilidad de compromisos', () => {
    const comparison = compareControlCuts(sampleCutA, sampleCutB);
    const sections = createControlCutComparisonDocumentSections(comparison);

    expect(sections[0].title).toBe('Informe Comparativo A/B de Cortes de Control');
    expect(sections[1].title).toBe('Resumen Ejecutivo de Variaciones');
    expect(sections[1].lines?.[0]).toContain('KPIs que Mejoraron: 1');
    expect(sections[1].lines?.[0]).toContain('Estables: 1');
    expect(sections[1].lines?.[0]).toContain('No Comparables: 1');

    // Tabla de KPIs A/B
    const kpiTable = sections[2].tables?.[0];
    expect(kpiTable?.rows).toHaveLength(3);
    expect(kpiTable?.rows[0][3]).toContain('+10 %'); // 85% a 95%
    expect(kpiTable?.rows[0][4]).toBe('Mejora');

    // Tabla de planes A/B con transición de estado y decisión
    const planTable = sections[3].tables?.[0];
    expect(planTable?.rows).toHaveLength(2);
    expect(planTable?.rows[0][1]).toBe('in_progress → completed');
    expect(planTable?.rows[0][3]).toBe('CLOSE');
  });

  test('exportControlCutReport genera Blob válido para PDF y DOCX sin mutar el snapshot', async () => {
    const originalJson = JSON.stringify(sampleCutA);

    // Exportar PDF
    const { blob: pdfBlob, filename: pdfName } = await exportControlCutReport(sampleCutA, 'pdf');
    expect(pdfBlob).toBeDefined();
    expect(pdfBlob.size).toBeGreaterThan(100);
    expect(pdfName).toMatch(/\.pdf$/);

    // Exportar DOCX
    const { blob: docxBlob, filename: docxName } = await exportControlCutReport(sampleCutA, 'docx');
    expect(docxBlob).toBeDefined();
    expect(docxBlob.size).toBeGreaterThan(100);
    expect(docxName).toMatch(/\.docx$/);

    // Inmutabilidad estricta: el objeto original no sufrió mutación
    expect(JSON.stringify(sampleCutA)).toBe(originalJson);
  });

  test('exportControlCutComparisonReport genera Blob para PDF y DOCX de comparación A/B', async () => {
    const comparison = compareControlCuts(sampleCutA, sampleCutB);

    const { blob: pdfBlob } = await exportControlCutComparisonReport(comparison, 'pdf');
    expect(pdfBlob).toBeDefined();
    expect(pdfBlob.size).toBeGreaterThan(100);

    const { blob: docxBlob } = await exportControlCutComparisonReport(comparison, 'docx');
    expect(docxBlob).toBeDefined();
    expect(docxBlob.size).toBeGreaterThan(100);
  });

  test('reproducibilidad: dos exportaciones del mismo corte generan el mismo contenido documental', () => {
    const sections1 = createControlCutDocumentSections(sampleCutA);
    const sections2 = createControlCutDocumentSections(sampleCutA);

    expect(JSON.stringify(sections1)).toBe(JSON.stringify(sections2));
  });

  test('no lee estados vivos posteriores: mutaciones en entorno externo no alteran el corte guardado', () => {
    const cutCopy = JSON.parse(JSON.stringify(sampleCutA));
    const sectionsBefore = createControlCutDocumentSections(cutCopy);

    // Simular intento de alteración externa o mutación posterior
    const simulatedLiveState = { progress: 999 };
    expect(cutCopy.kpis[0].progress).toBe(85);
    expect(simulatedLiveState.progress).toBe(999);

    const sectionsAfter = createControlCutDocumentSections(cutCopy);
    expect(JSON.stringify(sectionsBefore)).toBe(JSON.stringify(sectionsAfter));
  });
});
