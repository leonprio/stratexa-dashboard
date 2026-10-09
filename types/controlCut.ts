import type {
  ActionPlanOriginPeriodType,
  ActionPlanResultEffect,
  ActionPlanResultDecision,
  ActionPlanStatus,
} from '../types';

export const CONTROL_CUT_SCHEMA_VERSION = 1 as const;

export interface ControlCutKpiSnapshot {
  indicatorId: string | number;
  label: string;
  goal?: number;
  progress?: number;
  pending?: number;
  compliance?: number;
  frequency: 'monthly' | 'weekly';
  goalCaptured?: boolean;
  progressCaptured?: boolean;
  isActivityMode?: boolean;
  effectiveException?: string;
  dashboardId: string | number;
  area?: string;
  direction?: string;
}

export interface ControlCutControlSummarySnapshot {
  pendingConfigurationsCount: number;
  pendingCapturesCount: number;
  overdueActionsCount: number;
  upcomingActionsCount: number;
  activeActionsCount: number;
  completedActionsCount: number;
  pendingReviewsCount: number;
  derivedAttentionCount: number;
}

export interface ControlCutActivitySnapshot {
  id: string;
  title: string;
  responsible?: string;
  responsibleUserId?: string;
  targetDate?: string;
  progress: number;
  result?: string;
  impact?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ControlCutNextCommitmentSnapshot {
  type: 'plan' | 'activity';
  id: string;
  title: string;
  responsible?: string;
  responsibleUserId?: string;
  targetDate?: string;
  status?: string;
  progress?: number;
}

export interface ControlCutReviewSnapshot {
  id: string;
  planId: string;
  reviewedAt: string;
  reviewedByUserId?: string;
  reviewedByLabel: string;
  observedResult: string;
  effect: ActionPlanResultEffect;
  decision: ActionPlanResultDecision;
  note?: string;
  evidenceRef?: string;
  nextReviewDate?: string;
  nextCommitmentPlanId?: string;
  nextCommitmentActivityId?: string;
  nextCommitment?: ControlCutNextCommitmentSnapshot;
  reviewYear?: number;
  reviewPeriodType?: ActionPlanOriginPeriodType;
  reviewPeriodIndex?: number;
  cutId?: string;
}

export interface ControlCutActionPlanSnapshot {
  id: string;
  indicatorId: string | number;
  dashboardId: string | number;
  clientId?: string;
  area?: string;
  title: string;
  description?: string;
  originYear: number;
  originPeriodType: ActionPlanOriginPeriodType;
  originPeriodIndex?: number;
  status: ActionPlanStatus;
  responsible?: string;
  responsibleUserId?: string;
  startDate: string;
  targetDate?: string;
  progress: number;
  expectedImpact?: string;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
  activities: ControlCutActivitySnapshot[];
  reviews: ControlCutReviewSnapshot[];
  nextCommitmentPlanId?: string;
  nextCommitmentActivityId?: string;
  nextCommitment?: ControlCutNextCommitmentSnapshot;
}

export interface ControlCutScope {
  clientId: string;
  dashboardId: string | number;
  dashboardIds: Array<string | number>;
  periodicity: 'monthly' | 'weekly';
  year: number;
  periodIndex: number;
}

export interface ControlCut {
  cutId: string;
  schemaVersion: number;
  capturedAt: string;
  capturedByUserId?: string;
  capturedByLabel: string;
  clientId: string;
  dashboardId: string | number;
  dashboardIds: Array<string | number>;
  periodicity: 'monthly' | 'weekly';
  year: number;
  periodIndex: number;
  scope: ControlCutScope;
  kpis: ControlCutKpiSnapshot[];
  controlSummary: ControlCutControlSummarySnapshot;
  actionPlans: ControlCutActionPlanSnapshot[];
  reviews: ControlCutReviewSnapshot[];
}

export interface BuildControlCutParams {
  clientId: string;
  dashboardId: string | number;
  dashboardIds?: Array<string | number>;
  periodicity: 'monthly' | 'weekly';
  year: number;
  periodIndex: number;
  capturedAt?: string;
  capturedByUserId?: string;
  capturedByLabel: string;
  kpis: ControlCutKpiSnapshot[];
  controlSummary: ControlCutControlSummarySnapshot;
  actionPlans: ControlCutActionPlanSnapshot[];
  reviews?: ControlCutReviewSnapshot[];
}
