import {
  DASHBOARD_DEADLINE_RISK_GROUP_SORT_FIELDS,
  DASHBOARD_DEADLINE_RISK_SORT_DIRECTIONS,
  DASHBOARD_DEADLINE_RISK_TYPES,
  DASHBOARD_DEADLINE_RISK_URGENCY_ORDERS,
  PERMISSIONS,
  SUPPORTED_LANGUAGES,
} from "@repo/shared";

import { StatisticsService } from "./statistics.service";

import type { CurrentUserType } from "src/common/types/current-user.type";

describe("StatisticsService dashboard statistics", () => {
  const currentUser: CurrentUserType = {
    userId: "00000000-0000-0000-0000-000000000001",
    tenantId: "00000000-0000-0000-0000-000000000001",
    email: "admin@example.com",
    roleSlugs: ["admin"],
    permissions: [PERMISSIONS.COURSE_UPDATE],
  };

  const createStatisticsRepository = () => ({
    getDashboardTrainingCompletion: jest.fn().mockResolvedValue({
      completed: 2,
      inProgress: 1,
      notStarted: 1,
      total: 4,
    }),
    getDashboardIncompleteCourses: jest.fn().mockResolvedValue([
      {
        id: "course-1",
        title: "Compliance",
        completed: 2,
        inProgress: 1,
        notStarted: 1,
        total: 4,
        overdue: 1,
      },
    ]),
    getDashboardDeadlineRiskCounts: jest.fn().mockResolvedValue({
      overdueCount: 1,
      dueSoonCount: 1,
    }),
    getDashboardDeadlineRisks: jest.fn().mockResolvedValue({
      rows: [
        {
          courseId: "course-1",
          courseTitle: "Compliance",
          studentId: "student-1",
          studentName: "Ada Example",
          dueDate: "2026-07-20T10:00:00.000Z",
        },
      ],
      totalItems: 1,
    }),
    getDashboardDeadlineRiskCourseSummaries: jest.fn().mockResolvedValue({
      data: [],
      totalItems: 0,
    }),
    getDashboardDeadlineRiskGroups: jest.fn().mockResolvedValue({
      data: [],
      totalItems: 0,
    }),
  });

  it("returns only the training-completion aggregate", async () => {
    const statisticsRepository = createStatisticsRepository();
    const service = new StatisticsService(statisticsRepository as never, {} as never, {} as never);

    const result = await service.getDashboardTrainingCompletion(currentUser);

    expect(result).toEqual({
      completed: 2,
      inProgress: 1,
      notStarted: 1,
      total: 4,
      percentage: 50,
    });
    expect(statisticsRepository.getDashboardTrainingCompletion).toHaveBeenCalledWith(
      undefined,
      undefined,
    );
    expect(statisticsRepository.getDashboardIncompleteCourses).not.toHaveBeenCalled();
    expect(statisticsRepository.getDashboardDeadlineRiskCounts).not.toHaveBeenCalled();
  });

  it("returns only deadline-risk counts for the summary", async () => {
    const statisticsRepository = createStatisticsRepository();
    const service = new StatisticsService(statisticsRepository as never, {} as never, {} as never);

    const result = await service.getDashboardDeadlineRiskSummary(currentUser);

    expect(result).toEqual({
      overdueCount: 1,
      dueSoonCount: 1,
    });
    expect(statisticsRepository.getDashboardDeadlineRisks).not.toHaveBeenCalled();
  });

  it("returns incomplete courses and only the enrollment-presence flag", async () => {
    const statisticsRepository = createStatisticsRepository();
    const service = new StatisticsService(statisticsRepository as never, {} as never, {} as never);

    const result = await service.getDashboardIncompleteCourses(currentUser, SUPPORTED_LANGUAGES.EN);

    expect(result).toEqual({
      hasEnrollments: true,
      courses: [
        {
          id: "course-1",
          title: "Compliance",
          completed: 2,
          inProgress: 1,
          notStarted: 1,
          total: 4,
          overdue: 1,
        },
      ],
    });
    expect(statisticsRepository.getDashboardDeadlineRiskCounts).not.toHaveBeenCalled();
  });

  it("groups paginated deadline-risk details by course", async () => {
    const statisticsRepository = createStatisticsRepository();
    const service = new StatisticsService(statisticsRepository as never, {} as never, {} as never);
    const details = await service.getDashboardDeadlineRisks(
      currentUser,
      SUPPORTED_LANGUAGES.EN,
      DASHBOARD_DEADLINE_RISK_TYPES.OVERDUE,
      1,
      20,
    );

    expect(details).toEqual({
      data: [
        {
          id: "course-1",
          title: "Compliance",
          students: [
            {
              id: "student-1",
              name: "Ada Example",
              dueDate: "2026-07-20T10:00:00.000Z",
            },
          ],
        },
      ],
      pagination: { totalItems: 1, page: 1, perPage: 20 },
    });
  });

  it("scopes deadline-risk drill-downs to content creator-owned courses", async () => {
    const statisticsRepository = createStatisticsRepository();
    const service = new StatisticsService(statisticsRepository as never, {} as never, {} as never);
    const contentCreator = {
      ...currentUser,
      permissions: [PERMISSIONS.COURSE_UPDATE_OWN],
    };

    await service.getDashboardDeadlineRiskCourseSummaries(
      contentCreator,
      SUPPORTED_LANGUAGES.EN,
      DASHBOARD_DEADLINE_RISK_URGENCY_ORDERS.MOST_URGENT,
      1,
      20,
    );
    await service.getDashboardDeadlineRiskGroups(
      contentCreator,
      "00000000-0000-0000-0000-000000000004",
      SUPPORTED_LANGUAGES.EN,
      DASHBOARD_DEADLINE_RISK_TYPES.OVERDUE,
      "Ada",
      DASHBOARD_DEADLINE_RISK_GROUP_SORT_FIELDS.DUE_DATE,
      DASHBOARD_DEADLINE_RISK_SORT_DIRECTIONS.ASC,
      1,
      20,
    );

    expect(statisticsRepository.getDashboardDeadlineRiskCourseSummaries).toHaveBeenCalledWith(
      contentCreator.userId,
      SUPPORTED_LANGUAGES.EN,
      DASHBOARD_DEADLINE_RISK_URGENCY_ORDERS.MOST_URGENT,
      1,
      20,
      undefined,
    );
    expect(statisticsRepository.getDashboardDeadlineRiskGroups).toHaveBeenCalledWith(
      contentCreator.userId,
      "00000000-0000-0000-0000-000000000004",
      SUPPORTED_LANGUAGES.EN,
      DASHBOARD_DEADLINE_RISK_TYPES.OVERDUE,
      "Ada",
      DASHBOARD_DEADLINE_RISK_GROUP_SORT_FIELDS.DUE_DATE,
      DASHBOARD_DEADLINE_RISK_SORT_DIRECTIONS.ASC,
      1,
      20,
      undefined,
      undefined,
    );
  });
});
