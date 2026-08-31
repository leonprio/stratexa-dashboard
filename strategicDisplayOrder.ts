import type { Dashboard, DashboardItem } from './types';
import type { ContributionIndicatorAssignment, ContributionObjective, StrategicObjective, StrategicPerspective } from './strategyTypes';
import { resolveStrategicKpiOwnership } from './strategyKpiOwnership';

/** Presentation-only order. It never mutates DashboardItem or persistence. */
export function orderDashboardItemsForStrategicPresentation(
  items: DashboardItem[], dashboardId: number | string, dashboards: Dashboard[], perspectives: StrategicPerspective[], objectives: StrategicObjective[], contributions: ContributionObjective[], assignments: ContributionIndicatorAssignment[]
): DashboardItem[] {
  if (!objectives.length || !assignments.length) return [...items];
  const ownership = resolveStrategicKpiOwnership(dashboards, objectives, contributions, assignments);
  const perspectiveRank = new Map([...perspectives].sort((a, b) => (a.order || 0) - (b.order || 0)).map((p, index) => [p.id, index]));
  const objectiveRank = new Map([...objectives].sort((a, b) => ((perspectiveRank.get(a.perspectiveId) || 0) - (perspectiveRank.get(b.perspectiveId) || 0)) || ((a.order || 0) - (b.order || 0)) || a.code.localeCompare(b.code)).map((o, index) => [o.id, index]));
  const rankByPhysical = new Map<string, number>();
  ownership.kpisByStrategicObjective.forEach((kpis, objectiveId) => kpis.forEach(kpi => kpi.physicalAliases.forEach(alias => rankByPhysical.set(`${alias.dashboard.id}:${alias.item.id}`, objectiveRank.get(objectiveId) ?? Number.MAX_SAFE_INTEGER))));
  return items.map((item, index) => ({ item, index, rank: rankByPhysical.get(`${dashboardId}:${item.id}`) ?? Number.MAX_SAFE_INTEGER, stable: item.order ?? index }))
    .sort((a, b) => a.rank - b.rank || a.stable - b.stable || String(a.item.indicator).localeCompare(String(b.item.indicator)))
    .map(entry => entry.item);
}
