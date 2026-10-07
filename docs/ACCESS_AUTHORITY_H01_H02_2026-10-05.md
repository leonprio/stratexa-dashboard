# Corrección H01/H02 — 2026-10-05

## Estado inicial y alcance

Rama main; HEAD 41d25788fc55925caf14e7d2e15113e2c39daa8d. Diff inicial: 2 archivos tracked, 33 inserciones y 3 eliminaciones; diff --check limpio. Cambios previos: components/RelatedActionPlans.tsx y services/actionPlanResultReviewPersistence.test.ts; nuevos components/RelatedActionPlans.creation.test.tsx y tres documentos de ActionPlan/auditoría. Se guardaron hashes antes del parche y los seis archivos permanecen idénticos.

## Causa raíz H01

Auth recibe uid-a y consulta tbl_userMemberships por userId. Los documentos protegidos contienen allowedDashboardIds/hierarchyScopeKeys; el contrato de User usa dashboardScopes/hierarchyScopes. App asignaba el documento sin adaptar, mientras readTableroScope sí lo adaptaba. El filtro de App exigía además clientId/dashboardAccess legacy y userRole sólo leía dashboardAccess. Un viewer estándar canónico activo A/D1 carecía de esos campos y veía Sin tableros; su equivalente Member/clientId A/dashboardAccess D1 Viewer funcionaba.

Se comparte hydratePersistedMemberships entre App y readTableroScope, conservando filtro de actor, overrides por tenant (incluidos suspendidos), intersección editable/allowed y strategy_reader sólo para scope tenant. ClientId efectivo y permisos derivan de membresías normalizadas; email no asigna acceso a tableros. App usa autoridad canónica para filtro, grupos y rol del tablero. La ruta legacy restante conserva sus reglas previas.

Evidencia histórica: git blame asigna la hidratación sin adaptar a 6cdedf07 (2026-09-05). Esto prueba el origen de esas líneas; no atribuye por sí solo toda la regresión a un único commit.

## Causa raíz H02 y causa común

Un tenant_admin activo A con globalRole Member cumple canAccessStrategy y las reglas de escritura del tenant, pero el nav dependía de isGlobalAdmin/canManageKPIs y matriz/modales de globalRole Admin. Ambos defectos comparten autoridad UI legacy que no consume correctamente la identidad canónica.

La entrada Estrategia exige enableStrategyMap y canAccessStrategy del cliente seleccionado. Matriz, configuración, celda OC y detalle OE exigen canAdminTenant del cliente seleccionado. strategy_configurator NO concede edición de OE/OC. Los botones KPIs/Pesos KPI conservan su condición anterior para que el nuevo nav no amplíe permisos. No se modifica isGlobalAdmin globalmente ni se añade vínculo IPS/SuperAdmin.

Historia: condición globalRole Admin de matriz en 0991aa3e (2026-08-18); wrapper del nav en 277aa99. Son controles legacy preexistentes que no se adaptaron al contrato canónico.

## Archivos del microciclo

Producción: App.tsx; services/tableroAuthorization.ts; services/tableroReadScope.ts; components/strategy/ContributionMatrixView.tsx; StrategyConfigModal.tsx; CellContributionModal.tsx; OEDetailModal.tsx.

Regresiones nuevas: App.canonicalAccess.test.tsx y components/strategy/CanonicalStrategyAccess.test.tsx.

Fixtures ajustados: components/strategy/StrategyConfigModal.test.tsx; OEDetailModal.availability.test.tsx; OEDetailModal.distributedOwnership.test.tsx; StrategyMapView.selector.integration.test.tsx. Sólo se añade el clientId del escenario al Admin legacy; no se cambian expectativas para aceptar acceso indebido.

## Validación

- 6 suites/79 pruebas PASS: App canónica/runtime, tableroAuthorization, tableroReadScope y las dos suites ActionPlan protegidas.
- 10 suites/60 pruebas PASS: todas las suites components/strategy, clientIdentity y userIdentityIntegrity.
- Reejecución final de App: 2 suites/19 pruebas PASS (incluidas en las anteriores, no sumar como pruebas únicas).
- Total focalizado: 16 suites, 139 pruebas únicas PASS.
- H01: viewer canónico con y sin clientId legacy, viewer legacy, denegado, suspendido que contradice grants legacy y registro de otro actor. Se comprueba rol Viewer y exclusión de D2 y tenant B.
- H02: App nav y matriz/modal reales; admin canónico y legacy positivos; viewer, otro tenant, suspendido, configurator e híbrido Admin legacy/standard_user canónico negativos.
- TypeScript: 76 diagnósticos históricos, 76 actuales; cero nuevos y cero eliminados. Comparación por archivo/código/mensaje y multiplicidad, ignorando desplazamientos de línea. tsc sigue fallando por deuda previa.
- Build PASS; warning preexistente de chunks mayores de 500 kB.
- git diff --check PASS.
- Hashes: los seis archivos protegidos idénticos; ActionPlan PRESERVADO.

## Certificación

| Control | Estado |
| --- | --- |
| H01_CANONICAL_VIEWER_ACCESS | PASS |
| H01_UNAUTHORIZED_DENIED | PASS |
| H01_LEGACY_COMPATIBILITY | PASS |
| H02_CANONICAL_ADMIN_STRATEGY_ACCESS | PASS |
| H02_UNAUTHORIZED_DENIED | PASS |
| MULTITENANT_ISOLATION | PASS |
| ACTIONPLAN_FIX_PRESERVED | PASS |

Certificación sobre App/componentes reales con Firebase simulado y suites de contratos de autorización/identidad. No representa prueba en producción ni reejecución de reglas en emulador; esa limitación previa sigue documentada en auditoría. No se modificaron Firestore Rules ni datos remotos.

H03–H07 y deuda TypeScript fuera de alcance, sin correcciones. NO PUSH / NO DEPLOY / NO RELEASE / NO COMMIT.

ACCESS_AUTHORITY_H01_H02_CORREGIDO_VALIDADO
