import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  COURSE_FEATURE_ERROR_TRANSLATION_KEY,
  isCourseFeatureEnabledForCourseType,
} from "@repo/shared";
import { eq } from "drizzle-orm";

import { DatabasePg, type UUIDType } from "src/common";
import { chapters, courses, lessons } from "src/storage/schema";

import type { CourseFeature, CourseType } from "@repo/shared";

@Injectable()
export class CourseFeaturePolicyService {
  constructor(@Inject("DB") private readonly db: DatabasePg) {}

  assertFeatureEnabled(courseType: CourseType, feature: CourseFeature) {
    if (isCourseFeatureEnabledForCourseType(courseType, feature)) return;

    throw new BadRequestException(COURSE_FEATURE_ERROR_TRANSLATION_KEY[feature]);
  }

  async assertCourseFeatureEnabled(courseId: UUIDType, feature: CourseFeature) {
    const [course] = await this.db
      .select({ courseType: courses.courseType })
      .from(courses)
      .where(eq(courses.id, courseId));

    if (!course) throw new NotFoundException("adminCourseView.errors.notFound.course");

    this.assertFeatureEnabled(course.courseType, feature);
  }

  async assertCourseFeatureEnabledByChapterId(chapterId: UUIDType, feature: CourseFeature) {
    const [course] = await this.db
      .select({ courseType: courses.courseType })
      .from(chapters)
      .innerJoin(courses, eq(courses.id, chapters.courseId))
      .where(eq(chapters.id, chapterId));

    if (!course) throw new NotFoundException("adminCourseView.errors.notFound.chapter");

    this.assertFeatureEnabled(course.courseType, feature);
  }

  async assertCourseFeatureEnabledByLessonId(lessonId: UUIDType, feature: CourseFeature) {
    const [course] = await this.db
      .select({ courseType: courses.courseType })
      .from(lessons)
      .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
      .innerJoin(courses, eq(courses.id, chapters.courseId))
      .where(eq(lessons.id, lessonId));

    if (!course) throw new NotFoundException("adminCourseView.errors.notFound.lesson");

    this.assertFeatureEnabled(course.courseType, feature);
  }
}
