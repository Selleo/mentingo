import { createRemixStub } from "@remix-run/testing";
import { AUTH_SESSION_STATUS } from "@repo/shared";
import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { authSessionQueryOptions } from "~/api/queries/useAuthSession";
import { currentUserQueryOptions } from "~/api/queries/useCurrentUser";
import { queryClient } from "~/api/queryClient";
import { MFAGuard } from "~/Guards/MFAGuard";
import { useAuthStore } from "~/modules/Auth/authStore";
import { LOGIN_REDIRECT_URL } from "~/modules/Auth/constants";
import { useCurrentUserStore } from "~/modules/common/store/useCurrentUserStore";
import { currentUser } from "~/utils/mocks/data/currentUser";
import { server } from "~/utils/mocks/node";

import { handleAuthSuccess } from "./handleAuthSuccess";

describe("Authentication success with mounted session observers", () => {
  beforeEach(() => {
    queryClient.clear();
    useAuthStore.getState().setLoggedIn(false);
    useCurrentUserStore.getState().setCurrentUser(undefined);
    queryClient.setQueryData(authSessionQueryOptions.queryKey, null);
    queryClient.setQueryData(currentUserQueryOptions.queryKey, null);
  });

  afterEach(() => queryClient.clear());

  it.each([
    [AUTH_SESSION_STATUS.MFA_REQUIRED, "Verify MFA", false],
    [AUTH_SESSION_STATUS.AUTHENTICATED, "Dashboard", true],
  ] as const)(
    "updates the mounted guard when login returns %s",
    async (status, destination, authenticated) => {
      let loggedIn = false;
      const currentUserRequest = vi.fn(() => HttpResponse.json(currentUser));
      server.use(
        http.get("http://localhost:3000/api/auth/session", () => {
          if (!loggedIn) return HttpResponse.json({}, { status: 401 });
          return HttpResponse.json({ data: { status, setupRequired: false } });
        }),
        http.get("http://localhost:3000/api/auth/current-user", currentUserRequest),
      );

      function Login() {
        return (
          <MFAGuard mode="auth">
            <button
              onClick={async () => {
                loggedIn = true;
                await handleAuthSuccess();
              }}
            >
              Sign in
            </button>
          </MFAGuard>
        );
      }

      const App = createRemixStub([
        { path: "/auth/login", Component: Login },
        { path: "/auth/mfa", Component: () => <div>Verify MFA</div> },
        { path: LOGIN_REDIRECT_URL, Component: () => <div>Dashboard</div> },
      ]);
      render(
        <QueryClientProvider client={queryClient}>
          <App initialEntries={["/auth/login"]} />
        </QueryClientProvider>,
      );
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));
      fireEvent.click(await screen.findByRole("button", { name: "Sign in" }));

      expect(await screen.findByText(destination)).toBeVisible();
      await waitFor(() => expect(useAuthStore.getState().isLoggedIn).toBe(authenticated));
      expect(currentUserRequest).toHaveBeenCalledTimes(authenticated ? 1 : 0);
      expect(useCurrentUserStore.getState().currentUser).toEqual(
        authenticated ? currentUser.data : undefined,
      );
    },
  );
});
