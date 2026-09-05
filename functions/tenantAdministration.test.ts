/** @jest-environment node */
const { authorizeTenantAdministration } = require("./tenantAdministration.cjs");
class Denied extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
const makeDb = (records: Record<string, any>) => ({
  collection: (name: string) => ({
    doc: (id: string) => ({
      get: async () => ({
        exists: !!records[name + "/" + id],
        data: () => records[name + "/" + id],
      }),
    }),
    where: (_field: string, _op: string, uid: string) => ({
      get: async () => {
        const values = Object.entries(records)
          .filter(([k, v]) => k.startsWith(name + "/") && v.userId === uid)
          .map(([, v]) => ({ data: () => v }));
        return { docs: values, empty: !values.length };
      },
    }),
  }),
});
const base = () => ({
  "tbl_users/admin": { globalRole: "Admin", clientId: "A" },
  "tbl_users/target": { globalRole: "Member", clientId: "A" },
});
const request = {
  auth: { uid: "admin", token: { email: "admin@example.test" } },
  data: { clientId: "A" },
};
test("allows existing single-tenant admin and same-tenant target", async () =>
  expect(
    await authorizeTenantAdministration(
      makeDb(base()),
      request,
      Denied,
      "target",
    ),
  ).toBe("A"));
test.each(["B", "A,B"])(
  "rejects foreign or shared target %s",
  async (clientId) =>
    await expect(
      authorizeTenantAdministration(
        makeDb({ ...base(), "tbl_users/target": { clientId } }),
        request,
        Denied,
        "target",
      ),
    ).rejects.toThrow(),
);
test("rejects self, missing target, unauthenticated and client spoofing", async () => {
  for (const target of ["admin", "missing"])
    await expect(
      authorizeTenantAdministration(makeDb(base()), request, Denied, target),
    ).rejects.toThrow();
  await expect(
    authorizeTenantAdministration(
      makeDb(base()),
      { data: {} },
      Denied,
      "target",
    ),
  ).rejects.toThrow();
  await expect(
    authorizeTenantAdministration(
      makeDb(base()),
      { ...request, data: { clientId: "B" } },
      Denied,
      "target",
    ),
  ).rejects.toThrow();
});
test("suspended canonical record revokes legacy admin", async () =>
  await expect(
    authorizeTenantAdministration(
      makeDb({
        ...base(),
        "tbl_userMemberships/admin__A": {
          userId: "admin",
          clientId: "A",
          role: "tenant_admin",
          status: "suspended",
        },
      }),
      request,
      Denied,
      "target",
    ),
  ).rejects.toThrow());
test("other canonical target membership rejects global identity mutation", async () =>
  await expect(
    authorizeTenantAdministration(
      makeDb({
        ...base(),
        "tbl_userMemberships/target__B": { userId: "target", clientId: "B" },
      }),
      request,
      Denied,
      "target",
    ),
  ).rejects.toThrow());
test("platform email alone cannot administer business identities", async () =>
  await expect(
    authorizeTenantAdministration(
      makeDb(base()),
      {
        ...request,
        auth: { uid: "admin", token: { email: "leon@leonprior.com" } },
      },
      Denied,
      "target",
    ),
  ).rejects.toThrow());
test("explicit canonical admin grant permits only its tenant", async () => {
  const db = makeDb({
    ...base(),
    "tbl_userMemberships/admin__A": {
      userId: "admin",
      clientId: "A",
      role: "tenant_admin",
      status: "active",
    },
  });
  expect(
    await authorizeTenantAdministration(db, request, Denied, "target"),
  ).toBe("A");
  await expect(
    authorizeTenantAdministration(
      db,
      { ...request, data: { clientId: "B" } },
      Denied,
      "target",
    ),
  ).rejects.toThrow();
});
