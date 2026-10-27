import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PERMISSIONS } from "@repo/shared";
import { match } from "ts-pattern";

import { hasPermission } from "src/common/permissions/permission.utils";

import { CourseEnrollmentService } from "../enrollment/course-enrollment.service";

import { CourseStudentModeRepository } from "./course-student-mode.repository";

import type { UUIDType, DatabasePg } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";

@Injectable()
export class CourseStudentModeService {
  constructor(
    private readonly courseStudentModeRepository: CourseStudentModeRepository,
    private readonly courseEnrollmentService: CourseEnrollmentService,
  ) {}

  /** Lets a course manager preview the course as a learner, enrolling them on first use. */
  async setCourseStudentMode(
    courseId: UUIDType,
    currentUser: CurrentUserType,
    enableStudentMode: boolean,
  ) {
    const courseExists = await this.courseStudentModeRepository.courseExists(courseId);

    if (!courseExists) throw new NotFoundException("adminCourseView.errors.notFound.course");

    if (!hasPermission(currentUser.permissions, PERMISSIONS.LEARNING_MODE_USE)) {
      throw new ForbiddenException("You don't have permission to change student mode");
    }

    await this.courseStudentModeRepository.runInTransaction((trx) =>
      match(enableStudentMode)
        .with(true, () => this.enableCourseStudentMode(courseId, currentUser.userId, trx))
        .with(false, () =>
          this.courseStudentModeRepository.deleteStudentModeEntry(
            courseId,
            currentUser.userId,
            trx,
          ),
        )
        .exhaustive(),
    );

    const studentModeCourseIds = await this.getStudentModeCourseIds(currentUser.userId);

    return {
      courseId,
      enabled: enableStudentMode,
      studentModeCourseIds,
    };
  }

  async getStudentModeCourseIds(userId: UUIDType, db?: DatabasePg) {
    return this.courseStudentModeRepository.findStudentModeCourseIds(userId, db);
  }

  async isCourseStudentModeEnabled(courseId: UUIDType, userId: UUIDType, db?: DatabasePg) {
    return this.courseStudentModeRepository.hasStudentModeEntry(courseId, userId, db);
  }

  private async enableCourseStudentMode(courseId: UUIDType, userId: UUIDType, trx: DatabasePg) {
    await this.courseEnrollmentService.createStudentCourse(courseId, userId, null, null, trx);
    await this.courseStudentModeRepository.insertStudentModeEntry(courseId, userId, trx);
    await this.courseEnrollmentService.createCourseDependencies(courseId, userId, null, trx);
  }
}
