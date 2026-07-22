# Runbook de Conciliación de Perfiles de Identidad (v9.4.4)

Este documento detalla el procedimiento para resolver desalineaciones de identidad, fallas de readback y estados `RECOVERY_REQUIRED` en Stratexa Dashboard (v9.4.4).

## 1. Identificación del Estado de Conflicto
Se produce un estado de desalineación o falla de readback cuando ocurre una interrupción entre la creación del registro en Firebase Authentication y la escritura del documento de perfil en la colección `tbl_users` de Cloud Firestore.

Los síntomas principales son:
- El usuario puede iniciar sesión en la pantalla de login pero recibe el error `PERFIL_TABLERO_NO_VINCULADO`.
- La consola del administrador muestra un error `RECOVERY_REQUIRED` al intentar crear un usuario.
- Un usuario legítimo no puede acceder y se sospecha un desalineamiento del identificador inmutable (`profile.id` no coincide con el `UID` del documento en `tbl_users`).

## 2. Procedimiento de Conciliación Manual (Administrador)

> [!CAUTION]
> No intentes registrar nuevamente al usuario con el mismo correo electrónico en la interfaz de administración si se reportó `RECOVERY_REQUIRED`. Esto puede generar colisiones de UID y errores de perfil.

Sigue estos pasos en la Consola Firebase de tu proyecto (`prior-01`):

### Paso 2.1: Verificar Firebase Authentication
1. Dirígete a la consola de **Firebase Authentication** > pestaña **Users**.
2. Busca el correo del usuario afectado y copia su **User UID**.

### Paso 2.2: Verificar Cloud Firestore (`tbl_users`)
1. Dirígete a **Cloud Firestore** > colección `tbl_users`.
2. Busca un documento cuyo ID de documento coincida exactamente con el **User UID** obtenido en el paso anterior.
3. Si el documento **no existe**:
   - Crea un nuevo documento en `tbl_users` con ID igual al **User UID**.
   - Añade los siguientes campos (reemplazando con los datos reales del usuario):
     - `id` (String): [User UID]
     - `name` (String): [Nombre del usuario]
     - `email` (String): [Correo electrónico en minúsculas]
     - `globalRole` (String): `Member` o `Director` (según corresponda)
     - `clientId` (String): `IPS` (o el ID del cliente correspondiente)
     - `dashboardAccess` (Map): `{}` (vacío para administradores, o configurado según accesos requeridos)
     - `superGroups` (Array): `[]`
4. Si el documento **existe pero tiene campos incorrectos** (e.g. `profile.id` difiere del ID del documento):
   - Corrige el campo interno `id` para que sea idéntico al ID del documento de Firestore.
   - Guarda los cambios.

### Paso 2.3: Validación
1. Solicita al usuario que intente iniciar sesión nuevamente.
2. Si el acceso continúa denegado con `PERFIL_TABLERO_DESALINEADO`, valida que el correo ingresado en el login coincida exactamente en minúsculas con el registrado en `tbl_users` y Firebase Auth.
