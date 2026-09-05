import type { Dashboard } from "./types";
import type {
  AreaStrategyConfig,
  ContributionIndicatorAssignment,
  ContributionObjective,
  StrategicObjective,
} from "./strategyTypes";
import { getPhysicalKpiKey } from "./strategyTypes";

export type LogicalKpiAlias = {
  dashboard: Dashboard;
  item: any;
  physicalKey: string;
  sourceType?: string;
};
export type StrategicKpiCandidate = {
  dashboard: Dashboard;
  item: any;
  identity: string;
  logicalKpiId: string;
  physicalKey: string;
  physicalAliases: LogicalKpiAlias[];
};
export type StrategicKpiOwnership = {
  strategicObjectiveId: string;
  assignmentType: "DIRECT" | "CONTRIBUTION";
  contributionObjectiveId?: string;
  dashboardId: number | string;
  itemId: number | string;
};
export type StrategicKpiOwnershipResolution = ReturnType<
  typeof resolveStrategicKpiOwnership
>;
export type StrategicContributionPresentation = {
  directKpisByStrategicObjective: Map<string, StrategicKpiCandidate[]>;
  contributionKpisByContributionObjective: Map<string, StrategicKpiCandidate[]>;
};
export type StrategicKpiContributionPath = {
  logicalKpi: StrategicKpiCandidate;
  path: "DIRECT_TO_OE" | "VIA_OC" | "UNASSIGNED";
  strategicObjectiveId?: string;
  contributionObjectiveId?: string;
  areaId?: string;
  physicalAliases: LogicalKpiAlias[];
};

export function canonicalAreaIdentity(
  areaName: string | undefined,
  configs: AreaStrategyConfig[] = [],
): string {
  const normalized = normalizeLogicalKpiLabel(areaName || "AREA_NO_DEFINIDA");
  const config = configs.find((candidate) =>
    [candidate.areaName, candidate.code, ...(candidate.aliases || [])].some(
      (alias) => normalizeLogicalKpiLabel(alias) === normalized,
    ),
  );
  return config?.id || config?.code || normalized;
}

export function normalizeLogicalKpiLabel(value: string = ""): string {
  return value
    .trim()
    .toLocaleUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function logicalIdentity(item: any, dashboard: Dashboard): string {
  const definitionId =
    item.indicatorDefinitionId || item.definitionId || item.kpiDefinitionId;
  if (definitionId) return `definition:${String(definitionId).trim()}`;
  if (item.semanticKey?.trim()) return `semantic:${item.semanticKey.trim()}`;
  if (item.parentDefinitionId?.trim())
    return `parent:${item.parentDefinitionId.trim()}`;
  const label = normalizeLogicalKpiLabel(
    item.indicator || item.name || "",
  ).replace(
    /\s+\((COMERCIAL Y VENTAS|LOGISTICA Y TRANSPORTE|OPERACIONES Y ALMACEN)\)$/,
    "",
  );
  return `label:${label || `${dashboard.title}:${item.id}`}`;
}

export function buildLogicalKpiCatalog(
  dashboards: Dashboard[],
): StrategicKpiCandidate[] {
  const groups = new Map<string, StrategicKpiCandidate>();
  dashboards.forEach((dashboard) =>
    (dashboard.items || []).filter((item) => item && typeof item === "object").forEach((item) => {
      const identity = logicalIdentity(item, dashboard);
      const alias = {
        dashboard,
        item,
        physicalKey: getPhysicalKpiKey(dashboard.id, item.id),
        sourceType: dashboard.isAggregate ? "DERIVED" : "OPERATIONAL",
      };
      const existing = groups.get(identity);
      if (existing) {
        existing.physicalAliases.push(alias);
        const score = (candidate: LogicalKpiAlias) =>
          candidate.dashboard.isAggregate
            ? 2
            : /resumen|sintesis|global|consolid/i.test(
                  candidate.dashboard.title || "",
                )
              ? 1
              : 0;
        if (
          score(alias) <
          score({
            dashboard: existing.dashboard,
            item: existing.item,
            physicalKey: existing.physicalKey,
          })
        ) {
          existing.dashboard = dashboard;
          existing.item = item;
          existing.physicalKey = alias.physicalKey;
        }
        return;
      }
      groups.set(identity, {
        dashboard,
        item,
        identity,
        logicalKpiId: identity,
        physicalKey: alias.physicalKey,
        physicalAliases: [alias],
      });
    }),
  );
  return Array.from(groups.values());
}

export function resolveStrategicKpiOwnership(
  dashboards: Dashboard[],
  objectives: StrategicObjective[],
  contributions: ContributionObjective[],
  assignments: ContributionIndicatorAssignment[],
) {
  const candidates: StrategicKpiCandidate[] =
    buildLogicalKpiCatalog(dashboards);
  const byPhysical = new Map<string, StrategicKpiCandidate>();
  candidates.forEach((candidate) =>
    candidate.physicalAliases.forEach((alias) =>
      byPhysical.set(`${alias.dashboard.id}_${alias.item.id}`, candidate),
    ),
  );
  const ownerByOC = new Map(
    contributions.map((oc) => [oc.id, oc.primaryStrategicObjectiveId]),
  );
  const ownershipByCanonicalKpi = new Map<string, StrategicKpiOwnership>();
  const logicalKpiConflicts = new Map<string, Set<string>>();
  assignments.forEach((a) => {
    const candidate = byPhysical.get(`${a.dashboardId}_${a.itemId}`);
    if (!candidate) return;
    const strategicObjectiveId = a.contributionObjectiveId
      ? ownerByOC.get(a.contributionObjectiveId)
      : a.strategicObjectiveId;
    if (!strategicObjectiveId) return;
    const existing = ownershipByCanonicalKpi.get(candidate.identity);
    if (existing && existing.strategicObjectiveId !== strategicObjectiveId) {
      const conflict =
        logicalKpiConflicts.get(candidate.identity) ||
        new Set([existing.strategicObjectiveId]);
      conflict.add(strategicObjectiveId);
      logicalKpiConflicts.set(candidate.identity, conflict);
    } else if (
      !existing ||
      (a.contributionObjectiveId && existing.assignmentType !== "CONTRIBUTION")
    )
      ownershipByCanonicalKpi.set(candidate.identity, {
        strategicObjectiveId,
        assignmentType: a.contributionObjectiveId ? "CONTRIBUTION" : "DIRECT",
        contributionObjectiveId: a.contributionObjectiveId,
        dashboardId: a.dashboardId,
        itemId: a.itemId,
      });
  });
  const canonicalKpis = Array.from(
    new Map(candidates.map((c) => [c.identity, c])).values(),
  );
  const kpisByStrategicObjective = new Map<string, StrategicKpiCandidate[]>();
  canonicalKpis.forEach((k) => {
    const owner = ownershipByCanonicalKpi.get(k.identity);
    if (owner)
      kpisByStrategicObjective.set(owner.strategicObjectiveId, [
        ...(kpisByStrategicObjective.get(owner.strategicObjectiveId) || []),
        k,
      ]);
  });
  const occupiedPhysicalKpiKeys = new Set(
    assignments.map((a) => getPhysicalKpiKey(a.dashboardId, a.itemId)),
  );
  const occupiedCanonicalKpiIdentities = new Set(
    ownershipByCanonicalKpi.keys(),
  );
  return {
    canonicalKpis,
    ownershipByCanonicalKpi,
    logicalKpiConflicts,
    kpisByStrategicObjective,
    orphanKpis: canonicalKpis.filter(
      (k) => !ownershipByCanonicalKpi.has(k.identity),
    ),
    occupiedPhysicalKpiKeys,
    occupiedCanonicalKpiIdentities,
  };
}

/** Classifies logical KPIs for the Contribution reading using real assignments.
 * A persisted OC assignment is authoritative over any legacy/direct OE field.
 */
export function classifyStrategicContributionKpis(
  ownership: StrategicKpiOwnershipResolution,
  contributions: ContributionObjective[],
  assignments: ContributionIndicatorAssignment[],
): StrategicContributionPresentation {
  const directIdsByObjective = new Map<string, Set<string>>();
  const viaIdsByOc = new Map<string, Set<string>>();
  resolveStrategicKpiContributionPath(ownership, contributions).forEach(
    (entry) => {
      if (entry.path === "DIRECT_TO_OE" && entry.strategicObjectiveId) {
        const ids =
          directIdsByObjective.get(entry.strategicObjectiveId) ||
          new Set<string>();
        ids.add(entry.logicalKpi.identity);
        directIdsByObjective.set(entry.strategicObjectiveId, ids);
      } else if (entry.path === "VIA_OC" && entry.contributionObjectiveId) {
        const ids =
          viaIdsByOc.get(entry.contributionObjectiveId) || new Set<string>();
        ids.add(entry.logicalKpi.identity);
        viaIdsByOc.set(entry.contributionObjectiveId, ids);
      }
    },
  );
  const candidateById = new Map(
    ownership.canonicalKpis.map((candidate) => [candidate.identity, candidate]),
  );
  const directKpisByStrategicObjective = new Map<
    string,
    StrategicKpiCandidate[]
  >();
  directIdsByObjective.forEach((ids, objectiveId) =>
    directKpisByStrategicObjective.set(
      objectiveId,
      [...ids]
        .map((id) => candidateById.get(id))
        .filter(Boolean) as StrategicKpiCandidate[],
    ),
  );
  const contributionKpisByContributionObjective = new Map<
    string,
    StrategicKpiCandidate[]
  >();
  viaIdsByOc.forEach((ids, contributionObjectiveId) => {
    const objectiveId = contributions.find(
      (oc) => oc.id === contributionObjectiveId,
    )?.primaryStrategicObjectiveId;
    const directIds = objectiveId
      ? directIdsByObjective.get(objectiveId) || new Set<string>()
      : new Set<string>();
    contributionKpisByContributionObjective.set(
      contributionObjectiveId,
      [...ids]
        .filter((id) => !directIds.has(id))
        .map((id) => candidateById.get(id))
        .filter(Boolean) as StrategicKpiCandidate[],
    );
  });
  return {
    directKpisByStrategicObjective,
    contributionKpisByContributionObjective,
  };
}

/** Single source for why a logical KPI appears in the contribution reading. */
export function resolveStrategicKpiContributionPath(
  ownership: StrategicKpiOwnershipResolution,
  contributions: ContributionObjective[],
): StrategicKpiContributionPath[] {
  const byOc = new Map(contributions.map((oc) => [oc.id, oc]));
  return ownership.canonicalKpis.map((logicalKpi) => {
    const owner = ownership.ownershipByCanonicalKpi.get(logicalKpi.identity);
    if (!owner)
      return {
        logicalKpi,
        path: "UNASSIGNED",
        physicalAliases: logicalKpi.physicalAliases,
      };
    const via =
      owner.assignmentType === "CONTRIBUTION" && owner.contributionObjectiveId
        ? byOc.get(owner.contributionObjectiveId)
        : undefined;
    return {
      logicalKpi,
      path: via ? "VIA_OC" : "DIRECT_TO_OE",
      strategicObjectiveId: owner.strategicObjectiveId,
      contributionObjectiveId: via?.id,
      areaId: via?.areaConfigId,
      physicalAliases: logicalKpi.physicalAliases,
    };
  });
}

export function getAvailableStrategicKpis(
  ownership: StrategicKpiOwnershipResolution,
): StrategicKpiCandidate[] {
  return ownership.canonicalKpis.filter((candidate) => {
    if (ownership.occupiedCanonicalKpiIdentities.has(candidate.identity))
      return false;
    return candidate.physicalAliases.every(
      (alias) => !ownership.occupiedPhysicalKpiKeys.has(alias.physicalKey),
    );
  });
}
