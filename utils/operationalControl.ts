import { Dashboard, DashboardItem, ComplianceThresholds, ComplianceStatus } from '../types';
import { attachOperationalMetrics } from './compliance';

export const resolveOperationalIdentity = (dashboard: Dashboard, item: DashboardItem) => ({
  client: dashboard.clientId || 'CLIENTE NO IDENTIFICADO',
  direction: (dashboard.group || 'SIN DIRECCIÓN REGISTRADA').trim().toUpperCase(),
  area: (dashboard.area || 'SIN ÁREA REGISTRADA').trim().toUpperCase(),
  indicator: item.indicator || 'INDICADOR SIN NOMBRE'
});

export interface OperationalActorMetrics {
  name: string;
  captureRate: number;
  missingPeriods: number;
  stalenessDays: number;
  kpisCount: number;
  healthScore: number;
}

/**
 * Mide el score derivado de salud operativa (operationalHealthScore).
 * Fusión de disciplina de captura (40%), cumplimiento real (40%) y frescura (20%).
 */
export const calculateOperationalHealth = (items: DashboardItem[]): number => {
  const activeItems = items.filter(it => it.operationalMetrics);
  if (activeItems.length === 0) return 100;

  const sumHealth = activeItems.reduce((sum, item) => {
    const m = item.operationalMetrics!;
    // Frescura: 0 días = 100%, 60 días o más = 0%
    const freshness = Math.max(0, 100 - (m.stalenessDays * 1.66));
    const health = (m.captureRate * 0.4) + (m.realOperationalScore * 0.4) + (freshness * 0.2);
    return sum + health;
  }, 0);

  return Math.round(sumHealth / activeItems.length);
};

/**
 * Inyecta de forma inmutable y en caliente las métricas operativas a todos los items de los tableros.
 */
export const enrichDashboardsWithOperationalMetrics = (
  dashboards: Dashboard[],
  globalThresholds: ComplianceThresholds,
  year: number
): Dashboard[] => {
  return dashboards.map(d => {
    const thresholds = d.thresholds || globalThresholds;
    const boardYear = d.year || year;
    const enrichedItems = (d.items || []).map(item =>
      attachOperationalMetrics(item, thresholds, boardYear, 'realTime', d.items || [])
    );
    return {
      ...d,
      items: enrichedItems
    };
  });
};

/**
 * Construye los rankings operativos de Direcciones y Áreas.
 */
export const buildOperationalRanking = (
  dashboards: Dashboard[],
  globalThresholds: ComplianceThresholds,
  year: number,
  isAlreadyEnriched?: boolean
) => {
  const enriched = isAlreadyEnriched
    ? dashboards
    : enrichDashboardsWithOperationalMetrics(dashboards, globalThresholds, year);

  const directionMap = new Map<string, DashboardItem[]>();
  const areaMap = new Map<string, DashboardItem[]>();

  enriched.forEach(d => {
    // Evitar procesar tableros agregados globales en el ranking para no duplicar datos
    if (d.isAggregate || String(d.id).includes('agg-') || d.id === -1) return;

    const identity = resolveOperationalIdentity(d, d.items?.[0] || ({ indicator: '' } as DashboardItem));
    const dirName = identity.direction;
    const areaName = identity.area;

    if (!directionMap.has(dirName)) directionMap.set(dirName, []);
    if (!areaMap.has(areaName)) areaMap.set(areaName, []);

    (d.items || []).forEach(item => {
      directionMap.get(dirName)!.push(item);
      areaMap.get(areaName)!.push(item);
    });
  });

  const compileActorMetrics = (map: Map<string, DashboardItem[]>): OperationalActorMetrics[] => {
    return Array.from(map.entries()).map(([name, items]) => {
      const activeItems = items.filter(it => it.operationalMetrics);
      const count = activeItems.length;
      if (count === 0) {
        return { name, captureRate: 100, missingPeriods: 0, stalenessDays: 0, kpisCount: 0, healthScore: 100 };
      }

      const sumCapture = activeItems.reduce((sum, it) => sum + it.operationalMetrics!.captureRate, 0);
      const sumMissing = activeItems.reduce((sum, it) => sum + it.operationalMetrics!.missingPeriods, 0);
      const sumStaleness = activeItems.reduce((sum, it) => sum + it.operationalMetrics!.stalenessDays, 0);
      const health = calculateOperationalHealth(activeItems);

      return {
        name,
        captureRate: Math.round(sumCapture / count),
        missingPeriods: sumMissing,
        stalenessDays: Math.round(sumStaleness / count),
        kpisCount: count,
        healthScore: health
      };
    });
  };

  const directions = compileActorMetrics(directionMap);
  const areas = compileActorMetrics(areaMap);

  // Ordenar: TOP Actualizados (mayor captureRate, menor staleness, mayor health)
  const sortTop = (list: OperationalActorMetrics[]) =>
    [...list].sort((a, b) => b.healthScore - a.healthScore || b.captureRate - a.captureRate || a.stalenessDays - b.stalenessDays);

  // Ordenar: TOP Atrasados (menor health, menor captureRate, mayor staleness)
  const sortDelayed = (list: OperationalActorMetrics[]) =>
    [...list].sort((a, b) => a.healthScore - b.healthScore || a.captureRate - b.captureRate || b.stalenessDays - a.stalenessDays);

  return {
    directions: {
      top: sortTop(directions),
      delayed: sortDelayed(directions)
    },
    areas: {
      top: sortTop(areas),
      delayed: sortDelayed(areas)
    }
  };
};

export interface HeatmapCell {
  direction: string;
  area: string;
  captureRate: number;
  stalenessDays: number;
  missingPeriods: number;
  kpisCount: number;
  status: ComplianceStatus;
}

/**
 * Construye la matriz de heatmap Dirección × Área.
 */
export const buildOperationalMatrix = (
  dashboards: Dashboard[],
  globalThresholds: ComplianceThresholds,
  year: number,
  isAlreadyEnriched?: boolean
): { directions: string[]; areas: string[]; matrix: HeatmapCell[] } => {
  const enriched = isAlreadyEnriched
    ? dashboards
    : enrichDashboardsWithOperationalMetrics(dashboards, globalThresholds, year);

  const directionSet = new Set<string>();
  const areaSet = new Set<string>();
  const cellMap = new Map<string, DashboardItem[]>();

  enriched.forEach(d => {
    if (d.isAggregate || String(d.id).includes('agg-') || d.id === -1) return;

    const identity = resolveOperationalIdentity(d, d.items?.[0] || ({ indicator: '' } as DashboardItem));
    const dirName = identity.direction;
    const areaName = identity.area;

    directionSet.add(dirName);
    areaSet.add(areaName);

    const cellKey = `${dirName}||${areaName}`;
    if (!cellMap.has(cellKey)) cellMap.set(cellKey, []);

    (d.items || []).forEach(item => {
      cellMap.get(cellKey)!.push(item);
    });
  });

  const directions = Array.from(directionSet).sort();
  const areas = Array.from(areaSet).sort();
  const matrix: HeatmapCell[] = [];

  directions.forEach(direction => {
    areas.forEach(area => {
      const cellKey = `${direction}||${area}`;
      const items = cellMap.get(cellKey) || [];
      const activeItems = items.filter(it => it.operationalMetrics);
      const count = activeItems.length;

      if (count === 0) {
        matrix.push({
          direction,
          area,
          captureRate: 100,
          stalenessDays: 0,
          missingPeriods: 0,
          kpisCount: 0,
          status: 'Neutral'
        });
        return;
      }

      const sumCapture = activeItems.reduce((sum, it) => sum + it.operationalMetrics!.captureRate, 0);
      const sumMissing = activeItems.reduce((sum, it) => sum + it.operationalMetrics!.missingPeriods, 0);
      const sumStaleness = activeItems.reduce((sum, it) => sum + it.operationalMetrics!.stalenessDays, 0);

      const captureRate = Math.round(sumCapture / count);
      const stalenessDays = Math.round(sumStaleness / count);
      const missingPeriods = sumMissing;

      // Determinación de semáforo operativo de celda:
      // Verde: >=95% captura y <=5 días de atraso
      // Amarillo: >=85% captura y <=15 días de atraso (1 mes vencido aprox)
      // Naranja: >=70% captura y <=45 días de atraso (2 meses vencidos aprox)
      // Rojo: <70% captura o >=60 días de atraso (3+ meses vencidos o rezago severo)
      let status: ComplianceStatus = 'OnTrack';
      if (captureRate < 70 || stalenessDays >= 60) {
        status = 'OffTrack'; // Rojo
      } else if (captureRate < 85 || stalenessDays >= 30) {
        status = 'AtRisk'; // Naranja
      } else if (captureRate < 95 || stalenessDays > 5) {
        status = 'InProgress'; // Amarillo
      }

      matrix.push({
        direction,
        area,
        captureRate,
        stalenessDays,
        missingPeriods,
        kpisCount: count,
        status
      });
    });
  });

  return {
    directions,
    areas,
    matrix
  };
};
