import { act, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { SUPPORT_MODE_HANDLES } from "../../../e2e/data/support-mode/handles";

import { SupportModeBanner } from "./SupportModeBanner";

const mocks = vi.hoisted(() => ({
  currentUser: undefined as
    | { isSupportMode: boolean; supportContext: { expiresAt: string } }
    | undefined,
  exit: vi.fn(),
}));
vi.mock("~/api/queries", () => ({ useCurrentUser: () => ({ data: mocks.currentUser }) }));
vi.mock("~/api/mutations/useExitSupportMode", () => ({
  useExitSupportMode: () => ({ mutateAsync: mocks.exit, isPending: false }),
}));

function supportUser(minutes: number) {
  return {
    isSupportMode: true,
    supportContext: { expiresAt: new Date(Date.now() + minutes * 60_000).toISOString() },
  };
}

describe("support-mode expiry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-13T12:00:00Z"));
    mocks.currentUser = undefined;
    mocks.exit.mockReset().mockResolvedValue(undefined);
  });
  afterEach(() => vi.useRealTimers());

  it("does not exit when an active support session arrives after initial render", () => {
    const view = renderWith().render(<SupportModeBanner />);
    mocks.currentUser = supportUser(10);
    view.rerender(<SupportModeBanner />);

    expect(screen.getByTestId(SUPPORT_MODE_HANDLES.BANNER)).toBeInTheDocument();
    expect(mocks.exit).not.toHaveBeenCalled();
  });

  it("does not exit when active support data is already available", () => {
    mocks.currentUser = supportUser(10);
    renderWith().render(<SupportModeBanner />);
    expect(mocks.exit).not.toHaveBeenCalled();
  });

  it("still exits when the active session expires", () => {
    mocks.currentUser = supportUser(1);
    renderWith().render(<SupportModeBanner />);
    act(() => vi.advanceTimersByTime(60_000));
    expect(mocks.exit).toHaveBeenCalledTimes(1);
  });
});
