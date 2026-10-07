# Auditoría integral final de certificación pre-release — APP TABLERO

Fecha: 2026-10-05. Repositorio: `C:\APP-TABLERO-LOCAL\stratexa-dashboard`. Proyecto: prior-01. Referencia productiva: https://tablero.leonprior.com.

**Recomendación: NO_LISTO_REQUIERE_CORRECCIONES.**
**Estado final: AUDITORIA_FINAL_FAIL.**

El estado local conserva ActionPlan y H01–H07, pero no supera el gate de integración. Hay un payload destructivo reproducido en la copia anual del checklist, éxito anticipado/guardados duplicados en esa misma ruta y siete fallos del comando estándar de tests por sondas antiguas. Las reglas de Firestore no llegaron a ejecutar tests por infraestructura. No se corrigió ninguno de estos hallazgos.

## 1. Estado del repositorio y preservación

| Comando/control | Resultado inicial |
| --- | --- |
| git branch --show-current | main |
| git rev-parse HEAD | 41d25788fc55925caf14e7d2e15113e2c39daa8d |
| git rev-parse origin/main | 41d25788fc55925caf14e7d2e15113e2c39daa8d; referencia local, sin fetch |
| git status --short | 30 archivos tracked modificados y documentos/tests untracked deliberados de los microciclos anteriores |
| git diff --stat | 30 files changed, 481 insertions(+), 90 deletions(-) |
| git diff --check | PASS, salida 0; avisos LF/CRLF existentes |
| git stash list | Vacío |
| git worktree list --porcelain | Un worktree: C:/APP-TABLERO-LOCAL/stratexa-dashboard; main y HEAD indicado |

El stat y branch/HEAD permanecen idénticos al cierre. SHA-256 de los **472 archivos preexistentes tracked/untracked no ignorados: 0 cambios**, incluyendo los fixes y su documentación. Evidencia: [manifest](FINAL_AUDIT_PRESERVATION_2026-10-05.json), [resumen de comprobación](FINAL_AUDIT_SUMMARY_2026-10-05.json). Se añadieron sólo documentos/evidencia de auditoría y sondas bajo tmp, ignorado por Git. No se modificaron código de producto, tests anteriores, configuración de tests ni reglas.

No hay trabajo ajeno inesperado identificado entre los cambios acumulados. Sí hay contaminación del descubrimiento de tests por las sondas ignoradas `tmp/preclose.*.test.tsx`, que proceden de la auditoría anterior y conservan expectativas de defectos corregidos. Es un hallazgo técnico, no evidencia de otro autor modificando el producto.

## 2. Resumen ejecutivo y gate

**APP TABLERO no está lista para integración en este estado.** Los 66 diagnósticos TypeScript no son el motivo del rechazo: coinciden con la deuda aceptada y no hay nuevos. Los motivos son F01/F02/F03 y validaciones de seguridad pendientes.

| Gate requerido | Resultado |
| --- | --- |
| 0 BLOCKER | FAIL: F01 |
| 0 HIGH | PASS: no HIGH adicional demostrado |
| ActionPlan/H01–H07 preservados | PASS automatizado y hashes |
| Suite completa del script real PASS | FAIL: 2 suites/7 tests |
| Build PASS | PASS |
| git diff --check PASS | PASS |
| 0 nuevos diagnósticos TS | PASS |
| Ausencia de capacidades críticas huérfanas | PASS en inspección de rutas y pruebas |
| Seguridad/multi-tenant sin regresión | PARTIAL: contratos automatizados PASS; reglas NOT_TESTABLE_INFRASTRUCTURE |
| Smoke autenticado aislado | Pendiente; hubo smoke visual parcial de login y harnesses |

El fallo global de suite no demuestra una regresión de los fixes: sus expectativas antiguas solicitan que H01–H05 continúen fallando. La ejecución suplementaria excluyendo únicamente tmp y reglas da 110 suites/919 pruebas PASS; **no reemplaza** el resultado fallido del comando estándar.

## 3. Matriz A1–A17

PASS de una prueba o de un helper no equivale a certificación productiva completa. PARTIAL conserva esa distinción cuando persistencia/seguridad dependen de mocks o falta recorrido autenticado aislado.

| Área | Estado | Evidencia y límite |
| --- | --- | --- |
| A1 Identidad y multi-tenant | PARTIAL | App.canonicalAccess, authRuntime, tableroAuthorization, tableroReadScope, clientIdentity, clientSelectionStrategy, userIdentityIntegrity, clientReconciliation y ownership PASS. App hidrata membresías y filtra canónicas con canAccessDashboard; servicios requestedTenants rechazan ámbito externo. Compatibilidad legacy cubierta. Fallbacks IPS restantes no se usan como autorización canónica; su eliminación general está fuera de alcance. Sin prueba viva de Rules. |
| A2 SuperAdmin y administración | PARTIAL | universalSuperAdmin, releaseSecurity, administrativeEndpoints y tenantAdministration PASS; H02 canónico también PASS. Allowlist universal separada de membresía de negocio; platform_admin no inventa IPS como tenant. Plataforma administrativa universal no implica acceso automático a datos de todos los clientes. Sin ejecución del backend aislado/reglas. |
| A3 Estrategia | PARTIAL | strategy, strategyMap, strategyCounterRollback, configuration, canonical access, matrix UX, selector, OE distributed ownership y parity PASS. CTA/menu/configuración conectados; callbacks mantienen identidad física. Servicio exige cliente explícito y ámbito. Contadores/reservas/relaciones tienen contratos transaccionales simulados; sin transacción viva contra emulador. |
| A4 Meta y avance | PARTIAL | DataEditor, CurrentPeriodFocus, periodSemantics, smartCapture, compliance, trackingStartSemantics, inMemoryKpiBackend PASS; mensual/semanal, cero explícito y ausencia diferenciados. Camino onSave -> onUpdateItem -> updateDashboardItems trazado; simulación de escritura/reconstrucción PASS. Falta roundtrip autenticado aislado. |
| A5 Inicio efectivo | PASS, alcance guard local/dato real | H07 y trackingEmptyPeriod PASS. GET real LVP + helper local: Octubre permitido, updateTime preservado, item no mutado. Nota, actividad, continuidad y avance explícito previo real bloquean en tests. No se guardó remotamente el nuevo inicio. |
| A6 ActionPlan | PARTIAL | CTA 0/1 planes y contraído/expandido, permisos negativos, creación scoped, edición, responsables/fechas/notas/progreso, actividades, revisiones, continuidad, relacionados y deduplicación cubiertos en RelatedActionPlans, ActionPlan, resultReview y transversal CONTROL PASS. Servicio valida cliente/dashboard/KPI antes de crear y excluye review history de ediciones generales. Persistencia/relectura simuladas; falta circuito aislado autenticado. |
| A7 CONTROL | PARTIAL | operationalControl, controlTraceability, operationalSeveritySemantics, control reconciliation, OperationalControlCenter y TransversalActionPlansControl PASS. Identidad física/homónimos, meta/realizado/pendiente, periodo y estados cubiertos. Sin smoke de CONTROL autenticado ni reglas ejecutadas. |
| A8 Navegación CONTROL | PASS automatizado | controlNavigation, DashboardView.navigation, PendingAlertsCenter, App.strategyNavigation y CurrentPeriodFocus PASS. Target mantiene cliente/dashboard/KPI/periodo/operación; se prueba apertura/configuración/avance/gestión y separación de KPI del mismo tablero. No se atribuye PASS visual del circuito autenticado. |
| A9 PENDIENTES | PASS automatizado + harness | pendingAlerts, actionPlanControlContinuity, controlTraceability y PendingAlertsCenter PASS: no duplicación por YTD, conteos/periodos y coexistencia con planes. Harness visual muestra 5 asuntos accionables. Sus botones son ilustrativos, no navegación de producto. |
| A10 Checklist | PARTIAL | Ruta CONFIRMAR LISTA (H06) PASS: pending/error/reintento/duplicado/lista vacía; CurrentPeriodFocus y DataEditor consumidores esperan. Importación/edición/actividad cubiertas. Persistencia remota aislada pendiente. La ruta anual separada falla en A11. |
| A11 Checklist Bulk Management | FAIL | Código/CTA para CSV, IDs, metas, realizado, filtros, búsqueda, orden, paginación de 50, selección/borrado/vaciado y exportación presentes; import/update PASS. Sonda actual DataEditor demuestra F01/F02 en COPIAR A TODO EL AÑO. Paginación/borrado/exportación masivos no tienen smoke autenticado conjunto certificado. |
| A12 Exportaciones | PARTIAL | H03, ControlReportExport, controlExecutiveReportExport y renderizadores reales PDF/DOCX PASS; KPI mensuales/semanales proyectados correctamente, permiso/contenido/frecuencia inválida denegados. CSV visible en producto y escape de prefijos de fórmula en ActivityManager inspeccionado. Sin descargas PDF/DOCX/CSV desde navegador autenticado aislado. |
| A13 Historial y continuidad | PASS automatizado + motor local | resolutionHistory, continuityEngine/Adapter/Certification, ContinuityPanel/Workspace y activityResolutionMerge PASS: COMPLETE/CLOSE_UNMET/REOPEN/RESCHEDULE/DISCARD/UNDO y orden/fecha. Motor visual cerró, reabrió, reprogramó y completó, conservando 6 entradas. No se confunde esa vista dev con el historial autenticado de un KPI real. |
| A14 Firestore y seguridad | NOT_TESTABLE | Rules leídas y tablas tbl_* excluidas de fallback universal; autorización de servicios/administración PASS en tests. Emulador falla antes de Jest, incluso fuera del sandbox. No se certifican reglas desplegadas ni roundtrip productivo autorizado. GET Admin de LVP no prueba permisos de usuario ni evalúa Rules. |
| A15 Funciones huérfanas | PASS, revisión acotada | Inventario AST de 75 TSX y consumidores de servicios más revisión de gates/callbacks. Capacidades centrales tienen CTA y ruta. Hay componentes/servicios legacy sin UI, con sustitutos o intención de mantenimiento; IA/PPT deshabilitados explícitamente. Ninguna capacidad crítica nueva huérfana demostrada. |
| A16 TypeScript | PASS respecto a baseline | Esperado 66, actual 66, nuevos 0, retirados 0. Se repitió captura tras crear la sonda; firma individual conservada. 24 producción, 41 tests, 1 helper. El proceso tsc sale 1; no es typecheck limpio. |
| A17 Integridad técnica | FAIL | Build/imports y diff PASS, suites protegidas PASS. npm test estándar FAIL por F03. Promesa de copia anual sin await/catch ni guard de pendiente: F02. No se corrigió durante la auditoría. |

## 4. Certificación de correcciones protegidas

| Corrección | Resultado | Evidencia actual |
| --- | --- | --- |
| ActionPlan | PASS | RelatedActionPlans.creation/delete, ActionPlan, resultReviewPersistence/controlContinuity y TransversalActionPlansControl; CTA y scope preservados |
| H01 | PASS | App.canonicalAccess + tableroAuthorization/ReadScope; viewer válido entra, externo denegado y legacy preservado |
| H02 | PASS | CanonicalStrategyAccess + StrategyConfigModal + autorización por tenant; sin ampliar escritura a lectores |
| H03 | PASS | ControlReportExport y renderizadores/proyección; PDF/DOCX mixto mensual/semanal habilitados cuando corresponde |
| H04 | PASS | resolutionHistory: COMPLETE=COMPLETADO, CLOSE_UNMET=CERRADO, REOPEN=REABIERTO; fechas/orden/otros eventos |
| H05 | PASS | App.strategyNavigation y DashboardView: conserva dashboardId+itemId y separa dos KPI de un tablero |
| H06 | PASS | ActivityManager + CurrentPeriodFocus + DataEditor: confirmar lista espera, rechazo conserva draft, reintento y sin doble envío |
| H07 | PASS | 23 casos CurrentPeriodFocus.effectiveStart, 10 trackingEmptyPeriod y GET real LVP evaluado en memoria; Octubre permitido |

Estos PASS certifican el cambio local en el alcance automatizado indicado. No afirman deploy ni funcionamiento de la versión productiva todavía sin publicar. F01/F02 afectan la ruta anual preexistente; no invalidan la prueba de espera de CONFIRMAR LISTA ni atribuyen una regresión a H06.

## 5. Pruebas y scripts reales

package.json: test=`jest --testPathIgnorePatterns=firestore.rules.test.ts`; test:rules=`firebase emulators:exec --project demo-stratexa-rules --only firestore "jest firestore.rules.test.ts --runInBand"`; build=`vite build --configLoader runner`; dev=`vite --configLoader runner`. No se ejecutaron predeploy/deploy.

| Ejecución actual | Suites | Tests | Resultado |
| --- | ---: | ---: | --- |
| npm test -- --runInBand, sin cambiar descubrimiento | 112: 110 PASS / 2 FAIL | 933: 926 PASS / 7 FAIL | FAIL, salida 1 |
| 13 suites focalizadas protegidas | 13 | 132 | PASS |
| Diagnóstico suplementario con Jest instalado, excluyendo sólo reglas/tmp | 110 | 919 | PASS, salida 0 |
| Sonda adicional bulk, archivo .probe.tsx ejecutado explícitamente | 1 | 1 | PASS como reproducción del defecto, no PASS funcional |

Los conteos no deben sumarse como pruebas únicas: las focalizadas son parte de las 110 mantenidas. Las dos suites tmp reúnen 14 tests (7 fallan, 7 pasan); por eso el universo suplementario tiene 919 y no 926. JSON mantenido: [resultados](FINAL_AUDIT_MAINTAINED_TESTS_2026-10-05.json). [Índice por suite y preservación](FINAL_AUDIT_SUMMARY_2026-10-05.json). Logs detallados permanecen localmente en docs/FINAL_AUDIT_FULL_TESTS_2026-10-05.log y docs/FINAL_AUDIT_FOCUSED_2026-10-05.log, ignorados por patrón *.log.

La primera invocación suplementaria vía npm encontró un problema de quoting Windows antes de Jest; se reejecutó el binario instalado con argumentos estructurados desde Node. No se inventó ni modificó un script npm. El resultado estándar inicial permanece FAIL.

## 6. Firestore Rules: infraestructura

**NOT_TESTABLE_INFRASTRUCTURE**, no FAIL de una regla evaluada.

1. npm run test:rules inicial: EPERM al leer configstore/firebase-tools.json; no arrancó emulador.
2. Mismo script con XDG_CONFIG_HOME temporal bajo tmp: llega al emulador demo, falla Java/Netty creando selector/loopback.
3. Mismo script fuera del sandbox: falla igual antes de Jest. La revisión automática permitió esta ejecución; no hubo rechazo de aprobación.

Cadena de causa observada: `failed to create a child event loop` -> `failed to open a new selector` -> `Unable to establish loopback connection` -> `SocketException: Invalid argument: connect` (UnixDomainSockets/PipeImpl). Luego aparece NoClassDefFoundError LegacySystemExit al cerrar. No se modificaron Java, reglas, configuración permanente ni proyectos.

Proyecto explícito demo-stratexa-rules; el CLI confirma que los servicios no emulados del proyecto demo fallarían. **0 tests de Rules ejecutados**. No se afirma que prior-01 tenga una regla vulnerable a partir de esta infraestructura.

## 7. TypeScript y deuda aceptada

**66 esperados / 66 actuales / 0 nuevos / 0 retirados** respecto de TS_FIXTURES_AFTER_RAW_2026-10-05.txt. Comparación por archivo+código+mensaje completo, normalizando CRLF y desplazamientos de línea. Evidencia: [captura](FINAL_AUDIT_TYPESCRIPT_2026-10-05.txt), [comparación](FINAL_AUDIT_TYPESCRIPT_COMPARISON_2026-10-05.json).

Muestreo revalidado: TrackingStartPeriodControls guarda la variante por frequency; App consume sources.boardId compatible con el payload legacy; ContinuityWorkspace recibe identidad y lee estado canónico sin consumir historial UI legacy; widowControl se consume en docx instalado; ExcelJS Cell.row devuelve número y bordes sin diagonal son válidos; el snapshot del helper sigue sin consumidores. No se encontró evidencia de runtime nueva causada por uno de estos 66 diagnósticos. F01/F02 no corresponden a un diagnóstico de ese baseline: son defectos de flujo no cubiertos por el tipado actual.

Los 66 siguen como **NON_BLOCKING_BASELINE_DEBT**, con los límites del informe TypeScript previo. tsc continúa rojo; aceptar deuda para auditoría funcional no equivale a declarar cero errores o relajar tipos.

## 8. Build y diff

npm run build: **PASS**, salida 0, 2048 módulos, 23.31 s. Persisten avisos conocidos de imports Firebase estáticos/dinámicos y chunks >500 kB. No hay fallo de resolución de imports de producción.

git diff --check inicial/final: **PASS**, salida 0. Los avisos LF/CRLF no son errores de whitespace. Ningún archivo de producto cambia durante esta auditoría.

## 9. Funciones huérfanas y accesibilidad

**NINGUNA_FUNCION_CRITICA_HUERFANA_DETECTADA**, dentro del inventario/revisión realizada. [Montajes JSX](FINAL_AUDIT_COMPONENT_ROUTES_2026-10-05.json), [consumidores de servicios](FINAL_AUDIT_SERVICE_CONSUMERS_2026-10-05.json).

- Crear tablero: CTA -> CreateDashboardModal -> callback App. Importación actual: ControlledImporter. Indicadores/borrado: IndicatorManager. Continuidad: ContinuityWorkspace/Panel. Estrategia: menu + ContributionMatrixView/StrategyMapView + navegación exacta. ActionPlan: RelatedActionPlans + servicio scoped.
- Sin montajes JSX nominales: AddDashboardModal, AggregationStrategySelector, BulkIndicatorDelete, ConfirmationModal, GaugeChart, GroupRenameModal, KpiActivityManager, OperationalAlertsTable/Heatmap/Ranking. AdvancedDataImporter está importado pero no montado. No se concluye pérdida de capacidad crítica sólo por esos archivos; las rutas activas/reemplazos se inspeccionaron.
- Servicios sin consumidor externo nominal: assertActionPlanEditScope es guard interno llamado por métodos del mismo servicio; auth es infraestructura. deleteIPSStructureFromClient/importCSVForYear/resetDashboardsWithIndicators/sanitizeAllDashboards y repairLatestStrategicObjectiveGap son residuos/mantenimiento sin UI activa. savePerspective tiene vía batch en configuración actual. No se ejecutaron servicios destructivos para explorar accesibilidad.
- IA/PPT: false && y estado sin CTA accesible, con test explícito uncertifiedFeaturesVisibility PASS. Son capacidades deliberadamente deshabilitadas, no parte del release funcional certificado.

El inventario AST busca JSX nominal y requiere revisión manual para alias, React.memo y callbacks; no es una prueba exhaustiva de estados posibles. Los gates incompatibles identificados previamente se cubren ahora con pruebas canónicas positivas/negativas.

## 10. Regresiones

**NINGUNA_REGRESION_ADICIONAL_DETECTADA atribuible a ActionPlan/H01–H07 o fixtures**, con hashes sin cambio y suites protegidas PASS. Sí se identificaron defectos adicionales preexistentes en el flujo anual, F01/F02, y el gate de tests F03. No se ocultan bajo el resultado positivo de las suites mantenidas.

## 11. Datos reales, sin escritura

Se reutilizó la credencial Admin y los documentos exactos identificados en H07. El primer intento gRPC bajo sandbox agotó 25 s; una lectura REST fuera del sandbox completó **dos GET**, del dashboard y su item. Nunca se imprimieron tokens/credenciales ni se llamó set/update/delete/commit en producción.

LVP / LVP_2026_1783802885613 / item 2, año 2026. updateTime: **2026-10-05T17:14:31.441642Z**, igual a la evidencia H07 previa. Agosto y Septiembre: goal=0, progress=null, goalCaptured=true, progressCaptured=false, nota vacía y lista de actividades vacía; continuityCommitments vacío. Helper local sobre el registro real para Octubre: `{hasFacts:false}`. dataUnchanged=true. [Evidencia mínima](FINAL_AUDIT_LVP_READONLY_2026-10-05.json).

No se cambió trackingStartPeriod remotamente. Admin read omite Rules; sirve para contrato/semántica de datos, no para certificar permisos de un viewer ni persistencia autorizada.

## 12. Validación visual

**PARTIAL**, navegador operativo, no VISUALLY_NOT_TESTED global por sandbox. Vite local en 127.0.0.1:5173 inició y se abrió con Codex in-app browser. [Observaciones](FINAL_AUDIT_VISUAL_2026-10-05.json).

| Smoke solicitado | Alcance visual actual |
| --- | --- |
| Login/acceso | Pantalla login renderizada; no envío de credenciales/autenticación |
| Seleccionar cliente | No probado autenticado |
| Estrategia | No probado autenticado; DOM automatizado PASS |
| Navegar al KPI exacto | No probado navegador; App/DashboardView tests PASS |
| Configurar Meta | Harness de captura visual, no edición/persistencia del producto |
| Registrar Avance | Motor dev local: avance 15 y acumulado 20/20; sin backend |
| Inicio efectivo | Dato real evaluado en memoria + componente en Jest; sin cambio visual de inicio remoto |
| Crear ActionPlan | No probado navegador autenticado; tests PASS |
| Planes relacionados | No probado navegador autenticado; tests PASS |
| Checklist | Componente probado en Jest, incluida sonda de defecto anual; no navegador autenticado |
| CONTROL | No probado autenticado |
| PDF/DOCX | Renderizadores y menú en Jest; sin descarga de navegador |
| Historial | Motor dev local: cerrar, reabrir, reprogramar y completar; 6 entradas conservadas. No es la ficha productiva de resolución |

Además: capture harness muestra 7/7=100% y cero explícito válido 2/2=100%; pending harness muestra 5 asuntos. Las rutas dev usan fixtures/estado en memoria. Sin backend autenticado aislado, no se completaron los flujos de escritura del producto: la instancia local apunta a prior-01 y esta auditoría prohíbe escribir allí. Se requiere smoke manual/automatizado en entorno aislado antes del release.

## 13. Hallazgos finales

### F01 — BLOCKER — Copia anual borra avance del periodo origen

Ruta alcanzable: ficha KPI editable -> edición completa (DataEditor) -> configurar actividades del periodo -> COPIAR A TODO EL AÑO. DataEditor.tsx:652 confirma que se reiniciarán avances «en los otros periodos»; :656–657 recorre todos los periodos, incluido activeActivityPeriod, y sustituye completedCount por 0.

Sonda actual con componentes reales y callback mock, periodo origen 0: **completedCount original 1 -> payload del mismo periodo 0**. El item de entrada no se muta; la pérdida está en el valor destinado a persistencia. CurrentPeriodFocus:1320–1327 espera onUpdateItem con el payload; App protege resoluciones, no restaura este completedCount; firebaseService.updateDashboardItems escribe el activityConfig entrante. Por tanto una persistencia exitosa reemplazaría el avance del origen, fuera de lo anunciado en el aviso. **No se provocó pérdida productiva**; el payload destructivo sí está demostrado.

Evidencia: [observación](FINAL_AUDIT_BULK_OBSERVATION_2026-10-05.json), sonda tmp/final-audit-bulk.probe.tsx, log local FINAL_AUDIT_BULK_PROBE_2026-10-05.log. Blame: asignación/aviso de b6e01778 (2026-04-29); bucle ya en 277aa99. No son líneas introducidas por H06.

Corrección necesaria en siguiente microciclo: definir/preservar datos del origen y limitar explícitamente qué periodos se sobrescriben; proteger los avances/continuidad reales conforme a la operación aprobada. Añadir persistencia simulada y relectura del origen, mensual/semanal. No migrar ni tocar datos reales durante la corrección.

### F02 — MEDIUM — Copia anual anuncia éxito y permite reenvío antes de persistir

DataEditor.tsx:662–668 llama onSave sin await/catch y ejecuta alert exitoso de inmediato. ActivityManager.tsx:530 invoca el callback sin utilizar handleSave ni su guard. La sonda deja pendiente la Promise: alerta de éxito observada, botón habilitado y **dos llamadas de guardado antes de resolver**. Una Promise rechazada del consumidor async puede quedar sin manejo local. No se inyectó rechazo para producir una excepción global; la falta de await/catch se demuestra por el callback conectado.

Alternativa operativa: CONFIRMAR LISTA por periodo tiene espera/error/reintento correctos de H06. No convierte la ruta anual en válida. Necesita tratamiento pending/resolve/reject y exclusión de doble envío en el microciclo de F01.

### F03 — MEDIUM — El script estándar descubre sondas que exigen los bugs antiguos

tmp/preclose.app-access.test.tsx exige «Sin tableros» para viewer canónico. tmp/preclose.probes.test.tsx exige falta de CTA tenant_admin, exportación deshabilitada, COMPLETE/CLOSE_UNMET=REABIERTO y pérdida de itemId, además del texto de hidratación antiguo. **Siete fallos actuales** corresponden a esas expectativas; el resto de la suite de producto PASS.

tmp está ignorado por Git, pero Jest no lo excluye en el script npm actual. Resultado no reproducible igual desde checkout limpio e integración local acumulada. Debe segregarse/archivarse la evidencia antigua fuera del descubrimiento o convertirla en regresiones vigentes, con criterio explícito; no borrar pruebas funcionales ni cambiar expectativas para ocultar fallos. No se hizo ese cambio en esta auditoría.

### F04 — LOW — Baseline TypeScript aceptado

66 diagnósticos idénticos y previamente clasificados, ninguno nuevo. No impiden por sí mismos la auditoría funcional; el typecheck global no está limpio. No se propone corregirlos aquí.

### F05 — LOW — Residuos legacy y avisos técnicos

Componentes/servicios sin UI activa, fallbacks IPS auxiliares, warnings de chunks y avisos act() de pruebas. No se demostró ampliación de permisos ni función central perdida por ellos. Revisión posterior opcional, fuera del cierre mínimo.

### Observaciones de validación — INFO/NOT_TESTABLE

Rules pendientes por loopback Java y smoke autenticado aislado pendiente. No son defectos de seguridad demostrados ni PASS sustituidos por mocks. Ambos son requisitos de certificación final antes de release.

Conteo: **1 BLOCKER, 0 HIGH, 2 MEDIUM, 2 LOW**; dos limitaciones de validación documentadas. No hubo correcciones durante la auditoría.

## 14. Qué falta antes de release

1. Microciclo mínimo de copia anual: preservar el origen y datos que no deben sobrescribirse; esperar persistencia, gestionar fallo/reintento y bloquear duplicados. Cubrir mensual/semanal, origen con avances y continuidad, error y relectura simulada.
2. Segregar las sondas antiguas del descubrimiento estándar manteniendo su evidencia; obtener `npm test -- --runInBand` PASS en el estado local e integración reproducible.
3. Ejecutar npm run test:rules en un entorno Java/loopback operativo y obtener resultado actual de Rules. No sustituirlo por lectura Admin.
4. Smoke autenticado en entorno aislado con viewer/tenant_admin y los 13 flujos solicitados, incluyendo escritura/relectura y descargas PDF/DOCX. Ninguna escritura productiva autorizada por esta auditoría.
5. Repetir gate final tras esos cambios: suite estándar, fixes protegidos, build, diff y comparación TS. No commit/push/deploy hasta autorización de una tarea posterior.

La auditoría no está globalmente bloqueada: pudo identificar un defecto y producir evidencia suficiente para una conclusión FAIL. Tampoco corresponde LISTO_CON_VALIDACION_MANUAL_PENDIENTE mientras exista el payload destructivo y falle el comando estándar.

**NO COMMIT / NO PUSH / NO DEPLOY / NO RELEASE / NO FIREBASE WRITE.** Las únicas lecturas productivas exitosas fueron dos GET; las escrituras observadas en sondas son callbacks simulados, no Firebase.
