import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { getDoc as firestoreGetDoc } from 'firebase/firestore';
import App from './App';
import { GlobalUserRole, type User } from './types';
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
jest.mock('./services/strategyService', () => ({ strategyService: {} }));
jest.mock('./utils/exportUtils', () => ({ exportBulkDataToCSV: jest.fn() }));
jest.mock('./components/HierarchySidebar', () => ({ HierarchySidebar: ({dashboards,onSelectDashboard}: any) => React.createElement('div', {}, dashboards.map((d:any)=>React.createElement('button',{key:d.id,onClick:()=>onSelectDashboard(d.id)},d.title))) }));
jest.mock('./components/DashboardView', () => ({ DashboardView: ({dashboard, userRole}: any) => React.createElement('div', {'data-testid':'effective-dashboard', 'data-role':userRole}, dashboard.id) }));
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

const baseProfile = (overrides: Partial<User> = {}): User => ({
  id: 'uid-a', name: 'Runtime User', email: 'user@example.test', globalRole: GlobalUserRole.Member, clientId: 'A', dashboardAccess: {}, ...overrides,
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


import { canAccessDashboard, canEditActionPlan } from './services/tableroAuthorization';
const board = (client: string) => ({ id: `${client}-board`, clientId: client, title: `Board ${client}`, group: 'OPERACIONES', year: 2026, items: [] });
beforeEach(() => { localStorage.setItem('selectedYear', '2026');
  (firebaseService.getUsers as jest.Mock).mockResolvedValue([]);
  (firebaseService.getSystemSettings as jest.Mock).mockResolvedValue({});
  (firebaseService.getAllManagedClients as jest.Mock).mockResolvedValue([{clientId:'A',displayName:'Tenant A'},{clientId:'B',displayName:'Tenant B'}]);
});
it('legacy Director effective App Editor shares dashboard and ActionPlan authority', async () => {
  const legacyDirector = baseProfile({globalRole:GlobalUserRole.Director,directorTitle:'OPERACIONES',clientId:'A',dashboardAccess:{}});
  (firebaseService.getDashboards as jest.Mock).mockResolvedValue([board('A')]);
  await boot({uid:'director',email:'director@example.test',profile:legacyDirector});
  fireEvent.click(await screen.findByRole('button',{name:'Board A'})); expect(screen.getByTestId('effective-dashboard')).toHaveAttribute('data-role','Editor');
  expect(canAccessDashboard(legacyDirector,board('A'), 'editor')).toBe(true);
  expect(canEditActionPlan(legacyDirector,board('A'))).toBe(true);
});
