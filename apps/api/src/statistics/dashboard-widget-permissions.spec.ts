import { PERMISSIONS } from "@repo/shared";

import { CalendarController } from "src/calendar/calendar.controller";
import { REQUIRED_PERMISSIONS_KEY } from "src/common/decorators/require-permission.decorator";

import { StatisticsController } from "./statistics.controller";

describe("dashboard widget endpoint permissions", () => {
  it.each([
    StatisticsController.prototype.getDashboardTrainingCompletion,
    StatisticsController.prototype.getDashboardDeadlineRiskSummary,
    StatisticsController.prototype.getDashboardIncompleteCourses,
    StatisticsController.prototype.getDashboardDeadlineRisks,
    CalendarController.prototype.getDashboardEvents,
  ])("protects %p with the shared statistics permission", (handler) => {
    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, handler)).toEqual([
      PERMISSIONS.STATISTICS_READ,
    ]);
  });
});
