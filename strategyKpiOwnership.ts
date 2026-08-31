import type { Dashboard } from './types';
import type { ContributionIndicatorAssignment, ContributionObjective, StrategicObjective } from './strategyTypes';
import { getCanonicalKpiIdentity } from './strategyTypes';

export type StrategicKpiCandidate = { dashboard: Dashboard; item: any; identity: string };
export type StrategicKpiOwnership = { strategicObjectiveId: string; assignmentType: 'DIRECT' | 'CONTRIBUTION'; contributionObjectiveId?: string; dashboardId: number | string; itemId: number | string };

export function resolveStrategicKpiOwnership(dashboards: Dashboard[], objectives: StrategicObjective[], contributions: ContributionObjective[], assignments: ContributionIndicatorAssignment[]) {
  const candidates: StrategicKpiCandidate[] = [];
  const byPhysical = new Map<string, StrategicKpiCandidate>();
  dashboards.forEach(d => (d.items || []).forEach(item => {
    const candidate = { dashboard: d, item, identity: getCanonicalKpiIdentity(item, d.id) };
    candidates.push(candidate); byPhysical.set(`${d.id}_${item.id}`, candidate);
  }));
  const ownerByOC = new Map(contributions.map(oc => [oc.id, oc.primaryStrategicObjectiveId]));
  const ownershipByCanonicalKpi = new Map<string, StrategicKpiOwnership>();
  assignments.forEach(a => {
    const candidate = byPhysical.get(`${a.dashboardId}_${a.itemId}`); if (!candidate) return;
    const strategicObjectiveId = a.strategicObjectiveId || (a.contributionObjectiveId ? ownerByOC.get(a.contributionObjectiveId) : undefined); if (!strategicObjectiveId) return;
    if (!ownershipByCanonicalKpi.has(candidate.identity)) ownershipByCanonicalKpi.set(candidate.identity, { strategicObjectiveId, assignmentType: a.strategicObjectiveId ? 'DIRECT' : 'CONTRIBUTION', contributionObjectiveId: a.contributionObjectiveId, dashboardId: a.dashboardId, itemId: a.itemId });
  });
  const canonicalKpis = Array.from(new Map(candidates.map(c => [c.identity, c])).values());
  const kpisByStrategicObjective = new Map<string, StrategicKpiCandidate[]>();
  canonicalKpis.forEach(k => { const owner = ownershipByCanonicalKpi.get(k.identity); if (owner) kpisByStrategicObjective.set(owner.strategicObjectiveId, [...(kpisByStrategicObjective.get(owner.strategicObjectiveId) || []), k]); });
  return { canonicalKpis, ownershipByCanonicalKpi, kpisByStrategicObjective, orphanKpis: canonicalKpis.filter(k => !ownershipByCanonicalKpi.has(k.identity)) };
}
