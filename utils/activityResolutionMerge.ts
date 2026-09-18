import type { DashboardItem } from '../types';

type ActivityConfig = NonNullable<DashboardItem['activityConfig']>;
type Activity = ActivityConfig[number][number];

const terminal = (activity: Activity | undefined) =>
  activity?.resolution?.resolutionStatus === 'completed_later' ||
  activity?.resolution?.resolutionStatus === 'discarded';

const explicitReactivation = (activity: Activity | undefined) =>
  activity?.resolution?.resolutionStatus === 'reopened' ||
  activity?.resolution?.resolutionStatus === 'rescheduled';

const resolutionAt = (activity: Activity | undefined) =>
  activity?.resolution?.reopenedAt || activity?.resolution?.resolvedAt || '';

/** Preserva cierres explícitos frente a una actualización construida con un snapshot viejo. */
export const mergeActivityConfigPreservingResolutions = (
  current: DashboardItem['activityConfig'],
  incoming: DashboardItem['activityConfig'],
): DashboardItem['activityConfig'] => {
  const result: ActivityConfig = { ...(incoming || {}) };
  // La lista entrante es autoritativa para las actividades activas del periodo.
  // Solo se conserva la resolución de una actividad que todavía está presente;
  // una actividad ausente es una eliminación, no una actividad a reinyectar.
  for (const [period, incomingRaw] of Object.entries(incoming || {})) {
    if (!Array.isArray(incomingRaw)) continue;
    const currentRaw = Array.isArray(current?.[period]) ? current[period] : [];
    result[period] = incomingRaw.map((incomingActivity) => {
      const currentActivity = currentRaw.find((a) => a.id === incomingActivity.id);
      if (!currentActivity) return incomingActivity;

      const currentResTime = resolutionAt(currentActivity);
      const incomingResTime = resolutionAt(incomingActivity);

      if (currentResTime && incomingResTime && incomingResTime < currentResTime) {
        return {
          ...incomingActivity,
          resolution: currentActivity.resolution,
        };
      }

      if (terminal(currentActivity) && !terminal(incomingActivity)) {
        return explicitReactivation(incomingActivity)
          ? incomingActivity
          : { ...incomingActivity, resolution: currentActivity.resolution };
      }

      return incomingActivity;
    });
  }
  return result;
};

export const reopenActivityResolution = (
  activity: Activity,
  year: number,
  periodIndex: number,
  at = new Date().toISOString(),
): Activity => {
  const previous = activity.resolution?.resolutionStatus;
  if (previous !== 'completed_later' && previous !== 'discarded' && previous !== 'rescheduled') return activity;
  return {
    ...activity,
    resolution: {
      ...activity.resolution,
      resolutionStatus: 'reopened',
      reopenedAt: at,
      previousResolutionStatus: previous,
      resolutionHistory: [
        ...(activity.resolution?.resolutionHistory || []),
        { event: 'reopened', at, year, periodIndex, previousResolutionStatus: previous },
      ],
    },
  };
};
