import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Dashboard } from '../../types';
import { ControlReportExport } from './ControlReportExport';
import { exportControlExecutiveReport } from '../../utils/controlExecutiveReportExport';

jest.mock('../../utils/controlExecutiveReportExport', () => ({ exportControlExecutiveReport: jest.fn() }));
jest.mock('file-saver', () => ({ saveAs: jest.fn() }));

const board = { id: 'board-a', clientId: 'LAB-A', title: 'Tablero A', subtitle: '', area: 'OPERACIONES', thresholds: { onTrack: 95, atRisk: 85 }, periodicity: 'monthly', items: [{ id: 'kpi-a', indicator: 'Señalización', frequency: 'monthly' }] } as Dashboard;
const period = { frequency: 'monthly' as const, year: 2026, monthIndex: 8 };

beforeEach(() => jest.clearAllMocks());

it('loads related plans before sending one selected format to the export adapter', async () => {
  const loadActionPlans = jest.fn().mockResolvedValue([{ id: 'plan-a', clientId: 'LAB-A', dashboardId: 'board-a', indicatorId: 'kpi-a' }]);
  (exportControlExecutiveReport as jest.Mock).mockResolvedValue({});
  render(<ControlReportExport clientId="LAB-A" clientName="Cliente A" dashboards={[board]} period={period} filters={{ areas: ['OPERACIONES'] }} filterLabels={['Área: OPERACIONES']} loadActionPlans={loadActionPlans} />);
  fireEvent.click(screen.getByRole('button', { name: 'Exportar informe' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Descargar PDF' }));
  await waitFor(() => expect(exportControlExecutiveReport).toHaveBeenCalledTimes(1));
  expect(loadActionPlans).toHaveBeenCalledWith([board]);
  expect((exportControlExecutiveReport as jest.Mock).mock.calls[0][0]).toMatchObject({ format: 'pdf', source: { actionPlans: [{ id: 'plan-a' }], scope: { clientId: 'LAB-A', filters: { areas: ['OPERACIONES'] }, filterLabels: ['Área: OPERACIONES'] } } });
});

it('blocks mixed clients and reports asynchronous plan errors without downloading', async () => {
  const mixed = { ...board, clientId: 'LAB-B' };
  const loadActionPlans = jest.fn().mockRejectedValue(new Error('offline'));
  const { rerender } = render(<ControlReportExport clientId="LAB-A" clientName="Cliente A" dashboards={[board, mixed]} period={period} filters={{}} filterLabels={[]} loadActionPlans={loadActionPlans} />);
  expect(screen.getByRole('button', { name: 'Exportar informe' })).toBeDisabled();
  expect(exportControlExecutiveReport).not.toHaveBeenCalled();
  rerender(<ControlReportExport clientId="LAB-A" clientName="Cliente A" dashboards={[board]} period={period} filters={{}} filterLabels={[]} loadActionPlans={loadActionPlans} />);
  fireEvent.click(screen.getByRole('button', { name: 'Exportar informe' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Descargar Word' }));
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('No fue posible generar'));
  expect(exportControlExecutiveReport).not.toHaveBeenCalled();
});


test.each([
  ['monthly', period, 'pdf', 'Descargar PDF'],
  ['monthly', period, 'docx', 'Descargar Word'],
  ['weekly', { frequency: 'weekly' as const, year: 2026, weekNumber: 39 }, 'pdf', 'Descargar PDF'],
  ['weekly', { frequency: 'weekly' as const, year: 2026, weekNumber: 39 }, 'docx', 'Descargar Word'],
] as const)('enables %s mixed-board %s export and passes its period and format', async (_frequency, selectedPeriod, format, menuItem) => {
  const mixedBoard = { ...board, items: [...board.items, { id: 'weekly-kpi', indicator: 'Escuelas activas', frequency: 'weekly' }] } as Dashboard;
  (exportControlExecutiveReport as jest.Mock).mockResolvedValue({});
  const loadActionPlans = jest.fn().mockResolvedValue([]);
  render(<ControlReportExport clientId="LAB-A" clientName="Cliente A" dashboards={[mixedBoard]} period={selectedPeriod} filters={{}} filterLabels={[]} loadActionPlans={loadActionPlans} />);
  fireEvent.click(screen.getByRole('button', { name: 'Exportar informe' }));
  fireEvent.click(screen.getByRole('menuitem', { name: menuItem }));
  await waitFor(() => expect(exportControlExecutiveReport).toHaveBeenCalledTimes(1));
  expect((exportControlExecutiveReport as jest.Mock).mock.calls[0][0]).toMatchObject({ format, source: { scope: { period: selectedPeriod, operationalPeriod: selectedPeriod }, dashboards: [mixedBoard] } });
  expect(loadActionPlans).toHaveBeenCalledWith([mixedBoard]);
});

test.each([
  ['only other frequency', [{ ...board, items: [{ ...board.items[0], frequency: 'weekly' }] }], period, 'LAB-A'],
  ['no dashboards', [], period, 'LAB-A'],
  ['empty KPI list', [{ ...board, items: [] }], period, 'LAB-A'],
  ['empty client', [board], period, ''],
] as const)('keeps %s non-exportable', (_label, dashboards, selectedPeriod, clientId) => {
  render(<ControlReportExport clientId={clientId} clientName="Cliente A" dashboards={dashboards as unknown as Dashboard[]} period={selectedPeriod} filters={{}} filterLabels={[]} loadActionPlans={jest.fn()} />);
  expect(screen.getByRole('button', { name: 'Exportar informe' })).toBeDisabled();
});
