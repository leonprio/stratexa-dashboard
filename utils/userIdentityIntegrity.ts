/**
 * Códigos de error estructurados para el contrato de identidad.
 */
export type IdentityErrorCode =
  | 'PROFILE_MISSING'
  | 'PROFILE_ID_MISMATCH'
  | 'AUTH_UID_MISMATCH'
  | 'HISTORICAL_PROFILE_DETECTED'
  | 'INVALID_ROLE'
  | 'INVALID_CLIENT_ID'
  | 'PROFILE_READBACK_MISMATCH'
  | 'RECOVERY_REQUIRED';

export interface IdentityValidationError {
  code: IdentityErrorCode;
  message: string;
}

export interface UserIdentityInput {
  authUid?: string;
  documentId?: string;
  profileId?: string;
  email?: string;
  globalRole?: string;
  clientId?: string;
}

/**
 * 🛡️ UTILIDAD PURA Y TIPADA PARA VALIDACIONES DE IDENTIDAD Y PERFIL (v9.4.4)
 * Centraliza las reglas de coincidencia de UID, id inmutable y formato.
 * Devuelve errores estructurados con mensajes ejecutivos.
 */
export const validateUserIdentity = (
  input: UserIdentityInput,
  historicalProfileExists: boolean = false
): IdentityValidationError | null => {
  const { authUid, documentId, profileId, email, globalRole, clientId } = input;

  // 1. Invariante 1: Coincidencia del documentId con el Auth UID
  if (authUid && documentId && authUid !== documentId) {
    return {
      code: 'AUTH_UID_MISMATCH',
      message: 'El identificador de autenticación (UID) no coincide con el identificador del documento de perfil.'
    };
  }

  // 2. Invariante 2: Coincidencia del profile.id con el documentId (e.g. id en los datos internos)
  if (documentId && profileId && documentId !== profileId) {
    return {
      code: 'PROFILE_ID_MISMATCH',
      message: 'El campo de identificación interna del perfil (id) no coincide con el identificador del documento.'
    };
  }

  // 3. Invariante 4: Detección de perfil histórico desalineado
  if (historicalProfileExists) {
    return {
      code: 'HISTORICAL_PROFILE_DETECTED',
      message: 'Existe un perfil anterior asociado a esta identidad. Utiliza el flujo de recuperación y no crees una cuenta duplicada.'
    };
  }

  // 4. Validaciones de consistencia de roles
  if (globalRole) {
    const validRoles = ['Admin', 'Director', 'Member'];
    const matched = validRoles.find(r => r.toLowerCase() === globalRole.toLowerCase());
    if (!matched) {
      return {
        code: 'INVALID_ROLE',
        message: `El rol '${globalRole}' provisto no es válido. Debe ser uno de: Admin, Director o Member.`
      };
    }
  }

  // 5. Validación de ClientId básico
  if (clientId !== undefined && (!clientId || clientId.trim() === '')) {
    return {
      code: 'INVALID_CLIENT_ID',
      message: 'El identificador de cliente provisto no puede estar vacío.'
    };
  }

  return null;
};
