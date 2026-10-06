import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { getDoc as firestoreGetDoc, getDocs as firestoreGetDocs } from 'firebase/firestore';
import App from './App';
import { firebaseService } from './services/firebaseService';

let mockAuthListener: ((user: any) => void) | undefined;

jest.mock('./firebase', () => ({ auth: {}, db: {} }));
jest.mock('firebase/auth', () => ({
  onAuthStateChanged: jest.fn((_auth, listener) => { mockAuthListener = listener; return jest.fn(); }),
  signOut: jest.fn(), signInWithEmailAndPassword: jest.fn(), createUserWithEmailAndPassword: jest.fn(),
}));
jest.mock('firebase/firestore', () => ({
  doc: jest.fn(), getDoc: jest.fn(), getDocs: jest.fn().mockResolvedValue({ empty: true, docs: [] }),
  deleteField: jest.fn(() => 'delete'), collection: jest.fn(), query: jest.fn(), where: jest.fn(),
}));
jest.mock('./services/firebaseService', () => ({ firebaseService: {
  getUsers: jest.fn().mockResolvedValue([]), getSystemSettings: jest.fn().mockResolvedValue({ enableStrategyMap: true }),
  getDashboards: jest.fn().mockResolvedValue([]), getAllManagedClients: jest.fn().mockResolvedValue([{ clientId: 'A', displayName: 'Tenant A' }]),
  getAllClients: jest.fn().mockResolvedValue(['A']), subscribeToDashboardItems: jest.fn(() => jest.fn()),
} }));
jest.mock('./services/strategyService', () => ({ strategyService: Object.fromEntries(
  ['getPerspectives', 'getStrategicObjectives', 'getAreaConfigs', 'getAreaStrategyConfigs', 'getContributionObjectives', 'getAssignments', 'getRelationships', 'getStrategicObjectiveRelationships']
    .map(key => [key, jest.fn().mockResolvedValue([])]),
) }));
jest.mock('./utils/exportUtils', () => ({ exportBulkDataToCSV: jest.fn() }));
jest.mock('./components/HierarchySidebar', () => ({ HierarchySidebar: () => null }));
jest.mock('./components/DashboardView', () => ({ DashboardView: ({ dashboard, requestedItemId, requestedNavigationSource }: any) =>
  React.createElement('div', {
    'data-testid': 'strategy-navigation-destination',
    'data-dashboard-id': String(dashboard.id),
    'data-item-id': requestedItemId == null ? '' : String(requestedItemId),
    'data-navigation-source': requestedNavigationSource || '',
  }),
}));
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
jest.mock('./components/strategy/ContributionMatrixView', () => ({ ContributionMatrixView: ({ onNavigateToDashboard }: any) =>
  React.createElement('div', { 'data-testid': 'strategy-matrix' },
    React.createElement('button', { onClick: () => onNavigateToDashboard('D1', 'KPI-A') }, 'Navigate KPI A'),
    React.createElement('button', { onClick: () => onNavigateToDashboard('D1', 'KPI-B') }, 'Navigate KPI B'),
    React.createElement('button', { onClick: () => onNavigateToDashboard('D1', undefined) }, 'Navigate without item'),
    React.createElement('button', { onClick: () => onNavigateToDashboard('D2', 'FOREIGN-KPI') }, 'Navigate foreign KPI'),
  ),
}));

const profile = { id: 'uid-a', name: 'Runtime User', email: 'user@example.test', globalRole: 'Admin', clientId: 'A', dashboardAccess: {} };
const board = (id: string, clientId: string, itemIds: string[]) => ({
  id, clientId, title: `Board ${id}`, subtitle: '', year: new Date().getFullYear(), group: 'GENERAL', area: 'OPS',
  thresholds: { onTrack: 90, atRisk: 80 }, items: itemIds.map(itemId => ({ id: itemId, indicator: itemId })),
});

async function boot() {
  localStorage.setItem('selectedClientId', 'A');
  localStorage.setItem('selectedDashboardId', 'D1');
  (firestoreGetDoc as jest.Mock).mockResolvedValue({ exists: () => true, data: () => profile });
  render(<App />);
  await act(async () => { mockAuthListener?.({ uid: 'uid-a', email: profile.email }); });
  await screen.findByText('Runtime User');
  await screen.findByTestId('strategy-navigation-destination');
}

async function openStrategy() {
  if (!screen.queryByTestId('strategy-matrix')) fireEvent.click(screen.getByRole('button', { name: 'Estrategia' }));
  await screen.findByTestId('strategy-matrix');
}

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
  mockAuthListener = undefined;
  (firebaseService.getSystemSettings as jest.Mock).mockResolvedValue({ enableStrategyMap: true });
  (firebaseService.getDashboards as jest.Mock).mockResolvedValue([board('D1', 'A', ['KPI-A', 'KPI-B']), board('D2', 'B', ['FOREIGN-KPI'])]);
  (firebaseService.getAllManagedClients as jest.Mock).mockResolvedValue([{ clientId: 'A', displayName: 'Tenant A' }]);
  (firebaseService.getAllClients as jest.Mock).mockResolvedValue(['A']);
  (firestoreGetDocs as jest.Mock).mockResolvedValue({ empty: true, docs: [] });
});

test('strategy navigation preserves board and exact KPI, replaces a prior KPI, and safely clears a missing item', async () => {
  await boot();

  await openStrategy();
  fireEvent.click(screen.getByRole('button', { name: 'Navigate KPI A' }));
  await waitFor(() => expect(screen.getByTestId('strategy-navigation-destination')).toHaveAttribute('data-item-id', 'KPI-A'));
  expect(screen.getByTestId('strategy-navigation-destination')).toHaveAttribute('data-dashboard-id', 'D1');
  expect(screen.getByTestId('strategy-navigation-destination')).toHaveAttribute('data-navigation-source', 'contribution');

  await openStrategy();
  fireEvent.click(screen.getByRole('button', { name: 'Navigate KPI B' }));
  await waitFor(() => expect(screen.getByTestId('strategy-navigation-destination')).toHaveAttribute('data-item-id', 'KPI-B'));
  expect(screen.getByTestId('strategy-navigation-destination')).toHaveAttribute('data-dashboard-id', 'D1');

  await openStrategy();
  fireEvent.click(screen.getByRole('button', { name: 'Navigate without item' }));
  await waitFor(() => expect(screen.getByTestId('strategy-navigation-destination')).toHaveAttribute('data-item-id', ''));
  expect(screen.getByTestId('strategy-navigation-destination')).toHaveAttribute('data-dashboard-id', 'D1');
});

test('strategy navigation cannot switch into another client dashboard', async () => {
  await boot();
  await openStrategy();

  fireEvent.click(screen.getByRole('button', { name: 'Navigate foreign KPI' }));

  expect(screen.getByTestId('strategy-matrix')).toBeInTheDocument();
  expect(screen.getByTestId('strategy-navigation-destination')).toHaveAttribute('data-dashboard-id', 'D1');
  expect(screen.getByTestId('strategy-navigation-destination')).toHaveAttribute('data-item-id', '');
});
