# Cierre H07 — periodo semánticamente vacío

## Causa y regla funcional

Antes de este microciclo, hasTrackingFactsBeforePeriod devolvía hasFacts=true para Agosto del KPI real porque isExplicitOrLegacyValue(0, true) acepta el marcador sin examinar la ausencia conjunta de información. Septiembre presentaba el mismo patrón. La causa histórica posible ya estaba demostrada: guardar una meta 0 precargada podía marcarla como capturada sin edición. La nueva regla de negocio aportada por el usuario resuelve cómo tratar el estado actual; no se afirma que se haya probado la procedencia de cada flag.

Un periodo completamente examinado es SIN INFORMACIÓN si no tiene valores numéricos finitos distintos de cero, ni avance cero explícitamente capturado, ni notas sustantivas, ni actividades/checklist reales, ni continuidad/compromisos reales. Una meta 0 con monthlyGoalCaptured=true aislado no basta para proteger el periodo. Meta/avance positivos o negativos finitos siguen protegidos, incluso con marcadores false contradictorios. Un avance 0 con monthlyProgressCaptured=true mantiene protección; ese marcador corresponde a la ruta de captura de avance, distinta de la promoción defectuosa de metas. Una meta cero puede quedar protegida por evidencia asociada persistida, como una nota sustantiva, actividad o compromiso. No se inventan nuevos campos de procedencia.

Lista vacía = SIN INFORMACIÓN. Un borrador con sólo id, label vacío/espacios y cantidades cero tampoco constituye información. Lista con elementos reales = INFORMACIÓN: descripción sustantiva, cantidades finitas no cero o resolución persistida. Notas sólo con espacios no cuentan. La mera existencia del mapa, array o documento no cuenta.

## Cambio mínimo y fuente semántica

- utils/trackingObligation.ts: nuevo isTrackingPeriodSemanticallyEmpty; hasTrackingFactsBeforePeriod usa esa única regla cuando recibe el contexto completo del KPI. Conserva el resultado cronológico del primer periodo real.
- Los callers numéricos sin contexto permanecen conservadores: no pueden afirmar que notas/listas/continuidad están vacías. CurrentPeriodFocus ya pasa el item completo, por lo que no se duplica lógica en la UI.
- utils/trackingEmptyPeriod.test.ts: nueva suite semántica.
- components/CurrentPeriodFocus.effectiveStart.test.tsx: se adapta una expectativa previa de cero-meta aislado a la nueva instrucción del usuario y se añade el patrón exacto Agosto/Septiembre. No se elimina ningún caso; la suite pasa de 22 a 23 pruebas.

CurrentPeriodFocus.tsx y el fix preventivo de guardado mensual permanecen idénticos respecto al comienzo de esta tarea. ActionPlan, H01/H02, sus pruebas y toda la documentación previa también permanecen idénticos. Los hashes iniciales identifican únicamente cambios permitidos en el helper y la prueba H07 ajustada.

## Registro real: lectura y resultado sin escritura

Proyecto prior-01; clientId LVP; dashboardId LVP_2026_1783802885613; itemId 2.
Documento: tbl_dashboards/LVP_2026_1783802885613/items/2.
Nombre: Liderazgos juveniles activos.

Lectura REST de sólo el documento necesario y evaluación en memoria del helper local. Su updateTime continúa en 2026-10-05T17:14:31.441642Z.

| Campo | Agosto, índice 7 | Septiembre, índice 8 |
| --- | --- | --- |
| monthlyGoals | 0 | 0 |
| monthlyProgress | null | null |
| monthlyGoalCaptured | true | true |
| monthlyProgressCaptured | false | false |
| monthlyNotes | cadena vacía | cadena vacía |
| activityConfig | [] | [] |

continuityCommitments = {}.

Antes: primer bloqueo Agosto 2026, meta 0/avance null.
Después: hasTrackingFactsBeforePeriod(... Octubre 2026 ..., item completo) devuelve {hasFacts:false}. Evaluación sin mutación: dataUnchanged=true.

**No hace falta tocar Firebase.** Los flags históricos true de los índices 7/8 se conservan; no se borran metas, arrays, estructura, notas ni otro campo. No se propone una escritura innecesaria. El nuevo inicio no se guardó remotamente: sólo se verificó que puede seleccionarse con el código local corregido.

## Pruebas y validación

Antes del parche: nueva suite, 10 casos, 6 FAIL/4 PASS; reproducía flags aislados, positivos con marcador false, avance ausente con marcador true, borradores vacíos y datos desde Octubre.

Después: 14 suites, 151 pruebas PASS. Incluye 10 pruebas nuevas del helper y 23 de H07 en CurrentPeriodFocus, junto a trackingObligation, trackingStartSemantics, smartCapture, DataEditor, CurrentPeriodFocus, ActionPlan creación/persistencia, App canónica/runtime, CanonicalStrategyAccess, tableroAuthorization y tableroReadScope.

La UI real en Jest confirma que el patrón Agosto/Septiembre permite confirmar Octubre y emite exactamente el item original con trackingStartPeriod añadido, manteniendo flags y valores originales. También se protege información previa real y se identifica el primer periodo correcto.

TypeScript: npx tsc --noEmit mantiene los 76 diagnósticos históricos. Comparación semántica por archivo/código/mensaje y multiplicidad: baseline 76 / actual 76, cero introducidos y cero eliminados. tsc sigue saliendo con error por deuda ajena.

Build PASS (21.31 s, advertencia de chunks grandes). git diff --check PASS. No se ejecutó una validación visual de navegador; se validó la UI real mediante Jest/RTL y el helper sobre datos reales leídos. No hubo push, deploy, release, commit ni Firebase write.

## Certificación

| Control | Resultado |
| --- | --- |
| H07_EMPTY_CHECKLIST_IS_NO_DATA | PASS |
| H07_EMPTY_PERIOD_DOES_NOT_BLOCK | PASS |
| H07_REAL_DATA_BLOCKS | PASS |
| H07_ZERO_SEMANTICS_CORRECT | PASS |
| H07_OCTOBER_START_ALLOWED | PASS |
| H07_NO_DATA_LOSS | PASS |
| ACTIONPLAN_FIX_PRESERVED | PASS |
| H01_H02_FIXES_PRESERVED | PASS |

La certificación de Octubre corresponde al código local y al registro real evaluado en memoria. La aplicación desplegada adoptará esta semántica cuando se publique la corrección mediante una tarea autorizada; esta tarea no publica ni modifica el inicio remoto.

H07_EFFECTIVE_START_CORREGIDO_VALIDADO

NO PUSH / NO DEPLOY / NO RELEASE / NO COMMIT / NO FIREBASE WRITE.
