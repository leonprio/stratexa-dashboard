/** @jest-environment node */
const mockGetFirestore = jest.fn();
const mockAuth = {
  updateUser: jest.fn(),
  deleteUser: jest.fn(),
  createUser: jest.fn(),
};
jest.mock("firebase-admin/app", () => ({ initializeApp: jest.fn() }));
jest.mock("firebase-admin/firestore", () => ({
  getFirestore: () => mockGetFirestore(),
}));
jest.mock("firebase-admin/auth", () => ({ getAuth: () => mockAuth }));
jest.mock("firebase-functions/v2", () => ({ setGlobalOptions: jest.fn() }), {
  virtual: true,
});
jest.mock(
  "firebase-functions/v2/https",
  () => ({
    onCall: (fn: any) => fn,
    HttpsError: class extends Error {
      constructor(
        public code: string,
        message: string,
      ) {
        super(message);
      }
    },
  }),
  { virtual: true },
);
const endpoints = require("./index.js");
beforeEach(() => {
  jest.clearAllMocks();
  const records: Record<string, any> = {
    "tbl_users/admin": { globalRole: "Admin", clientId: "A" },
    "tbl_users/target": { globalRole: "Member", clientId: "B" },
  };
  mockGetFirestore.mockReturnValue({
    collection: (name: string) => ({
      where: () => ({ get: async () => ({ docs: [], empty: true }) }),
      doc: (id: string) => ({
        get: async () => ({
          exists: !!records[name + "/" + id],
          data: () => records[name + "/" + id],
        }),
      }),
    }),
  });
});
test.each(["updateUserPassword", "deleteUserCompletely"])(
  "%s rejects another tenant before Admin SDK mutation",
  async (name) => {
    await expect(
      endpoints[name]({
        auth: { uid: "admin", token: {} },
        data: {
          clientId: "A",
          targetUserId: "target",
          newPassword: "test-only-value",
        },
      }),
    ).rejects.toMatchObject({ code: "permission-denied" });
    expect(mockAuth.updateUser).not.toHaveBeenCalled();
    expect(mockAuth.deleteUser).not.toHaveBeenCalled();
  },
);
test("createUser requires actor authority for the requested tenant", async () => {
  await expect(
    endpoints.createUser({
      auth: { uid: "admin", token: {} },
      data: {
        clientId: "B",
        email: "fixture@example.test",
        password: "test-only-value",
      },
    }),
  ).rejects.toMatchObject({ code: "permission-denied" });
  expect(mockAuth.createUser).not.toHaveBeenCalled();
});
