import type { ControlCut } from '../types/controlCut';
import type { ControlCutComparisonResult } from './controlCutComparison';
import type {
  ControlReportDocumentSection,
  ControlReportDocumentTable,
} from './controlExecutiveReportDocumentModel';
import {
  formatControlReportDate,
} from './controlExecutiveReportDocumentModel';

const number = (val: number | undefined): string =>
  val === undefined ? 'No disponible' : new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 }).format(val);

const formatFreq = (freq: 'monthly' | 'weekly', year: number, idx: number): string => {
  if (freq === 'monthly') {
    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    return `${months[idx] || `Mes ${idx + 1}`} de ${year}`;
  }
  return `Semana ${idx} de ${year}`;
};

/**
 * Proyecta un ControlCut inmutable al modelo de secciones para PDF y DOCX.
 * Garantiza lectura exclusiva del snapshot sin consultar estado vivo posterior.
 */
export const createControlCutDocumentSections = (
  cut: ControlCut,
): ControlReportDocumentSection[] => {
  const periodLabel = formatFreq(cut.periodicity, cut.year, cut.periodIndex);

  // Tabla de KPIs
  const kpiTable: ControlReportDocumentTable = {
    headers: ['Indicador', 'Meta', 'Realizado', 'Pendiente', 'Cumplimiento', 'Área'],
    rows: (cut.kpis || []).map((k) => [
      k.label,
      number(k.goal),
      number(k.progress),
      number(k.pending),
      k.compliance !== undefined ? `${number(k.compliance)} %` : 'No evaluable',
      k.area || 'General',
    ]),
  };

  // Tabla de Planes y Compromisos
  const plansTable: ControlReportDocumentTable = {
    headers: ['Plan de Acción', 'Responsable', 'Estado', 'Avance', 'Fecha Objetivo'],
    rows: (cut.actionPlans || []).map((p) => [
      p.title,
      p.responsible || 'Sin responsable',
      p.status,
      `${number(p.progress)} %`,
      p.targetDate ? formatControlReportDate(p.targetDate) : 'No disponible',
    ]),
  };

  // Tabla de Revisiones y Decisiones
  const reviewsTable: ControlReportDocumentTable = {
    headers: ['Revisión / Plan', 'Efecto', 'Decisión', 'Resultado Observado', 'Siguiente Compromiso'],
    rows: (cut.reviews || []).map((r) => {
      const plan = (cut.actionPlans || []).find((p) => p.id === r.planId);
      const planTitle = plan?.title || `Plan ${r.planId}`;
      const nextComm = r.nextCommitment
        ? `${r.nextCommitment.title} (${r.nextCommitment.targetDate || 'Sin fecha'})`
        : r.nextCommitmentPlanId
        ? `Plan sucesor: ${r.nextCommitmentPlanId}`
        : 'Ninguno';

      return [
        `${planTitle}\nRevisado por: ${r.reviewedByLabel} (${formatControlReportDate(r.reviewedAt)})`,
        r.effect,
        r.decision,
        r.observedResult || 'Sin resultado observado',
        nextComm,
      ];
    }),
  };

  const sections: ControlReportDocumentSection[] = [
    {
      title: 'Informe de Corte de Control Certificado',
      lines: [
        `Cliente: ${cut.clientId} · Tablero: ${cut.dashboardId} · Período: ${periodLabel}`,
        `Corte ID: ${cut.cutId} · Schema: v${cut.schemaVersion}`,
        `Capturado el: ${formatControlReportDate(cut.capturedAt)} · Por: ${cut.capturedByLabel}`,
      ],
    },
    {
      title: 'Resumen de Control Operativo al Cierre',
      lines: [
        `Configuraciones pendientes: ${cut.controlSummary.pendingConfigurationsCount} · Capturas pendientes: ${cut.controlSummary.pendingCapturesCount}`,
        `Acciones vencidas: ${cut.controlSummary.overdueActionsCount} · Acciones activas: ${cut.controlSummary.activeActionsCount} · Acciones completadas: ${cut.controlSummary.completedActionsCount}`,
        `Revisiones pendientes: ${cut.controlSummary.pendingReviewsCount} · Elementos con atención derivada: ${cut.controlSummary.derivedAttentionCount}`,
      ],
    },
    {
      title: 'Indicadores de Desempeño (KPIs)',
      ...(kpiTable.rows.length ? { tables: [kpiTable] } : { lines: ['Sin indicadores en este corte'] }),
    },
    {
      title: 'Planes de Acción Registrados',
      ...(plansTable.rows.length ? { tables: [plansTable] } : { lines: ['Sin planes de acción en este corte'] }),
    },
  ];

  if (reviewsTable.rows.length > 0) {
    sections.push({
      title: 'Revisiones de Resultados y Decisiones de Continuidad',
      tables: [reviewsTable],
    });
  }

  return sections;
};

/**
 * Proyecta una Comparación A/B de ControlCuts inmutables al modelo de secciones para PDF y DOCX.
 */
export const createControlCutComparisonDocumentSections = (
  comparison: ControlCutComparisonResult,
): ControlReportDocumentSection[] => {
  const labelA = formatFreq(comparison.periodicity, comparison.cutA.year, comparison.cutA.periodIndex);
  const labelB = formatFreq(comparison.periodicity, comparison.cutB.year, comparison.cutB.periodIndex);

  // Tabla comparativa de KPIs
  const kpiTable: ControlReportDocumentTable = {
    headers: ['Indicador', 'Corte A (Base)', 'Corte B (Comparado)', 'Δ Cumplimiento', 'Interpretación'],
    rows: comparison.kpis.map((k) => {
      const compA = k.complianceA !== undefined ? `${number(k.complianceA)} %` : 'N/D';
      const compB = k.complianceB !== undefined ? `${number(k.complianceB)} %` : 'N/D';
      const delta =
        k.complianceDelta !== undefined
          ? `${k.complianceDelta > 0 ? '+' : ''}${number(k.complianceDelta)} %`
          : 'N/A';
      const interpLabel =
        k.interpretation === 'improved'
          ? 'Mejora'
          : k.interpretation === 'worsened'
          ? 'Deterioro'
          : k.interpretation === 'stable'
          ? 'Sin cambio'
          : 'No comparable';

      return [
        k.labelA || k.labelB || String(k.indicatorId),
        compA,
        compB,
        delta,
        interpLabel,
      ];
    }),
  };

  // Tabla de variaciones de planes y decisiones
  const plansTable: ControlReportDocumentTable = {
    headers: ['Plan de Acción', 'Estado A → B', 'Avance A → B', 'Decisión B', 'Compromiso Siguiente'],
    rows: comparison.actionPlans.map((p) => {
      const statusTrans = `${p.statusA || 'N/D'} → ${p.statusB || 'N/D'}`;
      const progTrans = `${p.progressA !== undefined ? number(p.progressA) : 'N/D'}% → ${
        p.progressB !== undefined ? number(p.progressB) : 'N/D'
      }% (${p.progressDelta !== undefined ? (p.progressDelta > 0 ? '+' : '') + number(p.progressDelta) : '0'}%)`;
      const decision = p.decisionB || p.decisionA || 'Sin decisión';
      const nextComm = p.nextCommitmentB
        ? `${p.nextCommitmentB.title} (${p.nextCommitmentB.targetDate || 'Sin fecha'})`
        : 'Ninguno';

      return [p.titleB || p.titleA || p.planId, statusTrans, progTrans, decision, nextComm];
    }),
  };

  const sections: ControlReportDocumentSection[] = [
    {
      title: 'Informe Comparativo A/B de Cortes de Control',
      lines: [
        `Cliente: ${comparison.clientId} · Tablero: ${comparison.dashboardId} · Periodicidad: ${
          comparison.periodicity === 'monthly' ? 'Mensual' : 'Semanal'
        }`,
        `Corte Base (A): ${comparison.cutA.cutId} (${labelA}) · Capturado: ${formatControlReportDate(
          comparison.cutA.capturedAt,
        )}`,
        `Corte Comparado (B): ${comparison.cutB.cutId} (${labelB}) · Capturado: ${formatControlReportDate(
          comparison.cutB.capturedAt,
        )}`,
      ],
    },
    {
      title: 'Resumen Ejecutivo de Variaciones',
      lines: [
        `KPIs que Mejoraron: ${comparison.improvedKpiCount} · KPIs que Empeoraron: ${comparison.worsenedKpiCount} · Estables: ${comparison.stableKpiCount} · No Comparables: ${comparison.nonComparableKpiCount}`,
        `Variación en Capturas Pendientes: ${
          comparison.summaryDelta.pendingCapturesDelta > 0 ? '+' : ''
        }${comparison.summaryDelta.pendingCapturesDelta} · Acciones Vencidas: ${
          comparison.summaryDelta.overdueActionsDelta > 0 ? '+' : ''
        }${comparison.summaryDelta.overdueActionsDelta}`,
        `Acciones Completadas: ${
          comparison.summaryDelta.completedActionsDelta > 0 ? '+' : ''
        }${comparison.summaryDelta.completedActionsDelta} · Atención Derivada: ${
          comparison.summaryDelta.derivedAttentionDelta > 0 ? '+' : ''
        }${comparison.summaryDelta.derivedAttentionDelta}`,
      ],
    },
    {
      title: 'Comparativa de Indicadores Clave (KPIs)',
      ...(kpiTable.rows.length ? { tables: [kpiTable] } : { lines: ['Sin indicadores en la comparación'] }),
    },
  ];

  if (plansTable.rows.length > 0) {
    sections.push({
      title: 'Seguimiento de Planes, Decisiones y Siguientes Compromisos',
      tables: [plansTable],
    });
  }

  return sections;
};
