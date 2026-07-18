# Stratexa Dashboard - Historial de Cambios Maestro (CHANGELOG MASTER)
## Estado de Gobernanza: GOLD MASTER FREEZE
## Versión de Referencia: v9.4.3-STABLE-AI-FORENSIC-HARDENING

Este documento constituye el registro inalterable de versiones, matriz de riesgos, notas de rollback y manifiestos asociados de la plataforma **Stratexa Dashboard IPS**. Bajo la política de Control de Cambios activa, cualquier modificación futura de este baseline está estrictamente regulada por la [Política de Gobernanza de Publicaciones](file:///c:/Users/LeonPrior/OneDrive%20-%20Prior%20Consultor%C3%ADa/Documentos/CONSULTOR%C3%8DAS%202025/IPS/IA/APP%20TABLERO/release_governance_policy.md).

---

### 1. Control de Versiones y Baseline Histórico

#### 🚀 v9.4.3-STABLE-AI-FORENSIC-HARDENING — 2026-05-22 [VERSIÓN ACTUAL CONGELADA]
* **Auditoría Forense del Módulo IA:** Endurecimiento del motor de lenguaje natural local (`services/aiService.ts`) bajo la especificación estricta de parámetros (`temperature: 0.15` en configuración, determinismo nuclear).
* **Consistencia Semántica de Minimización:** Corrección del error en la evaluación de excesos de límites. La IA ahora se sincroniza al 100% con los semáforos oficiales (`OnTrack`, `AtRisk`, `OffTrack`) de `utils/compliance.ts`.
* **Aislamiento de Scope (Scope Isolation):** Implementación de resolución recursiva de compuestos y fórmulas en el contexto para asegurar que la IA no reciba datos externos no autorizados.
* **Trazabilidad y Explicabilidad (Explainability):** Cada conclusión mapea con exactitud al KPI origen, valor real, meta/límite, semáforo oficial y regla aplicada.
* **Control de Alucinaciones (No Human Inference):** Prohibido inferir causas organizacionales o de liderazgo humano sin notas textuales explícitas en el periodo. Wording clínico y sobrio.

#### 📦 v9.4.2-STABLE-EXECUTIVE-EXPORT — 2026-05-22 [VERSIÓN BASELINE ANTERIOR]
* **Exportador Operativo Ejecutivo:** Implementación de un motor independiente de exportación de reporte operativo XLSX corporativo (human-friendly).
* **Formatos y Estilos:** Incorporación de 4 hojas pulidas (Resumen Ejecutivo, KPIs, Alertas y Tendencia Histórica) estructuradas con ExcelJS, alineadas y preparadas para impresión.
* **Seguridad de Scope:** Filtrado físico estricto de accesos según el rol de usuario para directores, responsables de área y administradores.
* **Gobernanza Física:** Actualización de toda la metadata del Gold Master, manifiestos y políticas.

#### 📦 v9.4.1-STABLE-QA-HARDENING — 2026-05-22
* **Gobernanza de Cambios:** Activación del modo Change Control. Congelación del core funcional del tablero de control hospitalario.
* **Manifiesto de Arquitectura:** Creación y firma del archivo `baseline_architecture_manifest.json` con los hashes e inventarios del sistema.
* **Flujos de Salvaguarda:** Pruebas y validación del triple auto-backup (JSON, XLSX y Manifest) previo a importaciones quirúrgicas.
* **Garantía UX001:** Verificación responsiva en los 4 dispositivos mandatorios.

#### 📦 v9.4.0-STABLE-RECOVERY-FORENSIC — 2026-04-15
* **Motor de Recuperación Local:** Implementación de un motor de recuperación basado en XLSX real (con soporte multihoja y estilos) y snapshots JSON locales.
* **Visualización de Diffs Celulares:** Sandbox interactivo que detecta diferencias a nivel de celda (celda anterior vs nueva, KPI afectado, dashboard) en color ámbar de advertencia antes de ejecutar el commit.
* **Importación Quirúrgica:** Restricción de importación basada estrictamente en IDs inmutables de dashboards y KPIs. Prohibida la carga por nombres de elementos.
* **Doble Lock e Integridad:** Bloqueo de importaciones concurrentes mediante un mutex lógico para prevenir corrupción del estado del hospital.

#### 🛡️ v8.7.2 - CRITICAL SHIELD — 2026-03-22
* **CRUD Nuclear:** Persistencia atómica de indicadores con actividades asociadas.
* **Auto-Scroll Inteligente:** Navegación automática a la semana actual en la vista anual (600ms delay).
* **Blindaje de Rendimiento:** Implementación de `React.memo` en componentes del núcleo (`DataEditor`, `ActivityManager`, `DashboardRow`, `LineChart`, `Dashboard`).

---

### 2. Matriz de Control de Riesgos Operativos

| Componente Crítico | Riesgo Identificado | Mecanismo de Mitigación en Gold Master |
| :--- | :--- | :--- |
| **Integridad del Dataset** | Modificación o borrado accidental de KPIs históricos por nombres duplicados. | Exigencia mandatoria de correspondencia por **IDs Inmutables** (`dashboardId`, `kpiId`). No se acepta importación por campos textuales. |
| **Concurrencia de Datos** | Doble importación simultánea de planillas XLSX que corrompa Firestore. | **Mutex lógico de importación única** que bloquea la interfaz de carga mientras se procesa un pipeline activo. |
| **Estabilidad Funcional** | Alteración colateral del Real Operational Score durante cambios de UI. | **Core Isolation Policy**: Los motores de semáforos, alertas e histórico están congelados físicamente. |
| **Pantallas de Recuperación** | Pérdida de backups por caídas del sistema o problemas en la nube. | Generación y **descarga forzada local** de un triple backup físico (JSON + XLSX + Manifest) auto-generado por el cliente en cada importación. |

---

### 3. Gobernanza de Rollback (Plan de Contingencia / Recovery Drill)

En caso de detectarse corrupción en la carga de indicadores, inconsistencias de semáforos o desvíos numéricos tras una actualización, se debe aplicar el protocolo de rollback rápido documentado a continuación:

#### Protocolo de Restauración Paso a Paso (Recovery Drill)

1. **Localizar el Resguardo Físico:**
   * Ubicar el archivo ZIP o los archivos individuales descargados automáticamente durante la última importación estable exitosa:
     - `Stratexa_Baseline_[Timestamp]_[Checksum].json`
     - `Stratexa_Recovery_[Timestamp].xlsx`
     - `Stratexa_Manifest_[Timestamp].json`

2. **Acceder con Credenciales Administrativas:**
   * Iniciar sesión en la plataforma como usuario con rol de `admin` o `superadmin`. Las opciones de restauración en la sección `IMPORTS` y la pestaña de configuración avanzada están deshabilitadas para otros perfiles.

3. **Cargar en el Sandbox de Validación:**
   * Arrastrar el archivo de resguardo XLSX al componente `ControlledImporter`. El sistema iniciará un Dry Run inmediato.
   * El Sandbox analizará los cambios celda por celda contra el estado actual de Firestore.
   * Verificar en la vista de diferencias (Cell-Level Diff) que los valores que regresarán al sistema coincidan exactamente con la firma del baseline anterior.

4. **Confirmar Aplicación de Rollback:**
   * Activar el control de doble validación en la interfaz de éxito del importador.
   * Escribir el comando exacto de confirmación en pantalla si el sistema lo solicita en el bloque de operaciones críticas.
   * El pipeline ejecutará un batch chunking atómico (máximo 500 escrituras por lote) de forma segura en Firestore para evitar límites de cuota, restableciendo los valores en pocos segundos.

5. **Verificación Post-Rollback:**
   * Validar que la etiqueta en el pie de página muestre con total integridad la versión estable `v9.4.1-STABLE-QA-HARDENING`.
   * Verificar en el panel principal que el Real Operational Score y los semáforos de cumplimiento hayan vuelto a sus rangos originales estables sin scroll horizontal o desajustes responsivos.

---

### 4. Manifiestos y Checksums Asociados

La firma digital y estructura física del GOLD MASTER queda registrada en la raíz del proyecto a través de:
* **Manifiesto Oficial:** [`baseline_architecture_manifest.json`](file:///c:/Users/LeonPrior/OneDrive%20-%20Prior%20Consultor%C3%ADa/Documentos/CONSULTOR%C3%8DAS%202025/IPS/IA/APP%20TABLERO/baseline_architecture_manifest.json)
* **Checklist de Seguridad:** [`safe_deploy_checklist.md`](file:///c:/Users/LeonPrior/OneDrive%20-%20Prior%20Consultor%C3%ADa/Documentos/CONSULTOR%C3%8DAS%202025/IPS/IA/APP%20TABLERO/safe_deploy_checklist.md)
* **Política de Publicación:** [`release_governance_policy.md`](file:///c:/Users/LeonPrior/OneDrive%20-%20Prior%20Consultor%C3%ADa/Documentos/CONSULTOR%C3%8DAS%202025/IPS/IA/APP%20TABLERO/release_governance_policy.md)

*Historial de Cambios Maestro mantenido bajo control de cambios estricto por IA Antigravity.*
