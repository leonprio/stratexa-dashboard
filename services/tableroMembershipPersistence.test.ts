import { GlobalUserRole, type User } from '../types';
import { buildMembershipId, classifyParity, createDryRunManifestEntry, validatePersistedMembership } from './tableroMembershipPersistence';

const user = (overrides: Partial<User> = {}): User => ({ id: 'uid-1', name: 'U', email: 'u@test', globalRole: GlobalUserRole.Member, clientId: 'A', dashboardAccess: {}, ...overrides });

describe('canonical membership persistence contract', () => {
  it('uses stable userId/clientId IDs and permits role changes without ID churn', () => {
    expect(buildMembershipId('uid-1', 'a')).toBe('uid-1__A');
    expect(buildMembershipId('uid-1', 'a')).toBe(buildMembershipId('uid-1', 'a'));
  });
  it('rejects unsafe IDs and platform tenant memberships', () => {
    expect(() => buildMembershipId('uid/1', 'A')).toThrow();
    const value: any = { membershipId: 'uid-1__A', userId: 'uid-1', clientId: 'A', role: 'platform_admin', status: 'active', scopeType: 'tenant', allowedDashboardIds: [], hierarchyScopeKeys: [], capabilities: [], createdAt: 'x', createdBy: 'x', updatedAt: 'x', updatedBy: 'x', schemaVersion: 1 };
    expect(validatePersistedMembership(value)).toContain('platform_admin must not be persisted as a tenant membership.');
  });
  it('creates independent entries for multiple legacy tenants', () => {
    expect(createDryRunManifestEntry(user({ clientId: 'A,B' })).map(x => x.proposedMembershipId)).toEqual(['uid-1__A', 'uid-1__B']);
  });
  it('flags wildcard and hierarchy text for migration review', () => {
    const entries = createDryRunManifestEntry(user({ clientId: 'ALL', directorTitle: 'OPERACIONES', globalRole: GlobalUserRole.Director }));
    expect(entries[0].requiresManualReview).toBe(true);
    expect(entries[0].proposedMembershipId).toBeUndefined();
  });
  it('keeps platform authority separate from tenant memberships', () => {
    expect(createDryRunManifestEntry(user({ email: 'leon@leonprior.com', globalRole: GlobalUserRole.Admin }))[0].status).toBe('not_applicable');
  });
  it('classifies parity and blocks unexpected expansion', () => {
    expect(classifyParity(['A:1'], ['A:1'])).toBe('SAME');
    expect(classifyParity(['A:1', 'A:2'], ['A:1'], ['A:2'])).toBe('INTENTIONAL_RESTRICTION');
    expect(classifyParity(['A:1'], ['A:1', 'A:2'])).toBe('UNEXPECTED_EXPANSION');
    expect(classifyParity(['A:1'], [])).toBe('AMBIGUOUS');
  });
});
