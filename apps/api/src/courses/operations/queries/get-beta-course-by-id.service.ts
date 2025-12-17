import { Injectable, NotFoundException, ForbiddenException, forwardRef, Inject } from "@nestjs/common";
import { sql, eq, and, isNotNull } from "drizzle-orm";

import { AdminChapterRepository } from "src/chapter/repositories/adminChapter.repository";
import { DatabasePg } from "src/common";
import { FileService } from "src/file/file.service";
import { LESSON_TYPES } from "src/lesson/lesson.type";
import { LocalizationService } from "src/localization/localization.service";
import { courses, categories, chapters, lessons } from "src/storage/schema";
import { USER_ROLES } from "src/user/schemas/userRoles";
import { UserService } from "src/user/user.service";

import type { SupportedLanguages } from "@repo/shared";
import type { UUIDType } from "src/common";
import type { AdminLessonWithContentSchema, LessonForChapterSchema } from "src/lesson/lesson.schema";
import type { UserRole } from "src/user/schemas/userRoles";


@Injectable()
export class GetBetaCourseByIdService {
	constructor(@Inject("DB") private readonly db: DatabasePg,private readonly fileService: FileService,
			@Inject(forwardRef(() => UserService)) private readonly userService: UserService,
			private readonly localizationService: LocalizationService,
			private readonly adminChapterRepository: AdminChapterRepository,
		) {}
async getBetaCourseById(
		id: UUIDType,
		language: SupportedLanguages,
		currentUserId: UUIDType,
		currentUserRole: UserRole,
	) {
		const [course] = await this.db
			.select({
				id: courses.id,
				title: this.localizationService.getFieldByLanguage(courses.title, language),
				thumbnailS3Key: sql<string>`COALESCE(${courses.thumbnailS3Key}, '')`,
				category: categories.title,
				categoryId: categories.id,
				description: this.localizationService.getFieldByLanguage(courses.description, language),
				courseChapterCount: courses.chapterCount,
				status: courses.status,
				priceInCents: courses.priceInCents,
				currency: courses.currency,
				authorId: courses.authorId,
				hasCertificate: courses.hasCertificate,
				availableLocales: sql<SupportedLanguages[]>`${courses.availableLocales}`,
				baseLanguage: sql<SupportedLanguages>`${courses.baseLanguage}`,
			})
			.from(courses)
			.innerJoin(categories, eq(courses.categoryId, categories.id))
			.where(and(eq(courses.id, id)));

		if (!course) throw new NotFoundException("Course not found");

		if (currentUserRole !== USER_ROLES.ADMIN && course.authorId !== currentUserId) {
			throw new ForbiddenException("You do not have permission to edit this course");
		}

		const courseChapterList = await this.db
			.select({
				id: chapters.id,
				title: this.localizationService.getFieldByLanguage(chapters.title, language),
				displayOrder: sql<number>`${chapters.displayOrder}`,
				lessonCount: chapters.lessonCount,
				updatedAt: chapters.updatedAt,
				isFree: chapters.isFreemium,
				lessons: sql<LessonForChapterSchema>`
					COALESCE(
						(
							SELECT array_agg(${lessons.id} ORDER BY ${lessons.displayOrder})
							FROM ${lessons}
							WHERE ${lessons.chapterId} = ${chapters.id}
						),
						'{}'
					)
				`,
			})
			.from(chapters)
			.innerJoin(courses, eq(courses.id, chapters.courseId))
			.where(and(eq(chapters.courseId, id), isNotNull(chapters.title)))
			.orderBy(chapters.displayOrder);

		const thumbnailS3SingedUrl = course.thumbnailS3Key
			? await this.fileService.getFileUrl(course.thumbnailS3Key)
			: null;

		const updatedCourseLessonList = await Promise.all(
			courseChapterList?.map(async (chapter) => {
				const lessons: AdminLessonWithContentSchema[] =
					await this.adminChapterRepository.getBetaChapterLessons(chapter.id, language);

				const lessonsWithSignedUrls = await this.addS3SignedUrlsToLessonsAndQuestions(lessons);

				return {
					...chapter,
					lessons: lessonsWithSignedUrls,
				};
			}),
		);

		return {
			...course,
			thumbnailS3SingedUrl,
			chapters: updatedCourseLessonList ?? [],
		};
	}

	private async addS3SignedUrlsToLessonsAndQuestions(lessons: AdminLessonWithContentSchema[]) {
			return await Promise.all(
				lessons.map(async (lesson) => {
					const updatedLesson = { ...lesson };
					if (
						lesson.fileS3Key &&
						(lesson.type === LESSON_TYPES.VIDEO || lesson.type === LESSON_TYPES.PRESENTATION)
					) {
						if (!lesson.fileS3Key.startsWith("https://")) {
							try {
								const signedUrl = await this.fileService.getFileUrl(lesson.fileS3Key);
								return { ...updatedLesson, fileS3SignedUrl: signedUrl };
							} catch (error) {
								console.error(`Failed to get signed URL for ${lesson.fileS3Key}:`, error);
							}
						}
					}
	
					if (lesson.type === LESSON_TYPES.AI_MENTOR && lesson.aiMentor?.avatarReference) {
						const signedUrl = await this.fileService.getFileUrl(lesson.aiMentor.avatarReference);
	
						return { ...updatedLesson, avatarReferenceUrl: signedUrl };
					}
	
					if (lesson.questions && Array.isArray(lesson.questions)) {
						updatedLesson.questions = await Promise.all(
							lesson.questions.map(async (question) => {
								if (question.photoS3Key) {
									if (!question.photoS3Key.startsWith("https://")) {
										try {
											const signedUrl = await this.fileService.getFileUrl(question.photoS3Key);
											return { ...question, photoS3SingedUrl: signedUrl };
										} catch (error) {
											console.error(
												`Failed to get signed URL for question thumbnail ${question.photoS3Key}:`,
												error,
											);
										}
									}
								}
								return question;
							}),
						);
					}
	
					return updatedLesson;
				}),
			);
		}
}
