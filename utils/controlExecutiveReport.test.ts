import type { ActionPlan, Dashboard, DashboardItem } from '../types';
import { buildControlExecutiveReport, type ControlReportSource } from './controlExecutiveReport';

const month = (monthIndex = 8) => ({ frequency: 'monthly' as const, year: 2026, monthIndex });
const values = (value: number | null, index = 8) => Object.assign(Array(12).fill(null), { [index]: value });
const flags = (value: boolean, index = 8) => Object.assign(Array(12).fill(false), { [index]: value });
const item = (id: string, name: string, goal: number | null, progress: number | null, overrides: Partial<DashboardItem> = {}): DashboardItem => ({
  id, indicator: name, weight: 1, monthlyGoals: values(goal), monthlyProgress: values(progress),
  monthlyGoalCaptured: flags(goal !== null), monthlyProgressCaptured: flags(progress !== null),
  unit: '%', type: 'average', goalType: 'maximize', trackingStartPeriod: month(0), ...overrides,
});
const dashboard = (id: string, clientId: string, items: DashboardItem[], area = 'OPERACIONES'): Dashboard => ({
  id, clientId, title: `Tablero ${id}`, subtitle: '', area, items, thresholds: { onTrack: 95, atRisk: 85 }, periodicity: 'monthly', year: 2026,
});
const source = (dashboards: Dashboard[], changes: Partial<ControlReportSource> = {}): ControlReportSource => ({
  scope: { clientId: 'CLIENTE-A', clientName: 'Cliente A', period: month(), operationalPeriod: month(), authorizedDashboardIds: dashboards.map(d => d.id), filters: {}, filterLabels: [] },
  dashboards, generatedAt: '2026-09-25T12:00:00.000Z', ...changes,
});

describe('CONTROL executive report foundation', () => {
  it('isolates the active client even if foreign dashboards are supplied', () => {
    const report = buildControlExecutiveReport(source([dashboard('a', 'CLIENTE-A', [item('1', 'Ventas', 100, 90)]), dashboard('b', 'CLIENTE-B', [item('2', 'Ventas', 100, 10)])]));
    expect(report.results.map(row => row.identity.dashboardId)).toEqual(['a']);
  });

  it('keeps homonymous KPI separated by physical dashboard and item identity', () => {
    const report = buildControlExecutiveReport(source([dashboard('a', 'CLIENTE-A', [item('1', 'Ventas', 100, 90)]), dashboard('b', 'CLIENTE-A', [item('1', 'Ventas', 200, 100)])]));
    expect(report.results).toHaveLength(2);
    expect(report.results.map(row => `${row.identity.dashboardId}:${row.identity.indicatorId}`)).toEqual(['a:1', 'b:1']);
  });

  it('reads only the requested period and preserves explicit zero capture', () => {
    const kpi = item('1', 'Captura', 100, 0, { monthlyGoals: values(100, 7), monthlyProgress: values(0, 7), monthlyGoalCaptured: flags(true, 7), monthlyProgressCaptured: flags(true, 7) });
    const report = buildControlExecutiveReport(source([dashboard('a', 'CLIENTE-A', [kpi])], { scope: { clientId: 'CLIENTE-A', clientName: 'Cliente A', period: month(7), operationalPeriod: month(7), authorizedDashboardIds: ['a'], filters: {}, filterLabels: [] } }));
    expect(report.results[0]).toMatchObject({ goal: 100, progress: 0, pending: 100, compliance: 0 });
  });

  it('applies dashboard, area, responsible and KPI filters cumulatively', () => {
    const boards = [dashboard('a', 'CLIENTE-A', [item('1', 'Uno', 100, 90, { responsible: 'Ana' }), item('2', 'Dos', 100, 90, { responsible: 'Luis' })]), dashboard('b', 'CLIENTE-A', [item('1', 'Tres', 100, 90, { responsible: 'Ana' })], 'FINANZAS')];
    const report = buildControlExecutiveReport(source(boards, { scope: { clientId: 'CLIENTE-A', clientName: 'Cliente A', period: month(), operationalPeriod: month(), authorizedDashboardIds: ['a', 'b'], filters: { dashboardIds: ['a'], areas: ['operaciones'], responsibles: ['ana'], indicatorIds: ['1'] }, filterLabels: ['Tablero a', 'Operaciones', 'Ana'] } }));
    expect(report.results.map(row => row.indicator)).toEqual(['Uno']);
    expect(report.scope.filterLabels).toEqual(['Tablero a', 'Operaciones', 'Ana']);
  });

  it('distinguishes missing capture from a real zero', () => {
    const missing = item('missing', 'Sin captura', 100, null);
    const zero = item('zero', 'Cero real', 100, 0);
    const report = buildControlExecutiveReport(source([dashboard('a', 'CLIENTE-A', [missing, zero])]));
    expect(report.results.find(row => row.identity.indicatorId === 'missing')).toMatchObject({ progress: undefined, status: 'MISSING_CAPTURE' });
    expect(report.results.find(row => row.identity.indicatorId === 'zero')).toMatchObject({ progress: 0, pending: 100, compliance: 0, status: 'OffTrack' });
  });

  it('keeps Meta, Realizado and Pendiente coherent through canonical CONTROL values', () => {
    const report = buildControlExecutiveReport(source([dashboard('a', 'CLIENTE-A', [item('1', 'Ventas', 120, 75)])]));
    expect(report.results[0]).toMatchObject({ goal: 120, progress: 75, pending: 45, compliance: 62.5 });
  });

  it('includes only related plans already inside the authorized report scope', () => {
    const plan = (id: string, clientId: string, dashboardId: string): ActionPlan => ({ id, clientId, dashboardId, indicatorId: '1', title: id, originYear: 2026, originPeriodType: 'monthly', status: 'in_progress', startDate: '2026-09-01', progress: 50, createdAt: '', updatedAt: '' });
    const report = buildControlExecutiveReport(source([dashboard('a', 'CLIENTE-A', [item('1', 'Ventas', 100, 80)])], { actionPlans: [plan('visible', 'CLIENTE-A', 'a'), plan('foreign-client', 'CLIENTE-B', 'a'), plan('foreign-board', 'CLIENTE-A', 'b')] }));
    expect(report.followUp.relatedPlans.map(row => row.id)).toEqual(['visible']);
  });

  it('rejects a period that differs from the authorized operational period', () => {
    expect(() => buildControlExecutiveReport(source([dashboard('a', 'CLIENTE-A', [item('1', 'Ventas', 100, 80)])], { scope: { clientId: 'CLIENTE-A', clientName: 'Cliente A', period: month(7), operationalPeriod: month(8), authorizedDashboardIds: ['a'], filters: {}, filterLabels: [] } }))).toThrow(/período operativo autorizado/);
  });
});
