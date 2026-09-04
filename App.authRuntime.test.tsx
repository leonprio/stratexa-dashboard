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
jest.mock('firebase/firestore', () => ({ doc: jest.fn(), getDoc: jest.fn(), deleteField: jest.fn(() => 'delete') }));
jest.mock('./services/firebaseService', () => ({ firebaseService: {
  getUsers: jest.fn().mockResolvedValue([]), getSystemSettings: jest.fn().mockResolvedValue({}),
  getDashboards: jest.fn().mockResolvedValue([]), getAllManagedClients: jest.fn().mockResolvedValue([{ clientId: 'A', displayName: 'Tenant A' }]),
  getAllClients: jest.fn().mockResolvedValue(['A']),
  subscribeToDashboardItems: jest.fn(() => jest.fn()),
} }));
jest.mock('./services/strategyService', () => ({ strategyService: {} }));
jest.mock('./utils/exportUtils', () => ({ exportBulkDataToCSV: jest.fn() }));
jest.mock('./components/HierarchySidebar', () => ({ HierarchySidebar: () => null }));
jest.mock('./components/DashboardView', () => ({ DashboardView: () => null }));
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

describe('authenticated app shell runtime bridge', () => {
  it.each([
    ['standard_user', baseProfile()],
    ['director legacy', baseProfile({ globalRole: 'Director', directorTitle: 'OPERACIONES', subGroups: ['OPERACIONES'] })],
    ['director canonical', baseProfile({ globalRole: 'Director', memberships: [{ clientId: 'A', role: 'director', status: 'active', hierarchyScopes: ['OPERACIONES'], dashboardScopes: {} }] })],
    ['tenant_admin', baseProfile({ globalRole: 'Admin' })],
  ])('boots %s without a global dashboard query', async (_role, runtimeProfile) => {
    await boot({ uid: 'uid-a', email: 'user@example.test', profile: runtimeProfile });
    await waitFor(() => expect(firebaseService.getDashboards).toHaveBeenCalledWith('A', expect.any(Number)));
    expect((firebaseService.getDashboards as jest.Mock).mock.calls.some(([client]) => client === undefined)).toBe(false);
  });

  it('uses exact platform bridge: a substring email is not platform authority', async () => {
    await boot({ uid: 'uid-a', email: 'not-leonprior@gmail.com.example', profile: baseProfile() });
    await waitFor(() => expect(firebaseService.getDashboards).toHaveBeenCalledWith('A', expect.any(Number)));
  });

  it('boots exact platform authority through an explicit selected-client path without an IPS membership', async () => {
    await boot({ uid: 'platform', email: 'leon@leonprior.com', profile: baseProfile({ clientId: undefined }), renderedName: 'Leon Prior', initialClient: 'A' });
    await waitFor(() => expect(firebaseService.getDashboards).toHaveBeenCalledWith('A', expect.any(Number)));
    expect(firebaseService.getSystemSettings).toHaveBeenCalledWith('A');
  });

  it('boots a multi-client profile with one authorized tenant query, never a global dashboard query', async () => {
    await boot({ uid: 'multi', email: 'multi@example.test', profile: baseProfile({
      id: 'multi', clientId: 'A,B', memberships: [
        { clientId: 'A', role: 'standard_user', status: 'active', dashboardScopes: {} },
        { clientId: 'B', role: 'standard_user', status: 'active', dashboardScopes: {} },
      ],
    }) });
    await waitFor(() => expect(firebaseService.getDashboards).toHaveBeenCalledWith('A', expect.any(Number)));
    expect((firebaseService.getDashboards as jest.Mock).mock.calls.some(([client]) => client === undefined || client === 'C')).toBe(false);
  });

  it('switches a multi-client user from A to B through the visible selector', async () => {
    (firebaseService.getAllManagedClients as jest.Mock).mockResolvedValue([
      { clientId: 'A', displayName: 'Tenant A' },
      { clientId: 'B', displayName: 'Tenant B' },
    ]);
    (firebaseService.getAllClients as jest.Mock).mockResolvedValue(['A', 'B']);
    (firebaseService.getDashboards as jest.Mock).mockImplementation(async (client: string) => ([
      { id: `${client}-dashboard`, clientId: client, name: `${client} Dashboard`, year: 2026 },
    ]));
    await boot({ uid: 'multi', email: 'multi@example.test', initialClient: 'A', profile: baseProfile({
      id: 'multi', clientId: 'A,B', memberships: [
        { clientId: 'A', role: 'standard_user', status: 'active', dashboardScopes: {} },
        { clientId: 'B', role: 'standard_user', status: 'active', dashboardScopes: {} },
      ],
    }) });
    const selector = screen.getAllByRole('combobox')[1];
    expect(selector).toHaveValue('A');
    await act(async () => { fireEvent.change(selector, { target: { value: 'B' } }); });
    await waitFor(() => expect(firebaseService.getDashboards).toHaveBeenCalledWith('B', expect.any(Number)));
    expect((firebaseService.getDashboards as jest.Mock).mock.calls.some(([client]) => client === undefined || client === 'C')).toBe(false);
    expect(localStorage.getItem('selectedClientId')).toBe('B');
  });

});
