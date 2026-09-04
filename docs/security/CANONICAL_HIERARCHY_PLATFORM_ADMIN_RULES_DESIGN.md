# Canonical hierarchy, platform authority, and membership Rules design

Status: local-only authority design. No production records, Auth changes, Rules/index deployment, or migration are authorized by this document.

## Hierarchy inventory and canonical model

| Concept | Current fields / source | Authorization today | Canonical ID | Future treatment |
| --- | --- | --- | --- | --- |
| Direction | `directorTitle`, dashboard `superGroup` | Yes, legacy Director matching | No | `tbl_directions/{directionId}` |
| Area | dashboard `area`, strategy area config | Display and association | No | `tbl_areas/{areaId}` with `directionId` parent |
| Group | dashboard `group`, `subGroups` | Yes, legacy Director matching | No | Temporary display/migration input only |
| Super-group | dashboard `superGroup`, `superGroups` | Yes, legacy Director matching | No | Temporary display/migration input only |
| Dashboard ownership | dashboard `clientId`, `group`, `area`, `superGroup` | Yes | `clientId` only | Add immutable `directionId` / `areaId` during controlled migration |

Canonical IDs are opaque immutable strings, unique only inside one tenant and never derived from a display name. A rename changes `displayName`, not the ID. Duplicate or normalized-equal legacy names require `MANUAL_MAPPING_REQUIRED`; no name is promoted automatically.

Minimal persistence is top-level `tbl_directions` and `tbl_areas`, each document carrying `id`, `clientId`, `displayName`, `status`, `createdAt`, `updatedAt`, and optional parent (`area.directionId`). This preserves a deterministic Rules document and keeps future hierarchy queries tenant-scoped.

## Director scope

The canonical membership document remains `tbl_userMemberships/{uid}__{clientId}`. A Director has `directionId` / `areaId` or a bounded `hierarchyScopeKeys` list containing canonical IDs, plus `allowedDashboardIds` only for exceptional direct grants. `directorTitle`, `subGroups`, and `superGroups` remain legacy display/migration inputs and must not be new authorization keys.

Rules can decide dashboard scope from one membership lookup and resource `directionId`/`areaId`; no hierarchy-document lookup is required for normal dashboard reads. If a hierarchy-document status check is later mandated, it adds one `get()` and must be separately load-tested.

## Platform authority and transition bridge

`tbl_platformAdmins/{uid}` is a protected platform-only authority record:

```text
{ uid, status: "active" | "disabled", createdAt, createdBy, updatedAt, updatedBy, schemaVersion: 1 }
```

The local Rules helper accepts an active canonical record first, then the temporary exact-email bridge. It never recognizes substrings, grants a tenant membership, or implies business/confidential data access. The bridge may retire only after: real UID inventory, active canonical records for every approved platform administrator, emulator parity evidence, and an approved rollback window.

## Membership mutation contract

Membership ID, `userId`, `clientId`, creation audit fields, and schema version are immutable. Standard users and Directors cannot mutate memberships. Tenant admins can manage only another user's membership in their own tenant; they cannot create or alter their own authority, cross tenants, or assign `platform_admin` (which is not a valid membership role). Platform admins have the explicit protected lifecycle path.

Canonical membership is authoritative when its deterministic document exists. Legacy `tbl_users.clientId` compatibility applies only while no canonical document exists for the same user+tenant; inactive or suspended membership therefore revokes access instead of falling back to legacy profile data.

## Rules access-call cost

| Operation | Expected Rules document calls | Multi-document risk |
| --- | ---: | --- |
| Dashboard get/list | 1 membership; direct/dashboard scope checks reuse it conceptually | Query must include tenant constraint; per-document evaluation stays under 10 calls |
| Dashboard item read/write | membership + parent dashboard (2) | Batched writes must stay below the 20-call aggregate limit |
| ActionPlan read | 1 membership | Tenant-constrained query required |
| ActionPlan write | membership + parent dashboard (2) | Same parent lookup may be cached by Rules engine, but callers must not rely on it |
| Strategy read/write | 1 membership | Tenant-constrained query required |
| Membership administration | actor membership + target membership on update (up to 2) | Admin bulk changes require small batches and emulator validation |

No proposed ordinary operation exceeds the 10-call single-operation limit. Atomic batches must remain below the Firestore Rules 20-document access-call limit; large membership migrations are server-controlled batches, never client batch writes.

## Dry-run mapping format

```text
legacy direction name -> { clientId, directionId?, confidence, MANUAL_MAPPING_REQUIRED? }
legacy area name      -> { clientId, areaId?, directionId?, confidence, MANUAL_MAPPING_REQUIRED? }
exact platform email  -> { uid?, proposedPlatformAdminPath, requiresUidInventory: true }
legacy role/clientId  -> createDryRunManifestEntry(profile)
```

No UID lookup, document creation, or write is included in this phase.

## Required indexes

Only currently observed compound queries are represented locally: dashboard `clientId + originalId`, dashboard `clientId + group`, ActionPlan `clientId + dashboardId + status`, ActionPlan `clientId + indicatorId`, and contribution assignment tenant/objective lookups. Deterministic membership authorization uses a document `get()`, so no membership index is required until a tenant directory or user-membership query is actually implemented.

## Deferred gate

`DEFERRED_REAL_MODULE_E2E_PROOF` remains mandatory before Preview or production. This phase changes no runtime module rendering behavior.
