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
