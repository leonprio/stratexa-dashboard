import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DashboardView } from './DashboardView';
import { DashboardRole, GlobalUserRole, type ActionPlan, type Dashboard, type DashboardItem, type User } from '../types';
import { firebaseService } from '../services/firebaseService';
import { calculateAggregateDashboard } from '../utils/aggregationUtils';

jest.mock('../services/firebaseService', () => ({ firebaseService: {
  getActionPlansForIndicator: jest.fn(), getUsers: jest.fn(), createActionPlan: jest.fn(), updateActionPlan: jest.fn(),
} }));
jest.mock('../utils/ExecutiveOperationalExport', () => ({ exportToExecutiveExcelJS: jest.fn() }));

const item: DashboardItem = {
  id: 2, indicator: 'KPI de integración', weight: 100, frequency: 'monthly', unit: 'u',
  type: 'accumulative', goalType: 'maximize', monthlyGoals: Array(12).fill(10), monthlyProgress: Array(12).fill(5),
};
const dashboard: Dashboard = { id: 10, clientId: 'LVP', title: 'Tablero autorizado', subtitle: '', group: 'Operación',
  thresholds: { onTrack: 95, atRisk: 85 }, items: [item] };
const existing: ActionPlan = {
  id: 'plan-existing', indicatorId: 2, dashboardId: 10, clientId: 'LVP', title: 'Plan del año anterior',
  originYear: 2025, originPeriodType: 'monthly', originPeriodIndex: 1, status: 'planned',
  startDate: '2025-02-01', progress: 0, createdAt: '', updatedAt: '', activities: [],
};
const profile = (canManage: boolean): User => ({
  id: 'integration-user', name: 'Usuario autorizado', email: 'integration@example.test', globalRole: GlobalUserRole.Member, dashboardAccess: {},
  memberships: [{ clientId: 'LVP', role: 'standard_user', status: 'active', dashboardScopes: { '10': 'viewer' },
    editableDashboardIds: canManage ? ['10'] : [], capabilities: canManage ? ['plan_editor'] : [] }],
});

beforeEach(() => {
  jest.resetAllMocks();
  (firebaseService.getUsers as jest.Mock).mockResolvedValue([]);
  Element.prototype.scrollIntoView = jest.fn();
});

function openKpi(canManage = true, currentUser = profile(canManage), isGlobalAdmin = false) {
  const view = render(<DashboardView dashboard={dashboard} activeClientId="LVP" onUpdateItem={jest.fn()}
    userRole={DashboardRole.Viewer} isGlobalAdmin={isGlobalAdmin} currentUser={currentUser} year={2026} layout="compact" />);
  fireEvent.click(screen.getByRole('heading', { name: 'KPI de integración' }));
  return view;
}

test('real KPI card opens a visible plans section and creation CTA with zero plans', async () => {
  (firebaseService.getActionPlansForIndicator as jest.Mock).mockResolvedValue([]);
  openKpi();
  await waitFor(() => expect(firebaseService.getActionPlansForIndicator).toHaveBeenCalledWith(2, 'LVP'));
  expect(await screen.findByText('Planes relacionados')).toBeVisible();
  expect(screen.getByRole('button', { name: /Nuevo plan/ })).toBeVisible();
  expect(firebaseService.createActionPlan).not.toHaveBeenCalled();
});

test.each([
  { name: 'canonical tenant admin without legacy grants', currentUser: { ...profile(false), memberships: [{ clientId: 'LVP', role: 'tenant_admin', status: 'active' }] } as User, allowed: true, platform: false },
  { name: 'KPI editor without plan_editor', currentUser: { ...profile(false), memberships: [{ clientId: 'LVP', role: 'standard_user', status: 'active', dashboardScopes: { '10': 'editor' }, editableDashboardIds: ['10'], capabilities: ['editor'] }] } as User, allowed: true, platform: false },
  { name: 'canonical viewer overrides legacy Admin and Editor', currentUser: { ...profile(false), globalRole: GlobalUserRole.Admin, clientId: 'LVP', dashboardAccess: { '10': DashboardRole.Editor } }, allowed: false, platform: false },
  { name: 'platform email without a tenant membership', currentUser: { ...profile(false), email: 'leon@leonprior.com', globalRole: GlobalUserRole.Admin, memberships: [] }, allowed: false, platform: true },
  { name: 'platform identity with explicit canonical plan authority', currentUser: { ...profile(true), email: 'leon@leonprior.com', globalRole: GlobalUserRole.Admin }, allowed: true, platform: true },
  { name: 'suspended tenant admin', currentUser: { ...profile(false), memberships: [{ clientId: 'LVP', role: 'tenant_admin', status: 'suspended' }] } as User, allowed: false, platform: false },
  { name: 'plan_editor scoped to another dashboard', currentUser: { ...profile(true), memberships: [{ ...profile(true).memberships![0], editableDashboardIds: ['11'] }] }, allowed: false, platform: false },
  { name: 'tenant admin scoped to another client', currentUser: { ...profile(false), memberships: [{ clientId: 'OTHER', role: 'tenant_admin', status: 'active' }] } as User, allowed: false, platform: false },
])('real KPI parent enforces $name with zero plans', async ({ currentUser, allowed, platform }) => {
  (firebaseService.getActionPlansForIndicator as jest.Mock).mockResolvedValue([]);
  openKpi(false, currentUser, platform);
  expect(await screen.findByText(/0 planes relacionados/)).toBeVisible();
  const create = screen.queryByRole('button', { name: /Nuevo plan/ });
  if (allowed) expect(create).toBeVisible();
  else expect(create).not.toBeInTheDocument();
  expect(firebaseService.createActionPlan).not.toHaveBeenCalled();
  expect(firebaseService.updateActionPlan).not.toHaveBeenCalled();
});

test('the same real KPI path shows its existing plan independently of the consulted year', async () => {
  (firebaseService.getActionPlansForIndicator as jest.Mock).mockResolvedValue([existing]);
  openKpi();
  expect(await screen.findByText('Plan del año anterior')).toBeVisible();
  expect(screen.getByText('Planes relacionados')).toBeVisible();
  expect(screen.getByRole('button', { name: /Nuevo plan/ })).toBeVisible();
  expect(screen.getAllByText('Plan del año anterior')).toHaveLength(1);
});

test('dashboard editor without plan_editor can open and submit the first plan through the real KPI path', async () => {
  const editor: User = { ...profile(false), memberships: [{ clientId: 'LVP', role: 'standard_user', status: 'active',
    dashboardScopes: { '10': 'editor' }, editableDashboardIds: ['10'], capabilities: ['editor'] }] };
  (firebaseService.getActionPlansForIndicator as jest.Mock).mockResolvedValue([]);
  (firebaseService.createActionPlan as jest.Mock).mockImplementation(async draft => ({ ...draft, id: 'created' }));
  openKpi(false, editor);
  fireEvent.click(await screen.findByRole('button', { name: /Nuevo plan/ }));
  fireEvent.change(screen.getByLabelText('Nombre del plan'), { target: { value: 'Plan del editor' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar plan' }));
  await waitFor(() => expect(firebaseService.createActionPlan).toHaveBeenCalledTimes(1));
  expect(firebaseService.createActionPlan).toHaveBeenCalledWith(expect.objectContaining({ clientId: 'LVP', dashboardId: 10, indicatorId: 2, title: 'Plan del editor' }));
  await waitFor(() => expect(screen.queryByLabelText('Nombre del plan')).not.toBeInTheDocument());
});

test('the real parent preserves viewer read access without granting creation', async () => {
  (firebaseService.getActionPlansForIndicator as jest.Mock).mockResolvedValue([existing]);
  openKpi(false);
  expect(await screen.findByText('Plan del año anterior')).toBeVisible();
  expect(screen.queryByRole('button', { name: /Nuevo plan/ })).not.toBeInTheDocument();
  expect(firebaseService.createActionPlan).not.toHaveBeenCalled();
  expect(firebaseService.updateActionPlan).not.toHaveBeenCalled();
});

function openAggregate(currentUser = profile(true), boards = [dashboard], invalidOrigin = false) {
  const aggregate = { ...calculateAggregateDashboard(boards), id: 'agg-test-2026', clientId: 'LVP', year: 2026 };
  if (invalidOrigin) (aggregate.items[0] as any).sources = [{ boardId: 'missing', itemId: 2 }];
  const view = render(<DashboardView dashboard={aggregate} allDashboards={boards} activeClientId="LVP" onUpdateItem={jest.fn()}
    userRole={DashboardRole.Editor} isGlobalAdmin currentUser={currentUser} year={2026} layout="compact" />);
  fireEvent.click(screen.getByRole('heading', { name: aggregate.items[0].indicator }));
  return view;
}

test('aggregate KPI opens and submits a plan using its physical dashboard and KPI identities', async () => {
  let stored: ActionPlan[] = [];
  (firebaseService.getActionPlansForIndicator as jest.Mock).mockImplementation(async () => stored);
  (firebaseService.createActionPlan as jest.Mock).mockImplementation(async draft => {
    const created = { ...draft, id: 'created' }; stored = [created]; return created;
  });
  const aggregateView = openAggregate();
  fireEvent.click(await screen.findByRole('button', { name: /Nuevo plan/ }));
  fireEvent.change(screen.getByLabelText('Nombre del plan'), { target: { value: 'Plan desde consolidado' } });
  fireEvent.click(screen.getByRole('button', { name: /Agregar actividad/ }));
  fireEvent.change(screen.getByLabelText('Nombre de la actividad'), { target: { value: 'Acción del origen' } });
  expect(firebaseService.createActionPlan).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Guardar plan' }));
  await waitFor(() => expect(firebaseService.createActionPlan).toHaveBeenCalledTimes(1));
  expect(firebaseService.createActionPlan).toHaveBeenCalledWith(expect.objectContaining({ clientId: 'LVP', dashboardId: 10, indicatorId: 2 }));
  expect(stored[0].activities).toEqual([expect.objectContaining({ title: 'Acción del origen' })]);
  expect(firebaseService.getActionPlansForIndicator).toHaveBeenCalledWith(2, 'LVP');
  await waitFor(() => expect(screen.queryByLabelText('Nombre del plan')).not.toBeInTheDocument());
  aggregateView.unmount();
  const normalView = openKpi();
  expect(await screen.findByText('Plan desde consolidado')).toBeVisible();
  normalView.unmount();
  openAggregate();
  expect(await screen.findByText('Plan desde consolidado')).toBeVisible();
  expect(screen.getAllByText('Plan desde consolidado')).toHaveLength(1);
  expect(firebaseService.createActionPlan).toHaveBeenCalledTimes(1);
});

test('aggregate KPI shows the plan already stored on its physical source', async () => {
  (firebaseService.getActionPlansForIndicator as jest.Mock).mockResolvedValue([existing]);
  openAggregate();
  expect(await screen.findByText(existing.title)).toBeVisible();
  expect(screen.getAllByText(existing.title)).toHaveLength(1);
});

test.each(['viewer', 'other tenant', 'no scope', 'suspended', 'invalid origin'])(
  'aggregate plan creation stays denied for %s', async scenario => {
    const currentUser = profile(false);
    if (scenario === 'other tenant') currentUser.memberships![0].clientId = 'OTHER';
    if (scenario === 'no scope') currentUser.memberships![0].dashboardScopes = { '11': 'editor' };
    if (scenario === 'suspended') currentUser.memberships![0].status = 'suspended';
    (firebaseService.getActionPlansForIndicator as jest.Mock).mockResolvedValue([]);
    openAggregate(currentUser, [dashboard], scenario === 'invalid origin');
    await screen.findByText('Planes relacionados');
    expect(screen.queryByRole('button', { name: /Nuevo plan/ })).not.toBeInTheDocument();
    expect(firebaseService.createActionPlan).not.toHaveBeenCalled();
    if (scenario !== 'viewer') expect(firebaseService.getActionPlansForIndicator).not.toHaveBeenCalled();
  },
);

test('multiple physical origins keep their own plans and deduplicate repeated source links', async () => {
  const second = { ...dashboard, id: 11, title: 'Segundo origen', items: [{ ...item, id: 3 }] };
  const secondPlan = { ...existing, id: 'second-plan', dashboardId: 11, indicatorId: 3, title: 'Plan del segundo origen' };
  const user: User = { ...profile(true), memberships: [{ clientId: 'LVP', role: 'tenant_admin', status: 'active' }] };
  (firebaseService.getActionPlansForIndicator as jest.Mock).mockImplementation(async id => id === 2 ? [existing, existing] : [secondPlan]);
  const aggregate = { ...calculateAggregateDashboard([dashboard, second]), id: 'agg-multiple', clientId: 'LVP' };
  (aggregate.items[0] as any).sources.push({ boardId: 10, itemId: 2 });
  render(<DashboardView dashboard={aggregate} allDashboards={[dashboard, second]} currentUser={user} userRole={DashboardRole.Editor}
    isGlobalAdmin={false} onUpdateItem={jest.fn()} layout="compact" year={2026} />);
  fireEvent.click(screen.getByRole('heading', { name: aggregate.items[0].indicator }));
  expect(await screen.findByText(existing.title)).toBeVisible();
  expect(await screen.findByText(secondPlan.title)).toBeVisible();
  expect(screen.getAllByText(existing.title)).toHaveLength(1);
  expect(screen.getAllByRole('button', { name: /Nuevo plan/ })).toHaveLength(2);
  expect(firebaseService.getActionPlansForIndicator).toHaveBeenCalledTimes(2);
  expect(firebaseService.createActionPlan).not.toHaveBeenCalled();
});

test('legacy Director aggregate creation uses only its authorized physical source', async () => {
  const director: User = { id: 'director', name: 'Director', email: 'director@example.test',
    globalRole: GlobalUserRole.Director, clientId: 'LVP', directorTitle: dashboard.group, dashboardAccess: {} };
  (firebaseService.getActionPlansForIndicator as jest.Mock).mockResolvedValue([]);
  (firebaseService.createActionPlan as jest.Mock).mockImplementation(async draft => ({ ...draft, id: 'legacy-plan' }));
  const aggregate = { ...calculateAggregateDashboard([dashboard]), id: 'agg-legacy-2026', clientId: 'LVP' };
  render(<DashboardView dashboard={aggregate} allDashboards={[dashboard]} activeClientId="LVP"
    currentUser={director} userRole={DashboardRole.Viewer} isGlobalAdmin={false} onUpdateItem={jest.fn()} year={2026} layout="compact" />);
  fireEvent.click(screen.getByRole('heading', { name: aggregate.items[0].indicator }));
  fireEvent.click(await screen.findByRole('button', { name: /Nuevo plan/ }));
  fireEvent.change(screen.getByLabelText('Nombre del plan'), { target: { value: 'Plan del Director' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar plan' }));
  await waitFor(() => expect(firebaseService.createActionPlan).toHaveBeenCalledTimes(1));
  expect(firebaseService.createActionPlan).toHaveBeenCalledWith(expect.objectContaining({ clientId: 'LVP', dashboardId: 10, indicatorId: 2 }));
});
