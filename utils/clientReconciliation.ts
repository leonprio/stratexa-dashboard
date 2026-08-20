import { ManagedClient } from '../types';

export interface ClientReconciliationInput {
  selectedClientId: string;
  availableManagedClients: ManagedClient[];
  defaultFallback?: string;
}

/**
 * Reconcilia la selección de cliente activa contra la lista oficial de clientes gestionados.
 * 
 * Si un valor persistido en localStorage contiene un displayName de legado (ej. "IPS DIRECCIÓN"),
 * lo convierte automáticamente a su clientId técnico canónico (ej. "IPS_DIRECCION").
 */
export function reconcileClientSelection({
  selectedClientId,
  availableManagedClients,
  defaultFallback = 'IPS'
}: ClientReconciliationInput): string {
  if (!selectedClientId) return defaultFallback;

  // 🛡️ Proteccion contra condiciones de carrera: No reconciliar si los clientes aún no cargan
  if (!availableManagedClients || availableManagedClients.length === 0) {
    return selectedClientId;
  }

  // Opciones especiales del sistema que no se modifican
  if (selectedClientId === 'all' || selectedClientId === 'NEW_CLIENT_OPTION') {
    return selectedClientId;
  }

  const normSelected = selectedClientId.trim().toUpperCase();

  // CASO A: Coincidencia exacta con el clientId técnico de un cliente gestionado
  const exactTechnicalMatch = availableManagedClients.find(
    c => c.clientId.trim().toUpperCase() === normSelected
  );
  if (exactTechnicalMatch) {
    return exactTechnicalMatch.clientId;
  }

  // CASO B: Coincidencia exacta con el displayName de un cliente gestionado (Legacy Migration)
  const displayNameMatches = availableManagedClients.filter(
    c => c.displayName.trim().toUpperCase() === normSelected
  );

  if (displayNameMatches.length === 1) {
    return displayNameMatches[0].clientId;
  }

  // CASO D: Ambigüedad por múltiples displayNames idénticos
  if (displayNameMatches.length > 1) {
    console.warn(
      `⚠️ [CLIENT RECONCILIATION] Ambigüedad detectada: El nombre "${selectedClientId}" coincide con múltiples clientes:`,
      displayNameMatches.map(m => m.clientId)
    );
    // Preferir el primer clientId técnico o fallback seguro en caso de ambigüedad
    return availableManagedClients[0]?.clientId || defaultFallback;
  }

  // CASO C: No coincide ni con clientId ni con displayName (Valor obsoleto/desconocido)
  const fallbackExists = availableManagedClients.some(
    c => c.clientId.trim().toUpperCase() === defaultFallback.toUpperCase()
  );

  return fallbackExists ? defaultFallback : availableManagedClients[0].clientId;
}
