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
      if (!terminal(currentActivity)) return currentActivity;
      const incomingActivity = incomingRaw.find((a) => a.id === currentActivity.id);
      if (!incomingActivity) return currentActivity;
      // A completed/discarded snapshot must not be erased by a stale plain
      // activity, but an explicit newer transition is authoritative. In
      // particular, REABRIR must be allowed to replace completed_later.
      if (!terminal(incomingActivity)) {
        return explicitReactivation(incomingActivity)
          ? incomingActivity
          : currentActivity;
      }
      return resolutionAt(incomingActivity) >= resolutionAt(currentActivity)
        ? incomingActivity
        : currentActivity;
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
