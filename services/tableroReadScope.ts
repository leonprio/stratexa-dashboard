import { auth, db } from '../firebase';
import { collection, query, getDocs, doc, getDoc, where, documentId, QueryConstraint } from 'firebase/firestore';
import type { User } from '../types';
import { getAuthorizedClientIds, getMembershipForClient, resolveEffectiveMemberships } from './tableroAuthorization';

const platformEmails = new Set(['leon@leonprior.com', 'leonprior@gmail.com']);
export interface TableroReadScope { platform: boolean; profile: User | null; tenants: string[] }

// This guard narrows requests, not authorization: Firestore Rules enforce access.
// Never cache profiles across sessions/tenant switches.
export async function readTableroScope(): Promise<TableroReadScope> {
  const actor = auth.currentUser;
  if (!actor) throw new Error('Sesión requerida.');
  const snap = await getDoc(doc(db, 'tbl_users', actor.uid));
  const platformRecord = await getDoc(doc(db, 'tbl_platformAdmins', actor.uid));
  const platform = platformEmails.has((actor.email || '').trim().toLowerCase()) || (platformRecord.exists() && platformRecord.data().uid === actor.uid && platformRecord.data().status === 'active');
  if (!snap.exists() && !platform) throw new Error('Perfil Tablero requerido.');
  const profile = { ...(snap.exists() ? snap.data() : {}), id: actor.uid, email: actor.email || '', ...(platform ? { globalRole: 'platform_admin' } : {}) } as User;
  const canonical = await getDocs(query(collection(db, 'tbl_userMemberships'), where('userId', '==', actor.uid)));
  const memberships = canonical.docs.map(d => d.data()).filter(m => m.userId === actor.uid);
  const replaced = new Set(memberships.map(m => m.clientId));
  // Protected records override legacy authority, including suspended memberships.
  const legacy = resolveEffectiveMemberships({ ...profile, memberships: undefined }).memberships.filter(m => !replaced.has(m.clientId));
  if (memberships.length) profile.memberships = [...legacy, ...memberships.map(m => ({
    clientId: m.clientId, role: m.role, status: m.status,
    hierarchyScopes: m.hierarchyScopeKeys || [],
    dashboardScopes: Object.fromEntries((m.allowedDashboardIds || []).map((id: string) => [id, (m.capabilities || []).includes('editor') ? 'editor' : 'viewer'])),
    capabilities: (m.capabilities || []).filter((cap: string) => cap !== 'strategy_reader' || m.scopeType === 'tenant'),
  }))];
  const tenants = getAuthorizedClientIds(profile);
  return { platform, profile, tenants };
}

export function requestedTenants(scope: TableroReadScope, selected?: string): string[] {
  const target = selected?.trim().toUpperCase();
  if (target && !/^all$/i.test(target)) {
    if (!scope.tenants.includes(target)) throw new Error('Cliente fuera del alcance autorizado.');
    return [target];
  }
  if (scope.tenants.length === 0) throw new Error('Se requieren membresías tenant explícitas.');
  return scope.tenants;
}

export function dashboardQueryConstraints(scope: TableroReadScope, tenant: string): QueryConstraint[][] {
  const base = where('clientId', '==', tenant);
  const profile = scope.profile;
  const membership = profile && getMembershipForClient(profile, tenant);
  if (membership?.role === 'tenant_admin') return [[base]];
  const result: QueryConstraint[][] = [];
  const ids = Object.keys(membership?.dashboardScopes || {});
  for (let i = 0; i < ids.length; i += 10) {
    const chunk = ids.slice(i, i + 10);
    result.push([base, where(documentId(), 'in', chunk)]);
    const originals = chunk.filter(id => /^\d+$/.test(id)).map(Number);
    if (originals.length) result.push([base, where('originalId', 'in', originals)]);
  }
  if (membership?.role === 'director') {
    const groups = [...new Set(membership.hierarchyScopes)] as string[];
    for (const group of groups) {
      if (membership.source === 'canonical') {
        result.push([base, where('directionId', '==', group)], [base, where('areaId', '==', group)]);
      } else result.push([base, where('group', '==', group)]);
    }
  }
  return result;
}
