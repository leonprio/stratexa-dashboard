import { canAccessDashboard, isPlatformAdmin } from "../services/tableroAuthorization";
import type { DashboardItem, User } from "../types";

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

export const TEST_TENANT = "TEST_KPI_INTEGRITY";
export const TEST_OTHER_TENANT = "TEST_OTHER_TENANT";
export const TEST_DASHBOARD = "TEST_DASHBOARD_2026";

type TestDashboard = {
  id: string;
  clientId: string;
  year: number;
  items: DashboardItem[];
};

export class InMemoryKpiBackend {
  private readonly dashboards = new Map<string, TestDashboard>();

  seed(): void {
    this.dashboards.set(TEST_DASHBOARD, {
      id: TEST_DASHBOARD,
      clientId: TEST_TENANT,
      year: 2026,
      items: [],
    });
  }

  snapshot(): TestDashboard[] {
    return clone([...this.dashboards]);
  }

  reconstruct(): InMemoryKpiBackend {
    const next = new InMemoryKpiBackend();
    for (const [id, dashboard] of this.dashboards) {
      next.dashboards.set(id, clone(dashboard));
    }
    return next;
  }

  createKpi(user: User, item: DashboardItem): void {
    this.assertWrite(user, TEST_DASHBOARD);
    const dashboard = this.requireDashboard(TEST_DASHBOARD);
    if (dashboard.items.some((candidate) => String(candidate.id) === String(item.id))) {
      throw new Error("KPI_ALREADY_EXISTS");
    }
    dashboard.items.push(clone(item));
  }

  readKpi(dashboardId: string, itemId: string | number): DashboardItem | null {
    return clone(
      this.requireDashboard(dashboardId).items.find(
        (item) => String(item.id) === String(itemId),
      ) || null,
    );
  }

  updateKpi(user: User, dashboardId: string, item: DashboardItem): void {
    this.assertWrite(user, dashboardId);
    const dashboard = this.requireDashboard(dashboardId);
    const index = dashboard.items.findIndex((candidate) => String(candidate.id) === String(item.id));
    if (index < 0) throw new Error("KPI_NOT_FOUND");
    dashboard.items[index] = clone(item);
  }

  updateAggregateKpi(
    user: User,
    aggregate: { sourceDashboardId?: string; itemId?: string | number },
    item: DashboardItem,
  ): void {
    if (!aggregate.sourceDashboardId || aggregate.itemId == null) {
      throw new Error("AMBIGUOUS_AGGREGATE_SOURCE");
    }
    if (String(aggregate.itemId) !== String(item.id)) {
      throw new Error("AGGREGATE_ITEM_MISMATCH");
    }
    this.updateKpi(user, aggregate.sourceDashboardId, item);
  }

  deleteKpi(user: User, dashboardId: string, itemId: string | number): void {
    this.assertWrite(user, dashboardId);
    const dashboard = this.requireDashboard(dashboardId);
    dashboard.items = dashboard.items.filter((item) => String(item.id) !== String(itemId));
  }

  private requireDashboard(id: string): TestDashboard {
    const dashboard = this.dashboards.get(id);
    if (!dashboard) throw new Error("DASHBOARD_NOT_FOUND");
    return dashboard;
  }

  private assertWrite(user: User, dashboardId: string): void {
    const dashboard = this.requireDashboard(dashboardId);
    if (isPlatformAdmin(user)) throw new Error("BUSINESS_WRITE_REQUIRES_TENANT_SCOPE");
    if (!canAccessDashboard(user, dashboard, "editor")) throw new Error("WRITE_DENIED");
  }
}

export const makeTestItem = (): DashboardItem => ({
  id: "TEST_KPI_CRUD",
  indicator: "TEST KPI CRUD",
  unit: "unidades",
  weight: 100,
  monthlyGoals: Array(12).fill(null),
  monthlyProgress: Array(12).fill(null),
  monthlyProgressCaptured: Array(12).fill(false),
  monthlyNotes: Array(12).fill(""),
  weeklyGoals: [],
  weeklyProgress: [],
  observations: Array(12).fill(""),
  isActivityMode: true,
  activityConfig: { activities: [{ id: "a1", name: "Actividad inicial" }] },
  type: "average",
  goalType: "maximize",
} as DashboardItem);
