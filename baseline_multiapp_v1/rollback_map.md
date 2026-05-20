# Mapa de Rollback y Estrategia de Contingencia Multiapp

Este mapa de rollback y plan de contingencia define los límites de aislamiento de cada aplicación en el proyecto `prior-01` y los procedimientos exactos de recuperación ante cualquier eventualidad de despliegue o contaminación cruzada.

---

## 1. Mapa de Aislamiento y Targets Estables

| Aplicación | Sitio Firebase Hosting | Dominio Asociado (Acceso Público) | Target de Despliegue | Directorio de Compilación |
| :--- | :--- | :--- | :--- | :--- |
| **Tablero Estratégico** | `prior-01` | `https://tablero.leonprior.com` | `tablero` | `build_output` |
| **Gobernanza COPARMEX** | `gobernanzacpx` | `https://gobernanzacpx.web.app` | `gobernanza` | `dist` |
| **Activador** | `activador` | `https://activador.web.app` | N/D (Aislado) | N/D |
| **Vacips** | `vacips` | `https://vacips.web.app` | N/D (Aislado) | N/D |

---

## 2. Estrategias de Rollback Simple (Consola & CLI)

### Método A: Rollback Instantáneo desde Consola Firebase (Recomendado)
Firebase Hosting guarda un historial completo de las releases desplegadas. Ante cualquier anomalía visual o lógica en producción:
1. Ve a la consola web de Firebase: [Consola Firebase - prior-01](https://console.firebase.google.com/project/prior-01/hosting/main).
2. Selecciona el sitio afectado (ej. `prior-01` para el Tablero o `gobernanzacpx` para Gobernanza).
3. En la sección **Historial de versiones**, identifica la última versión sana (ej. la versión desplegada en el checkpoint actual).
4. Haz clic en el botón de tres puntos a la derecha de la versión sana y selecciona **Revertir (Rollback)**.
5. *Resultado*: El cambio se aplica en menos de 5 segundos a nivel de la CDN global de Firebase.

### Método B: Rollback vía Firebase CLI (Línea de Comandos)
Si necesitas revertir el hosting a una versión previa a través de comandos seguros:
1. Ubica el identificador de la release anterior en el historial de releases.
2. Ejecuta el comando:
   ```bash
   firebase hosting:channel:deploy --only <target_name> <channel_id>
   ```
   O de forma más sencilla, regenera el build del commit estable anterior en Git y realiza un despliegue limpio de sobreescritura:
   ```bash
   npm run deploy:safe
   ```

---

## 3. Matriz de Mitigación de Riesgos Residuales

| Riesgo | Impacto | Mitigación Activa |
| :--- | :--- | :--- |
| **Despliegue accidental de Gobernanza sobre Tablero** | Alto | **Bloqueado**. La nueva guardia `BLOCK_DEPLOY_IF_SITE_MISMATCH` en `preDeployCheck.js` abortará el proceso si detecta targets ambiguos o proyectos diferentes a `prior-01`. |
| **Persistencia de Caché CDN tras Rollback** | Medio | Firebase Hosting invalida la CDN inmediatamente. No obstante, se recomienda a los usuarios refrescar el navegador con `Ctrl + F5` o vaciar la caché local si persisten datos viejos. |
| **Modificación de Configuración en Producción** | Alto | **Congelado**. Los archivos clave de configuración del baseline se encuentran en `baseline_multiapp_v1/`. Cualquier desviación puede compararse y restaurarse al instante. |

---
**Baseline Blindado v1.0.0** — Mayo 2026
