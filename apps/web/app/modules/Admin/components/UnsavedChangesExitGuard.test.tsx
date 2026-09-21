import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

const mocks = vi.hoisted(() => ({
  blocker: {
    state: "blocked" as "blocked" | "unblocked",
    reset: vi.fn(),
    proceed: vi.fn(),
  },
  useBeforeUnload: vi.fn(),
}));

vi.mock("@remix-run/react", () => ({
  useBeforeUnload: mocks.useBeforeUnload,
  useBlocker: () => mocks.blocker,
}));

import { BLOCKER_STATES, UnsavedChangesExitGuard } from "./UnsavedChangesExitGuard";

describe("UnsavedChangesExitGuard", () => {
  const renderGuard = () =>
    renderWith().render(
      <UnsavedChangesExitGuard
        enabled
        dialogTitle="Leave this lesson editor?"
        message="You have unsaved changes."
        leaveLabel="Leave without saving"
      />,
    );

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.blocker.state = BLOCKER_STATES.BLOCKED;
  });

  it("offers a clear cancel action for a blocked navigation", async () => {
    const user = userEvent.setup();
    renderGuard();

    expect(await screen.findByRole("dialog", { name: "Leave this lesson editor?" })).toBeVisible();
    expect(screen.getByText("You have unsaved changes.")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(mocks.blocker.reset).toHaveBeenCalledOnce();
  });

  it("proceeds when the creator confirms leaving without saving", async () => {
    const user = userEvent.setup();
    renderGuard();

    await user.click(await screen.findByRole("button", { name: "Leave without saving" }));
    expect(mocks.blocker.proceed).toHaveBeenCalledOnce();
  });
});
