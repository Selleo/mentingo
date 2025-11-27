import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { eq, sql } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { MAX_LESSON_TITLE_LENGTH } from "src/lesson/repositories/lesson.constants";
import { AdminLessonService } from "src/lesson/services/adminLesson.service";
import { chapters } from "src/storage/schema";

import { AdminChapterRepository } from "./repositories/adminChapter.repository";

import type { CreateChapterBody, UpdateChapterBody } from "./schemas/chapter.schema";
import type { UUIDType } from "src/common";
import type { UserRole } from "src/user/schemas/userRoles";

@Injectable()
export class AdminChapterService {
  constructor(
    @Inject("DB") private readonly db: DatabasePg,
    private readonly adminChapterRepository: AdminChapterRepository,
    private readonly adminLessonService: AdminLessonService,
  ) {}

  async createChapterForCourse(body: CreateChapterBody, authorId: UUIDType, role: UserRole) {
    return await this.db.transaction(async (trx) => {
      await this.adminLessonService.validateAccess("course", role, authorId, body.courseId);

      const [maxDisplayOrder] = await trx
        .select({ displayOrder: sql<number>`COALESCE(MAX(${chapters.displayOrder}), 0)` })
        .from(chapters)
        .where(eq(chapters.courseId, body.courseId));

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
          authorId,
          displayOrder: maxDisplayOrder.displayOrder + 1,
        })
        .returning();

      if (!chapter) throw new NotFoundException("Chapter not found");

      await this.adminChapterRepository.updateChapterCountForCourse(chapter.courseId, trx);

      return { id: chapter.id };
    });
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
    currentUserId: UUIDType;
    currentUserRole: UserRole;
  }): Promise<void> {
    await this.adminLessonService.validateAccess(
      "chapter",
      chapterObject.currentUserRole,
      chapterObject.currentUserId,
      chapterObject.chapterId,
    );

    const [chapterToUpdate] = await this.adminChapterRepository.getChapterById(
      chapterObject.chapterId,
    );

    const oldDisplayOrder = chapterToUpdate.displayOrder;

    if (!chapterToUpdate || oldDisplayOrder === null) {
      throw new NotFoundException("Chapter not found");
    }

    const newDisplayOrder = chapterObject.displayOrder;

    await this.adminChapterRepository.changeChapterDisplayOrder(
      chapterToUpdate.courseId,
      chapterToUpdate.id,
      oldDisplayOrder,
      newDisplayOrder,
    );
  }

  async updateChapter(
    id: UUIDType,
    body: UpdateChapterBody,
    currentUserId: UUIDType,
    currentUserRole: UserRole,
  ) {
    await this.adminLessonService.validateAccess("chapter", currentUserRole, currentUserId, id);

    if (body.title && body.title.length > MAX_LESSON_TITLE_LENGTH) {
      throw new BadRequestException({
        message: `adminCourseView.toast.maxTitleLengthExceeded`,
        count: MAX_LESSON_TITLE_LENGTH,
      });
    }

    const [chapter] = await this.adminChapterRepository.updateChapter(id, body);

    if (!chapter) throw new NotFoundException("Chapter not found");
  }

  async removeChapter(chapterId: UUIDType, currentUserId: UUIDType, currentUserRole: UserRole) {
    await this.adminLessonService.validateAccess(
      "chapter",
      currentUserRole,
      currentUserId,
      chapterId,
    );

    const [chapter] = await this.adminChapterRepository.getChapterById(chapterId);

    if (!chapter) throw new NotFoundException("Chapter not found");

    await this.db.transaction(async (trx) => {
      await this.adminChapterRepository.removeChapter(chapterId, trx);
      await this.adminChapterRepository.updateChapterDisplayOrder(chapter.courseId, trx);
      await this.adminChapterRepository.updateChapterCountForCourse(chapter.courseId, trx);
    });
  }
}
