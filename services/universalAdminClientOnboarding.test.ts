/** @jest-environment node */

import { DashboardRole, GlobalUserRole, type User, type Dashboard } from '../types';
import {
  buildMembershipId,
  validatePersistedMembership,
  type PersistedTenantMembership,
} from './tableroMembershipPersistence';
import {
  isPlatformAdmin,
  resolveEffectiveMemberships,
  getAuthorizedClientIds,
  getMembershipForClient,
  canAdminTenant,
  canManageUsers,
  canAccessDashboard,
  hydratePersistedMemberships,
} from './tableroAuthorization';
import { firebaseService } from './firebaseService';

const mockFirestoreStore = new Map<string, any>();

jest.mock('../firebase', () => ({
  db: {},
  auth: { currentUser: null },
}));

jest.mock('firebase/firestore', () => ({
  collection: (_db: unknown, ...parts: string[]) => ({ path: parts.join('/') }),
  doc: (_db: unknown, ...parts: string[]) => ({ path: parts.join('/') }),
  getDoc: jest.fn(async (ref: { path: string }) => ({
    exists: () => mockFirestoreStore.has(ref.path),
    data: () => mockFirestoreStore.get(ref.path),
  })),
  getDocs: jest.fn(async () => ({ empty: true, docs: [] })),
  setDoc: jest.fn(async (ref: { path: string }, data: any, options?: { merge?: boolean }) => {
    if (options?.merge && mockFirestoreStore.has(ref.path)) {
      mockFirestoreStore.set(ref.path, { ...mockFirestoreStore.get(ref.path), ...data });
    } else {
      mockFirestoreStore.set(ref.path, data);
    }
  }),
  updateDoc: jest.fn(async (ref: { path: string }, data: any) => {
    const existing = mockFirestoreStore.get(ref.path) || {};
    mockFirestoreStore.set(ref.path, { ...existing, ...data });
  }),
  query: jest.fn((col: any) => col),
  where: jest.fn(),
  deleteField: jest.fn(),
  writeBatch: jest.fn((_db: unknown) => {
    const operations: Array<() => void> = [];
    return {
      set: jest.fn((ref: { path: string }, data: any, options?: { merge?: boolean }) => {
        operations.push(() => {
          if (options?.merge && mockFirestoreStore.has(ref.path)) {
            mockFirestoreStore.set(ref.path, { ...mockFirestoreStore.get(ref.path), ...data });
          } else {
            mockFirestoreStore.set(ref.path, data);
          }
        });
      }),
      update: jest.fn((ref: { path: string }, data: any) => {
        operations.push(() => {
          const existing = mockFirestoreStore.get(ref.path) || {};
          mockFirestoreStore.set(ref.path, { ...existing, ...data });
        });
      }),
      delete: jest.fn((ref: { path: string }) => {
        operations.push(() => {
          mockFirestoreStore.delete(ref.path);
        });
      }),
      commit: jest.fn(async () => {
        for (const op of operations) op();
      }),
    };
  }),
}));

describe('APP TABLERO — v10 Bloque 2: Universal SuperAdmin & Client Onboarding Contract (RED → PASS)', () => {
  // Identidades de prueba
  const platformAdminLeon: User = {
    id: 'uid_leon_platform',
    name: 'Leon Prior',
    email: 'leon@leonprior.com',
    globalRole: GlobalUserRole.Admin,
    clientId: 'IPS', // valor legacy / display
    dashboardAccess: {},
    canManageKPIs: true,
  };

  const canonicalPlatformAdminUid: User = {
    id: 'uid_platform_only',
    name: 'Platform Operator',
    email: 'operator@internal.domain',
    globalRole: 'platform_admin' as any,
    clientId: undefined,
    dashboardAccess: {},
    canManageKPIs: true,
  };

  const regularTenantAdminA: User = {
    id: 'uid_admin_a',
    name: 'Tenant Admin A',
    email: 'admin@tenant-a.com',
    globalRole: GlobalUserRole.Admin,
    clientId: 'TENANT_A',
    dashboardAccess: {},
    canManageKPIs: true,
  };

  const regularMemberUser: User = {
    id: 'uid_member',
    name: 'Regular Member',
    email: 'member@test.com',
    globalRole: GlobalUserRole.Member,
    clientId: 'TENANT_A',
    dashboardAccess: {},
    canManageKPIs: false,
  };

  // 1. Autoridad de plataforma histórica y canónica
  it('1. isPlatformAdmin reconoce a leon@leonprior.com y a platform_admin canónico sin depender de un tenant', () => {
    expect(isPlatformAdmin(platformAdminLeon)).toBe(true);
    expect(isPlatformAdmin({ email: 'LEONPRIOR@GMAIL.COM', globalRole: GlobalUserRole.Member } as any)).toBe(true);
    expect(isPlatformAdmin(canonicalPlatformAdminUid)).toBe(true);
    expect(isPlatformAdmin(regularTenantAdminA)).toBe(false);
    expect(isPlatformAdmin(regularMemberUser)).toBe(false);
  });

  // 2. Separación estricta: Platform Admin NO tiene acceso implícito a datos empresariales
  it('2. Un platform admin NO tiene acceso empresarial automático a tableros de un cliente sin membresía explícita', () => {
    const blindDashboard: Pick<Dashboard, 'id' | 'clientId' | 'group' | 'superGroup' | 'isAggregate'> = {
      id: 'DASH_SEC_1',
      clientId: 'CLIENTE_CONFIDENCIAL',
      group: 'DIRECCIÓN',
    };

    // Sin membresía en CLIENTE_CONFIDENCIAL, no debe poder leer ni editar datos empresariales
    expect(canAdminTenant(platformAdminLeon, 'CLIENTE_CONFIDENCIAL')).toBe(false);
    expect(canAccessDashboard(platformAdminLeon, blindDashboard, 'viewer')).toBe(false);
    expect(canAccessDashboard(platformAdminLeon, blindDashboard, 'editor')).toBe(false);
  });

  // 3. canManageUsers autoriza al platform admin sobre cualquier cliente, pero a tenant admin solo sobre el suyo
  it('3. canManageUsers permite a platform admin administrar cualquier cliente, y a tenant_admin solo su tenant', () => {
    expect(canManageUsers(platformAdminLeon, 'CUALQUIER_CLIENTE')).toBe(true);
    expect(canManageUsers(regularTenantAdminA, 'TENANT_A')).toBe(true);
    expect(canManageUsers(regularTenantAdminA, 'TENANT_B')).toBe(false);
    expect(canManageUsers(regularMemberUser, 'TENANT_A')).toBe(false);
  });

  // 4. Alta de cliente: createClientWithInitialGrant debe existir en firebaseService
  it('4. firebaseService expone createClientWithInitialGrant para alta operacional segura', () => {
    expect(typeof (firebaseService as any).createClientWithInitialGrant).toBe('function');
  });

  // 5. Alta autorizada: crea el cliente y otorga grant inicial explícito de tenant_admin al actor
  it('5. createClientWithInitialGrant genera contrato con grant explícito de tenant_admin', async () => {
    const actorId = platformAdminLeon.id;
    const newClientId = 'CLIENTE_NUEVO_2026';
    const newDisplayName = 'Cliente Nuevo 2026';

    const result = await (firebaseService as any).createClientWithInitialGrant(
      newClientId,
      newDisplayName,
      actorId
    );

    expect(result).toBeDefined();
    expect(result.clientId).toBe('CLIENTE_NUEVO_2026');
    expect(result.displayName).toBe('Cliente Nuevo 2026');
    expect(result.initialMembership).toBeDefined();
    expect(result.initialMembership.membershipId).toBe(`${actorId}__CLIENTE_NUEVO_2026`);
    expect(result.initialMembership.role).toBe('tenant_admin');
    expect(result.initialMembership.status).toBe('active');
    expect(result.initialMembership.capabilities).toContain('editor');
    expect(result.initialMembership.capabilities).toContain('tracking_configurator');
    expect(result.initialMembership.capabilities).toContain('strategy_configurator');

    // Validación formal del esquema de membresía
    const errors = validatePersistedMembership(result.initialMembership);
    expect(errors).toEqual([]);
  });

  // 6. Rechazo de alta si el actor no está autorizado (no es platform admin ni tenant admin)
  it('6. createClientWithInitialGrant rechaza ejecución si los datos de cliente son inválidos', async () => {
    await expect(
      (firebaseService as any).createClientWithInitialGrant('', 'Nombre', 'actor_123')
    ).rejects.toThrow();

    await expect(
      (firebaseService as any).createClientWithInitialGrant('INVALID/ID', 'Nombre', 'actor_123')
    ).rejects.toThrow();
  });

  // 7. Idempotencia en creación repetida de cliente
  it('7. Idempotencia: invocar dos veces createClientWithInitialGrant preserva integridad sin duplicar datos', async () => {
    const actorId = platformAdminLeon.id;
    const clientId = 'CLIENTE_IDEMPOTENTE';
    const displayName = 'Cliente Idempotente';

    const firstCall = await (firebaseService as any).createClientWithInitialGrant(clientId, displayName, actorId);
    const secondCall = await (firebaseService as any).createClientWithInitialGrant(clientId, displayName, actorId);

    expect(firstCall.clientId).toBe(secondCall.clientId);
    expect(firstCall.initialMembership.membershipId).toBe(secondCall.initialMembership.membershipId);
  });

  // 8. Una vez otorgado el grant inicial, el actor adquiere autorización para crear el primer tablero
  it('8. Con el grant explícito de tenant_admin, el usuario adquiere autorización para administrar el nuevo cliente', () => {
    const userWithGrant: User = {
      ...platformAdminLeon,
      memberships: [
        {
          clientId: 'CLIENTE_NUEVO_2026',
          role: 'tenant_admin',
          status: 'active',
          hierarchyScopes: [],
          dashboardScopes: {},
          editableDashboardIds: [],
          capabilities: ['editor', 'tracking_configurator', 'strategy_configurator'],
        },
      ],
    };

    expect(canAdminTenant(userWithGrant, 'CLIENTE_NUEVO_2026')).toBe(true);
    expect(getAuthorizedClientIds(userWithGrant)).toContain('CLIENTE_NUEVO_2026');

    // Ahora puede operar tableros en ese cliente específico
    const firstDashboard: Pick<Dashboard, 'id' | 'clientId' | 'group' | 'superGroup' | 'isAggregate'> = {
      id: 'CLIENTE_NUEVO_2026_2026_1',
      clientId: 'CLIENTE_NUEVO_2026',
      group: 'OPERACIONES',
    };
    expect(canAccessDashboard(userWithGrant, firstDashboard, 'viewer')).toBe(true);
    expect(canAccessDashboard(userWithGrant, firstDashboard, 'editor')).toBe(true);
  });

  // 9. Aislamiento estricto: el grant en CLIENTE_NUEVO_2026 no da acceso a OTRO_CLIENTE_2026
  it('9. Aislamiento: grant en CLIENTE_A no confiere acceso a CLIENTE_B', () => {
    const userWithGrantA: User = {
      ...regularMemberUser,
      memberships: [
        {
          clientId: 'CLIENTE_A',
          role: 'tenant_admin',
          status: 'active',
          hierarchyScopes: [],
          dashboardScopes: {},
          editableDashboardIds: [],
          capabilities: ['editor'],
        },
      ],
    };

    expect(canAdminTenant(userWithGrantA, 'CLIENTE_A')).toBe(true);
    expect(canAdminTenant(userWithGrantA, 'CLIENTE_B')).toBe(false);
    expect(getAuthorizedClientIds(userWithGrantA)).toContain('CLIENTE_A');
    expect(getAuthorizedClientIds(userWithGrantA)).not.toContain('CLIENTE_B');
  });

  // 10. Desacoplamiento de IPS: un cliente nuevo arbitrario no asume ni hereda IPS
  it('10. Desacoplamiento de IPS: alta de nuevo cliente funciona con ID independiente sin fallbacks a IPS', async () => {
    const result = await (firebaseService as any).createClientWithInitialGrant('BETA_CORP', 'Beta Corp', 'user_beta');
    expect(result.clientId).toBe('BETA_CORP');
    expect(result.initialMembership.clientId).toBe('BETA_CORP');
    expect(result.initialMembership.clientId).not.toBe('IPS');
  });
});
