import { renderHook } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";

import { useNavigationHistoryStore } from "~/lib/stores/navigationHistory";
import { useCurrentUserStore } from "~/modules/common/store/useCurrentUserStore";

import { useNavigationTracker } from "./useNavigationTracker";

import type { CurrentUserResponse } from "~/api/generated-api";

describe("useNavigationTracker", () => {
  beforeEach(() => {
    sessionStorage.clear();
    useNavigationHistoryStore.getState().clearHistory();
    useCurrentUserStore.getState().setCurrentUser(undefined);
    useCurrentUserStore.getState().setHasVerifiedMFA(false);
  });

  it("preserves the requested course when the OAuth callback lands on the home page", () => {
    useNavigationHistoryStore.getState().addLastUnauthorizedEntry({
      pathname: "/course/example?tab=overview",
      timestamp: Date.now(),
    });

    renderHook(() => useNavigationTracker(), {
      wrapper: ({ children }) => <MemoryRouter initialEntries={["/"]}>{children}</MemoryRouter>,
    });

    expect(useNavigationHistoryStore.getState().navigationHistory[0]?.pathname).toBe(
      "/course/example?tab=overview",
    );
  });

  it("still records a new protected destination while logged out", () => {
    renderHook(() => useNavigationTracker(), {
      wrapper: ({ children }) => (
        <MemoryRouter initialEntries={["/course/example?tab=overview"]}>{children}</MemoryRouter>
      ),
    });

    expect(useNavigationHistoryStore.getState().navigationHistory[0]?.pathname).toBe(
      "/course/example?tab=overview",
    );
  });

  it.each(["/", "/dashboard", "/settings?tab=profile"])(
    "clears matching history after authentication at %s",
    (pathname) => {
      useCurrentUserStore.getState().setCurrentUser({
        shouldVerifyMFA: false,
        requiresPasswordChange: false,
      } as CurrentUserResponse["data"]);
      useNavigationHistoryStore
        .getState()
        .addLastUnauthorizedEntry({ pathname, timestamp: Date.now() });
      renderHook(() => useNavigationTracker(), {
        wrapper: ({ children }) => (
          <MemoryRouter initialEntries={[pathname]}>{children}</MemoryRouter>
        ),
      });
      expect(useNavigationHistoryStore.getState().navigationHistory).toEqual([]);
    },
  );

  it.each([
    { shouldVerifyMFA: true, requiresPasswordChange: false },
    { shouldVerifyMFA: false, requiresPasswordChange: true },
  ])("preserves matching history until authentication requirements complete", (user) => {
    useCurrentUserStore.getState().setCurrentUser(user as CurrentUserResponse["data"]);
    useNavigationHistoryStore
      .getState()
      .addLastUnauthorizedEntry({ pathname: "/", timestamp: Date.now() });
    renderHook(() => useNavigationTracker(), {
      wrapper: ({ children }) => <MemoryRouter initialEntries={["/"]}>{children}</MemoryRouter>,
    });
    expect(useNavigationHistoryStore.getState().navigationHistory[0]?.pathname).toBe("/");
  });
});
