import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import HomeDashboardPage from "./HomeDashboard.page";

const {
  availableWidgets,
  defaultDashboardLayout,
  fetchDefaultDashboardLayout,
  updateDashboardLayout,
  userSettings,
} = vi.hoisted(() => ({
  availableWidgets: ["a_placeholder_1", "a_placeholder_2", "a_placeholder_3"] as const,
  defaultDashboardLayout: [
    {
      id: "a_placeholder_1" as const,
      order: 1,
      width: 1 as const,
    },
    {
      id: "a_placeholder_2" as const,
      order: 2,
      width: 2 as const,
    },
    {
      id: "a_placeholder_3" as const,
      order: 3,
      width: 1 as const,
    },
  ],
  fetchDefaultDashboardLayout: vi.fn(),
  updateDashboardLayout: vi.fn().mockResolvedValue(undefined),
  userSettings: {
    language: "en",
    isMFAEnabled: false,
    MFASecret: null,
    dashboard: {
      widgets: [
        {
          id: "a_placeholder_1" as const,
          order: 1,
          width: 1 as const,
        },
        {
          id: "a_placeholder_2" as const,
          order: 2,
          width: 2 as const,
        },
      ],
    },
  },
}));

fetchDefaultDashboardLayout.mockResolvedValue({ data: defaultDashboardLayout });

vi.mock("~/api/queries/useUserSettings", () => ({
  useUserSettings: () => ({
    data: userSettings,
    isLoading: false,
    isError: false,
  }),
}));

vi.mock("~/api/queries/useDashboardAvailableWidgets", () => ({
  useDashboardAvailableWidgets: () => ({
    data: availableWidgets,
    isLoading: false,
    isError: false,
  }),
}));

vi.mock("~/api/mutations/useUpdateDashboardLayout", () => ({
  useUpdateDashboardWidgets: () => ({
    mutateAsync: updateDashboardLayout,
    isPending: false,
  }),
}));

vi.mock("~/api/queries/useDashboardDefaultWidgets", () => ({
  useDashboardDefaultWidgets: () => ({
    refetch: fetchDefaultDashboardLayout,
    isFetching: false,
  }),
}));

describe("HomeDashboardPage", () => {
  it("renders only widgets saved in user settings", () => {
    renderWith().render(<HomeDashboardPage />);

    expect(screen.getByRole("heading", { name: "Your dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Admin widget 1" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Admin widget 2" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Admin widget 3" })).not.toBeInTheDocument();
  });

  it("enters edit mode and allows changing an allowed widget width", async () => {
    const user = userEvent.setup();
    renderWith().render(<HomeDashboardPage />);

    await user.click(screen.getByRole("button", { name: "Customize dashboard" }));

    expect(screen.getByRole("button", { name: "Widgets" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();

    const changeWidthButton = screen.getByRole("button", {
      name: "Change width of Admin widget 2",
    });
    const widgetContainer = changeWidthButton.closest("div.md\\:col-span-2");

    expect(widgetContainer).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Move Admin widget 2" })).toBeInTheDocument();
    expect(changeWidthButton).toHaveClass("absolute", "right-3", "top-3");

    await user.click(changeWidthButton);

    expect(changeWidthButton.closest("div.md\\:col-span-1")).toBeInTheDocument();
  });

  it("opens widget selection in a dialog and leaves edit mode after saving", async () => {
    const user = userEvent.setup();
    renderWith().render(<HomeDashboardPage />);

    await user.click(screen.getByRole("button", { name: "Customize dashboard" }));
    await user.click(screen.getByRole("button", { name: "Widgets" }));

    expect(screen.getByRole("heading", { name: "Dashboard widgets" })).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "Close" })[0]);
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(updateDashboardLayout).toHaveBeenCalledWith({
      dashboard: {
        widgets: [
          { id: "a_placeholder_1", order: 1, width: 1 },
          { id: "a_placeholder_2", order: 2, width: 2 },
        ],
      },
    });
    expect(screen.getByRole("button", { name: "Customize dashboard" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Widgets" })).not.toBeInTheDocument();
  });

  it("lists every available widget and adds a selected widget to the draft layout", async () => {
    const user = userEvent.setup();
    renderWith().render(<HomeDashboardPage />);

    await user.click(screen.getByRole("button", { name: "Customize dashboard" }));
    await user.click(screen.getByRole("button", { name: "Widgets" }));

    expect(screen.getByRole("switch", { name: "Toggle Admin widget 3" })).not.toBeChecked();

    await user.click(screen.getByRole("switch", { name: "Toggle Admin widget 3" }));
    await user.click(screen.getAllByRole("button", { name: "Close" })[0]);

    expect(screen.getByRole("heading", { name: "Admin widget 3" })).toBeInTheDocument();
  });

  it("restores the default layout returned by the API", async () => {
    const user = userEvent.setup();
    renderWith().render(<HomeDashboardPage />);

    expect(fetchDefaultDashboardLayout).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Customize dashboard" }));
    await user.click(screen.getByRole("button", { name: "Widgets" }));
    await user.click(screen.getByRole("button", { name: "Restore default" }));
    await user.click(screen.getAllByRole("button", { name: "Close" })[0]);

    expect(fetchDefaultDashboardLayout).toHaveBeenCalledOnce();
    expect(screen.getByRole("heading", { name: "Admin widget 3" })).toBeInTheDocument();
  });
});
