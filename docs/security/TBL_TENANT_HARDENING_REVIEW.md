# Tablero tenant hardening — partial implementation, NOT deployment-ready

Base HEAD: `14c17cbd53e1673b1416d0e62546d77f19d88228`.
Branch: `feature/transversal-action-plans`.
Production project: `prior-01` (shared). No production access or deployment performed.

## Ownership inventory

Inventory was completed before editing Rules. All names below are confirmed runtime collections. Unless noted otherwise, tenant identity is the document's `clientId`, reads are tenant-filtered queries/document gets, writes are document saves/deletes, and no nested collection is used.

| Collection | Classification | Runtime callers / patterns | Proposed authority |
| --- | --- | --- | --- |
| tbl_dashboards | TABLERO_ACTIVE | firebaseService; App, DashboardView, consolidated view, Report, Objectives, Control; dashboard queries and CRUD | Tenant Admin management; dashboard-scoped reads; platform management |
| tbl_dashboards/{id}/items | TABLERO_ACTIVE | firebaseService; KPI editor; document/batch CRUD and parent-specific collection reads; tenant inherited from parent | Parent read permission; Editor/authorized Director or Admin writes |
| tbl_users | TABLERO_ADMIN | firebaseService; login/profile bootstrap, App directory, user administration; own get, directory queries, CRUD; clientId may be CSV | Own read; scoped Admin/Director directory; tenant Admin other-user management; platform management |
| tbl_actionPlans | TABLERO_ACTIVE | firebaseService; ActionPlan, related plans, Control/Objectives navigation; indicator/dashboard queries, CRUD | Tenant reads; matching parent dashboard Editor/Admin writes |
| tbl_systemSettings | TABLERO_ADMIN | firebaseService; App settings initialization and save; exact document gets/writes; tenant is document ID, main/MAIN global | Tablero global fallback read; tenant reads; Admin tenant writes; platform global writes |
| tbl_managedClients | TABLERO_ADMIN | firebaseService; App client selector/management; catalogue and document CRUD; tenant is document ID | Own memberships via document gets; tenant Admin writes; platform global catalogue |
| tbl_strategicPerspectives | TABLERO_ACTIVE | strategyService; strategy/Objective views; scoped query, save/batch | Existing tenant read/Admin write |
| tbl_strategicObjectives | TABLERO_ACTIVE | strategyService; Objectives/strategy; scoped query, save/delete | Existing tenant read/Admin write |
| tbl_areaStrategyConfigs | TABLERO_ACTIVE | strategyService; contribution configuration; scoped query, transactional save | Existing tenant read/Admin write |
| tbl_contributionObjectives | TABLERO_ACTIVE | strategyService; contribution matrix/configuration; scoped query, transactional save/delete | Existing tenant read/Admin write |
| tbl_contributionIndicatorAssignments | TABLERO_ACTIVE | strategyService and contributionAssignmentPersistence; assignment reads/batch saves/deletes | Existing tenant read/Admin write |
| tbl_strategicObjectiveRelationships | TABLERO_ACTIVE | strategyService; objective relationships; scoped query, save/delete | Existing tenant read/Admin write, same-tenant endpoints |
| tbl_strategyCounters | TABLERO_INTERNAL | strategyService; transaction get/update; clientId plus counter ID constraint | Existing tenant Admin allocation |
| tbl_areaCodeReservations | TABLERO_INTERNAL | strategyService; transaction get/save/delete | Existing tenant read/Admin write |

Thirteen top-level collections; items is the only identified nested runtime collection. No unknown active tbl collection identified. Unrecognized tbl namespaces are denied by default. Storage and shared identity Functions are frozen.

## Access matrix and query changes

| Actor | Dashboards / items | Profiles | Plans | Catalogue/settings |
| --- | --- | --- | --- | --- |
| Normal member | Only explicit Viewer/Editor grants within trusted tenant memberships; Editor writes items | Own profile; no self writes | Same-tenant read; parent editor writes | Membership documents; tenant settings and global fallback read |
| Director | Above plus exact stored group/superGroup matches; important compatibility limitations below | Same-tenant single-client directory | Parent editor rights | Membership documents |
| Tenant Admin | Own tenants; dashboard clientId immutable | Other single-tenant users in own scope; no reassignment; no self writes | Parent tenant management | Tenant management, not global settings writes |
| Platform SuperAdmin | Explicit cross-tenant management; clientId mutation still denied | Global management | Cross-tenant matching-parent management | Explicit global catalogue/settings management |

Authority comes from authenticated identity and stored profile, never selectedClientId. The platform helper preserves the existing exact email allowlist. canReadTableroTenant is a separate policy boundary, but confidential-reader controls are NOT implemented and current platform data visibility is retained. This is not blind-admin or SOC 2 certification.

- getDashboards BEFORE: global collection read, item subcollection reads, then JavaScript tenant filtering. AFTER: fresh trusted profile, tenant query plus explicit dashboard ID/originalId or Director group constraints, deduplicate, then item reads. Explicit platform global branch retained. Existing post-processing is no longer the tenant enforcement boundary.
- getUsers BEFORE: global list. AFTER: member own profile; Admin/Director per-membership equality query plus own profile; explicit platform global branch.
- managedClients/getAllClients: membership-specific document gets for ordinary users; global discovery only in explicit platform branch.
- settings: validate requested membership; preserve global fallback. App passes first membership for initial settings instead of a CSV string.
- strategy query paths and Rules remain unchanged. ActionPlan optional-client query signatures remain; omitted tenant is not compatible with ordinary callers under hardened Rules and requires further parity work.

## Catch-all proof

The only change to the shared catch-all condition is inserting:

```text
!collection.matches('^tbl_.*') &&
```

Before: authenticated AND existing exclusion list. After: authenticated AND not tbl namespace AND the identical existing exclusion list. For every non-tbl collection the inserted predicate is true, so the boolean result is unchanged. Restrictive explicit tbl matches can now enforce access without a permissive additive match reopening actionPlans or unknown tbl namespaces.

Compared the entire Rules segment starting at the Gobernanza section against HEAD after removing only this inserted line: identical. Shared helper behavior is retained; isSuperAdmin delegates to the unchanged identity predicate. Emulator assertions preserve authenticated behavior for cpx, vac, stx and unknown legacy examples. This proves preservation, NOT security of those shared products.

## Validation

- Exact Firestore emulator suite: **53 tests PASS**, including strategic Rules regressions and new adversarial cases.
- A-to-B dashboard read/write and ActionPlan read/write: DENIED as expected.
- Global ordinary-user dashboard/plan/catalogue queries: DENIED as expected.
- Self role/clientId/dashboardAccess mutation and cross-tenant Admin profile mutation/reassignment: DENIED as expected.
- Explicit same-tenant Viewer/Editor, Admin, exact-name Director and platform fixture paths: PASS; originalId query: PASS.
- Query/service tests: **9 PASS** (mocked request-shape and identity tests; not a browser startup test).
- Locked frontend batch: **12 suites / 35 tests PASS**: Report semantics/synthesis, DashboardView/navigation, ObjectivesView, OperationalControlCenter, TransversalActionPlansControl, ActionPlan, uncertifiedFeaturesVisibility, client selection, control reconciliation, universal SuperAdmin.
- Additional batch including the 9 service tests: **7 suites / 57 tests PASS**: client identity/reconciliation, contribution configuration/parity/cell, user identity, service scope. Unique total across these two frontend batches: **19 suites / 92 tests**.
- Build: PASS; existing bundle/eval/import warnings remain.
- TypeScript: FAIL with existing diagnostics in unchanged fixtures, compliance and export utilities; no diagnostic reported in changed/new files. No fresh isolated HEAD compilation was performed, so this is not a certified full baseline comparison.
- diff-check: PASS.
- Authenticated browser startup against hardened Rules: **NOT VERIFIED**. Do not substitute unit tests or build success for this requirement.

The emulator used demo-stratexa-rules, not prior-01. Local Java required a process-local Unix-socket fallback setting to start the emulator; no installed Java configuration was modified. Emulator fixture writes occurred only locally. FIRESTORE_DATA_WRITES = 0 for production.

## Blocking compatibility gaps — do not deploy this draft

1. Current Director UX uses normalizeGroupName (accent/prefix/alias normalization); new Rules/query constraints use exact stored names. Valid existing hierarchical access can disappear. Need an approved canonical stored hierarchy/ACL contract and, if necessary, separately authorized migration; do not broaden to tenant-wide reads to conceal this.
2. App.handleUpdateMetadata permits Directors to edit dashboard metadata; draft Rules currently permit only tenant Admins. Metadata field and hierarchy-change permissions need parity before release.
3. CSV target profiles are excluded from the tenant directory/management rules. An overlap alone is unsafe; full-membership administration needs an explicit contract. Nonplatform all/ALL memberships are still accepted by old strategy Rules but rejected by the new query scope without explicit memberships.
4. Existing administrative global loaders/rename/delete flows need remaining parity work. Tenant-ID renaming conflicts with the required immutable clientId constraint. Optional-tenant ActionPlan queries also need a verified contract for every caller.
5. Production query/index readiness and real authenticated startup are not certified. No production data inspection or index deployment was performed.

Classification: **BLOCKED_ACCESS_MODEL_QUERY_PARITY**. Changes are a local partial implementation, not a completed security fix. Request a canonical hierarchy/multitenant administration decision before expanding behavior or authorizing data migration.

## Remaining shared risks and safety

Storage authorization, shared identity Functions/global Auth, and unknown legacy/non-tbl access remain outside this phase and need separate product access contracts. At least three shared risk categories remain; an exact residual P0 vulnerability count is not established. No production risk is claimed remediated because nothing was deployed.

No production reads/writes, no Rules/Storage/Functions/Hosting deployment, no commit, no push, no merge, no tag. scratch preserved.
