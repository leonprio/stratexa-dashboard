import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DashboardView } from './DashboardView';
import { DashboardRole, GlobalUserRole, type ActionPlan, type Dashboard, type DashboardItem, type User } from '../types';
import { firebaseService } from '../services/firebaseService';
import { calculateAggregateDashboard } from '../utils/aggregationUtils';

jest.mock('../services/firebaseService', () => ({ firebaseService: {
  getActionPlansForIndicator: jest.fn(), createActionPlan: jest.fn(), updateActionPlan: jest.fn(),
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
  Element.prototype.scrollIntoView = jest.fn();
});

function openKpi(canManage = true, currentUser = profile(canManage), isGlobalAdmin = false) {
  const view = render(<DashboardView dashboard={dashboard} activeClientId="LVP" onUpdateItem={jest.fn()}
    userRole={DashboardRole.Viewer} isGlobalAdmin={isGlobalAdmin} currentUser={currentUser} year={2026} layout="compact" />);
  fireEvent.click(screen.getByRole('heading', { name: 'KPI de integración' }));
  return view;
}


test('RUNTIME-02 DashboardView: fresh layout toggle keeps focus closed; prior KPI focus survives toggle',async()=>{
 (firebaseService.getActionPlansForIndicator as jest.Mock).mockResolvedValue([]);
 const props={dashboard,activeClientId:'LVP',onUpdateItem:jest.fn(),userRole:DashboardRole.Viewer,isGlobalAdmin:false,currentUser:profile(false),year:2026};
 const view=render(<DashboardView {...props} layout="grid"/>);
 view.rerender(<DashboardView {...props} layout="compact"/>);
 expect(document.getElementById('gestion-detallada-focus')).toBeNull();
 fireEvent.click(screen.getByRole('heading',{name:'KPI de integración'}));
 expect(document.getElementById('gestion-detallada-focus')).not.toBeNull();
 view.rerender(<DashboardView {...props} layout="grid"/>);
 expect(document.getElementById('gestion-detallada-focus')).not.toBeNull();
 expect(firebaseService.createActionPlan).not.toHaveBeenCalled();
});
