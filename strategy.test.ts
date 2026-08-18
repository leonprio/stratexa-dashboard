import {
  DEFAULT_PERSPECTIVES,
  deriveAreaCodeSuggestion,
  validateAreaCodeUniqueness,
  generateNextOCSequence,
  formatOCCode,
  resolveAreaStrategyConfig,
  AreaStrategyConfig,
  ContributionObjective,
  StrategicObjective,
  ContributionIndicatorAssignment,
  StrategicPerspective
} from './strategyTypes';

describe('Strategy Foundation — Pure Helpers & Architecture Contracts', () => {

  describe('DEFAULT_PERSPECTIVES (4 Configurable BSC Slots)', () => {
    it('has exactly 4 default perspective slots with required labels', () => {
      expect(DEFAULT_PERSPECTIVES.length).toBe(4);
      expect(DEFAULT_PERSPECTIVES[0].name).toBe('Resultados / Financiera');
      expect(DEFAULT_PERSPECTIVES[1].name).toBe('Cliente / Grupos de interés');
      expect(DEFAULT_PERSPECTIVES[2].name).toBe('Procesos internos');
      expect(DEFAULT_PERSPECTIVES[3].name).toBe('Capacidad organizacional');
    });

    it('allows changing display name without breaking slot IDs', () => {
      const customPerspectives: StrategicPerspective[] = DEFAULT_PERSPECTIVES.map((p, idx) => ({
        ...p,
        name: `Custom Perspective ${idx + 1}`
      }));

      expect(customPerspectives[0].id).toBe('FINANCIERA');
      expect(customPerspectives[0].name).toBe('Custom Perspective 1');

      const oe: StrategicObjective = {
        id: 'oe-1',
        perspectiveId: customPerspectives[0].id,
        code: 'OE-01',
        title: 'Rentabilidad',
        order: 1,
        clientId: 'IPS'
      };

      // OE link remains valid even after perspective name change
      expect(oe.perspectiveId).toBe('FINANCIERA');
    });
  });

  describe('deriveAreaCodeSuggestion', () => {
    it('generates 3 letter uppercase code for single word areas', () => {
      expect(deriveAreaCodeSuggestion('COMERCIAL')).toBe('COM');
      expect(deriveAreaCodeSuggestion('OPERACIONES')).toBe('OPE');
      expect(deriveAreaCodeSuggestion('FINANZAS')).toBe('FIN');
    });

    it('generates acronym or compound prefix for multi-word areas', () => {
      expect(deriveAreaCodeSuggestion('TALENTO Y CULTURA')).toBe('TACU');
      expect(deriveAreaCodeSuggestion('RECURSOS HUMANOS')).toBe('REHU');
    });
  });

  describe('validateAreaCodeUniqueness', () => {
    const existingConfigs: AreaStrategyConfig[] = [
      { id: 'areacfg_IPS_COMERCIAL', areaName: 'COMERCIAL', code: 'COM', clientId: 'IPS' },
      { id: 'areacfg_IPS_OPERACIONES', areaName: 'OPERACIONES', code: 'OPE', clientId: 'IPS' }
    ];

    it('allows assigning a new unique code', () => {
      expect(validateAreaCodeUniqueness(existingConfigs, 'FIN', 'FINANZAS')).toBe(true);
    });

    it('rejects a code collision with another area (case-insensitive)', () => {
      expect(validateAreaCodeUniqueness(existingConfigs, 'com', 'FINANZAS')).toBe(false);
      expect(validateAreaCodeUniqueness(existingConfigs, 'OPE', 'FINANZAS')).toBe(false);
    });

    it('allows preserving/updating code for the same area by name or ID', () => {
      expect(validateAreaCodeUniqueness(existingConfigs, 'COM', 'COMERCIAL')).toBe(true);
      expect(validateAreaCodeUniqueness(existingConfigs, 'COM', 'areacfg_IPS_COMERCIAL')).toBe(true);
    });
  });

  describe('resolveAreaStrategyConfig & Alias Resolution', () => {
    const areaConfigs: AreaStrategyConfig[] = [
      {
        id: 'areacfg_auto_101',
        areaName: 'COMERCIAL Y VENTAS',
        code: 'COM',
        aliases: ['COMERCIAL', 'VENTAS'],
        clientId: 'IPS'
      },
      {
        id: 'areacfg_auto_102',
        areaName: 'OPERACIONES',
        code: 'OPE',
        clientId: 'IPS'
      }
    ];

    it('exact current area name resolves config', () => {
      const res = resolveAreaStrategyConfig('COMERCIAL Y VENTAS', areaConfigs);
      expect(res).toBeDefined();
      expect(res?.id).toBe('areacfg_auto_101');
      expect(res?.code).toBe('COM');
    });

    it('alias resolves same config', () => {
      const res1 = resolveAreaStrategyConfig('COMERCIAL', areaConfigs);
      expect(res1?.id).toBe('areacfg_auto_101');

      const res2 = resolveAreaStrategyConfig('VENTAS', areaConfigs);
      expect(res2?.id).toBe('areacfg_auto_101');
    });

    it('unrelated name does not resolve automatically', () => {
      const res = resolveAreaStrategyConfig('FINANZAS', areaConfigs);
      expect(res).toBeUndefined();
    });

    it('relink preserves areaConfigId and strategyCode', () => {
      const existing = areaConfigs[0];
      const newSourceAreaName = 'NUEVO NOMBRE COMERCIAL';

      // Simular relink: agregar nuevo nombre a los aliases o como nuevo areaName
      const relinkedConfig: AreaStrategyConfig = {
        ...existing,
        areaName: newSourceAreaName,
        aliases: [...(existing.aliases || []), existing.areaName]
      };

      expect(relinkedConfig.id).toBe('areacfg_auto_101');
      expect(relinkedConfig.code).toBe('COM');

      // Comprobar que el nombre anterior ('COMERCIAL Y VENTAS') se mantiene en aliases
      const resolvedFromOld = resolveAreaStrategyConfig('COMERCIAL Y VENTAS', [relinkedConfig]);
      expect(resolvedFromOld?.id).toBe('areacfg_auto_101');

      const resolvedFromNew = resolveAreaStrategyConfig('NUEVO NOMBRE COMERCIAL', [relinkedConfig]);
      expect(resolvedFromNew?.id).toBe('areacfg_auto_101');
    });

    it('matrix resolver finds existing COM-OC01 after rename/relink', () => {
      const existingOC: ContributionObjective = {
        id: 'oc_1',
        areaConfigId: 'areacfg_auto_101',
        areaName: 'COMERCIAL',
        areaCode: 'COM',
        sequenceNumber: 1,
        displayCode: 'COM-OC01',
        title: 'Ventas Digitales',
        primaryStrategicObjectiveId: 'oe_1',
        clientId: 'IPS'
      };

      const resolvedAreaCfg = resolveAreaStrategyConfig('COMERCIAL Y VENTAS', areaConfigs);
      expect(resolvedAreaCfg).toBeDefined();

      const isMatch = existingOC.areaConfigId === resolvedAreaCfg?.id;
      expect(isMatch).toBe(true);
      expect(existingOC.displayCode).toBe('COM-OC01');
    });
  });

  describe('generateNextOCSequence & formatOCCode', () => {
    it('generates COM-OC01/02/03 independently from OPE-OC01/02', () => {
      const existingOCs: ContributionObjective[] = [
        { id: 'oc-1', areaConfigId: 'areacfg_com', areaName: 'COMERCIAL', areaCode: 'COM', sequenceNumber: 1, displayCode: 'COM-OC01', title: 'OC1', primaryStrategicObjectiveId: 'oe-1', clientId: 'IPS' },
        { id: 'oc-2', areaConfigId: 'areacfg_com', areaName: 'COMERCIAL', areaCode: 'COM', sequenceNumber: 2, displayCode: 'COM-OC02', title: 'OC2', primaryStrategicObjectiveId: 'oe-1', clientId: 'IPS' },
        { id: 'oc-3', areaConfigId: 'areacfg_ope', areaName: 'OPERACIONES', areaCode: 'OPE', sequenceNumber: 1, displayCode: 'OPE-OC01', title: 'OC3', primaryStrategicObjectiveId: 'oe-2', clientId: 'IPS' }
      ];

      const nextComSeq = generateNextOCSequence(existingOCs, 'areacfg_com');
      expect(nextComSeq).toBe(3);
      expect(formatOCCode('COM', nextComSeq)).toBe('COM-OC03');

      const nextOpeSeq = generateNextOCSequence(existingOCs, 'areacfg_ope');
      expect(nextOpeSeq).toBe(2);
      expect(formatOCCode('OPE', nextOpeSeq)).toBe('OPE-OC02');
    });

    it('does NOT reuse deleted OC sequence numbers', () => {
      const existingOCs: ContributionObjective[] = [
        { id: 'oc-1', areaConfigId: 'areacfg_com', areaName: 'COMERCIAL', areaCode: 'COM', sequenceNumber: 1, displayCode: 'COM-OC01', title: 'OC1', primaryStrategicObjectiveId: 'oe-1', clientId: 'IPS' },
        { id: 'oc-3', areaConfigId: 'areacfg_com', areaName: 'COMERCIAL', areaCode: 'COM', sequenceNumber: 3, displayCode: 'COM-OC03', title: 'OC3', primaryStrategicObjectiveId: 'oe-1', clientId: 'IPS' }
      ];

      const nextSeq = generateNextOCSequence(existingOCs, 'areacfg_com');
      expect(nextSeq).toBe(4);
      expect(formatOCCode('COM', nextSeq)).toBe('COM-OC04');
    });
  });

  describe('Stable Relational Area Code Contracts', () => {
    it('stable area code survives area-name change when resolved via areaConfigId', () => {
      const areaConfig: AreaStrategyConfig = {
        id: 'cfg-com-123',
        areaName: 'COMERCIAL Y VENTAS',
        code: 'COM',
        clientId: 'IPS'
      };

      const oc: ContributionObjective = {
        id: 'oc-100',
        areaConfigId: areaConfig.id,
        areaName: 'COMERCIAL Y VENTAS',
        areaCode: areaConfig.code,
        sequenceNumber: 1,
        displayCode: formatOCCode(areaConfig.code, 1),
        title: 'Incrementar conversión',
        primaryStrategicObjectiveId: 'oe-1',
        clientId: 'IPS'
      };

      expect(oc.areaConfigId).toBe('cfg-com-123');
      expect(oc.displayCode).toBe('COM-OC01');
    });
  });

  describe('Matrix Cell & Relationship Contracts', () => {
    it('supports multiple OCs from the same area linked to the same OE', () => {
      const ocs: ContributionObjective[] = [
        { id: 'oc-1', areaConfigId: 'areacfg_com', areaName: 'COMERCIAL', areaCode: 'COM', sequenceNumber: 1, displayCode: 'COM-OC01', title: 'Ventas Directas', primaryStrategicObjectiveId: 'oe-1', clientId: 'IPS' },
        { id: 'oc-2', areaConfigId: 'areacfg_com', areaName: 'COMERCIAL', areaCode: 'COM', sequenceNumber: 2, displayCode: 'COM-OC02', title: 'Ventas Digitales', primaryStrategicObjectiveId: 'oe-1', clientId: 'IPS' }
      ];

      const cellOCs = ocs.filter(oc => oc.areaConfigId === 'areacfg_com' && oc.primaryStrategicObjectiveId === 'oe-1');
      expect(cellOCs.length).toBe(2);
      expect(cellOCs[0].displayCode).toBe('COM-OC01');
      expect(cellOCs[1].displayCode).toBe('COM-OC02');
    });

    it('allows linking existing DashboardItems without cloning', () => {
      const assignment: ContributionIndicatorAssignment = {
        id: 'assign-1',
        contributionObjectiveId: 'oc-1',
        dashboardId: 101,
        itemId: 'kpi-55',
        clientId: 'IPS'
      };

      expect(assignment.dashboardId).toBe(101);
      expect(assignment.itemId).toBe('kpi-55');
    });
  });

});
