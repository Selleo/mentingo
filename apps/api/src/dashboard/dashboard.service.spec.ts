import { PERMISSIONS, SYSTEM_ROLE_PERMISSIONS, SYSTEM_ROLE_SLUGS } from "@repo/shared";

import { DashboardService } from "./dashboard.service";

import type { DashboardRepository } from "./dashboard.repository";
import type { CurrentUserType } from "src/common/types/current-user.type";

const currentUser = (
  roleSlugs: string[],
  permissions = SYSTEM_ROLE_PERMISSIONS[roleSlugs[0]] ?? [],
): CurrentUserType => ({
  userId: "00000000-0000-4000-8000-000000000001",
  tenantId: "00000000-0000-4000-8000-000000000002",
  email: "user@example.com",
  roleSlugs,
  permissions,
});

describe("DashboardService", () => {
  const dashboardRepository = {
    findByUserId: jest.fn(),
    replace: jest.fn(),
  } as unknown as DashboardRepository;
  const service = new DashboardService(dashboardRepository);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns the organization widgets for an administrator", () => {
    const layout = service.getDefaultLayout(currentUser([SYSTEM_ROLE_SLUGS.ADMIN]));

    expect(layout.map(({ widgetId }) => widgetId)).toEqual([
      "training-completion",
      "deadline-risks",
      "incomplete-courses",
      "event-calendar",
    ]);
  });

  it("returns the personal learning widgets for a student", () => {
    const layout = service.getDefaultLayout(currentUser([SYSTEM_ROLE_SLUGS.STUDENT]));

    expect(layout.map(({ widgetId }) => widgetId)).toEqual([
      "continue-learning",
      "required-course",
      "course-completion",
      "certificates",
      "event-calendar",
      "ai-mentor-practice",
    ]);
  });

  it("filters out widgets when a user does not have their required permissions", () => {
    const layout = service.getDefaultLayout(
      currentUser([SYSTEM_ROLE_SLUGS.STUDENT], [PERMISSIONS.COURSE_READ_ASSIGNED]),
    );

    expect(layout.map(({ widgetId }) => widgetId)).toEqual([
      "continue-learning",
      "required-course",
    ]);
  });

  it("merges layouts for a user with multiple roles without duplicate widgets", () => {
    const permissions = [
      ...new Set([
        ...SYSTEM_ROLE_PERMISSIONS[SYSTEM_ROLE_SLUGS.STUDENT],
        ...SYSTEM_ROLE_PERMISSIONS[SYSTEM_ROLE_SLUGS.TRAINER],
      ]),
    ];
    const layout = service.getDefaultLayout(
      currentUser([SYSTEM_ROLE_SLUGS.STUDENT, SYSTEM_ROLE_SLUGS.TRAINER], permissions),
    );

    expect(layout.filter(({ widgetId }) => widgetId === "event-calendar")).toHaveLength(1);
  });

  it("returns an empty layout for a custom role without a system default", () => {
    expect(service.getDefaultLayout(currentUser(["custom-role"], []))).toEqual([]);
  });

  it("uses the default layout when the user has no saved layout", async () => {
    jest.mocked(dashboardRepository.findByUserId).mockResolvedValue(null);
    const user = currentUser([SYSTEM_ROLE_SLUGS.STUDENT]);

    const layout = await service.getLayout(user);

    expect(layout[0].widgetId).toBe("continue-learning");
    expect(dashboardRepository.findByUserId).toHaveBeenCalledWith(user.userId, user.tenantId);
  });

  it("rejects duplicate widgets before saving", async () => {
    const user = currentUser([SYSTEM_ROLE_SLUGS.STUDENT]);
    const [widget] = service.getDefaultLayout(user);

    await expect(service.replaceLayout(user, [widget, widget])).rejects.toThrow(
      "dashboardView.errors.duplicateWidgets",
    );
    expect(dashboardRepository.replace).not.toHaveBeenCalled();
  });
});
