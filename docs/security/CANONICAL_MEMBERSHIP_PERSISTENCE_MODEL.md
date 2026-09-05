# Canonical membership persistence model

Status: local schema design and test only. No Firestore data migration, Auth change, Rules deployment, or production write.

## Decision

Select **Option B: normalized top-level membership documents**:

```text
tbl_userMemberships/{userId}__{CLIENT_ID}
```

Option C (nested under user or tenant) is rejected as the primary authority because both user-centric membership lookup and tenant-centric directory queries are needed; a top-level collection gives a deterministic Rules document lookup and a direct `clientId` query. A future collection-group index is optional, not required for the first Rules path.

| Option | Rules lookup | Queries / scale | Mutation safety / audit | Decision |
|---|---|---|---|---|
| A. `memberships[]` in `tbl_users` | Requires reading the whole profile and array scans; awkward for target-user and tenant queries | Easy profile read, poor tenant directory scale and array growth | One document is easy to update but creates a high-value self-escalation target; audit granularity is weak | Compatibility input only |
| B. `tbl_userMemberships` | Exact `get(.../{uid}__{clientId})`; immutable key and cheap active/role checks | One document per user/tenant; direct tenant queries and independent multi-client lifecycle | Per-membership audit metadata and Rules constraints; role changes do not change ID | **Canonical** |
| C. nested membership documents | User lookup is easy under `tbl_users/{uid}`, tenant queries require collection-group/index and more complex Rules | Good user scale; tenant operations and cross-parent queries are more coupled | Better isolation than arrays, but parent-path and collection-group policy increases migration/Rules complexity | Not primary; possible future read model |

This shape preserves future confidentiality separation: `business_reader`, `confidential_reader` and `temporary_support_grant` are not fields implied by the role. If grants are later persisted, they should be separate protected records or explicit audited capabilities, not a tenant-admin boolean.

## Exact document schema

```text
tbl_userMemberships/{userId}__{CLIENT_ID}
{
  membershipId: "uid-1__CLIENT_A",
  userId: "uid-1",                    // immutable Auth UID
  clientId: "CLIENT_A",               // immutable normalized tenant ID
  role: "tenant_admin" | "director" | "standard_user",
  status: "active" | "inactive" | "suspended",
  scopeType: "tenant" | "hierarchy" | "dashboard",
  directionId?: string,                // only after canonical IDs exist
  directionName?: string,              // descriptive compatibility metadata
  areaId?: string,                      // only after canonical IDs exist
  areaName?: string,                    // descriptive compatibility metadata
  allowedDashboardIds: string[],
  hierarchyScopeKeys: string[],
  capabilities: ["viewer" | "editor" | "metadata_editor" | "plan_editor" | "strategy_reader"],
  createdAt: timestamp,
  createdBy: string,                    // Auth UID / privileged actor
  updatedAt: timestamp,
  updatedBy: string,
  schemaVersion: 1
}
```

`directionId` and `areaId` remain optional because no canonical production identifiers currently exist. The legacy names cannot be silently promoted into authorization IDs. The local schema validator rejects platform admin as a tenant membership and requires deterministic ID/version/status fields.

## Stable identity and ID

Firebase Auth UID is the authoritative `userId`. The existing profile convention is `tbl_users/{uid}` in the tested paths; no identifier rewrite was performed or authorized. Any historical profile whose document ID differs from its Auth UID is `MIGRATION_REVIEW_REQUIRED`, not auto-linked.

`membershipId = {Auth UID}__{normalized clientId}`. It contains no role, email, display name or hierarchy label. Therefore role/status/scope changes do not create duplicates or churn the document ID. The local builder rejects empty values, slash/backslash path separators and oversized components.

`platform_admin` is not represented by fake memberships for every tenant. For the shared project, the current exact platform identity remains a compatibility input. The recommended future authoritative source is a dedicated protected `tbl_platformAdmins/{uid}` record managed by a server-controlled lifecycle path, with optional custom claims only after a shared-project impact review. A custom claim is attractive for cheap Rules checks but is global across Gobernanza/Vacantes/Activador and has propagation/revocation delay; it must not be introduced casually. A profile field is rejected because the profile is a user-facing authorization target. A protected platform-admin collection is the least coupled migration path.

## Rules lookup contract

Future Rules may resolve one exact membership:

```text
get(/databases/$(database)/documents/tbl_userMemberships/$(request.auth.uid + '__' + clientId)).data
```

The actual Rules expression should use a safe, normalized client ID and validate `userId == request.auth.uid`, `clientId == requested tenant`, `status == 'active'`, and the required role/capability. Dashboard and hierarchy scope should be checked against the requested document, never against a client-provided union.

This is deterministic and bounded: one membership lookup plus the existing parent lookup where needed. Repeated `get()` calls count toward Firestore Rules access-call limits, so shared helper reuse and one membership lookup per match are required. Query authorization still needs a query shape whose constraints imply the Rule; Rules do not filter arbitrary results after reading. Composite indexes may be required for combined tenant/status/scope queries and must be provisioned separately after emulator and production-index review.

## Protected fields and mutation contract

Normal users cannot write membership documents or alter `userId`, `clientId`, role, status, scope type, hierarchy scopes, dashboard scopes, capabilities, audit actor fields or timestamps. Tenant admins can create/update/disable only memberships for their own tenant, cannot grant `platform_admin`, cannot target another tenant, and cannot broaden outside the tenant. Directors cannot mutate their own or anyone's authority scope. Platform management is explicit and audited.

Future lifecycle events: `membership_created`, `membership_disabled`, `role_changed`, `scope_changed`, `tenant_membership_added`, `tenant_membership_removed`. Required metadata is actor UID, target UID, tenant, old/new authorization values, reason/ticket, timestamp, correlation ID and outcome. KPI/plan contents, secrets and full profile payloads must not enter logs.

## Legacy transformation and dry-run manifest

- `Admin` → `tenant_admin`, except the current exact platform identity, which is `platform_admin` and produces no tenant memberships.
- `Director` → `director`; legacy `directorTitle`, `subGroups`, `superGroups` become provisional hierarchy text and require review until canonical IDs exist.
- `Member` and recognized normal-user aliases → `standard_user`.
- A comma-separated `clientId` produces one independent proposed membership per safe tenant ID.
- `all`/`ALL`, empty/invalid client IDs, unknown roles, non-UID profile IDs, and ambiguous hierarchy names produce `requiresManualReview = true` and no proposed membership ID.
- Legacy dashboard `Viewer`/`Editor` values become `allowedDashboardIds` with their capability; no union with canonical data is produced when canonical memberships exist.

The local dry-run entry contains: `uid`, `profileId`, current role/clientId, proposed membership ID/role/scopes, status, confidence, warnings and `requiresManualReview`. It creates no Firestore reference writes and does not mutate profiles.

Parity is classified as `SAME`, `INTENTIONAL_RESTRICTION`, `AMBIGUOUS`, or `UNEXPECTED_EXPANSION`. Any unexpected canonical expansion is a hard blocker. Missing legacy access is not silently repaired by adding broad tenant scope.

## Rollout and rollback design (not executed)

1. Back up the source export and generate a read-only manifest.
2. Create canonical records in a controlled, idempotent batch with preconditions; record the manifest and audit events.
3. Verify legacy vs canonical effective access and query result IDs, with zero unexpected expansions.
4. Enable canonical-first dual-read while retaining legacy read-only fallback.
5. Cut over privileged writes to membership records; retain a rollback window.
6. Roll back by disabling canonical records and re-enabling the verified legacy adapter, never by deleting source data.
7. Retire legacy authorization only after signed parity evidence and a defined recovery window.

No phase above was executed in this task.

## Local implementation and validation

Added pure local schema/helpers in `services/tableroMembershipPersistence.ts` and tests in `services/tableroMembershipPersistence.test.ts`. No automatic dual-write or Firestore write call exists. Existing canonical compatibility tests remain intact.

- Persistence tests: **6 tests PASS**.
- Combined canonical resolver/read-scope/persistence tests: **22 tests PASS**.
- Build: **PASS**.
- Diff-check: **PASS**.
- TypeScript: existing baseline diagnostics remain in unrelated tests/utilities; no diagnostics point to the new persistence module.
- Existing Rules suite: **53 PASS** from the unchanged local hardening validation.

## Blockers before a dry-run migration

- Confirm/provision canonical hierarchy and area IDs; do not invent production IDs.
- Reconcile legacy profile IDs against Auth UID inventory.
- Approve platform-admin authority for the shared Firebase project.
- Define required Firestore indexes and Rules implementation against the final collection.
- Resolve normalized Director compatibility and metadata editor parity.
- Complete authenticated startup tests for standard user, tenant admin, Director and platform admin.

Classification: **CANONICAL_MEMBERSHIP_PERSISTENCE_READY_FOR_DRY_RUN** only as a local design/schema artifact. It is not ready for live migration or deployment.

Firestore data writes: 0. Auth changes: 0. Storage/Functions changes: 0. Deploy: NONE. Commit: NONE. Push/merge/tag: NONE.
