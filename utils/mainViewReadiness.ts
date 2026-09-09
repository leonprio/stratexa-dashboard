export type MainViewReadinessInput = {
  authenticated: boolean;
  platformAuthorityResolved: boolean;
  authorizationResolved: boolean;
  effectiveClientId?: string | null;
  loadingDashboards: boolean;
  dashboardsCount: number;
};

export type MainViewReadiness = {
  clientResolved: boolean;
  authorizationResolved: boolean;
  dataLoading: boolean;
  canRenderMainView: boolean;
  clientDisplayId: string | null;
  blockingReason: string | null;
};

export function getMainViewReadiness(
  input: MainViewReadinessInput,
): MainViewReadiness {
  const clientDisplayId = input.effectiveClientId?.trim().toUpperCase() || null;
  const clientResolved = Boolean(clientDisplayId);
  const authorityResolved =
    input.authenticated && input.platformAuthorityResolved;
  const authorizationResolved = authorityResolved && input.authorizationResolved;
  const dataLoading = input.loadingDashboards;
  const canRenderMainView =
    authorizationResolved && clientResolved && !dataLoading;

  let blockingReason: string | null = null;
  if (!input.authenticated) blockingReason = "AUTHENTICATION_PENDING";
  else if (!input.platformAuthorityResolved) blockingReason = "AUTHORITY_PENDING";
  else if (!clientResolved) blockingReason = "CLIENT_PENDING";
  else if (!input.authorizationResolved) blockingReason = "AUTHORIZATION_PENDING";
  else if (dataLoading) blockingReason = "DASHBOARDS_LOADING";

  return {
    clientResolved,
    authorizationResolved,
    dataLoading,
    canRenderMainView,
    clientDisplayId,
    blockingReason,
  };
}
