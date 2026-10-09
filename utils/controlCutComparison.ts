import type {
  ControlCut,
  ControlCutKpiSnapshot,
  ControlCutActionPlanSnapshot,
  ControlCutNextCommitmentSnapshot,
} from '../types/controlCut';
import type { ActionPlanResultEffect, ActionPlanResultDecision, ActionPlanStatus } from '../types';

export interface ControlCutCompatibilityValidation {
  compatible: boolean;
  reason?: string;
}

export type ControlCutKpiComparisonStatus = 'both' | 'only_a' | 'only_b';
export type ControlCutKpiInterpretation = 'improved' | 'worsened' | 'stable' | 'not_comparable';

export interface ControlCutKpiComparison {
  indicatorId: string | number;
  labelA?: string;
  labelB?: string;
  areaA?: string;
  areaB?: string;
  frequency: 'monthly' | 'weekly';
  status: ControlCutKpiComparisonStatus;
  goalA?: number;
  goalB?: number;
  progressA?: number;
  progressB?: number;
  pendingA?: number;
  pendingB?: number;
  complianceA?: number;
  complianceB?: number;
  complianceDelta?: number;
  pendingDelta?: number;
  interpretation: ControlCutKpiInterpretation;
}

export interface ControlCutActionPlanComparison {
  planId: string;
  titleA?: string;
  titleB?: string;
  statusA?: ActionPlanStatus;
  statusB?: ActionPlanStatus;
  progressA?: number;
  progressB?: number;
  progressDelta?: number;
  observedResultA?: string;
  observedResultB?: string;
  effectA?: ActionPlanResultEffect;
  effectB?: ActionPlanResultEffect;
  decisionA?: ActionPlanResultDecision;
  decisionB?: ActionPlanResultDecision;
  nextCommitmentA?: ControlCutNextCommitmentSnapshot;
  nextCommitmentB?: ControlCutNextCommitmentSnapshot;
}

export interface ControlCutSummaryDelta {
  pendingConfigurationsDelta: number;
  pendingCapturesDelta: number;
  overdueActionsDelta: number;
  upcomingActionsDelta: number;
  activeActionsDelta: number;
  completedActionsDelta: number;
  pendingReviewsDelta: number;
  derivedAttentionDelta: number;
}

export interface ControlCutComparisonResult {
  clientId: string;
  dashboardId: string | number;
  periodicity: 'monthly' | 'weekly';
  cutA: {
    cutId: string;
    year: number;
    periodIndex: number;
    capturedAt: string;
    capturedByLabel: string;
  };
  cutB: {
    cutId: string;
    year: number;
    periodIndex: number;
    capturedAt: string;
    capturedByLabel: string;
  };
  summaryDelta: ControlCutSummaryDelta;
  kpis: ControlCutKpiComparison[];
  improvedKpiCount: number;
  worsenedKpiCount: number;
  stableKpiCount: number;
  nonComparableKpiCount: number;
  actionPlans: ControlCutActionPlanComparison[];
}

export const validateControlCutsCompatibility = (
  cutA: ControlCut,
  cutB: ControlCut,
): ControlCutCompatibilityValidation => {
  if (!cutA || !cutB) {
    return { compatible: false, reason: 'Ambos cortes son requeridos para la comparación.' };
  }

  const clientA = String(cutA.clientId || '').trim().toUpperCase();
  const clientB = String(cutB.clientId || '').trim().toUpperCase();
  if (clientA !== clientB) {
    return {
      compatible: false,
      reason: `Los cortes pertenecen a clientes distintos (${clientA} vs ${clientB}).`,
    };
  }

  const boardA = String(cutA.dashboardId).trim();
  const boardB = String(cutB.dashboardId).trim();
  if (boardA !== boardB) {
    return {
      compatible: false,
      reason: `Los cortes pertenecen a tableros distintos (${boardA} vs ${boardB}).`,
    };
  }

  if (cutA.periodicity !== cutB.periodicity) {
    return {
      compatible: false,
      reason: `Periodicidad incompatible (${cutA.periodicity} vs ${cutB.periodicity}).`,
    };
  }

  return { compatible: true };
};

const roundTwoDecimals = (val: number): number => Math.round((val + Number.EPSILON) * 100) / 100;

export const compareControlCuts = (
  cutA: ControlCut,
  cutB: ControlCut,
): ControlCutComparisonResult => {
  const validation = validateControlCutsCompatibility(cutA, cutB);
  if (!validation.compatible) {
    throw new Error(validation.reason || 'Los cortes no son compatibles.');
  }

  const summaryDelta: ControlCutSummaryDelta = {
    pendingConfigurationsDelta:
      (cutB.controlSummary?.pendingConfigurationsCount || 0) -
      (cutA.controlSummary?.pendingConfigurationsCount || 0),
    pendingCapturesDelta:
      (cutB.controlSummary?.pendingCapturesCount || 0) -
      (cutA.controlSummary?.pendingCapturesCount || 0),
    overdueActionsDelta:
      (cutB.controlSummary?.overdueActionsCount || 0) -
      (cutA.controlSummary?.overdueActionsCount || 0),
    upcomingActionsDelta:
      (cutB.controlSummary?.upcomingActionsCount || 0) -
      (cutA.controlSummary?.upcomingActionsCount || 0),
    activeActionsDelta:
      (cutB.controlSummary?.activeActionsCount || 0) -
      (cutA.controlSummary?.activeActionsCount || 0),
    completedActionsDelta:
      (cutB.controlSummary?.completedActionsCount || 0) -
      (cutA.controlSummary?.completedActionsCount || 0),
    pendingReviewsDelta:
      (cutB.controlSummary?.pendingReviewsCount || 0) -
      (cutA.controlSummary?.pendingReviewsCount || 0),
    derivedAttentionDelta:
      (cutB.controlSummary?.derivedAttentionCount || 0) -
      (cutA.controlSummary?.derivedAttentionCount || 0),
  };

  // Emparejamiento estricto por identity física: indicatorId
  const mapA = new Map<string, ControlCutKpiSnapshot>();
  (cutA.kpis || []).forEach((k) => mapA.set(String(k.indicatorId), k));

  const mapB = new Map<string, ControlCutKpiSnapshot>();
  (cutB.kpis || []).forEach((k) => mapB.set(String(k.indicatorId), k));

  const allIndicatorIds = Array.from(new Set([...mapA.keys(), ...mapB.keys()])).sort();

  let improvedKpiCount = 0;
  let worsenedKpiCount = 0;
  let stableKpiCount = 0;
  let nonComparableKpiCount = 0;

  const kpis: ControlCutKpiComparison[] = allIndicatorIds.map((idKey) => {
    const kpiA = mapA.get(idKey);
    const kpiB = mapB.get(idKey);
    const indicatorId = kpiA?.indicatorId ?? kpiB?.indicatorId ?? idKey;
    const frequency = kpiA?.frequency ?? kpiB?.frequency ?? cutA.periodicity;

    if (kpiA && kpiB) {
      const hasComplianceA = typeof kpiA.compliance === 'number';
      const hasComplianceB = typeof kpiB.compliance === 'number';

      let complianceDelta: number | undefined;
      let interpretation: ControlCutKpiInterpretation = 'stable';

      if (hasComplianceA && hasComplianceB) {
        complianceDelta = roundTwoDecimals((kpiB.compliance as number) - (kpiA.compliance as number));
        if (complianceDelta > 0.05) {
          interpretation = 'improved';
          improvedKpiCount += 1;
        } else if (complianceDelta < -0.05) {
          interpretation = 'worsened';
          worsenedKpiCount += 1;
        } else {
          interpretation = 'stable';
          stableKpiCount += 1;
        }
      } else {
        interpretation = 'not_comparable';
        nonComparableKpiCount += 1;
      }

      const pendingDelta =
        typeof kpiA.pending === 'number' && typeof kpiB.pending === 'number'
          ? roundTwoDecimals(kpiB.pending - kpiA.pending)
          : undefined;

      return {
        indicatorId,
        labelA: kpiA.label,
        labelB: kpiB.label,
        areaA: kpiA.area,
        areaB: kpiB.area,
        frequency,
        status: 'both',
        goalA: kpiA.goal,
        goalB: kpiB.goal,
        progressA: kpiA.progress,
        progressB: kpiB.progress,
        pendingA: kpiA.pending,
        pendingB: kpiB.pending,
        complianceA: kpiA.compliance,
        complianceB: kpiB.compliance,
        complianceDelta,
        pendingDelta,
        interpretation,
      };
    }

    if (kpiA && !kpiB) {
      nonComparableKpiCount += 1;
      return {
        indicatorId,
        labelA: kpiA.label,
        areaA: kpiA.area,
        frequency,
        status: 'only_a',
        goalA: kpiA.goal,
        progressA: kpiA.progress,
        pendingA: kpiA.pending,
        complianceA: kpiA.compliance,
        interpretation: 'not_comparable',
      };
    }

    // Only B
    nonComparableKpiCount += 1;
    return {
      indicatorId,
      labelB: kpiB?.label,
      areaB: kpiB?.area,
      frequency,
      status: 'only_b',
      goalB: kpiB?.goal,
      progressB: kpiB?.progress,
      pendingB: kpiB?.pending,
      complianceB: kpiB?.compliance,
      interpretation: 'not_comparable',
    };
  });

  // Action Plans comparison
  const planMapA = new Map<string, ControlCutActionPlanSnapshot>();
  (cutA.actionPlans || []).forEach((p) => planMapA.set(String(p.id), p));

  const planMapB = new Map<string, ControlCutActionPlanSnapshot>();
  (cutB.actionPlans || []).forEach((p) => planMapB.set(String(p.id), p));

  const allPlanIds = Array.from(new Set([...planMapA.keys(), ...planMapB.keys()])).sort();

  const actionPlans: ControlCutActionPlanComparison[] = allPlanIds.map((pId) => {
    const pA = planMapA.get(pId);
    const pB = planMapB.get(pId);
    const revA = pA?.reviews && pA.reviews.length > 0 ? pA.reviews[pA.reviews.length - 1] : undefined;
    const revB = pB?.reviews && pB.reviews.length > 0 ? pB.reviews[pB.reviews.length - 1] : undefined;

    const progressA = pA?.progress;
    const progressB = pB?.progress;
    const progressDelta =
      typeof progressA === 'number' && typeof progressB === 'number'
        ? roundTwoDecimals(progressB - progressA)
        : undefined;

    return {
      planId: pId,
      titleA: pA?.title,
      titleB: pB?.title,
      statusA: pA?.status,
      statusB: pB?.status,
      progressA,
      progressB,
      progressDelta,
      observedResultA: revA?.observedResult,
      observedResultB: revB?.observedResult,
      effectA: revA?.effect,
      effectB: revB?.effect,
      decisionA: revA?.decision,
      decisionB: revB?.decision,
      nextCommitmentA: pA?.nextCommitment || revA?.nextCommitment,
      nextCommitmentB: pB?.nextCommitment || revB?.nextCommitment,
    };
  });

  return {
    clientId: cutA.clientId,
    dashboardId: cutA.dashboardId,
    periodicity: cutA.periodicity,
    cutA: {
      cutId: cutA.cutId,
      year: cutA.year,
      periodIndex: cutA.periodIndex,
      capturedAt: cutA.capturedAt,
      capturedByLabel: cutA.capturedByLabel,
    },
    cutB: {
      cutId: cutB.cutId,
      year: cutB.year,
      periodIndex: cutB.periodIndex,
      capturedAt: cutB.capturedAt,
      capturedByLabel: cutB.capturedByLabel,
    },
    summaryDelta,
    kpis,
    improvedKpiCount,
    worsenedKpiCount,
    stableKpiCount,
    nonComparableKpiCount,
    actionPlans,
  };
};
