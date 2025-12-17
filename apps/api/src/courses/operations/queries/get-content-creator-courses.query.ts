import { Injectable, forwardRef, Inject } from "@nestjs/common";
import { COURSE_ENROLLMENT } from "@repo/shared";
import { sql, eq, and, inArray, or, ne } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { COURSE_ENROLLMENT_SCOPES } from "src/courses/schemas/courseQuery";
import { FileService } from "src/file/file.service";
import { LocalizationService } from "src/localization/localization.service";
import { courses, categories, chapters, studentCourses, users } from "src/storage/schema";
import { UserService } from "src/user/user.service";

import type { SupportedLanguages } from "@repo/shared";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { UUIDType } from "src/common";
import type { AllCoursesForContentCreatorResponse } from "src/courses/schemas/course.schema";
import type { CourseEnrollmentScope } from "src/courses/schemas/courseQuery";
import type * as schema from "src/storage/schema";

@Injectable()
export class GetContentCreatorCoursesQuery {
	constructor(@Inject("DB") private readonly db: DatabasePg,private readonly fileService: FileService,
			@Inject(forwardRef(() => UserService)) private readonly userService: UserService,
			private readonly localizationService: LocalizationService,
		) {}
async getContentCreatorCourses({
		currentUserId,
		authorId,
		scope,
		excludeCourseId,
		title,
		description,
		searchQuery,
		language,
	}: {
		currentUserId: UUIDType;
		authorId: UUIDType;
		scope: CourseEnrollmentScope;
		excludeCourseId?: UUIDType;
		title?: string;
		description?: string;
		searchQuery?: string;
		language: SupportedLanguages;
	}): Promise<AllCoursesForContentCreatorResponse> {
		const conditions = [eq(courses.status, "published"), eq(courses.authorId, authorId)];

		if (scope === COURSE_ENROLLMENT_SCOPES.ENROLLED) {
			conditions.push(
				...[
					eq(studentCourses.studentId, currentUserId),
					eq(studentCourses.status, COURSE_ENROLLMENT.ENROLLED),
				],
			);
		}

		if (scope === COURSE_ENROLLMENT_SCOPES.AVAILABLE) {
			const availableCourseIds = await this.getAvailableCourseIds(
				this.db,
				currentUserId,
				authorId,
				excludeCourseId,
			);

			if (!availableCourseIds.length) return [];

			conditions.push(inArray(courses.id, availableCourseIds));
		}

		if (title) {
			conditions.push(
				sql`EXISTS (SELECT 1 FROM jsonb_each_text(${
					courses.title
				}) AS t(k, v) WHERE v ILIKE ${`%${title}%`})`,
			);
		}

		if (description) {
			conditions.push(
				sql`EXISTS (SELECT 1 FROM jsonb_each_text(${
					courses.description
				}) AS t(k, v) WHERE v ILIKE ${`%${description}%`})`,
			);
		}

		if (searchQuery) {
			const searchCondition = or(
				sql`EXISTS (SELECT 1 FROM jsonb_each_text(${
					courses.title
				}) AS t(k, v) WHERE v ILIKE ${`%${searchQuery}%`})`,
				sql`EXISTS (SELECT 1 FROM jsonb_each_text(${
					courses.title
				}) AS t(k, v) WHERE v ILIKE ${`%${searchQuery}%`})`,
			);

			if (searchCondition) {
				conditions.push(searchCondition);
			}
		}

		const contentCreatorCourses = await this.db
			.select({
				id: courses.id,
				description: this.localizationService.getLocalizedSqlField(courses.description, language),
				title: this.localizationService.getLocalizedSqlField(courses.title, language),
				thumbnailUrl: courses.thumbnailS3Key,
				authorId: sql<string>`${courses.authorId}`,
				author: sql<string>`CONCAT(${users.firstName} || ' ' || ${users.lastName})`,
				authorEmail: sql<string>`${users.email}`,
				authorAvatarUrl: sql<string>`${users.avatarReference}`,
				category: sql<string>`${categories.title}`,
				enrolled: sql<boolean>`CASE WHEN ${studentCourses.status} = ${COURSE_ENROLLMENT.ENROLLED} THEN true ELSE false END`,
				enrolledParticipantCount: sql<number>`0`,
				courseChapterCount: courses.chapterCount,
				completedChapterCount: sql<number>`0`,
				priceInCents: courses.priceInCents,
				currency: courses.currency,
				hasFreeChapters: sql<boolean>`
				EXISTS (
					SELECT 1
					FROM ${chapters}
					WHERE ${chapters.courseId} = ${courses.id}
						AND ${chapters.isFreemium} = true
				)`,
			})
			.from(courses)
			.leftJoin(
				studentCourses,
				and(eq(studentCourses.courseId, courses.id), eq(studentCourses.studentId, currentUserId)),
			)
			.leftJoin(categories, eq(courses.categoryId, categories.id))
			.leftJoin(users, eq(courses.authorId, users.id))
			.where(and(...conditions))
			.groupBy(
				courses.id,
				courses.title,
				courses.thumbnailS3Key,
				courses.description,
				courses.authorId,
				users.firstName,
				users.lastName,
				users.email,
				users.avatarReference,
				studentCourses.studentId,
				categories.title,
				courses.availableLocales,
				courses.baseLanguage,
				studentCourses.status,
			)
			.orderBy(
				sql<boolean>`CASE WHEN ${studentCourses.studentId} IS NULL THEN TRUE ELSE FALSE END`,
				courses.title,
			);

		return await Promise.all(
			contentCreatorCourses.map(async (course) => {
				const { authorAvatarUrl, ...courseWithoutReferences } = course;

				const authorAvatarSignedUrl =
					await this.userService.getUsersProfilePictureUrl(authorAvatarUrl);

				return {
					...courseWithoutReferences,
					thumbnailUrl: course.thumbnailUrl
						? await this.fileService.getFileUrl(course.thumbnailUrl)
						: course.thumbnailUrl,
					authorAvatarUrl: authorAvatarSignedUrl,
				};
			}),
		);
	}

	private async getAvailableCourseIds(
			trx: PostgresJsDatabase<typeof schema>,
			currentUserId?: UUIDType,
			authorId?: UUIDType,
			excludeCourseId?: UUIDType,
		) {
			const conditions = [];
	
			if (authorId) {
				conditions.push(eq(courses.authorId, authorId));
			}
	
			if (excludeCourseId) {
				conditions.push(ne(courses.id, excludeCourseId));
			}
	
			const availableCourses: Record<string, string>[] = await trx.execute(sql`
				SELECT ${courses.id} AS "courseId"
				FROM ${courses}
				WHERE ${conditions.length ? and(...conditions) : true} AND ${courses.id} NOT IN (
					SELECT DISTINCT ${studentCourses.courseId}
					FROM ${studentCourses}
					WHERE ${studentCourses.studentId} = ${currentUserId} AND ${studentCourses.status} = ${
						COURSE_ENROLLMENT.ENROLLED
					}
				)
			`);
	
			return availableCourses.map(({ courseId }) => courseId);
		}
}
