import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { OEDetailModal } from './OEDetailModal';
import { GlobalUserRole } from '../../types';
import { resolveStrategicKpiOwnership } from '../../strategyKpiOwnership';

jest.mock('../../services/strategyService', () => ({ strategyService: { saveDirectAssignmentsForOE: jest.fn() } }));

const item = (id: number, indicator: string) => ({ id, indicator, weight: 10, type: 'average', goalType: 'maximize', monthlyGoals: [1], monthlyProgress: [1] });
const dashboards = [
  { id: '1769440535445', title: 'Comercial y Ventas', area: 'Comercial y Ventas', items: [item(1, 'Ventas'), item(2, 'Margen de Contribución Neto'), item(3, 'Tasa de Retención de Clientes')] },
  { id: '1769440535444', title: 'Logística y Transporte', area: 'Logística y Transporte', items: [item(1, 'Cumplimiento de Entregas'), item(2, 'Costo de Flete por Tonelada'), item(3, 'Índice de Mermas en Tránsito')] },
  { id: '1769440535446', title: 'Operaciones y Almacén', area: 'Operaciones y Almacén', items: [item(1, 'Rotación de Inventario'), item(2, 'Exactitud de Inventario'), item(3, 'Días sin Accidentes Incidentes')] }
] as any;
dashboards.push({ id: 'agg-GENERAL-2026', title: 'GENERAL', isAggregate: true, items: dashboards.flatMap((d: any) => d.items.slice(0, 2).map((i: any) => ({ ...i, id: -100 - Number(i.id), indicator: `${i.indicator} (${d.area})` }))) } as any);
const objectives = ['OE01', 'OE02', 'OE03', 'OE04', 'OE05'].map(id => ({ id, code: id, title: id, perspectiveId: 'P' } as any));
const contributions = [
  { id: 'seed_sigma_oc01', displayCode: 'OCOMV01', primaryStrategicObjectiveId: 'OE01', areaName: 'Comercial y Ventas' },
  { id: 'seed_sigma_oc03', displayCode: 'OCLOGT01', primaryStrategicObjectiveId: 'OE02', areaName: 'Logística y Transporte' },
  { id: 'seed_sigma_oc05', displayCode: 'OCOPAL01', primaryStrategicObjectiveId: 'OE04', areaName: 'Operaciones y Almacén' }
] as any;
const assignments = [
  { id: 'direct', strategicObjectiveId: 'OE01', dashboardId: '1769440535445', itemId: 1 },
  { id: 'commercial', contributionObjectiveId: 'seed_sigma_oc01', dashboardId: '1769440535445', itemId: 2 },
  { id: 'logistics', contributionObjectiveId: 'seed_sigma_oc03', dashboardId: '1769440535444', itemId: 1 },
  { id: 'operations', contributionObjectiveId: 'seed_sigma_oc05', dashboardId: '1769440535446', itemId: 1 }
] as any;

it('uses the map ownership resolution to exclude all globally occupied KPI from OE03 availability', () => {
  const ownership = resolveStrategicKpiOwnership(dashboards, objectives, contributions, assignments);
  expect(ownership.occupiedCanonicalKpiIdentities.size).toBe(4);
  render(<OEDetailModal objective={objectives[2]} perspective={{ id: 'P', name: 'Procesos' } as any} allObjectives={objectives} relationships={[]} contributions={contributions} assignments={assignments} dashboards={dashboards} selectedClientId="CEMENTOS_SIGMA" currentUser={{ globalRole: GlobalUserRole.Admin } as any} onRefreshData={jest.fn()} onClose={jest.fn()} currentObjectiveAlignedKpis={ownership.kpisByStrategicObjective.get('OE03')} ownershipResolution={ownership} />);
  fireEvent.click(screen.getByRole('button', { name: 'ALINEAR INDICADORES' }));
  expect(screen.getAllByRole('checkbox')).toHaveLength(5);
  for (const occupied of ['Ventas', 'Margen de Contribución Neto', 'Cumplimiento de Entregas', 'Rotación de Inventario']) expect(screen.queryByRole('checkbox', { name: new RegExp(`^${occupied}`) })).not.toBeInTheDocument();
});
