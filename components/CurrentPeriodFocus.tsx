import React, { useState, useMemo, useEffect, useRef } from "react";
import { DashboardItem, ComplianceThresholds, TrackingStartPeriod } from "../types";
import { TrackingStartPeriodControls, formatTrackingStartPeriod } from './TrackingStartPeriodControls';
import { getEffectiveTrackingStartPeriod, hasTrackingFactsBeforePeriod } from '../utils/trackingObligation';
import { RelatedActionPlans } from "./RelatedActionPlans";
import {
  calculateCompliance,
  findLastIndexWithData,
  resolveItemValues,
  isMonthlyPeriodOverdue,
} from "../utils/compliance";
import { getWeekNumber, getYearWeekMapping } from "../utils/weeklyUtils";
import { ProgressBar } from "./ProgressBar";
import { LineChart } from "./LineChart";
import { ActionPlan } from "./ActionPlan";
import { DataEditor } from "./DataEditor";
import { ActivityManager } from "./ActivityManager";
import { ContinuityWorkspace } from "./continuity/ContinuityWorkspace";
import { getDiscardedContinuityCommitments, getEffectiveKpiProgressByPeriod, getOperationalContinuityCommitments } from "../utils/continuityAdapter";
import {
  formatNumberWithCommas,
  parseFormattedNumber,
  formatIndicatorValue,
  getCleanIndicatorName,
  formatMonthlyGoal,
  formatMonthlyProgress,
} from "../utils/formatters";
import { buildResolutionHistory, type ResolutionHistoryRow } from "../utils/resolutionHistory";
import { reopenActivityResolution } from "../utils/activityResolutionMerge";

interface CurrentPeriodFocusProps {
  item: DashboardItem;
  globalThresholds: ComplianceThresholds;
  year?: number;
  onUpdateItem: (updatedItem: DashboardItem) => Promise<void> | void;
  canEdit: boolean;
  canEditPlans?: boolean;
  onClose: () => void;
  allDashboardItems?: DashboardItem[];
  decimalPrecision?: 0 | 1 | 2;
  dashboardId?: number | string;
  clientId?: string;
  initialActionPlanId?: number | string;
  onActionPlanExit?: () => void;
  dashboardTrackingStartPeriod?: TrackingStartPeriod;
  clientTrackingStartPeriod?: TrackingStartPeriod;
  canConfigureTracking?: boolean;
}

export interface PendingKpiActivity {
  id: string;
  sourceActivityId: string;
  label: string;
  periodIndex: number;
  periodLabel: string;
  commitmentLabel?: string;
  rescheduleHistory?: {
    fromYear: number;
    fromPeriodType: "monthly" | "weekly";
    fromPeriodIndex: number;
    toYear: number;
    toPeriodType: "monthly" | "weekly";
    toPeriodIndex: number;
    changedAt: string;
  }[];
  status:
    | "PENDIENTE"
    | "ATENCIÓN"
    | "ATRASADA"
    | "REPROGRAMADA"
    | "COMPROMISO ACTUAL";
}
export interface RescheduledKpiCommitment extends PendingKpiActivity {
  scheduledPeriodIndex: number;
  scheduledPeriodLabel: string;
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

export const deriveRescheduledKpiCommitments = (
  activityConfig: DashboardItem["activityConfig"],
  periodIndex: number,
  isWeekly: boolean,
  year: number,
  item?: DashboardItem,
): RescheduledKpiCommitment[] => {
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

  const canonical = item ? getOperationalContinuityCommitments(item).filter(
    (c) =>
      c.status === "active" &&
      c.scheduledPeriod === periodIndex &&
      (c.scheduledYear || year) === year &&
      (c.rescheduleHistory?.length > 0 || c.scheduledPeriod !== c.originPeriod),
  ) : [];

  const canonicalMap = new Map(canonical.map((c) => [c.sourceActivityId, c]));

  const canonicalResults: RescheduledKpiCommitment[] = canonical.map((c) => {
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
      periodLabel: `${labels(c.originPeriod)} · ${c.originYear}`,
      scheduledPeriodIndex: c.scheduledPeriod,
      scheduledPeriodLabel: `${labels(c.scheduledPeriod)} · ${c.scheduledYear || year}`,
      status: "COMPROMISO ACTUAL" as const,
    };
  });

  if (!activityConfig) return canonicalResults;

  const legacyResults = Object.entries(activityConfig).flatMap(([period, raw]) => {
    if (!Array.isArray(raw)) return [];
    return raw
      .filter(
        (a) =>
          !canonicalMap.has(a.id) &&
          a.resolution?.resolutionStatus === "rescheduled" &&
          a.resolution.scheduledResolutionYear === year &&
          a.resolution.scheduledResolutionPeriodType ===
            (isWeekly ? "weekly" : "monthly") &&
          a.resolution.scheduledResolutionPeriodIndex === periodIndex &&
          Number(a.completedCount) < Number(a.targetCount),
      )
      .map((a) => ({
        id: `${period}:${a.id}`,
        sourceActivityId: a.id,
        label: a.label,
        periodIndex: Number(period),
        periodLabel: `${labels(Number(period))} · ${year}`,
        scheduledPeriodIndex: periodIndex,
        scheduledPeriodLabel: `${labels(periodIndex)} · ${year}`,
        status: "COMPROMISO ACTUAL" as const,
      }));
  });

  return [...canonicalResults, ...legacyResults];
};

export const RescheduledCommitmentsSection: React.FC<{
  commitments: RescheduledKpiCommitment[];
  onManage: (commitment: RescheduledKpiCommitment) => void;
  onViewActions?: () => void;
  renderManager?: (commitment: RescheduledKpiCommitment) => React.ReactNode;
}> = ({ commitments, onManage, onViewActions, renderManager }) =>
  commitments.length === 0 ? null : (
    <section aria-label="Compromisos de continuidad en seguimiento" className="rounded-2xl border border-cyan-500/25 bg-slate-950/60 p-3.5 shadow-md flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="text-base">⚡</span>
        <div className="min-w-0">
          <p className="text-xs font-bold text-white truncate">
            {commitments.length === 1
              ? '1 compromiso en seguimiento'
              : `${commitments.length} compromisos en seguimiento`}
          </p>
          <p className="text-[10px] text-slate-400">
            Gestionables desde la pestaña Acciones por Atender
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => {
          if (onViewActions) {
            onViewActions();
          } else if (commitments[0]) {
            onManage(commitments[0]);
          }
        }}
        className="shrink-0 rounded-xl bg-cyan-500/20 border border-cyan-500/40 px-3.5 py-2 text-[10px] font-black uppercase tracking-wider text-cyan-200 hover:bg-cyan-500/30 hover:text-white transition-all min-h-[44px]"
      >
        VER ACCIONES
      </button>
      {renderManager && commitments[0] && renderManager(commitments[0])}
    </section>
  );

export const applyOperationalReschedule = (
  activityConfig: DashboardItem["activityConfig"],
  originPeriodIndex: number,
  activityId: string,
  scheduledPeriodIndex: number,
  isWeekly: boolean,
  year: number,
): DashboardItem["activityConfig"] => {
  const config = { ...(activityConfig || {}) };
  const source = [...(config[originPeriodIndex] || [])];
  const index = source.findIndex((activity) => activity.id === activityId);
  if (index < 0) return config;
  const previous = source[index].resolution;
  const nextType: "weekly" | "monthly" = isWeekly ? "weekly" : "monthly";
  const history = [
    ...(previous?.rescheduleHistory || []),
    ...(previous?.scheduledResolutionPeriodIndex === undefined
      ? [
          {
            fromYear: year,
            fromPeriodType: nextType,
            fromPeriodIndex: originPeriodIndex,
            toYear: year,
            toPeriodType: nextType,
            toPeriodIndex: scheduledPeriodIndex,
            changedAt: new Date().toISOString(),
          },
        ]
      : [
          {
            fromYear: previous.scheduledResolutionYear || year,
            fromPeriodType: previous.scheduledResolutionPeriodType || nextType,
            fromPeriodIndex: previous.scheduledResolutionPeriodIndex,
            toYear: year,
            toPeriodType: nextType,
            toPeriodIndex: scheduledPeriodIndex,
            changedAt: new Date().toISOString(),
          },
        ]),
  ];
  source[index] = {
    ...source[index],
    resolution: {
      ...previous,
      resolutionStatus: "rescheduled",
      scheduledResolutionYear: year,
      scheduledResolutionPeriodType: nextType,
      scheduledResolutionPeriodIndex: scheduledPeriodIndex,
      rescheduleHistory: history,
    },
  };
  config[originPeriodIndex] = source;
  return config;
};

export const derivePendingKpiActivities = (
  activityConfig: DashboardItem["activityConfig"],
  currentIndex: number,
  isWeekly: boolean,
  year: number,
  item?: DashboardItem,
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
    const originOverdue = isWeekly
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

export const getFirstMeaningfulTrackingIndex = (
  item: DashboardItem,
  progress: (number | null)[] = item.monthlyProgress || [],
  goals: (number | null)[] = item.monthlyGoals || [],
): number => {
  const configured = (item as DashboardItem & { trackingStartMonth?: number }).trackingStartMonth;
  if (Number.isInteger(configured) && configured >= 0 && configured < 12) return configured;
  const goalCaptured = item.monthlyGoalCaptured || [];
  const progressCaptured = item.monthlyProgressCaptured || [];
  const marked = [...Array(12).keys()].find(i => goalCaptured[i] === true || progressCaptured[i] === true);
  if (marked !== undefined) return marked;
  const legacy = [...Array(12).keys()].find(i => Number(progress[i]) > 0 || Number(goals[i]) > 0);
  return legacy === undefined ? 12 : legacy;
};

export const CurrentPeriodFocus: React.FC<CurrentPeriodFocusProps> = ({
  item,
  globalThresholds,
  year,
  onUpdateItem,
  canEdit,
  canEditPlans = false,
  onClose,
  allDashboardItems = [],
  decimalPrecision = 0,
  dashboardId,
  clientId,
  initialActionPlanId,
  onActionPlanExit,
  dashboardTrackingStartPeriod,
  clientTrackingStartPeriod,
  canConfigureTracking = false,
}) => {
  const [localGoal, setLocalGoal] = useState<string>("");
  const [localActual, setLocalActual] = useState<string>("");
  const [localNote, setLocalNote] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [isFullEditMode, setIsFullEditMode] = useState(false);
  const [plansFocused, setPlansFocused] = useState(Boolean(initialActionPlanId));
  const plansSectionRef = useRef<HTMLDivElement | null>(null);
  const indicatorSectionRef = useRef<HTMLDivElement | null>(null);
  const [isActivityManagerOpen, setIsActivityManagerOpen] = useState(false);
  const [activityTab, setActivityTab] = useState<"current" | "pending" | "history">(
    "current",
  );
  const [managedPending, setManagedPending] =
    useState<PendingKpiActivity | null>(null);
  const [reopenCandidate, setReopenCandidate] = useState<ResolutionHistoryRow | null>(null);
  const [pendingAction, setPendingAction] = useState<
    "idle" | "complete" | "discard" | "reschedule"
  >("idle");
  const [rescheduleTarget, setRescheduleTarget] = useState<number>(0);
  const [pendingNote, setPendingNote] = useState("");
  const [pendingSaving, setPendingSaving] = useState(false);
  const [pendingError, setPendingError] = useState("");
  const [pendingFeedback, setPendingFeedback] = useState("");
  const [activityMode, setActivityMode] = useState(
    item.isActivityMode || false,
  );
  const [isGoalFocused, setIsGoalFocused] = useState(false);
  const [isActualFocused, setIsActualFocused] = useState(false);
  const [editingTracking, setEditingTracking] = useState(false);
  const [trackingDraft, setTrackingDraft] = useState<TrackingStartPeriod | undefined>(item.trackingStartPeriod);
  const [confirmInherit, setConfirmInherit] = useState(false);
  const [trackingFeedback, setTrackingFeedback] = useState('');
  const [trackingBlocked, setTrackingBlocked] = useState('');
  const [confirmTrackingSave, setConfirmTrackingSave] = useState(false);
  const [isDiscardedExpanded, setIsDiscardedExpanded] = useState(false);
  const scrollToView = (ref: React.RefObject<HTMLDivElement | null>) => {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      ref.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    }));
  };
  useEffect(() => {
    const openPlansForDirectNavigation = Boolean(initialActionPlanId);
    setPlansFocused(openPlansForDirectNavigation);
    if (openPlansForDirectNavigation) {
      scrollToView(plansSectionRef);
    }
  }, [item.id, initialActionPlanId]);
  const openPlans = () => {
    setPlansFocused(true);
    scrollToView(plansSectionRef);
  };
  const returnToIndicator = () => {
    setPlansFocused(false);
    scrollToView(indicatorSectionRef);
  };
  const effectiveTracking = getEffectiveTrackingStartPeriod(item, { defaultTrackingStartPeriod: dashboardTrackingStartPeriod }, { defaultTrackingStartPeriod: clientTrackingStartPeriod });
  const saveTrackingOverride = async () => {
    if (!trackingDraft) return;
    const facts = hasTrackingFactsBeforePeriod(isWeekly ? 'weekly' : 'monthly', year || currentYear, trackingDraft, isWeekly ? weeklyGoals : monthlyGoals, isWeekly ? weeklyProgress : monthlyProgress, isWeekly ? undefined : item.monthlyGoalCaptured, isWeekly ? undefined : item.monthlyProgressCaptured);
    if (facts.hasFacts) { setTrackingBlocked(`No se puede cambiar el inicio a ${formatTrackingStartPeriod(trackingDraft)}. Este indicador ya tiene información registrada en ${formatTrackingStartPeriod(facts.firstPeriod)}: Meta ${facts.goal ?? '—'} · Avance ${facts.progress ?? '—'}. El inicio no puede dejar fuera periodos con información real.`); return; }
    setConfirmTrackingSave(true);
  };

  const {
    indicator,
    unit,
    monthlyProgress = [],
    monthlyGoals = [],
    monthlyNotes = [],
    frequency,
    weeklyProgress = [],
    weeklyGoals = [],
    weeklyNotes = [],
    weekStart,
    type,
  } = item || {
    indicator: "",
    unit: "",
    monthlyProgress: [],
    monthlyGoals: [],
    monthlyNotes: [],
    frequency: "monthly",
    weeklyProgress: [],
    weeklyGoals: [],
    weeklyNotes: [],
    weekStart: "Mon",
    type: "simple",
  };
  const monthlyProgressCaptured = item.monthlyProgressCaptured || [];

  const [activePeriodIdx, setActivePeriodIdx] = useState<number>(-1);

  const isWeekly = frequency === "weekly";
  const currentYear = new Date().getFullYear();
  const currentMonthIdx = new Date().getMonth();
  const isPastYear = year && year < currentYear;

  const { periodIdx, periodLabel, detailedRange } = useMemo(() => {
    if (!item) return { periodIdx: 0, periodLabel: "", detailedRange: "" };
    const startDayNumeric = weekStart === "Sun" ? 0 : 1;
    const mapping = getYearWeekMapping(year || currentYear, startDayNumeric);

    if (isWeekly) {
      const week = getWeekNumber(new Date(), startDayNumeric);
      const idx = isPastYear ? 51 : Math.max(0, Math.min(52, week - 1));
      const range = mapping[idx];
      const rangeStr = range
        ? `${range.startDate.toLocaleDateString("es", { day: "2-digit" })} al ${range.endDate.toLocaleDateString("es", { day: "2-digit", month: "long" })}`
        : "";
      return {
        periodIdx: idx,
        periodLabel: `Semana ${idx + 1}`,
        detailedRange: rangeStr,
      };
    } else {
      const lastWithData = findLastIndexWithData(monthlyProgress, monthlyGoals);
      const idx = isPastYear
        ? 11
        : lastWithData >= 0
          ? lastWithData
          : Math.max(0, currentMonthIdx - 1);
      const monthNames = [
        "Enero",
        "Febrero",
        "Marzo",
        "Abril",
        "Mayo",
        "Junio",
        "Julio",
        "Agosto",
        "Septiembre",
        "Octubre",
        "Noviembre",
        "Diciembre",
      ];
      return {
        periodIdx: idx,
        periodLabel: monthNames[idx],
        detailedRange: "",
      };
    }
  }, [
    isWeekly,
    isPastYear,
    monthlyProgress,
    monthlyGoals,
    weekStart,
    year,
    currentYear,
    currentMonthIdx,
    item,
  ]);

  useEffect(() => {
    if (activePeriodIdx === -1) {
      setActivePeriodIdx(periodIdx);
    }
  }, [periodIdx]);

  const currentIdx = activePeriodIdx === -1 ? periodIdx : activePeriodIdx;
  const pendingCurrentIdx = isWeekly
    ? currentIdx
    : year && year < currentYear
      ? 11
      : year && year > currentYear
        ? 0
        : new Date().getMonth();

  const pendingKpiActivities = useMemo(
    () =>
      derivePendingKpiActivities(
        item?.activityConfig,
        pendingCurrentIdx,
        isWeekly,
        year || currentYear,
        item,
      ),
    [item?.activityConfig, item?.continuityCommitments, pendingCurrentIdx, isWeekly, year, currentYear, item],
  );

  const visiblePendingKpiActivities = useMemo(() => {
    if (!managedPending || pendingKpiActivities.some(activity => activity.id === managedPending.id)) {
      return pendingKpiActivities;
    }
    return [...pendingKpiActivities, managedPending];
  }, [pendingKpiActivities, managedPending]);

  const attentionActivities = useMemo(
    () => visiblePendingKpiActivities.filter(activity => !["REPROGRAMADA", "COMPROMISO ACTUAL"].includes(activity.status)),
    [visiblePendingKpiActivities],
  );

  const followUpActivities = useMemo(
    () => visiblePendingKpiActivities.filter(activity => ["REPROGRAMADA", "COMPROMISO ACTUAL"].includes(activity.status)),
    [visiblePendingKpiActivities],
  );

  const discardedCommitments = useMemo(
    () => getDiscardedContinuityCommitments(item),
    [item?.continuityCommitments],
  );

  const discardedActivities = useMemo(() => {
    const labels = isWeekly
      ? (index: number) => `S${index + 1}`
      : (index: number) =>
          [
            'Ene',
            'Feb',
            'Mar',
            'Abr',
            'May',
            'Jun',
            'Jul',
            'Ago',
            'Sep',
            'Oct',
            'Nov',
            'Dic',
          ][index] || `P${index + 1}`;
    return discardedCommitments.map((commitment) => {
      let foundLabel = (item.activityConfig?.[commitment.originPeriod] || []).find(
        (activity) => activity.id === commitment.sourceActivityId,
      )?.label;
      if (!foundLabel && item.activityConfig) {
        for (const acts of Object.values(item.activityConfig)) {
          const act = acts.find((a) => a.id === commitment.sourceActivityId);
          if (act?.label) {
            foundLabel = act.label;
            break;
          }
        }
      }
      return {
        id: commitment.id,
        sourceActivityId: commitment.sourceActivityId,
        label: foundLabel || commitment.sourceActivityId,
        periodIndex: commitment.originPeriod,
        periodLabel: `${labels(commitment.originPeriod)} · ${commitment.originYear}`,
        commitmentLabel: `${labels(commitment.scheduledPeriod)} · ${commitment.scheduledYear}`,
        status: 'DESCARTADO' as const,
      };
    });
  }, [discardedCommitments, item.activityConfig, isWeekly]);

  const updateKpiContinuityProgress = async (period: number, value: number | null) => {
    if (isWeekly) {
      const nextProgress = [...(weeklyProgress || Array(53).fill(null))];
      nextProgress[period] = value;
      await onUpdateItem({ ...item, weeklyProgress: nextProgress });
    } else {
      const nextProgress = [...(monthlyProgress || Array(12).fill(null))];
      const nextCaptured = [...(monthlyProgressCaptured || Array(12).fill(false))];
      nextProgress[period] = value === null ? 0 : value;
      nextCaptured[period] = value !== null;
      await onUpdateItem({
        ...item,
        monthlyProgress: nextProgress,
        monthlyProgressCaptured: nextCaptured,
      });
    }
  };

  const rescheduledCommitments = useMemo(
    () =>
      deriveRescheduledKpiCommitments(
        item?.activityConfig,
        currentIdx,
        isWeekly,
        year || currentYear,
        item,
      ),
    [item?.activityConfig, currentIdx, isWeekly, year, currentYear, item],
  );

  const resolutionHistory = useMemo(() => buildResolutionHistory(item, year || currentYear).filter(row => row.status !== 'REPROGRAMADO'), [item, year, currentYear]);
  const reopenResolution = async (row: ResolutionHistoryRow) => {
    const config = { ...(item.activityConfig || {}) };
    const source = [...(config[row.originalPeriodIndex] || [])];
    const index = source.findIndex(activity => activity.id === row.activityId);
    if (index < 0) return;
    source[index] = reopenActivityResolution(source[index], year || currentYear, currentIdx);
    await onUpdateItem({ ...item, activityConfig: { ...config, [row.originalPeriodIndex]: source } });
    setReopenCandidate(null);
    setActivityTab("pending");
  };

  useEffect(() => {
    if (pendingAction === "reschedule" && managedPending) {
      setRescheduleTarget(Math.min(managedPending.periodIndex + 1, isWeekly ? 52 : 11));
    }
  }, [pendingAction, managedPending, isWeekly]);

  const resolvePendingActivity = async (
    pending: PendingKpiActivity,
    status: "completed_later" | "discarded",
    note = "",
  ) => {
    if (status === "discarded" && !note.trim()) return;
    setPendingSaving(true);
    setPendingError("");
    const config = { ...(item.activityConfig || {}) };
    const source = [...(config[pending.periodIndex] || [])];
    const index = source.findIndex((a) => a.id === pending.sourceActivityId);
    if (index < 0) {
      setPendingSaving(false);
      return;
    }
    source[index] = {
      ...source[index],
      resolution: {
        resolutionStatus: status,
        resolvedAt: new Date().toISOString(),
        resolvedYear: year || currentYear,
        resolvedPeriodType: isWeekly ? "weekly" : "monthly",
        resolvedPeriodIndex: currentIdx,
        ...(status === "discarded" ? { resolutionNote: note.trim() } : {}),
      },
    };
    try {
      await onUpdateItem({
        ...item,
        activityConfig: { ...config, [pending.periodIndex]: source },
      });
    } catch {
      setPendingError("No se pudo guardar la resolución.");
      setPendingSaving(false);
      return;
    }
    setPendingSaving(false);
    setManagedPending(null);
    setPendingAction("idle");
    setPendingFeedback(`Reprogramado a ${isWeekly ? `la semana ${rescheduleTarget + 1}` : ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"][rescheduleTarget]}`);
    setPendingNote("");
    setPendingFeedback(
      status === "discarded" ? "Actividad descartada" : "Actividad completada",
    );
  };

  const reschedulePendingActivity = async (pending: PendingKpiActivity) => {
    if (rescheduleTarget <= pending.periodIndex) return;
    setPendingSaving(true);
    setPendingError("");
    const config = applyOperationalReschedule(
      item.activityConfig,
      pending.periodIndex,
      pending.sourceActivityId,
      rescheduleTarget,
      isWeekly,
      year || currentYear,
    );
    try {
      await onUpdateItem({ ...item, activityConfig: config });
    } catch {
      setPendingError("No se pudo guardar la reprogramación.");
      setPendingSaving(false);
      return;
    }
    setPendingSaving(false);
    setManagedPending(null);
    setPendingAction("idle");
  };

  const currentPeriodLabel = useMemo(() => {
    if (isWeekly) return `Semana ${currentIdx + 1}`;
    const monthNames = [
      "Enero",
      "Febrero",
      "Marzo",
      "Abril",
      "Mayo",
      "Junio",
      "Julio",
      "Agosto",
      "Septiembre",
      "Octubre",
      "Noviembre",
      "Diciembre",
    ];
    return monthNames[currentIdx];
  }, [isWeekly, currentIdx]);

  const virtualItem = useMemo(() => {
    if (!item) return null;
    const v = { ...item };
    const gVal = localGoal === "" ? null : parseFloat(localGoal);
    const aVal = localActual === "" ? null : parseFloat(localActual);

    if (isWeekly) {
      v.weeklyGoals = [...(item.weeklyGoals || Array(53).fill(null))];
      v.weeklyGoals[currentIdx] = gVal;
      v.weeklyProgress = [...(item.weeklyProgress || Array(53).fill(null))];
      v.weeklyProgress[currentIdx] = aVal;
    } else {
      v.monthlyGoals = [...(item.monthlyGoals || Array(12).fill(null))];
      v.monthlyGoals[currentIdx] = gVal;
      v.monthlyProgress = [...(item.monthlyProgress || Array(12).fill(null))];
      v.monthlyProgress[currentIdx] = aVal;
    }
    return v;
  }, [item, localGoal, localActual, isWeekly, currentIdx]);

  const compliance = useMemo(() => {
    if (!virtualItem)
      return {
        currentProgress: 0,
        currentTarget: 0,
        overallPercentage: 0,
        complianceStatus: "Neutral",
      };
    return calculateCompliance(
      virtualItem,
      globalThresholds,
      year,
      "realTime",
      allDashboardItems,
    );
  }, [virtualItem, globalThresholds, year, allDashboardItems]);

  useEffect(() => {
    if (!item) return;
    const isCalculatedItem =
      item.indicatorType === "formula" || item.indicatorType === "compound";

    let goal: any = null;
    let actual: any = null;

    if (isCalculatedItem && allDashboardItems.length > 0) {
      const { monthlyProgress: mP, monthlyGoals: mG } = resolveItemValues(
        item,
        allDashboardItems,
        year,
      );
      goal = mG[currentIdx];
      actual = mP[currentIdx];
    } else {
      goal = isWeekly
        ? item.weeklyGoals?.[currentIdx]
        : item.monthlyGoals?.[currentIdx];
      actual = isWeekly
        ? item.weeklyProgress?.[currentIdx]
        : item.monthlyProgress?.[currentIdx];
    }

    const note =
      (isWeekly
        ? item.weeklyNotes?.[currentIdx]
        : item.monthlyNotes?.[currentIdx]) || "";

    const strGoal = goal !== null && goal !== undefined ? goal.toString() : "";
    const actualCaptured = isWeekly
      ? actual !== null && actual !== undefined
      : item.monthlyProgressCaptured?.[currentIdx] === true ||
        (item.monthlyProgressCaptured?.[currentIdx] === undefined && Number(actual) > 0);
    const strActual = actualCaptured && actual !== null && actual !== undefined ? actual.toString() : "";

    if (
      strGoal !== localGoal ||
      strActual !== localActual ||
      note !== localNote
    ) {
      setLocalGoal(strGoal);
      setLocalActual(strActual);
      setLocalNote(note);
    }

    if (item.isActivityMode !== undefined) {
      setActivityMode(item.isActivityMode);
    }
  }, [item, currentIdx, isWeekly, allDashboardItems, year]);

  const chartData = useMemo(() => {
    if (!item) return { progress: [], goals: [] };
    const isCalculatedItem =
      item.indicatorType === "formula" || item.indicatorType === "compound";

    let resolvedP = (isWeekly ? weeklyProgress : monthlyProgress) || [];
    let resolvedG = (isWeekly ? weeklyGoals : monthlyGoals) || [];

    if (isCalculatedItem && allDashboardItems.length > 0) {
      const res = resolveItemValues(item, allDashboardItems, year);
      resolvedP = res.monthlyProgress;
      resolvedG = res.monthlyGoals;
    } else if (!isWeekly) {
      resolvedP = Array.from({ length: 12 }, (_, i) => getEffectiveKpiProgressByPeriod(item, i));
      const canonicalCommitments = Object.values(item.continuityCommitments || {});
      const activeCommitment = canonicalCommitments.find((c) => c.status === 'active' || c.status === 'discarded');
      if (activeCommitment && activeCommitment.sourceType !== 'SIMPLE_KPI' && activeCommitment.originalTarget > 0) {
        resolvedG = Array.from({ length: 12 }, (_, i) => {
          const explicit = item.monthlyGoals?.[i];
          const isCaptured = item.monthlyGoalCaptured?.[i];
          if (isCaptured && explicit !== null && explicit !== undefined && Number(explicit) > 0) {
            return Number(explicit);
          }
          if (i >= activeCommitment.originPeriod && i <= Math.max(activeCommitment.originPeriod, activeCommitment.scheduledPeriod, currentIdx)) {
            return activeCommitment.originalTarget;
          }
          return explicit !== null && explicit !== undefined && Number(explicit) > 0 ? Number(explicit) : null;
        });
      }
    }

    const firstTrackingIdx = isWeekly ? 0 : getFirstMeaningfulTrackingIndex(item, resolvedP, resolvedG);
    let limitIdx = isWeekly ? 52 : findLastIndexWithData(resolvedP, [], item.monthlyProgressCaptured);
    if (isWeekly && !isPastYear) {
      const idxNow = getWeekNumber(new Date(), weekStart === "Sun" ? 0 : 1) - 1;
      limitIdx = Math.min(limitIdx, Math.max(idxNow - 1, currentIdx));
    }

    if (isWeekly) {
      const prog = (weeklyProgress || []).slice(0, limitIdx + 1);
      const goals = (weeklyGoals || []).slice(0, limitIdx + 1);
      return {
        progress: prog.map((v) => (v !== null && v !== undefined ? v : null)),
        goals: goals.map((v) => (v !== null && v !== undefined ? v : null)),
        captured: undefined,
      };
    } else {
      const prog = (resolvedP || []).slice(0, limitIdx + 1).map((value, index) => index < firstTrackingIdx ? null : value);
      const goals = (resolvedG || []).slice(0, limitIdx + 1).map((value, index) => index < firstTrackingIdx ? null : value);
      return {
        progress: prog.map((v) => (v !== null && v !== undefined ? v : null)),
        goals: goals.map((v) => (v !== null && v !== undefined ? v : null)),
        captured: prog.map((v, index) => index < firstTrackingIdx ? false : item.monthlyProgressCaptured?.[index] === true || (item.monthlyProgressCaptured?.[index] === undefined && typeof v === 'number' && v > 0)),
        goalDefined: goals.map((v, index) => index < firstTrackingIdx ? false : item.monthlyGoalCaptured?.[index] === true || (item.monthlyGoalCaptured?.[index] === undefined && typeof v === 'number' && v > 0) || (resolvedG[index] !== null && Number(resolvedG[index]) > 0)),
      };
    }
  }, [
    monthlyProgress,
    monthlyGoals,
    weeklyProgress,
    weeklyGoals,
    isWeekly,
    year,
    currentYear,
    isPastYear,
    currentIdx,
    item,
    weekStart,
  ]);

  const handleQuickSave = async () => {
    if (!canEdit || !item) return;
    setIsSaving(true);
    try {
      const newGoalVal = localGoal === "" ? null : parseFormattedNumber(localGoal);
      const newActualVal = localActual === "" ? null : parseFormattedNumber(localActual);
      const updatedItem = {
        ...item,
        isActivityMode: activityMode,
        activityConfig: item.activityConfig || {},
      };
      if (isWeekly) {
        const newGoals = [...(weeklyGoals || Array(53).fill(null))];
        const newProgress = [...(weeklyProgress || Array(53).fill(null))];
        const newNotes = [...(weeklyNotes || Array(53).fill(""))];
        newGoals[currentIdx] = newGoalVal;
        newProgress[currentIdx] = newActualVal;
        newNotes[currentIdx] = localNote;
        updatedItem.weeklyGoals = newGoals;
        updatedItem.weeklyProgress = newProgress;
        updatedItem.weeklyNotes = newNotes;
      } else {
        const newGoals = [...(monthlyGoals || Array(12).fill(null))];
        const newProgress = [...(monthlyProgress || Array(12).fill(null))];
        const newNotes = [...(monthlyNotes || Array(12).fill(""))];
        newGoals[currentIdx] = newGoalVal;
        newProgress[currentIdx] = newActualVal;
        newNotes[currentIdx] = localNote;
        updatedItem.monthlyGoals = newGoals;
        updatedItem.monthlyGoalCaptured = [
          ...(item.monthlyGoalCaptured || Array(12).fill(false)),
        ];
        updatedItem.monthlyGoalCaptured[currentIdx] = newGoalVal !== null;
        updatedItem.monthlyProgress = newProgress;
        updatedItem.monthlyProgressCaptured = [
          ...(item.monthlyProgressCaptured || Array(12).fill(false)),
        ];
        updatedItem.monthlyProgressCaptured[currentIdx] = newActualVal !== null;
        updatedItem.monthlyNotes = newNotes;
      }
      await onUpdateItem(updatedItem);
      onClose();
    } catch (err) {
      console.error("Error al guardar periodo:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const formatNumber = (num: number) => {
    return formatNumberWithCommas(num, decimalPrecision);
  };

  useEffect(() => {
    const el = document.getElementById("gestion-detallada-focus");
    const container = el?.closest(".overflow-y-auto") || el?.parentElement;
    if (
      el &&
      container &&
      container !== document.body &&
      container !== document.documentElement
    ) {
      container.scrollTop = 0;
    }
  }, [item.id]);

  if (!item) return null;

  const isCalculated =
    item.indicatorType === "formula" || item.indicatorType === "compound";
  const effectiveCanEdit = canEdit && !isCalculated;
  const gap =
    (parseFormattedNumber(localActual) || 0) -
    (parseFormattedNumber(localGoal) || 0);
  const isPositiveGap = item.goalType === "minimize" ? gap <= 0 : gap >= 0;

  const handlePrevPeriod = () => {
    const min = 0;
    setActivePeriodIdx((prev) =>
      Math.max(min, (prev === -1 ? periodIdx : prev) - 1),
    );
  };

  const handleNextPeriod = () => {
    const max = isWeekly ? 52 : 11;
    setActivePeriodIdx((prev) =>
      Math.min(max, (prev === -1 ? periodIdx : prev) + 1),
    );
  };

  return (
    <div
      id="gestion-detallada-focus"
      className="relative bg-slate-900/40 backdrop-blur-3xl border border-cyan-500/40 rounded-[2.5rem] p-4 md:p-6 animate-in zoom-in-95 duration-500 z-10 scroll-mt-24"
    >
      <div hidden={plansFocused} className="sticky top-16 z-30 bg-slate-950/95 backdrop-blur-md p-4 rounded-3xl border border-slate-800 shadow-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
        {plansFocused ? <div className="w-full"><span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Planes ejecutivos · indicador</span><h2 className="text-base font-black text-white">{getCleanIndicatorName(indicator)}</h2></div> : <>
        <div className="flex-1 w-full">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="flex items-center bg-slate-950/80 rounded-2xl border border-white/5 p-1">
              <button
                onClick={handlePrevPeriod}
                className="w-11 h-11 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-all active:scale-90"
                aria-label="Periodo anterior"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M12.707 5.293a1 0 010 1.414L9.414 10l3.293 3.293a1 0 01-1.414 1.414l-4-4a1 0 010-1.414l4-4a1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>

              <div className="px-6 flex flex-col items-center min-w-[140px]">
                <span className="text-[7px] font-black text-cyan-500 uppercase tracking-[0.2em] mb-0.5">
                  Periodo Consultado
                </span>
                <span className="text-xs font-black text-white uppercase tracking-widest">
                  {currentPeriodLabel}
                </span>
              </div>

              <button
                onClick={handleNextPeriod}
                className="w-11 h-11 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-all active:scale-90"
                aria-label="Siguiente periodo"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M7.293 14.707a1 0 010-1.414L10.586 10 7.293 6.707a1 0 011.414-1.414l4 4a1 0 010 1.414l-4 4a1 0 01-1.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>

            {currentIdx !== periodIdx && (
              <button
                onClick={() => setActivePeriodIdx(periodIdx)}
                className="px-3 py-1.5 bg-rose-500/10 border border-rose-500/20 rounded-full text-[8px] font-black text-rose-400 uppercase tracking-widest hover:bg-rose-500/20 transition-all"
              >
                Reestablecer Actual
              </button>
            )}

            <div className="flex-grow" />

            {frequency === "weekly" && (
              <span className="px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-[9px] font-black text-indigo-400 uppercase tracking-widest">
                Semanal
              </span>
            )}
            {!canEdit && (
              <span className="px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full text-[9px] font-black text-amber-500 uppercase tracking-widest">
                Solo Lectura
              </span>
            )}
          </div>

          <div className="flex items-center gap-4">
            <div className="w-1 bg-cyan-500 self-stretch rounded-full" />
            <h2 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tighter italic leading-none">
              {getCleanIndicatorName(indicator)}
            </h2>
          </div>
        </div>
        <div className="flex w-full flex-wrap items-center gap-3">
          <button
            onClick={() => setActivityMode(!activityMode)}
            className={`px-4 py-4 rounded-2xl border transition-all flex items-center gap-2 group ${activityMode ? "bg-indigo-500/20 border-indigo-500/40 text-indigo-400" : "bg-slate-800/40 border-white/5 text-slate-500 hover:text-slate-300"}`}
            title="Activar/Desactivar el Gestor de Actividades para este indicador"
          >
            <span className="text-sm">{activityMode ? "✅" : "☐"}</span>
            <span className="text-[10px] font-black uppercase tracking-widest leading-none">
              Modo Actividades
            </span>
          </button>

          <button
            onClick={() => setIsFullEditMode(true)}
            className="px-6 py-4 bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-cyan-500/20 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
            title="Ver todos los meses del año para este indicador"
          >
            <span>📅</span>
            VISTA ANUAL
          </button>

          {effectiveCanEdit && (
            <button
              onClick={handleQuickSave}
              disabled={isSaving}
              className={`w-full sm:w-auto min-h-[44px]
                group relative flex items-center gap-3 px-8 py-4 rounded-2xl transition-all duration-300 font-black uppercase tracking-widest text-[10px]
                ${
                  isSaving
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/50"
                    : "bg-cyan-500 hover:bg-cyan-400 text-slate-950 hover:scale-105 active:scale-95"
                }
              `}
            >
              {isSaving ? (
                <>
                  <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Guardado
                </>
              ) : (
                "Guardar Cambios"
              )}
            </button>
          )}
          <button
            onClick={onClose}
            className="px-6 h-12 flex items-center justify-center bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-400 hover:bg-rose-500 hover:text-white transition-all active:scale-90 font-black uppercase tracking-widest text-[10px] gap-2"
            title="Cerrar gestión detallada"
          >
            <span>✕</span>
            CERRAR
          </button>
        </div>
        </>}
      </div>
      <section hidden={plansFocused} className="mb-6 rounded-2xl border border-cyan-500/25 bg-cyan-950/15 p-4">
        <h3 className="text-xs font-black uppercase tracking-widest text-cyan-200">Seguimiento</h3>
        <p className="mt-1 text-sm font-bold text-white">Inicio efectivo: {formatTrackingStartPeriod(effectiveTracking.period)}</p>
        <p className="text-xs text-slate-400">{effectiveTracking.source === 'KPI' ? 'EXCEPCIÓN DE SEGUIMIENTO' : effectiveTracking.source === 'UNDEFINED' ? 'Inicio de seguimiento sin configurar.' : `Heredado del ${effectiveTracking.source === 'DASHBOARD' ? 'tablero' : 'cliente'}`}</p>
        {canConfigureTracking && !item.trackingStartPeriod && !editingTracking && <button type="button" onClick={() => { setTrackingDraft(effectiveTracking.period || (isWeekly ? { frequency: 'weekly', year: year || currentYear, weekNumber: 1 } : { frequency: 'monthly', year: year || currentYear, monthIndex: 0 })); setEditingTracking(true); }} className="mt-3 rounded bg-cyan-600 px-3 py-2 text-[10px] font-black uppercase text-white">Definir excepción</button>}
        {editingTracking && trackingDraft && <div className="mt-3 space-y-2"><TrackingStartPeriodControls value={trackingDraft} frequency={isWeekly ? 'weekly' : 'monthly'} year={year || currentYear} onChange={setTrackingDraft} /><p className="text-xs text-amber-100">Este indicador comenzará su seguimiento en {formatTrackingStartPeriod(trackingDraft)}. Los periodos anteriores no serán obligatorios.</p><button type="button" onClick={saveTrackingOverride} className="rounded bg-cyan-600 px-3 py-1 text-xs font-black text-white">GUARDAR EXCEPCIÓN</button><button type="button" onClick={() => setEditingTracking(false)} className="ml-2 text-xs text-slate-300">CANCELAR</button></div>}
        {trackingBlocked && <div className="mt-3 rounded border border-rose-400/40 bg-rose-950/30 p-3 text-xs text-rose-100">{trackingBlocked}<button type="button" onClick={() => setTrackingBlocked('')} className="ml-2 font-black">ENTENDIDO</button></div>}
        {confirmTrackingSave && trackingDraft && <div className="mt-3 rounded border border-amber-400/30 bg-amber-950/20 p-3 text-xs text-amber-100">Este indicador comenzará su seguimiento en {formatTrackingStartPeriod(trackingDraft)}. Los periodos anteriores dejarán de ser obligatorios porque no contienen información registrada.<div className="mt-2"><button type="button" onClick={async () => { try { await onUpdateItem({ ...item, trackingStartPeriod: trackingDraft }); setTrackingFeedback(`Excepción de seguimiento guardada: ${formatTrackingStartPeriod(trackingDraft)}.`); setEditingTracking(false); } catch { setTrackingFeedback('No se pudo guardar la excepción de seguimiento.'); } finally { setConfirmTrackingSave(false); } }} className="rounded bg-cyan-600 px-3 py-1 font-black text-white">GUARDAR</button><button type="button" onClick={() => setConfirmTrackingSave(false)} className="ml-2 text-slate-300">CANCELAR</button></div></div>}
        {canConfigureTracking && item.trackingStartPeriod && !confirmInherit && <button type="button" onClick={() => setConfirmInherit(true)} className="mt-3 text-xs font-black text-cyan-300">VOLVER A HEREDAR</button>}
        {confirmInherit && <div className="mt-3 text-xs text-amber-100">Este indicador volverá a utilizar el inicio heredado: {formatTrackingStartPeriod(effectiveTracking.source === 'KPI' ? (dashboardTrackingStartPeriod || clientTrackingStartPeriod) : effectiveTracking.period)}.<div className="mt-2"><button type="button" onClick={async () => { try { await onUpdateItem({ ...item, trackingStartPeriod: undefined }); setConfirmInherit(false); setTrackingFeedback('El indicador volvió a heredar el inicio de seguimiento.'); } catch { setTrackingFeedback('No se pudo restaurar el inicio heredado.'); } }} className="rounded bg-cyan-600 px-3 py-1 font-black text-white">VOLVER A HEREDAR</button><button type="button" onClick={() => setConfirmInherit(false)} className="ml-2 text-slate-300">CANCELAR</button></div></div>}
        {trackingFeedback && <p role="status" className="mt-2 text-xs font-bold text-emerald-300">{trackingFeedback}</p>}
      </section>

      {managedPending && (
        <ContinuityWorkspace
          item={item}
          pending={managedPending}
          year={year || currentYear}
          isWeekly={isWeekly}
          consultedPeriod={currentIdx}
          onUpdateItem={onUpdateItem}
          onUpdateKpiProgress={updateKpiContinuityProgress}
          onClose={() => setManagedPending(null)}
          onSuccess={(message) => setPendingFeedback(message)}
        />
      )}

      {isFullEditMode ? (
        <div className="animate-in fade-in slide-in-from-top-4">
          <DataEditor
            item={item}
            allDashboardItems={allDashboardItems}
            year={year}
            canEdit={canEdit}
            onCancel={() => setIsFullEditMode(false)}
            onSave={async (data, autoSave) => {
              const updated = { ...item, ...data };
              await onUpdateItem(updated);
              if (!autoSave) {
                setIsFullEditMode(false);
                onClose();
              }
            }}
          />
        </div>
      ) : (
        <>
          <div ref={indicatorSectionRef} hidden={plansFocused} className="scroll-mt-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 mb-3">
            <div className="lg:col-span-6 flex flex-col gap-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div
                  className={`bg-slate-950/40 border border-white/5 rounded-2xl p-3 transition-all ${canEdit && !activityMode ? "focus-within:border-cyan-500/50" : "opacity-80 grayscale-[0.5]"}`}
                >
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
                      Meta del Periodo ({unit})
                    </span>
                    <span className="text-[10px] font-black text-cyan-400 tabular-nums">
                      {localGoal !== "" ? formatMonthlyGoal(parseFormattedNumber(localGoal), item.monthlyGoalCaptured?.[currentIdx], unit, 0) : "SIN DATOS"}
                    </span>
                  </div>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={
                      isGoalFocused
                        ? localGoal
                        : localGoal !== ""
                          ? formatMonthlyGoal(parseFormattedNumber(localGoal), item.monthlyGoalCaptured?.[currentIdx], unit, 0)
                          : ""
                    }
                    onFocus={() => setIsGoalFocused(true)}
                    onBlur={() => setIsGoalFocused(false)}
                    onChange={(e) => {
                      const val = e.target.value;
                      setLocalGoal(val);
                    }}
                    id="goal-input"
                    disabled={!effectiveCanEdit || activityMode}
                    className="w-full bg-transparent text-2xl font-black text-white tabular-nums outline-none disabled:opacity-50"
                    placeholder="0.00"
                  />
                  {activityMode && (
                    <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest mt-1 block">
                      Cálculo Automático (Elementos)
                    </span>
                  )}
                  {isCalculated && (
                    <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest mt-1 block">
                      ⚡ MODO: AUTOMÁTICO — CALCULADO DESDE INDICADORES FUENTE
                    </span>
                  )}
                </div>
                <div
                  className={`bg-slate-950/40 border border-white/5 rounded-2xl p-3 transition-all ${effectiveCanEdit && !activityMode ? "focus-within:border-emerald-500/50" : "opacity-80 grayscale-[0.5]"}`}
                >
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
                      Real del Periodo ({unit})
                    </span>
                    <span className="text-[10px] font-black text-emerald-400 tabular-nums">
                      {localActual !== "" ? formatMonthlyProgress(parseFormattedNumber(localActual), item.monthlyProgressCaptured?.[currentIdx], unit, 0) : "SIN DATOS"}
                    </span>
                  </div>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={
                      isActualFocused
                        ? localActual
                        : localActual !== ""
                          ? formatMonthlyProgress(parseFormattedNumber(localActual), item.monthlyProgressCaptured?.[currentIdx], unit, 0)
                          : ""
                    }
                    onFocus={() => setIsActualFocused(true)}
                    onBlur={() => setIsActualFocused(false)}
                    onChange={(e) => {
                      const val = e.target.value;
                      setLocalActual(val);
                    }}
                    id="actual-input"
                    disabled={!effectiveCanEdit || activityMode}
                    className="w-full bg-transparent text-2xl font-black text-white tabular-nums outline-none disabled:cursor-not-allowed"
                    placeholder="0.00"
                  />
                  {activityMode && (
                    <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest mt-1 block">
                      Sincronizado con Elementos
                    </span>
                  )}
                  {isCalculated && (
                    <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest mt-1 block">
                      ⚡ MODO: AUTOMÁTICO
                    </span>
                  )}
                </div>
              </div>

              {activityTab === "current" && (
                <RescheduledCommitmentsSection
                  commitments={rescheduledCommitments}
                  onManage={(c) => {
                    const found = pendingKpiActivities.find(
                      (p) => p.id === c.id,
                    );
                    if (found) {
                      setManagedPending(found);
                      setActivityTab("pending");
                      setPendingAction("idle");
                    }
                  }}
                  onViewActions={() => setActivityTab("pending")}
                />
              )}

              {activityMode && resolutionHistory.length > 0 && <section aria-label="Histórico de resoluciones" className="mb-3 rounded-xl border border-slate-700/60 bg-slate-950/40 p-3">
                  <h3 className="text-[9px] font-black uppercase tracking-widest text-slate-400">HISTÓRICO DE RESOLUCIONES</h3>
                  <div className="mt-2 space-y-2">{resolutionHistory.map(row => <div key={row.id} className="flex items-center justify-between gap-3 border-b border-white/5 pb-2 last:border-0 last:pb-0"><div><p className="text-xs text-slate-200">{row.title}</p><p className="text-[10px] text-slate-500">Periodo {row.originalPeriodIndex + 1} · {row.status}{row.reason ? ` · ${row.reason}` : ''}</p></div>{row.canReopen && <button type="button" onClick={() => setReopenCandidate(row)} className="shrink-0 rounded-lg border border-cyan-500/30 px-2 py-1.5 text-[9px] font-black text-cyan-300">REABRIR</button>}</div>)}</div>
                  {reopenCandidate && <div role="dialog" className="mt-3 rounded-lg border border-cyan-500/30 bg-slate-900 p-3"><p className="text-xs font-bold text-white">¿Reabrir este pendiente?</p><p className="mt-1 text-[10px] text-slate-400">Volverá a Pendientes y se conservará el historial de lo ocurrido.</p><div className="mt-2 flex justify-end gap-2"><button type="button" onClick={() => setReopenCandidate(null)} className="rounded px-2 py-1.5 text-[9px] font-black text-slate-400">CANCELAR</button><button type="button" onClick={() => void reopenResolution(reopenCandidate)} className="rounded bg-cyan-600 px-2 py-1.5 text-[9px] font-black text-white">REABRIR</button></div></div>}
                </section>}

              {(activityMode || visiblePendingKpiActivities.length > 0 || discardedActivities.length > 0 || (item.continuityCommitments && Object.keys(item.continuityCommitments).length > 0)) && (
                <div className="space-y-3">
                  {pendingFeedback && (
                    <p role="status" className="rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-3.5 py-2.5 text-[11px] font-bold text-emerald-200">
                      {pendingFeedback}
                    </p>
                  )}
                  <div className="flex gap-2 rounded-2xl border border-slate-700/60 bg-slate-950/80 p-1.5 shadow-inner">
                    <button
                      type="button"
                      onClick={() => setActivityTab("current")}
                      className={`flex-1 min-h-[44px] flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[11px] font-black uppercase tracking-wider transition-all ${
                        activityTab === "current"
                          ? "bg-indigo-600/30 text-indigo-100 border border-indigo-500/50 shadow-sm"
                          : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                      }`}
                    >
                      <span>📅</span>
                      <span>Período actual</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActivityTab("pending")}
                      className={`flex-1 min-h-[44px] flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[11px] font-black uppercase tracking-wider transition-all ${
                        activityTab === "pending"
                          ? "bg-cyan-600/30 text-cyan-100 border border-cyan-500/50 shadow-sm"
                          : visiblePendingKpiActivities.length > 0
                            ? "bg-slate-900 text-slate-200 border border-cyan-500/30 hover:bg-slate-800"
                            : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                      }`}
                    >
                      <span>⚡</span>
                      <span>ACCIONES POR ATENDER</span>
                      {visiblePendingKpiActivities.length > 0 && (
                        <span
                          className={`ml-1 rounded-full px-2 py-0.5 text-[10px] font-black tabular-nums ${
                            activityTab === "pending"
                              ? "bg-cyan-500 text-slate-950"
                              : "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                          }`}
                        >
                          {visiblePendingKpiActivities.length}
                        </span>
                      )}
                    </button>
                  </div>
                  {activityTab === "current" ? (
                    activityMode ? (
                      <button
                        onClick={() => setIsActivityManagerOpen(true)}
                        className="w-full min-h-[48px] py-3 bg-gradient-to-r from-indigo-600/20 to-purple-600/20 border border-indigo-500/40 rounded-2xl flex items-center justify-between px-6 hover:from-indigo-600/30 hover:to-purple-600/30 transition-all border-dashed shadow-sm"
                      >
                        <div className="flex flex-col items-start">
                          <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest leading-none mb-1">
                            Elementos de este periodo
                          </span>
                          <span className="text-base font-bold text-white">
                            Gestión Detallada
                          </span>
                        </div>
                        <span className="text-xl">📝</span>
                      </button>
                    ) : null
                  ) : (
                    <div className="rounded-2xl border border-slate-700/60 bg-slate-950/80 p-4 shadow-lg">
                      {visiblePendingKpiActivities.length === 0 && discardedActivities.length === 0 ? (
                        <p className="text-center text-[11px] font-bold uppercase tracking-widest text-slate-400 py-3">
                          No hay actividades pendientes
                        </p>
                      ) : (
                        <div className="space-y-4">
                          {[
                            { title: "REQUIERE ATENCIÓN", items: attentionActivities, tone: "text-slate-200", empty: "Sin acciones vencidas o pendientes." },
                            { title: "EN SEGUIMIENTO", items: followUpActivities, tone: "text-cyan-200", empty: "Sin compromisos activos en seguimiento." },
                          ].map(({ title, items, tone, empty }) => (
                            <section key={title} aria-label={title}>
                              <div className="mb-2.5 flex items-center justify-between gap-2">
                                <h3 className={`text-[10px] font-black uppercase tracking-widest ${tone}`}>{title}</h3>
                                <span className="rounded-full bg-slate-800 border border-slate-700 px-2 py-0.5 text-[9px] font-black text-slate-300">{items.length}</span>
                              </div>
                              {items.length === 0 ? (
                                <p className="rounded-xl bg-slate-900/60 border border-white/5 px-3 py-2 text-[10px] text-slate-400">{empty}</p>
                              ) : (
                                <div className="space-y-2">
                                  {items.map((activity) => (
                                    <div
                                      key={activity.id}
                                      onClick={() => canEdit && (setManagedPending(activity), setPendingAction("idle"), setPendingError(""))}
                                      className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl bg-slate-900/90 border border-slate-700/60 p-3.5 transition-all duration-200 hover:border-cyan-500/50 hover:bg-slate-850 cursor-pointer shadow-md"
                                      role="button"
                                      tabIndex={0}
                                    >
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className="text-xs font-bold text-white group-hover:text-cyan-200 transition-colors">
                                            {activity.label}
                                          </span>
                                          <span className={`rounded-lg px-2 py-0.5 text-[9px] font-black uppercase tracking-wider border ${
                                            activity.status === "ATRASADA"
                                              ? "bg-rose-500/15 border-rose-500/30 text-rose-300"
                                              : activity.status === "ATENCIÓN"
                                                ? "bg-amber-500/15 border-amber-500/30 text-amber-300"
                                                : activity.status === "REPROGRAMADA"
                                                  ? "bg-cyan-500/15 border-cyan-500/30 text-cyan-300"
                                                  : "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
                                          }`}>
                                            {activity.status}
                                          </span>
                                        </div>
                                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-300">
                                          <span>
                                            <strong className="font-semibold text-slate-400">ORIGEN:</strong> {activity.periodLabel}
                                          </span>
                                          {activity.commitmentLabel && (
                                            <span>
                                              <strong className="font-semibold text-cyan-400">COMPROMISO:</strong> {activity.commitmentLabel}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (canEdit) {
                                            setManagedPending(activity);
                                            setPendingAction("idle");
                                            setPendingError("");
                                          }
                                        }}
                                        className="flex min-h-[44px] shrink-0 items-center justify-center rounded-xl bg-cyan-500/20 border border-cyan-500/40 px-5 py-2 text-[10px] font-black uppercase tracking-wider text-cyan-200 hover:bg-cyan-500/30 hover:border-cyan-400 hover:text-white transition-all active:scale-95 shadow-sm"
                                      >
                                        GESTIONAR
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </section>
                          ))}
                          {discardedActivities.length > 0 && (
                            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3.5 shadow-md">
                              <button
                                type="button"
                                onClick={() => setIsDiscardedExpanded(!isDiscardedExpanded)}
                                className="flex min-h-[44px] w-full items-center justify-between text-left text-[10px] font-black uppercase tracking-widest text-slate-300 hover:text-white transition-colors"
                              >
                                <span className="flex items-center gap-2">
                                  <span>CERRADOS / DESCARTADOS</span>
                                  <span className="rounded-full bg-slate-800 border border-slate-700 px-2 py-0.5 text-[9px] font-bold text-slate-300">
                                    {discardedActivities.length}
                                  </span>
                                </span>
                                <span className="text-xs font-bold text-slate-400">{isDiscardedExpanded ? "▲" : "▼"}</span>
                              </button>
                              {isDiscardedExpanded && (
                                <div className="mt-3 space-y-2 border-t border-white/5 pt-3">
                                  {discardedActivities.map((activity) => (
                                    <div
                                      key={activity.id}
                                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl bg-slate-950/90 border border-slate-800 px-3.5 py-3 transition hover:bg-slate-900"
                                    >
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <p className="truncate text-xs font-semibold text-slate-200">{activity.label}</p>
                                          <span className="rounded-lg bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 text-[9px] font-black text-rose-300">
                                            DESCARTADO
                                          </span>
                                        </div>
                                        <p className="mt-1 text-[11px] text-slate-300">
                                          <span className="font-semibold text-slate-400">Origen:</span> {activity.periodLabel} · <span className="font-semibold text-slate-400">Último periodo:</span> {activity.commitmentLabel}
                                        </p>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setManagedPending(activity);
                                          setPendingAction("idle");
                                          setPendingError("");
                                        }}
                                        className="flex min-h-[44px] shrink-0 items-center justify-center rounded-xl bg-cyan-500/20 border border-cyan-500/40 px-5 py-2 text-[10px] font-black uppercase tracking-wider text-cyan-200 hover:bg-cyan-500/30 hover:border-cyan-400 hover:text-white transition-all active:scale-95 shadow-sm"
                                      >
                                        GESTIONAR
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div
                className={`bg-slate-950/40 border border-white/5 rounded-2xl p-3 ${(!canEdit || isCalculated) && "opacity-80"}`}
              >
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">
                  Observaciones
                </span>
                <textarea
                  value={localNote}
                  onChange={(e) => setLocalNote(e.target.value)}
                  disabled={!canEdit || isCalculated}
                  className="w-full bg-transparent text-slate-300 text-sm italic outline-none min-h-[40px] resize-none disabled:cursor-not-allowed"
                  placeholder={
                    isCalculated
                      ? "Observaciones derivadas automáticamente."
                      : canEdit
                        ? "Observaciones del periodo..."
                        : "Sin comentarios."
                  }
                />
              </div>

              {effectiveCanEdit && (
                <div className="flex flex-col gap-1.5">
                  <button
                    onClick={handleQuickSave}
                    disabled={isSaving}
                    className={`w-full min-h-[44px] py-3 rounded-xl font-black uppercase tracking-[0.2em] text-[10px] transition-all ${isSaving ? "bg-emerald-600 text-white" : "bg-cyan-600 hover:bg-cyan-500 text-white hover:scale-[1.01]"}`}
                  >
                    {isSaving
                      ? "✓ CAMBIOS GUARDADOS"
                      : `💾 GUARDAR ${isWeekly ? "SEMANA" : "MES"}`}
                  </button>
                  <span className="text-[10px] text-center text-slate-400 font-medium">
                    Guarda observaciones y cambios del periodo
                  </span>
                </div>
              )}
            </div>

            {/* RIGHT COLUMN: Visuals (Chart & Compliance) */}
            <div className="lg:col-span-6 flex flex-col gap-3">
              <div className="bg-slate-950/60 border border-cyan-500/20 rounded-2xl p-4 flex items-center justify-between">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2 mb-1">
                    <div
                      className={`w-2.5 h-2.5 rounded-full animate-pulse ${compliance.complianceStatus === "OnTrack" ? "bg-emerald-500" : compliance.complianceStatus === "AtRisk" ? "bg-amber-500" : compliance.complianceStatus === "InProgress" ? "bg-sky-500" : compliance.complianceStatus === "Neutral" ? "bg-slate-600" : "bg-rose-500"}`}
                    />
                    <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest leading-none">
                      {type === "accumulative"
                        ? "CUMPLIMIENTO YTD (ACUMULADO)"
                        : "CUMPLIMIENTO YTD"}
                    </span>
                  </div>
                  <span
                    className={`text-4xl font-black tabular-nums tracking-tighter leading-none ${compliance.complianceStatus === "OnTrack" ? "text-emerald-400" : compliance.complianceStatus === "AtRisk" ? "text-amber-400" : compliance.complianceStatus === "InProgress" ? "text-sky-400" : compliance.complianceStatus === "Neutral" ? "text-slate-500" : "text-rose-400"}`}
                  >
                    {Math.round(compliance.overallPercentage)}%
                  </span>
                  <span className="text-[8px] font-bold text-slate-400 mt-1 block">
                    (Acumulado anual al periodo de corte)
                  </span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">
                    Brecha del Periodo
                  </span>
                  <span
                    className={`text-lg font-black ${isPositiveGap ? "text-emerald-400" : "text-rose-400"}`}
                  >
                    {isPositiveGap ? "▲" : "▼"}{" "}
                    {isCalculated
                      ? `${(Math.abs(gap) * 100).toFixed(1)} pp`
                      : `${formatNumberWithCommas(Math.abs(gap), 0)} ${unit}`}
                  </span>
                  <span className="text-[8px] font-bold text-slate-500 mt-0.5">
                    ({currentPeriodLabel})
                  </span>
                </div>
              </div>

              <div className="bg-slate-950/40 rounded-2xl p-3 border border-white/5 flex-grow flex flex-col justify-center">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">
                    Tendencia Histórica (Línea Punteada = Meta)
                  </span>
                </div>
                <LineChart
                  progressData={chartData.progress}
                  capturedData={chartData.captured}
                  goalDefinedData={chartData.goalDefined}
                  goalData={chartData.goals}
                  unit={unit}
                  type={item.continuityCommitments && Object.keys(item.continuityCommitments).length > 0 ? "average" : (type as any)}
                  status={compliance.complianceStatus as any}
                  indicator={indicator}
                  frequency={frequency}
                />
              </div>
            </div>
          </div>

          <div className="mt-4">
            <ActionPlan
              initialRows={item.paiRows}
              status={compliance.complianceStatus as any}
              onSave={(rows) => onUpdateItem({ ...item, paiRows: rows })}
              canEdit={canEdit}
              year={year}
            />
          </div>
          </div>
          {plansFocused && <aside className="mb-4 scroll-mt-24 rounded-xl border border-cyan-500/25 bg-slate-950/70 p-3" aria-label="Referencia compacta del indicador">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Indicador seleccionado</p>
                <h3 className="truncate text-sm font-black text-white">{getCleanIndicatorName(indicator)}</h3>
              </div>
              <p className="text-xs text-slate-300"><span className="font-bold text-emerald-300">Resultado:</span> {localActual !== "" ? formatMonthlyProgress(parseFormattedNumber(localActual), item.monthlyProgressCaptured?.[currentIdx], unit, 0) : "Sin datos"} <span className="mx-1 text-slate-600">·</span> <span className="font-bold text-cyan-200">Cumplimiento:</span> {Math.round(compliance.overallPercentage)}% <span className="mx-1 text-slate-600">·</span> <span className="font-bold text-slate-300">Brecha:</span> {isPositiveGap ? "▲" : "▼"} {isCalculated ? `${(Math.abs(gap) * 100).toFixed(1)} pp` : `${formatNumberWithCommas(Math.abs(gap), 0)} ${unit}`}</p>
            </div>
          </aside>}
          {dashboardId !== undefined && (
            <div ref={plansSectionRef} className="scroll-mt-28">
              <RelatedActionPlans
                key={`${clientId || ""}:${dashboardId}:${item.id}`}
                indicatorId={item.id}
                dashboardId={dashboardId}
                clientId={clientId}
                year={year || new Date().getFullYear()}
                periodType={isWeekly ? "weekly" : "monthly"}
                periodIndex={currentIdx}
                canEdit={canEditPlans}
                initialPlanId={initialActionPlanId}
                onCancelEdit={onActionPlanExit}
                onSaved={onActionPlanExit}
                collapsed={!plansFocused}
                onToggle={() => plansFocused ? returnToIndicator() : openPlans()}
              />
            </div>
          )}
        </>
      )}

      {isActivityManagerOpen && (
        <ActivityManager
          title={getCleanIndicatorName(indicator)}
          subtitle={`Periodo: ${currentPeriodLabel}`}
          periodLabel={`${currentPeriodLabel} ${year || currentYear}`}
          goalType={item.goalType}
          initialActivities={
            Array.isArray(item.activityConfig?.[currentIdx])
              ? (item.activityConfig[currentIdx] as any)
              : item.activityConfig?.[currentIdx]
                ? Object.values(item.activityConfig[currentIdx])
                : []
          }
          canEdit={canEdit}
          onClose={() => setIsActivityManagerOpen(false)}
          onSave={(updatedList) => {
            const updatedItem = { ...item };
            updatedItem.activityConfig = { ...updatedItem.activityConfig };
            updatedItem.activityConfig[currentIdx] = updatedList;
            updatedItem.isActivityMode = true;

            const totalT = updatedList.reduce(
              (s: number, a: any) => s + Number(a.targetCount),
              0,
            ) as number;
            const totalC = updatedList.reduce(
              (s: number, a: any) => s + Number(a.completedCount),
              0,
            ) as number;

            if (isWeekly) {
              updatedItem.weeklyGoals = updatedItem.weeklyGoals
                ? [...updatedItem.weeklyGoals]
                : Array(53).fill(null);
              updatedItem.weeklyProgress = updatedItem.weeklyProgress
                ? [...updatedItem.weeklyProgress]
                : Array(53).fill(null);
              updatedItem.weeklyGoals[currentIdx] = totalT;
              updatedItem.weeklyProgress[currentIdx] = totalC;
            } else {
              updatedItem.monthlyGoals = updatedItem.monthlyGoals
                ? [...updatedItem.monthlyGoals]
                : Array(12).fill(0);
              updatedItem.monthlyProgress = updatedItem.monthlyProgress
                ? [...updatedItem.monthlyProgress]
                : Array(12).fill(0);
              updatedItem.monthlyGoals[currentIdx] = totalT;
              updatedItem.monthlyProgress[currentIdx] = totalC;
            }

            onUpdateItem(updatedItem);
            setIsActivityManagerOpen(false);
          }}
        />
      )}
    </div>
  );
};
