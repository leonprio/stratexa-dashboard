import React from 'react';
import { render, screen } from '@testing-library/react';
import { OperationalAlertsCenter } from './OperationalAlertsCenter';
import { buildOperationalAlerts } from '../../utils/operationalAlerts';

jest.mock('../../utils/operationalAlerts', () => ({ ...jest.requireActual('../../utils/operationalAlerts'), buildOperationalAlerts: jest.fn() }));

describe('OperationalAlertsCenter UX ejecutiva', () => {
  beforeEach(() => (buildOperationalAlerts as jest.Mock).mockReturnValue([{
    id: 1, indicator: 'REUNIONES CON PROSPECTOS', direction: 'GENERAL', area: 'COMERCIAL', severity: 'CRÍTICO', trend: 'CRÍTICO', agingLabel: '61d+ (Crítico)', reliabilityScore: 35, captureRate: 50, stalenessDays: 122, missingPeriods: 4, performanceScore: 53, realOperationalScore: 27, isOvertRisk: true, isHiddenRisk: false, isDeteriorating: true, dataStatus: 'DATOS VENCIDOS', performanceLabel: 'CRÍTICO', traceability: { lastUpdatedAt: 'MAY / 2026', lastUpdatedBy: 'SIN RESPONSABLE REGISTRADO', lastOperationalChange: 'Última captura: MAY' }
  }]));

  it('mantiene badges en una línea y separa estado, datos y aging', () => {
    render(<OperationalAlertsCenter dashboards={[]} globalThresholds={{ onTrack: 90, atRisk: 80 }} year={2026} compact />);
    expect(screen.getAllByText('CRÍTICO', { selector: 'span' }).find(element => element.classList.contains('whitespace-nowrap'))).toBeDefined();
    expect(screen.getByText('DATOS VENCIDOS')).toHaveClass('whitespace-nowrap');
    expect(screen.getByText('122 días')).toBeInTheDocument();
    expect(screen.getByText('VENCIDO')).toBeInTheDocument();
    expect(screen.queryByText('61d+ (Crítico)')).not.toBeInTheDocument();
    expect(screen.getByText('Última captura: MAY')).toBeInTheDocument();
    expect(screen.getByText('Responsable: SIN REGISTRAR')).toBeInTheDocument();
  });
});
