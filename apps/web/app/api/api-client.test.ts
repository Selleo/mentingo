import { isAxiosError } from "axios";
import { http, HttpResponse } from "msw";

import { toast } from "~/components/ui/use-toast";
import { useAuthStore } from "~/modules/Auth/authStore";
import { server } from "~/utils/mocks/node";

import { ApiClient } from "./api-client";

vi.mock("~/components/ui/use-toast", () => ({ toast: vi.fn() }));

const MISSING_PERMISSION = "auth.error.missingPermission";

const arrangeRefreshEndpoint = (status: number) => {
  const refreshRequests = { count: 0 };

  server.use(
    http.post("*/api/auth/refresh", () => {
      refreshRequests.count += 1;

      return HttpResponse.json({}, { status });
    }),
  );

  return refreshRequests;
};

const arrangeEndpointFailingFirst = (path: string, status: number, message = "error") => {
  const endpointRequests = { count: 0 };

  server.use(
    http.get(`*${path}`, () => {
      endpointRequests.count += 1;

      if (endpointRequests.count === 1) return HttpResponse.json({ message }, { status });

      return HttpResponse.json({ data: { path } });
    }),
  );

  return endpointRequests;
};

const arrangeEndpointAlwaysFailing = (path: string, status: number, message = "error") => {
  const endpointRequests = { count: 0 };

  server.use(
    http.get(`*${path}`, () => {
      endpointRequests.count += 1;

      return HttpResponse.json({ message }, { status });
    }),
  );

  return endpointRequests;
};

const getRejectionStatus = async (request: Promise<unknown>) => {
  const error = await request.then(
    () => undefined,
    (rejection: unknown) => rejection,
  );

  return isAxiosError(error) ? error.response?.status : error;
};

describe("ApiClient token refresh", () => {
  beforeEach(() => {
    useAuthStore.setState({ isLoggedIn: true });
    vi.mocked(toast).mockReset();
  });

  it("refreshes tokens and retries the request once after a 401", async () => {
    const refreshRequests = arrangeRefreshEndpoint(200);
    const settingsRequests = arrangeEndpointFailingFirst("/api/settings", 401);

    const response = await ApiClient.api.settingsControllerGetUserSettings();

    expect(response.data).toEqual({ data: { path: "/api/settings" } });
    expect(refreshRequests.count).toBe(1);
    expect(settingsRequests.count).toBe(2);
  });

  it("shares one token refresh between parallel 401 responses", async () => {
    const refreshRequests = arrangeRefreshEndpoint(200);
    arrangeEndpointFailingFirst("/api/settings", 401);
    arrangeEndpointFailingFirst("/api/settings/company-information", 401);

    await Promise.all([
      ApiClient.api.settingsControllerGetUserSettings(),
      ApiClient.api.settingsControllerGetCompanyInformation(),
    ]);

    expect(refreshRequests.count).toBe(1);
  });

  it("logs out and rejects parallel requests with their 401 when the refresh fails", async () => {
    const refreshRequests = arrangeRefreshEndpoint(401);
    arrangeEndpointAlwaysFailing("/api/settings", 401);
    arrangeEndpointAlwaysFailing("/api/settings/company-information", 401);

    const statuses = await Promise.all([
      getRejectionStatus(ApiClient.api.settingsControllerGetUserSettings()),
      getRejectionStatus(ApiClient.api.settingsControllerGetCompanyInformation()),
    ]);

    expect(statuses).toEqual([401, 401]);
    expect(refreshRequests.count).toBe(1);
    expect(useAuthStore.getState().isLoggedIn).toBe(false);
  });

  it("refreshes tokens and retries after a missing permission 403", async () => {
    const refreshRequests = arrangeRefreshEndpoint(200);
    const settingsRequests = arrangeEndpointFailingFirst("/api/settings", 403, MISSING_PERMISSION);

    await ApiClient.api.settingsControllerGetUserSettings();

    expect(refreshRequests.count).toBe(1);
    expect(settingsRequests.count).toBe(2);
    expect(toast).not.toHaveBeenCalled();
  });

  it("shows the missing permission toast when the retried request is still forbidden", async () => {
    const refreshRequests = arrangeRefreshEndpoint(200);
    const settingsRequests = arrangeEndpointAlwaysFailing("/api/settings", 403, MISSING_PERMISSION);

    const status = await getRejectionStatus(ApiClient.api.settingsControllerGetUserSettings());

    expect(status).toBe(403);
    expect(refreshRequests.count).toBe(1);
    expect(settingsRequests.count).toBe(2);
    expect(toast).toHaveBeenCalledTimes(1);
  });

  it("does not refresh tokens for a 403 caused by something other than a missing permission", async () => {
    const refreshRequests = arrangeRefreshEndpoint(200);
    const settingsRequests = arrangeEndpointAlwaysFailing("/api/settings", 403);

    const status = await getRejectionStatus(ApiClient.api.settingsControllerGetUserSettings());

    expect(status).toBe(403);
    expect(refreshRequests.count).toBe(0);
    expect(settingsRequests.count).toBe(1);
  });

  it("does not refresh tokens for an anonymous session", async () => {
    useAuthStore.setState({ isLoggedIn: false });
    const refreshRequests = arrangeRefreshEndpoint(200);
    arrangeEndpointAlwaysFailing("/api/settings", 401);

    const status = await getRejectionStatus(ApiClient.api.settingsControllerGetUserSettings());

    expect(status).toBe(401);
    expect(refreshRequests.count).toBe(0);
  });
});
