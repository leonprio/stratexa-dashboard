import { isUniversalSuperAdmin } from "./universalSuperAdmin";

describe("isUniversalSuperAdmin", () => {
  it("recognizes only the explicit universal identities", () => {
    expect(isUniversalSuperAdmin({ email: "LEON@LEONPRIOR.COM" } as any)).toBe(true);
    expect(isUniversalSuperAdmin(null, "leonprior@gmail.com")).toBe(true);
    expect(isUniversalSuperAdmin({ email: "admin@ips.com" } as any)).toBe(false);
  });
});
