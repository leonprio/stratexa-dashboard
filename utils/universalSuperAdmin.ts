import { User } from "../types";

/** Browser-side counterpart of the explicit Firestore super-admin allowlist. */
const UNIVERSAL_SUPER_ADMIN_EMAILS = new Set([
  "leon@leonprior.com",
  "leonprior@gmail.com",
]);

export function isUniversalSuperAdmin(
  user?: Pick<User, "email"> | null,
  authenticatedEmail?: string | null,
): boolean {
  const email = (user?.email || authenticatedEmail || "").trim().toLowerCase();
  return UNIVERSAL_SUPER_ADMIN_EMAILS.has(email);
}
