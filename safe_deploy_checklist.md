# Stratexa Dashboard - Lista de Chequeo de Despliegue Seguro
## Versión: v9.4.3-STABLE-AI-FORENSIC-HARDENING (GOLD MASTER)

Esta lista de chequeo es de uso obligatorio y mandatorio antes de promover cualquier cambio a ambientes de producción o distribución oficial.

---

### 1. Validación de Compilación (Build Validation)
- [ ] Ejecutar el comando de verificación estática de tipos: `npm run build` (debe correr `tsc -b && vite build` sin errores).
- [ ] Comprobar que no haya advertencias críticas del bundler ni importaciones circulares en el código compilado.
- [ ] Verificar que los archivos generados en `build_output/assets` tengan hashes únicos y que el tamaño de los chunks esté optimizado.

### 2. Validación de Recuperación (Recovery Validation)
- [ ] Confirmar la existencia de checkpoints locales en `localStorage`.
- [ ] Comprobar la generación exitosa de un checkpoint preventivo atómico de respaldo antes de alterar cualquier base de datos.
- [ ] Validar que la descarga del archivo de manifiesto `baseline_manifest.json` e inventario de firmas criptográficas se complete correctamente.

### 3. Validación de Importación/Exportación
- [ ] Realizar un Dry Run cargando la planilla XLSX estructurada de recuperación en el Sandbox para verificar la correspondencia por IDs inmutables de KPIs y dashboards.
- [ ] Verificar que el diff celular resalte con precisión en color ámbar las celdas modificadas (valores antiguos vs nuevos) y que no se permitan importaciones basadas en nombres.
- [ ] Validar que las exportaciones diferenciales por Dirección o por Área filtren de forma rigurosa la información según los perfiles de usuario.

### 4. Validación de Permisos y Accesos (Permission Hardening)
- [ ] Confirmar que solo usuarios con roles de `admin` o `superadmin` tengan acceso al pipeline de importación en la pestaña `IMPORTS`.
- [ ] Comprobar que los directores de área tengan el exportador limitado estrictamente a la sección del hospital parametrizada en su propiedad `group`/`area`.
- [ ] Comprobar que las acciones nucleares en la sección `NUCLEAR` del panel exijan doble ventana de validación y la escritura del texto exacto de confirmación.

### 5. Validación de Rollback (Rollback Governance)
- [ ] Aplicar una importación de prueba y validar que se fuerce la descarga del triple backup automático (Baseline, Recovery XLSX y Manifest).
- [ ] Ejecutar la opción "Deshacer e Iniciar Rollback" en la pantalla de éxito de importación y corroborar que todos los valores en Firestore vuelvan de forma íntegra a su estado previo.
- [ ] Verificar que no haya bloqueos en el navegador o locks huérfanos de importación activos tras finalizar el rollback.

### 6. Validación Responsiva y Usabilidad (Regla #UX001)
- [ ] Comprobar visualmente los layouts del panel de configuración y pipeline de importación en los 4 dispositivos mínimos:
  - iPhone SE (375x667px)
  - iPhone 14 Pro Max (430x932px)
  - Android Pixel 6 (412x915px)
  - iPad Mini (768x1024px)
- [ ] Asegurar que no haya scroll horizontal involuntario en vistas móviles.
- [ ] Verificar que los Touch Targets en todas las pestañas de `ClientSettings` y botones en `ControlledImporter` sean iguales o superiores a **44x44px**.
- [ ] Corroborar la inyección del meta tag `viewport` y la respuesta tipográfica fluida.
