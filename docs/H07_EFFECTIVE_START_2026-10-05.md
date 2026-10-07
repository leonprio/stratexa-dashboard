# H07 — inicio efectivo y semántica de captura

## Estado inicial

main, HEAD 41d25788fc55925caf14e7d2e15113e2c39daa8d. 13 archivos tracked modificados, 86 inserciones/39 eliminaciones, más 7 archivos nuevos de trabajo previo. git diff --check limpio. Se guardaron hashes SHA-256 de los 20 archivos locales previos en tmp/h07-protected.json; todos permanecen idénticos después del microciclo.

## Respuesta expresa y causa raíz

**No:** el código previo no determina información real por mera existencia del objeto/periodo ni por valores definidos 0/0. utils/trackingObligation.ts:54 usa captured === true; sin marcador, sólo un número finito distinto de cero cuenta. hasTrackingFactsBeforePeriod (línea 121; condición previa en HEAD línea 134) aplica ese predicado a meta y avance. CurrentPeriodFocus.tsx:533 consume el resultado.

En el código previo, un mensaje Meta 0 · Avance 0 necesariamente requiere al menos uno de monthlyGoalCaptured[0]/monthlyProgressCaptured[0] true. El aspecto visual 0/0 y cero actividades no permite determinar si el flag representa una captura legítima o una promoción accidental. No se recibió el registro original; se solicitó al usuario. No se consultaron datos de producción.

**Ruta defectuosa demostrada:** CurrentPeriodFocus precarga una meta default 0 en localGoal. handleQuickSave marcaba monthlyGoalCaptured[currentIdx] = newGoalVal !== null (HEAD línea 1063), incluso sin editar la meta. Guardar el mes convertía el cero técnico en evidencia explícita; el guard protegía después ese flag. La prueba previa al fix recibió true donde debía conservar ausencia de captura. Ésta es una causa reproducible, sin afirmar que sea el historial exacto del KPI mostrado.

Además, el guard omitía monthlyNotes/weeklyNotes, activityConfig y compromisos de continuidad: dos pruebas previas demostraron que notas y actividades reales no bloqueaban el nuevo inicio. La corrección protege esos datos asociados del mismo KPI, sin modificar sus flujos de guardado.

## Contrato real del periodo

El registro mensual está en arrays del documento KPI; su año procede del tablero. No existe documento mensual separado requerido por esta regla. firebaseService guarda campos mediante batch; no crea flags de captura ni usa timestamps de documento como evidencia de un mes concreto.

| Caso | Evidencia | Comportamiento |
| --- | --- | --- |
| A Sin registro | arrays ausentes/vacíos, null/undefined | No bloquea |
| B Técnico 0/0 | sin marcador o marcador false, sin datos asociados | No bloquea |
| C Meta 0 explícita | monthlyGoalCaptured true | Bloquea |
| D Avance 0 explícito | monthlyProgressCaptured true | Bloquea |
| E Nota/incidencia | texto no vacío del periodo | Bloquea |
| F Actividad | descripción, cantidades finitas no cero o resolución persistida | Bloquea |
| G Continuidad | compromiso de tipo válido cuyo origen coincide en año/frecuencia/periodo | Bloquea |
| Datos al inicio o posteriores | comparación temporal >= candidato | Permitidos |

Una lista de actividades vacía, una nota con espacios o un draft con sólo id y cero/label vacío no bastan. El selector conserva el contrato numérico previo: false no demuestra captura; sin marcador, número finito no cero sí es evidencia legacy. No se cambian reglas de obligación, cálculos ni demás KPI.

**Límite histórico:** un cero legacy sin flag no distingue captura explícita antigua de default. El contrato existente ya lo considera ambiguo/no capturado. Un flag true tampoco guarda procedencia suficiente para separar captura legítima de la ruta defectuosa encontrada. No se borran ni reinterpretan flags true existentes; hacerlo permitiría esconder datos reales. No hay migración ni cambio de esquema.

## Historia demostrable

- 277aa99 (estado inicial del repositorio, 2026-02-09): IndicatorManager crea arrays mensuales default de ceros.
- 554ccb26, 2026-09-09, fix: restore KPI integrity and mobile performance: añade flags de captura y la asignación newGoalVal !== null. Protege el avance con lectura semántica, pero mantiene precarga literal de la meta.
- 6c1bd71e, 2026-09-10, feat: certify tracking obligation configuration: introduce el guard y el mensaje para evitar que el inicio deje fuera hechos históricos. Su predicado original ya reconoce ceros explícitos y rechaza ceros legacy ambiguos.

Los defaults preceden al guard; no hay evidencia de que un cambio posterior a defaults cause por sí solo la regresión. La interacción demostrada es default precargado + flag automático + guard posterior.

## Corrección mínima

1. components/CurrentPeriodFocus.tsx: un ref registra la edición explícita de meta y se reinicia cuando se sincroniza item/periodo. El guardado conserva evidencia previa o valor legacy inequívoco; sólo una edición explícita convierte el cero default en captura. No cambia el valor 0 almacenado de la meta.
2. utils/trackingObligation.ts: argumento opcional con datos asociados; devuelve el primer periodo con hecho numérico, nota, actividad sustantiva o compromiso de continuidad y un detalle legible.
3. CurrentPeriodFocus pasa el contexto al guard y muestra ese detalle en el mensaje.
4. Nuevo components/CurrentPeriodFocus.effectiveStart.test.tsx: matriz y regresión del flujo de guardado.

No se modifica DataEditor, Firebase persistence, Firestore Rules, ActionPlan, H01/H02 ni sus pruebas/documentos. Cambiar el inicio sólo añade trackingStartPeriod sobre copia del item; las pruebas comparan todos los campos e inmutabilidad del original.

## Pruebas y validación

Antes del fix: 15 casos, 12 PASS y 3 FAIL funcionales: promoción de meta técnica, notas ignoradas y actividades ignoradas. Después: 22 casos H07 PASS, incluyendo no registro, ceros default/false, ceros explícitos meta/avance, positivos, nota/nota vacía, actividad/lista vacía/draft vacío, continuidad, datos desde Octubre, primer periodo Abril, marcador undefined/false/true, captura explícita y guardar Enero sin editar seguido de inicio Octubre manteniendo meta 0.

Validación final: 13 suites, 140 pruebas PASS. Incluye CurrentPeriodFocus, DataEditor, trackingObligation, trackingStartSemantics, smartCapture, las dos suites ActionPlan protegidas, App canónica/runtime, CanonicalStrategyAccess, tableroAuthorization y tableroReadScope.

Build PASS (30.70 s; warning de chunks >500 kB). git diff --check PASS. npx tsc --noEmit conserva 76 diagnósticos históricos y sale con error por esa deuda. Comparación por archivo/código/mensaje y multiplicidad, ignorando desplazamientos de línea: baseline 76, actual 76, cero nuevos y cero eliminados. No se corrige deuda ajena.

VISUALLY_NOT_TESTED: cua.createBrowserTab falló antes de abrir la página: node_repl kernel exited unexpectedly, windows sandbox failed: setup refresh had errors. Pruebas del componente real en Jest/RTL; no certificación visual ni de datos de producción.

## Certificaciones

| Control | Resultado | Alcance |
| --- | --- | --- |
| H07_EMPTY_PERIOD_DOES_NOT_BLOCK | PASS | Enero técnico permite Octubre; promoción accidental impedida |
| H07_REAL_DATA_BLOCKS | PASS | Valores explícitos/no cero y datos asociados anteriores |
| H07_ZERO_SEMANTICS_CORRECT | PASS | Contrato local probado; procedencia del registro observado no verificable |
| H07_NO_DATA_LOSS | PASS | Item original inmutable, campos preservados al cambiar inicio |
| ACTIONPLAN_FIX_PRESERVED | PASS | Hashes idénticos y suites PASS |
| H01_H02_FIXES_PRESERVED | PASS | Hashes idénticos y suites PASS |

Pendiente: verificar los flags de Enero del KPI original. Si ya son true, la corrección no los elimina: se necesita evidencia de procedencia para decidir si son captura legítima. Este límite impide certificar la resolución del caso histórico concreto.

H07_EFFECTIVE_START_PARCIAL

NO PUSH / NO DEPLOY / NO RELEASE / NO COMMIT.
