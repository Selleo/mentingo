import { createRemixStub } from "@remix-run/testing";
import { screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AutomationPage from "~/modules/Admin/Automation/Automation.page";
import { mockRemixReact } from "~/utils/mocks/remix-run-mock";
import { renderWith } from "~/utils/testUtils";

mockRemixReact();

const mockMutate = vi.fn();
const mockCreateMutate = vi.fn();
const mockDeleteMutate = vi.fn();

vi.mock("~/api/mutations/admin/useSeedDefaultAutomations", () => ({
  useSeedDefaultAutomations: () => ({
    mutate: mockMutate,
    isPending: false,
  }),
}));

vi.mock("~/api/mutations/admin/useCreateAutomation", () => ({
  useCreateAutomation: () => ({
    mutate: mockCreateMutate,
    isPending: false,
  }),
}));

vi.mock("~/api/mutations/admin/useDeleteAutomation", () => ({
  useDeleteAutomation: () => ({
    mutate: mockDeleteMutate,
    isPending: false,
  }),
}));

vi.mock("~/api/queries/admin/useAutomations", () => ({
  useAutomations: () => ({
    data: [],
    isLoading: false,
  }),
  AUTOMATIONS_QUERY_KEY: "automations",
}));

const RemixStub = createRemixStub([
  {
    path: "/",
    Component: AutomationPage,
  },
]);

describe("AutomationPage - Seed Defaults", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the seed defaults button next to the logs button", () => {
    renderWith({ withQuery: true }).render(<RemixStub />);

    const seedButton = screen.getByTestId("automation-page-seed-defaults-button");
    const logsButton = screen.getByTestId("automation-page-open-logs-button");

    expect(seedButton).toBeDefined();
    expect(logsButton).toBeDefined();

    // Both buttons should be in the same container
    expect(seedButton.parentElement).toBe(logsButton.parentElement);
  });

  it("shows confirmation dialog when seed defaults button is clicked", async () => {
    const user = userEvent.setup();
    renderWith({ withQuery: true }).render(<RemixStub />);

    const seedButton = screen.getByTestId("automation-page-seed-defaults-button");
    await user.click(seedButton);

    await waitFor(() => {
      expect(screen.getByTestId("automation-page-seed-defaults-dialog")).toBeDefined();
    });

    // Dialog should contain a warning message
    expect(screen.getByText(/Warning/i)).toBeDefined();
  });

  it("calls mutate when confirmation is accepted", async () => {
    const user = userEvent.setup();
    renderWith({ withQuery: true }).render(<RemixStub />);

    const seedButton = screen.getByTestId("automation-page-seed-defaults-button");
    await user.click(seedButton);

    await waitFor(() => {
      expect(screen.getByTestId("automation-page-seed-defaults-dialog-confirm")).toBeDefined();
    });

    const confirmButton = screen.getByTestId("automation-page-seed-defaults-dialog-confirm");
    await user.click(confirmButton);

    expect(mockMutate).toHaveBeenCalledTimes(1);
  });

  it("does not call mutate when dialog is cancelled", async () => {
    const user = userEvent.setup();
    renderWith({ withQuery: true }).render(<RemixStub />);

    const seedButton = screen.getByTestId("automation-page-seed-defaults-button");
    await user.click(seedButton);

    await waitFor(() => {
      expect(screen.getByTestId("automation-page-seed-defaults-dialog-cancel")).toBeDefined();
    });

    const cancelButton = screen.getByTestId("automation-page-seed-defaults-dialog-cancel");
    await user.click(cancelButton);

    expect(mockMutate).not.toHaveBeenCalled();
  });

  it("closes the dialog after cancel", async () => {
    const user = userEvent.setup();
    renderWith({ withQuery: true }).render(<RemixStub />);

    const seedButton = screen.getByTestId("automation-page-seed-defaults-button");
    await user.click(seedButton);

    await waitFor(() => {
      expect(screen.getByTestId("automation-page-seed-defaults-dialog-cancel")).toBeDefined();
    });

    const cancelButton = screen.getByTestId("automation-page-seed-defaults-dialog-cancel");
    await user.click(cancelButton);

    await waitFor(() => {
      expect(screen.queryByTestId("automation-page-seed-defaults-dialog")).toBeNull();
    });
  });
});
