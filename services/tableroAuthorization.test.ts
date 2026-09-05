import { DashboardRole, GlobalUserRole, type User } from '../types';
import {
  canAccessDashboard,
  canAdminTenant,
  canReadBusinessData,
  getAuthorizedClientIds,
  getMembershipForClient,
  isPlatformAdmin,
  hasLegacyPlatformBusinessReadBridge,
  resolveEffectiveMemberships,
} from './tableroAuthorization';

const legacy = (overrides: Partial<User> = {}): User => ({
  id: 'u', name: 'User', email: 'u@example.test', globalRole: GlobalUserRole.Member,
  clientId: 'A', dashboardAccess: {}, ...overrides,
});

describe('canonical Tablero authorization compatibility', () => {
  it('resolves legacy roles without IPS fallback', () => {
    expect(resolveEffectiveMemberships(legacy()).memberships[0]).toMatchObject({ clientId: 'A', role: 'standard_user' });
    expect(getAuthorizedClientIds(legacy())).toEqual(['A']);
    expect(getAuthorizedClientIds(legacy({ clientId: undefined }))).toEqual([]);
  });

  it('maps legacy Admin and Director conservatively', () => {
    expect(resolveEffectiveMemberships(legacy({ globalRole: GlobalUserRole.Admin })).role).toBe('tenant_admin');
    expect(resolveEffectiveMemberships(legacy({ globalRole: GlobalUserRole.Director, directorTitle: 'OPERACIONES' })).memberships[0]).toMatchObject({ role: 'director', hierarchyScopes: ['OPERACIONES'] });
  });

  it('normalizes universal platform identity without creating fake tenant memberships', () => {
    const profile = legacy({ email: 'LEON@LEONPRIOR.COM', clientId: 'IPS', globalRole: GlobalUserRole.Admin });
    expect(isPlatformAdmin(profile)).toBe(true);
    expect(resolveEffectiveMemberships(profile).memberships).toEqual([]);
    expect(getAuthorizedClientIds(profile)).toEqual([]);
  });

  it('keeps a canonical blind platform admin separate from the temporary business bridge', () => {
    const blindAdmin = legacy({ email: 'blind@example.test', globalRole: 'platform_admin' as GlobalUserRole, clientId: undefined });
    expect(isPlatformAdmin(blindAdmin)).toBe(true);
    expect(hasLegacyPlatformBusinessReadBridge(blindAdmin)).toBe(false);
    expect(canReadBusinessData(blindAdmin, 'A')).toBe(false);
    const legacySupport = legacy({ email: 'leon@leonprior.com', globalRole: GlobalUserRole.Admin, clientId: undefined });
    expect(isPlatformAdmin(legacySupport)).toBe(true);
    expect(hasLegacyPlatformBusinessReadBridge(legacySupport)).toBe(false);
    expect(canReadBusinessData(legacySupport, 'A')).toBe(false);
    expect(canReadBusinessData({...legacySupport, memberships:[{clientId:'A',role:'standard_user',status:'active',dashboardScopes:{D1:'viewer'}}]},'A')).toBe(true);
  });

  it('gives valid canonical memberships precedence over legacy data per-tenant', () => {
    const profile = legacy({ clientId: 'A,B', memberships: [{ clientId: 'A', role: 'standard_user', status: 'active', dashboardScopes: { '1': 'viewer' } }] });
    const result = resolveEffectiveMemberships(profile);
    expect(result.source).toBe('canonical');
    // Tenant A is resolved from canonical; Tenant B remains from non-replaced legacy
    expect(result.memberships.map(m => m.clientId).sort()).toEqual(['A', 'B']);
    expect(result.contradictoryHybrid).toBe(true);
    expect(getAuthorizedClientIds(profile).sort()).toEqual(['A', 'B']);
    // For tenant A, canonical dashboardScopes apply (only '1')
    expect(canAccessDashboard(profile, { id: 1, clientId: 'A' }, 'viewer')).toBe(true);
  });

  it('does not union canonical Director scope with legacy scope for the same tenant', () => {
    const profile = legacy({
      globalRole: GlobalUserRole.Director, clientId: 'A,B', directorTitle: 'A', superGroups: ['A', 'B'],
      dashboardAccess: { D1: DashboardRole.Editor, D2: DashboardRole.Editor },
      memberships: [{ clientId: 'A', role: 'director', status: 'active', hierarchyScopes: ['A'], dashboardScopes: { D1: 'editor' } }],
    });
    const result = resolveEffectiveMemberships(profile);
    expect(result).toMatchObject({ source: 'canonical', contradictoryHybrid: true, needsMigrationReview: true });
    // Canonical for A (scopes applied); Legacy for B (scopes preserved for B)
    expect(getAuthorizedClientIds(profile).sort()).toEqual(['A', 'B']);
    expect(canAccessDashboard(profile, { id: 'D1', clientId: 'A' }, 'editor')).toBe(true);
    expect(canAccessDashboard(profile, { id: 'D2', clientId: 'A' }, 'editor')).toBe(false);
    expect(canAccessDashboard(profile, { id: 'other', clientId: 'A', group: 'B' })).toBe(false);
    // For legacy tenant B, D2 is accessible via legacy dashboardAccess
    expect(canAccessDashboard(profile, { id: 'D2', clientId: 'B' }, 'editor')).toBe(true);
  });

  it('rejects invalid and inactive membership authority safely per-tenant', () => {
    const profile = legacy({ clientId: 'A', memberships: [
      { clientId: 'A', role: 'standard_user', status: 'inactive' },
      { clientId: '', role: 'tenant_admin', status: 'active' },
    ] });
    const result = resolveEffectiveMemberships(profile);
    expect(result.needsMigrationReview).toBe(true);
    // Inactive canonical for A replaces legacy A, so no active access for A
    expect(getAuthorizedClientIds(profile)).toEqual([]);
    expect(getMembershipForClient(profile, 'A')).toBeNull();
  });

  it('keeps tenant admin scoped and dashboard access explicit', () => {
    const admin = legacy({ globalRole: GlobalUserRole.Admin });
    expect(canAdminTenant(admin, 'A')).toBe(true);
    expect(canAdminTenant(admin, 'B')).toBe(false);
    const member = legacy({ dashboardAccess: { '1': DashboardRole.Viewer, '2': DashboardRole.Editor } });
    expect(canAccessDashboard(member, { id: 1, clientId: 'A' })).toBe(true);
    expect(canAccessDashboard(member, { id: 1, clientId: 'A' }, 'editor')).toBe(false);
    expect(canAccessDashboard(member, { id: 2, clientId: 'A' }, 'editor')).toBe(true);
    expect(canAccessDashboard(member, { id: 2, clientId: 'B' })).toBe(false);
  });

  it('does not treat selected client as authorization', () => {
    const member = legacy({ clientId: 'A' });
    expect(getMembershipForClient(member, 'B')).toBeNull();
    expect(canAccessDashboard(member, { id: 1, clientId: 'B' })).toBe(false);
  });

  it('preserves multi-tenant user access when canonical membership exists for one tenant but not others', () => {
    // Simulated scenario: user has canonical membership in IPS, but also legacy access to CEMENTOS_SIGMA
    const multiTenantUser = legacy({
      clientId: 'IPS,CEMENTOS_SIGMA',
      globalRole: GlobalUserRole.Admin,
      memberships: [
        { clientId: 'IPS', role: 'tenant_admin', status: 'active' }
      ]
    });
    const resolution = resolveEffectiveMemberships(multiTenantUser);
    expect(resolution.source).toBe('canonical');
    expect(getAuthorizedClientIds(multiTenantUser).sort()).toEqual(['CEMENTOS_SIGMA', 'IPS']);
    expect(canAdminTenant(multiTenantUser, 'IPS')).toBe(true);
    expect(canAdminTenant(multiTenantUser, 'CEMENTOS_SIGMA')).toBe(true);
    // Negative test: unassigned tenant is denied
    expect(canAdminTenant(multiTenantUser, 'OTHER_TENANT')).toBe(false);
    expect(canReadBusinessData(multiTenantUser, 'OTHER_TENANT')).toBe(false);
  });

  it('strictly isolates unassigned tenants (zero cross-tenant expansion)', () => {
    const sigmaUser = legacy({
      clientId: 'CEMENTOS_SIGMA',
      globalRole: GlobalUserRole.Member,
      dashboardAccess: { '101': DashboardRole.Viewer }
    });
    expect(getAuthorizedClientIds(sigmaUser)).toEqual(['CEMENTOS_SIGMA']);
    expect(canReadBusinessData(sigmaUser, 'CEMENTOS_SIGMA')).toBe(true);
    expect(canReadBusinessData(sigmaUser, 'IPS')).toBe(false);
    expect(canReadBusinessData(sigmaUser, 'RED_CROP')).toBe(false);
    expect(canAccessDashboard(sigmaUser, { id: 101, clientId: 'IPS' })).toBe(false);
  });
});
