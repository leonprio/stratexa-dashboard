import type { Dashboard } from './types';
import type { AreaStrategyConfig, ContributionIndicatorAssignment, ContributionObjective } from './strategyTypes';
import { buildLogicalKpiCatalog, canonicalAreaIdentity } from './strategyKpiOwnership';

export const physicalAssignmentKey = (value: { dashboardId: string | number; itemId: string | number }) => JSON.stringify([String(value.dashboardId), String(value.itemId)]);
export const isOperationalDashboard = (d: Dashboard) => !d.isAggregate && !String(d.id).startsWith('agg-') && !(Number(d.id) < 0);

export function assertStrategicContributionParity(objectives: string[], contribution: string[]) {
  const a = new Set(objectives); const b = new Set(contribution);
  const objectivesOnly = [...a].filter(id => !b.has(id));
  const contributionOnly = [...b].filter(id => !a.has(id));
  const duplicates = objectives.length - a.size + contribution.length - b.size;
  if (objectivesOnly.length || contributionOnly.length || duplicates) {
    throw new Error(`Paridad estratégica inválida: objectivesOnly=${objectivesOnly.length}, contributionOnly=${contributionOnly.length}, duplicates=${duplicates}`);
  }
  return {objectivesOnly, contributionOnly, duplicates};
}

/** Configuration never persists a virtual aggregate alias. */
export function contributionPickerCatalog(dashboards: Dashboard[], clientId: string) {
  return buildLogicalKpiCatalog(dashboards.filter(d =>
    isOperationalDashboard(d) && d.clientId?.trim().toUpperCase() === clientId.trim().toUpperCase(),
  ));
}

export function contributionPickerCandidates(
  dashboards: Dashboard[], clientId: string, areaName: string, areas: AreaStrategyConfig[],
  ocId: string | null, assignments: ContributionIndicatorAssignment[],
) {
  const area = canonicalAreaIdentity(areaName, areas);
  return contributionPickerCatalog(dashboards, clientId).flatMap(candidate => {
    const aliases = candidate.physicalAliases.filter(a => canonicalAreaIdentity(a.dashboard.area, areas) === area);
    if (!aliases.length) return [];
    const keys = new Set(candidate.physicalAliases.map(a => physicalAssignmentKey({dashboardId:a.dashboard.id, itemId:a.item.id})));
    // DIRECT is convertible, including an explicit reassignment from another OE.
    if (assignments.some(a => a.contributionObjectiveId && a.contributionObjectiveId !== ocId && keys.has(physicalAssignmentKey(a)))) return [];
    const operational = aliases[0];
    return [{dashboard:operational.dashboard, item:operational.item, candidate:{...candidate, dashboard:operational.dashboard, item:operational.item, physicalAliases:aliases}}];
  });
}

export interface OperationalAssignmentInput {
  dashboardId: string | number;
  itemId: string | number;
  logicalKpiId?: string;
  year?: number;
  physicalAliases?: {dashboardId: string | number; itemId: string | number}[];
}

export function assignmentFingerprint(assignments: ContributionIndicatorAssignment[]) {
  return JSON.stringify(assignments.map(a => [a.id, String(a.dashboardId), String(a.itemId), a.contributionObjectiveId || '', a.strategicObjectiveId || '', a.clientId, a.createdAt || '']).sort((a,b)=>a[0].localeCompare(b[0])));
}

/** Delta plan preserves unchanged documents and their timestamps. */
export function planContributionAssignments(
  oc: ContributionObjective, inputs: OperationalAssignmentInput[], assignments: ContributionIndicatorAssignment[],
) {
  const selected = [...new Map(inputs.map(i=>[i.logicalKpiId || physicalAssignmentKey(i), i])).values()];
  const wanted = new Set(selected.map(physicalAssignmentKey));
  const aliases = new Set(selected.flatMap(i => [i, ...(i.physicalAliases || [])].map(physicalAssignmentKey)));
  if (assignments.some(a => a.contributionObjectiveId && a.contributionObjectiveId !== oc.id && aliases.has(physicalAssignmentKey(a)))) throw new Error('El indicador ya pertenece a otro OC.');
  const remove = assignments.filter(a =>
    (a.contributionObjectiveId === oc.id && !wanted.has(physicalAssignmentKey(a))) ||
    (!a.contributionObjectiveId && Boolean(a.strategicObjectiveId) && aliases.has(physicalAssignmentKey(a))),
  );
  const retained = new Map<string, ContributionIndicatorAssignment>();
  assignments.filter(a=>a.contributionObjectiveId===oc.id && wanted.has(physicalAssignmentKey(a))).forEach(a=>{
    const key=physicalAssignmentKey(a);
    if(retained.has(key)) remove.push(a); else retained.set(key,a);
  });
  const create = selected.filter(i=>!retained.has(physicalAssignmentKey(i))).map(i=>({
    id:`asgn_${oc.id}_${i.dashboardId}_${i.itemId}`, clientId:oc.clientId,
    contributionObjectiveId:oc.id, dashboardId:i.dashboardId, itemId:i.itemId,
    logicalKpiId:i.logicalKpiId, year:i.year,
  }));
  return {selected, create, remove, retained:[...retained.values()]};
}
