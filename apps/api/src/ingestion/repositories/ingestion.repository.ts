import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { aiMentorLessons, chapters, courses, lessons } from "src/storage/schema";

import type { UUIDType } from "src/common";

@Injectable()
export class IngestionRepository {
  constructor(@Inject("DB") private readonly db: DatabasePg) {}

  async findAiMentorLessonFromLesson(id: UUIDType) {
    const [aiMentorLesson] = await this.db
      .select()
      .from(aiMentorLessons)
      .where(eq(aiMentorLessons.lessonId, id));

    return aiMentorLesson;
  }

  async findCourseAuthorByLesson(id: UUIDType) {
    const [author] = await this.db
      .select({ author: courses.authorId })
      .from(courses)
      .innerJoin(chapters, eq(courses.id, chapters.courseId))
      .innerJoin(lessons, eq(chapters.id, lessons.chapterId))
      .where(eq(lessons.id, id));

    return author;
  }
}
