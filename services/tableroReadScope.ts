import { auth, db } from '../firebase';
import { doc, getDoc, where, documentId, QueryConstraint } from 'firebase/firestore';
import type { User } from '../types';
import { getAuthorizedClientIds, getMembershipForClient } from './tableroAuthorization';

const platformEmails = new Set(['leon@leonprior.com', 'leonprior@gmail.com']);
export interface TableroReadScope { platform: boolean; profile: User | null; tenants: string[] }

// This guard narrows requests, not authorization: Firestore Rules enforce access.
// Never cache profiles across sessions/tenant switches.
export async function readTableroScope(): Promise<TableroReadScope> {
  const actor = auth.currentUser;
  if (!actor) throw new Error('Sesión requerida.');
  if (platformEmails.has((actor.email || '').trim().toLowerCase())) {
    return { platform: true, profile: null, tenants: [] };
  }
  const snap = await getDoc(doc(db, 'tbl_users', actor.uid));
  if (!snap.exists()) throw new Error('Perfil Tablero requerido.');
  const profile = { ...snap.data(), id: actor.uid } as User;
  const tenants = getAuthorizedClientIds(profile);
  return { platform: false, profile, tenants };
}

export function requestedTenants(scope: TableroReadScope, selected?: string): string[] {
  const target = selected?.trim();
  if (target && !/^all$/i.test(target)) {
    if (!scope.platform && !scope.tenants.includes(target)) throw new Error('Cliente fuera del alcance autorizado.');
    return [target];
  }
  if (!scope.platform && scope.tenants.length === 0) throw new Error('Se requieren membresías tenant explícitas.');
  return scope.tenants;
}

export function dashboardQueryConstraints(scope: TableroReadScope, tenant: string): QueryConstraint[][] {
  const base = where('clientId', '==', tenant);
  const profile = scope.profile;
  const membership = profile && getMembershipForClient(profile, tenant);
  if (scope.platform || membership?.role === 'tenant_admin') return [[base]];
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
    for (const group of groups) result.push([base, where('group', '==', group)]);
  }
  return result;
}
