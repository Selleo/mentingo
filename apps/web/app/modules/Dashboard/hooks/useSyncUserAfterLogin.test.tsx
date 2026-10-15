import { act, render, renderHook } from "@testing-library/react";
import { StrictMode } from "react";
import { beforeEach, describe, expect, it } from "vitest";

import { useAuthStore } from "~/modules/Auth/authStore";
import { useCurrentUserStore } from "~/modules/common/store/useCurrentUserStore";

import { useSyncUserAfterLogin } from "./useSyncUserAfterLogin";

import type { CurrentUserResponse } from "~/api/generated-api";

type User = CurrentUserResponse["data"];
const user = { id: "user-1", firstName: "Before", shouldVerifyMFA: true } as User;

describe("useSyncUserAfterLogin", () => {
  beforeEach(() => {
    useAuthStore.setState({ isLoggedIn: false });
    useCurrentUserStore.setState({ currentUser: undefined, hasVerifiedMFA: false });
  });

  it("bounds writes from concurrent distinct references to the same user", () => {
    const otherUser = { ...user };
    let writes = 0;
    const unsubscribe = useCurrentUserStore.subscribe((state, previous) => {
      if (state.currentUser !== previous.currentUser) {
        writes += 1;
        // Fail deterministically before React's update-depth limit.
        if (writes > 12) throw new Error("Session synchronizers keep rewriting each other");
      }
    });
    function Sync({ value }: { value: User }) {
      useSyncUserAfterLogin(value);
      return null;
    }
    try {
      render(
        <StrictMode>
          <Sync value={user} />
          <Sync value={otherUser} />
        </StrictMode>,
      );
      expect(writes).toBeLessThanOrEqual(4);
      expect(useAuthStore.getState().isLoggedIn).toBe(true);
    } finally {
      unsubscribe();
    }
  });

  it("propagates new profile and auth requirements for the same id, then clears a null session", () => {
    const { rerender } = renderHook(
      ({ value }: { value: User | null | undefined }) => useSyncUserAfterLogin(value),
      { initialProps: { value: user as User | null | undefined } },
    );
    expect(useCurrentUserStore.getState().currentUser).toBe(user);
    expect(useCurrentUserStore.getState().hasVerifiedMFA).toBe(false);
    act(() => useCurrentUserStore.getState().setHasVerifiedMFA(true));
    const updated = { ...user, firstName: "After", requiresPasswordChange: true };
    rerender({ value: updated });
    expect(useCurrentUserStore.getState().currentUser).toBe(updated);
    expect(useCurrentUserStore.getState().hasVerifiedMFA).toBe(true);
    rerender({ value: undefined });
    expect(useCurrentUserStore.getState().currentUser).toBe(updated);
    rerender({ value: null });
    expect(useCurrentUserStore.getState().currentUser).toBeUndefined();
    expect(useCurrentUserStore.getState().hasVerifiedMFA).toBe(false);
    expect(useAuthStore.getState().isLoggedIn).toBe(false);
    const noMFA = { ...updated, shouldVerifyMFA: false };
    rerender({ value: noMFA });
    expect(useCurrentUserStore.getState().currentUser).toBe(noMFA);
    expect(useCurrentUserStore.getState().hasVerifiedMFA).toBe(true);
    expect(useAuthStore.getState().isLoggedIn).toBe(true);
  });
});
