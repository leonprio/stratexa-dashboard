# Contrato transversal: operación y estrategia

La estrategia agrupa KPIs con `LogicalKpi` y aliases físicos para lectura y alineación. No reemplaza las identidades operativas.

## Lectura ejecutiva

La condición visible de cada KPI reutiliza `calculateCompliance`; no existe un score alterno en Objetivos. La tendencia compara exclusivamente los dos últimos periodos evaluables de la serie mensual de cumplimiento (`real` contra `meta`) resuelta por `resolveItemValues`. Periodos futuros, faltantes y `0/0` se excluyen: con menos de dos puntos se informa `SIN TENDENCIA` y no se dibuja una línea. El LogicalKpi usa su representante operativo canónico para lectura y navegación.

- Un `DashboardItem` conserva KPI, meta, real y YTD.
- Las KPI Activities son obligaciones históricas por periodo; resolver o reprogramar no duplica su entidad ni reescribe el incumplimiento anterior. La reprogramación mantiene una sola actividad física y su `rescheduleHistory`.
- `ActionPlan` es transversal e independiente del periodo. Sus `activities[]` no son KPI Activities; crear, quitar o mover un plan no cambia KPI/YTD ni alineaciones estratégicas.
- Quitar un StrategicAssignment no elimina ActionPlans, y eliminar un ActionPlan no altera StrategicAssignments.
- Un LogicalKpi con aliases no crea copias de ActionPlan ni de KPI Activities.
- CONTROL conserva sus contratos de planes, vencimientos y pendientes; este límite no autoriza cambios de severidad, confianza, aging o rankings.

El orden estratégico de presentación es una capa no persistente: perspectiva configurada, después OE configurado, después orden operativo estable del KPI. Los KPI no alineados quedan al final. IDs, historial y orden operativo almacenado no cambian; CONTROL conserva su orden por excepción.

La navegación profunda desde Objetivos usa exclusivamente `dashboardId + itemId`, abre el representante operativo autorizado y mantiene cliente/año/período. Los conteos de planes provienen de ActionPlan transversal y se deduplican por `ActionPlan.id`; pendientes no consolidados se muestran como neutrales. Impacto mide efecto (`NOT_EVALUATED`, `FAVORABLE`, `PARTIAL`, `LOW_OR_NONE`) y permanece independiente del avance y de KPI/YTD.
