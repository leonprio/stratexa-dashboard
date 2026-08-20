import { reconcileClientSelection } from './clientReconciliation';
import { ManagedClient } from '../types';

describe('clientReconciliation — Unit Tests (v9.5.3)', () => {
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

  it('1. reconciles legacy displayName "IPS DIRECCIÓN" to technical clientId "IPS_DIRECCION"', () => {
    const result = reconcileClientSelection({
      selectedClientId: 'IPS DIRECCIÓN',
      availableManagedClients: sampleManagedClients
    });
    expect(result).toBe('IPS_DIRECCION');
  });

  it('2. leaves canonical technical clientId "IPS_DIRECCION" unchanged', () => {
    const result = reconcileClientSelection({
      selectedClientId: 'IPS_DIRECCION',
      availableManagedClients: sampleManagedClients
    });
    expect(result).toBe('IPS_DIRECCION');
  });

  it('3. reconciles all five migrated display names generically to technical clientIds', () => {
    const migratedCases = [
      { legacy: 'CEMENTOS SIGMA', expected: 'CEMENTOS_SIGMA' },
      { legacy: 'COMISIONES TEMÁTICAS', expected: 'COMISIONES_TEMATICAS' },
      { legacy: 'FONDA CARMELA', expected: 'FONDA_CARMELA' },
      { legacy: 'IPS DIRECCIÓN', expected: 'IPS_DIRECCION' },
      { legacy: 'RED CROP +', expected: 'RED_CROP' }
    ];

    migratedCases.forEach(({ legacy, expected }) => {
      const res = reconcileClientSelection({
        selectedClientId: legacy,
        availableManagedClients: sampleManagedClients
      });
      expect(res).toBe(expected);
    });
  });

  it('4. assigns safe fallback (IPS) for an unknown/stale client ID', () => {
    const result = reconcileClientSelection({
      selectedClientId: 'UNKNOWN_STALE_ID_999',
      availableManagedClients: sampleManagedClients,
      defaultFallback: 'IPS'
    });
    expect(result).toBe('IPS');
  });

  it('5. avoids guessing and uses safe fallback when displayName is ambiguous', () => {
    const ambiguousClients: ManagedClient[] = [
      { clientId: 'CLIENT_A_1', displayName: 'DUPLICATED NAME' },
      { clientId: 'CLIENT_A_2', displayName: 'DUPLICATED NAME' }
    ];
    const result = reconcileClientSelection({
      selectedClientId: 'DUPLICATED NAME',
      availableManagedClients: ambiguousClients,
      defaultFallback: 'CLIENT_A_1'
    });
    expect(result).toBe('CLIENT_A_1');
  });

  it('6. prevents premature reconciliation when managed clients list is empty (race protection)', () => {
    const result = reconcileClientSelection({
      selectedClientId: 'IPS DIRECCIÓN',
      availableManagedClients: []
    });
    expect(result).toBe('IPS DIRECCIÓN');
  });

  it('7. preserves existing safe legacy clients (LVP, IPS, REGIONES, WELOVE) unchanged', () => {
    const safeClients = ['LVP', 'IPS', 'REGIONES', 'WELOVE'];
    safeClients.forEach(sc => {
      const res = reconcileClientSelection({
        selectedClientId: sc,
        availableManagedClients: sampleManagedClients
      });
      expect(res).toBe(sc);
    });
  });

  it('8. preserves system options "all" and "NEW_CLIENT_OPTION" unchanged', () => {
    expect(reconcileClientSelection({
      selectedClientId: 'all',
      availableManagedClients: sampleManagedClients
    })).toBe('all');

    expect(reconcileClientSelection({
      selectedClientId: 'NEW_CLIENT_OPTION',
      availableManagedClients: sampleManagedClients
    })).toBe('NEW_CLIENT_OPTION');
  });
});
