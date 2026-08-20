import React, { useEffect, useState } from 'react';
import { render, act, waitFor } from '@testing-library/react';
import { reconcileClientSelection } from './utils/clientReconciliation';
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

// Mock component simulating the App hydration sequence
const MockAppSelectionHarness: React.FC<{
  initialPersistedClient: string;
  managedClients: ManagedClient[];
  onResolvedClientId: (cid: string) => void;
  onPerspectivesLoaded: (perspectives: any[]) => void;
}> = ({ initialPersistedClient, managedClients, onResolvedClientId, onPerspectivesLoaded }) => {
  const [selectedClientId, setSelectedClientId] = useState<string>(initialPersistedClient);
  const [availableManagedClients, setAvailableManagedClients] = useState<ManagedClient[]>([]);

  // Hydrate managed clients after mount (simulates async fetch)
  useEffect(() => {
    const timer = setTimeout(() => {
      setAvailableManagedClients(managedClients);
    }, 50);
    return () => clearTimeout(timer);
  }, [managedClients]);

  // Client reconciliation effect
  useEffect(() => {
    if (availableManagedClients.length === 0) return;

    const reconciled = reconcileClientSelection({
      selectedClientId,
      availableManagedClients,
      defaultFallback: 'IPS'
    });

    if (reconciled !== selectedClientId) {
      setSelectedClientId(reconciled);
    }
  }, [availableManagedClients, selectedClientId]);

  // Load Strategy data effect
  useEffect(() => {
    onResolvedClientId(selectedClientId);
    strategyService.getPerspectives(selectedClientId).then(p => {
      onPerspectivesLoaded(p);
    });
  }, [selectedClientId, onResolvedClientId, onPerspectivesLoaded]);

  return (
    <div>
      <span data-testid="selected-id">{selectedClientId}</span>
    </div>
  );
};

describe('Client Selection Strategy Integration (v9.5.3)', () => {
  it('reconciles legacy "IPS DIRECCIÓN" to "IPS_DIRECCION" and loads tenant perspectives', async () => {
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

    // After hydration and reconciliation
    await waitFor(() => {
      expect(onResolvedClientId).toHaveBeenLastCalledWith('IPS_DIRECCION');
    });

    await waitFor(() => {
      expect(onPerspectivesLoaded).toHaveBeenLastCalledWith([
        { id: 'FINANCIERA', name: 'Perspectiva IPS Dirección', order: 1, clientId: 'IPS_DIRECCION' }
      ]);
    });

    expect(strategyService.getPerspectives).toHaveBeenCalledWith('IPS_DIRECCION');
    expect(strategyService.getPerspectives).not.toHaveBeenLastCalledWith('IPS DIRECCIÓN');
  });
});
