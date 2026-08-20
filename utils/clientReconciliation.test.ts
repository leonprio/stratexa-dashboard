import { reconcileClientSelection, reconcileClientSelectionResult } from './clientReconciliation';
import { ManagedClient } from '../types';

describe('clientReconciliation — Audit Specification Unit Tests (v9.5.3)', () => {
  const sampleManagedClients: ManagedClient[] = [
    { clientId: 'IPS_DIRECCION', displayName: 'IPS DIRECCIÓN' },
    { clientId: 'CEMENTOS_SIGMA', displayName: 'CEMENTOS SIGMA' },
    { clientId: 'COMISIONES_TEMATICAS', displayName: 'COMISIONES TEMÁTICAS' },
    { clientId: 'FONDA_CARMELA', displayName: 'FONDA CARMELA' },
    { clientId: 'RED_CROP', displayName: 'RED CROP +' },
    { clientId: 'LVP', displayName: 'LVP' },
    { clientId: 'IPS', displayName: 'IPS' },
    { clientId: 'REGIONES', displayName: 'REGIONES' },
    { clientId: 'WELOVE', displayName: 'WELOVE' }
  ];

  it('1. EXACT technical ID remains unchanged', () => {
    const result = reconcileClientSelectionResult({
      selectedClientId: 'IPS_DIRECCION',
      availableManagedClients: sampleManagedClients
    });
    expect(result.status).toBe('resolved');
    expect(result.clientId).toBe('IPS_DIRECCION');
  });

  it('2. EXACT unique displayName "IPS DIRECCIÓN" resolves to "IPS_DIRECCION"', () => {
    const result = reconcileClientSelectionResult({
      selectedClientId: 'IPS DIRECCIÓN',
      availableManagedClients: sampleManagedClients
    });
    expect(result.status).toBe('resolved');
    expect(result.clientId).toBe('IPS_DIRECCION');
  });

  it('3. Case/whitespace variant does NOT match if not exact string equality', () => {
    const result = reconcileClientSelectionResult({
      selectedClientId: 'ips dirección ',
      availableManagedClients: sampleManagedClients
    });
    expect(result.status).toBe('unresolved');
    expect(result.clientId).toBeUndefined();
  });

  it('4. Duplicate exact displayName returns ambiguous status, never first tenant', () => {
    const ambiguousClients: ManagedClient[] = [
      { clientId: 'CLIENT_A_1', displayName: 'DUPLICATED' },
      { clientId: 'CLIENT_A_2', displayName: 'DUPLICATED' }
    ];
    const result = reconcileClientSelectionResult({
      selectedClientId: 'DUPLICATED',
      availableManagedClients: ambiguousClients
    });
    expect(result.status).toBe('ambiguous');
    expect(result.clientId).toBeUndefined();
  });

  it('5. Empty persisted selection + valid fallback: fallback returned only if fallback exists', () => {
    const result = reconcileClientSelectionResult({
      selectedClientId: '',
      availableManagedClients: sampleManagedClients,
      defaultFallback: 'IPS'
    });
    expect(result.status).toBe('resolved');
    expect(result.clientId).toBe('IPS');
  });

  it('6. Empty persisted selection + nonexistent fallback + one client: real client resolves', () => {
    const singleClient: ManagedClient[] = [
      { clientId: 'SOLE_CLIENT', displayName: 'Sole Client' }
    ];
    const result = reconcileClientSelectionResult({
      selectedClientId: '',
      availableManagedClients: singleClient,
      defaultFallback: 'NON_EXISTENT_FALLBACK'
    });
    expect(result.status).toBe('resolved');
    expect(result.clientId).toBe('SOLE_CLIENT');
  });

  it('7. Empty/unknown persisted selection + nonexistent fallback + multiple clients: unresolved, never nonexistent IPS, never arbitrary first', () => {
    const multipleClients: ManagedClient[] = [
      { clientId: 'CLIENT_A', displayName: 'Client A' },
      { clientId: 'CLIENT_B', displayName: 'Client B' }
    ];
    const result = reconcileClientSelectionResult({
      selectedClientId: 'UNKNOWN_OR_EMPTY',
      availableManagedClients: multipleClients,
      defaultFallback: 'NON_EXISTENT_FALLBACK'
    });
    expect(result.status).toBe('unresolved');
    expect(result.clientId).toBeUndefined();
    expect(reconcileClientSelection({
      selectedClientId: 'UNKNOWN_OR_EMPTY',
      availableManagedClients: multipleClients,
      defaultFallback: 'NON_EXISTENT_FALLBACK'
    })).toBe('UNRESOLVED');
  });

  it('8. Empty managed-client list: NOT_READY status, no reconciliation', () => {
    const result = reconcileClientSelectionResult({
      selectedClientId: 'IPS DIRECCIÓN',
      availableManagedClients: []
    });
    expect(result.status).toBe('not_ready');
    expect(result.clientId).toBeUndefined();

    expect(reconcileClientSelection({
      selectedClientId: 'IPS DIRECCIÓN',
      availableManagedClients: []
    })).toBe('IPS DIRECCIÓN');
  });

  it('15. Five migrated clients still resolve generically', () => {
    const migratedCases = [
      { legacy: 'CEMENTOS SIGMA', expected: 'CEMENTOS_SIGMA' },
      { legacy: 'COMISIONES TEMÁTICAS', expected: 'COMISIONES_TEMATICAS' },
      { legacy: 'FONDA CARMELA', expected: 'FONDA_CARMELA' },
      { legacy: 'IPS DIRECCIÓN', expected: 'IPS_DIRECCION' },
      { legacy: 'RED CROP +', expected: 'RED_CROP' }
    ];

    migratedCases.forEach(({ legacy, expected }) => {
      const res = reconcileClientSelectionResult({
        selectedClientId: legacy,
        availableManagedClients: sampleManagedClients
      });
      expect(res.status).toBe('resolved');
      expect(res.clientId).toBe(expected);
    });
  });

  it('16. LVP / IPS / REGIONES / WELOVE remain unchanged', () => {
    const safeClients = ['LVP', 'IPS', 'REGIONES', 'WELOVE'];
    safeClients.forEach(sc => {
      const res = reconcileClientSelectionResult({
        selectedClientId: sc,
        availableManagedClients: sampleManagedClients
      });
      expect(res.status).toBe('resolved');
      expect(res.clientId).toBe(sc);
    });
  });
});
