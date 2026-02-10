# 📘 Memoria Técnica Final: Sistema Tablero Prior (v5.9.7)

> **Estado**: PRODUCCIÓN (Build v5.9.7-PRO+)  
> **Fecha de Actualización**: 5 de Febrero de 2026  
> **Responsable**: IA Antigravity (Google DeepMind) & Equipo IPS

---

## 1. Visión General del Sistema

**Tablero Prior** es una plataforma de Business Intelligence (BI) de alto rendimiento para el monitoreo estratégico organizacional. Su arquitectura es **Multi-Tenant (Multi-Cliente)**, **Segura** y altamente **Escalable**, permitiendo la gestión centralizada de múltiples clientes con aislamiento estricto de datos.

### 🌟 Evolución Tecnológica de Vanguardia (v5.9.x)
*   **Manual Entry Optimization (v5.9.7)**: Eliminación de la "tortura" operativa mediante campos de entrada directa para metas altas (ej. 700+), manteniendo el blindaje contra valores negativos y malformados.
*   **SHIELD CORE (v5.9.7)**: Motor de protección de jerarquías que impide la "absorción" accidental de tableros. Reconoce automáticamente la subordinación de mandos (Fuzzy Matching) y preserva la integridad de los grupos originales.
*   **Auditoría de Captura Real (v5.5.9.4)**: Algoritmo de cumplimiento que ignora placeholders (`0/0`) y promedia solo datos reales capturados, eliminando falsos positivos en los semáforos ejecutados.
*   **Discovery System (v5.5.9.5)**: Capacidad de autodescubrimiento de grupos para clientes nuevos (ej. LEÓN) que no requieren configuración previa de directores para ser funcionales.
*   **Supreme Hierarchy (v5.5.6)**: Lógica de navegación ejecutiva que balancea la síntesis global con la supervisión regional mediante la corona **👑 MASTER**.

---

## 2. Arquitectura Tecnológica (Stack)

| Capa | Tecnología | Justificación |
| :--- | :--- | :--- |
| **Frontend** | React 19 + TypeScript | Estándar de la industria para aplicaciones reactivas de alta robustez. |
| **IA Engine** | Google Gemini / OpenAI | Procesamiento de lenguaje natural para auditoría y análisis de KPIs. |
| **Build Tool** | Vite 7 | Tiempos de carga instantáneos y optimización de bundle para producción. |
| **Estilos** | CSS Moderno | Estética premium con efectos de Glassmorphism y diseño "Deep Space". |
| **Backend / DB** | Firebase Firestore | NoSQL en tiempo real con escalabilidad automática. |
| **Seguridad** | Firebase Auth + Roles | Gestión granular de acceso por tablero y por mandos delegados. |

---

## 3. Modelo de Datos y Seguridad

### 3.1 Niveles de Acceso
1.  **Super Administrador**: Control absoluto y visibilidad total para auditoría técnica.
2.  **Super Director (Executive)**: Supervisa múltiples "Direcciones" regionales (subgrupos) y accede a tableros agregados automáticos.
3.  **Director Regional**: Responsable de un grupo específico de tableros.
4.  **Member (Capturista)**: Usuario enfocado en la entrada operativa de datos.
5.  **Gestor de KPIs**: Permiso `canManageKPIs` para edición estructural de tableros.

### 3.2 Protocolo de Aislamiento Inmutable
Todo acceso a la base de datos está condicionado por el `clientId`. El sistema garantiza que los datos de **IPS**, **LEÓN** y otros clientes jamás se mezclen, incluso en consultas globales de administración.

---

## 4. Funcionalidades de Auditoría (v5.9.x)

### 📈 4.1 Cálculo de Captura con Propagación de Nulls
A diferencia de versiones anteriores, el sistema ahora distingue entre un `0` capturado y la ausencia de dato. En las agregaciones globales, si ningún tablero hijo tiene datos, el resultado es `null` (0% captura), en lugar de un falso cumplimiento del 100% o 67%.

### 🌳 4.2 Auto-Mapeo de Jerarquías
El sistema infiere las relaciones de mando comparando los `subGroups` de los directores con los nombres de cargo. Se ha implementado un blindaje para que los usuarios superiores no "roben" la visibilidad de los mandos medios al compartir accesos.

---

## 5. Mantenimiento y Operación

### Comandos de Despliegue Seguro
```bash
# Ejecutar Auditoría Global antes de desplegar
node scripts/generateIntegrityReport.js

# Construcción y Despliegue Limpio (Elimina cache vieja)
npm run build && firebase deploy --only hosting
```

---

## 6. Documentos de Referencia (Memoria de la Aplicación)

Para comprender la estructura completa, consulte los siguientes artefactos en el repositorio:
1.  `MEMORIA_TECNICA_FINAL_2026.md`: Este documento (Arquitectura y Roadmap).
2.  `App.tsx`: Núcleo de la aplicación, lógica de rutas y gestión de estado global.
3.  `utils/compliance.ts`: El "Cerebro" de las matemáticas de cumplimiento y captura.
4.  `components/DashboardTabs.tsx`: Motor de renderizado de la navegación y filtros.
5.  `integrity_report.md`: Reporte generado automáticamente con el estado de salud del código (Lint, Tests, Tipado).

---

## 7. Roadmap Consolidado (Hitos v5.9.x)
- [x] **Cálculo de Captura Preciso**: Ignora `0/0` y placeholders (v5.5.9.4).
- [x] **Integrity Shield**: Auditoría de grupos para clientes nuevos (v5.5.9.5).
- [x] **Shield Core**: Blindaje de jerarquías y solución de regresión de visibilidad (v5.5.9.6).
- [x] **Sticky Executive Header**: Navegación persistente para directivos.
- [x] **Null Propagation**: Agregaciones basadas en datos reales, no en ceros inicializados.
- [x] **Manual Entry UX**: Entrada manual de metas y avances para grandes volúmenes (v5.9.7).
- [x] **Data Shielding**: Validación estricta de entradas numéricas en modo detallado.

---

**CONFIDENCIAL**: Este documento es propiedad de Prior Consultoría. Toda copia no autorizada está prohibida.
