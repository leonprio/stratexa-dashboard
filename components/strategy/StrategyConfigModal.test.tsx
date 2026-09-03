import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { StrategyConfigModal } from './StrategyConfigModal';
import { strategyService } from '../../services/strategyService';
import { GlobalUserRole } from '../../types';
jest.mock('../../services/strategyService',()=>({strategyService:{getAssignments:jest.fn(),saveAssignmentsForOC:jest.fn(),saveContributionObjective:jest.fn()}}));
const direct = {id:'direct',clientId:'CLIENT',dashboardId:100,itemId:1,strategicObjectiveId:'oe'};
function mount() {
  const refresh=jest.fn().mockResolvedValue(undefined);
  render(<StrategyConfigModal perspectives={[]} objectives={[{id:'oe',code:'OE01',title:'OE'}] as any} areaConfigs={[]} contributionObjectives={[{id:'oc',clientId:'CLIENT',displayCode:'OC01',areaName:'OPERACIONES',primaryStrategicObjectiveId:'oe',title:'OC'}] as any} assignments={[direct]} dashboards={[{id:100,clientId:'CLIENT',year:2026,area:'OPERACIONES',title:'Operativo',items:[{id:1,indicator:'Exactitud de Inventario'}]}] as any} selectedClientId="CLIENT" currentUser={{globalRole:GlobalUserRole.Admin} as any} onClose={()=>{}} onRefreshData={refresh} initialSection="contributionObjectives" />);
  return refresh;
}
beforeEach(()=>{jest.resetAllMocks();(strategyService.getAssignments as jest.Mock).mockResolvedValue([direct]);(strategyService.saveAssignmentsForOC as jest.Mock).mockResolvedValue(true);});
it('exposes DIRECT, submits physical identity and awaits refresh without rewriting OC',async()=>{
  const refresh=mount();
  fireEvent.click(screen.getByTitle('Editar OC'));
  const candidate=await screen.findByRole('checkbox',{name:/Exactitud de Inventario/});
  fireEvent.click(candidate);
  fireEvent.click(screen.getByRole('button',{name:'Guardar cambios y asignaciones'}));
  await waitFor(()=>expect(refresh).toHaveBeenCalledTimes(1));
  expect(strategyService.saveAssignmentsForOC).toHaveBeenCalledWith('oc',[expect.objectContaining({dashboardId:100,itemId:1,year:2026})],'CLIENT',{expectedAssignments:[]});
  expect(strategyService.saveContributionObjective).not.toHaveBeenCalled();
});
it('keeps the form and reports failed persisted verification without success',async()=>{
  (strategyService.saveAssignmentsForOC as jest.Mock).mockRejectedValue(new Error('Lectura persistida incompatible'));
  const refresh=mount();fireEvent.click(screen.getByTitle('Editar OC'));
  fireEvent.click(await screen.findByRole('checkbox',{name:/Exactitud de Inventario/}));
  fireEvent.click(screen.getByRole('button',{name:'Guardar cambios y asignaciones'}));
  expect(await screen.findByText('Lectura persistida incompatible')).toBeTruthy();
  expect(refresh).not.toHaveBeenCalled();expect(strategyService.saveContributionObjective).not.toHaveBeenCalled();
  expect(screen.getByRole('button',{name:'Guardar cambios y asignaciones'})).toBeTruthy();
});
