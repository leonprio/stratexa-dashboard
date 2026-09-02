import type { Dashboard } from './types';
import type { AreaStrategyConfig, ContributionIndicatorAssignment, ContributionObjective, StrategicObjective } from './strategyTypes';
import { getPhysicalKpiKey } from './strategyTypes';

export type LogicalKpiAlias = { dashboard: Dashboard; item: any; physicalKey: string; sourceType?: string };
export type StrategicKpiCandidate = { dashboard: Dashboard; item: any; identity: string; logicalKpiId: string; physicalKey: string; physicalAliases: LogicalKpiAlias[] };
export type StrategicKpiOwnership = { strategicObjectiveId: string; assignmentType: 'DIRECT' | 'CONTRIBUTION'; contributionObjectiveId?: string; dashboardId: number | string; itemId: number | string };
export type StrategicKpiOwnershipResolution = ReturnType<typeof resolveStrategicKpiOwnership>;
export type StrategicContributionPresentation = {
  directKpisByStrategicObjective: Map<string, StrategicKpiCandidate[]>;
  contributionKpisByContributionObjective: Map<string, StrategicKpiCandidate[]>;
};

export function canonicalAreaIdentity(areaName: string | undefined, configs: AreaStrategyConfig[] = []): string {
  const normalized = normalizeLogicalKpiLabel(areaName || 'AREA_NO_DEFINIDA');
  const config = configs.find(candidate => [candidate.areaName, candidate.code, ...(candidate.aliases || [])].some(alias => normalizeLogicalKpiLabel(alias) === normalized));
  return config?.id || config?.code || normalized;
}

export function normalizeLogicalKpiLabel(value: string = ''): string {
  return value.trim().toLocaleUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ');
}

function logicalIdentity(item: any, dashboard: Dashboard): string {
  const definitionId = item.indicatorDefinitionId || item.definitionId || item.kpiDefinitionId;
  if (definitionId) return `definition:${String(definitionId).trim()}`;
  if (item.semanticKey?.trim()) return `semantic:${item.semanticKey.trim()}`;
  if (item.parentDefinitionId?.trim()) return `parent:${item.parentDefinitionId.trim()}`;
  const label = normalizeLogicalKpiLabel(item.indicator || item.name || '').replace(/\s+\((COMERCIAL Y VENTAS|LOGISTICA Y TRANSPORTE|OPERACIONES Y ALMACEN)\)$/, '');
  return `label:${label || `${dashboard.title}:${item.id}`}`;
}

export function buildLogicalKpiCatalog(dashboards: Dashboard[]): StrategicKpiCandidate[] {
  const groups = new Map<string, StrategicKpiCandidate>();
  dashboards.forEach(dashboard => (dashboard.items || []).forEach(item => {
    const identity = logicalIdentity(item, dashboard);
    const alias = { dashboard, item, physicalKey: getPhysicalKpiKey(dashboard.id, item.id), sourceType: dashboard.isAggregate ? 'DERIVED' : 'OPERATIONAL' };
    const existing = groups.get(identity);
    if (existing) {
      existing.physicalAliases.push(alias);
      const score = (candidate: LogicalKpiAlias) => (candidate.dashboard.isAggregate ? 2 : /resumen|sintesis|global|consolid/i.test(candidate.dashboard.title || '') ? 1 : 0);
      if (score(alias) < score({ dashboard: existing.dashboard, item: existing.item, physicalKey: existing.physicalKey })) {
        existing.dashboard = dashboard; existing.item = item; existing.physicalKey = alias.physicalKey;
      }
      return;
    }
    groups.set(identity, { dashboard, item, identity, logicalKpiId: identity, physicalKey: alias.physicalKey, physicalAliases: [alias] });
  }));
  return Array.from(groups.values());
}

export function resolveStrategicKpiOwnership(dashboards: Dashboard[], objectives: StrategicObjective[], contributions: ContributionObjective[], assignments: ContributionIndicatorAssignment[]) {
  const candidates: StrategicKpiCandidate[] = buildLogicalKpiCatalog(dashboards);
  const byPhysical = new Map<string, StrategicKpiCandidate>();
  candidates.forEach(candidate => candidate.physicalAliases.forEach(alias => byPhysical.set(`${alias.dashboard.id}_${alias.item.id}`, candidate)));
  const ownerByOC = new Map(contributions.map(oc => [oc.id, oc.primaryStrategicObjectiveId]));
  const ownershipByCanonicalKpi = new Map<string, StrategicKpiOwnership>();
  const logicalKpiConflicts = new Map<string, Set<string>>();
  assignments.forEach(a => {
    const candidate = byPhysical.get(`${a.dashboardId}_${a.itemId}`); if (!candidate) return;
    const strategicObjectiveId = a.strategicObjectiveId || (a.contributionObjectiveId ? ownerByOC.get(a.contributionObjectiveId) : undefined); if (!strategicObjectiveId) return;
    const existing = ownershipByCanonicalKpi.get(candidate.identity);
    if (existing && existing.strategicObjectiveId !== strategicObjectiveId) {
      const conflict = logicalKpiConflicts.get(candidate.identity) || new Set([existing.strategicObjectiveId]);
      conflict.add(strategicObjectiveId); logicalKpiConflicts.set(candidate.identity, conflict);
    } else if (!existing || (a.strategicObjectiveId && existing.assignmentType !== 'DIRECT')) ownershipByCanonicalKpi.set(candidate.identity, { strategicObjectiveId, assignmentType: a.strategicObjectiveId ? 'DIRECT' : 'CONTRIBUTION', contributionObjectiveId: a.contributionObjectiveId, dashboardId: a.dashboardId, itemId: a.itemId });
  });
  const canonicalKpis = Array.from(new Map(candidates.map(c => [c.identity, c])).values());
  const kpisByStrategicObjective = new Map<string, StrategicKpiCandidate[]>();
  canonicalKpis.forEach(k => { const owner = ownershipByCanonicalKpi.get(k.identity); if (owner) kpisByStrategicObjective.set(owner.strategicObjectiveId, [...(kpisByStrategicObjective.get(owner.strategicObjectiveId) || []), k]); });
  const occupiedPhysicalKpiKeys = new Set(assignments.map(a => getPhysicalKpiKey(a.dashboardId, a.itemId)));
  const occupiedCanonicalKpiIdentities = new Set(ownershipByCanonicalKpi.keys());
  return { canonicalKpis, ownershipByCanonicalKpi, logicalKpiConflicts, kpisByStrategicObjective, orphanKpis: canonicalKpis.filter(k => !ownershipByCanonicalKpi.has(k.identity)), occupiedPhysicalKpiKeys, occupiedCanonicalKpiIdentities };
}

/** Classifies logical KPIs for the Contribution reading using real assignments.
 * Direct ownership wins when a logical KPI has both physical representations assigned.
 */
export function classifyStrategicContributionKpis(
  ownership: StrategicKpiOwnershipResolution,
  contributions: ContributionObjective[],
  assignments: ContributionIndicatorAssignment[],
): StrategicContributionPresentation {
  const byPhysical = new Map<string, StrategicKpiCandidate>();
  ownership.canonicalKpis.forEach(candidate => candidate.physicalAliases.forEach(alias => byPhysical.set(`${alias.dashboard.id}_${alias.item.id}`, candidate)));
  const directIdsByObjective = new Map<string, Set<string>>();
  const viaIdsByOc = new Map<string, Set<string>>();
  assignments.forEach(assignment => {
    const candidate = byPhysical.get(`${assignment.dashboardId}_${assignment.itemId}`);
    if (!candidate) return;
    if (assignment.strategicObjectiveId) {
      const ids = directIdsByObjective.get(assignment.strategicObjectiveId) || new Set<string>();
      ids.add(candidate.identity);
      directIdsByObjective.set(assignment.strategicObjectiveId, ids);
    } else if (assignment.contributionObjectiveId && contributions.some(oc => oc.id === assignment.contributionObjectiveId)) {
      const ids = viaIdsByOc.get(assignment.contributionObjectiveId) || new Set<string>();
      ids.add(candidate.identity);
      viaIdsByOc.set(assignment.contributionObjectiveId, ids);
    }
  });
  const candidateById = new Map(ownership.canonicalKpis.map(candidate => [candidate.identity, candidate]));
  const directKpisByStrategicObjective = new Map<string, StrategicKpiCandidate[]>();
  directIdsByObjective.forEach((ids, objectiveId) => directKpisByStrategicObjective.set(objectiveId, [...ids].map(id => candidateById.get(id)).filter(Boolean) as StrategicKpiCandidate[]));
  const contributionKpisByContributionObjective = new Map<string, StrategicKpiCandidate[]>();
  viaIdsByOc.forEach((ids, contributionObjectiveId) => {
    const objectiveId = contributions.find(oc => oc.id === contributionObjectiveId)?.primaryStrategicObjectiveId;
    const directIds = objectiveId ? directIdsByObjective.get(objectiveId) || new Set<string>() : new Set<string>();
    contributionKpisByContributionObjective.set(contributionObjectiveId, [...ids].filter(id => !directIds.has(id)).map(id => candidateById.get(id)).filter(Boolean) as StrategicKpiCandidate[]);
  });
  return { directKpisByStrategicObjective, contributionKpisByContributionObjective };
}

export function getAvailableStrategicKpis(ownership: StrategicKpiOwnershipResolution): StrategicKpiCandidate[] {
  return ownership.canonicalKpis.filter(candidate => {
    if (ownership.occupiedCanonicalKpiIdentities.has(candidate.identity)) return false;
    return candidate.physicalAliases.every(alias => !ownership.occupiedPhysicalKpiKeys.has(alias.physicalKey));
  });
}
