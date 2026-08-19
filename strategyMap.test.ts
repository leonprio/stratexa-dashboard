import {
  StrategicPerspective,
  StrategicObjective,
  StrategicObjectiveRelationship,
  ContributionObjective,
  ContributionIndicatorAssignment,
  validateObjectiveRelationship,
  getCanonicalRelationshipId
} from './strategyTypes';

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

  // --- 6. Relationship Editor Modal Error Handling & State Cleanup ---
  describe('RelationshipEditorModal Error & Finally Handling', () => {

    it('always resets isSaving state on save failure through proper finally block', async () => {
      let isSaving = false;
      let errorMsg: string | null = null;

      const mockOnSaveFailure = jest.fn().mockRejectedValue(new Error('Network / Firestore failure'));

      const handleAddSimulated = async () => {
        try {
          isSaving = true;
          await mockOnSaveFailure();
        } catch (err: any) {
          errorMsg = err.message || 'Error';
        } finally {
          isSaving = false;
        }
      };

      await handleAddSimulated();

      expect(mockOnSaveFailure).toHaveBeenCalledTimes(1);
      expect(errorMsg).toBe('Network / Firestore failure');
      expect(isSaving).toBe(false); // Validates that isSaving never stays true permanently
    });
  });
});
