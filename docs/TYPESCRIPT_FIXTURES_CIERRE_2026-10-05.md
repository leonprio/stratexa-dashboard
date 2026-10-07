# Cierre del microciclo de fixtures TypeScript

Estado: **TYPESCRIPT_FIXTURES_CORREGIDOS_VALIDADO**.

Se corrigieron los siete diagnósticos MUST_FIX_BEFORE_FINAL_AUDIT sin modificar producción, enums, modelo ni Firestore Rules. No se introdujeron any ni conversiones unknown. Las expectativas matemáticas y de UI existentes se conservaron.

## Los siete casos (líneas del baseline de 74)

| Archivo | Línea | TS | Causa | Corrección |
| --- | ---: | --- | --- | --- |
| components/strategy/ContributionMatrixUX.test.tsx | 164 | TS2339 | GlobalUserRole.Viewer no existe | Member con membresía standard_user activa, alcance viewer y strategy_reader; lectura positiva y edición negativa |
| utils/universalNavigation.test.tsx | 178 | TS2339 | Mismo enum inexistente | Member, DashboardRole.Viewer y membresía canónica SOMOS con alcance exclusivo de GTO |
| components/strategy/ContributionMatrixUX.test.tsx | 78 | TS2322 | Ventas: Acumulado como discriminante | accumulative + frequency monthly; metas/progreso sin cambio |
| components/strategy/ContributionMatrixUX.test.tsx | 88 | TS2322 | Clientes: Acumulado como discriminante | accumulative + frequency monthly; metas/progreso sin cambio |
| components/strategy/ContributionMatrixUX.test.tsx | 107 | TS2322 | Eficiencia: Mensual como modo | average + frequency monthly; meta 95 y progreso 96 sin cambio |
| components/strategy/ContributionMatrixUX.test.tsx | 714 | TS2322 | Dashboard[] de escala con Mensual y campos requeridos ausentes | average + frequency monthly; completar subtitle/thresholds y campos requeridos de KPI; meta 100/progreso 95 sin cambio |
| testUtils/inMemoryKpiBackend.test.ts | 34 | TS2339 | activityConfig.activities ajeno al contrato | Fixture del helper y lectura de prueba por periodo 0 |

## Contratos reales y comprobaciones

El lector de matriz usa GlobalUserRole.Member y una membresía standard_user activa para CLIENT_1, dashboardScopes dash_1/dash_2 viewer, editableDashboardIds vacío y capabilities viewer/strategy_reader. dashboardAccess se proporciona vacío porque la membresía canónica define el alcance. CASE 7 comprueba canAccessDashboard(viewer)=true y canAccessDashboard(editor)=false antes de conservar sus expectativas de UI de sólo lectura.

La navegación parcial usa la misma forma canónica para SOMOS, con SOMOS_2026_GTO viewer. Comprueba lectura de GTO, edición denegada y lectura de QRO denegada. Se reemplazó el cast legacy `'Viewer' as any` del campo editado por DashboardRole.Viewer. No se añadieron roles ni permisos en producción.

Los fixtures de cálculo separan frequency monthly del modo accumulative/average. Se completaron los campos requeridos de esos mismos fixtures para evitar errores latentes expuestos al retirar los literales inválidos, y se retiraron jan_target/jan_real no pertenecientes al contrato; las series mensuales que usa el cálculo conservan exactamente sus valores. Los porcentajes esperados originales siguen iguales. Una prueba adicional con dos fuentes iguales distingue suma 200/210 de promedio 95/96; evita que un fallback conserve el porcentaje pero cambie la semántica.

La actividad queda como `activityConfig: { 0: [{ id: 'a1', label: 'Actividad inicial', targetCount: 1, completedCount: 0 }] }`. La prueba conserva la reconstrucción, null, cero explícito y observación, y compara la actividad completa del periodo 0 después de reconstruir el backend en memoria.

## TypeScript: diferencia exacta respecto de 67

`npx tsc --noEmit --pretty false`: **before 74, after 66, removed 8, new 0**. Salida 1 por deuda restante; no se declara compilación TypeScript limpia.

Los siete objetivos fueron retirados. El octavo es **TS2741, ContributionMatrixUX.test.tsx:160 en baseline**, dashboardAccess requerido ausente del mismo mockViewerUser. Representar ese lector como User válido requiere completar ese campo; por eso su desaparición es inseparable del saneamiento autorizado del fixture de permisos. No se hizo un saneamiento independiente del resto de la deuda. El objetivo aritmético de 67 suponía que este requisito del mismo fixture no desaparecería.

Comparación individual por archivo + TS + mensaje completo, normalizando CRLF y omitiendo desplazamientos de línea: los 66 diagnósticos conservados coinciden con el baseline. Incluye el TS2741 del mockAdminUser, snapshot del helper y los demás fixtures históricos, que no se corrigieron. De los 67 NON_BLOCKING_BASELINE_DEBT iniciales quedan 66; ninguno de los siete MUST_FIX queda pendiente. Producción sigue con 24 diagnósticos, tests con 41 y helper con 1.

Evidencia: [captura posterior](TS_FIXTURES_AFTER_RAW_2026-10-05.txt), [comparación individual](TS_FIXTURES_COMPARISON_2026-10-05.json). La captura e inventario anteriores de la auditoría permanecen intactos.

## Archivos de código modificados en este microciclo

- components/strategy/ContributionMatrixUX.test.tsx
- utils/universalNavigation.test.tsx
- testUtils/inMemoryKpiBackend.ts
- testUtils/inMemoryKpiBackend.test.ts

Además se añadieron este informe y los dos archivos de evidencia posteriores. Los archivos/documentos de fixes anteriores se conservaron; en ContributionMatrixUX se preservaron las pruebas y expectativas preexistentes.

## Validación

| Ejecución | Resultado |
| --- | --- |
| ContributionMatrixUX, universalNavigation, inMemoryKpiBackend | 3 suites / 26 pruebas PASS |
| Suites protegidas focalizadas | 13 suites / 132 pruebas PASS |
| Total, ejecuciones sin suites repetidas | 16 suites / 158 pruebas PASS |
| npm run build | PASS, salida 0; avisos de chunks/imports Firebase existentes |
| git diff --check | PASS, salida 0; avisos LF/CRLF existentes |

Suites protegidas ejecutadas: RelatedActionPlans.creation, actionPlanResultReviewPersistence, App.canonicalAccess, CanonicalStrategyAccess, App.strategyNavigation, resolutionHistory, ControlReportExport, controlExecutiveReportExport, ActivityManager, CurrentPeriodFocus, DataEditor, CurrentPeriodFocus.effectiveStart y trackingEmptyPeriod. DataEditor conserva avisos React act() preexistentes; todos los tests pasan. No se repitió la suite completa.

| Protección | Estado |
| --- | --- |
| ActionPlan | PASS |
| H01_H02 | PASS |
| H03 | PASS |
| H04 | PASS |
| H05 | PASS |
| H06 | PASS |
| H07 | PASS |

NO COMMIT. NO PUSH. NO DEPLOY. NO RELEASE. No reset, stash ni checkout destructivo.
