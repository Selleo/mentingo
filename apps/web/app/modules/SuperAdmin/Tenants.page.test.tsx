import { createRemixStub } from "@remix-run/testing";
import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { TENANTS_PAGE_HANDLES } from "../../../e2e/data/tenants/handles";

import TenantsPage from "./Tenants.page";

const useTenantsSuspenseMock = vi.hoisted(() => vi.fn());
const deleteTenantMock = vi.hoisted(() => vi.fn());

vi.mock("~/api/queries/super-admin/useTenants", () => ({
  useTenantsSuspense: useTenantsSuspenseMock,
}));

vi.mock("~/api/mutations/super-admin/useCreateSupportSession", () => ({
  useCreateSupportSession: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

vi.mock("~/api/mutations/super-admin/useDeleteTenant", () => ({
  useDeleteTenant: () => ({
    mutateAsync: deleteTenantMock,
    isPending: false,
  }),
}));

vi.mock("~/modules/SuperAdmin/SupportModePopover", () => ({
  SupportModePopover: () => null,
}));

const RemixStub = createRemixStub([{ path: "/super-admin/tenants", Component: TenantsPage }]);

describe("TenantsPage", () => {
  beforeEach(() => {
    useTenantsSuspenseMock.mockReset();
    deleteTenantMock.mockReset();
    deleteTenantMock.mockResolvedValue(undefined);
    useTenantsSuspenseMock.mockReturnValue({
      data: {
        data: [
          {
            id: "82671a3a-cc19-4e3d-99a4-50ef9105b6d7",
            name: "Acme Learning",
            host: "https://academy-for-europe.acme.example.com",
            status: "active",
            isManaging: true,
            isCurrentTenant: true,
            createdAt: "2026-01-01T10:00:00.000Z",
            updatedAt: "2026-01-01T10:00:00.000Z",
            lastActivity: {
              occurredAt: "2026-01-15T12:30:00.000Z",
              actorEmail: "admin@acme.example.com",
            },
            recentActivities: [
              {
                id: "e9814b26-4963-41fc-9857-f9fd71304086",
                occurredAt: "2026-01-15T12:30:00.000Z",
                actorEmail: "admin@acme.example.com",
                actionType: "update",
              },
              {
                id: "5f36b440-963a-49ed-8886-030a707f676e",
                occurredAt: "2026-01-14T09:00:00.000Z",
                actorEmail: "editor@acme.example.com",
                actionType: "create",
              },
            ],
            activityCountLast14Days: 7,
            activityTrendPercentage: 25,
            activeUsersLast14Days: 7,
            totalUsers: 42,
          },
          {
            id: "a1074983-339a-4fca-b963-39ff6e2e78ae",
            name: "Globex Learning",
            host: "https://globex.example.com",
            status: "active",
            isManaging: false,
            isCurrentTenant: false,
            createdAt: "2026-01-02T10:00:00.000Z",
            updatedAt: "2026-01-02T10:00:00.000Z",
            lastActivity: null,
            recentActivities: [],
            activityCountLast14Days: 0,
            activityTrendPercentage: null,
            activeUsersLast14Days: 0,
            totalUsers: 4,
          },
          {
            id: "21da9560-887d-4e3f-898d-120193f22683",
            name: "Initech Learning",
            host: "https://initech.example.com",
            status: "inactive",
            isManaging: false,
            isCurrentTenant: false,
            createdAt: "2026-01-03T10:00:00.000Z",
            updatedAt: "2026-01-03T10:00:00.000Z",
            lastActivity: null,
            recentActivities: [],
            activityCountLast14Days: 4,
            activityTrendPercentage: 0,
            activeUsersLast14Days: 2,
            totalUsers: 8,
          },
        ],
        pagination: { totalItems: 3, page: 1, perPage: 10 },
      },
    });
  });

  it("shows the latest actor snapshot, activity preview, and recent activity count", async () => {
    const user = userEvent.setup();
    const tenantId = "82671a3a-cc19-4e3d-99a4-50ef9105b6d7";

    renderWith().render(<RemixStub initialEntries={["/super-admin/tenants"]} />);

    expect(await screen.findByText("admin@acme.example.com")).toBeVisible();
    expect(screen.getByText("7")).toBeVisible();
    expect(screen.getByLabelText("Activity increased by 25%")).toBeVisible();
    expect(screen.getByText("7 / 42 users")).toBeVisible();
    expect(screen.getByText("No activity")).toBeVisible();
    expect(screen.queryByText("→ 0%")).toBeNull();

    await user.hover(screen.getByTestId(TENANTS_PAGE_HANDLES.lastActivity(tenantId)));

    const activityPreview = await screen.findByTestId(
      TENANTS_PAGE_HANDLES.recentActivitiesPreview(tenantId),
    );
    expect(within(activityPreview).getAllByText("Recent activities")[0]).toBeVisible();
    expect(within(activityPreview).getAllByText("Updated")[0]).toBeVisible();
    expect(within(activityPreview).getAllByText("Created")[0]).toBeVisible();
  });

  it("shows hosts without protocols and reveals a truncated host on hover", async () => {
    const user = userEvent.setup();

    renderWith().render(<RemixStub initialEntries={["/super-admin/tenants"]} />);

    const fullHost = "academy-for-europe.acme.example.com";
    const hostPreview = await screen.findByText(fullHost);

    expect(hostPreview).toHaveClass("max-w-[25ch]", "truncate");
    expect(screen.queryByText(`https://${fullHost}`)).toBeNull();

    await user.hover(hostPreview);

    expect(within(await screen.findByRole("tooltip")).getByText(fullHost)).toBeVisible();
  });

  it("requests newest activity first when the latest-activity header is selected", async () => {
    const user = userEvent.setup();

    renderWith().render(<RemixStub initialEntries={["/super-admin/tenants"]} />);

    await user.click(await screen.findByTestId(TENANTS_PAGE_HANDLES.SORT_LAST_ACTIVITY));

    await waitFor(() => {
      expect(useTenantsSuspenseMock).toHaveBeenLastCalledWith({
        page: 1,
        perPage: 10,
        search: "",
        status: "active",
        sort: "-lastActivity",
      });
    });
  });

  it("requests tenants with the selected organization status", async () => {
    const user = userEvent.setup();

    renderWith().render(<RemixStub initialEntries={["/super-admin/tenants"]} />);

    const statusFilter = await screen.findByTestId(TENANTS_PAGE_HANDLES.STATUS_FILTER);
    expect(within(statusFilter).getByText("Active")).toBeVisible();

    await user.click(statusFilter);
    await user.click(screen.getByTestId(TENANTS_PAGE_HANDLES.statusFilterOption("inactive")));

    await waitFor(() => {
      expect(useTenantsSuspenseMock).toHaveBeenLastCalledWith({
        page: 1,
        perPage: 10,
        search: "",
        status: "inactive",
        sort: undefined,
      });
    });
  });

  it("requires confirmation before hard deleting a non-current tenant", async () => {
    const user = userEvent.setup();
    const currentTenantId = "82671a3a-cc19-4e3d-99a4-50ef9105b6d7";
    const tenantId = "a1074983-339a-4fca-b963-39ff6e2e78ae";

    renderWith().render(<RemixStub initialEntries={["/super-admin/tenants"]} />);

    await user.click(
      await screen.findByTestId(TENANTS_PAGE_HANDLES.actionsMenuButton(currentTenantId)),
    );
    expect(screen.queryByTestId(TENANTS_PAGE_HANDLES.deleteButton(currentTenantId))).toBeNull();
    await user.keyboard("{Escape}");

    await user.click(screen.getByTestId(TENANTS_PAGE_HANDLES.actionsMenuButton(tenantId)));
    await user.click(await screen.findByTestId(TENANTS_PAGE_HANDLES.deleteButton(tenantId)));

    expect(screen.getByTestId(TENANTS_PAGE_HANDLES.DELETE_DIALOG)).toBeVisible();
    expect(screen.getByText("Delete Globex Learning?")).toBeVisible();

    await user.click(screen.getByTestId(TENANTS_PAGE_HANDLES.DELETE_DIALOG_CONFIRM_BUTTON));

    await waitFor(() => expect(deleteTenantMock).toHaveBeenCalledWith({ id: tenantId }));
    await waitFor(() =>
      expect(screen.queryByTestId(TENANTS_PAGE_HANDLES.DELETE_DIALOG)).toBeNull(),
    );
  });
});
