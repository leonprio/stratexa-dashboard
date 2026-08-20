import { ManagedClient } from '../types';

export type ReconciliationStatus = 'resolved' | 'not_ready' | 'ambiguous' | 'unresolved';

export interface ReconciliationResult {
  status: ReconciliationStatus;
  clientId?: string;
  reason?: string;
}

export interface ClientReconciliationInput {
  selectedClientId: string;
  availableManagedClients: ManagedClient[];
  defaultFallback?: string;
}

/**
 * Reconcilia la selección de cliente activa contra la lista oficial de clientes gestionados.
 * 
 * Contrato de Reconciliación:
 * CASE A — EXACT TECHNICAL ID: Coincidencia exacta con ManagedClient.clientId -> status: 'resolved'
 * CASE B — UNIQUE EXACT DISPLAY NAME: Coincidencia exacta con único ManagedClient.displayName -> status: 'resolved'
 * CASE C — AMBIGUOUS DISPLAY NAME: Múltiples clientes con exactamente el mismo displayName -> status: 'ambiguous' (sin adivinar)
 * CASE D — UNKNOWN / EMPTY PERSISTED VALUE:
 *          - Si defaultFallback existe en managedClients -> status: 'resolved' (con fallback)
 *          - Si defaultFallback no existe y hay exactamente 1 cliente -> status: 'resolved' (único cliente)
 *          - Si defaultFallback no existe y hay >1 cliente -> status: 'unresolved'
 * CASE E — MANAGED CLIENTS NOT YET LOADED: availableManagedClients es undefined o vacío -> status: 'not_ready'
 */
export function reconcileClientSelectionResult({
  selectedClientId,
  availableManagedClients,
  defaultFallback
}: ClientReconciliationInput): ReconciliationResult {
  // CASE E: Managed clients not yet loaded
  if (!availableManagedClients || availableManagedClients.length === 0) {
    return {
      status: 'not_ready',
      reason: 'Managed clients list is empty or not yet loaded.'
    };
  }

  // Opciones especiales del sistema que no se modifican y son siempre válidas
  if (selectedClientId === 'all' || selectedClientId === 'NEW_CLIENT_OPTION') {
    return {
      status: 'resolved',
      clientId: selectedClientId,
      reason: 'System special option.'
    };
  }

  // CASE A: Coincidencia exacta de string con ManagedClient.clientId
  const exactTechnicalMatch = availableManagedClients.find(
    c => c.clientId === selectedClientId
  );
  if (exactTechnicalMatch) {
    return {
      status: 'resolved',
      clientId: exactTechnicalMatch.clientId,
      reason: 'Exact technical clientId match.'
    };
  }

  // CASE B / C: Coincidencia exacta de string con ManagedClient.displayName
  if (selectedClientId) {
    const exactDisplayNameMatches = availableManagedClients.filter(
      c => c.displayName === selectedClientId
    );

    if (exactDisplayNameMatches.length === 1) {
      return {
        status: 'resolved',
        clientId: exactDisplayNameMatches[0].clientId,
        reason: 'Unique exact displayName match.'
      };
    }

    if (exactDisplayNameMatches.length > 1) {
      return {
        status: 'ambiguous',
        reason: `Multiple clients found with exact displayName "${selectedClientId}".`
      };
    }
  }

  // CASE D: Persisted selection empty, unknown, or no exact match
  if (defaultFallback) {
    const fallbackMatch = availableManagedClients.find(
      c => c.clientId === defaultFallback
    );
    if (fallbackMatch) {
      return {
        status: 'resolved',
        clientId: fallbackMatch.clientId,
        reason: 'Resolved to valid defaultFallback technical clientId.'
      };
    }
  }

  // Si no hay fallback válido, resolver solo si hay exactamente 1 cliente gestionado
  if (availableManagedClients.length === 1) {
    return {
      status: 'resolved',
      clientId: availableManagedClients[0].clientId,
      reason: 'Single managed client available.'
    };
  }

  return {
    status: 'unresolved',
    reason: `Selection "${selectedClientId}" is non-existent and cannot be resolved safely.`
  };
}

/**
 * Función legacy/helper que retorna directamente el string resuelto o NOT_READY / UNRESOLVED / AMBIGUOUS
 */
export function reconcileClientSelection(input: ClientReconciliationInput): string {
  const result = reconcileClientSelectionResult(input);
  if (result.status === 'resolved' && result.clientId) {
    return result.clientId;
  }
  if (result.status === 'not_ready') {
    return input.selectedClientId;
  }
  return result.status.toUpperCase();
}
