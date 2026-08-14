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
  ])("protects %p with the shared statistics permission", (handler) => {
    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, handler)).toEqual([
      PERMISSIONS.STATISTICS_READ,
    ]);
  });

  it("protects the dashboard calendar with calendar access", () => {
    expect(
      Reflect.getMetadata(
        REQUIRED_PERMISSIONS_KEY,
        CalendarController.prototype.getDashboardEvents,
      ),
    ).toEqual([PERMISSIONS.CALENDAR_READ]);
  });
});
