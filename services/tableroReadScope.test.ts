import { auth } from '../firebase';
import { getDoc, getDocs } from 'firebase/firestore';
import { readTableroScope, requestedTenants, dashboardQueryConstraints, TableroReadScope } from './tableroReadScope';
import { firebaseService } from './firebaseService';
import { GlobalUserRole, DashboardRole } from '../types';

jest.mock('../firebase', () => ({ auth: { currentUser: null }, db: {} }));
jest.mock('firebase/firestore', () => ({
  doc: jest.fn((_db, ...path) => ({ path: path.join('/') })),
  collection: jest.fn((_db, ...path) => ({ path: path.join('/') })),
  where: jest.fn((field, op, value) => ({ field, op, value })),
  documentId: () => '__name__',
  query: jest.fn((ref, ...constraints) => ({ ...ref, constraints })),
  getDoc: jest.fn(), getDocs: jest.fn()
}));

const scope: TableroReadScope = { platform: false, tenants: ['A'], profile: {
  id: 'member', email: 'member@example.test', name: 'Member', globalRole: GlobalUserRole.Member,
  clientId: 'A', dashboardAccess: { '10': DashboardRole.Editor }
} };

beforeEach(() => {
  jest.clearAllMocks();
  (auth as any).currentUser = { uid: 'member', email: 'member@example.test' };
  (getDoc as jest.Mock).mockResolvedValue({ exists: () => true, data: () => scope.profile });
  (getDocs as jest.Mock).mockResolvedValue({ docs: [] });
});

test('session and profile are required; profile email cannot authorize platform access', async () => {
  (getDoc as jest.Mock).mockResolvedValueOnce({ exists: () => true, data: () => ({ ...scope.profile, email: 'leon@leonprior.com' }) });
  expect((await readTableroScope()).platform).toBe(false);
  (auth as any).currentUser = null;
  await expect(readTableroScope()).rejects.toThrow('Sesión');
});

test('selected client is not authorization; unspecified uses profile memberships', () => {
  expect(() => requestedTenants(scope, 'B')).toThrow();
  expect(requestedTenants(scope)).toEqual(['A']);
  expect(requestedTenants({ ...scope, tenants: ['A','B'] })).toEqual(['A','B']);
});

test('member queries always constrain tenant AND dashboard permissions', () => {
  const constraints = dashboardQueryConstraints(scope, 'A') as any[];
  expect(constraints).toHaveLength(2);
  for (const query of constraints) expect(query[0]).toEqual({ field:'clientId', op:'==', value:'A' });
  expect(constraints[0][1].value).toEqual(['10']);
  expect(constraints[1][1].value).toEqual([10]);
});

test('canonical Director scope never unions legacy superGroups or dashboardAccess', () => {
  const canonicalDirector: TableroReadScope = {
    platform: false, tenants: ['A'], profile: {
      ...scope.profile,
      globalRole: GlobalUserRole.Director,
      clientId: 'A,B',
      dashboardAccess: { 'D1': DashboardRole.Editor, 'D2': DashboardRole.Editor },
      superGroups: ['A', 'B'],
      memberships: [{ clientId: 'A', role: 'director', status: 'active', hierarchyScopes: ['A'], dashboardScopes: { D1: 'editor' } }],
    },
  };
  const constraints = dashboardQueryConstraints(canonicalDirector, 'A') as any[];
  expect(constraints.flat().some(c => c?.value === 'B' || Array.isArray(c?.value) && c.value.includes('D2'))).toBe(false);
  expect(constraints.flat()).toContainEqual({ field: 'directionId', op: '==', value: 'A' });
  expect(constraints.flat()).toContainEqual({ field: '__name__', op: 'in', value: ['D1'] });
});

test('getDashboards does not fetch global data for a tenant member', async () => {
  await firebaseService.getDashboards('A', 2026);
  for (const [query] of (getDocs as jest.Mock).mock.calls.filter(([q]) => q.path === 'tbl_dashboards')) {
    expect(query.path).toBe('tbl_dashboards');
    expect(query.constraints).toContainEqual({ field:'clientId', op:'==', value:'A' });
  }
});

test('cross-tenant getDashboards is rejected before collection reads', async () => {
  await expect(firebaseService.getDashboards('B')).rejects.toThrow();
  expect((getDocs as jest.Mock).mock.calls.every(([q]) => q.path === 'tbl_userMemberships')).toBe(true);
});

test('catalogue uses only authorized document gets and user reads return own profile', async () => {
  expect(await firebaseService.getUsers()).toEqual([scope.profile]);
  (getDoc as jest.Mock).mockImplementation(async ref => ref.path === 'tbl_users/member'
    ? { exists: () => true, data: () => scope.profile }
    : { exists: () => false });
  expect(await firebaseService.getAllManagedClients()).toEqual([{clientId:'A',displayName:'A'}]);
  expect((getDocs as jest.Mock).mock.calls.every(([q]) => q.path === 'tbl_userMemberships')).toBe(true);
});

test('tenant Admin directory query uses tenant constraint', async () => {
  (getDoc as jest.Mock).mockResolvedValue({ exists: () => true, data: () => ({ ...scope.profile, globalRole: 'Admin' }) });
  await firebaseService.getUsers();
  expect((getDocs as jest.Mock).mock.calls.find(([q]) => q.path === 'tbl_users')[0].constraints).toEqual([{field:'clientId',op:'==',value:'A'}]);
});

test('platform catalogue is explicit and uses authenticated identity', async () => {
  (auth as any).currentUser = { uid:'platform',email:'leon@leonprior.com' };
  await expect(firebaseService.getDashboards()).rejects.toThrow('membresías');
  expect((getDocs as jest.Mock).mock.calls.every(([q]) => q.path === 'tbl_userMemberships')).toBe(true);
});

test('sequential account changes do not reuse prior scope', async () => {
  expect((await readTableroScope()).tenants).toEqual(['A']);
  (auth as any).currentUser = { uid:'other',email:'other@example.test' };
  (getDoc as jest.Mock).mockResolvedValueOnce({ exists: () => true, data: () => ({ ...scope.profile, clientId: 'B' }) });
  expect((await readTableroScope()).tenants).toEqual(['B']);
});

test('protected membership grants platform only its explicit scope and suspended records override legacy', async () => {
 (auth as any).currentUser={uid:'platform',email:'leon@leonprior.com'};
 (getDocs as jest.Mock).mockResolvedValue({docs:[{data:()=>({userId:'platform',clientId:'A',role:'standard_user',status:'active',scopeType:'dashboard',allowedDashboardIds:['D'],capabilities:['viewer','strategy_reader']})}]});
 const scoped=await readTableroScope();
 expect(scoped.tenants).toEqual(['A']);
 expect(()=>requestedTenants(scoped,'B')).toThrow();
 expect(scoped.profile?.memberships?.[0].capabilities).toEqual(['viewer']);
 (auth as any).currentUser={uid:'member',email:'member@example.test'};
 (getDocs as jest.Mock).mockResolvedValue({docs:[{data:()=>({userId:'member',clientId:'A',role:'tenant_admin',status:'suspended',scopeType:'tenant',capabilities:[]})}]});
 expect((await readTableroScope()).tenants).toEqual([]);
});
