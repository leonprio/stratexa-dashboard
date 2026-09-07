# Checklist Operativo de Despliegue de Firestore Rules
**Proyecto Firebase:** `prior-01`  
**Versión de Referencia:** `v9.5.5`  
**Commit de Referencia:** `6ce1bc70ed9aa14a784fccd8233e919e3c24fe99`  
**Objetivo:** Guía operativa paso a paso y comandos certificados para ejecutar un despliegue seguro y controlado de reglas de Firestore sin impacto a aplicaciones hermanas.

---

## Fase 1: Pre-Check y Snapshot (Obligatorio)
- [ ] 1.1 Obtener y guardar snapshot de las reglas actualmente en vivo en `prior-01` en `docs/backups/rules/firestore_rules_live_<TIMESTAMP>.rules`.
- [ ] 1.2 Verificar el estado del repositorio local (`git status --short` limpio, rama autorizada `main`).
- [ ] 1.3 Confirmar que ninguna regla fuera del namespace `tbl_*` haya sido modificada o eliminada sin acuerdo inter-equipos.

---

## Fase 2: Validación y Pruebas Locales (Obligatorio)
- [ ] 2.1 Ejecutar suite completa de reglas de Tablero en emulador aislado:
  ```bash
  npm run test:rules
  ```
  *Criterio de Aceptación:* 59/59 tests PASS, 0 errores.
- [ ] 2.2 Validar que la regla catch-all preserve la guarda `!collection.matches('^tbl_.*')`.
- [ ] 2.3 Ejecutar validación de despliegue en seco (dry-run) con Firebase CLI:
  ```bash
  npx firebase deploy --only firestore:rules --dry-run --project prior-01
  ```

---

## Fase 3: Autorización y Despliegue Controlado
- [ ] 3.1 Notificar a los administradores de los módulos `cpx_*`, `vac_*` y `stx_*` sobre la ventana de mantenimiento.
- [ ] 3.2 Desplegar ÚNICAMENTE las reglas de Firestore (nunca deploy global):
  ```bash
  npx firebase deploy --only firestore:rules --project prior-01 --non-interactive
  ```
- [ ] 3.3 Registrar en la bitácora el hash del commit desplegado y la hora exacta.

---

## Fase 4: Smoke Test Inmediato en Producción (Post-Deploy)
- [ ] 4.1 **Tablero:** Iniciar sesión con usuario Administrador (`leon@leonprior.com`) y verificar carga de dashboards sin errores 403.
- [ ] 4.2 **Tablero:** Probar navegación entre clientes (`LEÓN`, `CEMENTOS_SIGMA`, `GE`) confirmando aislamiento de datos.
- [ ] 4.3 **Tablero:** Probar lectura y edición de KPI / Plan de Acción con usuario autorizado.
- [ ] 4.4 **Otras Aplicaciones:** Verificar lectura básica en Gobernanza (`cpx_*`) y Vacantes (`vac_*`).

---

## Fase 5: Procedimiento Certificado de Rollback de Emergencia

Si se detecta cualquier falla 403 en producción o regresión cross-app:

- [ ] 5.1 Respaldar la versión candidata actual en el espacio de trabajo:
  ```powershell
  Copy-Item firestore.rules firestore.rules.candidate
  ```
- [ ] 5.2 Sobrescribir `firestore.rules` temporalmente con el snapshot previo:
  ```powershell
  Copy-Item docs/backups/rules/firestore_rules_live_<TIMESTAMP>.rules firestore.rules -Force
  ```
- [ ] 5.3 Ejecutar el despliegue inmediato de rollback a `prior-01`:
  ```bash
  npx firebase deploy --only firestore:rules --project prior-01 --non-interactive
  ```
- [ ] 5.4 Restaurar el archivo candidato en el espacio de trabajo para análisis forense:
  ```powershell
  Copy-Item firestore.rules.candidate firestore.rules -Force
  Remove-Item firestore.rules.candidate
  ```
- [ ] 5.5 Confirmar restablecimiento del servicio y registrar la incidencia.
