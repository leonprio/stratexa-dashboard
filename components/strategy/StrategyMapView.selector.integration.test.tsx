import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { StrategyMapView } from './StrategyMapView';
import { GlobalUserRole } from '../../types';

jest.mock('../../services/strategyService', () => ({ strategyService: { saveDirectAssignmentsForOE: jest.fn() } }));
(global as any).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };

const item = (id: string, indicator: string) => ({ id, indicator, weight: 100, monthlyGoals: [1], monthlyProgress: [1], unit: 'u', type: 'accumulative', goalType: 'maximize' });

it('uses map-displayed ownership to exclude occupied KPIs from OE04 selector', () => {
  const objectives = ['OE01', 'OE02', 'OE03', 'OE04'].map((id, i) => ({ id, code: id, title: `Objetivo ${id}`, perspectiveId: 'FIN', order: i + 1, clientId: 'LEÓN' })) as any;
  const dashboard = { id: 'd', title: 'Operativo', items: [item('income', 'INGRESOS'), item('advisory', 'NUEVAS ASESORÍAS'), item('prospects', 'PROSPECTOS CONTACTADOS'), item('activities', 'ACTIVIDADES ESTRATÉGICAS'), item('apps', 'APLICACIONES DESARROLLADAS')] } as any;
  const assignments = [{ id: 'a1', strategicObjectiveId: 'OE01', dashboardId: 'd', itemId: 'income', clientId: 'LEÓN' }, { id: 'a2', strategicObjectiveId: 'OE02', dashboardId: 'd', itemId: 'advisory', clientId: 'LEÓN' }, { id: 'a3', strategicObjectiveId: 'OE03', dashboardId: 'd', itemId: 'prospects', clientId: 'LEÓN' }] as any;
  render(<StrategyMapView perspectives={[{ id: 'FIN', name: 'Financiera', color: '#000', order: 1 } as any]} objectives={objectives} assignments={assignments} dashboards={[dashboard]} selectedClientId="LEÓN" isAdmin currentUser={{ globalRole: GlobalUserRole.Admin } as any} onRefreshData={jest.fn()} />);
  expect(screen.getByText('INGRESOS')).toBeInTheDocument();
  fireEvent.click(screen.getByText('Objetivo OE04'));
  fireEvent.click(screen.getByRole('button', { name: 'ALINEAR INDICADORES' }));
  const available = screen.getByText('INDICADORES DISPONIBLES PARA ALINEAR').parentElement!;
  expect(within(available).queryByText('INGRESOS')).not.toBeInTheDocument();
  expect(within(available).queryByText('NUEVAS ASESORÍAS')).not.toBeInTheDocument();
  expect(within(available).queryByText('PROSPECTOS CONTACTADOS')).not.toBeInTheDocument();
  expect(within(available).getByText('ACTIVIDADES ESTRATÉGICAS')).toBeInTheDocument();
  expect(within(available).getByText('APLICACIONES DESARROLLADAS')).toBeInTheDocument();
  expect(screen.getByText('ERRORES ocupados-pero-disponibles').nextSibling).toHaveTextContent('0');
});
