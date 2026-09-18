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
  for (const [period, currentRaw] of Object.entries(current || {})) {
    if (!Array.isArray(currentRaw)) continue;
    const incomingRaw = Array.isArray(result[period]) ? result[period] : [];
    result[period] = currentRaw.map((currentActivity) => {
      const incomingActivity = incomingRaw.find((a) => a.id === currentActivity.id);
      if (!incomingActivity) return currentActivity;

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
    }).concat(incomingRaw.filter((a) => !currentRaw.some((c) => c.id === a.id)));
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
