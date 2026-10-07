import type { DashboardItem } from '../types';
import { isMonthlyPeriodOverdue } from './compliance';
import { cleanActivityId, getOperationalContinuityCommitments } from './continuityAdapter';
import type { TrackingPeriod } from './trackingObligation';

/**
 * Canonical source of "ACCIONES POR ATENDER".
 * Shared by CurrentPeriodFocus (UI tab) and CONTROL (buildPendingItems) so both
 * surfaces always agree on which inherited actions/commitments are still active.
 */
export interface PendingKpiActivity {
  id: string;
  sourceActivityId: string;
  label: string;
  periodIndex: number;
  periodLabel: string;
  commitmentLabel?: string;
  rescheduleHistory?: any[];
  status:
    | "PENDIENTE"
    | "ATENCIÓN"
    | "ATRASADA"
    | "REPROGRAMADA"
    | "COMPROMISO ACTUAL";
}

export const compareCalendarPeriods = (
  leftYear: number,
  leftPeriodIndex: number,
  rightYear: number,
  rightPeriodIndex: number,
): -1 | 0 | 1 => {
  if (leftYear !== rightYear) return leftYear < rightYear ? -1 : 1;
  if (leftPeriodIndex === rightPeriodIndex) return 0;
  return leftPeriodIndex < rightPeriodIndex ? -1 : 1;
};

/** Statuses rendered under "REQUIERE ATENCIÓN"; the rest are "EN SEGUIMIENTO". */
export const FOLLOW_UP_STATUSES: ReadonlyArray<PendingKpiActivity["status"]> = ["REPROGRAMADA", "COMPROMISO ACTUAL"];

/**
 * @param isOriginOverdue Optional deterministic override for legacy activities.
 *   The UI keeps the historical wall-clock rule; CONTROL evaluates against the
 *   requested business period (e.g. `(index) => index < period.monthIndex`).
 */
export const derivePendingKpiActivities = (
  activityConfig: DashboardItem["activityConfig"],
  currentIndex: number,
  isWeekly: boolean,
  year: number,
  item?: DashboardItem,
  isOriginOverdue?: (periodIndex: number) => boolean,
): PendingKpiActivity[] => {
  if (!activityConfig && !item?.continuityCommitments) return [];
  const labels = isWeekly
    ? (index: number) => `S${index + 1}`
    : (index: number) =>
        [
          "Ene",
          "Feb",
          "Mar",
          "Abr",
          "May",
          "Jun",
          "Jul",
          "Ago",
          "Sep",
          "Oct",
          "Nov",
          "Dic",
        ][index] || `P${index + 1}`;

  const canonicalCommitments = item ? getOperationalContinuityCommitments(item) : [];
  const mappedActivityIds = new Set<string>();
  canonicalCommitments.forEach((c) => {
    if (c.sourceActivityId) {
      mappedActivityIds.add(c.sourceActivityId);
    }
  });
  // Same identity rule as getVisibleContinuityState: the `activity:<id>` key maps the source activity.
  Object.entries(item?.continuityCommitments || {}).forEach(([key, c]) => {
    if (key.startsWith('activity:') && canonicalCommitments.includes(c)) mappedActivityIds.add(cleanActivityId(key));
  });

  const canonicalPending: PendingKpiActivity[] = canonicalCommitments
    .filter((c) => c.status === "active")
    .map((c) => {
      const scheduled = c.scheduledPeriod;
      const scheduledYear = c.scheduledYear || year;
      const origin = `${labels(c.originPeriod)} · ${c.originYear}`;
      const commitment = `${labels(scheduled)} · ${scheduledYear}`;
      const isOverdue = compareCalendarPeriods(scheduledYear, scheduled, year, currentIndex) < 0;
      const isCurrent = compareCalendarPeriods(scheduledYear, scheduled, year, currentIndex) === 0;

      let label = c.sourceActivityId;
      if (activityConfig) {
        for (const raw of Object.values(activityConfig)) {
          const found = raw.find((a) => a.id === c.sourceActivityId);
          if (found?.label) {
            label = found.label;
            break;
          }
        }
      }
      if (!label || label === c.sourceActivityId) {
        label = c.resolutionHistory?.[0]?.reason || item?.indicator || "Compromiso de continuidad";
      }

      return {
        id: c.id,
        sourceActivityId: c.sourceActivityId || c.id,
        label,
        periodIndex: c.originPeriod,
        periodLabel: `ORIGEN ${origin} → COMPROMISO ${commitment}`,
        commitmentLabel: commitment,
        rescheduleHistory: c.rescheduleHistory,
        status: isOverdue
          ? ("ATRASADA" as const)
          : isCurrent
            ? ("COMPROMISO ACTUAL" as const)
            : ("REPROGRAMADA" as const),
      };
    });

  const legacyPending = Object.entries(activityConfig || {}).flatMap(([period, raw]) => {
    const periodIndex = Number(period);
    const originOverdue = isOriginOverdue
      ? isOriginOverdue(periodIndex)
      : isWeekly
        ? year < new Date().getFullYear() ||
          (year === new Date().getFullYear() && periodIndex < currentIndex)
        : isMonthlyPeriodOverdue(year, periodIndex);
    if (!Number.isFinite(periodIndex) || !Array.isArray(raw)) return [];

    return raw
      .filter((activity) => {
        if (mappedActivityIds.has(activity.id)) return false;
        return (
          Number(activity.completedCount) < Number(activity.targetCount) &&
          !["completed_later", "discarded"].includes(
            activity.resolution?.resolutionStatus || "",
          ) &&
          !(
            activity.resolution?.resolutionStatus === "rescheduled" &&
            activity.resolution.scheduledResolutionPeriodIndex !== undefined &&
            compareCalendarPeriods(
              activity.resolution.scheduledResolutionYear || year,
              activity.resolution.scheduledResolutionPeriodIndex,
              year,
              currentIndex,
            ) > 0 &&
            currentIndex === activity.resolution.scheduledResolutionPeriodIndex
          )
        );
      })
      .map((activity) => {
        const scheduled =
          activity.resolution?.resolutionStatus === "rescheduled"
            ? activity.resolution.scheduledResolutionPeriodIndex
            : undefined;
        const scheduledYear =
          activity.resolution?.scheduledResolutionYear || year;
        const origin = `${labels(periodIndex)} · ${year}`;
        const commitment =
          scheduled === undefined
            ? undefined
            : `${labels(scheduled)} · ${scheduledYear}`;
        if (scheduled === undefined && !originOverdue) return null;
        return {
          id: `${periodIndex}:${activity.id}`,
          sourceActivityId: activity.id,
          label: activity.label,
          periodIndex,
          periodLabel: commitment
            ? `ORIGEN ${origin} → COMPROMISO ${commitment}`
            : origin,
          commitmentLabel: commitment,
          rescheduleHistory: activity.resolution?.rescheduleHistory,
          status:
            scheduled === undefined
              ? periodIndex < currentIndex
                ? ("ATRASADA" as const)
                : Number(activity.completedCount) > 0
                  ? ("ATENCIÓN" as const)
                  : ("PENDIENTE" as const)
              : compareCalendarPeriods(scheduledYear, scheduled, year, currentIndex) < 0
                ? ("ATRASADA" as const)
                : compareCalendarPeriods(scheduledYear, scheduled, year, currentIndex) === 0
                  ? ("COMPROMISO ACTUAL" as const)
                  : ("REPROGRAMADA" as const),
        };
      })
      .filter(Boolean) as PendingKpiActivity[];
  });

  const allPending = [...canonicalPending, ...legacyPending];

  return Array.from(
    allPending
      .reduce(
        (unique, activity) =>
          unique.set(activity.id, unique.get(activity.id) || activity),
        new Map<string, PendingKpiActivity>(),
      )
      .values(),
  );
};

export interface ActiveOperationalWork {
  /** Overdue/unresolved inherited work ("REQUIERE ATENCIÓN"). */
  attention: PendingKpiActivity[];
  /** Active commitments scheduled exactly in the evaluated period. */
  currentCommitments: PendingKpiActivity[];
}

/**
 * Deterministic, period-based view of active operational work for CONTROL.
 * Future (REPROGRAMADA) commitments are intentionally excluded: they must not
 * be demanded early nor mask a real configuration gap.
 *
 * @example
 * const work = getActiveOperationalWork(item, { frequency: 'monthly', year: 2026, monthIndex: 9 });
 * if (work.attention.length > 0) { // inherited work → REGISTRAR AVANCE, not CONFIGURAR }
 */
export const getActiveOperationalWork = (item: DashboardItem, period: TrackingPeriod): ActiveOperationalWork => {
  const isWeekly = period.frequency === 'weekly';
  const index = isWeekly ? period.weekNumber - 1 : period.monthIndex;
  const commitments = Object.fromEntries(Object.entries(item.continuityCommitments || {}).filter(([, commitment]) =>
    !commitment.frequency || commitment.frequency === period.frequency));
  const scoped: DashboardItem = { ...item, continuityCommitments: commitments };
  const work = derivePendingKpiActivities(item.activityConfig, index, isWeekly, period.year, scoped, (origin) => origin < index);
  return {
    attention: work.filter((activity) => !FOLLOW_UP_STATUSES.includes(activity.status)),
    currentCommitments: work.filter((activity) => activity.status === 'COMPROMISO ACTUAL'),
  };
};
