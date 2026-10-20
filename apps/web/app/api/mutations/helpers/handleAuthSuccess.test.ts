import { http, HttpResponse } from "msw";

import { currentUserQueryOptions } from "~/api/queries/useCurrentUser";
import { queryClient } from "~/api/queryClient";
import { server } from "~/utils/mocks/node";

import { handleAuthSuccess } from "./handleAuthSuccess";

import type { CurrentUserResponse } from "~/api/generated-api";

const loginUser = {
  id: "85605ccc-c752-43ad-af06-325c67a06c39",
  email: "user@example.com",
  shouldVerifyMFA: false,
} as Parameters<typeof handleAuthSuccess>[0]["user"];

const fullCurrentUser = {
  ...loginUser,
  permissions: ["dashboard.read"],
  roleSlugs: ["student"],
} as unknown as CurrentUserResponse["data"];

const arrangeCurrentUserEndpoint = (response: HttpResponse) =>
  server.use(http.get("*/api/auth/current-user", () => response));

const handleLogin = () => {
  const session = {
    setLoggedIn: vi.fn(),
    setCurrentUser: vi.fn(),
    setHasVerifiedMFA: vi.fn(),
  };

  return { session, done: handleAuthSuccess({ user: loginUser, ...session }) };
};

describe("handleAuthSuccess", () => {
  beforeEach(() => {
    queryClient.clear();
  });

  it("stores the full current user with permissions before marking the session logged in", async () => {
    arrangeCurrentUserEndpoint(HttpResponse.json({ data: fullCurrentUser }));

    const { session, done } = handleLogin();
    await done;

    expect(session.setCurrentUser).toHaveBeenCalledWith(fullCurrentUser);
    expect(session.setLoggedIn).toHaveBeenCalledWith(true);
    expect(queryClient.getQueryData(currentUserQueryOptions.queryKey)).toEqual({
      data: fullCurrentUser,
    });
  });

  it("falls back to the login payload when the current user request fails", async () => {
    arrangeCurrentUserEndpoint(HttpResponse.json({ message: "error" }, { status: 500 }));

    const { session, done } = handleLogin();
    await done;

    expect(session.setCurrentUser).toHaveBeenCalledWith(
      expect.objectContaining({ id: loginUser.id, permissions: [], roleSlugs: [] }),
    );
    expect(session.setLoggedIn).toHaveBeenCalledWith(true);
  });
});
