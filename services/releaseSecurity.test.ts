/** @jest-environment node */
import * as fs from "fs";
import * as path from "path";
import { strategyService } from "./strategyService";
import { firebaseService } from "./firebaseService";
import { readTableroScope } from "./tableroReadScope";
import { getDocs } from "firebase/firestore";
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
