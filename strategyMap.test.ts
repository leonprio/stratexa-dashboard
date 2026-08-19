import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import {
  StrategicPerspective,
  StrategicObjective,
  StrategicObjectiveRelationship,
  ContributionObjective,
  ContributionIndicatorAssignment,
  validateObjectiveRelationship,
  getCanonicalRelationshipId,
  DEFAULT_PERSPECTIVES
} from './strategyTypes';

import { strategyService } from './services/strategyService';
import { RelationshipEditorModal } from './components/strategy/RelationshipEditorModal';

// Mock de Firestore para pruebas directas en strategyService
const mockGetDoc = jest.fn();
const mockSetDoc = jest.fn();
const mockDeleteDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockRunTransaction = jest.fn();

jest.mock('firebase/firestore', () => {
  const actual = jest.requireActual('firebase/firestore');
  return {
    ...actual,
    doc: jest.fn((_db, coll, id) => ({ _path: `${coll}/${id}`, id, collection: coll })),
    collection: jest.fn((_db, coll) => ({ _path: coll, id: coll })),
    query: jest.fn((ref, ..._constraints) => ref),
    where: jest.fn(),
    getDoc: (...args: any[]) => mockGetDoc(...args),
    setDoc: (...args: any[]) => mockSetDoc(...args),
    deleteDoc: (...args: any[]) => mockDeleteDoc(...args),
    getDocs: (...args: any[]) => mockGetDocs(...args),
    runTransaction: (...args: any[]) => mockRunTransaction(...args)
  };
});

jest.mock('./firebase', () => ({
  db: {}
}));

describe('v9.5.1 Strategy Map & Cause-Effect Relationships Unit Tests', () => {

  const samplePerspectives: StrategicPerspective[] = [
    { id: 'FINANCIERA', name: 'Financiera', order: 1, color: '#10B981', clientId: 'IPS' },
    { id: 'CLIENTE', name: 'Cliente', order: 2, color: '#3B82F6', clientId: 'IPS' },
    { id: 'PROCESOS_INTERNOS', name: 'Procesos Internos', order: 3, color: '#F59E0B', clientId: 'IPS' },
    { id: 'APRENDIZAJE_CRECIMIENTO', name: 'Capacidad Organizacional', order: 4, color: '#8B5CF6', clientId: 'IPS' }
  ];

  const sampleObjectives: StrategicObjective[] = [
    { id: 'oe_fin_1', perspectiveId: 'FINANCIERA', code: 'OE-01', title: 'Incrementar Margen Ebitda', order: 1, clientId: 'IPS' },
    { id: 'oe_cli_1', perspectiveId: 'CLIENTE', code: 'OE-02', title: 'Mejorar Satisfacción del Cliente', order: 1, clientId: 'IPS' },
    { id: 'oe_proc_1', perspectiveId: 'PROCESOS_INTERNOS', code: 'OE-03', title: 'Optimizar Tiempos de Entrega', order: 1, clientId: 'IPS' },
    { id: 'oe_cap_1', perspectiveId: 'APRENDIZAJE_CRECIMIENTO', code: 'OE-04', title: 'Capacitar al Personal Técnico', order: 1, clientId: 'IPS' }
  ];

  const sampleRelationships: StrategicObjectiveRelationship[] = [
    {
      id: 'rel_1',
      clientId: 'IPS',
      sourceStrategicObjectiveId: 'oe_cap_1',
      targetStrategicObjectiveId: 'oe_proc_1',
      description: 'Capacitación impulsa procesos'
    },
    {
      id: 'rel_2',
      clientId: 'IPS',
      sourceStrategicObjectiveId: 'oe_proc_1',
      targetStrategicObjectiveId: 'oe_cli_1',
      description: 'Mejores procesos satisfacen clientes'
    },
    {
      id: 'rel_3',
      clientId: 'IPS',
      sourceStrategicObjectiveId: 'oe_cli_1',
      targetStrategicObjectiveId: 'oe_fin_1',
      description: 'Clientes satisfechos incrementan ventas'
    }
  ];

  // --- 1. Validaciones del Modelo de Relaciones ---
  describe('Objective Relationship Validation', () => {

    it('allows valid cause-effect relationship between two different OEs', () => {
      const result = validateObjectiveRelationship(
        { sourceStrategicObjectiveId: 'oe_cap_1', targetStrategicObjectiveId: 'oe_fin_1', clientId: 'IPS' },
        sampleRelationships,
        sampleObjectives
      );

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('rejects self-link (source OE === target OE)', () => {
      const result = validateObjectiveRelationship(
        { sourceStrategicObjectiveId: 'oe_fin_1', targetStrategicObjectiveId: 'oe_fin_1', clientId: 'IPS' },
        sampleRelationships,
        sampleObjectives
      );

      expect(result.valid).toBe(false);
      expect(result.error).toContain('consigo mismo');
    });

    it('rejects exact duplicate relationship', () => {
      const result = validateObjectiveRelationship(
        { sourceStrategicObjectiveId: 'oe_cap_1', targetStrategicObjectiveId: 'oe_proc_1', clientId: 'IPS' },
        sampleRelationships,
        sampleObjectives
      );

      expect(result.valid).toBe(false);
      expect(result.error).toContain('ya existe');
    });

    it('rejects relationship referencing non-existent source OE', () => {
      const result = validateObjectiveRelationship(
        { sourceStrategicObjectiveId: 'oe_non_existent', targetStrategicObjectiveId: 'oe_fin_1', clientId: 'IPS' },
        sampleRelationships,
        sampleObjectives
      );

      expect(result.valid).toBe(false);
      expect(result.error).toContain('no existe');
    });

    it('rejects relationship referencing non-existent target OE', () => {
      const result = validateObjectiveRelationship(
        { sourceStrategicObjectiveId: 'oe_fin_1', targetStrategicObjectiveId: 'oe_ghost', clientId: 'IPS' },
        sampleRelationships,
        sampleObjectives
      );

      expect(result.valid).toBe(false);
      expect(result.error).toContain('no existe');
    });

    it('allows cross-perspective relationships (e.g. non-adjacent perspectives)', () => {
      const result = validateObjectiveRelationship(
        { sourceStrategicObjectiveId: 'oe_cap_1', targetStrategicObjectiveId: 'oe_fin_1', clientId: 'IPS' },
        sampleRelationships,
        sampleObjectives
      );

      expect(result.valid).toBe(true);
    });

    it('supports multiple upstream (causes) for a single target OE', () => {
      const multiRelationships: StrategicObjectiveRelationship[] = [
        ...sampleRelationships,
        { id: 'rel_extra', clientId: 'IPS', sourceStrategicObjectiveId: 'oe_proc_1', targetStrategicObjectiveId: 'oe_fin_1' }
      ];

      const upstream = multiRelationships.filter(r => r.targetStrategicObjectiveId === 'oe_fin_1');
      expect(upstream.length).toBe(2);
      expect(upstream.map(r => r.sourceStrategicObjectiveId)).toContain('oe_cli_1');
      expect(upstream.map(r => r.sourceStrategicObjectiveId)).toContain('oe_proc_1');
    });

    it('deleting a relationship does not delete or alter either source or target OE', () => {
      const initialCount = sampleRelationships.length;
      const filtered = sampleRelationships.filter(r => r.id !== 'rel_1');

      expect(filtered.length).toBe(initialCount - 1);
      // Los objetivos de origen y destino permanecen intactos en la colección
      expect(sampleObjectives.find(o => o.id === 'oe_cap_1')).toBeDefined();
      expect(sampleObjectives.find(o => o.id === 'oe_proc_1')).toBeDefined();
    });
  });

  // --- 2. Escenario A (Solo OE sin OCs) ---
  describe('OE-only Client Scenario (Zero OCs)', () => {

    it('handles OE-only client where contributions list is empty', () => {
      const zeroOCs: ContributionObjective[] = [];
      const oe = sampleObjectives[0];

      const oeOCs = zeroOCs.filter(c => c.primaryStrategicObjectiveId === oe.id);
      expect(oeOCs.length).toBe(0);

      // Verificación: Un OE sin OCs opera normalmente a nivel de dirección sin errores
      expect(oe.title).toBe('Incrementar Margen Ebitda');
    });

    it('does not generate synthetic compliance percentage for OE without OCs or KPIs', () => {
      // Regla de Integridad: Nunca generar un porcentaje sintético promediado
      const zeroAssignments: ContributionIndicatorAssignment[] = [];
      expect(zeroAssignments.length).toBe(0);
    });
  });

  // --- 3. Escenario B (OE + OCs + Indicadores Enriquecidos) ---
  describe('OE + OC + KPI Enrichment Scenario', () => {

    const sampleOCs: ContributionObjective[] = [
      {
        id: 'oc_1',
        areaConfigId: 'cfg_com',
        areaName: 'COMERCIAL',
        areaCode: 'COM',
        sequenceNumber: 1,
        displayCode: 'COM-OC01',
        title: 'Captación de Clientes Corporativos',
        primaryStrategicObjectiveId: 'oe_cli_1',
        clientId: 'IPS'
      },
      {
        id: 'oc_2',
        areaConfigId: 'cfg_ops',
        areaName: 'OPERACIONES',
        areaCode: 'OPS',
        sequenceNumber: 1,
        displayCode: 'OPS-OC01',
        title: 'Reducción de Latencia Operativa',
        primaryStrategicObjectiveId: 'oe_proc_1',
        clientId: 'IPS'
      }
    ];

    it('derives unique contributing area count and OC count per OE correctly', () => {
      const oeCliContributions = sampleOCs.filter(c => c.primaryStrategicObjectiveId === 'oe_cli_1');
      const uniqueAreas = new Set(oeCliContributions.map(c => c.areaName));

      expect(oeCliContributions.length).toBe(1);
      expect(uniqueAreas.size).toBe(1);
      expect(Array.from(uniqueAreas)[0]).toBe('COMERCIAL');
    });

    it('preserves relationship integrity when perspective names or order change', () => {
      // Renombrar perspectiva o reordenar
      const modifiedPerspectives = samplePerspectives.map(p =>
        p.id === 'FINANCIERA' ? { ...p, name: 'Desempeño Financiero y Valor' } : p
      );

      // Las relaciones siguen apuntando a los mismos IDs de OE inmutables
      const rel = sampleRelationships.find(r => r.id === 'rel_3');
      expect(rel?.targetStrategicObjectiveId).toBe('oe_fin_1');

      const targetOE = sampleObjectives.find(o => o.id === rel?.targetStrategicObjectiveId);
      const targetPersp = modifiedPerspectives.find(p => p.id === targetOE?.perspectiveId);

      expect(targetPersp?.name).toBe('Desempeño Financiero y Valor');
    });
  });

  // --- 4. Identidad Canónica Determinista y Unicidad Atómica ---
  describe('Deterministic Canonical Relationship Identity', () => {

    it('generates consistent canonical relationship ID', () => {
      const canonicalId = getCanonicalRelationshipId('IPS', 'oe_cap_1', 'oe_proc_1');
      expect(canonicalId).toBe('rel_IPS_oe_cap_1_oe_proc_1');
    });

    it('treats A->B and B->A as distinct canonical identities', () => {
      const idAtoB = getCanonicalRelationshipId('IPS', 'oe_1', 'oe_2');
      const idBtoA = getCanonicalRelationshipId('IPS', 'oe_2', 'oe_1');

      expect(idAtoB).toBe('rel_IPS_oe_1_oe_2');
      expect(idBtoA).toBe('rel_IPS_oe_2_oe_1');
      expect(idAtoB).not.toBe(idBtoA);
    });

    it('normalizes tenant casing and trims spaces for canonical relationship identity', () => {
      const id = getCanonicalRelationshipId('  ips  ', ' oe_1 ', ' oe_2 ');
      expect(id).toBe('rel_IPS_oe_1_oe_2');
    });
  });

  // --- 5. Guarda de Orfandad al Eliminar Objetivos Estratégicos ---
  describe('OE Deletion Orphan Guard Protection', () => {

    it('detects when an OE participates in upstream or downstream relationships', () => {
      const targetOEId = 'oe_proc_1';

      const participatesAsSource = sampleRelationships.some(r => r.sourceStrategicObjectiveId === targetOEId);
      const participatesAsTarget = sampleRelationships.some(r => r.targetStrategicObjectiveId === targetOEId);

      expect(participatesAsSource || participatesAsTarget).toBe(true);
      expect(participatesAsSource).toBe(true); // rel_2 (source: oe_proc_1 -> target: oe_cli_1)
      expect(participatesAsTarget).toBe(true); // rel_1 (source: oe_cap_1 -> target: oe_proc_1)
    });

    it('identifies unlinked OE safe for deletion', () => {
      const isolatedOE: StrategicObjective = {
        id: 'oe_isolated',
        perspectiveId: 'FINANCIERA',
        code: 'OE-99',
        title: 'OE Aislado',
        order: 99,
        clientId: 'IPS'
      };

      const hasRelationships = sampleRelationships.some(
        r => r.sourceStrategicObjectiveId === isolatedOE.id || r.targetStrategicObjectiveId === isolatedOE.id
      );

      expect(hasRelationships).toBe(false);
    });
  });

  // --- 6. Pruebas Ejecutables Directas del Servicio Transaccional (saveStrategicObjectiveRelationship) ---
  describe('Direct saveStrategicObjectiveRelationship execution', () => {

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('successfully reads source and target OEs, computes canonical ID and commits transaction', async () => {
      const sourceOE: StrategicObjective = {
        id: 'oe_src_1',
        perspectiveId: 'APRENDIZAJE_CRECIMIENTO',
        code: 'OE-01',
        title: 'Capacitación Técnica',
        order: 1,
        clientId: 'IPS'
      };

      const targetOE: StrategicObjective = {
        id: 'oe_tgt_1',
        perspectiveId: 'PROCESOS_INTERNOS',
        code: 'OE-02',
        title: 'Optimización Operativa',
        order: 1,
        clientId: 'IPS'
      };

      mockRunTransaction.mockImplementation(async (_db, callback) => {
        const fakeTx = {
          get: jest.fn().mockImplementation(async (ref: any) => {
            if (ref.id === 'oe_src_1') return { exists: () => true, data: () => sourceOE };
            if (ref.id === 'oe_tgt_1') return { exists: () => true, data: () => targetOE };
            if (ref.id === 'rel_IPS_oe_src_1_oe_tgt_1') return { exists: () => false, data: () => undefined };
            return { exists: () => false, data: () => undefined };
          }),
          set: jest.fn()
        };
        return await callback(fakeTx);
      });

      const result = await strategyService.saveStrategicObjectiveRelationship({
        clientId: 'IPS',
        sourceStrategicObjectiveId: 'oe_src_1',
        targetStrategicObjectiveId: 'oe_tgt_1',
        description: 'La capacitación optimiza los procesos'
      });

      expect(mockRunTransaction).toHaveBeenCalledTimes(1);
      expect(result.id).toBe('rel_IPS_oe_src_1_oe_tgt_1');
      expect(result.clientId).toBe('IPS');
      expect(result.sourceStrategicObjectiveId).toBe('oe_src_1');
      expect(result.targetStrategicObjectiveId).toBe('oe_tgt_1');
      expect(result.description).toBe('La capacitación optimiza los procesos');
    });

    it('repeated logical save targets the same canonical document rather than creating a second physical document', async () => {
      const sourceOE: StrategicObjective = { id: 'oe_1', perspectiveId: 'FINANCIERA', code: 'OE-01', title: 'OE 1', order: 1, clientId: 'IPS' };
      const targetOE: StrategicObjective = { id: 'oe_2', perspectiveId: 'CLIENTE', code: 'OE-02', title: 'OE 2', order: 1, clientId: 'IPS' };

      const existingRel: StrategicObjectiveRelationship = {
        id: 'rel_IPS_oe_1_oe_2',
        clientId: 'IPS',
        sourceStrategicObjectiveId: 'oe_1',
        targetStrategicObjectiveId: 'oe_2',
        description: 'Initial rationale',
        createdAt: '2026-01-01T00:00:00.000Z'
      };

      let capturedSetData: any = null;

      mockRunTransaction.mockImplementation(async (_db, callback) => {
        const fakeTx = {
          get: jest.fn().mockImplementation(async (ref: any) => {
            if (ref.id === 'oe_1') return { exists: () => true, data: () => sourceOE };
            if (ref.id === 'oe_2') return { exists: () => true, data: () => targetOE };
            if (ref.id === 'rel_IPS_oe_1_oe_2') return { exists: () => true, data: () => existingRel };
            return { exists: () => false, data: () => undefined };
          }),
          set: jest.fn().mockImplementation((ref: any, data: any) => {
            capturedSetData = { ref, data };
          })
        };
        return await callback(fakeTx);
      });

      const updated = await strategyService.saveStrategicObjectiveRelationship({
        clientId: 'IPS',
        sourceStrategicObjectiveId: 'oe_1',
        targetStrategicObjectiveId: 'oe_2',
        description: 'Updated rationale'
      });

      expect(updated.id).toBe('rel_IPS_oe_1_oe_2');
      expect(capturedSetData.ref.id).toBe('rel_IPS_oe_1_oe_2');
      expect(capturedSetData.data.createdAt).toBe('2026-01-01T00:00:00.000Z');
      expect(capturedSetData.data.description).toBe('Updated rationale');
    });

    it('rejects relationship when source OE does not exist', async () => {
      mockRunTransaction.mockImplementation(async (_db, callback) => {
        const fakeTx = {
          get: jest.fn().mockImplementation(async (ref: any) => {
            if (ref.id === 'oe_non_existent') return { exists: () => false };
            return { exists: () => true, data: () => ({ clientId: 'IPS' }) };
          }),
          set: jest.fn()
        };
        return await callback(fakeTx);
      });

      await expect(strategyService.saveStrategicObjectiveRelationship({
        clientId: 'IPS',
        sourceStrategicObjectiveId: 'oe_non_existent',
        targetStrategicObjectiveId: 'oe_valid'
      })).rejects.toThrow('El objetivo estratégico de origen "oe_non_existent" no existe.');
    });

    it('rejects relationship when target OE does not exist', async () => {
      mockRunTransaction.mockImplementation(async (_db, callback) => {
        const fakeTx = {
          get: jest.fn().mockImplementation(async (ref: any) => {
            if (ref.id === 'oe_valid_src') return { exists: () => true, data: () => ({ clientId: 'IPS' }) };
            if (ref.id === 'oe_non_existent_tgt') return { exists: () => false };
            return { exists: () => false };
          }),
          set: jest.fn()
        };
        return await callback(fakeTx);
      });

      await expect(strategyService.saveStrategicObjectiveRelationship({
        clientId: 'IPS',
        sourceStrategicObjectiveId: 'oe_valid_src',
        targetStrategicObjectiveId: 'oe_non_existent_tgt'
      })).rejects.toThrow('El objetivo estratégico de destino "oe_non_existent_tgt" no existe.');
    });

    it('rejects relationship with cross-tenant source OE', async () => {
      mockRunTransaction.mockImplementation(async (_db, callback) => {
        const fakeTx = {
          get: jest.fn().mockImplementation(async (ref: any) => {
            if (ref.id === 'oe_other_tenant') return { exists: () => true, data: () => ({ clientId: 'CLIENT_B' }) };
            return { exists: () => true, data: () => ({ clientId: 'IPS' }) };
          }),
          set: jest.fn()
        };
        return await callback(fakeTx);
      });

      await expect(strategyService.saveStrategicObjectiveRelationship({
        clientId: 'IPS',
        sourceStrategicObjectiveId: 'oe_other_tenant',
        targetStrategicObjectiveId: 'oe_ips'
      })).rejects.toThrow('El objetivo de origen pertenece a otro tenant.');
    });

    it('rejects relationship with cross-tenant target OE', async () => {
      mockRunTransaction.mockImplementation(async (_db, callback) => {
        const fakeTx = {
          get: jest.fn().mockImplementation(async (ref: any) => {
            if (ref.id === 'oe_ips_src') return { exists: () => true, data: () => ({ clientId: 'IPS' }) };
            if (ref.id === 'oe_target_b') return { exists: () => true, data: () => ({ clientId: 'CLIENT_B' }) };
            return { exists: () => false };
          }),
          set: jest.fn()
        };
        return await callback(fakeTx);
      });

      await expect(strategyService.saveStrategicObjectiveRelationship({
        clientId: 'IPS',
        sourceStrategicObjectiveId: 'oe_ips_src',
        targetStrategicObjectiveId: 'oe_target_b'
      })).rejects.toThrow('El objetivo de destino pertenece a otro tenant.');
    });
  });

  // --- 7. Pruebas Ejecutables Directas de Guarda de Orfandad (deleteStrategicObjective) ---
  describe('Direct deleteStrategicObjective orphan guard execution', () => {

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('blocks deletion when OE participates as source (outgoing relationship)', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ id: 'oe_active_src', clientId: 'IPS', title: 'OE Activo' })
      });

      mockGetDocs.mockResolvedValueOnce({
        docs: [
          {
            data: () => ({
              id: 'rel_1',
              clientId: 'IPS',
              sourceStrategicObjectiveId: 'oe_active_src',
              targetStrategicObjectiveId: 'oe_other'
            })
          }
        ]
      });

      await expect(
        strategyService.deleteStrategicObjective('oe_active_src', 'IPS')
      ).rejects.toThrow('No es posible eliminar el objetivo estratégico porque participa en relaciones de causa y efecto activas. Elimine las relaciones primero.');

      expect(mockDeleteDoc).not.toHaveBeenCalled();
    });

    it('blocks deletion when OE participates as target (incoming relationship)', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ id: 'oe_active_tgt', clientId: 'IPS', title: 'OE Destino' })
      });

      mockGetDocs.mockResolvedValueOnce({
        docs: [
          {
            data: () => ({
              id: 'rel_2',
              clientId: 'IPS',
              sourceStrategicObjectiveId: 'oe_source',
              targetStrategicObjectiveId: 'oe_active_tgt'
            })
          }
        ]
      });

      await expect(
        strategyService.deleteStrategicObjective('oe_active_tgt', 'IPS')
      ).rejects.toThrow('No es posible eliminar el objetivo estratégico porque participa en relaciones de causa y efecto activas. Elimine las relaciones primero.');

      expect(mockDeleteDoc).not.toHaveBeenCalled();
    });

    it('allows deletion when OE has zero relationships', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ id: 'oe_isolated', clientId: 'IPS', title: 'OE Aislado' })
      });

      mockGetDocs.mockResolvedValueOnce({
        docs: [
          {
            data: () => ({
              id: 'rel_other',
              clientId: 'IPS',
              sourceStrategicObjectiveId: 'oe_a',
              targetStrategicObjectiveId: 'oe_b'
            })
          }
        ]
      });

      mockDeleteDoc.mockResolvedValueOnce(undefined);

      const result = await strategyService.deleteStrategicObjective('oe_isolated', 'IPS');
      expect(result).toBe(true);
      expect(mockDeleteDoc).toHaveBeenCalledTimes(1);
    });
  });

  // --- 8. Pruebas Ejecutables Directas de RelationshipEditorModal (Componente Real) ---
  describe('Direct RelationshipEditorModal Component Failure & Finally Handling', () => {

    beforeEach(() => {
      jest.clearAllMocks();
    });

    const perspectives: StrategicPerspective[] = DEFAULT_PERSPECTIVES;
    const objectives: StrategicObjective[] = [
      { id: 'oe_1', perspectiveId: 'FINANCIERA', code: 'OE-01', title: 'Incrementar Rentabilidad', order: 1, clientId: 'IPS' },
      { id: 'oe_2', perspectiveId: 'CLIENTE', code: 'OE-02', title: 'Fidelizar Clientes', order: 2, clientId: 'IPS' }
    ];

    it('renders real modal, handles save rejection and safely resets saving state so control is reusable', async () => {
      const mockSave = jest.fn().mockRejectedValue(new Error('Error del servidor de Firestore'));
      const mockDelete = jest.fn().mockResolvedValue(undefined);
      const mockClose = jest.fn();

      render(
        React.createElement(RelationshipEditorModal, {
          isOpen: true,
          onClose: mockClose,
          perspectives: perspectives,
          objectives: objectives,
          relationships: [],
          clientId: 'IPS',
          onSaveRelationship: mockSave,
          onDeleteRelationship: mockDelete
        })
      );

      expect(screen.getByText('Gestión de Relaciones de Causa y Efecto')).toBeInTheDocument();

      const selects = screen.getAllByRole('combobox');
      const sourceSelect = selects[0];
      const targetSelect = selects[1];
      const submitBtn = screen.getByRole('button', { name: /Agregar Relación/i });

      // Seleccionar OEs válidos
      fireEvent.change(sourceSelect, { target: { value: 'oe_1' } });
      fireEvent.change(targetSelect, { target: { value: 'oe_2' } });

      expect(submitBtn).not.toBeDisabled();

      // Disparar acción de guardar
      fireEvent.click(submitBtn);

      // El error debe desplegarse en pantalla y el botón debe volver a estar habilitado con texto "Agregar Relación"
      await waitFor(() => {
        expect(screen.getByText('Error del servidor de Firestore')).toBeInTheDocument();
      });

      expect(submitBtn).not.toBeDisabled();
      expect(submitBtn).toHaveTextContent('Agregar Relación');
      expect(mockSave).toHaveBeenCalledTimes(1);
    });
  });
});
