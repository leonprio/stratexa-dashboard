import type { User } from '../types';
import {
  isPlatformAdmin,
  resolveEffectiveMemberships,
  type CanonicalRole,
  type MembershipStatus,
  type TenantMembership,
} from './tableroAuthorization';

export type MembershipScopeType = 'tenant' | 'hierarchy' | 'dashboard';

/** Persistence contract only. This module deliberately contains no Firestore writes. */
export interface PersistedTenantMembership {
  membershipId: string;
  userId: string;
  clientId: string;
  role: Exclude<CanonicalRole, 'platform_admin'>;
  status: MembershipStatus;
  scopeType: MembershipScopeType;
  directionId?: string;
  directionName?: string;
  areaId?: string;
  areaName?: string;
  allowedDashboardIds: string[];
  hierarchyScopeKeys: string[];
  capabilities: TenantMembership['capabilities'];
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  schemaVersion: 1;
}

export interface MigrationManifestEntry {
  uid: string;
  profileId: string;
  currentRole?: string;
  currentClientId?: string;
  proposedMembershipId?: string;
  proposedCanonicalRole?: Exclude<CanonicalRole, 'platform_admin'>;
  proposedScopes: { hierarchyScopeKeys: string[]; allowedDashboardIds: string[] };
  status: MembershipStatus | 'not_applicable';
  transformationConfidence: 'high' | 'medium' | 'low';
  warnings: string[];
  requiresManualReview: boolean;
}

const safePart = (value: string, name: string): string => {
  const result = value.trim();
  if (!result || result.includes('/') || result.includes('\\') || result.length > 500) throw new Error(`Invalid ${name}.`);
  return result;
};

export function buildMembershipId(userId: string, clientId: string): string {
  return `${safePart(userId, 'userId')}__${safePart(clientId.trim().toUpperCase(), 'clientId')}`;
}

export function validatePersistedMembership(value: PersistedTenantMembership): string[] {
  const errors: string[] = [];
  if ((value as { role?: unknown }).role === 'platform_admin') errors.push('platform_admin must not be persisted as a tenant membership.');
  if (value.membershipId !== buildMembershipId(value.userId, value.clientId)) errors.push('membershipId must be deterministic from userId and clientId.');
  if (!['active', 'inactive', 'suspended'].includes(value.status)) errors.push('Invalid membership status.');
  if (!['tenant', 'hierarchy', 'dashboard'].includes(value.scopeType)) errors.push('Invalid scopeType.');
  if (value.schemaVersion !== 1) errors.push('Unsupported schemaVersion.');
  if (value.userId.trim() === '' || value.clientId.trim() === '') errors.push('userId and clientId are required.');
  return errors;
}

function legacyEntry(profile: User, membership: TenantMembership): MigrationManifestEntry {
  const warnings: string[] = [];
  const rawClientId = String(profile.clientId || '');
  if (/all/i.test(rawClientId)) warnings.push('Wildcard clientId cannot be transformed into a tenant membership.');
  if (profile.directorTitle || profile.subGroups?.length || profile.superGroups?.length) warnings.push('Hierarchy is legacy free text; canonical IDs require manual mapping.');
  const ambiguous = warnings.length > 0;
  return {
    uid: profile.id,
    profileId: profile.id,
    currentRole: String(profile.globalRole || ''),
    currentClientId: rawClientId,
    proposedMembershipId: ambiguous ? undefined : buildMembershipId(profile.id, membership.clientId),
    proposedCanonicalRole: membership.role,
    proposedScopes: { hierarchyScopeKeys: membership.hierarchyScopes, allowedDashboardIds: Object.keys(membership.dashboardScopes) },
    status: membership.status,
    transformationConfidence: ambiguous ? 'low' : 'high',
    warnings,
    requiresManualReview: ambiguous,
  };
}

export function createDryRunManifestEntry(profile: User): MigrationManifestEntry[] {
  if (isPlatformAdmin(profile)) return [{ uid: profile.id, profileId: profile.id, currentRole: String(profile.globalRole || ''), currentClientId: profile.clientId, proposedScopes: { hierarchyScopeKeys: [], allowedDashboardIds: [] }, status: 'not_applicable', transformationConfidence: 'high', warnings: ['Platform authority is separate from tenant memberships.'], requiresManualReview: false }];
  const resolution = resolveEffectiveMemberships(profile);
  if (resolution.memberships.length === 0) return [{ uid: profile.id, profileId: profile.id, currentRole: String(profile.globalRole || ''), currentClientId: profile.clientId, proposedScopes: { hierarchyScopeKeys: [], allowedDashboardIds: [] }, status: 'not_applicable', transformationConfidence: 'low', warnings: ['No unambiguous tenant membership found.'], requiresManualReview: true }];
  return resolution.memberships.map(m => {
    const entry = legacyEntry(profile, m);
    if (resolution.needsMigrationReview) { entry.warnings.push('Hybrid or invalid authority state requires parity review.'); entry.requiresManualReview = true; entry.transformationConfidence = 'low'; entry.proposedMembershipId = undefined; }
    return entry;
  });
}

export type ParityClassification = 'SAME' | 'INTENTIONAL_RESTRICTION' | 'AMBIGUOUS' | 'UNEXPECTED_EXPANSION';
export function classifyParity(legacyIds: string[], canonicalIds: string[], intentionalRestrictions: string[] = []): ParityClassification {
  const legacy = new Set(legacyIds); const canonical = new Set(canonicalIds); const restricted = new Set(intentionalRestrictions);
  if ([...canonical].some(id => !legacy.has(id) && !restricted.has(id))) return 'UNEXPECTED_EXPANSION';
  if ([...legacy].some(id => !canonical.has(id) && !restricted.has(id))) return 'AMBIGUOUS';
  if ([...legacy].some(id => !canonical.has(id))) return 'INTENTIONAL_RESTRICTION';
  return 'SAME';
}
