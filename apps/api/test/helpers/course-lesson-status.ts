import request from "supertest";

import type { INestApplication } from "@nestjs/common";
import type { UUIDType } from "src/common";
import type { CommonShowCourse } from "src/courses/schemas/showCourseCommon.schema";

/** The learner-facing status of one lesson, as `GET /api/course` reports it to that learner. */
export const getCourseLessonStatus = async (
  app: INestApplication,
  cookies: string,
  courseId: UUIDType,
  lessonId: UUIDType,
) => {
  const response = await request(app.getHttpServer())
    .get(`/api/course?id=${courseId}&language=en`)
    .set("Cookie", cookies)
    .expect(200);
  const course: CommonShowCourse = response.body.data;

  const lesson = course.chapters
    .flatMap(({ lessons }) => lessons)
    .find(({ id }) => id === lessonId);

  return lesson?.status;
};
