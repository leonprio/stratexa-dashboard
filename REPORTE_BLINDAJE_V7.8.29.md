# Reporte de Blindaje y Aislamiento Multi-App
**Versión de Aplicación:** v7.8.29-UX-ELITE
**Fecha:** 2026-03-12

## Diagnóstico
Se detectó una infiltración de acceso entre la aplicación de **Tablero** y la de **Gobernanza**. El origen del problema era una inconsistencia en las referencias a las colecciones de base de datos de Firestore.

### Puntos Críticos Corregidos
1. **App.tsx (Hook de Autenticación):** El sistema estaba consultando la colección genérica de `users` en lugar de la colección blindada `tbl_users`. Esto provocaba que, al iniciar sesión, se cargaran perfiles de usuario pertenecientes a Gobernanza o Activador en la aplicación de Tablero.
2. **Cloud Functions (Administración de Usuarios):** Las funciones de servidor para crear, eliminar y cambiar contraseñas estaban apuntando a la colección global `users`. Esto significa que cualquier cambio administrativo hecho desde Tablero afectaba a la base de datos compartida, rompiendo el blindaje Platinum Shield.

## Medidas Aplicadas
- [x] Sincronización de `App.tsx` para usar exclusivamente `tbl_users`.
- [x] Actualización de `functions/index.js` para usar la constante `USERS_COLLECTION = "tbl_users"`.
- [x] Incremento de versión a `v7.8.29-UX-ELITE` para trazabilidad del despliegue.

## Recomendación
Es necesario realizar un despliegue completo de la aplicación y de las Cloud Functions para que los cambios surtan efecto en el entorno de producción (`tablero.leonprior.com`).

```powershell
# Comandos sugeridos
firebase deploy --only functions
npm run build
firebase deploy --only hosting
```
