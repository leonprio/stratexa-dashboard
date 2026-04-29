# 📗 Protocolo de Integridad y Desarrollo: Sistema Tablero Prior (v9.1.0-PRO-FINAL-SHIELDED)

> **Versión Actual**: v9.1.0-PRO-FINAL-SHIELDED  
> **Última Actualización**: 31 de Enero de 2026  
> **Estado**: BLINDADO / PRODUCCIÓN  

---

## 🏗️ 1. Arquitectura de Jerarquías (v9.1.0-PRO-FINAL-SHIELDED)

### 1.1 Jerarquías Ejecutivas (👑 MASTER y 🏢 DIR)
- **Concepto**: Los directores supervisan grupos de tableros.
- **Diferenciación Visual**:
  - **👑 MASTER (Purple Glow)**: Agregado global de un Super Director.
  - **🏢 DIR (Cyan Glow)**: Agregado de una Dirección Regional o Grupo.
- **Agregación Smart-Match (v5.1.2)**: Los agregados se calculan por coincidencia de NOMBRE de indicador, no por posición, permitiendo promedios correctos aunque los tableros tengan estructuras distintas.

### 1.2 Regla de Oro de Posesión (v9.1.0-PRO-FINAL-SHIELDED)
- **Priorización de Hojas**: Si varios directores tienen acceso a un mismo tablero, el sistema lo asignará visualmente al director de menor nivel (el que no supervisa a otros). Esto evita que los grupos operativos desaparezcan cuando un director superior les da seguimiento.

---

## 🛡️ 2. Blindaje de Integridad (Data & Logic)

### 2.1 Normalización de Grupos (v9.1.0-PRO-FINAL-SHIELDED)
- **Fuente de Verdad**: `utils/formatters.ts`. 
- **Regla v5.1.5**: Se ha desactivado el recorte de prefijos (DIRECCIÓN, GRUPO) para permitir que el sistema distinga entre la "DIRECCIÓN SUR" (concentrado) y el grupo "SUR" (operativo).
- **Importancia**: Evita la colisión de pestañas y asegura que los agregados regionales sean visibles independientemente de los grupos de sus tableros hijos.

### 2.2 Seguridad de Identificadores (v4.1.4+)
- **IDs Compuestos**: Los dashboards nunca deben usar IDs puros de Firestore si son números cortos. La lógica de `normalizeDashboardId` en `firebaseService.ts` previene colisiones.
- **Aislamiento por Cliente**: El filtrado por `clientId` es la primera capa de defensa en cada query de Firestore.

### 2.3 Semáforo de Periodos Abiertos (v4.2.0+)
- **Estado 'InProgress'**: Los periodos que aún no han vencido (mes actual) se marcan con color **Cyan (Sky)** y estado `InProgress`, evitando que el dashboard se tiña de rojo falsamente por metas aún no alcanzadas.

---

## 🎨 3. Estándares de Diseño (Premium UX)

### 3.1 Densidad de Información
- **Optimización v5.1.0**: Se ha reducido el padding en un 25% y se han ajustado los tamaños de fuente para permitir ver más KPIs sin scroll.
- **Ranking de Desempeño**: Utiliza badges con brillo (glow) y degradados para una legibilidad instantánea de los estados (Verde/Amarillo/Rojo).

### 3.2 Visualización de Gráficas
- **Clamping de Datos**: Las gráficas de tendencia ignoran puntos futuros en 0 para no distorsionar la visualización del desempeño acumulado.
- **Tendencia Cyan**: La meta siempre se representa con una línea punteada Cyan (`#06b6d4`) para diferenciarse claramente del progreso real (Verde `#10b981`).

---

## 🛠️ 4. Guía de Mantenimiento

### Despliegue Crítico (Procedimiento Obligatorio)
1.  **Build**: `npm run build` (Genera el bundle optimizado).
2.  **Deploy**: `firebase deploy` (Sube solo lo necesario).
3.  **Hard Refresh**: Instruir al usuario final realizar `Ctrl + F5` tras actualizaciones de versión.

### 4.2 Protocolos ARMOR (v5.1.3 - v5.1.5)
- **Visibilidad Expansiva (v5.3.x)**: El botón SÍNTESIS permanece fijo para directores, garantizando navegación fluida hacia el concentrado.
- **Aislamiento Operativo (v5.3.3)**: Los Miembros tienen prohibido ver agregados; el sistema fuerza la selección de su primera UNE real para evitar bloqueos por permisos de solo lectura.
- **Sincronización Estable (v5.3.5)**: Los modales de captura utilizan ahora un desacoplamiento de estado local que impide que re-renderizados del padre sobrescriban lo que el usuario está escribiendo. El cumplimiento se calcula en tiempo real sobre el estado virtual.
- **Motor de Permisos Resiliente (v5.3.4)**: Normalización de IDs (String/Number) y retrocompatibilidad con IDs originales de 2025 para tableros clonados.
- **Privacidad de Versión (v5.1.4)**: La etiqueta de versión es **estrictamente confidencial**; solo es visible para el rol `Admin`.

---
**CONFIDENCIAL**: Este documento rige el desarrollo futuro del Sistema Tablero Prior.
