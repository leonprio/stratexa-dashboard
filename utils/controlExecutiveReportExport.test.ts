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


test.each([
  ['monthly', period, 'pdf'],
  ['monthly', period, 'docx'],
  ['weekly', { frequency: 'weekly' as const, year: 2026, weekNumber: 38 }, 'pdf'],
  ['weekly', { frequency: 'weekly' as const, year: 2026, weekNumber: 38 }, 'docx'],
] as const)('renders only %s KPIs as %s', async (frequency, selectedPeriod, format) => {
  const mixed = { ...source, scope: { ...source.scope, period: selectedPeriod, operationalPeriod: selectedPeriod }, dashboards: [{ ...source.dashboards[0], items: [
    { ...source.dashboards[0].items[0], id: 'monthly-kpi', frequency: 'monthly' as const, monthlyGoals: Object.assign(Array(12).fill(null), { 8: 100 }), monthlyProgress: Object.assign(Array(12).fill(null), { 8: 80 }) },
    { ...source.dashboards[0].items[0], id: 'weekly-kpi', frequency: 'weekly' as const, trackingStartPeriod: { frequency: 'weekly' as const, year: 2026, weekNumber: 1 }, weeklyGoals: Object.assign(Array(53).fill(null), { 37: 100 }), weeklyProgress: Object.assign(Array(53).fill(null), { 37: 80 }) },
  ] }] };
  const renderPdf = jest.fn().mockResolvedValue(new Blob(['pdf']));
  const renderDocx = jest.fn().mockResolvedValue(new Blob(['docx']));
  const save = jest.fn();
  const result = await exportControlExecutiveReport({ format, source: mixed, renderPdf, renderDocx, save });
  expect(result.report.scope.period.frequency).toBe(frequency);
  expect(result.report.results.map(row => row.identity.indicatorId)).toEqual([frequency === 'monthly' ? 'monthly-kpi' : 'weekly-kpi']);
  expect(format === 'pdf' ? renderPdf : renderDocx).toHaveBeenCalledWith(result.report);
  expect(format === 'pdf' ? renderDocx : renderPdf).not.toHaveBeenCalled();
  expect(save).toHaveBeenCalledWith(expect.any(Blob), result.filename);
});
