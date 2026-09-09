import { findLastIndexWithData } from "../utils/compliance";
import { canAccessDashboard } from "../services/tableroAuthorization";
import { InMemoryKpiBackend, TEST_DASHBOARD, TEST_TENANT, makeTestItem } from "./inMemoryKpiBackend";

const editor = (editable = [TEST_DASHBOARD]) => ({
  id: "TEST_EDITOR", email: "editor@test.invalid", name: "Test Editor",
  globalRole: "Director", clientId: TEST_TENANT,
  memberships: [{ clientId: TEST_TENANT, role: "director", status: "active", hierarchyScopes: [], dashboardScopes: { [TEST_DASHBOARD]: "editor" }, editableDashboardIds: editable, capabilities: ["editor"] }],
} as any);
const reader = { ...editor(), id: "TEST_READER", memberships: [{ ...editor().memberships[0], dashboardScopes: { [TEST_DASHBOARD]: "viewer" }, editableDashboardIds: [] }] } as any;
const otherTenant = { ...editor(), id: "TEST_OTHER", clientId: "TEST_OTHER_TENANT", memberships: [{ ...editor().memberships[0], clientId: "TEST_OTHER_TENANT" }] } as any;

describe("isolated KPI CRUD and capture contract", () => {
  it("persists create/read/update/delete across fresh reconstruction", () => {
    let backend = new InMemoryKpiBackend(); backend.seed();
    const item = makeTestItem();
    backend.createKpi(editor(), item);
    expect(backend.readKpi(TEST_DASHBOARD, item.id)).toMatchObject({ indicator: "TEST KPI CRUD", isActivityMode: true });
    backend = backend.reconstruct();
    const changed = { ...item, indicator: "TEST KPI UPDATED", unit: "%", isActivityMode: false, monthlyGoals: [...item.monthlyGoals.slice(0, 8), 5, ...item.monthlyGoals.slice(9)] } as any;
    backend.updateKpi(editor(), TEST_DASHBOARD, changed);
    backend = backend.reconstruct();
    expect(backend.readKpi(TEST_DASHBOARD, item.id)).toMatchObject({ indicator: "TEST KPI UPDATED", unit: "%", isActivityMode: false });
    backend.deleteKpi(editor(), TEST_DASHBOARD, item.id);
    expect(backend.reconstruct().readKpi(TEST_DASHBOARD, item.id)).toBeNull();
  });

  it("keeps activities, null, and explicit zero distinct after reload", () => {
    const backend = new InMemoryKpiBackend(); backend.seed(); const item = makeTestItem(); backend.createKpi(editor(), item);
    const updated = { ...item, monthlyProgress: [10, 0, ...Array(10).fill(null)], monthlyProgressCaptured: [true, true, ...Array(10).fill(false)], monthlyNotes: ["TEST OBSERVACIÓN", ...Array(11).fill("")] } as any;
    backend.updateKpi(editor(), TEST_DASHBOARD, updated);
    const read = backend.reconstruct().readKpi(TEST_DASHBOARD, item.id)!;
    expect(read.monthlyProgress[1]).toBe(0); expect(read.monthlyProgress[2]).toBeNull();
    expect(read.monthlyNotes[0]).toBe("TEST OBSERVACIÓN"); expect(read.activityConfig.activities).toHaveLength(1);
    expect(findLastIndexWithData([10, 0, null, null], [], [true, true, false, false])).toBe(1);
    expect(findLastIndexWithData([10, 20, null, null], [])).toBe(1);
  });

  it("distinguishes legacy zero from explicit zero", () => {
    const backend = new InMemoryKpiBackend(); backend.seed(); const item = makeTestItem();
    const legacy = { ...item, monthlyProgress: [20, 30, 0, 0], monthlyProgressCaptured: undefined } as any;
    backend.createKpi(editor(), legacy);
    expect(backend.reconstruct().readKpi(TEST_DASHBOARD, item.id)?.monthlyProgressCaptured).toBeUndefined();
    const explicit = { ...legacy, monthlyProgressCaptured: [true, true, true, false] } as any;
    backend.updateKpi(editor(), TEST_DASHBOARD, explicit);
    expect(backend.reconstruct().readKpi(TEST_DASHBOARD, item.id)?.monthlyProgressCaptured?.slice(0, 4)).toEqual([true, true, true, false]);
  });

  it("writes an aggregate only through its explicit physical source", () => {
    const backend = new InMemoryKpiBackend(); backend.seed(); const item = makeTestItem(); backend.createKpi(editor(), item);
    const changed = { ...item, monthlyProgress: [0, ...Array(11).fill(null)] } as any;
    backend.updateAggregateKpi(editor(), { sourceDashboardId: TEST_DASHBOARD, itemId: item.id }, changed);
    expect(backend.reconstruct().readKpi(TEST_DASHBOARD, item.id)?.monthlyProgress[0]).toBe(0);
    expect(() => backend.updateAggregateKpi(editor(), {}, changed)).toThrow("AMBIGUOUS_AGGREGATE_SOURCE");
    expect(() => backend.updateAggregateKpi(editor(), { sourceDashboardId: TEST_DASHBOARD, itemId: "OTHER" }, changed)).toThrow("AGGREGATE_ITEM_MISMATCH");
  });

  it("enforces reader, cross-tenant, and editable scope authorization", () => {
    const backend = new InMemoryKpiBackend(); backend.seed();
    expect(() => backend.createKpi(reader, makeTestItem())).toThrow("WRITE_DENIED");
    expect(() => backend.createKpi(otherTenant, makeTestItem())).toThrow("WRITE_DENIED");
    expect(Boolean(canAccessDashboard(editor([]), { id: TEST_DASHBOARD, clientId: TEST_TENANT } as any, "editor"))).toBe(false);
    expect(() => backend.createKpi({ ...editor(), email: "leon@leonprior.com", globalRole: "Admin" } as any, makeTestItem())).toThrow("BUSINESS_WRITE_REQUIRES_TENANT_SCOPE");
  });
});
