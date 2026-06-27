import { ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  COURSE_DUPLICATION_SOCKET,
  COURSE_DUPLICATION_STATUS,
  COURSE_ORIGIN_TYPES,
  SUPPORTED_LANGUAGES,
  isSupportedLanguage,
  type SupportedLanguages,
} from "@repo/shared";
import { eq } from "drizzle-orm";
import { match } from "ts-pattern";

import { DatabasePg, type UUIDType } from "src/common";
import { canUpdateCourseByAuthor } from "src/common/permissions/course-permission.utils";
import { CourseDuplicationQueueService } from "src/courses/course-duplication.queue.service";
import { MasterCourseService } from "src/courses/master-course.service";
import { SearchIndexService } from "src/global-search/search-index.service";
import { DB } from "src/storage/db/db.providers";
import { courses, coursesSummaryStats } from "src/storage/schema";
import { WsGateway } from "src/websocket";

import type { CurrentUserType } from "src/common/types/current-user.type";
import type { DuplicateCourseResponse } from "src/courses/schemas/courseDuplication.schema";
import type { CourseDuplicationJobData } from "src/queue";

type LocalizedStringMap = Record<string, string>;

const COURSE_DUPLICATION_COPY_SUFFIX: Record<SupportedLanguages, string> = {
  [SUPPORTED_LANGUAGES.EN]: "(Copy)",
  [SUPPORTED_LANGUAGES.PL]: "(Kopia)",
  [SUPPORTED_LANGUAGES.DE]: "(Kopie)",
  [SUPPORTED_LANGUAGES.LT]: "(Kopija)",
  [SUPPORTED_LANGUAGES.CS]: "(Kopie)",
};

@Injectable()
export class CourseDuplicationService {
  constructor(
    @Inject(DB) private readonly db: DatabasePg,
    private readonly courseDuplicationQueueService: CourseDuplicationQueueService,
    private readonly masterCourseService: MasterCourseService,
    private readonly searchIndexService: SearchIndexService,
    private readonly wsGateway: WsGateway,
  ) {}

  async duplicateCourse(
    sourceCourseId: UUIDType,
    actor: CurrentUserType,
  ): Promise<DuplicateCourseResponse> {
    const sourceCourse = await this.getSourceCourse(sourceCourseId);
    if (!canUpdateCourseByAuthor(actor, sourceCourse.authorId)) {
      throw new ForbiddenException("courseDuplication.error.manageAccessRequired");
    }

    const targetCourseId = await this.db.transaction(async (trx) => {
      const [createdCourse] = await trx
        .insert(courses)
        .values({
          title: this.appendCopySuffix(sourceCourse.title, sourceCourse.baseLanguage),
          description: sourceCourse.description,
          baseLanguage: sourceCourse.baseLanguage,
          availableLocales: sourceCourse.availableLocales,
          status: "draft",
          priceInCents: 0,
          currency: sourceCourse.currency,
          courseType: sourceCourse.courseType,
          authorId: actor.userId,
          categoryId: sourceCourse.categoryId,
          stripeProductId: null,
          stripePriceId: null,
          originType: COURSE_ORIGIN_TYPES.REGULAR,
          sourceCourseId: null,
          sourceTenantId: null,
          settings: sourceCourse.settings,
        })
        .returning({ id: courses.id });

      if (!createdCourse) throw new NotFoundException("courseDuplication.error.createFailed");

      await trx
        .insert(coursesSummaryStats)
        .values({ courseId: createdCourse.id, authorId: actor.userId });

      await this.searchIndexService.refreshCourse(createdCourse.id, trx);

      return createdCourse.id;
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

  async processDuplicationJob(jobId: string, data: CourseDuplicationJobData): Promise<void> {
    this.publishStatus(jobId, data, COURSE_DUPLICATION_STATUS.PROCESSING);

    try {
      await this.masterCourseService.duplicateCourseIntoExistingCourse({
        sourceCourseId: data.sourceCourseId,
        targetCourseId: data.targetCourseId,
        actorId: data.actor.userId,
        tenantId: data.tenantId,
      });

      await this.searchIndexService.refreshCourse(data.targetCourseId);

      this.publishStatus(jobId, data, COURSE_DUPLICATION_STATUS.COMPLETED);
    } catch (error) {
      this.publishStatus(jobId, data, COURSE_DUPLICATION_STATUS.FAILED);
      throw error;
    }
  }

  private async getSourceCourse(sourceCourseId: UUIDType) {
    const [sourceCourse] = await this.db
      .select()
      .from(courses)
      .where(eq(courses.id, sourceCourseId))
      .limit(1);

    if (!sourceCourse) throw new NotFoundException("courseDuplication.error.sourceCourseNotFound");

    return sourceCourse;
  }

  private appendCopySuffix(value: unknown, baseLanguage: SupportedLanguages): LocalizedStringMap {
    const sourceTitle = this.toLocalizedStringMap(value);
    const entries = Object.entries(sourceTitle);

    if (!entries.length) {
      return { [baseLanguage]: this.getCopySuffix(baseLanguage) };
    }

    return Object.fromEntries(
      entries.map(([language, title]) => {
        const suffixLanguage = isSupportedLanguage(language) ? language : baseLanguage;

        return [language, `${title} ${this.getCopySuffix(suffixLanguage)}`];
      }),
    );
  }

  private getCopySuffix(language: SupportedLanguages) {
    return COURSE_DUPLICATION_COPY_SUFFIX[language];
  }

  private toLocalizedStringMap(value: unknown): LocalizedStringMap {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};

    return Object.fromEntries(
      Object.entries(value).filter((entry): entry is [string, string] => {
        const [, entryValue] = entry;
        return typeof entryValue === "string";
      }),
    );
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
