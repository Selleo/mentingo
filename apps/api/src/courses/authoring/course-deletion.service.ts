import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PERMISSIONS } from "@repo/shared";

import { hasPermission } from "src/common/permissions/permission.utils";
import { DeleteCourseEvent, DeleteScormEvent } from "src/events";
import { SEARCH_ENTITY_TYPES } from "src/global-search/global-search.constants";
import { SearchIndexService } from "src/global-search/search-index.service";
import { OutboxPublisher } from "src/outbox/outbox.publisher";
import { SettingsService } from "src/settings/settings.service";

import { PROTECTED_COURSE_DELETE_STATUSES } from "../course.constants";

import { CourseDeletionRepository } from "./course-deletion.repository";

import type { DatabasePg, UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";

@Injectable()
export class CourseDeletionService {
  constructor(
    private readonly courseDeletionRepository: CourseDeletionRepository,
    private readonly settingsService: SettingsService,
    private readonly searchIndexService: SearchIndexService,
    private readonly outboxPublisher: OutboxPublisher,
  ) {}

  async deleteCourse(id: UUIDType, currentUser: CurrentUserType) {
    const [course] = await this.courseDeletionRepository.findCoursesWithTitle([id]);

    if (!course) {
      throw new NotFoundException("adminCourseView.errors.notFound.course");
    }

    if (!hasPermission(currentUser.permissions, PERMISSIONS.COURSE_DELETE)) {
      throw new ForbiddenException("adminCourseView.errors.forbidden.deleteCourse");
    }

    if (PROTECTED_COURSE_DELETE_STATUSES.includes(course.status)) {
      throw new ForbiddenException("adminCoursesView.toast.deleteProtectedCourseFailed");
    }

    await this.courseDeletionRepository.runInTransaction((trx) =>
      this.deleteCoursesWithDependencies(
        [id],
        new Map([[course.id, course.courseTitle]]),
        "adminCoursesView.toast.deleteCourseFailed",
        currentUser,
        trx,
      ),
    );

    return null;
  }

  async deleteManyCourses(ids: UUIDType[], currentUser: CurrentUserType) {
    if (!ids.length) {
      throw new BadRequestException("adminCoursesView.toast.noCoursesSelected");
    }

    if (!hasPermission(currentUser.permissions, PERMISSIONS.COURSE_DELETE)) {
      throw new ForbiddenException("adminCourseView.errors.forbidden.deleteCourses");
    }

    const selectedCourses = await this.courseDeletionRepository.findCoursesWithTitle(ids);

    if (
      selectedCourses.some((course) => PROTECTED_COURSE_DELETE_STATUSES.includes(course.status))
    ) {
      throw new ForbiddenException("adminCoursesView.toast.deleteProtectedCourseFailed");
    }

    await this.courseDeletionRepository.runInTransaction((trx) =>
      this.deleteCoursesWithDependencies(
        ids,
        new Map(selectedCourses.map((course) => [course.id, course.courseTitle])),
        "adminCoursesView.toast.deleteCoursesFailed",
        currentUser,
        trx,
      ),
    );

    return null;
  }

  /**
   * Removes the courses with their SCORM packages, enrollments and statistics, then records the
   * deletions in the outbox within the same transaction.
   */
  private async deleteCoursesWithDependencies(
    courseIds: UUIDType[],
    courseTitlesById: Map<UUIDType, string | null>,
    nothingDeletedMessage: string,
    currentUser: CurrentUserType,
    trx: DatabasePg,
  ) {
    const scormPackageIds = await this.courseDeletionRepository.deleteScormPackagesForCourses(
      courseIds,
      trx,
    );
    await this.courseDeletionRepository.deleteStudentCourses(courseIds, trx);
    await this.courseDeletionRepository.deleteStudentChapterProgress(courseIds, trx);
    await this.courseDeletionRepository.deleteCoursesSummaryStats(courseIds, trx);
    await this.settingsService.clearFeaturedCoursesIfMatches(courseIds, trx);

    const deletedCourses = await this.courseDeletionRepository.deleteCourses(courseIds, trx);

    if (!deletedCourses.length) {
      throw new ConflictException(nothingDeletedMessage);
    }

    for (const courseId of courseIds) {
      await this.searchIndexService.deleteEntityDocuments({
        entityType: SEARCH_ENTITY_TYPES.COURSE,
        entityId: courseId,
        db: trx,
      });
    }

    if (scormPackageIds.length) {
      await this.outboxPublisher.publish(
        new DeleteScormEvent({
          scormIds: scormPackageIds.map((scormId) => ({ scormId })),
          actor: currentUser,
        }),
        trx,
      );
    }

    await this.outboxPublisher.publish(
      new DeleteCourseEvent({
        courses: deletedCourses.map((course) => ({
          courseId: course.id,
          courseTitle: courseTitlesById.get(course.id) ?? null,
        })),
        actor: currentUser,
      }),
      trx,
    );
  }
}
