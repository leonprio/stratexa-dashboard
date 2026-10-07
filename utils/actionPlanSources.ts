import type { Dashboard, DashboardItem, User } from '../types';
import { canAccessDashboard, canEditActionPlan } from '../services/tableroAuthorization';

export interface ActionPlanSource {
  clientId: string;
  dashboardId: number | string;
  indicatorId: number | string;
  label?: string;
  canEdit: boolean;
}

export function resolveActionPlanSources(user: User, dashboard: Dashboard, item: DashboardItem, boards: Dashboard[]): ActionPlanSource[] {
  const aggregate = dashboard.isAggregate || dashboard.id === -1 || String(dashboard.id).startsWith('agg-');
  if (!aggregate) return [{ clientId: dashboard.clientId || '', dashboardId: dashboard.id, indicatorId: item.id, canEdit: canEditActionPlan(user, dashboard) }];
  const sources = (item as DashboardItem & { sources?: { boardId: number | string; itemId: number | string }[] }).sources;
  if (!Array.isArray(sources)) return [];
  const tenant = String(dashboard.clientId || '').trim().toUpperCase();
  if (!tenant) return [];
  const resolved = new Map<string, ActionPlanSource>();
  for (const source of sources) {
    if (!source || source.boardId === undefined || source.itemId === undefined) continue;
    const board = boards.find(value => String(value.id) === String(source.boardId) &&
      !value.isAggregate && value.id !== -1 && !String(value.id).startsWith('agg-') &&
      String(value.clientId || '').trim().toUpperCase() === tenant);
    const sourceItem = board?.items?.find(value => String(value.id) === String(source.itemId));
    if (!board || !sourceItem || !canAccessDashboard(user, board)) continue;
    const key = JSON.stringify([tenant, String(board.id), String(sourceItem.id)]);
    resolved.set(key, { clientId: board.clientId!, dashboardId: board.id, indicatorId: sourceItem.id,
      label: `${board.title} · ${sourceItem.indicator}`, canEdit: canEditActionPlan(user, board) });
  }
  return [...resolved.values()];
}
