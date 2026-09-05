# Canonical access model and multi-tenant administration contract

Status: design approved for implementation planning, not a data migration or deployment instruction.

Base revision: `14c17cbd53e1673b1416d0e62546d77f19d88228` on `feature/transversal-action-plans`.
Scope: APP TABLERO `tbl_*` only. The Firebase project is shared; Storage, Firebase Auth identity operations, Functions identity behavior, `cpx_*`, `vac_*`, `stx_*`, and legacy collections are out of scope.

## 1. Current profile inventory

The current source of profile data is `tbl_users/{uid}`. It mixes identity, tenant membership, role, business hierarchy, UI capability flags, and legacy fields in one document.

| Current field | Classification | Current use / risk |
| --- | --- | --- |
| document ID / `id` | AUTHORIZATION_CRITICAL | Must equal Firebase Auth UID. It identifies the authority document. |
| `email` | AUTHORIZATION_SUPPORTING | Identity/display and current platform allowlist comparison; it is not a secure substitute for a custom claim. |
| `globalRole` (`Admin`, `Director`, `Member`) | AUTHORIZATION_CRITICAL | Conflates tenant administration and platform-like behavior in current UI. |
| `clientId` | AUTHORIZATION_CRITICAL, LEGACY | Single tenant or comma-separated membership; `all`/`ALL` wildcard exists. Not a normalized membership model. |
| `dashboardAccess` | AUTHORIZATION_CRITICAL | Dashboard document ID or legacy `originalId` to `Viewer`/`Editor`. |
| `directorTitle`, `subGroups`, `superGroups` | AUTHORIZATION_CRITICAL | Business scope. Current comparisons normalize text on the client, which Rules cannot safely reproduce. |
| `group`, `area` | AUTHORIZATION_SUPPORTING / LEGACY | Hierarchy fallback and display. Currently free-text and not a reliable permission key. |
| `name` | PROFILE_METADATA | Display name. |
| `canManageKPIs`, `canExportPPT` | AUTHORIZATION_SUPPORTING | Product capability flags; should become named tenant entitlements, not self-editable flags. |
| missing `status`, membership audit source, canonical hierarchy IDs | UNKNOWN / required future fields | Absence prevents reliable disablement, accountable membership lifecycle and Rules-query parity. |

Current dashboards also use free-text `group`, `area`, `superGroup`, plus `clientId`; ActionPlans use `clientId` and a parent dashboard reference. Strategy records use `clientId`.

## 2. Canonical roles

Roles are scoped by membership. Platform management is separate from business or confidential data access.

| Role | Tenant scope | User management | Dashboards / KPIs | Strategy | ActionPlans | Dashboard metadata | Client switch |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `platform_admin` | Platform administration; no implicit tenant business read | Manage lifecycle and memberships through a privileged audited path | Only configuration/operational metadata unless a separate `business_reader` grant applies | No implicit strategy read/write | No implicit plan read/write | Configuration metadata only, subject to support grant | May select/manage tenants for administration, not obtain business-data access by selecting one |
| `tenant_admin` | Explicit memberships with role `tenant_admin` | Manage users and their memberships inside the same tenant; cannot grant platform authority | Tenant-wide management, including KPI/dashboard content | Tenant-scoped administration | Tenant-wide plan management | Tenant-wide metadata, including hierarchy assignment only through controlled validation | Only own active tenant memberships |
| `director` | Explicit membership plus explicit business scope | No user management by default | Read scope granted by canonical hierarchy/dashboard scope; item edit only when a named editor entitlement is granted | Read-only only by default | Create/update plans only when named `plan_editor` entitlement is granted for the related scope | May edit descriptive metadata only for dashboards in scope if `metadata_editor` entitlement exists; cannot change tenant or authorization hierarchy | Only own active tenant memberships |
| `standard_user` | Explicit membership plus direct dashboard/area scope | None | Direct assigned dashboards: Viewer or Editor; no tenant-wide query | Read only where separately assigned; otherwise none | Read/create/update only if named plan scope permits it | None | Only own active tenant memberships |

`business_reader`, `confidential_reader`, and `temporary_support_grant` are independent grants. They are not roles, are not inherited from `platform_admin`, `tenant_admin`, or `director`, and must be evaluated by server Rules/authorized backend when introduced.

## 3. Canonical multi-client membership model

The authoritative future record is a profile-owned, server-governed membership collection, not a CSV string. Recommended shape:

```text
tbl_userMemberships/{uid}_{clientId}
  uid: string                 // immutable, equals profile/Auth UID
  clientId: string            // immutable normalized tenant ID
  role: standard_user | director | tenant_admin
  status: active | disabled
  dashboardScopes: [{ dashboardId, access: viewer | editor }]
  hierarchyScopes: [{ hierarchyNodeId, access: viewer | editor | metadata_editor | plan_editor }]
  entitlements: [plan_editor, metadata_editor, strategy_reader, ...]
  grantedBy: uid
  grantedAt: timestamp
  updatedAt: timestamp
  version: 1
```

`tbl_users/{uid}` becomes identity and harmless profile metadata only, plus a non-authoritative migration summary. Platform authority should be a server-issued custom claim or a separately protected platform role source, never a user-editable profile field. The membership document is the trusted Rules source for a tenant.

Canonical hierarchy requires stable IDs, for example `tbl_hierarchyNodes/{clientId}_{nodeId}`, with immutable `clientId`, `nodeId`, `parentNodeId`, `kind`, and display label. Dashboards store `hierarchyNodeId`, not only free-text group/area/superGroup. Display text may change without silently changing entitlement.

## 4. Director contract

A Director is a tenant member with a list of hierarchy node IDs and optional named entitlements. The role is not tenant administration and is not a confidential-data permission.

- Read: only dashboards/items/action plans associated with an assigned node or explicitly assigned dashboard, constrained by tenant and requested year.
- Edit: no editing by role alone. `editor`, `plan_editor`, and `metadata_editor` must be explicit scope entitlements.
- Metadata: a Director with `metadata_editor` may change descriptive `title`, `subtitle`, and approved presentation fields on an in-scope dashboard. It may not change `clientId`, dashboard identifiers, `hierarchyNodeId`, parent/child links, scope assignments, or access controls.
- Users: no create, disable, role/membership, dashboard-grant, or hierarchy-grant capability.
- Strategy: read only with `strategy_reader`; no strategy configuration writes by default.

Until stable hierarchy IDs exist, exact string matching can preserve only a narrow temporary subset. The existing client-side `normalizeGroupName` behavior is display reconciliation, not an authorization model and must not be replicated as a Rules-wide string heuristic.

## 5. Metadata editing policy

| Field class | Standard self | Director | Tenant admin | Platform admin |
| --- | --- | --- | --- | --- |
| `name`, contact/display preferences | Own only | Own only | Own and same-tenant target | Operational profile support, audited |
| `area`, `group`, director label | No | No, except descriptive dashboard labels with explicit entitlement | Controlled tenant hierarchy assignment | Platform configuration only, not a business-scope grant |
| role / `globalRole` | No | No | Only target's same-tenant membership role; never platform | Privileged lifecycle path only |
| tenant membership | No | No | Add/remove only within their tenant; cannot move a user from another tenant | Privileged lifecycle path only |
| dashboard/hierarchy permissions | No | No | Same-tenant scopes only | Privileged lifecycle path only |
| active/disabled status | No | No | Same-tenant membership only | Privileged lifecycle path only |
| `clientId`, UID, email identity | No | No | No direct mutation; create/revoke membership or dedicated identity flow | No direct UID mutation; identity flow only |

During migration, the current profile's authorization-critical fields must remain non-self-editable. Client-side hiding is never sufficient; Rules must compare immutable old/new fields and protected membership documents.

## 6. Query and Rules contract

| Read | Standard / Director | Tenant admin | Platform admin |
| --- | --- | --- | --- |
| `getDashboards` | One tenant equality plus assigned dashboard IDs and/or hierarchy IDs; batched, no fetch-all | `where(clientId == selectedActiveMembership)` | Explicit administration metadata path; business data only with separate reader/support grant |
| `getUsers` | Own profile; Director has no directory by default | Tenant membership/profile query for its tenant | Explicit lifecycle directory path |
| ActionPlans | `where(clientId == tenant)` plus permitted dashboard/hierarchy query; no optional unscoped query | Tenant equality query | Separate explicitly authorized support/business path |
| Strategy | Explicit tenant + named strategy entitlement; no default read for normal users | Tenant equality query | Configuration metadata only unless separately granted |
| managed clients | Current active memberships only, preferably membership-derived labels | Same | Explicit tenant catalogue administration path |
| system settings | Tenant document plus safe global presentation defaults | Same, tenant writes via allowlisted fields | Global settings administration path |

Rules helpers should operate on immutable authenticated identity and trusted records:

```text
isPlatformAdmin()                    // server-issued authority, future replacement for email allowlist
activeMembership(clientId)           // membership document for request.auth.uid and tenant
hasTenantRole(clientId, role)
hasDashboardScope(clientId, dashboardId, capability)
hasHierarchyScope(clientId, nodeId, capability)
canReadBusinessData(clientId)        // membership/scope; confidentiality extension point
canReadConfidentialData(clientId)    // future separate grant only
isImmutableChange(before, after, fields)
```

Profile and membership authority must never be derived from the proposed payload. A tenant admin's ability to update a target must derive from the administrator's active membership and the target's existing same-tenant membership. Membership mutations must preserve immutable UID/client ID and reject `platform_admin` assignment outside a server-controlled route.

## 7. Anti-self-escalation invariants

1. A caller cannot create or modify the document/grant that gives the caller greater authority.
2. UID, tenant ID, platform authority, role, status, dashboard scopes, hierarchy scopes and entitlements are never standard-user self-editable.
3. Tenant admin A cannot read, modify, disable, or attach a membership owned solely by tenant B, nor assign platform authority.
4. Every normal-user query must contain an authorization-satisfying tenant/scope constraint; client selection is only context.
5. Dashboard/ActionPlan tenant IDs and parent relationships are immutable after creation.
6. Platform administration does not imply business or confidential read; temporary support must be separately approved, time-bounded, audited, and query-scoped.

## 8. Migration plan: `clientId` to memberships

1. **Schema and contract:** add types, protected membership collection, hierarchy IDs, audit event schema, Rules/query tests. No production behavior switch.
2. **Backfill preview:** produce an offline, read-only mapping from each legacy profile's single/CSV `clientId`, dashboardAccess and hierarchy strings to proposed memberships/scopes; flag `all`/`ALL`, ambiguous normalized names, duplicate email/UID and missing tenant documents.
3. **Dual read:** application prefers active memberships where present, otherwise uses a deliberately narrow legacy adapter. It must log neither sensitive data nor grant broader access.
4. **Controlled dual write:** privileged lifecycle operations write membership records and legacy compatibility fields atomically only after validation. Ordinary users never write either authority source.
5. **Verification:** compare access decisions and query result IDs for representative users/tenants, including director scope, disabled memberships, ActionPlans and strategy reads. Resolve exceptions explicitly.
6. **Cutover:** Rules and all clients require active memberships. Retain legacy fields read-only for a defined rollback window.
7. **Retirement:** remove legacy authorization use after audited verification; retain only harmless historical/display data if required.

No data migration, index creation, deployment, or Auth change is authorized by this contract.

## 9. Authorized administration flow matrix

| Flow | Actor | Target / permitted scope | Mandatory audit event |
| --- | --- | --- | --- |
| Create/invite user | Tenant admin or platform admin | Tenant admin: own tenant membership only; platform: lifecycle path | `membership.granted` / `user.invited` |
| Disable user | Tenant admin or platform admin | Existing same-tenant membership; never delete identity to revoke access | `membership.disabled` |
| Change tenant role | Tenant admin or platform admin | Same tenant; no platform role | `membership.role_changed` |
| Move area/hierarchy scope | Tenant admin | Same tenant canonical node IDs | `membership.scope_changed` |
| Add/remove client membership | Tenant admin or platform admin | Tenant admin adds/removes only own tenant; platform all tenants | `membership.granted` / `membership.revoked` |
| Reset dashboard access | Tenant admin | Same tenant dashboard scopes | `membership.dashboard_scope_changed` |
| Tenant switch | Active member | Own active memberships only | `tenant.context_selected` (low-risk telemetry; no business data payload) |
| Platform support | Platform admin plus temporary business/support grant | Grant-defined tenant, capabilities, expiry and reason | `support_grant.created`, `support_access.used`, `support_grant.revoked` |

Audit events require actor UID, target UID if any, tenant ID, old/new role or scope identifiers, reason/ticket reference, timestamp, request/correlation ID and outcome. Never include KPI values, ActionPlan content, secrets or full profile payloads in logs.

## 10. Adversarial test matrix

| Scenario | Expected result |
| --- | --- |
| Standard A reads assigned A dashboard | ALLOW |
| Standard A reads or queries B dashboard | DENY |
| Director A reads assigned hierarchy/dashboard in A | ALLOW |
| Director A reads outside assigned hierarchy in A or any B data | DENY |
| Tenant admin A manages A dashboard/user membership | ALLOW |
| Tenant admin A reads/mutates B data or B membership | DENY |
| Platform admin creates tenant/membership administration event | ALLOW through privileged path |
| Platform admin reads business KPI/plan without reader/support grant | DENY in future contract; current implementation is a known gap |
| User changes own role/membership/scope/client | DENY |
| Tenant admin grants platform authority | DENY |
| Multi-client user switches to active membership | ALLOW; all other tenant contexts DENY |
| Disabled membership reads/writes | DENY |
| Metadata editor changes descriptive in-scope field | ALLOW; tenant/hierarchy/scope change DENY |

## 11. Compatibility assessment and implementation blockers

The current local hardening is **not fully compatible** with this canonical contract: **NO**.

It is compatible with the directional principles (tenant constraints, explicit platform branch, query narrowing, no normal-user self-escalation, and `tbl_*` catch-all containment), but requires the following before implementation/deployment:

1. Stable canonical hierarchy IDs and a backfill/exception policy for normalized free-text director labels.
2. A protected membership data model and Rules/query helper implementation.
3. A decision and privileged mechanism for platform authority; the current hardcoded email approach conflates platform administration with Tablero data access.
4. Dashboard metadata field allowlist and an explicit metadata entitlement.
5. Removal/replacement of CSV and `all`/`ALL` authorization semantics after verified dual-read migration.
6. Query/index design for direct scopes, hierarchy scopes, ActionPlans and strategy capability reads, followed by emulator and authenticated-startup validation.
7. Audited lifecycle flows rather than direct mutable profile authority.

The exact blocker is **CANONICAL_MEMBERSHIP_AND_HIERARCHY_IDENTITIES_NOT_YET_PERSISTED**. This is a contract-ready design, not authorization to implement a migration.

## Safety record

Code/data writes for this phase: 0, other than this local design document. Production data writes: 0. Deploy: NONE. Commit: NONE. Push, merge and deployment: NONE.
