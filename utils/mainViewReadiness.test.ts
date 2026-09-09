import { getMainViewReadiness } from "./mainViewReadiness";

const base = {
  authenticated: true,
  platformAuthorityResolved: true,
  authorizationResolved: true,
  effectiveClientId: "IPS",
  loadingDashboards: false,
  dashboardsCount: 29,
};

describe("getMainViewReadiness", () => {
  it("renders loaded SuperAdmin context without the secondary catalog", () => {
    expect(getMainViewReadiness(base)).toMatchObject({
      canRenderMainView: true,
      clientDisplayId: "IPS",
      blockingReason: null,
    });
  });

  it("renders the authorized empty state after loading completes", () => {
    expect(getMainViewReadiness({ ...base, dashboardsCount: 0 })).toMatchObject({
      canRenderMainView: true,
      dataLoading: false,
    });
  });

  it("keeps the spinner contract only while data is loading", () => {
    expect(getMainViewReadiness({ ...base, loadingDashboards: true })).toMatchObject({
      canRenderMainView: false,
      blockingReason: "DASHBOARDS_LOADING",
    });
  });

  it("does not turn an unauthorized tenant into a renderable context", () => {
    expect(getMainViewReadiness({ ...base, authorizationResolved: false })).toMatchObject({
      canRenderMainView: false,
      blockingReason: "AUTHORIZATION_PENDING",
    });
  });
});
