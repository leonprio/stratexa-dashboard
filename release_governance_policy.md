# Stratexa Dashboard - Política Oficial de Gobernanza de Publicaciones (Release Governance)
## Versión: v9.4.3-STABLE-AI-FORENSIC-HARDENING (GOLD MASTER)

Esta política regula de forma restrictiva la planeación, validación y ejecución de cualquier cambio estructural, estético o funcional en el sistema de gestión hospitalaria de Stratexa.

---

### 1. Clasificación de Cambios Permitidos

- **NIVEL A - MANTENIMIENTO OPERATIVO (Bajo Riesgo):**
  - Modificación de terminología personalizada de tableros.
  - Reordenamiento o renumeración manual de dashboards.
  - Corrección de comentarios o documentación de código.
  - *Gobernanza:* Requiere compilación estática exitosa en el cliente.
  
- **NIVEL B - PARÁMETROS Y LÓGICA INTERNA (Medio Riesgo):**
  - Ajustes en ponderaciones de PAI (Promedio de Avance de Indicadores) o pesos de tableros.
  - Modificación de rangos en los semáforos de semaforización.
  - Corrección de consultas locales y procesamiento de anomalías.
  - *Gobernanza:* Exige pruebas cruzadas de Dry Run en Sandbox y validación de no regresión sobre el cálculo del Real Operational Score.

- **NIVEL C - INFRAESTRUCTURA Y CRITICAL CORES (Alto Riesgo / Nuclear):**
  - Modificaciones en la estructura de Firestore o APIs de conexión (`firebaseService.ts`).
  - Cambios en las firmas digitales de integridad (`exportSignature`) o algoritmos de Checksum.
  - Ajustes de comportamiento en el Pipeline de Importación Controlada o motor de ExcelJS.
  - *Gobernanza:* **BLOQUEADO DE FORMA DETERMINISTA**. Cualquier cambio en este nivel está sujeto a aprobación excepcional por el comité superadmin y auditoría forense masiva con simulacro previo de restauración de emergencia.

---

### 2. Reglas Estrictas de Freeze y No Regresión

- **Inviolabilidad de Semáforos e Históricos:** Está estrictamente prohibido realizar cualquier refactorización o cambio de UI/UX sobre los semáforos, el historial de cambios, los reportes PowerPoint, o los algoritmos de detección de anomalías consolidados.
- **Aislamiento de Módulos (Core Isolation):** Todo desarrollo futuro o experimental debe encapsularse en submódulos externos aislados (e.g. `lab/` u hojas de estilo externas), sin alterar los componentes core consolidados del GOLD MASTER.
- **Doble Mutex Activo:** Se prohíben las importaciones asíncronas concurrentes; el mutex de importación debe permanecer inalterable para mitigar riesgos de colisión y reintentos.

---

### 3. Criterios de Aplicación de Hotfixes Operativos

1. **Detección:** Un bug crítico es clasificado de alta severidad únicamente si afecta el cálculo de los promedios semafóricos, bloquea la descarga de resguardos XLSX, o impide la consistencia de los datos en Firestore.
2. **Desarrollo en Aislamiento:** El hotfix se desarrolla exclusivamente sobre una rama aislada (`lab_branch`) partiendo del tag maestro `v9.4.3-STABLE-AI-FORENSIC-HARDENING`.
3. **Sandbox Dry Run:** Se valida localmente inyectando el dataset en el pipeline; el sandbox no debe mostrar advertencias ni errores celulares.
4. **Auto-Checkpoint:** El despliegue de un hotfix exige la creación de un checkpoint manual forense en el cliente antes de refrescar la base de datos de producción.
5. **Cierre de Ciclo:** Se actualiza el Changelog Maestro detallando el bug corregido, y se incrementa el hotfix en la versión de forma controlada conservando el baseline de gobernanza.
