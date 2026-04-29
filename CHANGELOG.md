# Changelog - Stratexa Dashboard

## [8.7.2] CRITICAL SHIELD - CRUD NUCLEAR & AUTO-SCROLL - 2026-03-22
### v8.7.2 "CRITICAL SHIELD" - [2026-03-22]
*   **CRUD Nuclear:** Implementación de persistencia atómica para evitar pérdida de datos en indicadores con actividades.
*   **Auto-Scroll Inteligente:** Navegación automática a la semana actual en la vista anual (600ms delay).
*   **Blindaje de Rendimiento:** Implementación de `React.memo` en componentes críticos (`DataEditor`, `ActivityManager`, `DashboardRow`, `LineChart`, `Dashboard`).
*   **Blindaje Documental:** JSDoc completo en componentes core y creación de Suite de Pruebas Unitarias para lógica nuclear.
*   **UI Pureza Visual:** Eliminación de artefactos en degradados y sombras >75%.
*   **Seguridad:** Eliminación de versión en Login y sincronización forzada de builds.

## [8.6.6] PLATINUM - AI CONSISTENCY & UI POLISH - 2026-03-22
- **IA Predictiva Sincronizada**: El Analista Virtual ahora utiliza `calculateCompliance` del núcleo para garantizar coherencia total entre el tablero y el análisis IA.
- **Shadow Ghosting Fix**: Eliminación de `drop-shadow` en el badge de cumplimiento (70%) para evitar efectos de borrosidad.
- **Header Responsivo**: El encabezado de `ActivityManager` ahora usa `flex-wrap` y una estructura fluida para evitar encimamiento del botón cerrar (X) sobre el "Impacto Total".
- **Garantía de Aislamiento**: Refuerzo de la arquitectura de prefijos `tbl_` para asegurar cero interferencia con apps externas.

## [8.4.0] PLATINUM - SHIELD-V2.2 - 2026-03-22
- **Escudo DEEP SENTRY**: Sincronización PROFUNDA que protege ediciones de texto (no solo conteo).
- **FIX COLOR NEGRO**: Forzado de color de fuente para evitar el bug de visualización en input.
- **Edición en Vivo**: Conversión a MAYÚSCULAS en tiempo real mientras escribes.
- **Badge ID**: Indicador de versión interna en el gestor de actividades para soporte técnico.

## [8.3.0] PLATINUM - SHIELD-V2.1 - 2026-03-22
- **Edición de Títulos**: Ahora puedes hacer clic en el nombre de una actividad para editarlo (✏️).
- **CRUD FIX**: El botón "+ AÑADIR" ahora usa referencias directas para evitar fallos de lectura.
- **Detección de "Last Stand"**: Sincronización inteligente que previene la reaparición de elementos eliminados.
- **RECORDATORIO DE GUARDADO**: Alerta visual en el modal para no olvidar presionar "CONFIRMAR LISTA".

## [8.2.0] PLATINUM - SHIELD-V2 - 2026-03-22
- **AUDITORÍA INTEGRAL**: Realización de auditoría de persistencia solicitada.
- **VISIBILIDAD PÚBLICA**: Inyección de `versionLabel` en pantalla de Login para validación de despliegue.
- **SECURITY REINFORCE**: Refuerzo de comparaciones de `ID` en `handleUpdateItem` (Hybrid ID Engine Protection).
- **DEEP SYNC**: Asegurando que el refresco de Firestore no pise cambios locales en `activityConfig`.

## [8.1.0] PLATINUM - DEEP SHIELD - 2026-03-21
- **Deep Merge Strategy**: Implementation of field-level deep merging for `activityConfig` in real-time listeners.
- **Atomic Navigation**: Improved navigation persistence to prevent data loss upon refresh.

## [7.9.16] PLATINUM - NUCLEAR SHIELD (REACTIVE) - 2026-03-21
### Added
- **Nuclear Reactivity** in `ActivityManager`: Added `useEffect` to synchronize local list with external updates if the dashboard is modified via background sync.
- **Bulk Save Validation**: New visual feedback in the Bulk Add panel ("✅ ¡SE AÑADIERON X ELEMENTOS!") to confirm local absorption before the final save.
- **Enhanced Logging**: Diagnostic logs in `CurrentPeriodFocus` and `ActivityManager` to identify data drift during massive uploads.

## [7.9.15] PLATINUM - NUCLEAR SHIELD - 2026-03-21
### Stability & Persistence (CRITICAL FIX)
- **Sync Isolation**: Se implementó un escudo de aislamiento (`isSavingRef`) que ignora las actualizaciones de tiempo real de Firebase mientras el usuario está guardando sus propios cambios. Esto evita que el estado local sea sobrescrito por datos antiguos durante el proceso de guardado, eliminando la causa raíz de la "pérdida de datos".
- **Persistencia de Navegación**: Ahora la aplicación recuerda el Cliente, el Tablero y el Grupo seleccionado a través de `localStorage`. Al refrescar la página, el usuario regresa exactamente a donde estaba, mitigando el problema de "la pantalla se va hasta abajo" o vuelve al inicio.
- **Resiliencia de Sincronización en Focus**: Se optimizó el `useEffect` de `CurrentPeriodFocus` para que solo actualice los campos si hay cambios reales externos, protegiendo lo que el usuario está escribiendo en ese momento.
- **Atomic Save Logic**: Se reforzó el commit de Firebase para asegurar que los cambios de actividades y configuración se guarden de forma atómica y confirmada.

## [8.0.0] - 2026-03-21
### 🛡️ NUCLEAR ATOMIC SHIELD - RECONSTRUCCIÓN DE PERSISTENCIA
- **Navegación Persistente**: Ahora la aplicación recuerda el Cliente, el Año y el Dashboard seleccionado al refrescar. Esto soluciona la desorientación que sentía el usuario al reiniciar la sesión.
- **Escudo de Sincronización Extendido (8s)**: Se incrementó el tiempo de aislamiento de snapshots externos de 1s a 8s para absorber el "eco" de Firestore y evitar que actualizaciones antiguas pisen los cambios locales optimistas.
- **Alertas de Transacción**: Se añadió una alerta visual crítica si una operación de guardado falla en el servidor, permitiendo diagnosticar problemas de permisos en tiempo real.
- **Validación Atómica Continua**: Se mantiene el sistema de guardado por clave individual (`activityConfig.week`) para proteger la integridad de los datos históricos.

## [7.9.17] - 2026-03-21
### Fixes & Diagnostics
- **Inmutabilidad en shieldItem**: Se corrigió `shieldItem` para que no mute el objeto original de React, evitando problemas de sincronización en el estado.
- **Merge en Firestore**: Se activó `{ merge: true }` en `updateDashboardItems` para asegurar que ningún campo (como los prospectos/metas) se pierda si no se envía el objeto completo.
- **Logging de Diagnóstico Nuclear**: Se implementaron logs detallados en la consola (`SAVE`, `FIREBASE`, `SYNC`) para rastrear exactamente qué datos se envían a Firebase y qué datos regresan vía tiempo real. Esto permitirá identificar el punto exacto de pérdida de información.
- **Eliminación de Mutación de Referencia**: En `App.tsx`, ahora se crea una copia profunda (`JSON.parse(JSON.stringify)`) antes de blindar el item, asegurando que el estado de React permanezca puro.

## [7.9.12] - 2026-03-21
### Fixes & Diagnostics
- **Inmutabilidad en shieldItem**: Se corrigió `shieldItem` para que no mute el objeto original de React, evitando problemas de sincronización en el estado.
- **Merge en Firestore**: Se activó `{ merge: true }` en `updateDashboardItems` para asegurar que ningún campo (como los prospectos/metas) se pierda si no se envía el objeto completo.
- **Logging de Diagnóstico Nuclear**: Se implementaron logs detallados en la consola (`SAVE`, `FIREBASE`, `SYNC`) para rastrear exactamente qué datos se envían a Firebase y qué datos regresan vía tiempo real. Esto permitirá identificar el punto exacto de pérdida de información.
- **Eliminación de Mutación de Referencia**: En `App.tsx`, ahora se crea una copia profunda (`JSON.parse(JSON.stringify)`) antes de blindar el item, asegurando que el estado de React permanezca puro.


## [7.9.11] - 2026-03-21
### UX & Accessibility
- **Botón CONFIRMAR LISTA**: El botón del `ActivityManager` renombrado de "CERRAR Y GUARDAR" a "CONFIRMAR LISTA" para reflejar que solo confirma localmente.
- **Botón GUARDAR CAMBIOS reforzado**: El botón de guardado real en `DataEditor` fue agrandado con ícono 💾 y animaciones para clarificar el CTA de persistencia.
- **ARIA Labels**: Añadidos `aria-label` a inputs de metas, reales, notas y botones de actividades en `DataEditor.tsx`.
- **Labels vinculados**: Conectados `<label>` con `<input>` usando `htmlFor` para lectores de pantalla.

# Registro de Cambios y Versiones - STRATEXA COPARMEX

## Version 7.9.9 - ACTIVITY PERSIST
* **Fecha:** 20.03.2025
* **Descripción:** Corrección de Pérdida de Datos en Gestor de Metas (Sincronía de Estado y Mutaciones).
    * **React State Sync:** Se corrigió un "race condition" en `DataEditor` donde los datos calculados desde las actividades no se guardaban en la cuadrícula local antes de guardar a Firebase, resultando en metas y progresos enviados como ceros o nulos.
    * **State Mutation:** Se mitigó un error en `CurrentPeriodFocus` que mutaba objetos de React indirectamente (mutación por referencia), provocando que React evadiera el re-render y fallara el persist en Firebase.

## [7.8.28] - 2026-03-01
### Added
- **Stratexa UX-ELITE Architecture**: Rediseño radical del sistema de espacios para maximizar la densidad de información. 
  - Reducción del 50% en la altura del Header.
  - Compactación de Breadcrumbs y botones de acción (Audit IA, Exportar) para minimizar el scroll vertical.
  - Escalado inteligente de controles al 85% para liberar espacio visual crítico.
- **Mobile Fluidity Overhaul**: Eliminación de márgenes residuales en dispositivos móviles, permitiendo que el contenido del tablero comience inmediatamente después de un header ultra-compacto.

### Fixed
- **Test Integrity Mapping**: Sincronización de las pruebas unitarias con los nuevos labels de la UI ("Ficha" en lugar de "Configurar Área" y "Reporte" simplificado).
- **Vitest Legacy Cleanup**: Remoción de imports conflictivos de Vitest en favor de la suite Jest local.

## [7.8.27] - 2026-03-01
### Added
- **Elite-Platinum Hierarchy Architecture**: Implementación de una estructura jerárquica más robusta. Los niveles de consolidación ahora se dividen en "Resumen Directivo" (Nivel 3) y "Síntesis Global Operativa" (Nivel 4).
- **Smart Breadcrumb Engine**: Nuevo motor de migas de pan con desduplicación inteligente. Oculta niveles parentales si coinciden con el título del tablero consolidado para evitar redundancias visuales (ej: "DIR SUR > RESUMEN DIR SUR" ahora es solo "RESUMEN DIR SUR").
- **High-Profile Visibility Shield**: Los tableros de nivel "Dirección de Operaciones" (SuperGrupos) ahora solo son visibles para el Director de Operaciones y Administradores Globales, blindando el contexto estratégico.

### Fixed
- **Nesting Integrity**: Mejorada la posición de la síntesis global en el árbol lateral, situándola correctamente como el primer hijo de su directiva correspondiente.
- **Aggregate Context Naming**: Renombrados los tableros consolidados a "RESUMEN DIRECTIVO" para diferenciarlos visualmente de los tableros operativos de ejecución.

## [7.8.16-ULTRA-V15] - 2026-02-24
### Fixed
- **Aggregate Write Protection**: Implementado bloqueo inteligente en el `IndicatorManager` para evitar el guardado de datos en tableros virtuales (agregados). Ahora el sistema selecciona automáticamente un tablero real al intentar gestionar KPIs desde una vista consolidada.
- **Mnemonics Recovery**: Eliminados casteos forzados de IDs a números en el motor de Firebase, permitiendo que indicadores con IDs de texto (mnemónicos) se guarden y recuperen correctamente.

## [7.8.16-ULTRA-V14] - 2026-02-24
### Fixed
- **Indicator Manager Stability**: Implementado `useRef` para el seguimiento del tablero activo, evitando que los cambios locales se pierdan debido a re-renderizados del componente padre.
- **Hybrid ID Engine (v6.2.5)**: Motor de generación de IDs compatible con esquemas híbridos. Preserva IDs existentes (sean texto o número) y genera nuevos IDs numéricos seguros para indicadores nuevos.
- **Area Metadata Sync**: Corregido `handleUpdateMetadata` para utilizar la colección blindada `tbl_dashboards` y manejar correctamente la persistencia del campo `targetIndicatorCount`.

## [7.8.16] - 2026-02-23
### Fixed
- **Selective Expansion Fix**: Corregido comportamiento donde al seleccionar el tablero "GENERAL" se abrían grupos de directores superiores. La expansión ahora es estrictamente jerárquica y determinista.
- **Mobile Navigation Upgrade**: Incrementado el tamaño de los controles de navegación móvil (Touch Targets >44px) para cumplimiento con UX001. El botón 🌐 ahora vincula directamente al tablero general global.
- **Direct Global Access**: El tablero principal (General) ahora aparece como el primer nodo del árbol para facilitar el acceso rápido a la síntesis operativa.

## [7.8.15] - 2026-02-23
### Changed
- **Unified Navigation Core**: Se ha rediseñado la navegación para eliminar la redundancia. La sección "GENERAL" externa ha sido eliminada y sus tableros ahora se integran de forma natural en el árbol jerárquico principal.
- **Improved Dashboard Filtering**: Corregido comportamiento en las pestañas donde seleccionar el grupo "GENERAL" mostraba erróneamente una síntesis de todos los grupos. Ahora muestra exclusivamente los tableros del grupo seleccionado.

### Added
- **v7.8.7-PLATINUM-ULTRA-V4**: Nueva versión con blindaje de navegación simplificado.

## [7.8.6] - 2026-02-23
### Added
- **Persistent Navigation Shield**: Lógica de auto-expansión inteligente en el Sidebar. Al seleccionar un tablero, el sistema blinda el estado de los grupos (incluyendo "GENERAL") para evitar cierres molestos.
- **Adaptive Mobile Layout V3**: Mejora crítica en responsividad. En celulares, el sidebar se apila arriba y permite scroll horizontal de iconos cuando está colapsado (`UX001` compliant).
- **v7.8.6-PLATINUM-ULTRA-V3**: Nueva etiqueta de versión desplegada para trazabilidad total.

## [7.2.1] - 2026-02-16
### Added
- **Formula Pro v2**: Soporte para nombres de indicadores directamente en las fórmulas (ej: `bajas totales / altas`).
- UI Badge de seguridad: Confirmación visual de `MULTI-APP ISOLATION` en el footer.
- Placeholder dinámico en el gestor de indicadores para facilitar el uso de fórmulas.

### Fixed
- Actualización de documentación técnica (`README.md`, `MEMORIA_TECNICA_FINAL_2026.md`) a la versión actual.
- Sincronización de versiones en `package.json` y `App.tsx`.

## [7.1.0] - 2026-02-16
### Changed
- Refuerzo de `evaluateFormula` para manejar recursión de indicadores compuestos con mayor estabilidad.
- Mejora en la normalización de indicadores para el motor de sumas universales.

## [7.0.0] - 2026-02-16
### Added
- **PLATINUM SHIELD Architecture**: Implementación de aislamiento total de base de datos.
- Uso mandatorio del prefijo `tbl_` para todas las colecciones de Firestore.
- Hard lock en `firestore.rules` para impedir acceso cruzado entre aplicaciones (`tbl_`, `stx_`, `ips_`).

---
# Historial de Cambios Stratexa APP TABLERO

## [7.9.10] - 2026-03-21
### Fixes:
- **Pérdida de Configuración de Actividades**: Solucionado un problema en `DashboardRow.tsx` donde al guardar cambios desde la vista expandida (Grid), se descartaban propiedades clave como `activityConfig` e `isActivityMode`, provocando la pérdida de las metas y el estado de configuración al volver a consultar. El guardado ahora propaga todas las propiedades del DashboardItem sin omisiones.

*Historial de cambios mantenido por IA Antigravity.*
