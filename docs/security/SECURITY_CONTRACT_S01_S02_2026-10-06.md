# Reconciliación de seguridad S01/S02 — 2026-10-06

Estado: SECURITY_CONTRACT_RECONCILED_RULES_RUNTIME_PENDING.
Rules runtime: RULES_RUNTIME_NOT_TESTED_INFRA. No se intentó reparar ni ejecutar el emulador en este microciclo.

## Estado inicial

Repositorio C:\APP-TABLERO-LOCAL\stratexa-dashboard.
Rama main; HEAD 41d25788fc55925caf14e7d2e15113e2c39daa8d.
Git status: 32 archivos tracked modificados y 34 no rastreados.
Git diff --stat: 32 files changed, 638 insertions(+), 108 deletions(-).
Git diff --check: PASS inicial y final; sólo avisos de conversión LF/CRLF.
No se exigió árbol limpio. Sin reset, stash ni checkout.

## Contrato vigente

| Identidad | Lectura de negocio | Escritura de negocio | Alcance |
| --- | --- | --- | --- |
| Sin autenticación | DENY | DENY | Ninguno |
| Usuario estándar con perfil | Según membresía activa y scope | Sólo capacidades explícitas | Tenant/dashboards autorizados |
| Viewer canónico con perfil | Dashboard/KPI/ActionPlan asignados | DENY | Dashboard autorizado de su tenant |
| Tenant admin canónico con perfil | Su tenant | Su tenant | La membresía sustituye el rol legacy |
| Membresía canónica | Activa, con scope; estrategia exige tenant + strategy_reader o tenant_admin | Tenant admin o capacidades y scope específicos | Nunca todos los tenants por email/ALL |
| Legacy ordinario con perfil | IDs explícitos CSV, casing compatible y dashboard/hierarchy scope | Admin del tenant o editor de dashboard | Sólo tenants explícitos sin registro canónico sustituyente |
| Membresía suspendida/inactiva | DENY en el tenant revocado | DENY en el tenant revocado | El registro canónico bloquea fallback legacy del mismo tenant |
| Platform authority / SuperAdmin | Administración de plataforma/catálogo; negocio exige membresía | Administración de plataforma; negocio exige membresía | No business grant por correo ni ALL |
| Legacy ALL/all | Ningún grant por ese token | Ningún grant por ese token | A,ALL conserva solamente A para usuario ordinario |
| Canónica activa sin tbl_users, usuario ordinario | DENY para dashboards/KPI/ActionPlan/estrategia | DENY para esos recursos | USER_PROFILE_IS_REQUIRED |

Perfil requerido no significa permisos derivados del rol legacy: el perfil vincula la identidad; membresías protegidas gobiernan el tenant y scope. Las APIs de membresías/plataforma conservan sus controles administrativos existentes. La excepción de autoridad de plataforma sin perfil sigue siendo explícita y no crea acceso a negocio.

## S01: causa, historia y decisión

1. ALL/all no forma parte válida del contrato vigente como grant universal: legacyMemberships en services/tableroAuthorization.ts elimina ALL tras normalizar; perfiles de plataforma tampoco generan membresías legacy.
2. Hay fixtures históricas que dependen del bypass, pero no se demostró un flujo actualmente válido según el frontend que requiera acceso universal por ALL. No se inspeccionó ni migró Firebase real.
3. git blame y git show atribuyen las cuatro alternativas wildcard y la excepción de correo de plataforma al commit 4f27205153b73c18226b90a0adf1dd8f6d49b636, autor León Prior, 2026-10-01 18:22:02 -0600, título "fix: allow authorized contribution objective reads". El diff añadió pruebas para el perfil LVP,IPS,all consultando IPS_DIRECCION y administrando objetivos de contribución. Esto prueba autoría del commit y propósito observable, no quién operó la edición.
4. Decisión: ELIMINAR el grant wildcard. Restringe una autorización de Rules incompatible con el contrato cliente. Tenant explícito válido se conserva; plataforma usa membresías canónicas. Las dos fixtures dependientes se ajustan con grants IPS/IPS_DIRECCION explícitos.
5. La excepción en legacyTenantUser para leonprior@gmail.com también permitía negocio sin membresía canónica, aun con tenants explícitos. Se eliminó para alinear ambos correos de plataforma con el frontend. Los IDs exactos/CSV/casing se mantienen; no se introdujo dependencia IPS ni lista histórica nueva.

Cambio mínimo en firestore.rules: eliminar cuatro alternativas ALL, excluir target legacy literal all y reemplazar excepción de plataforma por !isPlatformAdmin(). No se tocaron canReadDashboard, canEditDashboard, canEditActionPlan, reglas de estrategia, checklist ni administración de plataforma.

## S02: decisión y evidencia

USER_PROFILE_IS_REQUIRED.

- App.tsx obtiene tbl_users/{uid}; sólo carga membresías si existe prof y rechaza la ausencia con PERFIL_TABLERO_NO_VINCULADO para usuario ordinario.
- services/tableroReadScope.ts rechaza ausencia de perfil y de autoridad de plataforma antes de consultar membresías.
- firestore.rules:isTableroUser exige autoridad de plataforma o existencia de tbl_users; los recursos de negocio revisados mantienen ese guard.
- docs/security/USER_IDENTITY_INTEGRITY_PROTOCOL.md: "Acceso Exclusivo por Perfil"; invariante Auth UID/document ID/profile ID.
- H01/H02: docs/ACCESS_AUTHORITY_H01_H02_2026-10-05.md y App.canonicalAccess.test.tsx conservan perfil; canonical_no_legacy elimina clientId/dashboardAccess legacy, no tbl_users.
- CANONICAL_ACCESS_MODEL_AND_MULTI_TENANT_ADMIN_CONTRACT.md describe un diseño futuro/aprobado para planificación; no prueba una migración que elimine el requisito de identidad actual.

Se certifica la decisión de contrato y el rechazo unitario en readTableroScope. La ejecución real del rechazo en Rules queda pendiente del emulador; no se cambió isTableroUser ni se amplió acceso.

## Archivos y pruebas

Modificados exclusivamente:
- firestore.rules
- firestore.rules.test.ts
- services/tableroAuthorization.test.ts
- services/tableroReadScope.test.ts
- Este documento nuevo.

Regresiones unitarias nuevas: ALL/all puros y mezclados con tenant explícito; viewer read-only; tenant_admin aislado; suspensión con legacy presente; plataforma gmail sin grant de negocio; perfil ausente con membresía canónica estándar/admin y excepción de plataforma sin negocio.

Regresiones Rules nuevas (pendientes de ejecución): los cuatro valores legacy; aislamiento KPI/checklist y ActionPlan; usuario sin perfil con canónica estándar/admin; viewer sólo lectura; tenant_admin con globalRole Member y clientId ALL; suspensión que revoca; plataforma gmail sin membresía. Dos fixtures previas reciben membresías canónicas explícitas, conservando ALL como metadata para demostrar que no es autoridad.

## Validación ejecutada

- npm test -- --runInBand services/tableroAuthorization.test.ts services/tableroReadScope.test.ts App.canonicalAccess.test.tsx App.strategyNavigation.test.tsx: 4 suites / 50 pruebas PASS.
- npm test -- --runInBand: 110 suites / 933 pruebas PASS (antes 924; 9 pruebas unitarias agregadas).
- npx tsc --noEmit --pretty false: exit 1 por deuda histórica; baseline antes del cambio 66, actual 66. Comparación por archivo/código/mensaje y multiplicidad, normalizando raíz y posiciones: 0 nuevos / 0 eliminados.
- npm run build: PASS, 18.09 s; warning de chunks >500 kB.
- git diff --check: PASS.
- Hashes SHA-256 de archivos preexistentes rastreados y no rastreados: únicamente cambiaron los cuatro archivos autorizados de Rules/tests. App, H01–H08, ActionPlan, Jest tmp fix, TypeScript y documentación acumulada idénticos. build_output es salida generada/ignorada.

## Certificaciones y límites

PASS aquí certifica contrato/código y pruebas unitarias; no equivale a ejecución Firestore Rules.

| Certificación | Contrato/unitarias/preservación | Firestore runtime |
| --- | --- | --- |
| S01_LEGACY_ALL_DOES_NOT_BYPASS_TENANT | PASS | NOT_TESTABLE |
| S01_FRONTEND_RULES_CONTRACT_ALIGNED | PASS para ALL y fallback plataforma intervenidos | NOT_TESTABLE |
| S02_CANONICAL_IDENTITY_CONTRACT_CERTIFIED | PASS (USER_PROFILE_IS_REQUIRED) | NOT_TESTABLE |
| VIEWER_READ_ONLY | PASS | NOT_TESTABLE |
| TENANT_ADMIN_ISOLATED | PASS | NOT_TESTABLE |
| SUSPENDED_DENIED | PASS | NOT_TESTABLE |
| SUPERADMIN_CONTRACT_PRESERVED | PASS | NOT_TESTABLE |
| ACTIONPLAN_TENANT_ISOLATION_PRESERVED | PASS | NOT_TESTABLE |
| CHECKLIST_TENANT_ISOLATION_PRESERVED | PASS (código protegido idéntico, suite estándar) | NOT_TESTABLE |
| H01_H08_PRESERVED | PASS | NOT_TESTABLE para Rules |

Pendiente: ejecutar la suite Rules real cuando se resuelva fuera de esta tarea la infraestructura Java/loopback. No se infiere certificación de Rules desde Jest unitario, revisión estática ni compilación TypeScript.

NO COMMIT / NO PUSH / NO DEPLOY / NO RELEASE / NO FIREBASE WRITE.
