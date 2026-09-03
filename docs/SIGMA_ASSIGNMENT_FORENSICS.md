# Auditoría de asignaciones Sigma

Lectura autenticada mediante `strategyService.getAssignments('CEMENTOS_SIGMA')` y `firebaseService.getDashboards('CEMENTOS_SIGMA', 2026)`. HEAD: e405e56cb47babe23f5e091d9923433d307e5ff1. Sin escrituras durante la auditoría.

Todos los documentos de la tabla están bajo `tbl_contributionIndicatorAssignments/{documento}`. `—` significa campo ausente. Los nombres OE/OC corresponden a `seed_sigma_oeNN` / `seed_sigma_ocNN`.

| KPI (identidad lógica = `label:` + nombre normalizado sin acentos) | dashboardId / itemId operativo | Documento persistido | OE directo | OC | dashboardId / itemId persistido | Área |
|---|---|---|---|---|---|---|
| Ventas | 1769440535445 / 1 | asgn_oe_seed_sigma_oe02_1769440535445_1 | seed_sigma_oe02 | — | 1769440535445 / 1 | Comercial y Ventas |
| Margen de Contribución Neto | 1769440535445 / 2 | asgn_seed_sigma_oc01_1769440535445_2 | — | seed_sigma_oc01 | 1769440535445 / 2 | Comercial y Ventas |
| Tasa de Retención de Clientes | 1769440535445 / 3 | asgn_seed_sigma_oc02_1769440535445_3 | — | seed_sigma_oc02 | 1769440535445 / 3 | Comercial y Ventas |
| Cumplimiento de Entregas | 1769440535444 / 1 | asgn_oe_seed_sigma_oe03_1769440535444_1 | seed_sigma_oe03 | — | 1769440535444 / 1 | Logística y Transporte |
| Costo de Flete por Tonelada | 1769440535444 / 2 | asgn_oe_seed_sigma_oe01_1769440535444_2 | seed_sigma_oe01 | — | 1769440535444 / 2 | Logística y Transporte |
| Índice de Mermas en Tránsito | 1769440535444 / 3 | asgn_seed_sigma_oc04_agg-GENERAL-2026_-102 | — | seed_sigma_oc04 | agg-GENERAL-2026 / -102 | Referencia virtual; la UI actual la interpreta como Mermas |
| Rotación de Inventario | 1769440535446 / 1 | sigma_test_oc_operations | — | seed_sigma_oc05 | "1769440535446" / "1" | Operaciones y Almacén |
| Exactitud de Inventario | 1769440535446 / 2 | asgn_oe_seed_sigma_oe04_1769440535446_2 | seed_sigma_oe04 | — | 1769440535446 / 2 | Operaciones y Almacén |
| Días sin Accidentes Incidentes | 1769440535446 / 3 | asgn_oe_seed_sigma_oe05_1769440535446_3 | seed_sigma_oe05 | — | 1769440535446 / 3 | Operaciones y Almacén |

## Tres fuentes antes

UI refrescada de Contribución: Margen, Retención, Mermas, Rotación (4). La referencia de Mermas no resuelve contra el catálogo físico. Proyección usando únicamente catálogo persistido: Objetivos = 8; Contribución = 3. Cinco documentos DIRECT y cuatro documentos OC; uno de los cuatro OC es virtual. No hay duplicados físicos persistidos. La UI con alias agregados puede mostrar nueve en Objetivos y cuatro en Contribución; se debe distinguir esa presentación de las ocho identidades físicas efectivamente enlazadas.

## Semántica anterior y causa

`saveAssignmentsForOC` reemplaza todas las asignaciones del OC. Usa IDs `asgn_${ocId}_${dashboardId}_${itemId}`, deduplica solo pares físicos, rechaza una asignación directa existente y espera `batch.commit()`; no lee el resultado. El formulario elige el primer alias de un área sin excluir agregados y guarda su par, en vez del par operativo canónico. También oculta cualquier propietario distinto del OC, incluidos DIRECT del mismo OE. Exactitud desaparece por este último filtro. Los agregados heredan un área de un tablero y pueden ofrecer KPI de otras áreas bajo esa área.

La operación anterior retiró DIRECT mediante otra pantalla antes de crear OC, con refetch entre pasos. No existe `removeDirectStrategicLogicalKpiAssignment` en el árbol actual. No se ha probado una carrera concurrente real: sí existen ventanas no atómicas y riesgo de reemplazar una selección completa desde un formulario desactualizado. Los IDs virtuales negativos se asignan secuencialmente al reconstruir agregados y no son identidades persistibles.

## Restricción de alcance

La autorización actual permite cinco conversiones y exige preservar las cuatro membresías OC existentes. La corrección del documento virtual de Mermas requiere autorización adicional; no se puede certificar igualdad de nueve identidades operativas manteniendo esa referencia virtual.

## Comprobación final de esta fase (sin escrituras)

1. HEAD: `e405e56cb47babe23f5e091d9923433d307e5ff1`; rama `feature/transversal-action-plans`. Trabajo previo preservado.
2. Tabla BEFORE: arriba; los documentos no se modificaron.
3. A, POR OBJETIVOS tras refrescar: Ventas, Margen de Contribución Neto, Tasa de Retención de Clientes, Cumplimiento de Entregas, Costo de Flete por Tonelada, Índice de Mermas en Tránsito, Rotación de Inventario, Exactitud de Inventario, Días sin Accidentes Incidentes. Nueve observados en el navegador.
4. B, CONTRIBUCIÓN tras refrescar: Margen, Retención, Mermas, Rotación. Cuatro observados.
5. C: cinco DIRECT, tres OC operativos y un OC virtual. A menos B: Ventas, Cumplimiento, Flete, Exactitud, Días sin Accidentes. B menos A: vacío. PersistedOnly: cero identidades físicas; queda una referencia virtual sin resolución física. DuplicateLogicalKpi: cero observados en las vistas; no se atribuye identidad estable al documento virtual.
6. Guardado anterior: reemplazo completo del OC, IDs deterministas, deduplicación física, DIRECT rechazado, commit esperado sin lectura posterior.
7. La función de retirada solicitada no existe en el árbol actual. La conversión mediante pantallas separadas exigía retirar DIRECT antes de guardar OC; entre pasos se refrescaba información. No era atómica.
8. Riesgo de estado obsoleto: SÍ. Carrera concurrente ocurrida: NO demostrada. El defecto confirmado es selección/persistencia de un alias virtual y exclusión de DIRECT.
9. Exactitud, al igual que los otros cuatro DIRECT, quedaba fuera por no pertenecer ya al OC editado. El filtro tampoco admitía DIRECT del mismo OE.
10. Corrección genérica local: catálogo operativo por cliente/área, rechazo de alias virtuales, validación física de cliente/año/área/OE, captura de membresías al abrir, validación de selección previa a escribir, sin reescritura de definición OC si no cambia.
11. Nueva conversión: transacción que crea OC y retira DIRECT atómicamente; preserva documentos OC sin cambios; lee después del commit y no muestra éxito si la verificación falla. Idempotencia comprobada. Detecta cambios en documentos observados y colisiones del destino; no constituye un bloqueo global de inserciones nuevas de otros escritores fuera de esta operación.
12. Ventas: prueba automatizada PASS; conversión real NOT_RUN.
13. Cumplimiento: prueba automatizada PASS; conversión real NOT_RUN.
14. Flete: prueba automatizada PASS; conversión real NOT_RUN. Su OC contiene el documento virtual protegido de Mermas; el formulario falla de forma segura mientras permanezca sin resolver.
15. Exactitud: prueba automatizada PASS; conversión real NOT_RUN.
16. Días sin Accidentes: prueba automatizada PASS; conversión real NOT_RUN.
17. OCCOMV01 actual: Margen de Contribución Neto.
18. OCCOMV02 actual: Tasa de Retención de Clientes.
19. OCLOGT01 actual: vacío.
20. OCLOGT02 actual: Índice de Mermas en Tránsito (referencia virtual).
21. OCOPAL01 actual: Rotación de Inventario.
22. OCOPAL02 actual: vacío.
23. Representados: 4 de 9; solo 3 OC enlazados a identidad operativa persistida.
24. Duplicados visibles: 0.
25. Faltantes visibles: 5; OC vacíos: 2.
26. ObjectivesOnly: 5.
27. ContributionOnly: 0. Rutas actuales DIRECT que deben cambiar: Ventas OE02→OE01; Cumplimiento OE03→OE02; Flete OE01→OE03. Exactitud OE04 y Días OE05 conservan OE al pasar a OC.
28. Navegación real de cinco reparados: NOT_RUN, no hay reparaciones persistidas. Regresiones unitarias de navegación: PASS. No se certifica navegación final ni igualdad final.
29. Escrituras operativas: 0.
30. Escrituras estratégicas: 0; ningún documento creado, cambiado ni eliminado en esta fase.
31. Pruebas: 14 suites, 80 pruebas PASS entre las dos ejecuciones. Incluye StrategyConfigModal, servicio/transacción simulada, cinco conversiones, fallo de commit, idempotencia, estado obsoleto, catálogo, paridad, Objetivos, navegación, planes y contexto de cliente. La cobertura de áreas es de filtrado/catálogo; no se hizo una validación visual completa de POR ÁREAS. Advertencia previa de React act() en ObjectivesView.
32. Build: PASS, con advertencias de eval, imports Firebase y tamaño de bundle.
33. TypeScript: FAIL por errores baseline en fixtures Activity/AggregateBuilder/CurrentPeriodFocus/contributionParity, compliance, exportación Excel y alertas/historial. Sin errores nuevos en la corrección comprobada.
34. Diff-check: PASS (advertencias de conversión LF/CRLF, no errores).
35. Localhost 3002: aplicación accesible; comprobación HTTP consignada en respuesta final.
36. Commit: NONE.
37. Clasificación: BLOCKED_ADDITIONAL_MERMAS_CANONICALIZATION_AUTHORIZATION_REQUIRED. No se cumple el hard gate final.
38. NO PUSH / NO MERGE / NO TAG / NO DEPLOY.

Para continuar hasta el objetivo completo hace falta autorizar también sustituir `asgn_seed_sigma_oc04_agg-GENERAL-2026_-102` por una membresía OCLOGT02 contra `1769440535444 / 3`, preservando el mismo KPI, OC y OE. Es una sexta reparación estratégica, no una modificación de valores operativos. No se ha realizado.
