import { ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import {
  COURSE_DUPLICATION_SOCKET,
  COURSE_DUPLICATION_STATUS,
  isSupportedLanguage,
  type LocalizedText,
  type SupportedLanguages,
} from "@repo/shared";
import { match } from "ts-pattern";

import { canUpdateCourseByAuthor } from "src/common/permissions/course-permission.utils";
import { COURSE_TRANSFER_MODES } from "src/course-transfer/course-transfer.constants";
import { CourseTransferService } from "src/course-transfer/services/course-transfer.service";
import { COURSE_DUPLICATION_COPY_SUFFIX } from "src/courses/course-duplication.constants";
import { CourseDuplicationQueueService } from "src/courses/course-duplication.queue.service";
import { CourseDuplicationRepository } from "src/courses/course-duplication.repository";
import { CourseDuplicatedEvent } from "src/events";
import { SearchIndexService } from "src/global-search/search-index.service";
import { OutboxPublisher } from "src/outbox/outbox.publisher";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";
import { WsGateway } from "src/websocket";

import type { UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";
import type { CourseDuplicationSourceCourse } from "src/courses/course-duplication.types";
import type { DuplicateCourseResponse } from "src/courses/schemas/courseDuplication.schema";
import type { CourseDuplicationJobData } from "src/queue";

@Injectable()
export class CourseDuplicationService {
  private readonly logger = new Logger(CourseDuplicationService.name);

  constructor(
    private readonly courseDuplicationRepository: CourseDuplicationRepository,
    private readonly courseDuplicationQueueService: CourseDuplicationQueueService,
    private readonly courseTransferService: CourseTransferService,
    private readonly searchIndexService: SearchIndexService,
    private readonly wsGateway: WsGateway,
    private readonly outboxPublisher: OutboxPublisher,
    private readonly tenantDbRunnerService: TenantDbRunnerService,
  ) {}

  async duplicateCourse(
    sourceCourseId: UUIDType,
    actor: CurrentUserType,
  ): Promise<DuplicateCourseResponse> {
    const sourceCourse = await this.getSourceCourse(sourceCourseId);
    if (!canUpdateCourseByAuthor(actor, sourceCourse.authorId)) {
      throw new ForbiddenException("courseDuplication.error.manageAccessRequired");
    }

    const targetCourseId = await this.courseDuplicationRepository.createDraftDuplicateCourse({
      sourceCourse,
      title: this.appendCopySuffix(sourceCourse),
      authorId: actor.userId,
    });

    const job = await this.courseDuplicationQueueService.enqueueDuplication({
      tenantId: actor.tenantId,
      sourceCourseId,
      targetCourseId,
      actor,
    });

    return {
      courseId: targetCourseId,
      jobId: String(job.id),
    };
  }

  async getJobStatus(jobId: string) {
    return this.courseDuplicationQueueService.getJobStatus(jobId);
  }

  async duplicateCourseFromJob(jobId: string, data: CourseDuplicationJobData): Promise<void> {
    this.publishStatus(jobId, data, COURSE_DUPLICATION_STATUS.PROCESSING);

    try {
      await this.courseTransferService.copyCourseIntoExistingCourse({
        source: { tenantId: data.tenantId, courseId: data.sourceCourseId },
        destination: { tenantId: data.tenantId, courseId: data.targetCourseId },
        policy: { mode: COURSE_TRANSFER_MODES.DUPLICATE, actorId: data.actor.userId },
      });

      await this.searchIndexService.refreshCourse(data.targetCourseId);
    } catch (error) {
      this.publishStatus(jobId, data, COURSE_DUPLICATION_STATUS.FAILED);
      throw error;
    }

    this.publishStatus(jobId, data, COURSE_DUPLICATION_STATUS.COMPLETED);
    await this.recordCourseDuplicated(data);
  }

  /**
   * The copy is committed by course transfer, so the event cannot share its transaction.
   * A delivery failure is logged instead of failing a duplication that already exists.
   */
  private async recordCourseDuplicated(data: CourseDuplicationJobData): Promise<void> {
    const courseDuplicatedEvent = new CourseDuplicatedEvent(
      data.tenantId,
      data.sourceCourseId,
      data.targetCourseId,
      data.actor.userId,
      new Date().toISOString(),
    );

    try {
      await this.tenantDbRunnerService.transactionWithHandle((transaction) =>
        this.outboxPublisher.publishDurable(courseDuplicatedEvent, transaction),
      );
    } catch (error) {
      this.logger.error(
        `[tenant=${data.tenantId}] Failed to record duplication of course ${data.sourceCourseId} into ${data.targetCourseId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private async getSourceCourse(sourceCourseId: UUIDType) {
    const sourceCourse = await this.courseDuplicationRepository.getSourceCourse(sourceCourseId);

    if (!sourceCourse) throw new NotFoundException("courseDuplication.error.sourceCourseNotFound");

    return sourceCourse;
  }

  private appendCopySuffix(sourceCourse: CourseDuplicationSourceCourse): LocalizedText {
    const entries = Object.entries(sourceCourse.title);

    if (!entries.length) {
      return { [sourceCourse.baseLanguage]: this.getCopySuffix(sourceCourse.baseLanguage) };
    }

    return Object.fromEntries(
      entries.map(([language, title]) => {
        const suffixLanguage = isSupportedLanguage(language) ? language : sourceCourse.baseLanguage;

        return [language, `${title} ${this.getCopySuffix(suffixLanguage)}`];
      }),
    );
  }

  private getCopySuffix(language: SupportedLanguages) {
    return COURSE_DUPLICATION_COPY_SUFFIX[language];
  }

  private publishStatus(
    jobId: string,
    data: CourseDuplicationJobData,
    status: (typeof COURSE_DUPLICATION_STATUS)[keyof typeof COURSE_DUPLICATION_STATUS],
  ) {
    this.wsGateway.emitToUser(data.actor.userId, COURSE_DUPLICATION_SOCKET.EVENTS.STATUS_CHANGED, {
      courseId: data.targetCourseId,
      sourceCourseId: data.sourceCourseId,
      jobId,
      status,
      messageKey: this.getMessageKey(status),
    });
  }

  private getMessageKey(
    status: (typeof COURSE_DUPLICATION_STATUS)[keyof typeof COURSE_DUPLICATION_STATUS],
  ) {
    return match(status)
      .with(
        COURSE_DUPLICATION_STATUS.PROCESSING,
        () => COURSE_DUPLICATION_SOCKET.MESSAGE_KEYS.PROCESSING,
      )
      .with(
        COURSE_DUPLICATION_STATUS.COMPLETED,
        () => COURSE_DUPLICATION_SOCKET.MESSAGE_KEYS.COMPLETED,
      )
      .with(COURSE_DUPLICATION_STATUS.FAILED, () => COURSE_DUPLICATION_SOCKET.MESSAGE_KEYS.FAILED)
      .otherwise(() => COURSE_DUPLICATION_SOCKET.MESSAGE_KEYS.FAILED);
  }
}
