import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { eq, sql } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { buildJsonbField } from "src/common/helpers/sqlHelpers";
import { LocalizationService } from "src/localization/localization.service";
import { ENTITY_TYPE } from "src/localization/localization.types";
import { chapters } from "src/storage/schema";

import { AdminChapterRepository } from "./repositories/adminChapter.repository";

import type { CreateChapterBody, UpdateChapterBody } from "./schemas/chapter.schema";
import type { UUIDType } from "src/common";

@Injectable()
export class AdminChapterService {
  constructor(
    @Inject("DB") private readonly db: DatabasePg,
    private readonly adminChapterRepository: AdminChapterRepository,
    private readonly localizationService: LocalizationService,
  ) {}

  async createChapterForCourse(body: CreateChapterBody, authorId: UUIDType) {
    return await this.db.transaction(async (trx) => {
      const [maxDisplayOrder] = await trx
        .select({ displayOrder: sql<number>`COALESCE(MAX(${chapters.displayOrder}), 0)` })
        .from(chapters)
        .where(eq(chapters.courseId, body.courseId));

      const { language } = await this.localizationService.getLanguageByEntity(
        ENTITY_TYPE.COURSE,
        body.courseId,
      );

      const [chapter] = await trx
        .insert(chapters)
        .values({
          ...body,
          authorId,
          title: buildJsonbField(language, body.title),
          displayOrder: maxDisplayOrder.displayOrder + 1,
        })
        .returning();

      if (!chapter) throw new NotFoundException("Chapter not found");

      await this.adminChapterRepository.updateChapterCountForCourse(chapter.courseId, trx);

      return { id: chapter.id };
    });
  }

  async updateFreemiumStatus(chapterId: UUIDType, isFreemium: boolean) {
    return await this.adminChapterRepository.updateFreemiumStatus(chapterId, isFreemium);
  }

  async updateChapterDisplayOrder(chapterObject: {
    chapterId: UUIDType;
    displayOrder: number;
  }): Promise<void> {
    const { language } = await this.localizationService.getLanguageByEntity(
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

    await this.adminChapterRepository.changeChapterDisplayOrder(
      chapterToUpdate.courseId,
      chapterToUpdate.id,
      oldDisplayOrder,
      newDisplayOrder,
    );
  }

  async updateChapter(id: UUIDType, body: UpdateChapterBody) {
    const { availableLocales } = await this.localizationService.getLanguageByEntity(
      ENTITY_TYPE.CHAPTER,
      id,
      body.language,
    );

    if (!availableLocales.includes(body.language)) {
      throw new BadRequestException("This course does not support this language");
    }

    const [chapter] = await this.adminChapterRepository.updateChapter(id, body);

    if (!chapter) throw new NotFoundException("Chapter not found");
  }

  async removeChapter(chapterId: UUIDType) {
    const { language } = await this.localizationService.getLanguageByEntity(
      ENTITY_TYPE.CHAPTER,
      chapterId,
    );

    const [chapter] = await this.adminChapterRepository.getChapterById(chapterId, language);

    if (!chapter) throw new NotFoundException("Chapter not found");

    await this.db.transaction(async (trx) => {
      await this.adminChapterRepository.removeChapter(chapterId, trx);
      await this.adminChapterRepository.updateChapterDisplayOrder(chapter.courseId, trx);
      await this.adminChapterRepository.updateChapterCountForCourse(chapter.courseId, trx);
    });
  }
}
