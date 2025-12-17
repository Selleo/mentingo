import { isNull } from "util";

import { forwardRef, Inject, Injectable } from "@nestjs/common";
import { COURSE_ENROLLMENT } from "@repo/shared";
import { eq, or, and, countDistinct, sql } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { getSortOptions } from "src/common/helpers/getSortOptions";
import { DEFAULT_PAGE_SIZE, addPagination } from "src/common/pagination";
import { CourseSortFields } from "src/courses/schemas/courseQuery";
import { FileService } from "src/file/file.service";
import { LocalizationService } from "src/localization/localization.service";
import { studentCourses, courses, users, categories, coursesSummaryStats, chapters } from "src/storage/schema";
import { UserService } from "src/user/user.service";

import { BaseCourseQueryService } from "./base-course-query.service";

import type { SupportedLanguages } from "@repo/shared";
import type { SQLWrapper } from "drizzle-orm";
import type { UUIDType, Pagination } from "src/common";
import type { AllStudentCoursesResponse } from "src/courses/schemas/course.schema";
import type { CoursesQuery, CourseSortField } from "src/courses/schemas/courseQuery";

@Injectable()
export class GetCoursesForUserService extends BaseCourseQueryService {
	constructor(@Inject("DB") private readonly db: DatabasePg,private readonly fileService: FileService,
		@Inject(forwardRef(() => UserService)) private readonly userService: UserService,
		private readonly localizationService: LocalizationService,
	) {
		super();
	}
 async getCoursesForUser(
		 query: CoursesQuery,
		 userId: UUIDType,
	 ): Promise<{ data: AllStudentCoursesResponse; pagination: Pagination }> {
		 const {
			 sort = CourseSortFields.title,
			 perPage = DEFAULT_PAGE_SIZE,
			 page = 1,
			 filters = {},
			 language,
		 } = query;
 
		 const { sortOrder, sortedField } = getSortOptions(sort);
 
		 return this.db.transaction(async (trx) => {
			 const conditions = [
				 eq(studentCourses.studentId, userId),
				 eq(studentCourses.status, COURSE_ENROLLMENT.ENROLLED),
				 or(eq(courses.status, "published"), eq(courses.status, "private")),
				 isNull(users.deletedAt),
			 ];
			 conditions.push(...this.getFiltersConditions(filters, false));
 
			 const queryDB = trx
				 .select(this.getSelectField(language))
				 .from(studentCourses)
				 .innerJoin(courses, eq(studentCourses.courseId, courses.id))
				 .innerJoin(categories, eq(courses.categoryId, categories.id))
				 .leftJoin(users, eq(courses.authorId, users.id))
				 .leftJoin(coursesSummaryStats, eq(courses.id, coursesSummaryStats.courseId))
				 .where(and(...conditions as SQLWrapper[]))
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
					 coursesSummaryStats.freePurchasedCount,
					 coursesSummaryStats.paidPurchasedCount,
					 studentCourses.finishedChapterCount,
					 courses.availableLocales,
					 courses.baseLanguage,
				 )
				 .orderBy(sortOrder(this.getColumnToSortBy(sortedField as CourseSortField)));
 
			 const dynamicQuery = queryDB.$dynamic();
			 const paginatedQuery = addPagination(dynamicQuery, page, perPage);
			 const data = await paginatedQuery;
			 const [{ totalItems }] = await trx
				 .select({ totalItems: countDistinct(courses.id) })
				 .from(studentCourses)
				 .innerJoin(courses, eq(studentCourses.courseId, courses.id))
				 .innerJoin(categories, eq(courses.categoryId, categories.id))
				 .leftJoin(users, eq(courses.authorId, users.id))
				 .where(and(...conditions as SQLWrapper[]));
 
			 const dataWithS3SignedUrls = await Promise.all(
				 data.map(async (item) => {
					 if (!item.thumbnailUrl) return item;
 
					 try {
						 const signedUrl = await this.fileService.getFileUrl(item.thumbnailUrl);
						 const authorAvatarSignedUrl = await this.userService.getUsersProfilePictureUrl(
							 item.authorAvatarUrl,
						 );
						 return { ...item, thumbnailUrl: signedUrl, authorAvatarUrl: authorAvatarSignedUrl };
					 } catch (error) {
						 console.error(`Failed to get signed URL for ${item.thumbnailUrl}:`, error);
						 return item;
					 }
				 }),
			 );
 
			 return {
				 data: dataWithS3SignedUrls,
				 pagination: {
					 totalItems: totalItems || 0,
					 page,
					 perPage,
				 },
			 };
		 });
	 }

			 private getSelectField(language: SupportedLanguages) {
					 return {
						 id: courses.id,
						 title: this.localizationService.getLocalizedSqlField(courses.title, language),
						 description: this.localizationService.getLocalizedSqlField(courses.description, language),
						 thumbnailUrl: courses.thumbnailS3Key,
						 authorId: sql<string>`${courses.authorId}`,
						 author: sql<string>`CONCAT(${users.firstName} || ' ' || ${users.lastName})`,
						 authorEmail: sql<string>`${users.email}`,
						 authorAvatarUrl: sql<string>`${users.avatarReference}`,
						 category: sql<string>`${categories.title}`,
						 enrolled: sql<boolean>`CASE WHEN ${studentCourses.studentId} IS NOT NULL THEN TRUE ELSE FALSE END`,
						 enrolledParticipantCount: sql<number>`COALESCE(${coursesSummaryStats.freePurchasedCount} + ${coursesSummaryStats.paidPurchasedCount}, 0)`,
						 courseChapterCount: courses.chapterCount,
						 completedChapterCount: sql<number>`COALESCE(${studentCourses.finishedChapterCount}, 0)`,
						 priceInCents: courses.priceInCents,
						 currency: courses.currency,
						 hasFreeChapter: sql<boolean>`
							 EXISTS (
								 SELECT 1
								 FROM ${chapters}
								 WHERE ${chapters.courseId} = ${courses.id}
									 AND ${chapters.isFreemium} = TRUE
							 )`,
					 };
				 }
}
