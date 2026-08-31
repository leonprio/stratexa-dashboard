# Contrato de Configuración Estratégica

La configuración estratégica define relaciones, no desempeño.

- `StrategicObjective` es el objetivo estratégico visible en el mapa.
- `ContributionObjective` es opcional y puede vincularse a un objetivo estratégico mediante `primaryStrategicObjectiveId`.
- `LogicalKpi` representa un indicador de negocio único. Sus `physicalAliases` son las representaciones `dashboardId + itemId` equivalentes que existen en tableros operativos o derivados.
- `ownership` resuelve cada KPI lógico a un único objetivo estratégico. Un assignment `DIRECT` usa `strategicObjectiveId`; un assignment `CONTRIBUTION` llega al OE a través del OC.
- La exclusividad se aplica al KPI lógico completo: si un alias está asignado, todos sus aliases quedan ocupados. Un conflicto legacy entre OEs se detecta y no se resuelve silenciosamente.
- El mapa consume `ownership.kpisByStrategicObjective` y muestra una sola representación lógica por OE, manteniendo el layout horizontal.
- El selector muestra sólo KPI lógicos sin ownership; al guardar persiste el representante canónico y conserva compatibilidad con el esquema físico existente.
- `QUITAR` elimina assignments directos del OE actual para todos los aliases del KPI lógico y refresca ownership sin F5. Los KPI asignados mediante OC se administran desde el OC.

La futura **Vista por Objetivos** será una pantalla de lectura y análisis separada. No forma parte de este módulo ni debe introducir cálculos de KPI, YTD, severidad o desempeño en Configuración Estratégica.
