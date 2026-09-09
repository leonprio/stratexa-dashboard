import type { Dashboard } from "../types";
import type { AreaStrategyConfig } from "../strategyTypes";

const LVP_LEGACY_AREAS = new Set([
  "SOSTENIBILIDAD",
  "CAPACIDADES",
  "PROCESOS",
  "IMPACTO Y VALOR",
]);

const normalize = (value: unknown) => String(value || "").trim().toUpperCase();

/** Resolves an operational area for display without changing authorization or persistence. */
export function resolveOperationalArea(
  dashboard: (Pick<Dashboard, "clientId" | "title" | "area"> & { areaId?: string }) | undefined,
  configs: AreaStrategyConfig[] = [],
): string | undefined {
  if (!dashboard) return undefined;
  const explicit = normalize(dashboard.areaId || dashboard.area);
  if (explicit) return explicit;

  const title = normalize(dashboard.title);
  const configured = configs.find((config) =>
    [config.areaName, config.code, ...(config.aliases || [])].some((value) => normalize(value) === title),
  );
  if (configured) return configured.areaName;

  if (normalize(dashboard.clientId) === "LVP" && LVP_LEGACY_AREAS.has(title)) {
    return dashboard.title.trim();
  }

  return undefined;
}
