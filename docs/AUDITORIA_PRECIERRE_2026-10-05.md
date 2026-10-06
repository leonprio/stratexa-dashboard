# Auditoría integral pre cierre de APP TABLERO

Fecha: 2026-10-05. Repositorio local: `C:\APP-TABLERO-LOCAL\stratexa-dashboard`. Proyecto referenciado: `prior-01`. Producción referenciada: `https://tablero.leonprior.com`.

## 1. Estado del repositorio

Fase 0 ejecutada antes de la auditoría:

```text
git branch --show-current
main

git rev-parse HEAD
41d25788fc55925caf14e7d2e15113e2c39daa8d

git status --short
 M components/RelatedActionPlans.tsx
 M services/actionPlanResultReviewPersistence.test.ts
?? components/RelatedActionPlans.creation.test.tsx
?? docs/ACTIONPLAN_REGRESION_CTA_2026-10-05.md

git diff --stat
 components/RelatedActionPlans.tsx                  |  6 ++---
 services/actionPlanResultReviewPersistence.test.ts | 30 ++++++++++++++++++++++
 2 files changed, 33 insertions(+), 3 deletions(-)

git diff --check
sin salida; exit 0
```

El stat inicial no incluye archivos nuevos sin seguimiento. El fix ActionPlan se conservó. La auditoría añadió documentos de evidencia y sondas en `tmp/`, ignorado por Git. No modificó código de producto, pruebas existentes ni reglas. No hizo commit.

## 2. Resumen ejecutivo

Las capacidades principales están implementadas y existe evidencia automatizada amplia: **104 suites y 838 pruebas PASS** en la ejecución actual. El build también pasa. La etapa aún no se puede cerrar: hay un bloqueo reproducido de acceso a tableros para usuarios canónicos y otros defectos de acceso estratégico, exportación, historial y navegación que la suite original no detecta.

No corresponde dar un porcentaje de avance: la brecha es una lista finita de contratos y validaciones. Son necesarios microciclos acotados, sin añadir funcionalidades. Las sondas de auditoría reprodujeron los defectos observando el comportamiento incorrecto; que dichas sondas pasen no certifica las funciones afectadas.

**Recomendación: NO_LISTO. Estado: AUDITORIA_PRECIERRE_FAIL.** La auditoría pudo avanzar y producir hallazgos; no se declara toda la auditoría bloqueada por las limitaciones visuales o de emulador.

## 3. Inventario funcional

Leyenda: IMPLEMENTED y REACHABLE se separan. «Sí, condicionado» significa ruta trazada en código y/o DOM, no recorrido de navegador autenticado. TESTED indica pruebas ejecutadas ahora, no que cubran todas las combinaciones. DATA_VERIFIED distingue contratos simulados y generación local de documentos de persistencia real. Ninguna capacidad se certifica globalmente sólo por existir o por pasar una prueba de servicio.

| Función | IMPLEMENTED | REACHABLE | TESTED | VISUALLY_VERIFIED | DATA_VERIFIED | STATUS |
| --- | --- | --- | --- | --- | --- | --- |
| Login, identidad y selección de cliente | Sí | Sí en escenarios legacy; incompleto canónico | Sí: App/auth, selección e identidad | VISUALLY_NOT_TESTED | Contrato mock; sin Firestore real | FAIL |
| Lectura de tableros/KPI por membresía canónica | Sí | No para viewer canónico sin acceso legacy: H01 | Sí: reproducción con App real | VISUALLY_NOT_TESTED | Servicio/autorización simulados | FAIL |
| Administración universal SuperAdmin | Sí | Allowlist exacta sin depender de IPS; otras identidades canónicas no certificadas en App | Sí: bridge, endpoints y aislamiento | VISUALLY_NOT_TESTED | Contrato mock; reglas sin ejecutar | PARTIAL |
| Matriz/mapa estratégico y relaciones OC/OE/KPI | Sí | Lectura condicionada por flag y menú; edición canónica bloqueada: H02 | Sí: matriz, mapa, ownership, contadores, selector | VISUALLY_NOT_TESTED | Transacciones simuladas; IPS Dirección real no inspeccionado | FAIL |
| Configurar meta y registrar realizado | Sí | Ficha/DataEditor; condicionado por acceso y rol | Sí: DataEditor, CurrentPeriodFocus, periodos, smartCapture | VISUALLY_NOT_TESTED | Persistencia mock | PARTIAL |
| Cumplimiento y consolidación | Sí | Tarjetas, ficha y consolidados | Sí: compliance, lineage, stock/formula | VISUALLY_NOT_TESTED | Cálculo sobre datos sintéticos | PARTIAL |
| CONTROL transversal y estados | Sí | Pestaña CONTROL; afecta H01 para viewers canónicos | Sí: centros, dominio, homónimos, trazabilidad | VISUALLY_NOT_TESTED | Lecturas mock | PARTIAL |
| CONTROL → CONFIGURAR/REGISTRAR AVANCE/GESTIONAR | Sí | Callbacks con cliente/tablero/KPI/periodo | Sí: navigation, CurrentPeriodFocus y PendingAlertsCenter | VISUALLY_NOT_TESTED | Persistencia mock | PARTIAL |
| ActionPlan: crear, editar, actividades, relacionados, CONTROL | Sí | CTA corregido en matriz 0/1 × contraído/expandido; permisos mantienen ámbito | Sí: 8 UI nuevas, servicio, edición, revisiones, continuidad | VISUALLY_NOT_TESTED | Firestore simulado; real no probado | PARTIAL |
| PENDIENTES y continuidad | Sí | CONTROL/ficha; historial semántico falla: H04 | Sí: pending, continuity, traceability y reproducción | VISUALLY_NOT_TESTED | Contrato mock | PARTIAL |
| Checklist Bulk Management | Sí | Gestión detallada → ActivityManager | Sí: importar/actualizar y preservar IDs; cobertura de operaciones masivas incompleta | VISUALLY_NOT_TESTED | Callback/consolidación; guardado cierra pendiente: H06 | PARTIAL |
| Importar/exportar CSV de checklist | Sí | Botones de importar, plantilla, lista y filtrados | Sí en importación; exportación/seguridad de fórmulas revisadas por código | VISUALLY_NOT_TESTED | Lectura FileReader mock; descarga real no probada | PARTIAL |
| CSV global y Excel ejecutivo | Sí | Menú Exportar/CSV y botón Excel para roles legacy habilitados | Exportación ejecutiva cubierta parcialmente; no circuito global completo | VISUALLY_NOT_TESTED | Generación local parcial; sin roundtrip real global | PARTIAL |
| Exportación CONTROL PDF/DOCX | Sí | Menú Exportar informe; deshabilitado en tablero mixto: H03 | Sí: UI adapter y renderizadores reales, reproducción de bloqueo | VISUALLY_NOT_TESTED | Archivos PDF/DOCX generados localmente en tests | FAIL |
| Seguridad Firestore | Sí | Reglas/servicios tienen contratos de ámbito | Tests de reglas existentes no llegaron a ejecutar; autorización mock sí | VISUALLY_NOT_TESTED | No verificado contra emulador ni reglas desplegadas | NOT_TESTABLE |
| Auditoría IA y PowerPoint | Sí, histórico | No: entradas expresamente deshabilitadas con `false &&` | Sí: prueba protege ocultación | VISUALLY_NOT_TESTED | No certificado | NOT_TESTABLE |

## 4. Matriz A1–A15

| Área | Resultado | Evidencia actual y límite |
| --- | --- | --- |
| A1 Identidad/multi-tenant | FAIL | H01: App descarta un tablero autorizado canónico; representación de membresías distinta de `readTableroScope`. Pruebas de identidad técnica, cliente seleccionado, aislamiento y homónimos pasan. Fallbacks IPS permanecen. |
| A2 SuperAdmin | PARTIAL | `universalSuperAdmin.ts` usa emails exactos, no clientId IPS; App conserva clientId como metadato. Servicios reconocen plataforma canónica y separan autoridad de plataforma y negocio. App conserva gates legacy; acceso de plataforma no allowlisted queda sin prueba integral. |
| A3 Estrategia/mapa | FAIL | Ownership/contadores/relaciones y selector pasan; `IPS DIRECCIÓN` → `IPS_DIRECCION` está probado con fixtures. H02 edición canónica oculta; H05 pierde KPI al navegar. Sin catálogo real IPS Dirección. |
| A4 Metas/avance | PARTIAL | Pruebas UI de captura/configuración y periodos pasan; callback de guardado y cálculo trazados. Sin guardado real; H06 en checklist. |
| A5 CONTROL | PARTIAL | Identidad física/homónimos y estados cubiertos y actuales. H01 impide llegar con cierto rol; historial H04 incorrecto. No smoke visual. |
| A6 Navegación contextual CONTROL | PARTIAL | `ControlNavigationTarget` conserva clientId/dashboardId/itemId/period/operation; App valida target y CurrentPeriodFocus abre mes/semana explícitos. UI automatizada pasa; sin navegador real. |
| A7 ActionPlan | PARTIAL | Matriz positiva 0/1 contraído/expandido: 4 casos; matriz negativa equivalente: 4 sondas adicionales. Creación, edición, notas, actividades, progreso y revisiones cubiertos; persistencia simulada. Sin Firebase/navegador reales. |
| A8 PENDIENTES | PARTIAL | `buildPendingItems` opera por identidad/periodo; pruebas de homónimos, checklist consolidado una vez, cero explícito y continuidad pasan. No duplicación YTD demostrada en fixtures; no validación de datos reales. H04 afecta historial, no duplica por sí mismo pendientes. |
| A9 Checklist masivo | PARTIAL | Código contiene CSV, actualización de meta preservando ID/realizado, filtros, búsqueda, orden, páginas de 50, selección, borrado/vaciado y exportación; pruebas import/update PASS. Faltan pruebas UI conjuntas de páginas/selección/borrado/export/fórmulas y errores de persistencia. |
| A10 Exportaciones | FAIL | CSV tiene consumidores visibles; PDF/DOCX tienen menú y renderizadores probados. H03 bloquea ambos en tablero de frecuencia mixta. |
| A11 Firestore/seguridad | NOT_TESTABLE | Reglas actuales leídas: clientes/estrategia/tableros/KPI/planes/counters y membresías protegidas. `npm run test:rules` falla al iniciar emulador, antes de Jest; dos variantes locales tampoco arrancan. No evidencia de bypass demostrada ni PASS de reglas. |
| A12 Accesibilidad funcional | FAIL | H01, H02 y H03 demuestran rutas huérfanas por estado/rol. IA/PPT ocultos por decisión existente. |
| A13 TypeScript | FAIL | 76 diagnósticos reproducidos; mismos 76 en HEAD mediante overlay; 49 tests + 1 soporte tests + 26 producción. Clasificación completa en anexo. |
| A14 Pruebas/regresiones | PARTIAL | 104 suites/838 pruebas PASS; 14 sondas extra reproducen defectos/completan matriz negativa. Faltan contratos App/roles canónicos y casos mixtos/error de guardado. |
| A15 Residuos | PARTIAL | Fallbacks IPS, gates legacy, componentes sin consumidor y entradas IA/PPT deshabilitadas identificados. No se eliminó nada. |

## 5. Hallazgos

### H01 — BLOCKER — Tablero autorizado desaparece para viewer canónico

Componentes: `App.tsx:708–711`, `App.tsx:1152–1202`, `services/tableroAuthorization.ts:39–56`, `services/tableroReadScope.ts:24–32`.

App asigna documentos persistidos a `memberships` mediante cast sin transformar `allowedDashboardIds`/`hierarchyScopeKeys` a `dashboardScopes`/`hierarchyScopes`. Además vuelve a filtrar tableros ya autorizados usando `userProfile.clientId`, `dashboardAccess` y jerarquía legacy. Un usuario canónico con `allowedDashboardIds=['D1']` y sin `dashboardAccess` recibe «Sin tableros», aunque el servicio devuelve D1. El perfil equivalente legacy ve D1. Puede bloquear también acceso a CONTROL y planes para esos usuarios. No demuestra lectura indebida de otro cliente: es pérdida de acceso permitido.

Evidencia: `tmp/preclose.app-access.test.tsx`, dos casos con App real y backend sintético; `tmp/preclose.probes.test.tsx`, contraste raw/normalizado. La asignación raw procede de `6cdedf07`; los filtros legacy son anteriores y continúan presentes.

Solución mínima propuesta: adaptar la representación canónica en la frontera de App y usar el mismo contrato de autorización para filtrado/rol de tablero. Mantener aislamiento; cubrir viewer/editor/director/admin canónicos y perfiles híbridos/suspendidos.

### H02 — HIGH — Estrategia editable queda huérfana para administrador canónico

Componentes: `App.tsx:329`, `App.tsx:2621`, `components/strategy/ContributionMatrixView.tsx:82`, `components/strategy/StrategyConfigModal.tsx:51,409`.

Un usuario con membresía activa `tenant_admin`, `globalRole='Member'` y sin `canManageKPIs` tiene permisos estratégicos en servicio/reglas pero pierde el menú Estrategia y «Configurar Estrategia». Incluso al montar la matriz, su CTA no aparece. Los gates usan rol legacy; no usan autoridad efectiva del cliente. Una sonda adicional muestra que `strategy_configurator` tampoco activa ese CTA, pero **no se deduce que dicha capacidad permita editar OE/OC**: las reglas reservan esas escrituras al tenant_admin. La corrección de OE/OC debe limitarse al permiso efectivo correspondiente.

Evidencia: sonda UI actual y reglas `tbl_strategicObjectives`/`tbl_contributionObjectives`; pruebas previas de matriz usan `globalRole=Admin`. Gate de matriz presente desde `0991aa3e`. No se determinó la última versión donde la combinación canónica funcionaba.

Solución mínima: alinear entradas y edición con la autoridad del cliente sin conceder escritura a un lector; probar menú, apertura y escritura/denegación por rol.

### H03 — HIGH — PDF/DOCX inaccesibles para tablero con KPI mensuales y semanales

Componentes: `components/operational/OperationalControlCenter.tsx:39`, `components/operational/ControlReportExport.tsx:27–30`.

El padre incluye un tablero si **algún** KPI coincide con la frecuencia del informe; el hijo habilita exportación sólo si **todos** los KPI coinciden. Un tablero con un KPI mensual y otro semanal queda incluido, pero el botón se deshabilita en ambas frecuencias. No es mezcla de clientes ni falta de permiso: es discrepancia del contrato de proyección de frecuencia.

Evidencia: sonda con tablero A autorizado y dos frecuencias; botón deshabilitado y formatos inaccesibles. Introducido con el flujo de informes `0ef498ae` (2026-09-26). No se afirmó que existiera una versión anterior de esos nuevos informes que admitiera este caso.

Solución mínima: proyectar los KPI de la frecuencia elegida antes de validar/renderizar el informe y preservar ámbito/identidad. Añadir prueba del padre con tablero mixto para ambos formatos.

### H04 — MEDIUM — Historial presenta completar/cerrar como reabrir

Componente: `utils/resolutionHistory.ts:36–38`, consumidor `CurrentPeriodFocus`.

El motor emite `COMPLETE` y `CLOSE_UNMET`; el historial compara con `CLOSE_COMPLETED`, que no pertenece al contrato, y usa «REABIERTO» como default. Ambas operaciones producen ese texto incorrecto en compromisos SIMPLE_KPI. El estado efectivo del compromiso sigue siendo completado/cerrado; el hallazgo afecta su relato histórico. También requiere verificar qué eventos de progreso deben entrar al historial de resoluciones.

Evidencia: dos sondas actuales; diagnóstico TS2367; `reduceContinuity` emite los eventos canónicos. Línea responsable: `6a40fc25` (2026-09-20).

Solución mínima: mapear/filtrar eventos canónicos y probar completar/cerrar/reabrir/reprogramar/descartar, sin modificar datos almacenados.

### H05 — MEDIUM — Estrategia → KPI pierde el itemId

Componente: `App.tsx:3155–3157`.

El callback recibe `dashboardId,itemId`, pero sólo cambia el tablero y cierra Estrategia. No publica `pendingKpiNavigation`. La selección del KPI destino no queda transmitida a DashboardView. El usuario puede localizarlo manualmente en el tablero; falla la navegación contextual prometida por el callback.

Evidencia: lectura del callback, consumidor DashboardView y sonda de contrato de fuente. Es evidencia de conexión perdida, no una prueba visual del clic completo. El callback consta desde `b232ed1a`; no se atribuye una regresión temporal sin última versión funcional demostrada.

Solución mínima: conservar identidad física en el mecanismo de navegación ya existente y probar desde un clic real del mapa/matriz hasta la ficha exacta.

### H06 — MEDIUM — Checklist se cierra antes de confirmar persistencia

Componentes: `CurrentPeriodFocus.tsx:1801–1837`, `DataEditor.tsx:609–650`, `ActivityManager.tsx:507`.

El padre llama a un callback asíncrono y cierra el gestor inmediatamente, sin await/catch local. Una sonda deja el guardado pendiente y demuestra que desaparece «CONFIRMAR LISTA». App hace actualización optimista y alerta/rethrow si falla; el gestor ya no conserva la edición visible y no consume esa promesa. No se afirma pérdida de datos reales observada: queda demostrado el cierre prematuro y sin certificar el comportamiento ante fallo.

Solución mínima: conservar el formulario mientras guarda, impedir reenvío y tratar rechazo sin falso cierre exitoso. Probar latencia/rechazo/reintento y cálculo por KPI/periodo.

### H07 — BASELINE_DEBT — TypeScript global no cierra

76 diagnósticos en 24 archivos; 26 en producción, 49 en tests y 1 en soporte de tests. Todos existen exactamente en HEAD; ninguno fue introducido por ActionPlan. Vite y Jest actuales no sustituyen al typecheck global. Alcance mínimo: reconciliar contratos y fixtures por grupos, sin refactor general. El historial H04 es una incompatibilidad que además tiene efecto funcional demostrado.

### H08 — HIGH — Validación de seguridad pendiente por emulador

`npm run test:rules` inicia el proyecto aislado `demo-stratexa-rules`, pero Java 21.0.12 no consigue crear el loopback del selector Netty. Mensajes: `Unable to establish loopback connection`, `SocketException: Invalid argument: connect`; posteriormente `LegacySystemExit` ausente al cerrar. Se intentó normal, preferencia IPv4 y selector Windows disponible. Las tres ejecuciones terminan antes de Jest. No se modificó instalación, reglas ni configuración permanente.

Solución mínima: ejecutar el script existente en un entorno de Java/loopback operativo y obtener resultado actual de reglas. No sustituirlo por pruebas de autorización mock ni por resultado histórico.

### H09 — HIGH — Smoke visual y persistencia real pendientes

`npm run dev -- --host 127.0.0.1` inicia Vite en puerto 3000 y responde HTTP 200. La herramienta de navegador falla antes de leer la página: `node_repl kernel exited unexpectedly`, con diagnóstico de sandbox `setup refresh had errors`. No se alteraron datos productivos. No se probó autenticación ni Firestore real. Se necesita un entorno aislado de datos y roles para cerrar esta validación.

### H10 — LOW — Residuos legacy y componentes desconectados

Hay fallbacks `|| 'IPS'` en selección inicial, jerarquía, exportación/identidad auxiliar, restauración de grupos y reordenamiento. No se demostró fuga entre clientes. Servicios de ámbito rechazan solicitudes fuera de membresías; el principio universal no depende contractualmente de IPS. Sin embargo, estos fallbacks pueden ocultar contexto incompleto y se deben revisar por consumidor, junto con H01.

`AdvancedDataImporter` está importado en App sin montaje; `AddDashboardModal`, `BulkIndicatorDelete`, `AggregationStrategySelector` y `KpiActivityManager` no tienen consumidores de producto encontrados en la búsqueda. Existen reemplazos o flujos equivalentes, por lo que no se declara una capacidad principal perdida por cada componente. IA/PPT están deshabilitados de manera explícita y protegida por una prueba: no reabrirlos como parte de este cierre.

## 6. TypeScript: clasificación

Reproducción CLI: `npx tsc --noEmit`, exit 2. Comparación mediante compiler host de lectura: se superponen a los archivos modificados sus textos HEAD y se excluyen archivos sin seguimiento del programa baseline. Resultado: **baseline 76; actual 76; introducidos 0; retirados 0**. No se restauró el working tree.

**49 tests/fixtures + 1 helper de pruebas + 26 diagnósticos en código de producción = 76**. «Producción» describe dónde está el diagnóstico, no 26 crashes demostrados. Los 76 impiden un gate TypeScript verde; el único error cuyo efecto incorrecto se reprodujo directamente aquí es TS2367 del mapeo de historial (H04). La auditoría no equipara todos los errores de tipos con BLOCKER operativo.

| Familia | Cantidad | Interpretación |
| --- | ---: | --- |
| TS2741 / TS2739 | 29 | Propiedades obligatorias faltantes; fixtures desactualizados y contratos de librerías |
| TS2339 | 19 | Campos/import.meta/enum fuera del tipo y datos inferidos como unknown |
| TS2345 / TS2322 | 21 | Modelos/argumentos incompatibles; SDK y estructuras de continuidad |
| TS2367 | 3 | Comparaciones de tipos incompatibles; una demuestra H04 |
| TS2305 / TS2352 / TS2353 / TS2698 | 4 | Import obsoleto, cast incompleto, opción docx incompatible y spread unknown |

La causa dominante es desalineación entre contratos de tipos y consumidores/fixtures tras migraciones. No hay una única causa que resuelva los 76: también hay typings Vite ausentes, interop SDK de Firestore, opciones de docx/ExcelJS, adaptadores legacy y eventos canónicos.

| Archivo/componente | Errores | Ámbito | Origen probable e impacto | Prioridad de clasificación |
| --- | ---: | --- | --- | --- |
| ActivityManager.test | 1 | Test | Activity se exporta del componente, no types | BASELINE_DEBT / LOW |
| AggregateBuilder.test | 7 | Test | Fixtures sin weight/type/goalType | BASELINE_DEBT / LOW |
| CurrentPeriodFocus.test | 3 | Test | Fixtures sin weight | BASELINE_DEBT / LOW |
| CurrentPeriodFocus | 2 | Producción | RescheduleRecord canónico vs vista legacy; DESCARTADO fuera del union | BASELINE_DEBT / MEDIUM |
| ContributionMatrixUX.test | 15 | Test | order/areaCode/dashboardAccess faltan; tipos y enum legacy | BASELINE_DEBT / LOW |
| TrackingStartPeriodControls | 2 | Producción | Discriminación de union insuficiente; lógica correlaciona frecuencia | BASELINE_DEBT / LOW |
| contributionParity.test | 2 | Test | Assignment sin id/clientId | BASELINE_DEBT / LOW |
| firestore.rules.test | 12 | Test | DocumentReference cliente/admin incompatible e inferencia unknown | BASELINE_DEBT / MEDIUM; suite necesita ejecución |
| index | 3 | Producción | ImportMeta.env sin declaraciones Vite; build transpila | BASELINE_DEBT / LOW |
| tableroReadScope | 1 | Producción | Cast de perfil sin name/dashboardAccess | BASELINE_DEBT / MEDIUM |
| inMemoryKpiBackend.test | 1 | Test | Forma activityConfig antigua | BASELINE_DEBT / LOW |
| inMemoryKpiBackend | 1 | Soporte tests | entries del Map frente a valores esperados | BASELINE_DEBT / LOW |
| aggregationUtils | 1 | Producción | sources usa boardId; AggregationSource requiere dashboardId; App consume boardId | BASELINE_DEBT / MEDIUM; no rename unilateral |
| checklistBulkImport | 2 | Producción | Union string/ChecklistElement permite registro sólo label; acceso id/target sin narrowing | BASELINE_DEBT / MEDIUM |
| compliance | 2 | Producción | isAggregate leído en DashboardItem sin contrato declarado | BASELINE_DEBT / MEDIUM |
| continuityAdapter | 5 | Producción | Compatibilidad objeto/array deriva unknown | BASELINE_DEBT / MEDIUM |
| controlExecutiveReportDocx | 1 | Producción | widowControl fuera del tipo de opción de estilo; renderizador actual pasa | BASELINE_DEBT / LOW |
| enterpriseRecoveryUtils | 1 | Producción | Tipo Borders exige diagonal | BASELINE_DEBT / LOW |
| ExecutiveOperationalExport | 4 | Producción | Borders diagonal y cell.row comparado como número | BASELINE_DEBT / LOW; revisar autofit |
| formula_audit.test | 3 | Test | Fixtures sin weight | BASELINE_DEBT / LOW |
| operationalAlerts.test | 2 | Test | Dashboard sin subtitle/thresholds | BASELINE_DEBT / LOW |
| operationalHistory.test | 2 | Test | Dashboard sin subtitle | BASELINE_DEBT / LOW |
| resolutionHistory | 2 | Producción | Evento inexistente e inferencia de status; H04 demostrado | BASELINE_DEBT + MEDIUM funcional |
| universalNavigation.test | 1 | Test | GlobalUserRole.Viewer inexistente | BASELINE_DEBT / LOW |

El anexo `AUDITORIA_PRECIERRE_TYPESCRIPT_2026-10-05.md` contiene los 76 diagnósticos completos y blame selectivo por archivo. Un blame de línea no se presenta como prueba del commit que introdujo todos los errores de ese archivo.

## 7. Funciones huérfanas

Huérfanas según rol/estado: lectura operativa de usuario canónico (H01); edición estratégica de tenant_admin canónico (H02); PDF/DOCX de tableros con frecuencias mixtas (H03). El salto a la ficha del KPI desde estrategia está conectado sólo hasta el tablero (H05).

Huérfanas intencionales: IA/PPTX deshabilitados. Componentes históricos sin consumidor encontrados: AdvancedDataImporter, AddDashboardModal, BulkIndicatorDelete, AggregationStrategySelector y KpiActivityManager. No se propone retirarlos ni restaurarlos durante la auditoría. La importación/checklist actual sí tiene entrada y no se confunde con AdvancedDataImporter.

## 8. Regresiones y desajustes confirmados

- ActionPlan: regresión histórica demostrada y ya corregida localmente; conservada y revalidada. Falta certificación visual/real.
- Acceso canónico de App: incompatibilidad de migración reproducida; no se certifica cuándo funcionó por última vez.
- Autoridad estratégica canónica: incompatibilidad de gates legacy reproducida; no hay última versión canónica funcional demostrada.
- Exportación de frecuencia mixta: bloqueo reproducido en flujo introducido por `0ef498ae`; no se inventa un estado anterior de ese flujo.
- Historial de continuidad: evento mal interpretado desde `6a40fc25`, reproducido.
- Estrategia → KPI y cierre anticipado de checklist: defectos actuales confirmados, sin evidencia suficiente para fechar una pérdida respecto de una versión anterior funcional.

No se usa `NINGUNA_REGRESION_ADICIONAL_DETECTADA`: sí hay defectos adicionales. Se distingue defecto actual demostrado de regresión temporal demostrada.

## 9. Huecos de pruebas relevantes

1. App real con documentos persistidos de membresía, viewers/editors/directors/admins y revocación; las pruebas de auth mockean `getDocs` vacío y hijos, y suelen partir de estructuras UI ya normalizadas.
2. Menú/CTA/formulario estratégico usando autoridad canónica por cliente, además de legacy Admin y lectores.
3. CONTROL padre → formatos con un mismo tablero de KPI mensuales/semanales.
4. Resolver history de COMPLETE/CLOSE_UNMET y preservar estado/resultado; las pruebas del motor no validan necesariamente la etiqueta del consumidor.
5. Clic del mapa/matriz → App → DashboardView → KPI exacto, conservando dashboardId/itemId.
6. Checklist con promesa pendiente, rechazo y reintento; páginas/filtros/selección masiva/borrado/vaciado y exportaciones seguras en el mismo flujo.
7. Creación ActionPlan contra reglas de emulador, recarga y roles, más matriz visual en navegador.
8. Roundtrip CSV global y contexto de cliente; prueba visual de PDF/DOCX con los filtros aplicados. Renderizar un archivo en test no prueba que el usuario pueda obtenerlo.

## 10. Qué está terminado dentro del alcance comprobado

- Fix local mínimo del CTA ActionPlan y su matriz positiva; autorización/persistencia simulada, relacionados y deduplicación.
- Contratos de identidad técnica, ownership físico y no mezcla de KPI homónimos en las suites actuales.
- Dominio de cálculo/captura, periodos y continuidad con las limitaciones semánticas documentadas.
- Implementación del checklist masivo y casos automatizados de importación/actualización preservando ID y realizado.
- Renderizadores PDF/DOCX reales y contratos de exportación sobre fuentes homogéneas en tests.
- Build de producción local y auditoría de evidencia completados.

Estas afirmaciones no certifican de punta a punta las capacidades con H01–H06 ni sustituyen validación visual/persistencia real.

## 11. Qué falta, priorizado

| Prioridad | Trabajo finito |
| --- | --- |
| BLOCKER | Resolver H01 y demostrar acceso autorizado de App real para membresías canónicas, sin expansión de tenant |
| HIGH | Resolver H02 y H03; ejecutar reglas actuales; smoke visual y persistencia contra entorno aislado |
| MEDIUM | Resolver H04/H05/H06 y cerrar sus pruebas de integración; reconciliar contratos productivos TypeScript; comprobar datos reales IPS Dirección en lectura |
| LOW | Completar fixtures/typings restantes hasta tsc verde; clasificar consumidores de fallback/residuos. No eliminación general de código ni reactivar IA/PPT |

Aunque parte de la deuda TypeScript sea LOW, el gate global exige cero errores o una excepción formal definida por el proyecto; esta auditoría no aprueba una excepción.

## 12. Ruta mínima de cierre

1. **Autoridad y acceso:** H01/H02; usar contratos actuales de membresía, sin ampliar permisos. Probar App real, matriz por rol y reglas de aislamiento.
2. **Flujos concretos:** H03/H04/H05/H06, cada uno con cambio mínimo y su reproducción convertida en regresión. Revalidar ActionPlan y CONTROL.
3. **Contratos TypeScript:** reconciliar continuidad/identidad y luego fixtures/SDK/typings/librerías. No cambiar modelos de datos sin necesidad demostrada. Comparar contra los 76 diagnósticos base y obtener tsc verde.
4. **Certificación de cierre:** resolver el entorno del emulador/navegador; suite completa, rules, tsc, build y diff; smoke con roles y datos aislados, crear/recargar ActionPlan, filtros CONTROL, estrategia IPS Dirección y checklist. Revisar evidencia antes de cualquier decisión de release.

No se inicia ninguno de esos fixes desde esta auditoría.

## 13. Recomendación de release

**NO_LISTO.** Existe un BLOCKER de acceso reproducido, otros defectos funcionales, typecheck global rojo y validación de reglas/visual/real pendiente. Un build verde y 838 pruebas no bastan para superar esos hallazgos.

## 14. Validaciones y estado final

Scripts actuales leídos de package.json: `dev`, `build`, `predeploy`, `deploy:safe`, `preview`, `integrity`, `test`, `test:rules`. Sólo se ejecutaron scripts pertinentes de validación; no predeploy/deploy ni scripts inventados.

| Comando/evidencia | Resultado |
| --- | --- |
| `npm test -- --runInBand --silent --json --outputFile=tmp/preclose-jest.json` | PASS: 104 suites / 838 pruebas |
| `npx jest tmp/preclose.probes.test.tsx --runInBand --silent` | 12 observaciones confirmadas: defectos y matriz negativa de planes; no certifica PASS de los defectos |
| `npx jest tmp/preclose.app-access.test.tsx --runInBand --silent` | 2 observaciones confirmadas: diferencia legacy/canónico en App real |
| `npm run test:rules` | NOT_TESTABLE; exit 1 antes de Jest. Normal, IPv4 y selector Windows no arrancan |
| `npx tsc --noEmit` | FAIL: 76 errores |
| `node tmp/preclose-ts-baseline.cjs` | HEAD 76 / actual 76 / diferencias 0 |
| `npm run build` | PASS; advertencias imports estáticos/dinámicos y chunks grandes |
| `git diff --check` | PASS inicial y durante auditoría; comprobación final registrada al entregar |
| `npm run dev -- --host 127.0.0.1` | Vite disponible; HTTP 200 en localhost:3000 |

Smoke prioritario, cada punto por separado: Crear plan **VISUALLY_NOT_TESTED**; Planes relacionados **VISUALLY_NOT_TESTED**; CONTROL **VISUALLY_NOT_TESTED**; CONFIGURAR **VISUALLY_NOT_TESTED**; REGISTRAR AVANCE **VISUALLY_NOT_TESTED**; GESTIONAR **VISUALLY_NOT_TESTED**; estrategia/mapa **VISUALLY_NOT_TESTED**; checklist **VISUALLY_NOT_TESTED**.

Persistencia real ActionPlan/metas/checklist/estrategia y reglas desplegadas: **NOT_TESTABLE** en esta ejecución. No se inspeccionaron ni alteraron documentos de producción. No se presume equivalencia de reglas locales y desplegadas. Los resultados se refieren a HEAD más el fix local ActionPlan conservado.

Logs/sondas completos disponibles en `tmp/preclose-*.log`, `tmp/preclose-jest.json`, `tmp/preclose-probes.json`, `tmp/preclose-app-access.json`, `tmp/preclose-ts-baseline.json` y los scripts/tests temporales citados. Son archivos ignorados por Git; la clasificación y hallazgos durables están en los documentos de `docs/`.

**AUDITORIA_PRECIERRE_FAIL**.

## 15. Restricciones cumplidas

**NO PUSH. NO DEPLOY. NO RELEASE. NO FUNCIONALIDADES NUEVAS. NO COMMIT.** Fix ActionPlan preservado. No se corrigieron hallazgos ni se borraron residuos durante la auditoría.
