import type { Dashboard, DashboardItem } from '../types';
import type { TrackingPeriod } from './trackingObligation';

export type ControlOperation = 'CONFIGURAR' | 'REGISTRAR_AVANCE' | 'GESTIONAR';

export interface ControlNavigationTarget {
  clientId: string;
  dashboardId: Dashboard['id'];
  itemId: DashboardItem['id'];
  period: TrackingPeriod;
  operation: ControlOperation;
  origin: 'control';
}

export const currentControlPeriod = (frequency: 'monthly' | 'weekly', year: number, now = new Date()): TrackingPeriod => {
  if (frequency === 'monthly') return { frequency, year, monthIndex: year < now.getFullYear() ? 11 : year > now.getFullYear() ? 0 : now.getMonth() };
  const weekNumber = year < now.getFullYear() ? 53 : Math.max(1, Math.min(53, Math.ceil((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / 604800000)));
  return { frequency, year, weekNumber };
};

export const isValidControlTarget = (target: ControlNavigationTarget, dashboards: Dashboard[], year: number, activeClientId?: string): boolean => {
  if (!target?.period || target.origin !== 'control' || !['CONFIGURAR', 'REGISTRAR_AVANCE', 'GESTIONAR'].includes(target.operation) || !['monthly', 'weekly'].includes(target.period.frequency)) return false;
  const client = target.clientId.trim().toUpperCase();
  const index = target.period.frequency === 'monthly' ? target.period.monthIndex : target.period.weekNumber - 1;
  if (!client || target.period.year !== year || !Number.isInteger(index) || index < 0 || index >= (target.period.frequency === 'monthly' ? 12 : 53)) return false;
  return dashboards.some(dashboard =>
    String(dashboard.id) === String(target.dashboardId) &&
    (dashboard.clientId || activeClientId)?.trim().toUpperCase() === client &&
    dashboard.isAggregate !== true &&
    dashboard.items.some(item => String(item.id) === String(target.itemId) &&
      (item.frequency || dashboard.periodicity || 'monthly') === target.period.frequency),
  );
};
