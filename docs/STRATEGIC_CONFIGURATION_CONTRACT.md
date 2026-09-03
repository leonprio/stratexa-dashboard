# Contrato de Configuración Estratégica

La configuración estratégica define relaciones, no desempeño.

- `StrategicObjective` es el objetivo estratégico visible en el mapa.
- `ContributionObjective` es opcional y puede vincularse a un objetivo estratégico mediante `primaryStrategicObjectiveId`.
- `LogicalKpi` representa un indicador de negocio único. Sus `physicalAliases` son las representaciones `dashboardId + itemId` equivalentes que existen en tableros operativos o derivados.
- `ownership` resuelve cada KPI lógico a un único objetivo estratégico. Un assignment `DIRECT` usa `strategicObjectiveId`; un assignment `CONTRIBUTION` llega al OE a través del OC.
- Los selectores de alineación renderizados DEBEN consumir ownership client-wide antes de aplicar el scope de candidatos por área; un KPI ocupado vía cualquier OE/OC nunca es `AVAILABLE` en otro destino.
- La exclusividad se aplica al KPI lógico completo: si un alias está asignado, todos sus aliases quedan ocupados. Un conflicto legacy entre OEs se detecta y no se resuelve silenciosamente.
- El mapa consume `ownership.kpisByStrategicObjective` y muestra una sola representación lógica por OE, manteniendo el layout horizontal.
- Un `LogicalKpi` sólo puede tener un destino estratégico activo; sus `physicalAliases` no representan disponibilidades independientes.
- El selector muestra sólo KPI lógicos sin ownership; al guardar conserva la identidad física seleccionada y valida todos sus aliases contra el ownership persistido actual.
- `QUITAR` elimina assignments directos del OE actual para todos los aliases del KPI lógico y refresca ownership sin F5. Los KPI asignados mediante OC se administran desde el OC.

La futura **Vista por Objetivos** es un consumer de la misma estructura: usa `ownership.kpisByStrategicObjective`, conserva el orden configurado de perspectivas y OE (con inversión sólo de UI) y no reconstruye relaciones por alias físico.

No debe introducir cálculos de KPI, YTD, severidad o desempeño en Configuración Estratégica.

La Vista por Objetivos es una superficie ejecutiva compacta: condición, diagnóstico, KPI, ejecución y decisión. La decisión se deriva de reglas deterministas visibles (AI_USED = NO). El progreso de actividades es independiente del impacto: el primero expresa avance de ejecución y el segundo resultado/efecto observado.

La lectura estratégica sólo usa dashboards ya autorizados para el usuario. Puede mostrar el contexto mínimo del OE, pero KPI, OC y planes permanecen sujetos a tenant y área; los aliases físicos nunca amplían permisos.
