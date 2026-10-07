import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { getDoc as firestoreGetDoc } from 'firebase/firestore';
import App from './App';
import { firebaseService } from './services/firebaseService';

let mockAuthListener: ((user: any) => void) | undefined;
let profile: any;
let mockSidebarDashboards: any[] = [];

jest.mock('./firebase', () => ({ auth: {}, db: {} }));
jest.mock('firebase/auth', () => ({
  onAuthStateChanged: jest.fn((_auth, listener) => { mockAuthListener = listener; return jest.fn(); }),
  signOut: jest.fn(), signInWithEmailAndPassword: jest.fn(), createUserWithEmailAndPassword: jest.fn(),
}));
jest.mock('firebase/firestore', () => ({ doc: jest.fn(), getDoc: jest.fn(), deleteField: jest.fn(() => 'delete'), getDocs: jest.fn().mockResolvedValue({ empty: true, docs: [] }), collection: jest.fn(), query: jest.fn(), where: jest.fn() }));
jest.mock('./services/firebaseService', () => ({ firebaseService: {
  getUsers: jest.fn().mockResolvedValue([]), getSystemSettings: jest.fn().mockResolvedValue({}),
  getDashboards: jest.fn().mockResolvedValue([]), getAllManagedClients: jest.fn().mockResolvedValue([{ clientId: 'A', displayName: 'Tenant A' }]),
  getAllClients: jest.fn().mockResolvedValue(['A']),
  subscribeToDashboardItems: jest.fn(() => jest.fn()),
} }));
jest.mock('./services/strategyService', () => ({ strategyService: Object.fromEntries(['getPerspectives','getStrategicObjectives','getAreaStrategyConfigs','getContributionObjectives','getAssignments','getRelationships'].map(key => [key,jest.fn().mockResolvedValue([])])) }));
jest.mock('./utils/exportUtils', () => ({ exportBulkDataToCSV: jest.fn() }));
jest.mock('./components/HierarchySidebar', () => { const actual=jest.requireActual('./components/HierarchySidebar'); return { HierarchySidebar:(props:any)=>{mockSidebarDashboards=props.dashboards; return React.createElement(actual.HierarchySidebar,props); } }; });
jest.mock('./components/DashboardView', () => ({ DashboardView: ({dashboard,onNavigateToControlTarget,onNavigateToKpi,onNavigateToPlan,requestedItemId,requestedActionPlanId}: any) => React.createElement('div', {'data-testid':'audit-board','data-item-target':requestedItemId == null ? '' : String(requestedItemId),'data-plan-target':requestedActionPlanId || ''}, dashboard.id,
 React.createElement('button',{onClick:()=>onNavigateToControlTarget({clientId:'LVP',dashboardId:'B1',itemId:101,period:{year:2026,frequency:'monthly',monthIndex:9},operation:'GESTIONAR',origin:'control'})},'OPEN_CONTROL_TARGET'),
 React.createElement('button',{onClick:()=>onNavigateToKpi('B1',101,'contribution')},'OPEN_STRATEGY_KPI'),
 React.createElement('button',{onClick:()=>onNavigateToPlan({dashboardId:'B1',itemId:101,source:'plans',actionPlanId:'PLAN-1',year:2026})},'OPEN_ACTION_PLAN_TARGET')) }));
jest.mock('./components/LoginScreen', () => ({ LoginScreen: () => null }));
jest.mock('./components/UserManager', () => ({ UserManager: () => null }));
jest.mock('./components/ThresholdEditor', () => ({ ThresholdEditor: () => null }));
jest.mock('./components/IndicatorManager', () => ({ IndicatorManager: () => null }));
jest.mock('./components/WeightManager', () => ({ WeightManager: () => null }));
jest.mock('./components/WeightControlCenter', () => ({ WeightControlCenter: () => null }));
jest.mock('./components/AdvancedDataImporter', () => ({ AdvancedDataImporter: () => null }));
jest.mock('./components/HelpCenter', () => ({ HelpCenter: () => null }));
jest.mock('./components/MasterTrafficLight', () => ({ MasterTrafficLight: () => null }));
jest.mock('./components/ClientSettings', () => ({ ClientSettings: () => null }));
jest.mock('./components/ControlledImporter', () => ({ ControlledImporter: () => null }));
jest.mock('./components/strategy/ContributionMatrixView', () => ({ ContributionMatrixView: () => null }));

const baseProfile = (overrides = {}) => ({
  id: 'uid-a', name: 'Runtime User', email: 'user@example.test', globalRole: 'Member', clientId: 'A', dashboardAccess: {}, ...overrides,
});

async function boot(input: { uid: string; email: string; profile: any; renderedName?: string; initialClient?: string }) {
  if (input.initialClient) localStorage.setItem('selectedClientId', input.initialClient);
  profile = input.profile;
  (firestoreGetDoc as jest.Mock).mockResolvedValue({ exists: () => true, data: () => profile });
  render(<App />);
  await act(async () => { mockAuthListener?.({ uid: input.uid, email: input.email }); });
  await waitFor(() => expect(screen.getByText(input.renderedName || 'Runtime User')).toBeInTheDocument());
}

beforeEach(() => {
  localStorage.clear(); jest.clearAllMocks(); mockAuthListener = undefined;
  (firebaseService.getDashboards as jest.Mock).mockClear();
  (firebaseService.getAllManagedClients as jest.Mock).mockResolvedValue([{ clientId: 'A', displayName: 'Tenant A' }]);
  (firebaseService.getAllClients as jest.Mock).mockResolvedValue(['A']);
});


const auditBoards = Array.from({length:4},(_,i)=>({id:'B'+(i+1),clientId:'LVP',year:2026,title:i===0?'SOSTENIBILIDAD':'Board '+(i+1),subtitle:'',group:i<2?'OPERACIONES':'FINANZAS',area:'Area '+i,thresholds:{onTrack:90,atRisk:80},items:[{id:101,indicator:'KPI '+i,unit:'%',weight:1,type:'accumulative',goalType:'maximize',frequency:'monthly',monthlyProgress:[],monthlyGoals:[]}]}));
async function setupAudit(){
 localStorage.setItem('selectedYear','2026');
 (firebaseService.getUsers as jest.Mock).mockResolvedValue([]);
 (firebaseService.getAllManagedClients as jest.Mock).mockResolvedValue([{clientId:'LVP',displayName:'LVP'}]);
 (firebaseService.getAllClients as jest.Mock).mockResolvedValue(['LVP']);
 (firebaseService.getDashboards as jest.Mock).mockImplementation(async()=>auditBoards.map(d=>({...d,items:[...d.items]})));
 const {getDocs}=require('firebase/firestore');getDocs.mockResolvedValue({empty:true,docs:[]});
 await boot({uid:'audit',email:'audit@example.test',initialClient:'LVP',profile:baseProfile({clientId:'LVP',globalRole:'Admin'})});
 await screen.findByRole('button',{name:/CONSOLIDADO/});
}
it('RUNTIME-01 baseline: fresh Consolidado selection mounts aggregate',async()=>{
 await setupAudit();fireEvent.click(screen.getByRole('button',{name:/CONSOLIDADO/}));
 expect(screen.getByTestId('audit-board')).toHaveTextContent('agg-global-total-2026');
});
it('RUNTIME-01: Consolidado resolves after a pending CONTROL target is replaced by manual intent',async()=>{
 await setupAudit();
 fireEvent.click(screen.getByRole('button',{name:/SOSTENIBILIDAD/}));
 fireEvent.click(screen.getByRole('button',{name:'OPEN_CONTROL_TARGET'}));
 expect(screen.getByTestId('audit-board')).toHaveTextContent('B1');
 fireEvent.click(screen.getByRole('button',{name:/CONSOLIDADO/}));
 const aggregateButton=screen.getByRole('button',{name:/CONSOLIDADO/});
 expect(aggregateButton.parentElement?.className).toContain('bg-rose-500/10');
 expect(mockSidebarDashboards).toContainEqual(expect.objectContaining({id:'agg-global-total-2026',clientId:'LVP',year:2026,isAggregate:true}));
 expect(screen.getByTestId('audit-board')).toHaveTextContent('agg-global-total-2026');
});
it('RUNTIME-01: CONTROL -> another physical board manually resolves that board',async()=>{
 await setupAudit();fireEvent.click(screen.getByRole('button',{name:/SOSTENIBILIDAD/}));
 fireEvent.click(screen.getByRole('button',{name:'OPEN_CONTROL_TARGET'}));
 fireEvent.click(screen.getByRole('button',{name:/Board 2/}));
 expect(screen.getByTestId('audit-board')).toHaveTextContent('B2');
});
it('CONTROL programmatic return retains its target through the destination guard',async()=>{
 await setupAudit();fireEvent.click(screen.getByRole('button',{name:/SOSTENIBILIDAD/}));
 fireEvent.click(screen.getByRole('button',{name:'OPEN_CONTROL_TARGET'}));
 fireEvent.click(screen.getByRole('button',{name:/CONSOLIDADO/}));
 fireEvent.click(screen.getByRole('button',{name:'OPEN_CONTROL_TARGET'}));
 expect(screen.getByTestId('audit-board')).toHaveTextContent('B1');
});
it('Strategy -> KPI programmatic navigation retains its requested KPI',async()=>{
 await setupAudit();fireEvent.click(screen.getByRole('button',{name:/CONSOLIDADO/}));
 fireEvent.click(screen.getByRole('button',{name:'OPEN_STRATEGY_KPI'}));
 expect(screen.getByTestId('audit-board')).toHaveTextContent('B1');
 expect(screen.getByTestId('audit-board')).toHaveAttribute('data-item-target','101');
});
it('ActionPlan programmatic navigation retains its pending plan and KPI',async()=>{
 await setupAudit();fireEvent.click(screen.getByRole('button',{name:/CONSOLIDADO/}));
 fireEvent.click(screen.getByRole('button',{name:'OPEN_ACTION_PLAN_TARGET'}));
 expect(screen.getByTestId('audit-board')).toHaveTextContent('B1');
 expect(screen.getByTestId('audit-board')).toHaveAttribute('data-item-target','101');
 expect(screen.getByTestId('audit-board')).toHaveAttribute('data-plan-target','PLAN-1');
});
