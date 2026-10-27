import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { COURSE_STATUSES, PERMISSIONS } from "@repo/shared";

import { hasPermission } from "src/common/permissions/permission.utils";
import { processInBatches } from "src/common/utils/processInBatches";
import {
  BulkUpdateCourseCategoryEvent,
  BulkUpdateCourseStatusEvent,
  UpdateCourseEvent,
} from "src/events";
import { SearchIndexService } from "src/global-search/search-index.service";
import { OutboxPublisher } from "src/outbox/outbox.publisher";
import { SettingsService } from "src/settings/settings.service";

import { COURSE_BULK_STATUS_UPDATE_BATCH_SIZE } from "../course.constants";
import { MasterCourseService } from "../master-course/master-course.service";

import { CourseActivitySnapshotService } from "./course-activity-snapshot.service";
import { CourseBulkEditingRepository } from "./course-bulk-editing.repository";

import type { BulkArchiveCourseBody } from "../schemas/bulkArchiveCourse.schema";
import type { BulkUpdateCourseCategoryBody } from "../schemas/bulkUpdateCourseCategory.schema";
import type { BulkUpdateCourseStatusBody } from "../schemas/bulkUpdateCourseStatus.schema";
import type { DatabasePg, UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";

@Injectable()
export class CourseBulkEditingService {
  constructor(
    private readonly courseBulkEditingRepository: CourseBulkEditingRepository,
    private readonly courseActivitySnapshotService: CourseActivitySnapshotService,
    private readonly masterCourseService: MasterCourseService,
    private readonly settingsService: SettingsService,
    private readonly searchIndexService: SearchIndexService,
    private readonly outboxPublisher: OutboxPublisher,
  ) {}

  async bulkUpdateCourseStatus(
    body: BulkUpdateCourseStatusBody,
    currentUser: CurrentUserType,
  ): Promise<void> {
    const ids = [...new Set(body.ids)];

    if (!ids.length) throw new BadRequestException("adminCoursesView.toast.noCoursesSelected");

    const selectedCourses = await this.findEditableCourses(ids, currentUser);

    if (selectedCourses.length !== ids.length) {
      throw new ForbiddenException("adminCoursesView.toast.bulkStatusUpdateForbidden");
    }

    await this.assertCoursesFieldEditable(ids, "status");

    const courseIdsToUpdate = selectedCourses
      .filter((course) => course.status !== body.status)
      .map((course) => course.id);

    if (!courseIdsToUpdate.length) return;

    await this.courseBulkEditingRepository.runInTransaction(async (trx) => {
      const courseUpdates = await this.updateCoursesAndCollectChanges(
        courseIdsToUpdate,
        async () => {
          await this.courseBulkEditingRepository.updateCoursesStatus(
            courseIdsToUpdate,
            body.status,
            trx,
          );

          if (body.status !== COURSE_STATUSES.PUBLISHED) {
            await this.settingsService.clearFeaturedCoursesIfMatches(courseIdsToUpdate, trx);
          }
        },
        trx,
      );

      if (!courseUpdates.length) return;

      await this.outboxPublisher.publish(
        new BulkUpdateCourseStatusEvent({
          actor: currentUser,
          tenantId: currentUser.tenantId,
          status: body.status,
          requestedCount: ids.length,
          updatedCount: courseUpdates.length,
          skippedCount: ids.length - courseUpdates.length,
          updates: courseUpdates,
        }),
        trx,
      );
    });
  }

  async bulkArchiveCourse(body: BulkArchiveCourseBody, currentUser: CurrentUserType) {
    const ids = [...new Set(body.ids)];
    if (!ids.length) throw new BadRequestException("adminCoursesView.toast.noCoursesSelected");

    const selectedCourses = await this.findEditableCourses(ids, currentUser);

    if (selectedCourses.length !== ids.length) {
      throw new ForbiddenException("adminCoursesView.toast.bulkArchiveUpdateForbidden");
    }

    const idsToUpdate = selectedCourses
      .filter((course) => course.isArchived !== body.isArchived)
      .map((course) => course.id);
    if (!idsToUpdate.length) return;

    await this.courseBulkEditingRepository.runInTransaction(async (trx) => {
      const previousSnapshots = await processInBatches(
        idsToUpdate,
        (courseId) =>
          this.courseActivitySnapshotService.buildCourseActivitySnapshot(courseId, undefined, trx),
        { batchSize: COURSE_BULK_STATUS_UPDATE_BATCH_SIZE },
      );

      await this.courseBulkEditingRepository.updateCoursesArchived(
        idsToUpdate,
        body.isArchived,
        trx,
      );

      if (body.isArchived) {
        await this.settingsService.clearFeaturedCoursesIfMatches(idsToUpdate, trx);
      }

      for (const previousCourseData of previousSnapshots) {
        const updatedCourseData =
          await this.courseActivitySnapshotService.buildCourseActivitySnapshot(
            previousCourseData.id,
            undefined,
            trx,
          );

        await this.outboxPublisher.publish(
          new UpdateCourseEvent({
            courseId: previousCourseData.id,
            actor: currentUser,
            previousCourseData,
            updatedCourseData,
          }),
          trx,
        );
      }
    });
  }

  async bulkUpdateCourseCategory(
    body: BulkUpdateCourseCategoryBody,
    currentUser: CurrentUserType,
  ): Promise<void> {
    const ids = [...new Set(body.ids)];

    if (!ids.length) throw new BadRequestException("adminCoursesView.toast.noCoursesSelected");

    const categoryExists = await this.courseBulkEditingRepository.categoryExists(body.categoryId);

    if (!categoryExists) {
      throw new NotFoundException("adminCoursesView.toast.bulkCategoryUpdateCategoryNotFound");
    }

    const selectedCourses = await this.findEditableCourses(ids, currentUser);

    if (selectedCourses.length !== ids.length) {
      throw new ForbiddenException("adminCoursesView.toast.bulkCategoryUpdateForbidden");
    }

    await this.assertCoursesFieldEditable(ids, "categoryId");

    const courseIdsToUpdate = selectedCourses
      .filter((course) => course.categoryId !== body.categoryId)
      .map((course) => course.id);

    if (!courseIdsToUpdate.length) return;

    await this.courseBulkEditingRepository.runInTransaction(async (trx) => {
      const courseUpdates = await this.updateCoursesAndCollectChanges(
        courseIdsToUpdate,
        () =>
          this.courseBulkEditingRepository.updateCoursesCategory(
            courseIdsToUpdate,
            body.categoryId,
            trx,
          ),
        trx,
      );

      if (!courseUpdates.length) return;

      await this.outboxPublisher.publish(
        new BulkUpdateCourseCategoryEvent({
          actor: currentUser,
          tenantId: currentUser.tenantId,
          categoryId: body.categoryId,
          requestedCount: ids.length,
          updatedCount: courseUpdates.length,
          skippedCount: ids.length - courseUpdates.length,
          updates: courseUpdates,
        }),
        trx,
      );
    });
  }

  /** Users without `COURSE_UPDATE` may only select their own courses. */
  private async findEditableCourses(ids: UUIDType[], currentUser: CurrentUserType) {
    const canUpdateAnyCourse = hasPermission(currentUser.permissions, PERMISSIONS.COURSE_UPDATE);

    return this.courseBulkEditingRepository.findCoursesForBulkEdit(
      ids,
      canUpdateAnyCourse ? undefined : currentUser.userId,
    );
  }

  private async assertCoursesFieldEditable(ids: UUIDType[], field: "status" | "categoryId") {
    await processInBatches(
      ids,
      (courseId) =>
        this.masterCourseService.assertCourseContentEditable(courseId, [field], [field]),
      { batchSize: COURSE_BULK_STATUS_UPDATE_BATCH_SIZE },
    );
  }

  /**
   * Snapshots the courses, applies the update, refreshes their search documents and returns the
   * courses whose activity snapshot actually changed.
   */
  private async updateCoursesAndCollectChanges(
    courseIds: UUIDType[],
    updateCourses: () => Promise<void>,
    trx: DatabasePg,
  ) {
    const snapshots = await processInBatches(
      courseIds,
      async (courseId) => ({
        courseId,
        previousSnapshot: await this.courseActivitySnapshotService.buildCourseActivitySnapshot(
          courseId,
          undefined,
          trx,
        ),
      }),
      { batchSize: COURSE_BULK_STATUS_UPDATE_BATCH_SIZE },
    );

    await updateCourses();

    const courseUpdateData = await processInBatches(
      snapshots,
      async (snapshot) => {
        await this.searchIndexService.refreshCourse(snapshot.courseId, trx);

        return {
          ...snapshot,
          updatedSnapshot: await this.courseActivitySnapshotService.buildCourseActivitySnapshot(
            snapshot.courseId,
            undefined,
            trx,
          ),
        };
      },
      { batchSize: COURSE_BULK_STATUS_UPDATE_BATCH_SIZE },
    );

    return courseUpdateData
      .filter(
        ({ previousSnapshot, updatedSnapshot }) =>
          !this.courseActivitySnapshotService.areCourseSnapshotsEqual(
            previousSnapshot,
            updatedSnapshot,
          ),
      )
      .map(({ courseId, previousSnapshot, updatedSnapshot }) => ({
        courseId,
        previousCourseData: previousSnapshot,
        updatedCourseData: updatedSnapshot,
      }));
  }
}
