# H08 — Copiar actividades a todo el año

Fecha: 2026-10-05

Rama: `main`
HEAD de partida: `41d25788fc55925caf14e7d2e15113e2c39daa8d`

## Causa raíz

La acción sale de `ActivityManager` (`components/ActivityManager.tsx`, botón COPIAR A TODO EL AÑO) y llega al callback anual de `DataEditor` (`components/DataEditor.tsx:655`). Antes del cambio, el bucle de `DataEditor` (`git blame`: `277aa99`, ampliado por `b6e01778`) recorría los 12 meses o 53 semanas y ejecutaba `sourceActivities.map(a => ({ ...a, completedCount: 0 }))` en cada índice. Incluía `activeActivityPeriod`, así que sustituía el progreso del periodo de origen. Una prueba H08 previa al fix reprodujo en el payload guardado `completedCount: 1 → 0`.

La copia también propagaba el objeto entero del origen, incluido `resolution` y su historial temporal. Finalmente, el callback llamaba a `onSave` sin `await`, presentaba éxito inmediatamente y no señalaba estado ocupado; el botón seguía aceptando clics. La persistencia real escribe el `activityConfig` entrante como mapa completo (`services/firebaseService.ts`, `updateDashboardItems`), por lo que el payload erróneo podía hacerse persistente. No se escribió en Firebase durante este trabajo.

## Contrato de copia

| Campo | Periodo origen | Periodos destino |
|---|---|---|
| `id` | Preservar | Copiar desde la lista actual del gestor |
| `label` | Preservar | Copiar desde la lista actual del gestor |
| `targetCount` | Preservar | Copiar desde la lista actual del gestor |
| `completedCount` | Preservar íntegro | Reiniciar a `0`, conforme al aviso existente “en los otros periodos” |
| `resolution` / status / historial | Preservar íntegro | No copiar desde el origen; preservar el valor propio del destino si coincide el ID |
| Notas mensuales/semanales del KPI | No modificar | No modificar |
| Metadatos estructurales no definidos por el esquema | Preservar en el origen | No copiar desde el origen |

El esquema de actividad define `id`, `label`, `targetCount`, `completedCount` y `resolution`. El aviso actual especifica el reinicio del avance únicamente en los otros periodos; las pruebas y operaciones normales mantienen el `completedCount` como valor del periodo. `resolution` contiene fechas, periodo programado y eventos de resolución, por lo que es estado propio del periodo, no estructura para clonar. Los compromisos canónicos siguen reconciliándose con `syncCommitmentsWithActivityConfig`; sus historiales no se migran ni se sustituyen.

## Cambio y flujo resultante

1. El gestor entrega su lista actual al callback anual.
2. Se clona el mapa de periodos. El índice origen se excluye expresamente y conserva su misma referencia y todos sus valores.
3. Para cada destino mensual/semanal se copian `id`, `label` y `targetCount`; `completedCount` se establece en `0`. Si el destino ya tenía `resolution` para el mismo ID, se conserva su estado propio; no se importa la resolución del origen.
4. Se calcula la sincronización de continuidad y se espera `await onSave(...)` antes de modificar el estado local y anunciar éxito.
5. Un ref impide un segundo envío aun antes de que React renderice el botón deshabilitado. El estado ocupado bloquea la interacción del gestor mientras se persiste.
6. Si el guardado rechaza, no se actualiza el `activityConfig` local ni aparece éxito; se muestra el error, se conserva abierto el gestor y se habilita reintento.

## Pruebas

En `components/DataEditor.test.tsx` se añadieron pruebas de origen con varias actividades y resolución, inmutabilidad de objeto/array/avance, estructura de los 53 destinos semanales, once destinos mensuales, avance cero solo en destinos, estado de resolución local, espera durante persistencia, éxito tras resolver, rechazo sin éxito y reintento, doble clic, lista de origen vacía sin persistencia y payload limitado al KPI actual.

`components/ActivityManager.test.tsx` mantiene y valida el flujo protegido del checklist H06, incluidos guardado pendiente, rechazo/reintento y lista vacía.

## Resultados

- Pruebas focalizadas `DataEditor` + `ActivityManager`: **2 suites, 25 pruebas PASS**.
- Conjunto mantenido sin sondas `tmp` ni `firestore.rules.test.ts`: **110 suites, 924 pruebas PASS**. Las sondas antiguas y Firestore Rules quedaron fuera de este microciclo según alcance.
- `npx tsc --noEmit --pretty false`: termina con deuda preexistente; **66 baseline / 66 actual / 0 nuevos / 0 removidos**, comparado como multiconjunto por archivo, código y mensaje.
- `npm run build`: **PASS**, 2048 módulos. Permanecen los avisos conocidos de chunks y Firebase imports.
- `git diff --check`: **PASS**, solo advertencias de conversión LF/CRLF ya presentes.
- Integridad: **0 cambios** entre los otros 469 archivos del inventario previo; tres archivos deliberadamente editados por H08: `DataEditor.tsx`, `DataEditor.test.tsx` y `ActivityManager.tsx`.
- Persistencia productiva / Firebase: no invocada; callbacks de pruebas simulados.

## Certificación H08

| Comprobación | Estado |
|---|---|
| `H08_SOURCE_PROGRESS_PRESERVED` | PASS |
| `H08_DESTINATION_STRUCTURE_CORRECT` | PASS |
| `H08_SOURCE_IMMUTABLE` | PASS |
| `H08_PENDING_NO_SUCCESS` | PASS |
| `H08_SUCCESS_AFTER_PERSIST` | PASS |
| `H08_FAILURE_NO_FAKE_SUCCESS` | PASS |
| `H08_NO_DUPLICATE_SUBMIT` | PASS |
| `H08_NO_OTHER_KPI_MUTATION` | PASS |
| `H06_FIX_PRESERVED` | PASS |
| `ACTIONPLAN_FIX_PRESERVED` | PASS |
| `H01_H02_FIXES_PRESERVED` | PASS |
| `H03_FIX_PRESERVED` | PASS |
| `H04_FIX_PRESERVED` | PASS |
| `H05_FIX_PRESERVED` | PASS |
| `H07_FIX_PRESERVED` | PASS |

**Estado: `H08_COPY_YEAR_CORREGIDO_VALIDADO`** (validación local, sin release).

**NO COMMIT · NO PUSH · NO DEPLOY · NO RELEASE · NO FIREBASE WRITE.**
