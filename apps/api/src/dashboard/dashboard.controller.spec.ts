import { DashboardController } from "./dashboard.controller";

import type { DashboardService } from "./dashboard.service";
import type { DashboardLayoutWidget } from "./dashboard.types";
import type { CurrentUserType } from "src/common/types/current-user.type";

describe("DashboardController", () => {
  const widgets: DashboardLayoutWidget[] = [
    {
      widgetId: "continue-learning",
      order: 1,
      enabled: true,
      size: "large",
      settings: {},
    },
  ];
  const currentUser = {
    userId: "00000000-0000-4000-8000-000000000001",
    tenantId: "00000000-0000-4000-8000-000000000002",
    email: "student@example.com",
    roleSlugs: ["student"],
    permissions: [],
  } satisfies CurrentUserType;
  const dashboardService = {
    getLayout: jest.fn(),
    replaceLayout: jest.fn(),
  } as unknown as DashboardService;
  const controller = new DashboardController(dashboardService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns the current user's layout", async () => {
    jest.mocked(dashboardService.getLayout).mockResolvedValue(widgets);

    await expect(controller.getLayout(currentUser)).resolves.toEqual({ data: widgets });
    expect(dashboardService.getLayout).toHaveBeenCalledWith(currentUser);
  });

  it("replaces the current user's layout", async () => {
    jest.mocked(dashboardService.replaceLayout).mockResolvedValue(widgets);

    await expect(controller.replaceLayout({ widgets }, currentUser)).resolves.toEqual({
      data: widgets,
    });
    expect(dashboardService.replaceLayout).toHaveBeenCalledWith(currentUser, widgets);
  });
});
