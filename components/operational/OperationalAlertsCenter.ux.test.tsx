import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { OperationalAlertsCenter } from './OperationalAlertsCenter';
import { buildOperationalAlerts } from '../../utils/operationalAlerts';

jest.mock('../../utils/operationalAlerts', () => ({ ...jest.requireActual('../../utils/operationalAlerts'), buildOperationalAlerts: jest.fn() }));

describe('OperationalAlertsCenter UX ejecutiva', () => {
  beforeEach(() => (buildOperationalAlerts as jest.Mock).mockReturnValue([{
    id: 1, dashboardId: 10, indicator: 'REUNIONES CON PROSPECTOS', direction: 'GENERAL', area: 'COMERCIAL', severity: 'CRÍTICO', trend: 'CRÍTICO', agingLabel: '61d+ (Crítico)', reliabilityScore: 35, captureRate: 50, stalenessDays: 122, missingPeriods: 4, performanceScore: 53, realOperationalScore: 27, isOvertRisk: true, isHiddenRisk: false, isDeteriorating: true, dataStatus: 'DATOS VENCIDOS', performanceLabel: 'CRÍTICO', traceability: { lastUpdatedAt: 'MAY / 2026', lastUpdatedBy: 'SIN RESPONSABLE REGISTRADO', lastOperationalChange: 'Última captura: MAY' }
  }]));

  it('mantiene badges en una línea y separa estado, datos y aging', () => {
    render(<OperationalAlertsCenter dashboards={[]} globalThresholds={{ onTrack: 90, atRisk: 80 }} year={2026} compact />);
    expect(screen.getAllByText('CRÍTICO', { selector: 'span' }).find(element => element.classList.contains('whitespace-nowrap'))).toBeDefined();
    expect(screen.getByText('DATOS VENCIDOS')).toHaveClass('whitespace-nowrap');
    expect(screen.getByText('53%')).toBeInTheDocument();
    expect(screen.getByText('122 días')).toBeInTheDocument();
    expect(screen.getByText('VENCIDO')).toBeInTheDocument();
    expect(screen.queryByText('61d+ (Crítico)')).not.toBeInTheDocument();
    expect(screen.getByText('Última captura: MAY')).toBeInTheDocument();
    expect(screen.getByText('Responsable: SIN REGISTRAR')).toBeInTheDocument();
  });

  it('navigates with the exact operational dashboardId and itemId', () => {
    const onNavigateToKpi = jest.fn();
    render(<OperationalAlertsCenter dashboards={[]} globalThresholds={{ onTrack: 90, atRisk: 80 }} year={2026} compact onNavigateToKpi={onNavigateToKpi} />);
    fireEvent.click(screen.getByText('REUNIONES CON PROSPECTOS'));
    expect(onNavigateToKpi).toHaveBeenCalledWith(10, 1);
    expect(screen.getByText('REVISAR →')).toBeInTheDocument();
  });

  it('keeps hidden-risk KPIs actionable with their exact physical identity', () => {
    (buildOperationalAlerts as jest.Mock).mockReturnValue([{
      id: 'apps-developed', dashboardId: 'dashboard-leon', indicator: 'APLICACIONES DESARROLLADAS', direction: 'GENERAL', area: 'COMERCIAL', severity: 'RIESGO OCULTO', trend: 'ESTABLE', agingLabel: '155 días', reliabilityScore: 16, captureRate: 22, stalenessDays: 155, missingPeriods: 7, performanceScore: 100, realOperationalScore: 22, isOvertRisk: false, isHiddenRisk: true, isDeteriorating: false, dataStatus: 'DATOS VENCIDOS', performanceLabel: 'AL DÍA', traceability: { lastUpdatedAt: 'S8 / 2026', lastUpdatedBy: 'SIN RESPONSABLE REGISTRADO', lastOperationalChange: 'Última captura: S8' }
    }]);
    const onNavigateToKpi = jest.fn();
    render(<OperationalAlertsCenter dashboards={[]} globalThresholds={{ onTrack: 90, atRisk: 80 }} year={2026} compact onNavigateToKpi={onNavigateToKpi} />);
    fireEvent.keyDown(screen.getByRole('row', { name: /APLICACIONES DESARROLLADAS/ }), { key: 'Enter' });
    expect(onNavigateToKpi).toHaveBeenCalledWith('dashboard-leon', 'apps-developed');
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getAllByText('RIESGO OCULTO').length).toBeGreaterThan(0);
  });

  it('muestra el porcentaje canónico junto con la etiqueta semántica', () => {
    (buildOperationalAlerts as jest.Mock).mockReturnValue([
      { id: 1, indicator: 'ACTIVIDADES ESTRATÉGICAS', severity: 'REQUIERE ATENCIÓN', trend: 'DETERIORÁNDOSE', performanceScore: 81, performanceLabel: 'DESVIACIÓN', dataStatus: 'DATOS INCOMPLETOS', captureRate: 63, reliabilityScore: 44, expectedPeriods: 8, missingPeriods: 3, stalenessDays: 10, isHiddenRisk: false, traceability: { lastOperationalChange: 'Última captura: S35', lastUpdatedBy: 'X' } },
      { id: 2, indicator: 'PROSPECTOS CONTACTADOS', severity: 'REQUIERE ATENCIÓN', trend: 'DETERIORÁNDOSE', performanceScore: 84, performanceLabel: 'DESVIACIÓN', dataStatus: 'AL DÍA', captureRate: 100, reliabilityScore: 100, expectedPeriods: 1, missingPeriods: 0, stalenessDays: 0, isHiddenRisk: false, traceability: { lastOperationalChange: 'Última captura: AGO', lastUpdatedBy: 'X' } },
      { id: 3, indicator: 'REUNIONES CON PROSPECTOS', severity: 'CRÍTICO', trend: 'CRÍTICO', performanceScore: 53, performanceLabel: 'CRÍTICO', dataStatus: 'AL DÍA', captureRate: 100, reliabilityScore: 100, expectedPeriods: 1, missingPeriods: 0, stalenessDays: 0, isHiddenRisk: false, traceability: { lastOperationalChange: 'Última captura: AGO', lastUpdatedBy: 'X' } },
      { id: 4, indicator: 'APLICACIONES DESARROLLADAS', severity: 'RIESGO OCULTO', trend: 'ESTABLE', performanceScore: 100, performanceLabel: 'AL DÍA', dataStatus: 'DATOS INCOMPLETOS', captureRate: 20, reliabilityScore: 44, expectedPeriods: 5, missingPeriods: 4, stalenessDays: 10, isHiddenRisk: true, traceability: { lastOperationalChange: 'Última captura: AGO', lastUpdatedBy: 'X' } },
    ]);
    render(<OperationalAlertsCenter dashboards={[]} globalThresholds={{ onTrack: 90, atRisk: 80 }} year={2026} compact />);
    for (const value of ['81%', '84%', '53%', '100%']) expect(screen.getAllByText(value).length).toBeGreaterThan(0);
    expect(screen.getAllByText('DESVIACIÓN').length).toBeGreaterThan(0);
    expect(screen.getAllByText('RIESGO OCULTO').length).toBeGreaterThan(0);
  });

  it('excluye KPIs sin obligación del listado ejecutivo', () => {
    (buildOperationalAlerts as jest.Mock).mockReturnValue([{ id: 9, indicator: 'NUEVAS ASESORÍAS', severity: 'SIN OBLIGACIÓN', trend: 'NO EVALUABLE', performanceScore: 0, performanceLabel: 'NO EVALUABLE', dataStatus: 'SIN OBLIGACIÓN', captureRate: 100, reliabilityScore: 100, expectedPeriods: 0, missingPeriods: 0, stalenessDays: 0, isHiddenRisk: false, traceability: { lastOperationalChange: 'KPI creado en sistema', lastUpdatedBy: 'X' } }]);
    render(<OperationalAlertsCenter dashboards={[]} globalThresholds={{ onTrack: 90, atRisk: 80 }} year={2026} compact />);
    expect(screen.queryByText('NUEVAS ASESORÍAS')).not.toBeInTheDocument();
    expect(screen.getByText(/No se encontraron alertas operativas/)).toBeInTheDocument();
  });
});
