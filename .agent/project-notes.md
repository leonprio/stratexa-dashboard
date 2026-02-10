# Tablero IPS - Notas del Proyecto

## Última actualización: 2025-12-10

## Estado Actual
- ✅ Aplicación funcionando con Firebase Auth y Firestore
- ✅ Sistema de roles: Admin (acceso total) y Member (acceso limitado)
- ✅ Dashboard roles: Editor (puede editar) y Viewer (solo ver)
- ✅ Módulo de gestión de usuarios funcional
- ✅ Creación de usuarios con contraseña
- ✅ Envío de email de recuperación de contraseña
- ✅ Eliminación de usuarios (solo de Firestore)
- ✅ Banner de DEBUG removido y desplegado

## Tecnologías
- React + TypeScript + Vite
- Firebase Auth y Firestore
- Deployed: Firebase Hosting (https://prior-01.web.app)

## Archivos Clave
- `App.tsx` - Componente principal, maneja autenticación y estado global
- `components/UserManager.tsx` - Gestión de usuarios y permisos
- `services/firebaseService.ts` - Servicios de Firebase
- `types.ts` - Tipos TypeScript (User, Dashboard, Roles, etc.)

## Lógica de Roles
1. **GlobalUserRole.Admin**: Acceso total a todos los tableros y módulos administrativos
2. **GlobalUserRole.Member**: Solo acceso a tableros asignados, sin acceso a módulos administrativos
3. **DashboardRole.Editor**: Puede editar datos de indicadores en el tablero asignado
4. **DashboardRole.Viewer**: Solo puede visualizar, no editar

## Pendientes / Issues Conocidos
- Cambio directo de contraseña requiere Cloud Functions (plan Blaze)
- Eliminar usuario de Firebase Auth requiere Cloud Functions

## Notas de Sesiones
### Sesión 2025-12-10 (Continuación)
- Se hizo deploy con banner DEBUG removido
- Usuario leon@x.com tenía rol Admin incorrecto en Firestore
- Se debe corregir el dato directamente en Firebase Console:
  1. Ir a Firestore > users > [uid de leon@x.com]
  2. Cambiar campo `globalRole` de "Admin" a "Member"
  3. Agregar en `dashboardAccess` el tablero correcto, ej: `{1: "Editor"}`

### Sesión 2025-12-10 (Primera)
- Se corrigió el módulo de gestión de usuarios
- Se implementó sincronización Auth/Firestore
- Se agregaron botones para reset de contraseña y eliminar usuario
