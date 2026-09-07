import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { OEDetailModal } from './OEDetailModal';
import { GlobalUserRole } from '../../types';
import { resolveStrategicKpiOwnership } from '../../strategyKpiOwnership';

jest.mock('../../services/strategyService', () => ({ strategyService: { saveDirectAssignmentsForOE: jest.fn() } }));

const kpi = (id: string, indicator: string) => ({ id, indicator, weight: 100, monthlyGoals: [1], monthlyProgress: [1], unit: 'u', type: 'accumulative', goalType: 'maximize' });

it('renders only physically and canonically free KPIs as available', () => {
  const dashboard = { id: 'd', title: 'Operativo', items: [kpi('income', 'INGRESOS'), kpi('prospects', 'PROSPECTOS CONTACTADOS'), kpi('apps', 'APLICACIONES DESARROLLADAS'), kpi('activities', 'ACTIVIDADES ESTRATÉGICAS')] } as any;
  const summary = { id: 'summary', title: 'Resumen', items: [{ ...kpi('income-copy', 'INGRESOS'), semanticKey: 'income' }] } as any;
  dashboard.items[0].semanticKey = 'income';
  const objectives = [{ id: 'OE01', code: 'OE01', title: 'OE01', perspectiveId: 'FIN' }, { id: 'OE03', code: 'OE03', title: 'OE03', perspectiveId: 'FIN' }] as any;
  const assignments = [{ id: 'a1', strategicObjectiveId: 'OE01', dashboardId: 'd', itemId: 'income', clientId: 'LEÓN' }, { id: 'a3', strategicObjectiveId: 'OE03', dashboardId: 'd', itemId: 'prospects', clientId: 'LEÓN' }] as any;
  const ownership = resolveStrategicKpiOwnership([dashboard, summary], objectives, [], assignments);
  render(<OEDetailModal objective={objectives[1]} perspective={{ id: 'FIN', name: 'Fin' } as any} allObjectives={objectives} relationships={[]} contributions={[]} assignments={assignments} dashboards={[dashboard, summary]} selectedClientId="LEÓN" currentUser={{ globalRole: GlobalUserRole.Admin } as any} onRefreshData={jest.fn()} onClose={jest.fn()} currentObjectiveAlignedKpis={ownership.kpisByStrategicObjective.get('OE03')} occupiedKpiIdentities={ownership.occupiedCanonicalKpiIdentities} occupiedPhysicalKpiKeys={ownership.occupiedPhysicalKpiKeys} />);
  fireEvent.click(screen.getByRole('button', { name: 'ALINEAR INDICADORES' }));
  const aligned = screen.getByText('YA ALINEADOS CON OE03').parentElement!;
  const available = screen.getByText('INDICADORES DISPONIBLES PARA ALINEAR').parentElement!;
  expect(within(aligned).getByText('PROSPECTOS CONTACTADOS')).toBeInTheDocument();
  expect(within(available).queryByText('INGRESOS')).not.toBeInTheDocument();
  expect(within(available).getByText('APLICACIONES DESARROLLADAS')).toBeInTheDocument();
  expect(within(available).getByText('ACTIVIDADES ESTRATÉGICAS')).toBeInTheDocument();
});

it('does not expose duplicate aggregate aliases when all ten LVP KPI are assigned', () => {
  const labels = [
    'DIOCESIS CON COORDINACION ACTIVA', 'LIDERAZGOS JUVENILES ACTIVOS',
    'LAICOS CON PARTICIPACION PUBLICA VERIFICABLE', 'PARTICIPANTES FORMADOS EN PSC',
    'ACCIONES CONJUNTAS DE ARTICULACION', 'JOVENES EN RUTA ACTIVA DE LIDERAZGO',
    'COMPROMISOS ESTRATEGICOS CUMPLIDOS', 'INDICE DE IDENTIDAD LAICAL PSC',
    'ALIANZAS ACTIVAS', 'NODOS ACTIVOS',
  ];
  const dashboard = { id: 'lvp-operativo', title: 'Impacto y Valor', area: 'Impacto y Valor', items: labels.map((label, index) => kpi(String(index + 1), label)) } as any;
  const summary = { id: 'agg-GENERAL-2026', title: 'Consolidado', area: 'Sostenibilidad', isAggregate: true, items: labels.map((label, index) => kpi(String(-100 - index), `${label} (RESONANCIA CIUDADANA) (Sostenibilidad)`)) } as any;
  const objective = { id: 'OE01', code: 'OE01', title: 'OE01', perspectiveId: 'FIN' } as any;
  const assignments = labels.map((_, index) => ({ id: `a${index}`, strategicObjectiveId: 'OE01', dashboardId: 'lvp-operativo', itemId: String(index + 1), clientId: 'LVP' })) as any;
  const ownership = resolveStrategicKpiOwnership([dashboard, summary], [objective], [], assignments);
  render(<OEDetailModal objective={objective} perspective={{ id: 'FIN', name: 'Fin' } as any} allObjectives={[objective]} relationships={[]} contributions={[]} assignments={assignments} dashboards={[dashboard, summary]} selectedClientId="LVP" currentUser={{ globalRole: GlobalUserRole.Admin } as any} onRefreshData={jest.fn()} onClose={jest.fn()} currentObjectiveAlignedKpis={ownership.kpisByStrategicObjective.get('OE01')} occupiedKpiIdentities={ownership.occupiedCanonicalKpiIdentities} occupiedPhysicalKpiKeys={ownership.occupiedPhysicalKpiKeys} />);
  fireEvent.click(screen.getByRole('button', { name: 'ALINEAR INDICADORES' }));
  const available = screen.getByText('INDICADORES DISPONIBLES PARA ALINEAR').parentElement!;
  expect(within(available).queryAllByRole('checkbox')).toHaveLength(0);
});
