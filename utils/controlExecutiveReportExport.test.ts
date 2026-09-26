import type { ControlReportSource } from './controlExecutiveReport';
import { controlReportFilename, exportControlExecutiveReport } from './controlExecutiveReportExport';

const period = { frequency: 'monthly' as const, year: 2026, monthIndex: 8 };
const source: ControlReportSource = {
  scope: { clientId: 'LAB-A', clientName: 'Cliente Ñandú', period, operationalPeriod: period, authorizedDashboardIds: ['a'], filters: {}, filterLabels: [] },
  dashboards: [{ id: 'a', clientId: 'LAB-A', title: 'Tablero A', subtitle: '', area: 'OPERACIONES', periodicity: 'monthly', thresholds: { onTrack: 95, atRisk: 85 }, items: [{ id: 'kpi', indicator: 'Atención', weight: 1, monthlyGoals: Array.from({ length: 12 }, (_, i) => i === 8 ? 100 : null), monthlyProgress: Array.from({ length: 12 }, (_, i) => i === 8 ? 0 : null), monthlyGoalCaptured: Array.from({ length: 12 }, (_, i) => i === 8), monthlyProgressCaptured: Array.from({ length: 12 }, (_, i) => i === 8), unit: '%', type: 'average', goalType: 'maximize', trackingStartPeriod: { frequency: 'monthly', year: 2026, monthIndex: 0 } }] }],
  generatedAt: '2026-09-25T12:00:00.000Z',
};

it('downloads only the requested format with a safe client and period name, preserving source data', async () => {
  const original = JSON.stringify(source);
  const renderPdf = jest.fn().mockResolvedValue(new Blob(['pdf']));
  const renderDocx = jest.fn().mockResolvedValue(new Blob(['docx']));
  const save = jest.fn();
  const result = await exportControlExecutiveReport({ format: 'pdf', source, renderPdf, renderDocx, save });
  expect(renderPdf).toHaveBeenCalledTimes(1);
  expect(renderDocx).not.toHaveBeenCalled();
  expect(result.filename).toBe('informe_CONTROL_Cliente_Nandu_2026-09.pdf');
  expect(save).toHaveBeenCalledWith(expect.any(Blob), result.filename);
  expect(result.report.results[0]).toMatchObject({ goal: 100, progress: 0, pending: 100 });
  expect(JSON.stringify(source)).toBe(original);
  expect(controlReportFilename({ ...result.report, cover: { ...result.report.cover, period: { frequency: 'weekly', year: 2026, weekNumber: 39 } } }, 'docx')).toBe('informe_CONTROL_Cliente_Nandu_2026-S39.docx');
});
