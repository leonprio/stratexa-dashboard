# Auditoría de deuda TypeScript: 74 diagnósticos

Fecha: 2026-10-05. Repositorio: `C:\APP-TABLERO-LOCAL\stratexa-dashboard`.

Recomendación: **TYPESCRIPT_REQUIRES_MINIMAL_FIXES**.
Estado: **TYPESCRIPT_AUDIT_REQUIRES_FIXES**.

Se recomienda sanear siete diagnósticos asociados a fixtures antes de utilizar esas pruebas como certificación final. No se demuestra un bloqueo de runtime de la aplicación en los 24 diagnósticos de producción. No se corrigió código, tests, reglas ni modelo de datos en esta auditoría.

## Estado y captura

- Rama: `main`.
- HEAD: `41d25788fc55925caf14e7d2e15113e2c39daa8d`.
- Estado inicial: 26 archivos tracked modificados, 430 inserciones y 74 eliminaciones; 13 archivos untracked preexistentes. Árbol local aceptado sin limpieza.
- `git diff --check`: salida 0; avisos LF/CRLF preexistentes.
- `npx tsc --noEmit --pretty false`: salida 1, exactamente 74 diagnósticos. No es una compilación TypeScript exitosa.
- Captura completa sin resumen: [TS_AUDIT_CURRENT_RAW_2026-10-05.txt](TS_AUDIT_CURRENT_RAW_2026-10-05.txt).
- Inventario estructurado: [TS_AUDIT_CURRENT_DIAGNOSTICS_2026-10-05.json](TS_AUDIT_CURRENT_DIAGNOSTICS_2026-10-05.json).
- Overlay de lectura de HEAD mediante CompilerHost, misma configuración y dependencias locales: 76 diagnósticos. Se leyeron versiones con `git show`; no se restauraron archivos. Comparación por archivo, código y mensaje completo, ignorando desplazamientos de línea: 0 añadidos, 2 retirados, ambos de `utils/resolutionHistory.ts` (TS2367 y TS2322, H04).

## Distribución y categorías

| Ámbito físico, excluyente | Diagnósticos |
| --- | ---: |
| Código de producción | 24 |
| Archivos de tests | 49 |
| Helper de pruebas `testUtils/inMemoryKpiBackend.ts` | 1 |
| Total | 74 |

Dentro de los 49 diagnósticos de tests, 36 corresponden a fixtures y 13 a contratos/importaciones de la infraestructura de tests. No deben sumarse de nuevo al total. La categoría FIXTURE_ONLY incluye esos 36 y el helper: 37.

| Categoría asignada | Cantidad |
| --- | ---: |
| BLOCKER_RUNTIME | 0 |
| HIGH_RUNTIME_RISK | 0 |
| MEDIUM_TYPE_INCONSISTENCY | 3 |
| TEST_ONLY | 13 |
| FIXTURE_ONLY | 37 |
| BASELINE_DEBT_SAFE | 21 |

Riesgo de runtime **demostrado en la aplicación**: 0 diagnósticos. Esto no prueba ausencia general de bugs, ni valida datos externos arbitrariamente corruptos. Siete diagnósticos señalan fixtures capaces de introducir undefined o rutas de cálculo no representativas en las pruebas. Los otros 67 pueden permanecer como deuda no bloqueante para una auditoría funcional; el gate global `tsc` seguirá rojo.

## Causas dominantes

| Causa homogénea | Cantidad | Comentario |
| --- | ---: | --- |
| Fixtures omiten campos requeridos de KPI/tablero/estrategia/usuario/asignación | 30 | weight, goalType, order, areaCode, subtitle, thresholds, dashboardAccess, id/clientId |
| Fixtures usan `Acumulado`/`Mensual` como tipo de cálculo | 3 | Un cuarto diagnóstico de Dashboard[] engloba otro `Mensual` y campos faltantes; contado en la fila anterior |
| Enum inexistente `GlobalUserRole.Viewer` en fixtures | 2 | El valor JavaScript es undefined |
| Fixture de actividad con estructura `activities` ajena al contrato por periodo | 1 | La prueba verifica la conservación de un mock inválido |
| Transacciones Firestore compat y referencias modulares | 12 | Interoperabilidad de runtime comprobada; tipado incompatible |
| Importación de Activity ausente, sólo en test | 1 | No se usa como valor de runtime |
| Map.entries declarado como lista de tableros en helper | 1 | Contrato incorrecto; método actualmente sin consumidores |
| Contratos/descriptores de producción | 24 | Desglosados abajo |
| Total | 74 | |

Por código: TS2305=1, TS2322=8, TS2339=19, TS2345=12, TS2352=1, TS2353=1, TS2367=2, TS2698=1, TS2739=9, TS2741=20.

## Todos los diagnósticos de producción

| Archivo y líneas actuales | TS | N | Categoría | Valor real, guard y efecto |
| --- | --- | ---: | --- | --- |
| components/CurrentPeriodFocus.tsx:312 | 2322 | 1 | MEDIUM_TYPE_INCONSISTENCY | Asigna RescheduleRecord[] canónico a campo UI con forma legacy. ContinuityWorkspace/ContinuityPanel reciben identidad y consultan el compromiso en item; no leen ese historial legacy. KpiActivityManager sí lee fromPeriodIndex, pero no hay consumidores JSX de ese componente en el árbol actual. Riesgo latente si se vuelve a conectar; no migrar datos. |
| components/CurrentPeriodFocus.tsx:1626 | 2345 | 1 | MEDIUM_TYPE_INCONSISTENCY | `DESCARTADO` real excluido del union UI. Gestión de descartados pasa identidad a ContinuityWorkspace; sus acciones se deciden por compromiso canónico y no por este status. No cambia persistencia ni permiso. |
| components/TrackingStartPeriodControls.tsx:14 | 2339 | 2 | BASELINE_DEBT_SAFE | Guard `value?.frequency === frequency` garantiza la variante mensual/semanal antes del acceso. TS no conserva la correlación entre ambos discriminantes. Cambio de frecuencia usa índice 0. No se demuestra undefined en valores válidos. |
| index.tsx:16,18,20 | 2339 | 3 | BASELINE_DEBT_SAFE | Vite proporciona import.meta.env.DEV; faltan declaraciones vite/client en tsconfig.types. Las rutas harness sólo se activan en desarrollo. No es env undefined en bundle Vite. |
| services/tableroReadScope.ts:18 | 2352 | 1 | BASELINE_DEBT_SAFE | Perfil parcial construido con id/email garantizados y posible rol platform_admin. name/dashboardAccess requeridos por User no garantizados aquí. Consumidores de alcance usan membresías hidratadas; legacyMemberships protege dashboardAccess con {}. Perfil ausente sin plataforma arroja error; requestedTenants exige membresías. No se demuestra escalada ni navegación incorrecta causada por este cast. No corregir reintroduciendo acceso de plataforma a datos de negocio. |
| utils/aggregationUtils.ts:193 | 2322 | 1 | MEDIUM_TYPE_INCONSISTENCY | sources produce boardId/itemId; el cast lo identifica como AggregationSource, que exige dashboardId. App.tsx:1828 consume explícitamente boardId y lo normaliza con String; derivedFrom usa dashboardId con otro contrato. La propagación actual coincide con el valor real. Renombrar sources a dashboardId sin tocar consumidores rompería escrituras. |
| utils/checklistBulkImport.ts:155,157 | 2339 | 2 | BASELINE_DEBT_SAFE | Union de ChecklistElement y {label} para entrada string legacy. targetCount ausente usa ??1; existingId es optional. ActivityManager pasa elementos completos. Ausencia de id en preview legacy no es persistencia demostrada de undefined. |
| utils/compliance.ts:684,722 | 2339 | 2 | BASELINE_DEBT_SAFE | Marcador isAggregate legacy ausente del contrato KPI. Leer propiedad inexistente devuelve undefined y condición falsa; no se desreferencia ni se persiste. Indicadores compound/formula también excluidos de captura. No se demuestra regresión de métricas causada por la lectura. |
| utils/continuityAdapter.ts:430,431,435,446 (dos accesos) | 2339 | 5 | BASELINE_DEBT_SAFE | Object.values en rama de compatibilidad infiere unknown[]. Config canónica es lista por periodo; Array.isArray la selecciona. Guard activity?.id evita elementos vacíos. Id/targetCount reales vienen del checklist y target inválido/no positivo conserva originalTarget. Reconciliación tiene pruebas; no modificar semántica de progreso. |
| utils/controlExecutiveReportDocx.ts:71 | 2353 | 1 | BASELINE_DEBT_SAFE | widowControl aceptado por ParagraphProperties de docx instalado; declaración de estilo más estrecha. El constructor consume la opción, no hay acceso undefined ni alteración de datos. Campo de paginación. |
| utils/enterpriseRecoveryUtils.ts:123 | 2741 | 1 | BASELINE_DEBT_SAFE | Bordes sin diagonal. ExcelJS BorderXform protege model.diagonal y permite ausencia; exportación local comprobada. Sólo estilo. |
| utils/ExecutiveOperationalExport.ts:104,111 | 2741 | 2 | BASELINE_DEBT_SAFE | Mismo contrato de bordes. Exportación actual ejecutable, no pérdida de datos. |
| utils/ExecutiveOperationalExport.ts:612 (dos comparaciones) | 2367 | 2 | BASELINE_DEBT_SAFE | Cell.row declarado string por dependencia, getter runtime devuelve _row.number. Comparar con 1/2 es correcto para excluir encabezados de autofit. Comprobado con ExcelJS instalado; no convertir indiscriminadamente a string. |
| Total | | 24 | | |

No hay diagnóstico actual en contratos de ActionPlan, resolución de navegación canónica o cambios H06 de espera asíncrona. No se demostró ruta de producción que pierda datos, navegue a identidad equivocada o rompa permisos como consecuencia de estos 24 errores.

## MUST_FIX_BEFORE_FINAL_AUDIT

Gate de **validez de evidencia**, no de fallos demostrados de producción. Siete diagnósticos, tres grupos priorizados:

1. **Permisos: 2 TS2339**. `components/strategy/ContributionMatrixUX.test.tsx:164` y `utils/universalNavigation.test.tsx:178` usan GlobalUserRole.Viewer inexistente. La prueba CASE 7 etiqueta como Viewer un rol undefined: el guard puede denegar por identidad inválida en vez de evaluar un lector válido. La prueba Regla F pasa tableros ya filtrados al sidebar, sin demostrar que el usuario válido obtenga realmente ese alcance. Usar usuario lector válido según contrato existente, con acceso/membresía explícita; confirmar lectura positiva y edición denegada. No inventar un nuevo rol ni modificar autorizaciones de producción.
2. **Cálculos: 4 diagnósticos**. `ContributionMatrixUX.test.tsx:78,88,107` (TS2322) y `:714` (TS2322 de Dashboard[]; incluye type Mensual en su item). `Acumulado`/`Mensual` no son variantes del discriminante de cálculo. compliance compara literales canónicos y utiliza heurísticas/fallback ante otros strings: la prueba no certifica el modo declarado. Usar accumulative/average según intención de cada KPI, frequency monthly separada; completar sólo los campos necesarios para fixtures válidos. Incluir escenario donde suma y promedio produzcan resultados distintos. No asumir average para Eficiencia sin revisar intención del test.
3. **Persistencia simulada: 1 TS2339**. `testUtils/inMemoryKpiBackend.test.ts:34` lee activityConfig.activities; makeTestItem (línea 112 del helper) crea {activities:[{id,name}]} con cast any. El contrato real requiere índice de periodo y elementos id/label/targetCount/completedCount. Su prueba pasa porque JSON clona el mock inválido. Construir fixture por periodo y verificar ese periodo tras reconstrucción. No cambiar modelo ni backend real.

Corregir el fixture común puede retirar diagnósticos adicionales; no se promete quedar en 67 ni se persigue cero. La evidencia alternativa con usuarios válidos y fixtures canónicos puede reemplazar estas pruebas, pero debe quedar identificada explícitamente en la certificación final.

## NON_BLOCKING_BASELINE_DEBT

**67 diagnósticos**: 24 de producción, 42 de tests y 1 del helper.

Los 12 de Firestore se agrupan como TEST_ONLY: RulesTestEnvironment entrega API compat, doc() devuelve referencia modular y Transaction compat llama castReference -> firestore._cast(DocumentReference). Experimento local offline con Transaction compat y doc modular confirmó aceptación de la referencia. No se ejecutaron emuladores ni se certificó aquí el resultado de reglas; la incompatibilidad de declaraciones no demuestra fallo de transacción. Mantener test:rules como comprobación necesaria en auditoría final.

El snapshot del helper declara TestDashboard[] pero devuelve Map.entries ([id, dashboard][]). La búsqueda de consumidores en el repositorio sólo encuentra la declaración. Es un contrato realmente incorrecto, actualmente sin efecto en certificaciones ejecutadas; deuda FIXTURE_ONLY no bloqueante. Si se incorpora a una certificación, deberá decidirse values() frente a tipo de tupla según uso.

Import Activity no exportado, omisiones de weight/order/etc y marcadores legacy restantes no prueban por sí mismos fallos funcionales. Sus fixtures no deben extenderse a nuevos escenarios que dependan de los campos omitidos sin completarlos. Las dos formas de historial UI y sources merecen saneamiento de tipos localizado futuro para impedir consumidores nuevos erróneos.

## Protección y evidencia ejecutada

ActionPlan, H01/H02, H03, H04, H05, H06 y H07: **0 diagnósticos nuevos respecto de HEAD**, comparación con el compilador sobre overlay de lectura. Errores en archivos editados como CurrentPeriodFocus y ActivityManager.test son históricos: no son atribución de regresión a H06/H07. H04 retiró dos errores. No se modificaron los fixes ni sus pruebas/documentos previos.

Pruebas ejecutadas en esta auditoría: `npx jest --runInBand testUtils/inMemoryKpiBackend.test.ts utils/continuityAdapter.test.ts utils/aggregationUtils.test.ts utils/compliance.test.ts utils/checklistBulkImport.test.ts utils/universalNavigation.test.tsx`: **6 suites y 71 pruebas PASS**. Que pasen no subsana los fixtures no representativos identificados.

Comprobaciones offline sin escrituras externas: compat Transaction.set acepta doc modular; ExcelJS Cell.row=1 y typeof=number; XLSX con border sin diagonal serializa 6105 bytes. Inspección de docx confirma consumo de widowControl. Ninguna llamada a backend de producción.

La auditoría H06 previa ejecutó 28 suites/243 pruebas y build exitoso; son resultados anteriores, no nuevas ejecuciones de esta tarea. Esta auditoría no repitió build ni pruebas protegidas completas porque no cambió código. No valida visualmente navegador.

## Ruta mínima

**Un microciclo de saneamiento**, limitado a fixtures de permisos, cálculo y persistencia simulada en los tres archivos de tests y makeTestItem del helper si es necesario. Son siete ubicaciones diagnósticas, no 74 fixes. Después: suites afectadas con escenarios positivos/negativos válidos y recaptura/diferencia de tsc. Sin cambiar reglas, modelo, contratos de producción ni fixes funcionales.

El saneamiento de los 24 diagnósticos de producción es opcional en otro microciclo posterior; no forma parte del conjunto imprescindible demostrado. Si la política final exige tsc=0 como gate absoluto, este baseline no cumple esa política: requiere decisión explícita sobre deuda, no supresión global de diagnósticos.

NO PUSH. NO DEPLOY. NO RELEASE. NO COMMIT. No reset, stash ni checkout.

## Inventario individual

La tabla siguiente asigna categoría y gate a cada uno de los 74 diagnósticos. El mensaje completo se conserva en la captura y JSON; la causa y el impacto se explican por grupo arriba.

| # | Archivo | Línea | Código | Ámbito | Categoría | Gate |
| ---: | --- | ---: | --- | --- | --- | --- |
| 1 | components/ActivityManager.test.tsx | 6 | TS2305 | test | TEST_ONLY | DEBT |
| 2 | components/AggregateBuilder.test.tsx | 7 | TS2739 | test | FIXTURE_ONLY | DEBT |
| 3 | components/AggregateBuilder.test.tsx | 20 | TS2739 | test | FIXTURE_ONLY | DEBT |
| 4 | components/AggregateBuilder.test.tsx | 28 | TS2739 | test | FIXTURE_ONLY | DEBT |
| 5 | components/AggregateBuilder.test.tsx | 36 | TS2739 | test | FIXTURE_ONLY | DEBT |
| 6 | components/AggregateBuilder.test.tsx | 44 | TS2739 | test | FIXTURE_ONLY | DEBT |
| 7 | components/AggregateBuilder.test.tsx | 52 | TS2739 | test | FIXTURE_ONLY | DEBT |
| 8 | components/AggregateBuilder.test.tsx | 170 | TS2739 | test | FIXTURE_ONLY | DEBT |
| 9 | components/CurrentPeriodFocus.test.tsx | 12 | TS2741 | test | FIXTURE_ONLY | DEBT |
| 10 | components/CurrentPeriodFocus.test.tsx | 23 | TS2741 | test | FIXTURE_ONLY | DEBT |
| 11 | components/CurrentPeriodFocus.test.tsx | 34 | TS2741 | test | FIXTURE_ONLY | DEBT |
| 12 | components/CurrentPeriodFocus.tsx | 312 | TS2322 | production | MEDIUM_TYPE_INCONSISTENCY | DEBT |
| 13 | components/CurrentPeriodFocus.tsx | 1626 | TS2345 | production | MEDIUM_TYPE_INCONSISTENCY | DEBT |
| 14 | components/strategy/ContributionMatrixUX.test.tsx | 33 | TS2741 | test | FIXTURE_ONLY | DEBT |
| 15 | components/strategy/ContributionMatrixUX.test.tsx | 41 | TS2741 | test | FIXTURE_ONLY | DEBT |
| 16 | components/strategy/ContributionMatrixUX.test.tsx | 78 | TS2322 | test | FIXTURE_ONLY | MUST_FIX |
| 17 | components/strategy/ContributionMatrixUX.test.tsx | 88 | TS2322 | test | FIXTURE_ONLY | MUST_FIX |
| 18 | components/strategy/ContributionMatrixUX.test.tsx | 107 | TS2322 | test | FIXTURE_ONLY | MUST_FIX |
| 19 | components/strategy/ContributionMatrixUX.test.tsx | 118 | TS2741 | test | FIXTURE_ONLY | DEBT |
| 20 | components/strategy/ContributionMatrixUX.test.tsx | 129 | TS2741 | test | FIXTURE_ONLY | DEBT |
| 21 | components/strategy/ContributionMatrixUX.test.tsx | 152 | TS2741 | test | FIXTURE_ONLY | DEBT |
| 22 | components/strategy/ContributionMatrixUX.test.tsx | 160 | TS2741 | test | FIXTURE_ONLY | DEBT |
| 23 | components/strategy/ContributionMatrixUX.test.tsx | 164 | TS2339 | test | FIXTURE_ONLY | MUST_FIX |
| 24 | components/strategy/ContributionMatrixUX.test.tsx | 687 | TS2322 | test | FIXTURE_ONLY | DEBT |
| 25 | components/strategy/ContributionMatrixUX.test.tsx | 714 | TS2322 | test | FIXTURE_ONLY | MUST_FIX |
| 26 | components/strategy/ContributionMatrixUX.test.tsx | 733 | TS2741 | test | FIXTURE_ONLY | DEBT |
| 27 | components/strategy/ContributionMatrixUX.test.tsx | 744 | TS2741 | test | FIXTURE_ONLY | DEBT |
| 28 | components/strategy/ContributionMatrixUX.test.tsx | 755 | TS2741 | test | FIXTURE_ONLY | DEBT |
| 29 | components/TrackingStartPeriodControls.tsx | 14 | TS2339 | production | BASELINE_DEBT_SAFE | DEBT |
| 30 | components/TrackingStartPeriodControls.tsx | 14 | TS2339 | production | BASELINE_DEBT_SAFE | DEBT |
| 31 | contributionParity.test.ts | 199 | TS2345 | test | FIXTURE_ONLY | DEBT |
| 32 | contributionParity.test.ts | 207 | TS2345 | test | FIXTURE_ONLY | DEBT |
| 33 | firestore.rules.test.ts | 1098 | TS2345 | test | TEST_ONLY | DEBT |
| 34 | firestore.rules.test.ts | 1099 | TS2339 | test | TEST_ONLY | DEBT |
| 35 | firestore.rules.test.ts | 1101 | TS2345 | test | TEST_ONLY | DEBT |
| 36 | firestore.rules.test.ts | 1107 | TS2345 | test | TEST_ONLY | DEBT |
| 37 | firestore.rules.test.ts | 1178 | TS2345 | test | TEST_ONLY | DEBT |
| 38 | firestore.rules.test.ts | 1180 | TS2345 | test | TEST_ONLY | DEBT |
| 39 | firestore.rules.test.ts | 1181 | TS2698 | test | TEST_ONLY | DEBT |
| 40 | firestore.rules.test.ts | 1184 | TS2345 | test | TEST_ONLY | DEBT |
| 41 | firestore.rules.test.ts | 1518 | TS2345 | test | TEST_ONLY | DEBT |
| 42 | firestore.rules.test.ts | 1519 | TS2339 | test | TEST_ONLY | DEBT |
| 43 | firestore.rules.test.ts | 1521 | TS2345 | test | TEST_ONLY | DEBT |
| 44 | firestore.rules.test.ts | 1527 | TS2345 | test | TEST_ONLY | DEBT |
| 45 | index.tsx | 16 | TS2339 | production | BASELINE_DEBT_SAFE | DEBT |
| 46 | index.tsx | 18 | TS2339 | production | BASELINE_DEBT_SAFE | DEBT |
| 47 | index.tsx | 20 | TS2339 | production | BASELINE_DEBT_SAFE | DEBT |
| 48 | services/tableroReadScope.ts | 18 | TS2352 | production | BASELINE_DEBT_SAFE | DEBT |
| 49 | testUtils/inMemoryKpiBackend.test.ts | 34 | TS2339 | test | FIXTURE_ONLY | MUST_FIX |
| 50 | testUtils/inMemoryKpiBackend.ts | 30 | TS2322 | helper | FIXTURE_ONLY | DEBT |
| 51 | utils/aggregationUtils.ts | 193 | TS2322 | production | MEDIUM_TYPE_INCONSISTENCY | DEBT |
| 52 | utils/checklistBulkImport.ts | 155 | TS2339 | production | BASELINE_DEBT_SAFE | DEBT |
| 53 | utils/checklistBulkImport.ts | 157 | TS2339 | production | BASELINE_DEBT_SAFE | DEBT |
| 54 | utils/compliance.ts | 684 | TS2339 | production | BASELINE_DEBT_SAFE | DEBT |
| 55 | utils/compliance.ts | 722 | TS2339 | production | BASELINE_DEBT_SAFE | DEBT |
| 56 | utils/continuityAdapter.ts | 430 | TS2339 | production | BASELINE_DEBT_SAFE | DEBT |
| 57 | utils/continuityAdapter.ts | 431 | TS2339 | production | BASELINE_DEBT_SAFE | DEBT |
| 58 | utils/continuityAdapter.ts | 435 | TS2339 | production | BASELINE_DEBT_SAFE | DEBT |
| 59 | utils/continuityAdapter.ts | 446 | TS2339 | production | BASELINE_DEBT_SAFE | DEBT |
| 60 | utils/continuityAdapter.ts | 446 | TS2339 | production | BASELINE_DEBT_SAFE | DEBT |
| 61 | utils/controlExecutiveReportDocx.ts | 71 | TS2353 | production | BASELINE_DEBT_SAFE | DEBT |
| 62 | utils/enterpriseRecoveryUtils.ts | 123 | TS2741 | production | BASELINE_DEBT_SAFE | DEBT |
| 63 | utils/ExecutiveOperationalExport.ts | 104 | TS2741 | production | BASELINE_DEBT_SAFE | DEBT |
| 64 | utils/ExecutiveOperationalExport.ts | 111 | TS2741 | production | BASELINE_DEBT_SAFE | DEBT |
| 65 | utils/ExecutiveOperationalExport.ts | 612 | TS2367 | production | BASELINE_DEBT_SAFE | DEBT |
| 66 | utils/ExecutiveOperationalExport.ts | 612 | TS2367 | production | BASELINE_DEBT_SAFE | DEBT |
| 67 | utils/formula_audit.test.ts | 7 | TS2741 | test | FIXTURE_ONLY | DEBT |
| 68 | utils/formula_audit.test.ts | 18 | TS2741 | test | FIXTURE_ONLY | DEBT |
| 69 | utils/formula_audit.test.ts | 29 | TS2741 | test | FIXTURE_ONLY | DEBT |
| 70 | utils/operationalAlerts.test.ts | 125 | TS2739 | test | FIXTURE_ONLY | DEBT |
| 71 | utils/operationalAlerts.test.ts | 153 | TS2739 | test | FIXTURE_ONLY | DEBT |
| 72 | utils/operationalHistory.test.ts | 107 | TS2741 | test | FIXTURE_ONLY | DEBT |
| 73 | utils/operationalHistory.test.ts | 124 | TS2741 | test | FIXTURE_ONLY | DEBT |
| 74 | utils/universalNavigation.test.tsx | 178 | TS2339 | test | FIXTURE_ONLY | MUST_FIX |
