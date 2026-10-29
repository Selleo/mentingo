import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useIsRegistrationEnabled } from "../useIsRegistrationEnabled";

const settings = vi.hoisted(() => ({
  globalSettings: undefined as { inviteOnlyRegistration: boolean } | undefined,
}));

vi.mock("~/api/queries/useGlobalSettings", () => ({
  useGlobalSettings: () => ({ data: settings.globalSettings }),
}));

describe("useIsRegistrationEnabled", () => {
  beforeEach(() => {
    settings.globalSettings = { inviteOnlyRegistration: false };
  });

  it("returns true when registration is open", () => {
    const { result } = renderHook(() => useIsRegistrationEnabled());

    expect(result.current).toBe(true);
  });

  it("returns false when registration is invite-only", () => {
    settings.globalSettings = { inviteOnlyRegistration: true };

    const { result } = renderHook(() => useIsRegistrationEnabled());

    expect(result.current).toBe(false);
  });

  it("returns false while settings are loading", () => {
    settings.globalSettings = undefined;

    const { result } = renderHook(() => useIsRegistrationEnabled());

    expect(result.current).toBe(false);
  });
});
