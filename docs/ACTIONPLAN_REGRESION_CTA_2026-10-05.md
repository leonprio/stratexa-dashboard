# Regresión del CTA de creación de ActionPlan

Fecha: 2026-10-05. Alcance: diagnóstico y corrección local, sin publicar.

## Causa raíz e historia

El commit `7589e453ae8a0397c57e74bf108d55f0fd03c0b0` (`feat(action-plans): enforce scoped plan editing`, 2026-09-22) introdujo dos restricciones de presentación en `components/RelatedActionPlans.tsx`:

- Sección contraída: `canEdit && state === "saved" && plans.length === 0`. Ocultaba «+ Nuevo plan» cuando ya había planes. Quedaba «VER PLANES», que permitía acceder indirectamente al CTA expandido.
- Sección expandida: la cabecera que contiene el CTA dependía de `state === "saved" && plans.length > 0`. Sin planes, no había CTA; también desaparecía tras eliminar el último plan.

En el padre del commit (`7bc549a`) la cabecera no dependía del número de planes y el CTA dependía de `canEdit`. Esa es la última versión inmediatamente anterior donde el comportamiento anterior está demostrado por código.

El commit introdujo intencionalmente una vista contraída y autorización específica de planes. No existe evidencia de que se quisiera impedir crear el primer plan en una sección expandida o hacer depender el acceso directo de la cantidad de planes: esa pérdida se considera un efecto de las condiciones de presentación, no una prueba de intención del autor.

La retirada del CTA de `components/ActionPlan.tsx` fue anterior y explícita: `0ca22f8d5cdd58593c4badd166b6526db4db049f` (`Unify action plan creation with legacy history viewer`, 2026-08-29). Este componente conserva `paiRows` como histórico de solo lectura; no es el formulario de entidades ActionPlan.

## Reconstrucción funcional

1. Vista: tablero físico, seleccionar un KPI para abrir su ficha de periodo.
2. `DashboardView` monta `CurrentPeriodFocus` y pasa `dashboardId`, `clientId`, el KPI y el año.
3. `CurrentPeriodFocus` monta `RelatedActionPlans` cuando `dashboardId !== undefined`. Usa una clave cliente/tablero/KPI y pasa `collapsed={!plansFocused}`.
4. `canEditPlans` procede de `!isAggregate && canEditActionPlan(currentUser, dashboard)`. Se requiere membresía activa del cliente: administrador del cliente, o capacidad canónica `plan_editor` con tablero editable. SuperAdmin sin membresía del cliente no obtiene edición. Estas restricciones permanecen vigentes y no se consideran la regresión de presentación.
5. El CTA ejecuta `begin()`; contraído, primero invoca `onToggle` para abrir la sección. El formulario es inline, no un modal. `begin` establece modo edición, abre ajustes y construye un borrador con `emptyPlan`.
6. El borrador conserva `indicatorId=item.id`, `dashboardId`, `clientId` normalizado, año, frecuencia mensual/semanal e índice de periodo seleccionado. Estado inicial: `planned`, avance 0, actividades vacías.
7. «Guardar plan» ejecuta `save`, exige título, calcula estado/avance y llama `firebaseService.createActionPlan` si el id está vacío. El botón se deshabilita mientras guarda.
8. El servicio valida autorización y existencia del KPI en el tablero físico; genera UUID/fechas y escribe con `setDoc` en `tbl_actionPlans/{id}`. Luego la interfaz vuelve a consultar los planes y los muestra en «Planes relacionados».
9. La lista filtra por cliente, tablero e indicador, y deduplica por id. Los planes son transversales al periodo: el origen se conserva, no restringe su visibilidad a ese mes/semana.
10. `TransversalActionPlansControl` consulta por los KPIs de los tableros fuente, filtra el mismo ámbito físico, deduplica, calcula ejecución y continuidad, y navega al plan/KPI con cliente, tablero e indicador explícitos.

No se encontró una feature flag, regla CSS de ocultación ni callback perdido en el CTA. El montaje y formulario están presentes. `DataEditor` no es la ruta de creación de ActionPlan. Los refactors posteriores consultados mantienen las condiciones responsables. No se ha demostrado un fallo de creación/persistencia ni de identidad dentro del alcance probado.

## Impacto y corrección mínima

Impacto demostrado: acceso directo oculto a usuarios autorizados con planes existentes en la ficha contraída; creación inaccesible en sección expandida sin planes. La creación del primer plan desde la ficha contraída seguía disponible. Lectores, agregados y SuperAdmin sin ámbito siguen sin permiso de edición por diseño.

Único archivo de producción modificado: `components/RelatedActionPlans.tsx`.

- Retirar `plans.length === 0` del CTA contraído.
- Retirar `plans.length > 0` de la cabecera expandida.
- Añadir separación y ajuste de línea al contenedor de los dos botones contraídos.

## Brecha y pruebas

Las pruebas anteriores comprobaban la ausencia de CTAs legados, lectura/edición/eliminación de planes existentes y CTA con cero planes contraídos. Una prueba de borrador contraído no expandía el padre ni comprobaba que el formulario fuera visible. Faltaba la matriz contraído/expandido × cero/un plan y el ciclo completo crear/guardar/listar.

Nuevo archivo: `components/RelatedActionPlans.creation.test.tsx` (8 casos). Comprueba visibilidad, apertura del formulario, creación única durante guardado pendiente, recarga y aparición sin duplicados, conservación de planes anteriores, lectura sin CTA y periodos mensual/semanal mediante el padre real `CurrentPeriodFocus`.

Cobertura añadida en `services/actionPlanResultReviewPersistence.test.ts` (4 casos): creación con UUID/fechas y escritura única, cliente no autorizado, tablero no autorizado e indicador inexistente. Ejecuta el servicio real con Firestore simulado; no escribe datos de usuarios.

Antes del fix la ejecución nueva demostró ausencia del CTA en contraído con un plan y expandido sin planes. Después del fix pasan los ocho casos de interfaz y las pruebas del servicio.

## Validación final

- Jest focalizado: **PASS**, 14 suites / 151 pruebas. Incluye ActionPlan, RelatedActionPlans, CurrentPeriodFocus, DashboardView, revisión de resultados, persistencia, autorización, dominio y CONTROL.
- Reejecución tras completar `weight` del fixture nuevo: **PASS**, 2 suites / 30 pruebas.
- `npx tsc --noEmit`: **FAIL**, 76 errores en archivos no modificados. Ningún diagnóstico en los tres archivos de código/pruebas modificados. El log completo está en `tmp/actionplan-tsc.log` (ignorado por Git). No se amplió el fix para corregir errores ajenos al incidente.
- `npm run build`: **PASS**. Advertencias sobre imports mixtos y tamaño de chunks.
- `git diff --check`: **PASS**.
- Validación visual local: **NOT_TESTABLE**. Dos intentos de iniciar la herramienta de navegador fallaron con `trusted Node process exited unexpectedly`. La visibilidad y apertura se verificaron en DOM mediante Testing Library; no se certifica recorrido en navegador autenticado.
- Persistencia en Firebase real y reglas desplegadas: **NOT_TESTABLE** en esta ejecución. Las pruebas de persistencia usan Firestore simulado.
- Dependencias locales restauradas con `npm ci --no-audit --no-fund`. Lockfile sin cambios.

## Certificaciones

Resultados PASS limitados a las pruebas automatizadas descritas, con persistencia simulada; no equivalen a una prueba en producción.

| Certificación | Resultado | Evidencia |
| --- | --- | --- |
| CTA_CREAR_PLAN_VISIBLE | PASS | Matriz de 4 estados + padre real |
| CREACION_ACTIONPLAN_FUNCIONAL | PASS | Abrir, rellenar, guardar; servicio real con Firestore simulado |
| PLAN_PERSISTE | PASS | `setDoc` guarda y retorna identidad/fechas; Firestore simulado |
| PLAN_APARECE_EN_RELACIONADOS | PASS | Recarga y listado tras creación |
| SIN_DUPLICACION | PASS | Botón deshabilitado durante guardado y lista deduplicada |
| SIN_REGRESION_DE_PERIODO | PASS | Mes 9, semana 39, año y origen anterior conservados |
| AISLAMIENTO_CLIENTE_OK | PASS | Filtrado de cliente/tablero y denegación de creación fuera de ámbito |

Estado: **BLOCKER_ACTIONPLAN_CORREGIDO_VALIDADO**, dentro del alcance automatizado. TypeScript global sigue fallando y la validación visual/Firebase real queda sin comprobar.

**NO PUSH. NO DEPLOY. NO RELEASE.**
