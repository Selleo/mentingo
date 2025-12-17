import { Injectable, NotFoundException, ForbiddenException, forwardRef, Inject } from "@nestjs/common";
import { COURSE_ENROLLMENT } from "@repo/shared";
import { sql, eq, and, isNotNull } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { FileService } from "src/file/file.service";
import { LESSON_TYPES } from "src/lesson/lesson.type";
import { LocalizationService } from "src/localization/localization.service";
import { courses, categories, studentCourses, chapters, studentChapterProgress, lessons, studentLessonProgress, questions } from "src/storage/schema";
import { UserService } from "src/user/user.service";
import { PROGRESS_STATUSES } from "src/utils/types/progress.type";

import type { SupportedLanguages } from "@repo/shared";
import type { UUIDType } from "src/common";
import type { CommonShowCourse } from "src/courses/schemas/showCourseCommon.schema";
import type { LessonForChapterSchema } from "src/lesson/lesson.schema";
import type { ProgressStatus } from "src/utils/types/progress.type";


@Injectable()
export class GetCourseQuery {
	constructor(@Inject("DB") private readonly db: DatabasePg,private readonly fileService: FileService,
			@Inject(forwardRef(() => UserService)) private readonly userService: UserService,
			private readonly localizationService: LocalizationService,
		) {}
 	async getCourse(
		 id: UUIDType,
		 userId: UUIDType,
		 language: SupportedLanguages,
	 ): Promise<CommonShowCourse> {
		 //TODO: to remove
		 const testDeployment = "test";
		 testDeployment;
 
		 const [course] = await this.db
			 .select({
				 id: courses.id,
				 title: this.localizationService.getLocalizedSqlField(courses.title, language),
				 thumbnailS3Key: sql<string>`${courses.thumbnailS3Key}`,
				 category: sql<string>`${categories.title}`,
				 description: this.localizationService.getLocalizedSqlField(courses.description, language),
				 courseChapterCount: courses.chapterCount,
				 completedChapterCount: sql<number>`CASE WHEN ${studentCourses.status} = ${COURSE_ENROLLMENT.ENROLLED} THEN COALESCE(${studentCourses.finishedChapterCount}, 0) ELSE 0 END`,
				 enrolled: sql<boolean>`CASE WHEN ${studentCourses.status} = ${COURSE_ENROLLMENT.ENROLLED} THEN TRUE ELSE FALSE END`,
				 status: courses.status,
				 isScorm: courses.isScorm,
				 priceInCents: courses.priceInCents,
				 currency: courses.currency,
				 authorId: courses.authorId,
				 hasCertificate: courses.hasCertificate,
				 hasFreeChapter: sql<boolean>`
					 EXISTS (
						 SELECT 1
						 FROM ${chapters}
						 WHERE ${chapters.courseId} = ${courses.id}
							 AND ${chapters.isFreemium} = TRUE
					 )`,
				 stripeProductId: courses.stripeProductId,
				 stripePriceId: courses.stripePriceId,
				 availableLocales: sql<SupportedLanguages[]>`${courses.availableLocales}`,
				 baseLanguage: sql<SupportedLanguages>`${courses.baseLanguage}`,
			 })
			 .from(courses)
			 .leftJoin(categories, eq(courses.categoryId, categories.id))
			 .leftJoin(
				 studentCourses,
				 and(eq(courses.id, studentCourses.courseId), eq(studentCourses.studentId, userId)),
			 )
			 .where(eq(courses.id, id));
 
		 const isEnrolled = !!course.enrolled;
		 const NON_PUBLIC_STATUSES = ["draft", "private"];
 
		 if (!course) throw new NotFoundException("Course not found");
		 if (userId !== course.authorId && NON_PUBLIC_STATUSES.includes(course.status) && !isEnrolled)
			 throw new ForbiddenException("You have no access to this course");
 
		 const courseChapterList = await this.db
			 .select({
				 id: chapters.id,
				 title: this.localizationService.getLocalizedSqlField(chapters.title, language),
				 isSubmitted: sql<boolean>`
					 EXISTS (
						 SELECT 1
						 FROM ${studentChapterProgress}
						 JOIN ${studentCourses} ON ${studentCourses.courseId} = ${course.id} AND ${studentCourses.studentId} = ${studentChapterProgress.studentId} 
						 WHERE ${studentChapterProgress.chapterId} = ${chapters.id}
							 AND ${studentChapterProgress.courseId} = ${course.id}
							 AND ${studentChapterProgress.studentId} = ${userId}
							 AND ${studentChapterProgress.completedAt} IS NOT NULL
							 AND ${studentCourses.status} = ${COURSE_ENROLLMENT.ENROLLED}
					 )::BOOLEAN`,
				 lessonCount: chapters.lessonCount,
				 quizCount: sql<number>`
					 (SELECT COUNT(*)
					 FROM ${lessons}
					 WHERE ${lessons.chapterId} = ${chapters.id}
						 AND ${lessons.type} = ${LESSON_TYPES.QUIZ})::INTEGER`,
				 completedLessonCount: sql<number>`CASE WHEN ${studentCourses.status} = ${COURSE_ENROLLMENT.ENROLLED} THEN COALESCE(${studentChapterProgress.completedLessonCount}, 0) ELSE 0 END`,
				 chapterProgress: sql<ProgressStatus>`
					 CASE
						 WHEN ${studentCourses.status} = ${COURSE_ENROLLMENT.NOT_ENROLLED} THEN ${PROGRESS_STATUSES.NOT_STARTED}
						 WHEN ${studentChapterProgress.completedAt} IS NOT NULL THEN ${PROGRESS_STATUSES.COMPLETED}
						 WHEN ${studentChapterProgress.completedLessonCount} > 0 OR EXISTS (
							 SELECT 1
							 FROM ${studentLessonProgress}
							 WHERE ${studentLessonProgress.chapterId} = ${chapters.id}
								 AND ${studentLessonProgress.studentId} = ${userId}
								 AND ${studentLessonProgress.isStarted} = TRUE
						 ) THEN ${PROGRESS_STATUSES.IN_PROGRESS}
						 ELSE ${PROGRESS_STATUSES.NOT_STARTED}
					 END
				 `,
				 isFreemium: chapters.isFreemium,
				 displayOrder: sql<number>`${chapters.displayOrder}`,
				 lessons: sql<LessonForChapterSchema>`
					 COALESCE(
						 (
							 SELECT json_agg(lesson_data)
							 FROM (
								 SELECT
									 ${lessons.id} AS id,
									 ${this.localizationService.getLocalizedSqlField(
										 lessons.title,
										 language,
									 )} AS title,
									 ${lessons.type} AS type,
									 ${lessons.displayOrder} AS "displayOrder",
									 ${lessons.isExternal} AS "isExternal",
									 CASE
										 WHEN (${chapters.isFreemium} = FALSE AND ${isEnrolled} = FALSE) THEN ${
											 PROGRESS_STATUSES.BLOCKED
										 }
										 WHEN ${studentLessonProgress.completedAt} IS NOT NULL AND (${
											 studentLessonProgress.isQuizPassed
										 } IS TRUE OR ${studentLessonProgress.isQuizPassed} IS NULL) THEN ${
											 PROGRESS_STATUSES.COMPLETED
										 }
										 WHEN ${studentLessonProgress.isStarted} THEN  ${PROGRESS_STATUSES.IN_PROGRESS}
										 ELSE  ${PROGRESS_STATUSES.NOT_STARTED}
									 END AS status,
									 CASE
										 WHEN ${lessons.type} = ${LESSON_TYPES.QUIZ} THEN COUNT(${questions.id})
										 ELSE NULL
									 END AS "quizQuestionCount"
								 FROM ${lessons}
								 LEFT JOIN ${studentLessonProgress} ON ${lessons.id} = ${
									 studentLessonProgress.lessonId
								 }
									 AND ${studentLessonProgress.studentId} = ${userId}
								 LEFT JOIN ${questions} ON ${lessons.id} = ${questions.lessonId}
								 LEFT JOIN ${courses} ON ${courses.id} = ${chapters.courseId}
								 WHERE ${lessons.chapterId} = ${chapters.id}
								 GROUP BY
									 ${lessons.id},
									 ${lessons.type},
									 ${lessons.displayOrder},
									 ${lessons.title},
									 ${studentLessonProgress.completedAt},
									 ${studentLessonProgress.completedQuestionCount},
									 ${studentLessonProgress.isStarted},
									 ${chapters.isFreemium},
									 ${studentLessonProgress.isQuizPassed},
									 ${courses.availableLocales},
									 ${courses.baseLanguage}
								 ORDER BY ${lessons.displayOrder}
							 ) AS lesson_data
						 ),
						 '[]'::json
					 )
				 `,
			 })
			 .from(chapters)
			 .leftJoin(
				 studentChapterProgress,
				 and(
					 eq(studentChapterProgress.chapterId, chapters.id),
					 eq(studentChapterProgress.studentId, userId),
				 ),
			 )
			 .leftJoin(
				 studentCourses,
				 and(eq(studentCourses.courseId, course.id), eq(studentCourses.studentId, userId)),
			 )
			 .innerJoin(courses, eq(courses.id, chapters.courseId))
			 .where(and(eq(chapters.courseId, id), isNotNull(chapters.title)))
			 .orderBy(chapters.displayOrder);
 
		 const thumbnailUrl = await this.fileService.getFileUrl(course.thumbnailS3Key);
 
		 return {
			 ...course,
			 thumbnailUrl,
			 chapters: courseChapterList,
		 };
	 }   
}
