# Auditoría Forense de Procedencia de la Fuente v9.4.3

Este reporte detalla la investigación forense realizada en el entorno de desarrollo para identificar la ubicación física de la versión `v9.4.3-STABLE-AI-FORENSIC-HARDENING` desplegada en producción, estableciendo las conexiones entre los históricos locales y los logs de despliegue.

---

## 1. Rutas Inspeccionadas y Resultados de Búsqueda
* `C:\APP-TABLERO-LOCAL`: Contiene únicamente la versión base congelada en `v9.2.3`.
* `C:\APP-TABLERO-WORKTREES`: Diversos worktrees locales enfocados en reparaciones puntuales (`fix-access-lvp-v9.2.4`, `hotfix-admin-profile-access-2026-07-17`). Todos los worktrees activos toman como base la versión `v9.2.3`.
* **OneDrive - Prior Consultoría**: Se localizó una carpeta de desarrollo activa en la siguiente ruta:
  `C:\Users\LeonPrior\OneDrive - Prior Consultoría\Documentos\CONSULTORÍAS 2025\IPS\IA\APP TABLERO`
  * **package.json (Modificado localmente)**: `"version": "9.4.3"`
  * **App.tsx (Línea 56-57)**:
    ```tsx
    // 🛡️ v9.4.3-STABLE-AI-FORENSIC-HARDENING: AI FORENSIC HARDENING & DETERMINISTIC SEMANTICS
    const VERSION_LABEL = "v9.4.3-STABLE-AI-FORENSIC-HARDENING";
    ```
  * **Estado de Git**: El repositorio de la carpeta de OneDrive está en la rama `main` (alineado a origin con HEAD en `1a25ee39552947dd5c3b571b542f930e8a5b70bc`), pero contiene un conjunto masivo de archivos modificados y no rastreados (*untracked files*) correspondientes a la versión `v9.4.3`.

---

## 2. Clasificación de la Fuente
**EXACT_SOURCE_FOUND**

Se ha identificado que la carpeta en OneDrive contiene el código fuente real del proyecto que posee las modificaciones no commiteadas de `v9.4.3`. Esta es la procedencia exacta que produjo el despliegue en producción.

---

## 3. Ejecución de la Importación y Resultados Forenses

La importación y validación se ejecutaron siguiendo un protocolo estricto de control:

1. **Snapshot Inmutable Creado**:
   - Ruta: `C:\APP-TABLERO-RECOVERY\v9.4.3-source-forensics\source-snapshot-2026-07-17`
   - Manifiesto: `C:\APP-TABLERO-RECOVERY\v9.4.3-source-forensics\source-snapshot-2026-07-17-manifest.json`
   - Total de archivos copiados: 94 archivos (fuente, scripts de build y tests, excluyendo caches, dependencias y credenciales).
   - Archivos de secretos excluidos registrados: `.env.local` (contiene únicamente un placeholder inofensivo `GEMINI_API_KEY=PLACEHOLDER_API_KEY`, sin secretos reales).

2. **Clasificación del Conjunto de Archivos**:
   - **PRODUCTION_SOURCE**: `App.tsx`, `components/*` (incluyendo la nueva subcapa de control operativo en `components/operational/*`), `services/aiService.ts`, `services/firebaseService.ts`, `types.ts`, `utils/compliance.ts`, `utils/aggregationUtils.ts`, `utils/dateUtils.ts`, `utils/formatters.ts`, `utils/initialData.ts`, `utils/weeklyUtils.ts`.
   - **BUILD_CONFIGURATION**: `package.json`, `package-lock.json`, `tsconfig.json`, `vite.config.ts`, `firebase.json`, `.firebaserc`, `firestore.rules`, `firestore.indexes.json`, `storage.rules`, `eslint.config.js`.
   - **TEST_SOURCE**: `utils/*.test.ts`, `components/*.test.tsx`, `jest.config.cjs`, `jest.setup.cjs`.
   - **DOCUMENTATION**: `CHANGELOG_MASTER.md`, `baseline_architecture_manifest.json`, `release_governance_policy.md`, `release_notes_v9.4.1.md`, `safe_deploy_checklist.md`, `README.md`, `CHANGELOG.md`.

3. **Escaneo de Privacidad y Secretos**:
   - El escaneo estático exhaustivo no arrojó contraseñas, claves privadas, tokens reales ni credenciales duras.
   - El archivo `.env.local` posee un placeholder ficticio. No se copiaron archivos de entorno ni credenciales administrativas al worktree.
   - Estado: **LIBRE DE SECRETOS Y PII**.

4. **Resultados de Integridad del Ciclo Local**:
   - **npm ci --legacy-peer-deps**: Instalación limpia exitosa (821 paquetes auditados).
   - **npm test**: Exitoso (13 Test Suites pasaron, 58 pruebas individuales ejecutadas y validadas al 100%).
   - **npm run build**: Exitoso (generó los artefactos optimizados en `build_output`).
   - **npm run predeploy**: Exitoso (validó consistencia estructural de versión 9.4.3 en package.json y App.tsx).

5. **Comparación Semántica de Producción (Equality Confirmada)**:
   - Se obtuvo el index.html y el bundle compilado directamente del sitio oficial de producción (`https://tablero.leonprior.com`).
   - El bundle de producción activo en la web es `/assets/index-CVzZFGX-.js`.
   - **Verificación Determinística por Hash (Igualdad Binaria)**:
     - Hash SHA-256 del bundle generado localmente: `5b5dd2dd301c9b9f9ff3eb1be1d8c3e3e936db5dae3faab869a5fd887cc2a067`
     - Hash SHA-256 del bundle descargado de producción: `5b5dd2dd301c9b9f9ff3eb1be1d8c3e3e936db5dae3faab869a5fd887cc2a067`
   - Clasificación de Equivalencia: **SEMANTIC_MATCH_CONFIRMED** (con coincidencia binaria total del bundle de distribución de producción).

---

## 4. Regularización en Git
- Rama forense: `recovery/production-source-v9.4.3-forensics`
- Commit ID: `recovery: synchronize codebase with production source v9.4.3`
- Se preservaron las exclusiones de hosting, deploys y credentials del Git histórico.
- Acciones futuras de push, merge o tags remotos quedan restringidas de acuerdo con la gobernanza de seguridad del proyecto.

