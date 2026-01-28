import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import { CourseService } from "./course.service";

@Injectable()
export class CourseCron {
  constructor(
    private readonly courseService: CourseService,
    private readonly tenantRunner: TenantDbRunnerService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async notifyAdminsAboutOverdueCoursesPerDay() {
    await this.tenantRunner.runForEachTenant(async () => {
      await this.courseService.sendOverdueCoursesEmails();
    });
  }
}
