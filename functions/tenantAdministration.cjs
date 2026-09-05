// Auth identity operations affect the entire account: reject multi-tenant targets.
async function authorizeTenantAdministration(
  db,
  request,
  HttpsError,
  targetUserId,
) {
  const deny = () => {
    throw new HttpsError(
      "permission-denied",
      "Administración fuera del alcance autorizado.",
    );
  };
  if (!request.auth)
    throw new HttpsError("unauthenticated", "Sesión requerida.");
  const uid = request.auth.uid;
  const caller = await db.collection("tbl_users").doc(uid).get();
  if (!caller.exists) return deny();
  const profile = caller.data();
  const tenant = request.data?.clientId || profile.clientId;
  if (
    typeof tenant !== "string" ||
    !/^[a-zA-Z0-9ÁÉÍÓÚÜÑáéíóúüñ_-]{1,64}$/.test(tenant)
  )
    return deny();
  const membership = await db
    .collection("tbl_userMemberships")
    .doc(uid + "__" + tenant)
    .get();
  const platform = await db.collection("tbl_platformAdmins").doc(uid).get();
  const platformIdentity =
    platform.exists ||
    ["platform_admin", "SuperAdmin", "superadmin"].includes(
      profile.globalRole,
    ) ||
    ["leon@leonprior.com", "leonprior@gmail.com"].includes(
      (request.auth.token?.email || "").toLowerCase(),
    );
  const permitted = membership.exists
    ? membership.data().userId === uid &&
      membership.data().clientId === tenant &&
      membership.data().status === "active" &&
      membership.data().role === "tenant_admin"
    : !platformIdentity &&
      profile.globalRole === "Admin" &&
      profile.clientId === tenant;
  if (!permitted) return deny();
  if (targetUserId !== undefined) {
    if (
      typeof targetUserId !== "string" ||
      targetUserId === uid ||
      targetUserId.includes("/")
    )
      return deny();
    const target = await db.collection("tbl_users").doc(targetUserId).get();
    const targetPlatform = await db
      .collection("tbl_platformAdmins")
      .doc(targetUserId)
      .get();
    if (!target.exists || targetPlatform.exists) return deny();
    const data = target.data();
    if (
      ["platform_admin", "SuperAdmin", "superadmin"].includes(
        data.globalRole,
      ) ||
      ["leon@leonprior.com", "leonprior@gmail.com"].includes(
        (data.email || "").toLowerCase(),
      )
    )
      return deny();
    const grants = await db
      .collection("tbl_userMemberships")
      .where("userId", "==", targetUserId)
      .get();
    if (
      grants.docs.some((d) => d.data().clientId !== tenant) ||
      (data.clientId && data.clientId !== tenant)
    )
      return deny();
    if (
      grants.empty
        ? data.clientId !== tenant
        : !grants.docs.some(
            (d) =>
              d.data().clientId === tenant && d.data().userId === targetUserId,
          )
    )
      return deny();
  }
  return tenant;
}
module.exports = { authorizeTenantAdministration };
