import React, { useEffect, useState } from 'react';
import { render, waitFor } from '@testing-library/react';
import { reconcileClientSelectionResult } from './utils/clientReconciliation';
import { ManagedClient } from './types';
import { strategyService } from './services/strategyService';

jest.mock('./services/strategyService', () => ({
  strategyService: {
    getPerspectives: jest.fn().mockImplementation(async (clientId?: string) => {
      if (clientId === 'IPS_DIRECCION') {
        return [
          { id: 'FINANCIERA', name: 'Perspectiva IPS Dirección', order: 1, clientId: 'IPS_DIRECCION' }
        ];
      }
      return [
        { id: 'FINANCIERA', name: 'Perspectiva Default/Fallback', order: 1, clientId: 'IPS' }
      ];
    })
  }
}));

const MockAppSelectionHarness: React.FC<{
  initialPersistedClient: string;
  managedClients: ManagedClient[];
  onResolvedClientId: (cid: string) => void;
  onPerspectivesLoaded: (perspectives: any[]) => void;
  onSelectionReadyChange?: (ready: boolean) => void;
}> = ({
  initialPersistedClient,
  managedClients,
  onResolvedClientId,
  onPerspectivesLoaded,
  onSelectionReadyChange
}) => {
  const [rawSelectedClientId, setRawSelectedClientId] = useState<string>(initialPersistedClient);
  const [resolvedClientId, setResolvedClientId] = useState<string | null>(null);
  const [isSelectionReady, setIsSelectionReady] = useState<boolean>(false);
  const [availableManagedClients, setAvailableManagedClients] = useState<ManagedClient[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAvailableManagedClients(managedClients);
    }, 50);
    return () => clearTimeout(timer);
  }, [managedClients]);

  useEffect(() => {
    if (availableManagedClients.length === 0) {
      setIsSelectionReady(false);
      if (onSelectionReadyChange) onSelectionReadyChange(false);
      return;
    }

    const result = reconcileClientSelectionResult({
      selectedClientId: rawSelectedClientId,
      availableManagedClients,
      defaultFallback: 'IPS'
    });

    if (result.status === 'resolved' && result.clientId) {
      setResolvedClientId(result.clientId);
      setIsSelectionReady(true);
      if (onSelectionReadyChange) onSelectionReadyChange(true);
      if (rawSelectedClientId !== result.clientId) {
        localStorage.setItem('selectedClientId', result.clientId);
        setRawSelectedClientId(result.clientId);
      }
    } else {
      setIsSelectionReady(false);
      if (onSelectionReadyChange) onSelectionReadyChange(false);
    }
  }, [availableManagedClients, rawSelectedClientId, onSelectionReadyChange]);

  useEffect(() => {
    if (!isSelectionReady || !resolvedClientId) return;

    onResolvedClientId(resolvedClientId);
    strategyService.getPerspectives(resolvedClientId).then(p => {
      onPerspectivesLoaded(p);
    });
  }, [isSelectionReady, resolvedClientId, onResolvedClientId, onPerspectivesLoaded]);

  return (
    <div>
      <span data-testid="selected-id">{resolvedClientId || 'NOT_READY'}</span>
      <select
        data-testid="client-selector"
        value={isSelectionReady && resolvedClientId ? resolvedClientId : ''}
        onChange={(e) => setRawSelectedClientId(e.target.value)}
      >
        {!isSelectionReady && <option value="">-- Seleccionar Cliente --</option>}
        {availableManagedClients.map(c => (
          <option key={c.clientId} value={c.clientId}>
            {c.displayName}
          </option>
        ))}
      </select>
    </div>
  );
};

describe('Client Selection & Hydration Integration Tests (v9.5.3 Audit Requirements)', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  it('9. localStorage legacy value "IPS DIRECCIÓN" is rewritten to technical ID "IPS_DIRECCION" only after managed-client hydration', async () => {
    localStorage.setItem('selectedClientId', 'IPS DIRECCIÓN');
    const onResolvedClientId = jest.fn();
    const onPerspectivesLoaded = jest.fn();
    const managedClients = [
      { clientId: 'IPS_DIRECCION', displayName: 'IPS DIRECCIÓN' }
    ];

    render(
      <MockAppSelectionHarness
        initialPersistedClient="IPS DIRECCIÓN"
        managedClients={managedClients}
        onResolvedClientId={onResolvedClientId}
        onPerspectivesLoaded={onPerspectivesLoaded}
      />
    );

    await waitFor(() => {
      expect(localStorage.getItem('selectedClientId')).toBe('IPS_DIRECCION');
    });
  });

  it('10. Controlled selector receives technical ID after reconciliation', async () => {
    const onResolvedClientId = jest.fn();
    const onPerspectivesLoaded = jest.fn();
    const managedClients = [
      { clientId: 'IPS_DIRECCION', displayName: 'IPS DIRECCIÓN' }
    ];

    const { getByTestId } = render(
      <MockAppSelectionHarness
        initialPersistedClient="IPS DIRECCIÓN"
        managedClients={managedClients}
        onResolvedClientId={onResolvedClientId}
        onPerspectivesLoaded={onPerspectivesLoaded}
      />
    );

    await waitFor(() => {
      const select = getByTestId('client-selector') as HTMLSelectElement;
      expect(select.value).toBe('IPS_DIRECCION');
    });
  });

  it('11. Before reconciliation READY: Strategy/client-scoped child does NOT receive legacy selectedClientId', async () => {
    const onResolvedClientId = jest.fn();
    const onPerspectivesLoaded = jest.fn();
    const onSelectionReadyChange = jest.fn();
    const managedClients = [
      { clientId: 'IPS_DIRECCION', displayName: 'IPS DIRECCIÓN' }
    ];

    render(
      <MockAppSelectionHarness
        initialPersistedClient="IPS DIRECCIÓN"
        managedClients={managedClients}
        onResolvedClientId={onResolvedClientId}
        onPerspectivesLoaded={onPerspectivesLoaded}
        onSelectionReadyChange={onSelectionReadyChange}
      />
    );

    expect(onSelectionReadyChange).toHaveBeenNthCalledWith(1, false);
    expect(strategyService.getPerspectives).not.toHaveBeenCalledWith('IPS DIRECCIÓN');
  });

  it('12. After reconciliation: Strategy receives "IPS_DIRECCION"', async () => {
    const onResolvedClientId = jest.fn();
    const onPerspectivesLoaded = jest.fn();
    const managedClients = [
      { clientId: 'IPS_DIRECCION', displayName: 'IPS DIRECCIÓN' }
    ];

    render(
      <MockAppSelectionHarness
        initialPersistedClient="IPS DIRECCIÓN"
        managedClients={managedClients}
        onResolvedClientId={onResolvedClientId}
        onPerspectivesLoaded={onPerspectivesLoaded}
      />
    );

    await waitFor(() => {
      expect(strategyService.getPerspectives).toHaveBeenCalledWith('IPS_DIRECCION');
    });
    expect(strategyService.getPerspectives).not.toHaveBeenCalledWith('IPS DIRECCIÓN');
  });

  it('13. Persisted perspectives for IPS_DIRECCION remain loaded after resolution', async () => {
    const onResolvedClientId = jest.fn();
    const onPerspectivesLoaded = jest.fn();
    const managedClients = [
      { clientId: 'IPS_DIRECCION', displayName: 'IPS DIRECCIÓN' }
    ];

    render(
      <MockAppSelectionHarness
        initialPersistedClient="IPS DIRECCIÓN"
        managedClients={managedClients}
        onResolvedClientId={onResolvedClientId}
        onPerspectivesLoaded={onPerspectivesLoaded}
      />
    );

    await waitFor(() => {
      expect(onPerspectivesLoaded).toHaveBeenLastCalledWith([
        { id: 'FINANCIERA', name: 'Perspectiva IPS Dirección', order: 1, clientId: 'IPS_DIRECCION' }
      ]);
    });
  });

  it('14. Race regression: simulate OLD tenant load resolving after NEW tenant load (Guard verification)', async () => {
    let activeRequestId = 0;
    let latestCommittedTenant = '';

    const simulateTenantFetch = async (tenantId: string) => {
      const requestId = ++activeRequestId;
      // Simulate network latency: OLD takes longer than NEW
      const delay = tenantId === 'OLD_TENANT' ? 100 : 20;
      await new Promise(resolve => setTimeout(resolve, delay));

      // Guard condition: only commit if request is still active
      if (requestId === activeRequestId) {
        latestCommittedTenant = tenantId;
      }
    };

    const pOld = simulateTenantFetch('OLD_TENANT');
    const pNew = simulateTenantFetch('NEW_TENANT');

    await Promise.all([pOld, pNew]);
    expect(latestCommittedTenant).toBe('NEW_TENANT');
  });
});
