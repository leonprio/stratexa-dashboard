import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { getDoc as firestoreGetDoc } from 'firebase/firestore';
import App from './App';
import { firebaseService } from './services/firebaseService';

let mockAuthListener: ((user: any) => void) | undefined;
let profile: any;

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
jest.mock('./components/HierarchySidebar', () => ({ HierarchySidebar: ({dashboards}: any) => React.createElement('div', {'data-testid':'accessible-boards'}, dashboards.map((d:any)=>d.id).join(',')) }));
jest.mock('./components/DashboardView', () => ({ DashboardView: ({ dashboard, userRole }: any) => React.createElement('div', { 'data-testid': 'audit-board', 'data-role': userRole }, dashboard.id) }));
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

test.each(['legacy', 'canonical', 'canonical_no_legacy', 'denied', 'suspended', 'foreign'])('H01 %s viewer scope', async kind => {
 const board = { id: 'D1', clientId: 'A', title: 'Authorized board', subtitle: '', year: new Date().getFullYear(), group: 'GENERAL', area: 'OPS', thresholds: { onTrack: 90, atRisk: 80 }, items: [] };
 (firebaseService.getDashboards as jest.Mock).mockResolvedValue([board, {...board,id:'D2'}, {...board,id:'D1-B',clientId:'B'}]);
 const records = kind === 'legacy' ? [] : [{ userId: kind==='foreign'?'other':'uid-a', clientId: 'A', role: 'standard_user', status: kind==='suspended'?'suspended':'active', scopeType: 'dashboard', allowedDashboardIds: kind==='denied'?[]:['D1'], editableDashboardIds: [], hierarchyScopeKeys: [], capabilities: ['viewer'] }];
 const { getDocs } = require('firebase/firestore');
 getDocs.mockResolvedValue({ empty: records.length===0, docs: records.map(data=>({data:()=>data})) });
 await boot({uid:'uid-a',email:'user@example.test',profile:baseProfile({clientId:kind==='canonical_no_legacy'?'': 'A',dashboardAccess:kind==='legacy'||kind==='suspended'?{D1:'Viewer'}:{}})});
 if(kind==='legacy'||kind.startsWith('canonical')) { expect(await screen.findByTestId('audit-board')).toHaveTextContent('D1'); expect(screen.getByTestId('audit-board')).toHaveAttribute('data-role','Viewer'); expect(screen.getByTestId('accessible-boards')).not.toHaveTextContent('D2'); expect(screen.getByTestId('accessible-boards')).not.toHaveTextContent('D1-B'); }
 else { expect(await screen.findByText(/Sin tableros en/)).toBeInTheDocument(); expect(screen.queryByTestId('audit-board')).not.toBeInTheDocument(); }
});

test.each(['tenant_admin','standard_user','suspended'])('H02 App strategy entry %s', async role => {
 (firebaseService.getSystemSettings as jest.Mock).mockResolvedValue({enableStrategyMap:true});
 const {getDocs}=require('firebase/firestore');const record={userId:'uid-a',clientId:'A',role:role==='suspended'?'tenant_admin':role,status:role==='suspended'?'suspended':'active',scopeType:'tenant',allowedDashboardIds:[],capabilities:[]};
 getDocs.mockResolvedValue({empty:false,docs:[{data:()=>record}]});
 await boot({uid:'uid-a',email:'user@example.test',profile:baseProfile()});
 if(role==='tenant_admin') { expect(await screen.findByRole('button',{name:'Estrategia'})).toBeInTheDocument(); expect(screen.queryByRole('button',{name:'KPIs'})).not.toBeInTheDocument(); }
 else expect(screen.queryByRole('button',{name:'Estrategia'})).not.toBeInTheDocument();
});
