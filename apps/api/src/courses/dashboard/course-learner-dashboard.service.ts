import { ForbiddenException, Injectable } from "@nestjs/common";
import {
  STUDENT_COURSE_URGENCY,
  type StudentCourseUrgency,
  type SupportedLanguages,
} from "@repo/shared";
import { addDays } from "date-fns";
import { match } from "ts-pattern";

import { CourseSlugService } from "../authoring/course-slug.service";
import { CourseMediaUrlService } from "../media/course-media-url.service";

import { CourseLearnerDashboardRepository } from "./course-learner-dashboard.repository";

import type { StudentCourseDashboardSummary } from "../schemas/studentDashboard.schema";
import type { UUIDType } from "src/common";

const DUE_SOON_WINDOW_DAYS = 7;

const getRequiredCourseUrgency = (
  dueDate: string | null,
  now: number,
  dueSoonBoundary: number,
): StudentCourseUrgency =>
  match(dueDate ? Date.parse(dueDate) : null)
    .with(null, () => STUDENT_COURSE_URGENCY.NO_DEADLINE)
    .when(
      (timestamp) => timestamp < now,
      () => STUDENT_COURSE_URGENCY.OVERDUE,
    )
    .when(
      (timestamp) => timestamp <= dueSoonBoundary,
      () => STUDENT_COURSE_URGENCY.DUE_SOON,
    )
    .otherwise(() => STUDENT_COURSE_URGENCY.SCHEDULED);

@Injectable()
export class CourseLearnerDashboardService {
  constructor(
    private readonly courseLearnerDashboardRepository: CourseLearnerDashboardRepository,
    private readonly courseSlugService: CourseSlugService,
    private readonly courseMediaUrlService: CourseMediaUrlService,
  ) {}

  async markCourseOpened(courseId: UUIDType, userId: UUIDType): Promise<void> {
    const updatedEnrollment =
      await this.courseLearnerDashboardRepository.updateEnrollmentLastOpenedAt(courseId, userId);

    if (!updatedEnrollment) throw new ForbiddenException("common.toast.courseAccessDenied");
  }

  /** Courses to continue, required courses with their urgency, and overall completion. */
  async getStudentDashboardSummary(
    userId: UUIDType,
    language: SupportedLanguages,
  ): Promise<StudentCourseDashboardSummary> {
    const continueCourses = await this.courseLearnerDashboardRepository.findContinueLearningCourses(
      userId,
      language,
    );
    const requiredCourses = await this.courseLearnerDashboardRepository.findRequiredCourses(
      userId,
      language,
    );
    const completion =
      await this.courseLearnerDashboardRepository.findCourseCompletionCounts(userId);

    const continueCourseIds = continueCourses.map((course) => course.courseId);
    const requiredCourseIds = requiredCourses.map((course) => course.courseId);
    const courseIds = [...new Set([...continueCourseIds, ...requiredCourseIds])];
    const slugs = await this.courseSlugService.getCoursesSlugs(language, courseIds);

    const nextLessons = await this.courseLearnerDashboardRepository.findNextLessons(
      continueCourseIds,
      userId,
      language,
    );
    const nextLessonByCourse = new Map(
      nextLessons.map(({ courseId, id, title }) => [courseId, { id, title }] as const),
    );

    const continueLearningCourses = await Promise.all(
      continueCourses.map(async (course) => ({
        courseId: course.courseId,
        slug: slugs.get(course.courseId) ?? course.courseId,
        title: course.title,
        thumbnailUrl: await this.signThumbnail(course.thumbnailS3Key),
        completedChapterCount: course.completedChapterCount,
        courseChapterCount: course.courseChapterCount,
        lesson: nextLessonByCourse.get(course.courseId) ?? null,
      })),
    );

    const now = Date.now();
    const dueSoonBoundary = addDays(new Date(now), DUE_SOON_WINDOW_DAYS).getTime();
    const requiredDashboardCourses = await Promise.all(
      requiredCourses.map(async (course) => ({
        courseId: course.courseId,
        slug: slugs.get(course.courseId) ?? course.courseId,
        title: course.title,
        thumbnailUrl: await this.signThumbnail(course.thumbnailS3Key),
        dueDate: course.dueDate,
        urgency: getRequiredCourseUrgency(course.dueDate, now, dueSoonBoundary),
      })),
    );

    const total = completion?.total ?? 0;
    const completed = completion?.completed ?? 0;

    return {
      continueLearningCourses,
      requiredCourses: requiredDashboardCourses,
      completion: {
        total,
        completed,
        inProgress: completion?.inProgress ?? 0,
        notStarted: completion?.notStarted ?? 0,
        percentage: total ? Math.round((completed / total) * 100) : 0,
      },
    };
  }

  private async signThumbnail(thumbnailS3Key: string | null) {
    if (!thumbnailS3Key) return null;

    return this.courseMediaUrlService.getSignedCourseThumbnailUrl(thumbnailS3Key);
  }
}
