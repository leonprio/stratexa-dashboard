import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { derivePendingKpiActivities, deriveRescheduledKpiCommitments, RescheduledCommitmentsSection } from './CurrentPeriodFocus';
import { CurrentPeriodFocus } from './CurrentPeriodFocus';
import { DashboardItem } from '../types';

jest.mock('./ActionPlan', () => ({ ActionPlan: () => null }));
jest.mock('./RelatedActionPlans', () => ({ RelatedActionPlans: (props: any) => <section aria-label="Planes relacionados"><button type="button" aria-expanded={!props.collapsed} onClick={props.onToggle}>{props.collapsed ? 'Ver planes' : 'Volver al indicador'}</button><div hidden={props.collapsed}><span>Plan ejecutivo de prueba {props.initialPlanId || ''}</span><label>Borrador de prueba<input aria-label="Borrador de prueba" defaultValue="borrador inicial" /></label></div></section> }));

const item = (): DashboardItem => ({
  id: 1, indicator: 'KPI semanal', weight: 100, frequency: 'weekly', unit: 'act', type: 'accumulative', goalType: 'maximize',
  monthlyGoals: Array(12).fill(0), monthlyProgress: Array(12).fill(0), weeklyGoals: Array(53).fill(0), weeklyProgress: Array(53).fill(0),
  activityConfig: { 12: [{ id: 'activity-s13', label: 'Anai CE SM Texmelucan', targetCount: 1, completedCount: 0 }] }
});

describe('operational reschedule S13 -> S36', () => {
  const legacyConfig = () => ({ 12: [{ ...item().activityConfig?.[12][0], resolution: { resolutionStatus: 'rescheduled' as const, scheduledResolutionYear: 2026, scheduledResolutionPeriodType: 'weekly' as const, scheduledResolutionPeriodIndex: 35 } }] });

  test('S36 derives one commitment; S35 derives none', () => {
    const config = legacyConfig();
    expect(deriveRescheduledKpiCommitments(config, 35, true, 2026)).toHaveLength(1);
    expect(deriveRescheduledKpiCommitments(config, 34, true, 2026)).toHaveLength(0);
  });

  test('canonical commitment projects its scheduled period and suppresses the matching legacy fallback', () => {
    const source = { ...item(), activityConfig: legacyConfig(), continuityCommitments: { 'activity:activity-s13': { id: 'activity:activity-s13', sourceType: 'ACTIVITY_KPI' as const, sourceKpiId: '1', sourceActivityId: 'activity-s13', originYear: 2026, originPeriod: 12, originalTarget: 1, scheduledYear: 2026, scheduledPeriod: 35, progressByPeriod: {}, status: 'active' as const, outcome: 'in_progress' as const, rescheduleHistory: [], resolutionHistory: [{ type: 'RESCHEDULE' as const, fromPeriod: 12, toPeriod: 35, at: '2026-09-01T00:00:00.000Z' }] } } };
    const visible = deriveRescheduledKpiCommitments(source.activityConfig, 35, true, 2026, source);
    expect(visible).toHaveLength(1);
    expect(visible[0]).toMatchObject({ id: 'activity:activity-s13', periodIndex: 12, scheduledPeriodIndex: 35, scheduledPeriodLabel: 'S36 · 2026' });
  });

  test('canonical overdue state uses scheduled period rather than origin period', () => {
    const source = { ...item(), continuityCommitments: { 'activity:activity-s13': { id: 'activity:activity-s13', sourceType: 'ACTIVITY_KPI' as const, sourceKpiId: '1', sourceActivityId: 'activity-s13', originYear: 2026, originPeriod: 12, originalTarget: 1, scheduledYear: 2026, scheduledPeriod: 35, progressByPeriod: {}, status: 'active' as const, outcome: 'in_progress' as const, rescheduleHistory: [], resolutionHistory: [] } } };
    expect(derivePendingKpiActivities(source.activityConfig, 35, true, 2026, source)[0].status).toBe('COMPROMISO ACTUAL');
    expect(derivePendingKpiActivities(source.activityConfig, 36, true, 2026, source)[0].status).toBe('ATRASADA');
  });

  test('monthly canonical commitment is current at September, future for October, overdue only when scheduled in August', () => {
    const base = item();
    const makeSource = (scheduledPeriod: number) => ({
      ...base,
      frequency: 'monthly' as const,
      activityConfig: { 7: [{ id: 'a', label: 'Establecer metas', targetCount: 10, completedCount: 4 }] },
      continuityCommitments: { 'activity:a': {
        id: 'activity:a', sourceType: 'ACTIVITY_KPI' as const, sourceKpiId: '1', sourceActivityId: 'a',
        originYear: 2026, originPeriod: 7, originalTarget: 10, scheduledYear: 2026, scheduledPeriod,
        progressByPeriod: {}, status: 'active' as const, outcome: 'in_progress' as const,
        rescheduleHistory: [], resolutionHistory: [],
      } },
    });
    expect(derivePendingKpiActivities(makeSource(8).activityConfig, 8, false, 2026, makeSource(8))[0].status).toBe('COMPROMISO ACTUAL');
    expect(derivePendingKpiActivities(makeSource(9).activityConfig, 8, false, 2026, makeSource(9))[0].status).toBe('REPROGRAMADA');
    expect(derivePendingKpiActivities(makeSource(7).activityConfig, 8, false, 2026, makeSource(7))[0].status).toBe('ATRASADA');
  });

  test('pending shows origin, commitment and temporal status', () => {
    const config = legacyConfig();
    const future = derivePendingKpiActivities(config, 34, true, 2026)[0];
    expect(future.periodLabel).toContain('ORIGEN S13 · 2026 → COMPROMISO S36 · 2026');
    expect(future.status).toBe('REPROGRAMADA');
    expect(derivePendingKpiActivities(config, 35, true, 2026)[0].status).toBe('COMPROMISO ACTUAL');
    expect(derivePendingKpiActivities(config, 36, true, 2026)[0].status).toBe('ATRASADA');
  });

  test('destination section renders compact commitment summary and view actions CTA', () => {
    const config = legacyConfig();
    const onViewActions = jest.fn();
    render(<RescheduledCommitmentsSection commitments={deriveRescheduledKpiCommitments(config, 35, true, 2026)} onManage={jest.fn()} onViewActions={onViewActions} />);
    expect(screen.getByText('1 compromiso en seguimiento')).toBeInTheDocument();
    expect(screen.getByText(/Gestionables desde la pestaña Acciones por Atender/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'VER ACCIONES' })).toBeInTheDocument();
  });

  test('CurrentPeriodFocus real path renders the compact S36 destination summary', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-02T12:00:00'));
    const source = item();
    const configured = { ...source, isActivityMode: true, activityConfig: legacyConfig() };
    render(<CurrentPeriodFocus item={configured} globalThresholds={{ onTrack: 90, atRisk: 80 }} year={2026} onUpdateItem={jest.fn()} canEdit onClose={jest.fn()} />);
    expect(screen.getByText('Semana 36')).toBeInTheDocument();
    expect(screen.getByText('1 compromiso en seguimiento')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'VER ACCIONES' })).toBeInTheDocument();
    jest.useRealTimers();
  });

  test('KPI opens in indicator zone and toggles to and from the related plans zone', () => {
    const source = { ...item(), monthlyProgress: Array(12).fill(7) };
    render(<CurrentPeriodFocus item={source} globalThresholds={{ onTrack: 90, atRisk: 80 }} year={2026} dashboardId={2} clientId="LEON" onUpdateItem={jest.fn()} canEdit onClose={jest.fn()} />);
    expect(screen.getByText(/Tendencia Histórica/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Ver planes' })).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Ver planes' }));
    expect(screen.getByText(/Tendencia Histórica/)).not.toBeVisible();
    expect(screen.getByText('Plan ejecutivo de prueba')).toBeVisible();
    expect(screen.getByText('Indicador seleccionado')).toBeVisible();
    fireEvent.change(screen.getByLabelText('Borrador de prueba'), { target: { value: 'cambio local' } });
    fireEvent.click(screen.getByRole('button', { name: 'Volver al indicador' }));
    expect(screen.getByText(/Tendencia Histórica/)).toBeVisible();
    expect(screen.getByText('Plan ejecutivo de prueba')).not.toBeVisible();
    expect(screen.getByLabelText('Borrador de prueba')).toHaveValue('cambio local');
    fireEvent.click(screen.getByRole('button', { name: 'Ver planes' }));
    expect(screen.getByLabelText('Borrador de prueba')).toHaveValue('cambio local');
  });

  test('direct navigation to an action plan opens the plans zone', () => {
    const source = item();
    render(<CurrentPeriodFocus item={source} globalThresholds={{ onTrack: 90, atRisk: 80 }} year={2026} dashboardId={2} clientId="LEON" initialActionPlanId="plan-1" onUpdateItem={jest.fn()} canEdit onClose={jest.fn()} />);
    expect(screen.getByText('Plan ejecutivo de prueba plan-1')).toBeVisible();
    expect(screen.getByText(/Tendencia Histórica/)).not.toBeVisible();
    expect(screen.getByRole('button', { name: 'Volver al indicador' })).toBeVisible();
  });
});
