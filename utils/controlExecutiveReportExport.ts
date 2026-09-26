import type { ControlExecutiveReport, ControlExecutiveReportFormat, ControlReportSource } from './controlExecutiveReport';

export const controlReportFilename = (report: ControlExecutiveReport, format: ControlExecutiveReportFormat) => {
  const period = report.cover.period.frequency === 'monthly'
    ? `${report.cover.period.year}-${String(report.cover.period.monthIndex + 1).padStart(2, '0')}`
    : `${report.cover.period.year}-S${String(report.cover.period.weekNumber).padStart(2, '0')}`;
  const client = report.cover.client.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'cliente';
  return `informe_CONTROL_${client}_${period}.${format}`;
};

export interface ControlReportExportRequest {
  format: ControlExecutiveReportFormat;
  source: ControlReportSource;
  renderPdf: (report: ControlExecutiveReport) => Promise<Blob>;
  renderDocx: (report: ControlExecutiveReport) => Promise<Blob>;
  save: (blob: Blob, filename: string) => void;
}

/** Builds one immutable report and downloads only the explicitly selected format. */
export const exportControlExecutiveReport = async ({ format, source, renderPdf, renderDocx, save }: ControlReportExportRequest) => {
  const { buildControlExecutiveReport } = await import('./controlExecutiveReport');
  const report = buildControlExecutiveReport(source);
  const blob = format === 'pdf' ? await renderPdf(report) : await renderDocx(report);
  const filename = controlReportFilename(report, format);
  save(blob, filename);
  return { report, filename };
};
