# CEMENTOS SIGMA — escenario estratégico 2026

Escenario reversible y explícito para validar la separación temporal entre operación y estrategia.

## Alcance certificado

- Cliente: `CEMENTOS_SIGMA` (document ID canónico).
- Fuente operativa: 3 dashboards y 9 KPI de 2025; permanecen sin escrituras.
- Destino operativo: 3 dashboards y 9 KPI de 2026, con series deterministas enero–agosto y meses posteriores vacíos.
- Calidad intencional: `DÍAS SIN ACCIDENTES INCIDENTES` omite marzo y junio.
- Estrategia reemplazada: 4 OE legacy y 9 asignaciones legacy a `agg-GENERAL-2025`; se conservaron backups locales.
- Resultado final: 4 perspectivas, 5 OE, 6 OC, 0 asignaciones KPI y 0 relaciones causa–efecto.

## Estructura

Perspectivas: Resultados / Financiera, Cliente / Mercado, Procesos internos y Capacidad organizacional.

OEs: `OE01` crecimiento rentable; `OE02` retención y promesa de servicio; `OE03` confiabilidad logística; `OE04` inventarios; `OE05` operación segura.

OCs: `OCOMV01`, `OCOMV02`, `OCLOGT01`, `OCLOGT02`, `OCOPAL01`, `OCOPAL02`, vinculados por `primaryStrategicObjectiveId` y áreas `COMV`, `LOGT`, `OPAL`.

Dashboards 2026: `1769440535444` Logística y Transporte, `1769440535445` Comercial y Ventas, `1769440535446` Operaciones y Almacén. Cada uno conserva la definición del KPI 2025, pero usa datos 2026 simulados; `area` queda explícita para el selector.

Perfiles de razón de cumplimiento (enero–agosto): ventas `[80,84,88,91,94,97,100,102]`, margen `[85,88,90,93,95,97,98,100]`, retención `[100,98,96,94,92,90,88,86]`, entregas `[95,90,85,80,75,70,67,63]`, mermas `[60,66,71,76,81,86,91,96]`, rotación `[100,95,90,85,80,75,70,65]`, exactitud `[88,90,92,94,96,98,100,101]`, flete `[78,82,85,89,93,96,99,102]`, días `[100,100,—,100,100,—,100,100]`.

## Integridad y operación

El seed escribe sólo Sigma y requiere `--execute`; por defecto es dry-run. La fuente temporal 2025 se captura antes y después y se compara por payload. No se escriben meta, real, YTD, ActionPlan, pendientes ni reprogramaciones de 2025. No hay secretos en este documento.

Backups generados: `docs/backups/CEMENTOS_SIGMA_STRATEGY_LEGACY_*.json` y `docs/backups/CEMENTOS_SIGMA_2025_OPERATIONAL_SNAPSHOT_*.json`.

La capa estratégica queda sin KPI alineados deliberadamente: el mapa no muestra KPI y los nueve KPI quedan disponibles para el flujo de asignación posterior. La futura Vista por Objetivos debe consumir las mismas relaciones y no recalcular desempeño.
