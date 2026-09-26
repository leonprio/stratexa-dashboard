import { Packer } from 'docx';
import JSZip from 'jszip';
import type { ControlExecutiveReport, ControlReportResultRow } from './controlExecutiveReport';
import { buildExecutiveNarrative, formatControlReportDate, createControlExecutiveReportDocumentSections } from './controlExecutiveReportDocumentModel';
import { createControlExecutiveReportDocx } from './controlExecutiveReportDocx';
import { createControlExecutiveReportPdf } from './controlExecutiveReportPdf';

const monthly = { frequency: 'monthly' as const, year: 2026, monthIndex: 8 };
const weekly = { frequency: 'weekly' as const, year: 2026, weekNumber: 38 };
const row = (index: number, period: ControlExecutiveReport['cover']['period'] = monthly): ControlReportResultRow => ({
  identity: { clientId: 'CLIENTE-Ñ', dashboardId: `tablero-${index % 2}`, indicatorId: `kpi-${index}` },
  dashboard: `Tablero ${index % 2 ? 'Operación' : 'Finanzas'}`,
  area: 'OPERACIONES', responsible: 'Ana Núñez', indicator: index === 0 ? 'Índice de atención España' : `KPI ${index}`,
  unit: '%', period, goal: 100, progress: index === 1 ? 0 : 90, pending: index === 1 ? 100 : 10,
  compliance: index === 1 ? 0 : 90, status: index === 1 ? 'OffTrack' : 'AtRisk', attentionReason: index === 1 ? 'MISSING_PROGRESS' : undefined,
});

const report = (count = 2, period: ControlExecutiveReport['cover']['period'] = monthly): ControlExecutiveReport => {
  const results = Array.from({ length: count }, (_, index) => row(index, period));
  return {
    schemaVersion: '1.0', cover: { title: 'Informe ejecutivo de CONTROL', client: 'Cliente Ñandú', period, generatedAt: '2026-09-25T12:00:00.000Z', generatedBy: 'José Muñoz' },
    scope: { clientId: 'CLIENTE-Ñ', clientName: 'Cliente Ñandú', period, operationalPeriod: period, authorizedDashboardIds: ['tablero-0', 'tablero-1'], filters: { areas: ['OPERACIONES'] }, filterLabels: ['Operaciones'], includedDashboardIds: ['tablero-0', 'tablero-1'], includedIndicatorCount: count },
    executiveSummary: { totalIndicators: count, criticalIndicators: 1, attentionIndicators: count - 1, pendingConfiguration: 0, pendingCapture: 1 },
    results,
    followUp: { pendingActivities: [{ identity: { ...results[0].identity, activityId: 'a-1' }, label: 'Revisar señalización', target: 4, completed: 3, pending: 1, status: 'PENDING' }], completedActivities: [], relatedPlans: [{ id: 'p-1', dashboardId: 'tablero-0', indicatorId: 'kpi-0', title: 'Plan de acción', responsible: 'José Muñoz', status: 'in_progress', progress: 50, targetDate: '2026-10-01' }] },
    detail: [{ category: 'CONFIGURACIÓN', items: [] }, { category: 'CAPTURA', items: [results[0]] }, { category: 'RESULTADO', items: [results[1] || results[0]] }],
  };
};

describe('CONTROL executive report document renderers', () => {
  it('produces a valid A4 PDF without mutating the certified report', () => {
    const input = report(); const before = JSON.stringify(input);
    const pdf = createControlExecutiveReportPdf(input);
    const bytes = new Uint8Array(pdf.output('arraybuffer'));
    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe('%PDF');
    expect(pdf.internal.pageSize.getWidth()).toBeCloseTo(210, 0);
    expect(JSON.stringify(input)).toBe(before);
  });

  it('produces an editable DOCX package without mutating the certified report', async () => {
    const input = report(); const before = JSON.stringify(input);
    const bytes = await Packer.toBuffer(createControlExecutiveReportDocx(input));
    expect(bytes.subarray(0, 2).toString()).toBe('PK');
    expect(bytes.length).toBeGreaterThan(1000);
    expect(JSON.stringify(input)).toBe(before);
  });

  it('shares all sections and numeric values across both document formats', () => {
    const input = report(); const text = JSON.stringify(createControlExecutiveReportDocumentSections(input));
    expect(text).toContain('Cliente Ñandú');
    expect(text).toContain('Índice de atención España');
    expect(text).toContain('100 %');
    expect(text).toContain('0 %');
    expect(text).toContain('Captura requerida');
    expect(text).toContain('captura de avance');
    expect(createControlExecutiveReportPdf(input).output('arraybuffer').byteLength).toBeGreaterThan(1000);
    expect(createControlExecutiveReportDocx(input)).toBeDefined();
  });

  it('retains weekly periods, filters, plans, activities and homonymous KPI identities', () => {
    const input = report(2, weekly); const sections = createControlExecutiveReportDocumentSections(input);
    const text = JSON.stringify(sections);
    expect(text).toContain('semana 38 de 2026');
    expect(text).toContain('Filtros aplicados: Operaciones');
    expect(text).toContain('Revisar señalización');
    expect(text).toContain('Plan de acción');
    expect(input.results.map(item => `${item.identity.dashboardId}:${item.identity.indicatorId}`)).toEqual(['tablero-0:kpi-0', 'tablero-1:kpi-1']);
  });

  it.each([1, 10, 50, 100])('paginates reports with %i indicators', async count => {
    const input = report(count);
    const pdf = createControlExecutiveReportPdf(input);
    expect(pdf.getNumberOfPages()).toBeGreaterThanOrEqual(1);
    if (count === 1) expect(pdf.getNumberOfPages()).toBe(1);
    if (count >= 50) expect(pdf.getNumberOfPages()).toBeGreaterThan(1);
    expect(pdf.output('arraybuffer').byteLength).toBeGreaterThan(1000);
    if (count === 100) expect((await Packer.toBuffer(createControlExecutiveReportDocx(input))).length).toBeGreaterThan(1000);
  });
});


describe('CONTROL editorial regressions', () => {
  it('formats a calendar day without invoking a timezone conversion', () => {
    const formatter = jest.spyOn(Intl, 'DateTimeFormat');
    expect(formatControlReportDate('2026-10-15')).toBe('15 de octubre de 2026');
    expect(formatter).not.toHaveBeenCalled();
    formatter.mockRestore();
    expect(formatControlReportDate('2026-09-25T12:00:00.000Z')).toContain('2026');
  });

  it.each([1, 2])('agrees with %i pending items and plans', count => {
    const input = report(4);
    input.executiveSummary = { totalIndicators: 4, criticalIndicators: count, attentionIndicators: count, pendingConfiguration: count, pendingCapture: count };
    input.followUp.relatedPlans = Array.from({ length: count }, () => input.followUp.relatedPlans[0]);
    const text = buildExecutiveNarrative(input);
    expect(text).toContain(count === 1 ? '1 presenta una meta' : '2 presentan una meta');
    expect(text).toContain(count === 1 ? '1 tiene pendiente' : '2 tienen pendiente');
    expect(text).toContain(count === 1 ? '1 requiere atención' : '2 requieren atención');
    expect(text).toContain(count === 1 ? '1 indicador se encuentra' : '2 indicadores se encuentran');
    expect(text).toContain(count === 1 ? '1 plan de acción activo vinculado' : '2 planes de acción activos vinculados');
  });

  it('keeps four indicators and follow-up on one page without repeating result tables', () => {
    const input = report(4);
    const sections = createControlExecutiveReportDocumentSections(input);
    const text = JSON.stringify(sections);
    expect(text).not.toContain('Cliente: Cliente');
    expect(text).not.toContain('pageBreakBefore');
    expect(sections.flatMap(section => section.tables || []).filter(table => table.headers.includes('Cumplimiento'))).toHaveLength(1);
    expect(createControlExecutiveReportPdf(input).getNumberOfPages()).toBe(1);
    input.followUp = { pendingActivities: [], completedActivities: [], relatedPlans: [] };
    const empty = JSON.stringify(createControlExecutiveReportDocumentSections(input));
    expect(empty.match(/Sin actividades registradas/g)).toHaveLength(1);
    expect(empty).not.toContain('Planes relacionados');
  });

  it('wraps long names using actual height and preserves every row on PDF pages', () => {
    const input = report(30);
    input.followUp = { pendingActivities: [], completedActivities: [], relatedPlans: [] };
    input.results.forEach((row, index) => { row.indicator = 'Indicador ' + index + ' con una descripción extensa para comprobar la continuidad de las filas'; });
    const pdf = createControlExecutiveReportPdf(input);
    expect(pdf.getNumberOfPages()).toBeGreaterThan(1);
    const pages = Array.from({ length: pdf.getNumberOfPages() }, (_, index) => pdf.internal.pages[index + 1].join(' '));
    input.results.forEach((_, index) => expect(pages.filter(page => page.includes('Indicador ' + index + ' con'))).toHaveLength(1));
    pages.slice(1).forEach(page => expect(page).toContain('Cumplimiento'));
  });
});


it('keeps DOCX header with its first row without chaining all body rows', async () => {
  const zip = await JSZip.loadAsync(await Packer.toBuffer(createControlExecutiveReportDocx(report(100))));
  const xml = await zip.file('word/document.xml')!.async('string');
  const tables = [...xml.matchAll(/<w:tbl>[\s\S]*?<\/w:tbl>/g)].map(match => match[0]);
  for (const table of tables) {
    const rows = [...table.matchAll(/<w:tr>[\s\S]*?<\/w:tr>/g)].map(match => match[0]);
    expect(rows[0]).toContain('<w:tblHeader/>');
    expect(rows[0]).toContain('<w:keepNext/>');
    for (const row of rows.slice(1)) {
      expect(row).toContain('<w:cantSplit/>');
      expect(row).not.toContain('<w:keepNext/>');
    }
  }
  expect(xml).not.toContain('w:type="page"');
});
