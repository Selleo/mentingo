import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { DB } from "src/storage/db/db.providers";
import { articles, chapters, courses, lessons, news } from "src/storage/schema";

import type { UUIDType } from "src/common";

const COURSE_UPLOAD_TARGET = { authorId: courses.authorId, originType: courses.originType };

@Injectable()
export class VideoUploadAuthorizationRepository {
  constructor(@Inject(DB) private readonly db: DatabasePg) {}

  async findCourseUploadTarget(courseId: UUIDType) {
    const [course] = await this.db
      .select(COURSE_UPLOAD_TARGET)
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);

    return course;
  }

  async findLessonCourseUploadTarget(lessonId: UUIDType) {
    const [course] = await this.db
      .select(COURSE_UPLOAD_TARGET)
      .from(lessons)
      .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
      .innerJoin(courses, eq(courses.id, chapters.courseId))
      .where(eq(lessons.id, lessonId))
      .limit(1);

    return course;
  }

  async findNewsAuthorId(newsId: UUIDType) {
    const [newsItem] = await this.db
      .select({ authorId: news.authorId })
      .from(news)
      .where(eq(news.id, newsId))
      .limit(1);

    return newsItem?.authorId;
  }

  async findArticleAuthorId(articleId: UUIDType) {
    const [article] = await this.db
      .select({ authorId: articles.authorId })
      .from(articles)
      .where(eq(articles.id, articleId))
      .limit(1);

    return article?.authorId;
  }
}
