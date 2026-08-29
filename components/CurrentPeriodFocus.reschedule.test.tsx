import React from 'react';
import { render, screen } from '@testing-library/react';
import { applyOperationalReschedule, derivePendingKpiActivities, deriveRescheduledKpiCommitments, RescheduledCommitmentsSection } from './CurrentPeriodFocus';
import { DashboardItem } from '../types';

const item = (): DashboardItem => ({
  id: 1, indicator: 'KPI semanal', weight: 100, frequency: 'weekly', unit: 'act', type: 'accumulative', goalType: 'maximize',
  monthlyGoals: Array(12).fill(0), monthlyProgress: Array(12).fill(0), weeklyGoals: Array(53).fill(0), weeklyProgress: Array(53).fill(0),
  activityConfig: { 12: [{ id: 'activity-s13', label: 'Anai CE SM Texmelucan', targetCount: 1, completedCount: 0 }] }
});

describe('operational reschedule S13 -> S36', () => {
  test('persists zero-based S36 metadata and survives reload without changing KPI data', () => {
    const before = item();
    const beforeSnapshot = JSON.stringify({ goals: before.weeklyGoals, progress: before.weeklyProgress, activityCount: before.activityConfig?.[12].length, target: before.activityConfig?.[12][0].targetCount, completed: before.activityConfig?.[12][0].completedCount });
    const config = applyOperationalReschedule(before.activityConfig, 12, 'activity-s13', 35, true, 2026);
    const reloaded = JSON.parse(JSON.stringify({ ...before, activityConfig: config })) as DashboardItem;
    expect(reloaded.activityConfig?.[12][0].resolution).toMatchObject({ resolutionStatus: 'rescheduled', scheduledResolutionYear: 2026, scheduledResolutionPeriodType: 'weekly', scheduledResolutionPeriodIndex: 35 });
    expect(reloaded.activityConfig?.[12][0].resolution?.resolvedAt).toBeUndefined();
    expect(JSON.stringify({ goals: reloaded.weeklyGoals, progress: reloaded.weeklyProgress, activityCount: reloaded.activityConfig?.[12].length, target: reloaded.activityConfig?.[12][0].targetCount, completed: reloaded.activityConfig?.[12][0].completedCount })).toBe(beforeSnapshot);
  });

  test('S36 derives one commitment; S35 derives none', () => {
    const config = applyOperationalReschedule(item().activityConfig, 12, 'activity-s13', 35, true, 2026);
    expect(deriveRescheduledKpiCommitments(config, 35, true, 2026)).toHaveLength(1);
    expect(deriveRescheduledKpiCommitments(config, 34, true, 2026)).toHaveLength(0);
  });

  test('pending shows origin, commitment and temporal status', () => {
    const config = applyOperationalReschedule(item().activityConfig, 12, 'activity-s13', 35, true, 2026);
    const future = derivePendingKpiActivities(config, 34, true, 2026)[0];
    expect(future.periodLabel).toContain('ORIGEN S13 · 2026 → COMPROMISO S36 · 2026');
    expect(future.status).toBe('REPROGRAMADA');
    expect(derivePendingKpiActivities(config, 35, true, 2026)[0].status).toBe('COMPROMISO ACTUAL');
    expect(derivePendingKpiActivities(config, 36, true, 2026)[0].status).toBe('ATRASADA');
  });

  test('destination section renders commitment and manage CTA', () => {
    const config = applyOperationalReschedule(item().activityConfig, 12, 'activity-s13', 35, true, 2026);
    render(<RescheduledCommitmentsSection commitments={deriveRescheduledKpiCommitments(config, 35, true, 2026)} onManage={jest.fn()} />);
    expect(screen.getByText(/COMPROMISOS REPROGRAMADOS/)).toBeInTheDocument();
    expect(screen.getByText('Anai CE SM Texmelucan')).toBeInTheDocument();
    expect(screen.getByText(/S13.*S36/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'GESTIONAR' })).toBeInTheDocument();
  });
});
