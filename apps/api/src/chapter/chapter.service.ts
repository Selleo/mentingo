import { Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";

import { LessonRepository } from "src/lesson/repositories/lesson.repository";
import { LocalizationService } from "src/localization/localization.service";
import { ENTITY_TYPE } from "src/localization/localization.types";

import { ChapterRepository } from "./repositories/chapter.repository";

import type { SupportedLanguages } from "@repo/shared";
import type { ChapterResponse } from "src/chapter/schemas/chapter.schema";
import type { UUIDType } from "src/common";

@Injectable()
export class ChapterService {
  constructor(
    private readonly chapterRepository: ChapterRepository,
    private readonly lessonRepository: LessonRepository,
    private readonly localizationService: LocalizationService,
  ) {}

  async getChapterWithLessons(
    id: UUIDType,
    userId: UUIDType,
    language: SupportedLanguages,
    isAdmin?: boolean,
  ): Promise<ChapterResponse> {
    const { language: actualLanguage } = await this.localizationService.getLanguageByEntity(
      ENTITY_TYPE.CHAPTER,
      id,
      language,
    );

    const [courseAccess] = await this.chapterRepository.checkChapterAssignment(id, userId);
    const chapter = await this.chapterRepository.getChapterForUser(id, userId, actualLanguage);

    if (!isAdmin && !courseAccess && !chapter.isFreemium)
      throw new UnauthorizedException("You don't have access to this lesson");

    if (!chapter) throw new NotFoundException("Chapter not found");

    const chapterLessonList = await this.lessonRepository.getLessonsByChapterId(id, actualLanguage);

    return { ...chapter, lessons: chapterLessonList };
  }
}
