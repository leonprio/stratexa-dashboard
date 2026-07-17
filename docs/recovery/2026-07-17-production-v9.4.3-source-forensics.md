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

## 3. Plan de Importación de la Fuente Canónica (Propuesta)
Para regularizar la fuente e implementar de manera segura las salvaguardas de la Cohorte B y el blindaje sin perder el control de versiones en el repositorio principal:

1. **Aislamiento en APP-TABLERO-RECOVERY**:
   Copiar los archivos modificados de OneDrive a `C:\APP-TABLERO-RECOVERY\v9.4.3-source-forensics\src` para asegurar un respaldo inmutable libre de Git.
2. **Creación de Rama de regularización**:
   En el repositorio canónico local, crear la rama `recovery/production-source-v9.4.3-forensics` partiendo del baseline `1a25ee39552947dd5c3b571b542f930e8a5b70bc`.
3. **Importación Limpia**:
   Copiar el código de `v9.4.3` de OneDrive a la raíz del worktree `recovery-production-source-v9.4.3-forensics`.
4. **Validación del Build**:
   Ejecutar `npm run build` y corroborar que el bundle de salida coincide lógicamente con el comportamiento y marcadores de producción.
5. **Commit de Regularización**:
   Crear un commit en la rama forense con el mensaje:
   `recovery: synchronize codebase with production source v9.4.3`
6. **No Deploy / No Push**:
   De acuerdo con las directrices de seguridad, no se ejecutará `git push` ni despliegues en el Hosting.
