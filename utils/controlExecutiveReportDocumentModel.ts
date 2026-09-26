import type { ControlExecutiveReport, ControlReportActivityRow, ControlReportResultRow } from './controlExecutiveReport';

export type ControlReportDocumentTable = { headers: string[]; rows: string[][] };
export type ControlReportDocumentSection = { title: string; tables?: ControlReportDocumentTable[]; lines?: string[] };

const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const number = (value: number | undefined) => value === undefined ? 'No disponible' : new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 }).format(value);
const value = (amount: number | undefined, unit: string) => amount === undefined ? 'No disponible' : `${number(amount)}${unit ? ` ${unit}` : ''}`;
export const formatControlReportStatus = (value: ControlReportResultRow['status']) => ({ OnTrack: 'Bajo control', AtRisk: 'Atención', OffTrack: 'Crítico', Neutral: 'No evaluable', InProgress: 'En progreso', MISSING_CONFIGURATION: 'Meta sin configurar', MISSING_CAPTURE: 'Captura ausente' }[value]);
const reason = (value: ControlReportResultRow['attentionReason']) => value ? ({ MISSING_GOAL: 'Meta requerida', MISSING_PROGRESS: 'Captura requerida', TRACKING_START_UNDEFINED: 'Inicio de seguimiento sin configurar', RESULT_CRITICAL: 'Resultado crítico', RESULT_AT_RISK: 'Resultado en riesgo' }[value]) : '';
const planStatus = { planned: 'Planeado', in_progress: 'En ejecución', completed: 'Completado', cancelled: 'Cancelado' } as const;

export const formatControlReportPeriod = (period: ControlExecutiveReport['cover']['period']) => period.frequency === 'monthly'
  ? `${months[period.monthIndex]} ${period.year}`
  : `semana ${period.weekNumber} de ${period.year}`;

export const formatControlReportDate = (isoDate: string) => {
  // A calendar date is not an instant: never pass YYYY-MM-DD through a timezone.
  const calendar = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (calendar) {
    const [, year, month, day] = calendar;
    const monthName = months[Number(month) - 1];
    return monthName ? `${Number(day)} de ${monthName} de ${year}` : isoDate;
  }
  const date = new Date(isoDate);
  return Number.isNaN(date.getTime()) ? isoDate : new Intl.DateTimeFormat('es-MX', { dateStyle: 'long', timeStyle: 'short' }).format(date);
};

/** Deterministic synthesis of certified counts, without inferring unreported healthy states. */
export const buildExecutiveNarrative = (report: ControlExecutiveReport): string => {
  const { totalIndicators, criticalIndicators, attentionIndicators, pendingConfiguration, pendingCapture } = report.executiveSummary;
  if (totalIndicators === 0) return 'No hay indicadores con los filtros aplicados.';
  const parts: string[] = [];
  if (criticalIndicators > 0) parts.push(`${number(criticalIndicators)} ${criticalIndicators === 1 ? 'indicador se encuentra' : 'indicadores se encuentran'} en estado crítico.`);
  if (attentionIndicators > 0) parts.push(`${number(attentionIndicators)} ${attentionIndicators === 1 ? 'requiere' : 'requieren'} atención.`);
  if (pendingConfiguration > 0) parts.push(`${number(pendingConfiguration)} ${pendingConfiguration === 1 ? 'presenta' : 'presentan'} una meta sin configurar.`);
  if (pendingCapture > 0) parts.push(`${number(pendingCapture)} ${pendingCapture === 1 ? 'tiene' : 'tienen'} pendiente la captura de avance.`);
  if (!parts.length) parts.push('Sin desviaciones ni datos pendientes registrados en el resumen.');
  const active = report.followUp.relatedPlans.filter(plan => plan.status === 'in_progress' || plan.status === 'planned').length;
  if (active) parts.push(`${number(active)} plan${active === 1 ? '' : 'es'} de acción activo${active === 1 ? '' : 's'} vinculado${active === 1 ? '' : 's'}.`);
  return parts.join(' ');
};

/** Shared widths use the entire writable A4 area in both formats. */
export const controlReportColumnPercentages = (headers: string[]): number[] => {
  const widths: Record<string, number[]> = {
    'Indicador|6': [32, 12, 12, 12, 13, 19],
    'Actividad|5': [46, 13, 13, 13, 15],
    'Plan|5': [36, 18, 15, 11, 20],
  };
  return widths[`${headers[0]}|${headers.length}`] ?? headers.map(() => 100 / headers.length);
};

/** Read-only editorial projection. Business values and authorization remain in the canonical model. */
export const createControlExecutiveReportDocumentSections = (report: ControlExecutiveReport): ControlReportDocumentSection[] => {
  const reference = (dashboardId: string | number, indicatorId: string | number) => {
    const row = report.results.find(item => String(item.identity.dashboardId) === String(dashboardId) && String(item.identity.indicatorId) === String(indicatorId));
    return row ? `${row.indicator} · ${row.dashboard}` : `${dashboardId} / ${indicatorId}`;
  };
  const activities = [...report.followUp.pendingActivities, ...report.followUp.completedActivities];
  const activityTable = (rows: ControlReportActivityRow[]): ControlReportDocumentTable => ({
    headers: ['Actividad', 'Meta', 'Completado', 'Pendiente', 'Estado'],
    rows: rows.map(row => [`${row.label}\n${reference(row.identity.dashboardId, row.identity.indicatorId)}`, number(row.target), number(row.completed), number(row.pending), row.status === 'COMPLETED' ? 'Completada' : 'Pendiente']),
  });
  // The category is additional information; attach it to its existing result, never repeat the row.
  const categories = new Map<string, string[]>();
  report.detail.forEach(group => group.items.forEach(item => {
    const key = `${item.identity.dashboardId}:${item.identity.indicatorId}`;
    const labels = categories.get(key) || [];
    const label = { CONFIGURACIÓN: 'Configuración', CAPTURA: 'Captura', RESULTADO: 'Resultado' }[group.category];
    if (!labels.includes(label)) labels.push(label);
    categories.set(key, labels);
  }));
  const resultTable: ControlReportDocumentTable = {
    headers: ['Indicador', 'Meta', 'Realizado', 'Pendiente', 'Cumplimiento', 'Estado'],
    rows: report.results.map(row => {
      const labels = categories.get(`${row.identity.dashboardId}:${row.identity.indicatorId}`) || [];
      const extraCategory = labels.filter(label => label !== 'Resultado' && !reason(row.attentionReason));
      const distinctPeriod = formatControlReportPeriod(row.period) !== formatControlReportPeriod(report.cover.period);
      // Disambiguate only when the human-readable names collide across different identities.
      const ambiguous = report.results.some(other => other !== row && other.indicator === row.indicator && other.dashboard === row.dashboard);
      return [
        `${row.indicator}\n${row.dashboard}${ambiguous ? ` · ${row.identity.dashboardId}/${row.identity.indicatorId}` : ''}${distinctPeriod ? ` · ${formatControlReportPeriod(row.period)}` : ''}`,
        value(row.goal, row.unit), value(row.progress, row.unit), value(row.pending, row.unit),
        row.compliance === undefined ? 'No evaluable' : `${number(row.compliance)} %`,
        [formatControlReportStatus(row.status), reason(row.attentionReason), ...extraCategory].filter(Boolean).join(' · '),
      ];
    }),
  };
  const dashboardNames = report.scope.includedDashboardIds.map(id => report.results.find(row => String(row.identity.dashboardId) === String(id))?.dashboard || String(id));
  return [
    { title: report.cover.title, lines: [
      `${report.cover.client} · ${formatControlReportPeriod(report.cover.period)}`,
      `Generado el: ${formatControlReportDate(report.cover.generatedAt)} · Por: ${report.cover.generatedBy}`,
    ] },
    { title: 'Alcance autorizado', lines: [
      `Tableros incluidos: ${dashboardNames.join(', ') || 'Ninguno'} · Indicadores: ${number(report.scope.includedIndicatorCount)}`,
      `Filtros aplicados: ${report.scope.filterLabels.join(', ') || 'Sin filtros adicionales'}`,
    ] },
    { title: 'Resumen ejecutivo', lines: [buildExecutiveNarrative(report)] },
    { title: 'Resultados de indicadores', ...(resultTable.rows.length ? { tables: [resultTable] } : { lines: ['Sin indicadores incluidos'] }) },
    { title: 'Seguimiento de actividades', ...(activities.length ? { tables: [activityTable(activities)] } : { lines: ['Sin actividades registradas'] }) },
    ...(report.followUp.relatedPlans.length ? [{ title: 'Planes relacionados', tables: [{
      headers: ['Plan', 'Responsable', 'Estado', 'Avance', 'Fecha objetivo'],
      rows: report.followUp.relatedPlans.map(plan => [`${plan.title}\n${reference(plan.dashboardId, plan.indicatorId)}`, plan.responsible, planStatus[plan.status], `${number(plan.progress)} %`, plan.targetDate ? formatControlReportDate(plan.targetDate) : 'No disponible']),
    }] }] : []),
  ];
};
