import { Inject, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { EventBus } from "@nestjs/cqrs";

import { DatabasePg } from "src/common";
import { LessonRepository } from "src/lesson/repositories/lesson.repository";

import { ChapterRepository } from "./repositories/chapter.repository";

import type { ChapterResponse } from "src/chapter/schemas/chapter.schema";
import type { UUIDType } from "src/common";

@Injectable()
export class ChapterService {
  constructor(
    @Inject("DB") private readonly db: DatabasePg,
    private readonly chapterRepository: ChapterRepository,
    private readonly lessonRepository: LessonRepository,
    private readonly eventBus: EventBus,
  ) {}

  async getChapterWithLessons(
    id: UUIDType,
    userId: UUIDType,
    isAdmin?: boolean,
  ): Promise<ChapterResponse> {
    const [courseAccess] = await this.chapterRepository.checkChapterAssignment(id, userId);
    const chapter = await this.chapterRepository.getChapterForUser(id, userId);

    if (!isAdmin && !courseAccess && !chapter.isFreemium)
      throw new UnauthorizedException("You don't have access to this lesson");

    if (!chapter) throw new NotFoundException("Chapter not found");

    const chapterLessonList = await this.lessonRepository.getLessonsByChapterId(id);

    return { ...chapter, lessons: chapterLessonList };
  }
}
