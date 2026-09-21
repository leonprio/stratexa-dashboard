import type { DashboardItem } from '../types';

export type ResolutionHistoryStatus = 'COMPLETADO' | 'DESCARTADO' | 'REPROGRAMADO' | 'REABIERTO';
export interface ResolutionHistoryRow { id: string; title: string; originalPeriodIndex: number; originalYear: number; status: ResolutionHistoryStatus; resolvedAt?: string; reason?: string; scheduledPeriodIndex?: number; scheduledYear?: number; canReopen: boolean; activityId: string; }

export const buildResolutionHistory = (item: DashboardItem, year: number): ResolutionHistoryRow[] => {
  const legacyRows = Object.entries(item.activityConfig || {}).flatMap(([period, activities]) => (Array.isArray(activities) ? activities : []).flatMap(activity => {
    const resolution = activity.resolution;
    if (!resolution || !['completed_later', 'discarded', 'rescheduled', 'reopened'].includes(resolution.resolutionStatus)) return [];
    const status = resolution.resolutionStatus === 'completed_later' ? 'COMPLETADO' : resolution.resolutionStatus === 'discarded' ? 'DESCARTADO' : resolution.resolutionStatus === 'rescheduled' ? 'REPROGRAMADO' : 'REABIERTO';
    const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const reason = status === 'REPROGRAMADO' && resolution.scheduledResolutionPeriodIndex !== undefined
      ? `Reprogramado a ${monthNames[resolution.scheduledResolutionPeriodIndex] || `periodo ${resolution.scheduledResolutionPeriodIndex + 1}`}`
      : resolution.resolutionNote;
    const currentRow = { id: `${item.id}:${year}:${period}:${activity.id}`, title: activity.label, originalPeriodIndex: Number(period), originalYear: resolution.resolvedYear || year, status, resolvedAt: resolution.reopenedAt || resolution.resolvedAt, reason, scheduledPeriodIndex: resolution.scheduledResolutionPeriodIndex, scheduledYear: resolution.scheduledResolutionYear, canReopen: status === 'COMPLETADO' || status === 'DESCARTADO', activityId: activity.id };
    const events = resolution.resolutionHistory || [];
    const historicalRows = events
      .filter(event => ['completed_later', 'discarded', 'rescheduled'].includes(event.event))
      .map((event, index) => ({
        ...currentRow,
        id: `${currentRow.id}:history:${index}`,
        originalYear: event.year || currentRow.originalYear,
        status: event.event === 'completed_later' ? 'COMPLETADO' : event.event === 'discarded' ? 'DESCARTADO' : 'REPROGRAMADO',
        resolvedAt: event.at,
        canReopen: false,
      }));
    return [...historicalRows, currentRow];
  }));

  const canonicalRows: ResolutionHistoryRow[] = Object.values(item.continuityCommitments || {})
    .filter(c => c.sourceType === 'SIMPLE_KPI' || !c.sourceActivityId)
    .flatMap(commitment => {
      const history = commitment.resolutionHistory || [];
      return history.map((event, index) => {
        const status: ResolutionHistoryStatus =
          event.type === 'CLOSE_COMPLETED' ? 'COMPLETADO' :
          event.type === 'DISCARD' ? 'DESCARTADO' :
          event.type === 'RESCHEDULE' ? 'REPROGRAMADO' : 'REABIERTO';
        let title = commitment.sourceActivityId;
        if (item.activityConfig) {
          for (const raw of Object.values(item.activityConfig)) {
            const found = raw.find((a) => a.id === commitment.sourceActivityId);
            if (found?.label) {
              title = found.label;
              break;
            }
          }
        }
        if (!title || title === commitment.sourceActivityId) {
          title = (event as any).reason || item.indicator || 'Compromiso de continuidad';
        }
        return {
          id: `${commitment.id}:history:${index}`,
          title,
          originalPeriodIndex: commitment.originPeriod,
          originalYear: commitment.originYear || year,
          status,
          resolvedAt: event.at,
          reason: (event as any).reason,
          scheduledPeriodIndex: commitment.scheduledPeriod,
          scheduledYear: commitment.scheduledYear || year,
          canReopen: false,
          activityId: commitment.sourceActivityId || commitment.id,
        };
      });
    });

  return [...legacyRows, ...canonicalRows];
};
