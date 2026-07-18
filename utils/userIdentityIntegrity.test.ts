import { validateUserIdentity } from './userIdentityIntegrity';

describe('Pruebas unitarias de integridad de identidad de usuario (v9.4.4)', () => {
  test('debe fallar si el UID de autenticación no coincide con el identificador del documento de perfil', () => {
    const error = validateUserIdentity({
      authUid: 'uid-auth-123',
      documentId: 'uid-doc-456'
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('AUTH_UID_MISMATCH');
  });

  test('debe fallar si el id interno del perfil no coincide con el identificador del documento', () => {
    const error = validateUserIdentity({
      documentId: 'uid-doc-123',
      profileId: 'uid-profile-456'
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('PROFILE_ID_MISMATCH');
  });

  test('debe fallar si se detecta un perfil histórico al intentar crear uno nuevo desalineado', () => {
    const error = validateUserIdentity({
      email: 'historico@prior.com'
    }, true);
    expect(error).not.toBeNull();
    expect(error?.code).toBe('HISTORICAL_PROFILE_DETECTED');
  });

  test('debe fallar si el rol global no pertenece al conjunto permitido', () => {
    const error = validateUserIdentity({
      globalRole: 'SuperUser'
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('INVALID_ROLE');
  });

  test('debe fallar si el clientId está vacío', () => {
    const error = validateUserIdentity({
      clientId: '   '
    });
    expect(error).not.toBeNull();
    expect(error?.code).toBe('INVALID_CLIENT_ID');
  });

  test('debe tener éxito con configuraciones válidas', () => {
    const error = validateUserIdentity({
      authUid: 'uid-valido',
      documentId: 'uid-valido',
      profileId: 'uid-valido',
      globalRole: 'Member',
      clientId: 'IPS'
    }, false);
    expect(error).toBeNull();
  });
});
