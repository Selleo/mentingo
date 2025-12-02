import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import { CourseService } from "./course.service";

@Injectable()
export class CourseCron {
  constructor(private courseService: CourseService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async notifyAdminsAboutOverdueCoursesPerDay() {
    await this.courseService.sendOverdueCoursesEmails();
  }
}
