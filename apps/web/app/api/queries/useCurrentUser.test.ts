import { QueryClient } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";

import { useAuthStore } from "~/modules/Auth/authStore";
import { server } from "~/utils/mocks/node";

import { currentUserQueryOptions } from "./useCurrentUser";

const arrangeCurrentUserResponse = (status: number, message: string) => {
  const logoutRequests = { count: 0 };

  server.use(
    http.get("*/api/auth/current-user", () => HttpResponse.json({ message }, { status })),
    http.post("*/api/auth/logout", () => {
      logoutRequests.count += 1;

      return HttpResponse.json(null);
    }),
  );

  return logoutRequests;
};

const fetchCurrentUser = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false } } }).fetchQuery(
    currentUserQueryOptions,
  );

describe("currentUserQueryOptions", () => {
  beforeEach(() => {
    useAuthStore.setState({ isLoggedIn: false });
  });

  it("logs out when the session's user no longer exists", async () => {
    const logoutRequests = arrangeCurrentUserResponse(404, "adminUserView.error.userNotFound");
    useAuthStore.setState({ isLoggedIn: true });

    const currentUser = await fetchCurrentUser();

    expect(currentUser).toBeNull();
    expect(logoutRequests.count).toBe(1);
    expect(useAuthStore.getState().isLoggedIn).toBe(false);
  });

  it("rejects other 404 responses without logging out", async () => {
    const logoutRequests = arrangeCurrentUserResponse(404, "common.error.notFound");

    await expect(fetchCurrentUser()).rejects.toMatchObject({ response: { status: 404 } });
    expect(logoutRequests.count).toBe(0);
  });
});
