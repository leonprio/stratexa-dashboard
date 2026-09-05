import type { Dashboard, User } from '../types';

export type CanonicalRole = 'platform_admin' | 'tenant_admin' | 'director' | 'standard_user';
export type MembershipStatus = 'active' | 'inactive' | 'suspended';
export type ScopeCapability = 'viewer' | 'editor' | 'metadata_editor' | 'plan_editor' | 'strategy_reader';

export interface TenantMembership {
  clientId: string;
  role: Exclude<CanonicalRole, 'platform_admin'>;
  status: MembershipStatus;
  hierarchyScopes: string[];
  dashboardScopes: Record<string, 'viewer' | 'editor'>;
  capabilities: ScopeCapability[];
  source: 'canonical' | 'legacy';
}

export interface EffectiveMembershipResolution {
  role: CanonicalRole | null;
  memberships: TenantMembership[];
  source: 'canonical' | 'legacy' | 'none';
  contradictoryHybrid: boolean;
  needsMigrationReview: boolean;
}

const platformEmails = new Set(['leon@leonprior.com', 'leonprior@gmail.com']);
const validRoles = new Set<CanonicalRole>(['platform_admin', 'tenant_admin', 'director', 'standard_user']);

const normalizeClient = (value: unknown): string => String(value || '').trim().toUpperCase();
const normalizeRole = (value: unknown): CanonicalRole | null => {
  const role = String(value || '').trim().toLowerCase();
  if (role === 'platform_admin' || role === 'superadmin' || role === 'super_admin') return 'platform_admin';
  if (role === 'tenant_admin' || role === 'admin') return 'tenant_admin';
  if (role === 'director') return 'director';
  if (role === 'standard_user' || role === 'member' || role === 'user' || role === 'normal') return 'standard_user';
  return null;
};

const canonicalMembership = (membership: NonNullable<User['memberships']>[number]): TenantMembership | null => {
  const clientId = normalizeClient(membership.clientId);
  const role = normalizeRole(membership.role);
  if (!clientId || !role || role === 'platform_admin') return null;
  const status = membership.status;
  if (!['active', 'inactive', 'suspended'].includes(status)) return null;
  return {
    clientId,
    role,
    status,
    hierarchyScopes: [...new Set((membership.hierarchyScopes || []).map(String).map(s => s.trim()).filter(Boolean))],
    dashboardScopes: { ...(membership.dashboardScopes || {}) },
    capabilities: [...new Set((membership.capabilities || []).filter((x): x is ScopeCapability =>
      ['viewer', 'editor', 'metadata_editor', 'plan_editor', 'strategy_reader'].includes(x)))],
    source: 'canonical',
  };
};

function legacyMemberships(profile: User): TenantMembership[] {
  if (isPlatformAdmin(profile)) return [];
  const role = normalizeRole(profile.globalRole);
  const clientIds = String(profile.clientId || '').split(',').map(normalizeClient).filter(id => id && id !== 'ALL');
  if (!role || role === 'platform_admin' || clientIds.length === 0) return [];
  const dashboardScopes = Object.fromEntries(Object.entries(profile.dashboardAccess || {})
    .filter(([, access]) => access === 'Viewer' || access === 'Editor')
    .map(([id, access]) => [id, access === 'Editor' ? 'editor' : 'viewer'] as const));
  const hierarchyScopes = [profile.directorTitle, ...(profile.subGroups || []), ...(profile.superGroups || [])]
    .map(s => String(s || '').trim()).filter(Boolean);
  return clientIds.map(clientId => ({
    clientId,
    role: role === 'tenant_admin' ? 'tenant_admin' : role,
    status: 'active',
    hierarchyScopes: [...new Set(hierarchyScopes)],
    dashboardScopes,
    capabilities: [
      ...new Set([
        ...(role === 'director' ? ['metadata_editor'] : []),
        ...Object.values(dashboardScopes).map(x => x === 'editor' ? 'editor' : 'viewer'),
      ] as ScopeCapability[]),
    ],
    source: 'legacy',
  }));
}

export function isPlatformAdmin(profile: Pick<User, 'email' | 'globalRole'>): boolean {
  return platformEmails.has(String(profile.email || '').trim().toLowerCase()) || normalizeRole(profile.globalRole) === 'platform_admin';
}

/** Compatibility API: email never grants business or confidential access. */
export function hasLegacyPlatformBusinessReadBridge(profile: Pick<User, 'email'>): boolean {
  return false;
}

export function canReadBusinessData(profile: User, clientId: string): boolean {
  return getMembershipForClient(profile, clientId) !== null;
}

export function resolveEffectiveMemberships(profile: User): EffectiveMembershipResolution {
  const canonical = (profile.memberships || []).map(canonicalMembership);
  const hasCanonicalInput = (profile.memberships || []).length > 0;
  const validCanonical = canonical.filter((x): x is TenantMembership => x !== null);
  const legacy = legacyMemberships(profile);
  if (hasCanonicalInput) {
    const invalid = validCanonical.length !== profile.memberships!.length;
    const canonicalClientSet = new Set(validCanonical.map(m => m.clientId));
    const nonReplacedLegacy = legacy.filter(m => !canonicalClientSet.has(m.clientId));
    const mergedMemberships = [...validCanonical, ...nonReplacedLegacy];
    const legacyKeys = new Set(legacy.map(m => `${m.clientId}:${m.role}`));
    const canonicalKeys = new Set(validCanonical.map(m => `${m.clientId}:${m.role}`));
    const contradictoryHybrid = invalid || (legacy.length > 0 && [...legacyKeys].some(k => !canonicalKeys.has(k)));
    return {
      role: validCanonical[0]?.role || nonReplacedLegacy[0]?.role || null,
      memberships: mergedMemberships,
      source: nonReplacedLegacy.length > 0 ? (validCanonical.length > 0 ? 'canonical' : 'legacy') : 'canonical',
      contradictoryHybrid,
      needsMigrationReview: contradictoryHybrid,
    };
  }
  return { role: legacy[0]?.role || null, memberships: legacy, source: legacy.length ? 'legacy' : 'none', contradictoryHybrid: false, needsMigrationReview: false };
}

export function getAuthorizedClientIds(profile: User): string[] {
  return [...new Set(resolveEffectiveMemberships(profile).memberships.filter(m => m.status === 'active').map(m => m.clientId))];
}

export function getMembershipForClient(profile: User, clientId: string): TenantMembership | null {
  const target = normalizeClient(clientId);
  return resolveEffectiveMemberships(profile).memberships.find(m => m.clientId === target && m.status === 'active') || null;
}

export function canAdminTenant(profile: User, clientId: string): boolean {
  return getMembershipForClient(profile, clientId)?.role === 'tenant_admin';
}

export function canAccessDashboard(profile: User, dashboard: Pick<Dashboard, 'id' | 'clientId' | 'group' | 'superGroup'>, capability: 'viewer' | 'editor' = 'viewer'): boolean {
  const membership = getMembershipForClient(profile, dashboard.clientId || '');
  if (!membership) return false;
  if (membership.role === 'tenant_admin') return true;
  const direct = membership.dashboardScopes[String(dashboard.id)];
  if (direct === 'editor' || direct === 'viewer') return capability === 'viewer' || direct === 'editor';
  return membership.role === 'director' && membership.hierarchyScopes.includes(String(dashboard.group || dashboard.superGroup || '').trim());
}

export function canManageUsers(profile: User, targetClientId: string): boolean { return isPlatformAdmin(profile) || canAdminTenant(profile, targetClientId); }
export function canAccessStrategy(profile: User, clientId: string): boolean {
  const membership = getMembershipForClient(profile, clientId);
  return membership?.role === 'tenant_admin' || membership?.capabilities.includes('strategy_reader') || false;
}

export { validRoles };
