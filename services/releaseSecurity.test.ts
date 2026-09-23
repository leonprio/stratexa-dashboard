/** @jest-environment node */
import * as fs from "fs";
import * as path from "path";
import { strategyService } from "./strategyService";
import { firebaseService } from "./firebaseService";
import { readTableroScope } from "./tableroReadScope";
import { deleteDoc, getDoc, getDocs, setDoc, updateDoc } from "firebase/firestore";
jest.mock("../firebase", () => ({
  db: {},
  auth: { currentUser: { uid: "u" } },
}));
jest.mock("./tableroReadScope", () => ({
  readTableroScope: jest.fn(),
  requestedTenants: (scope: any, tenant: string) => {
    if (!scope.tenants.includes(tenant)) throw new Error("tenant");
    return [tenant];
  },
  dashboardQueryConstraints: () => [],
}));
jest.mock("firebase/firestore", () => ({
  collection: (_db: any, ...p: string[]) => ({ path: p.join("/") }),
  where: (field: string, op: string, value: any) => ({ field, op, value }),
  query: (ref: any, ...constraints: any[]) => ({ ...ref, constraints }),
  doc: (_db: any, ...p: string[]) => ({ path: p.join("/") }),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  getDocs: jest.fn(),
}));
const scope = (capabilities: string[] = []) => ({
  platform: false,
  tenants: ["A"],
  profile: {
    id: "u",
    email: "u@example.test",
    memberships: [
      {
        clientId: "A",
        role: "standard_user",
        status: "active",
        dashboardScopes: { D: "viewer" },
        capabilities,
      },
    ],
  },
});
beforeEach(() => {
  jest.clearAllMocks();
  (readTableroScope as jest.Mock).mockResolvedValue(scope());
  (getDocs as jest.Mock).mockResolvedValue({ docs: [], empty: true });
  (getDoc as jest.Mock).mockResolvedValue({ exists: () => false });
  (setDoc as jest.Mock).mockResolvedValue(undefined);
  (updateDoc as jest.Mock).mockResolvedValue(undefined);
  (deleteDoc as jest.Mock).mockResolvedValue(undefined);
});
test("strategy denies absent capability, wrong tenant and implicit IPS before collection reads", async () => {
  for (const tenant of ["A", "B", undefined, "all"])
    await expect(
      strategyService.getStrategicObjectives(tenant),
    ).rejects.toThrow();
  expect(getDocs).not.toHaveBeenCalled();
});
test("strategy_reader query carries its explicit tenant", async () => {
  (readTableroScope as jest.Mock).mockResolvedValue(scope(["strategy_reader"]));
  await strategyService.getStrategicObjectives("A");
  expect((getDocs as jest.Mock).mock.calls[0][0].constraints).toEqual([
    { field: "clientId", op: "==", value: "A" },
  ]);
});
test("plan query requires tenant and constrains authorized resource plus indicator", async () => {
  await expect(firebaseService.getActionPlansForIndicator(1)).rejects.toThrow();
  const spy = jest
    .spyOn(firebaseService, "getDashboards")
    .mockResolvedValue([{ id: "D", clientId: "A" }] as any);
  await firebaseService.getActionPlansForIndicator(1, "A");
  expect(spy).toHaveBeenCalledWith("A");
  expect((getDocs as jest.Mock).mock.calls[0][0].constraints).toEqual([
    { field: "clientId", op: "==", value: "A" },
    { field: "dashboardId", op: "==", value: "D" },
    { field: "indicatorId", op: "==", value: 1 },
  ]);
  spy.mockRestore();
});
const actionPlan: any = {
  id: "P1", indicatorId: 1, dashboardId: "D", clientId: "A", title: "Plan ficticio",
  originYear: 2026, originPeriodType: "monthly", status: "planned", startDate: "2026-01-01",
  progress: 0, createdAt: "", updatedAt: "", activities: [],
};
test("ActionPlan service denies viewer, inaccessible tenant and blind platform admin before writes", async () => {
  const readOnly = scope();
  (readTableroScope as jest.Mock).mockResolvedValue(readOnly);
  await expect(firebaseService.createActionPlan(actionPlan)).rejects.toThrow(/plan_editor/);
  await expect(firebaseService.assertActionPlanEditScope("B", "D")).rejects.toThrow(/plan_editor/);

  (readTableroScope as jest.Mock).mockResolvedValue({
    platform: true, tenants: [], profile: { id: "platform", email: "platform@example.test", globalRole: "platform_admin", memberships: [] },
  });
  await expect(firebaseService.createActionPlan(actionPlan)).rejects.toThrow(/plan_editor/);
  expect(setDoc).not.toHaveBeenCalled();
  expect(updateDoc).not.toHaveBeenCalled();
  expect(deleteDoc).not.toHaveBeenCalled();
});
test("ActionPlan service permits an explicit plan_editor scoped to the editable board", async () => {
  (readTableroScope as jest.Mock).mockResolvedValue({
    platform: false, tenants: ["A"], profile: {
      id: "u", email: "u@example.test", memberships: [{
        clientId: "A", role: "standard_user", status: "active", dashboardScopes: { D: "viewer" },
        editableDashboardIds: ["D"], capabilities: ["plan_editor"],
      }],
    },
  });
  const created = await firebaseService.createActionPlan(actionPlan);
  expect(setDoc).toHaveBeenCalledTimes(1);
  expect(created.title).toBe("Plan ficticio");

  (getDoc as jest.Mock).mockResolvedValue({ exists: () => true, data: () => actionPlan });
  expect(await firebaseService.updateActionPlan("P1", { title: "Actualizado" })).toBe(true);
  expect(await firebaseService.deleteActionPlan("A", "P1")).toBe(true);
  expect(updateDoc).toHaveBeenCalledTimes(1);
  expect(deleteDoc).toHaveBeenCalledTimes(1);
});
test("ActionPlan update/delete service denies readers of an existing scoped plan", async () => {
  (getDoc as jest.Mock).mockResolvedValue({ exists: () => true, data: () => actionPlan });
  (readTableroScope as jest.Mock).mockResolvedValue(scope());
  await expect(firebaseService.updateActionPlan("P1", { title: "No autorizado" })).rejects.toThrow(/plan_editor/);
  await expect(firebaseService.deleteActionPlan("A", "P1")).rejects.toThrow(/plan_editor/);
  expect(updateDoc).not.toHaveBeenCalled();
  expect(deleteDoc).not.toHaveBeenCalled();
});
test("live workflow is main-only, keyless, reproducible and hosting-target limited", () => {
  const yaml = fs.readFileSync(
    path.resolve(__dirname, "../.github/workflows/firebase-hosting-merge.yml"),
    "utf8",
  );
  for (const value of [
    "- main",
    "id-token: write",
    "npm ci",
    "google-github-actions/auth@v3",
    "--only hosting:tablero --project prior-01",
  ])
    expect(yaml).toContain(value);
  expect(yaml).not.toMatch(
    /firebaseServiceAccount|action-hosting-deploy|FIREBASE_SERVICE_ACCOUNT/,
  );
});
