import type { AreaStrategyConfig, ContributionIndicatorAssignment, ContributionObjective, StrategicObjective } from './strategyTypes';
import type { Dashboard } from './types';
import { canonicalAreaIdentity, classifyStrategicContributionKpis, resolveStrategicKpiOwnership } from './strategyKpiOwnership';

export function buildContributionMatrixViewModel(
  dashboards: Dashboard[], objectives: StrategicObjective[], contributions: ContributionObjective[], areas: AreaStrategyConfig[], assignments: ContributionIndicatorAssignment[],
) {
  const ownership = resolveStrategicKpiOwnership(dashboards, objectives, contributions, assignments);
  const presentation = classifyStrategicContributionKpis(ownership, contributions, assignments);
  const areaCells = new Map<string, string>();
  contributions.forEach(oc => areaCells.set(oc.areaConfigId || canonicalAreaIdentity(oc.areaName, areas), oc.areaName || 'Área no definida'));
  return { ownership, areas: [...areaCells.entries()].sort((a, b) => a[1].localeCompare(b[1])), strategicObjectives: objectives.map(strategicObjective => ({ strategicObjective, contributionObjectives: contributions.filter(oc => oc.primaryStrategicObjectiveId === strategicObjective.id).map(contributionObjective => ({ contributionObjective, kpis: presentation.contributionKpisByContributionObjective.get(contributionObjective.id) || [] })) })) };
}
