# 📘 Memoria Técnica Final: Sistema Tablero Prior (v7.8.16)

> **Estado**: PRODUCCIÓN (Build v7.8.16-PLATINUM-ULTRA-V13)  
> **Fecha de Actualización**: 23 de Febrero de 2026  
> **Responsable**: IA Antigravity (Google DeepMind) & Equipo IPS
> **Certificación de Seguridad**: PLATINUM ULTRA SHIELD ACTIVE

---

## 1. Visión General del Sistema

**Tablero Prior** es una plataforma de Business Intelligence (BI) de grado empresarial diseñada para el monitoreo estratégico de KPIs. En su versión 7.8.16, el sistema alcanza la **Persistencia Universal**, optimizando la navegación tanto en escritorio como en dispositivos móviles, y garantizando un comportamiento determinista del sidebar.

### 🌟 Hitos Tecnológicos de la Versión 7.8.x
*   **Supreme Universal Persistence (v7.8.16)**: Desacoplamiento total de la expansión del sidebar. Se eliminó el auto-expand redundante al navegar por el grupo General y se optimizó el layout móvil (Touch Targets 44px+).
*   **Atomic Persistence Shield (v7.8.15)**: Implementación de un motor de estado basado en objetos booleanos para la expansión del sidebar.
*   **Dynamic Synthesis Labels (v7.8.11)**: El sidebar ahora utiliza los títulos dinámicos generados (ej: "DIRECCIÓN ORIENTE") eliminando etiquetas genéricas.
*   **General Group Recovery**: Restauración total del grupo "GENERAL" en la jerarquía.
*   **Supreme Side-Persistence (v7.8.10)**: Desacoplamiento de filtros de áreas y selección de tableros.
*   **Adaptive Mobile Layout V3**: Motor responsivo diseñado bajo la regla `UX001`. Asegura que la jerarquía y el tablero principal sean utilizables en dispositivos con Safe Areas (iPhone 14+) mediante un layout inteligente de apilado.
*   **Platinum Ultra Shield (v7.0.0)**: "Hard-Lock" en Firestore. Todas las colecciones utilizan el prefijo `tbl_` y están protegidas por reglas de seguridad a nivel de servidor que impiden el acceso cruzado entre apps dentro del proyecto `prior-01`.
*   **Formula Pro (v7.2.1)**: Motor de cálculo con soporte para procesamiento de lenguaje natural (NLP Lite). Permite referenciar KPIs por nombre (`bajas / altas`) simplificando la creación de indicadores compuestos.

---

## 2. Arquitectura de Datos y Blindaje

### 2.1 Aislamiento de Micro-Colecciones
Rutas protegidas para garantizar que el **Tablero** sea una isla de datos segura:

| App | Prefijo | Estado |
| :--- | :--- | :--- |
| **Tablero Prior** | `tbl_` | **Activo (Lock)** |
| **Activador** | `stx_` | Aislado |
| **Vacantes IPS**| `ips_` | Aislado |

### 2.2 Jerarquía de Navegación Determinista
1.  **Nivel 4 (SuperGrupo)**: Agrupaciones regionales o de directores (ej. "ZONA NORTE").
2.  **Nivel 3 (Grupo)**: Unidades administrativas (ej. "GERENCIA METRO").
3.  **Nivel 2 (Área)**: Segmentación transversal por área funcional (ej. "OPERACIONES").
4.  **Nivel 1 (Tablero)**: Unidad mínima de reporte con hidratación en tiempo real.

---

## 3. Stack Tecnológico

| Capa | Tecnología | Función |
| :--- | :--- | :--- |
| **Core** | React 19 + TypeScript 5.8 | Lógica de interfaz y seguridad de tipos robusta. |
| **Fórmulas** | Intelligent Evaluator v7.2 | Procesamiento de expresiones aritméticas dinámicas. |
| **Base de Datos** | Firestore (Prefijado) | Almacenamiento NoSQL con blindaje avanzado. |
| **Infraestructura**| Firebase Hosting (Target: tablero) | Despliegue con control de caché no-store para evitar versiones obsoletas. |

---

## 4. Guía de Operación (CI/CD)

Flujo mandatorio para despliegues en producción:

```bash
# 1. Compilar para producción (Vite)
npm run build

# 2. Desplegar reglas de seguridad (Mandatorio si hay cambios en tipos)
firebase deploy --only firestore:rules

# 3. Desplegar aplicación al target específico
firebase deploy --only hosting:tablero
```

---

## 5. Roadmap Consolidado
- [x] **v7.0.0**: Lanzamiento de **Platinum Shield** (DB Isolation).
- [x] **v7.2.1**: Implementación de Jerarquía Nivel 4 y Formula Pro.
- [x] **v7.8.5**: Sincronización de versiones y auditoría de respaldos.
- [x] **v7.8.6**: **UX Shield & Mobile V3** (Selección persistente y layout móvil).
- [x] **v7.8.7**: **Unified Navigation Core** (Simplificación de Sidebar y corrección de filtros de grupo).
- [x] **v7.8.8**: **Extreme Navigation Shield** (Blindaje reforzado contra colapsos durante la selección).

---

**CONFIDENCIAL**: Este documento es propiedad de Prior Consultoría. Blindaje activo bajo supervisión de IA Antigravity.
