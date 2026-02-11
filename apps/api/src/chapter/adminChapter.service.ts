import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { eq, getTableColumns, sql } from "drizzle-orm";
import { isEqual } from "lodash";

import { DatabasePg, type UUIDType } from "src/common";
import { buildJsonbField } from "src/common/helpers/sqlHelpers";
import { CreateChapterEvent, DeleteChapterEvent, UpdateChapterEvent } from "src/events";
import { MAX_LESSON_TITLE_LENGTH } from "src/lesson/repositories/lesson.constants";
import { AdminLessonService } from "src/lesson/services/adminLesson.service";
import { LocalizationService } from "src/localization/localization.service";
import { ENTITY_TYPE } from "src/localization/localization.types";
import { OutboxPublisher } from "src/outbox/outbox.publisher";
import { chapters } from "src/storage/schema";

import { AdminChapterRepository } from "./repositories/adminChapter.repository";

import type { CreateChapterBody, UpdateChapterBody } from "./schemas/chapter.schema";
import type { SupportedLanguages } from "@repo/shared";
import type { ChapterActivityLogSnapshot } from "src/activity-logs/types";
import type { CurrentUser } from "src/common/types/current-user.type";
import type { UserRole } from "src/user/schemas/userRoles";

@Injectable()
export class AdminChapterService {
  constructor(
    @Inject("DB") private readonly db: DatabasePg,
    private readonly adminChapterRepository: AdminChapterRepository,
    private readonly adminLessonService: AdminLessonService,
    private readonly localizationService: LocalizationService,
    private readonly outboxPublisher: OutboxPublisher,
  ) {}

  async createChapterForCourse(body: CreateChapterBody, currentUser: CurrentUser) {
    const chapter = await this.db.transaction(async (trx) => {
      await this.adminLessonService.validateAccess(
        "course",
        currentUser.role,
        currentUser.userId,
        body.courseId,
      );

      const [maxDisplayOrder] = await trx
        .select({ displayOrder: sql<number>`COALESCE(MAX(${chapters.displayOrder}), 0)` })
        .from(chapters)
        .where(eq(chapters.courseId, body.courseId));

      const { language } = await this.localizationService.getBaseLanguage(
        ENTITY_TYPE.COURSE,
        body.courseId,
      );

      if (body.title && body.title.length > MAX_LESSON_TITLE_LENGTH) {
        throw new BadRequestException({
          message: `adminCourseView.toast.maxTitleLengthExceeded`,
          count: MAX_LESSON_TITLE_LENGTH,
        });
      }

      const [chapter] = await trx
        .insert(chapters)
        .values({
          ...body,
          authorId: currentUser.userId,
          title: buildJsonbField(language, body.title),
          displayOrder: maxDisplayOrder.displayOrder + 1,
        })
        .returning({
          ...getTableColumns(chapters),
          title: sql<string>`${chapters.title}->>${language}::text`,
        });

      if (!chapter) throw new NotFoundException("Chapter not found");

      await this.adminChapterRepository.updateChapterCountForCourse(chapter.courseId, trx);

      return chapter;
    });

    if (!chapter) throw new BadRequestException("Chapter creation failed");

    const createdChapterSnapshot = await this.buildChapterActivitySnapshot(chapter.id);

    await this.outboxPublisher.publish(
      new CreateChapterEvent({
        chapterId: chapter.id,
        actor: currentUser,
        createdChapter: createdChapterSnapshot,
      }),
    );

    return { id: chapter.id };
  }

  async updateFreemiumStatus(
    chapterId: UUIDType,
    isFreemium: boolean,
    currentUserId: UUIDType,
    currentUserRole: UserRole,
  ) {
    await this.adminLessonService.validateAccess(
      "chapter",
      currentUserRole,
      currentUserId,
      chapterId,
    );

    return await this.adminChapterRepository.updateFreemiumStatus(chapterId, isFreemium);
  }

  async updateChapterDisplayOrder(chapterObject: {
    chapterId: UUIDType;
    displayOrder: number;
    currentUser: CurrentUser;
  }): Promise<void> {
    await this.adminLessonService.validateAccess(
      "chapter",
      chapterObject.currentUser.role,
      chapterObject.currentUser.userId,
      chapterObject.chapterId,
    );

    const { language } = await this.localizationService.getBaseLanguage(
      ENTITY_TYPE.CHAPTER,
      chapterObject.chapterId,
    );

    const [chapterToUpdate] = await this.adminChapterRepository.getChapterById(
      chapterObject.chapterId,
      language,
    );

    const oldDisplayOrder = chapterToUpdate.displayOrder;

    if (!chapterToUpdate || oldDisplayOrder === null) {
      throw new NotFoundException("Chapter not found");
    }

    const newDisplayOrder = chapterObject.displayOrder;

    const previousSnapshot = await this.buildChapterActivitySnapshot(
      chapterObject.chapterId,
      language,
    );

    await this.adminChapterRepository.changeChapterDisplayOrder(
      chapterToUpdate.courseId,
      chapterToUpdate.id,
      oldDisplayOrder,
      newDisplayOrder,
      language,
    );

    const updatedSnapshot = await this.buildChapterActivitySnapshot(
      chapterObject.chapterId,
      language,
    );

    if (this.areChapterSnapshotsEqual(previousSnapshot, updatedSnapshot)) return;

    await this.outboxPublisher.publish(
      new UpdateChapterEvent({
        chapterId: chapterToUpdate.id,
        actor: chapterObject.currentUser,
        previousChapterData: previousSnapshot,
        updatedChapterData: updatedSnapshot,
      }),
    );
  }

  async updateChapter(id: UUIDType, body: UpdateChapterBody, currentUser: CurrentUser) {
    await this.adminLessonService.validateAccess(
      "chapter",
      currentUser.role,
      currentUser.userId,
      id,
    );

    if (body.title && body.title.length > MAX_LESSON_TITLE_LENGTH) {
      throw new BadRequestException({
        message: `adminCourseView.toast.maxTitleLengthExceeded`,
        count: MAX_LESSON_TITLE_LENGTH,
      });
    }

    const { availableLocales, language: resolvedLanguage } =
      await this.localizationService.getBaseLanguage(ENTITY_TYPE.CHAPTER, id, body.language);

    const previousSnapshot = await this.buildChapterActivitySnapshot(id, resolvedLanguage);

    if (!availableLocales.includes(body.language)) {
      throw new BadRequestException("This course does not support this language");
    }

    const [chapter] = await this.adminChapterRepository.updateChapter(id, body);

    if (!chapter) throw new NotFoundException("Chapter not found");

    const updatedSnapshot = await this.buildChapterActivitySnapshot(id, resolvedLanguage);

    if (this.areChapterSnapshotsEqual(previousSnapshot, updatedSnapshot)) return;

    await this.outboxPublisher.publish(
      new UpdateChapterEvent({
        chapterId: chapter.id,
        actor: currentUser,
        previousChapterData: previousSnapshot,
        updatedChapterData: updatedSnapshot,
      }),
    );
  }

  async removeChapter(chapterId: UUIDType, currentUser: CurrentUser) {
    await this.adminLessonService.validateAccess(
      "chapter",
      currentUser.role,
      currentUser.userId,
      chapterId,
    );

    const [chapter] = await this.adminChapterRepository.getChapterById(chapterId);

    if (!chapter) throw new NotFoundException("Chapter not found");

    await this.db.transaction(async (trx) => {
      await this.adminChapterRepository.removeChapter(chapterId, trx);
      await this.adminChapterRepository.updateChapterDisplayOrder(chapter.courseId, trx);
      await this.adminChapterRepository.updateChapterCountForCourse(chapter.courseId, trx);

      await this.outboxPublisher.publish(
        new DeleteChapterEvent({
          chapterId: chapter.id,
          actor: currentUser,
          chapterName: chapter.title,
        }),
        trx,
      );
    });
  }

  private async buildChapterActivitySnapshot(
    chapterId: UUIDType,
    language?: SupportedLanguages,
  ): Promise<ChapterActivityLogSnapshot> {
    const resolvedLanguage =
      language ??
      (await this.localizationService.getBaseLanguage(ENTITY_TYPE.CHAPTER, chapterId)).language;

    const [chapter] = await this.adminChapterRepository.getChapterById(chapterId, resolvedLanguage);

    if (!chapter) throw new NotFoundException("Chapter not found");

    return {
      id: chapter.id,
      title: chapter.title,
      courseId: chapter.courseId,
      authorId: chapter.authorId,
      displayOrder: chapter.displayOrder,
      isFreemium: chapter.isFreemium,
      lessonCount: chapter.lessonCount,
    };
  }

  private areChapterSnapshotsEqual(
    previousSnapshot: ChapterActivityLogSnapshot | null,
    updatedSnapshot: ChapterActivityLogSnapshot | null,
  ) {
    return isEqual(previousSnapshot, updatedSnapshot);
  }
}
