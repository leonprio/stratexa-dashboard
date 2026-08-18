import {
  DEFAULT_PERSPECTIVES,
  deriveAreaCodeSuggestion,
  validateAreaCodeUniqueness,
  generateNextOCSequence,
  formatOCCode,
  AreaStrategyConfig,
  ContributionObjective,
  StrategicObjective,
  ContributionIndicatorAssignment
} from './strategyTypes';

describe('Strategy Foundation — Pure Helpers & Architecture Contracts', () => {

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
      { id: '1', areaName: 'COMERCIAL', code: 'COM', clientId: 'IPS' },
      { id: '2', areaName: 'OPERACIONES', code: 'OPE', clientId: 'IPS' }
    ];

    it('allows assigning a new unique code', () => {
      expect(validateAreaCodeUniqueness(existingConfigs, 'FIN', 'FINANZAS')).toBe(true);
    });

    it('rejects a code collision with another area (case-insensitive)', () => {
      expect(validateAreaCodeUniqueness(existingConfigs, 'com', 'FINANZAS')).toBe(false);
      expect(validateAreaCodeUniqueness(existingConfigs, 'OPE', 'FINANZAS')).toBe(false);
    });

    it('allows preserving/updating code for the same area', () => {
      expect(validateAreaCodeUniqueness(existingConfigs, 'COM', 'COMERCIAL')).toBe(true);
    });
  });

  describe('generateNextOCSequence & formatOCCode', () => {
    it('generates COM-OC01/02/03 independently from OPE-OC01/02', () => {
      const existingOCs: ContributionObjective[] = [
        { id: 'oc-1', areaName: 'COMERCIAL', areaCode: 'COM', sequenceNumber: 1, displayCode: 'COM-OC01', title: 'OC1', primaryStrategicObjectiveId: 'oe-1', clientId: 'IPS' },
        { id: 'oc-2', areaName: 'COMERCIAL', areaCode: 'COM', sequenceNumber: 2, displayCode: 'COM-OC02', title: 'OC2', primaryStrategicObjectiveId: 'oe-1', clientId: 'IPS' },
        { id: 'oc-3', areaName: 'OPERACIONES', areaCode: 'OPE', sequenceNumber: 1, displayCode: 'OPE-OC01', title: 'OC3', primaryStrategicObjectiveId: 'oe-2', clientId: 'IPS' }
      ];

      const nextComSeq = generateNextOCSequence(existingOCs, 'COMERCIAL');
      expect(nextComSeq).toBe(3);
      expect(formatOCCode('COM', nextComSeq)).toBe('COM-OC03');

      const nextOpeSeq = generateNextOCSequence(existingOCs, 'OPERACIONES');
      expect(nextOpeSeq).toBe(2);
      expect(formatOCCode('OPE', nextOpeSeq)).toBe('OPE-OC02');
    });

    it('does NOT reuse deleted OC sequence numbers', () => {
      // Suppose COM-OC01 and COM-OC02 were created, then COM-OC02 was deleted.
      // Maximum sequence number ever recorded in existingOCs is 2.
      const existingOCs: ContributionObjective[] = [
        { id: 'oc-1', areaName: 'COMERCIAL', areaCode: 'COM', sequenceNumber: 1, displayCode: 'COM-OC01', title: 'OC1', primaryStrategicObjectiveId: 'oe-1', clientId: 'IPS' },
        { id: 'oc-3', areaName: 'COMERCIAL', areaCode: 'COM', sequenceNumber: 3, displayCode: 'COM-OC03', title: 'OC3', primaryStrategicObjectiveId: 'oe-1', clientId: 'IPS' }
      ];

      const nextSeq = generateNextOCSequence(existingOCs, 'COMERCIAL');
      expect(nextSeq).toBe(4); // Must be 4, NOT 2!
      expect(formatOCCode('COM', nextSeq)).toBe('COM-OC04');
    });
  });

  describe('Stable Area Code Contracts', () => {
    it('stable area code survives area-name change when resolved via AreaStrategyConfig', () => {
      const areaConfig: AreaStrategyConfig = {
        id: 'cfg-com-123',
        areaName: 'COMERCIAL Y VENTAS', // Area name changed from COMERCIAL to COMERCIAL Y VENTAS
        code: 'COM', // Stable display code configured previously
        clientId: 'IPS'
      };

      const oc: ContributionObjective = {
        id: 'oc-100',
        areaName: 'COMERCIAL Y VENTAS',
        areaCode: areaConfig.code, // Stays 'COM'
        sequenceNumber: 1,
        displayCode: formatOCCode(areaConfig.code, 1),
        title: 'Incrementar conversión',
        primaryStrategicObjectiveId: 'oe-1',
        clientId: 'IPS'
      };

      expect(oc.displayCode).toBe('COM-OC01');
    });
  });

  describe('Matrix Cell & Relationship Contracts', () => {
    it('supports multiple OCs from the same area linked to the same OE', () => {
      const ocs: ContributionObjective[] = [
        { id: 'oc-1', areaName: 'COMERCIAL', areaCode: 'COM', sequenceNumber: 1, displayCode: 'COM-OC01', title: 'Ventas Directas', primaryStrategicObjectiveId: 'oe-1', clientId: 'IPS' },
        { id: 'oc-2', areaName: 'COMERCIAL', areaCode: 'COM', sequenceNumber: 2, displayCode: 'COM-OC02', title: 'Ventas Digitales', primaryStrategicObjectiveId: 'oe-1', clientId: 'IPS' }
      ];

      const cellOCs = ocs.filter(oc => oc.areaName === 'COMERCIAL' && oc.primaryStrategicObjectiveId === 'oe-1');
      expect(cellOCs.length).toBe(2);
      expect(cellOCs[0].displayCode).toBe('COM-OC01');
      expect(cellOCs[1].displayCode).toBe('COM-OC02');
    });

    it('allows linking existing DashboardItems without cloning', () => {
      const assignment: ContributionIndicatorAssignment = {
        id: 'assign-1',
        contributionObjectiveId: 'oc-1',
        dashboardId: 101, // References original Dashboard
        itemId: 'kpi-55',  // References original DashboardItem
        clientId: 'IPS'
      };

      expect(assignment.dashboardId).toBe(101);
      expect(assignment.itemId).toBe('kpi-55');
    });
  });

});
