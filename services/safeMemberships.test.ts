/** @jest-environment node */

import { DashboardRole, GlobalUserRole, type User } from '../types';
import {
  buildMembershipId,
  validatePersistedMembership,
  type PersistedTenantMembership,
} from './tableroMembershipPersistence';
import {
  resolveEffectiveMemberships,
  getAuthorizedClientIds,
  getMembershipForClient,
  canAdminTenant,
  hydratePersistedMemberships,
  type CanonicalRole,
} from './tableroAuthorization';
import { firebaseService } from './firebaseService';

// Mock de db y auth para pruebas unitarias de persistencia segura
jest.mock('../firebase', () => ({
  db: {},
  auth: { currentUser: null },
}));

// Mock de tableroReadScope
jest.mock('./tableroReadScope', () => ({
  readTableroScope: jest.fn(),
  requestedTenants: jest.fn((scope: any, selected?: string) => {
    if (selected) return [selected.trim().toUpperCase()];
    return scope.tenants || ['A'];
  }),
}));

describe('APP TABLERO — v10 Bloque 1: Safe Memberships Contract & Persistence (RED → PASS)', () => {
  const baseProfileA: User = {
    id: 'user_123',
    name: 'Usuario Prueba',
    email: 'usuario@prueba.com',
    globalRole: GlobalUserRole.Member,
    clientId: 'CLIENT_A',
    dashboardAccess: { d1: DashboardRole.Viewer },
    directorTitle: '',
    subGroups: ['GrupoA'],
    superGroups: [],
    canManageKPIs: false,
    canExportPPT: false,
  };

  it('1. Vincular usuario existente en cliente A al cliente B preserva cliente A, conserva UID y perfil global', async () => {
    // Escenario: El usuario ya tiene membresía o perfil en CLIENT_A
    const userA = { ...baseProfileA };

    // Construimos la nueva membresía para CLIENT_B
    const membershipBId = buildMembershipId(userA.id, 'CLIENT_B');
    expect(membershipBId).toBe('user_123__CLIENT_B');

    // Validamos que el helper de persistencia segura preserve la identidad
    const newMembership: PersistedTenantMembership = {
      membershipId: membershipBId,
      userId: userA.id,
      clientId: 'CLIENT_B',
      role: 'standard_user',
      status: 'active',
      scopeType: 'tenant',
      allowedDashboardIds: ['d_b1'],
      hierarchyScopeKeys: [],
      capabilities: ['viewer'],
      createdAt: '2026-10-12T00:00:00.000Z',
      createdBy: 'admin_b',
      updatedAt: '2026-10-12T00:00:00.000Z',
      updatedBy: 'admin_b',
      schemaVersion: 1,
    };

    expect(validatePersistedMembership(newMembership)).toEqual([]);

    // Al hidratar la membresía de B en un usuario con legacy A:
    const profileHydrated = JSON.parse(JSON.stringify(userA));
    hydratePersistedMemberships(profileHydrated, [newMembership], userA.id);

    // Ambas membresías deben coexistir
    const authorizedClients = getAuthorizedClientIds(profileHydrated);
    expect(authorizedClients.sort()).toEqual(['CLIENT_A', 'CLIENT_B']);
    expect(profileHydrated.id).toBe('user_123');
    expect(profileHydrated.email).toBe('usuario@prueba.com');
  });

  it('2. Idempotencia: vincular repetidamente a cliente B no genera duplicados ni corrompe estado', () => {
    const user = { ...baseProfileA };
    const membershipB: PersistedTenantMembership = {
      membershipId: buildMembershipId(user.id, 'CLIENT_B'),
      userId: user.id,
      clientId: 'CLIENT_B',
      role: 'standard_user',
      status: 'active',
      scopeType: 'tenant',
      allowedDashboardIds: ['d_b1'],
      hierarchyScopeKeys: [],
      capabilities: ['viewer'],
      createdAt: '2026-10-12T00:00:00.000Z',
      createdBy: 'admin_b',
      updatedAt: '2026-10-12T00:00:00.000Z',
      updatedBy: 'admin_b',
      schemaVersion: 1,
    };

    // Hidratar 2 veces con la misma membresía
    const profileHydrated = JSON.parse(JSON.stringify(user));
    hydratePersistedMemberships(profileHydrated, [membershipB, membershipB], user.id);

    const authorized = getAuthorizedClientIds(profileHydrated);
    expect(authorized.filter(c => c === 'CLIENT_B').length).toBe(1);
    expect(profileHydrated.memberships?.filter((m: any) => m.clientId === 'CLIENT_B').length).toBe(1);
  });

  it('3. Revocación de membresía en cliente B preserva acceso a cliente A', () => {
    const user = { ...baseProfileA };
    const membershipA: PersistedTenantMembership = {
      membershipId: buildMembershipId(user.id, 'CLIENT_A'),
      userId: user.id,
      clientId: 'CLIENT_A',
      role: 'standard_user',
      status: 'active',
      scopeType: 'tenant',
      allowedDashboardIds: [],
      hierarchyScopeKeys: [],
      capabilities: [],
      createdAt: '2026-10-12T00:00:00.000Z',
      createdBy: 'admin_a',
      updatedAt: '2026-10-12T00:00:00.000Z',
      updatedBy: 'admin_a',
      schemaVersion: 1,
    };
    const membershipB: PersistedTenantMembership = {
      membershipId: buildMembershipId(user.id, 'CLIENT_B'),
      userId: user.id,
      clientId: 'CLIENT_B',
      role: 'standard_user',
      status: 'active',
      scopeType: 'tenant',
      allowedDashboardIds: [],
      hierarchyScopeKeys: [],
      capabilities: [],
      createdAt: '2026-10-12T00:00:00.000Z',
      createdBy: 'admin_b',
      updatedAt: '2026-10-12T00:00:00.000Z',
      updatedBy: 'admin_b',
      schemaVersion: 1,
    };

    const profileHydrated = JSON.parse(JSON.stringify(user));
    hydratePersistedMemberships(profileHydrated, [membershipA, membershipB], user.id);
    expect(getAuthorizedClientIds(profileHydrated).sort()).toEqual(['CLIENT_A', 'CLIENT_B']);

    // Ahora se revoca B (se elimina o se suspende en CLIENT_B)
    const profileAfterRevokeB = JSON.parse(JSON.stringify(user));
    hydratePersistedMemberships(profileAfterRevokeB, [membershipA], user.id);

    expect(getAuthorizedClientIds(profileAfterRevokeB)).toEqual(['CLIENT_A']);
    expect(getMembershipForClient(profileAfterRevokeB, 'CLIENT_B')).toBeNull();
    expect(getMembershipForClient(profileAfterRevokeB, 'CLIENT_A')).not.toBeNull();
  });

  it('4. Revocación de membresía en cliente A preserva acceso a cliente B', () => {
    const user = { ...baseProfileA };
    const membershipA: PersistedTenantMembership = {
      membershipId: buildMembershipId(user.id, 'CLIENT_A'),
      userId: user.id,
      clientId: 'CLIENT_A',
      role: 'standard_user',
      status: 'active',
      scopeType: 'tenant',
      allowedDashboardIds: [],
      hierarchyScopeKeys: [],
      capabilities: [],
      createdAt: '2026-10-12T00:00:00.000Z',
      createdBy: 'admin_a',
      updatedAt: '2026-10-12T00:00:00.000Z',
      updatedBy: 'admin_a',
      schemaVersion: 1,
    };
    const membershipB: PersistedTenantMembership = {
      membershipId: buildMembershipId(user.id, 'CLIENT_B'),
      userId: user.id,
      clientId: 'CLIENT_B',
      role: 'standard_user',
      status: 'active',
      scopeType: 'tenant',
      allowedDashboardIds: [],
      hierarchyScopeKeys: [],
      capabilities: [],
      createdAt: '2026-10-12T00:00:00.000Z',
      createdBy: 'admin_b',
      updatedAt: '2026-10-12T00:00:00.000Z',
      updatedBy: 'admin_b',
      schemaVersion: 1,
    };

    const profileAfterRevokeA = JSON.parse(JSON.stringify(user));
    hydratePersistedMemberships(profileAfterRevokeA, [membershipB], user.id);

    expect(getAuthorizedClientIds(profileAfterRevokeA)).toContain('CLIENT_B');
    expect(getMembershipForClient(profileAfterRevokeA, 'CLIENT_B')).not.toBeNull();
  });

  it('5. Suspensión en cliente B no destruye identidad ni membresía en cliente A', () => {
    const user = { ...baseProfileA };
    const membershipA: PersistedTenantMembership = {
      membershipId: buildMembershipId(user.id, 'CLIENT_A'),
      userId: user.id,
      clientId: 'CLIENT_A',
      role: 'standard_user',
      status: 'active',
      scopeType: 'tenant',
      allowedDashboardIds: [],
      hierarchyScopeKeys: [],
      capabilities: [],
      createdAt: '2026-10-12T00:00:00.000Z',
      createdBy: 'admin_a',
      updatedAt: '2026-10-12T00:00:00.000Z',
      updatedBy: 'admin_a',
      schemaVersion: 1,
    };
    const membershipBSuspended: PersistedTenantMembership = {
      membershipId: buildMembershipId(user.id, 'CLIENT_B'),
      userId: user.id,
      clientId: 'CLIENT_B',
      role: 'standard_user',
      status: 'suspended',
      scopeType: 'tenant',
      allowedDashboardIds: [],
      hierarchyScopeKeys: [],
      capabilities: [],
      createdAt: '2026-10-12T00:00:00.000Z',
      createdBy: 'admin_b',
      updatedAt: '2026-10-12T00:00:00.000Z',
      updatedBy: 'admin_b',
      schemaVersion: 1,
    };

    const profile = JSON.parse(JSON.stringify(user));
    hydratePersistedMemberships(profile, [membershipA, membershipBSuspended], user.id);

    expect(getAuthorizedClientIds(profile)).toEqual(['CLIENT_A']);
    expect(getMembershipForClient(profile, 'CLIENT_B')).toBeNull();
    expect(getMembershipForClient(profile, 'CLIENT_A')?.status).toBe('active');
    expect(profile.id).toBe('user_123');
  });

  it('6. Rechazo de autoescalamiento y aislamiento entre tenants (Tenant Admin A no tiene permisos sobre Tenant B)', () => {
    const tenantAdminA: User = {
      ...baseProfileA,
      id: 'admin_a_uid',
      globalRole: GlobalUserRole.Admin,
      clientId: 'CLIENT_A',
    };

    expect(canAdminTenant(tenantAdminA, 'CLIENT_A')).toBe(true);
    expect(canAdminTenant(tenantAdminA, 'CLIENT_B')).toBe(false);

    // Intentar otorgar membresía de platform_admin en persistedTenantMembership debe fallar validación
    const illegalEscalation: any = {
      membershipId: buildMembershipId('admin_a_uid', 'CLIENT_B'),
      userId: 'admin_a_uid',
      clientId: 'CLIENT_B',
      role: 'platform_admin',
      status: 'active',
      scopeType: 'tenant',
      allowedDashboardIds: [],
      hierarchyScopeKeys: [],
      capabilities: [],
      createdAt: '2026-10-12T00:00:00.000Z',
      createdBy: 'admin_a_uid',
      updatedAt: '2026-10-12T00:00:00.000Z',
      updatedBy: 'admin_a_uid',
      schemaVersion: 1,
    };

    const errors = validatePersistedMembership(illegalEscalation);
    expect(errors).toContain('platform_admin must not be persisted as a tenant membership.');
  });

  it('7. firebaseService cuenta con linkUserToClient y revokeUserMembership seguros', () => {
    expect(typeof (firebaseService as any).linkUserToClient).toBe('function');
    expect(typeof (firebaseService as any).revokeUserMembership).toBe('function');
  });

  it('8. Revocar dos veces consecutivas es idempotente y seguro', () => {
    const user = { ...baseProfileA };
    const membershipB: PersistedTenantMembership = {
      membershipId: buildMembershipId(user.id, 'CLIENT_B'),
      userId: user.id,
      clientId: 'CLIENT_B',
      role: 'standard_user',
      status: 'active',
      scopeType: 'tenant',
      allowedDashboardIds: [],
      hierarchyScopeKeys: [],
      capabilities: [],
      createdAt: '2026-10-12T00:00:00.000Z',
      createdBy: 'admin_b',
      updatedAt: '2026-10-12T00:00:00.000Z',
      updatedBy: 'admin_b',
      schemaVersion: 1,
    };

    // Estado inicial: membresía en B presente
    const profile = JSON.parse(JSON.stringify(user));
    hydratePersistedMemberships(profile, [membershipB], user.id);
    expect(getAuthorizedClientIds(profile)).toContain('CLIENT_B');

    // Primera revocación (elimina registro de B)
    const profileAfterFirst = JSON.parse(JSON.stringify(user));
    hydratePersistedMemberships(profileAfterFirst, [], user.id);
    expect(getAuthorizedClientIds(profileAfterFirst)).toEqual(['CLIENT_A']);

    // Segunda revocación consecutiva (sigue sin registro de B)
    const profileAfterSecond = JSON.parse(JSON.stringify(user));
    hydratePersistedMemberships(profileAfterSecond, [], user.id);
    expect(getAuthorizedClientIds(profileAfterSecond)).toEqual(['CLIENT_A']);
    expect(getMembershipForClient(profileAfterSecond, 'CLIENT_B')).toBeNull();
  });

  it('9. Vinculación y revocación concurrente entre cliente A y cliente B preserva aislamiento', () => {
    const user = { ...baseProfileA, clientId: 'CLIENT_A,CLIENT_B' };

    const memA: PersistedTenantMembership = {
      membershipId: buildMembershipId(user.id, 'CLIENT_A'),
      userId: user.id,
      clientId: 'CLIENT_A',
      role: 'standard_user',
      status: 'active',
      scopeType: 'tenant',
      allowedDashboardIds: ['d_a1'],
      hierarchyScopeKeys: [],
      capabilities: ['viewer'],
      createdAt: '2026-10-12T00:00:00.000Z',
      createdBy: 'admin_a',
      updatedAt: '2026-10-12T00:00:00.000Z',
      updatedBy: 'admin_a',
      schemaVersion: 1,
    };

    const memBRevoked: PersistedTenantMembership = {
      membershipId: buildMembershipId(user.id, 'CLIENT_B'),
      userId: user.id,
      clientId: 'CLIENT_B',
      role: 'tenant_admin',
      status: 'inactive',
      scopeType: 'tenant',
      allowedDashboardIds: [],
      hierarchyScopeKeys: [],
      capabilities: [],
      createdAt: '2026-10-12T00:00:00.000Z',
      createdBy: 'admin_b',
      updatedAt: '2026-10-12T00:00:00.000Z',
      updatedBy: 'admin_b',
      schemaVersion: 1,
    };

    // Caso: actualización de A concurrente con revocación de B (B queda 'inactive')
    const profileConcurrent = JSON.parse(JSON.stringify(user));
    hydratePersistedMemberships(profileConcurrent, [memA, memBRevoked], user.id);

    expect(getAuthorizedClientIds(profileConcurrent)).toEqual(['CLIENT_A']);
    expect(canAdminTenant(profileConcurrent, 'CLIENT_B')).toBe(false);
    expect(getMembershipForClient(profileConcurrent, 'CLIENT_A')?.role).toBe('standard_user');
  });

  it('10. Usuario legacy puro sin membresías canónicas resuelve clientId legacy de forma compatible', () => {
    const legacyPureUser: User = {
      id: 'legacy_uid',
      name: 'Legacy User',
      email: 'legacy@example.com',
      globalRole: GlobalUserRole.Member,
      clientId: 'CLIENT_LEGACY',
      dashboardAccess: { d1: DashboardRole.Viewer },
      directorTitle: '',
      subGroups: [],
      superGroups: [],
      canManageKPIs: false,
      canExportPPT: false,
    };

    const resolution = resolveEffectiveMemberships(legacyPureUser);
    expect(resolution.source).toBe('legacy');
    expect(getAuthorizedClientIds(legacyPureUser)).toEqual(['CLIENT_LEGACY']);
    expect(getMembershipForClient(legacyPureUser, 'CLIENT_LEGACY')?.source).toBe('legacy');
  });

  it('11. Rechazo de vinculación con datos malformados o inválidos (fail-fast seguro)', async () => {
    // ID con caracteres inseguros debe lanzar excepción sin escribir
    await expect(
      (firebaseService as any).linkUserToClient('user/1', 'CLIENT_A')
    ).rejects.toThrow();

    await expect(
      (firebaseService as any).linkUserToClient('user_1', 'CLIENT/A')
    ).rejects.toThrow();
  });
});
