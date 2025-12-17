import { isNull } from "util";

import { forwardRef, Inject, Injectable } from "@nestjs/common";
import { COURSE_ENROLLMENT } from "@repo/shared";
import { eq, or, and, countDistinct, between, count, like, sql } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { getSortOptions } from "src/common/helpers/getSortOptions";
import { DEFAULT_PAGE_SIZE, addPagination } from "src/common/pagination";
import { CourseSortFields } from "src/courses/schemas/courseQuery";
import { FileService } from "src/file/file.service";
import { LocalizationService } from "src/localization/localization.service";
import { studentCourses, courses, users, categories, coursesSummaryStats, chapters } from "src/storage/schema";
import { UserService } from "src/user/user.service";

import type { SupportedLanguages } from "@repo/shared";
import type { UUIDType, Pagination } from "src/common";
import type { AllStudentCoursesResponse } from "src/courses/schemas/course.schema";
import type { CoursesQuery, CourseSortField, CoursesFilterSchema } from "src/courses/schemas/courseQuery";

@Injectable()
export class GetCoursesForUserService {
	constructor(@Inject("DB") private readonly db: DatabasePg,private readonly fileService: FileService,
		@Inject(forwardRef(() => UserService)) private readonly userService: UserService,
		private readonly localizationService: LocalizationService,
	) {}
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
				 .where(and(...conditions.filter(Boolean) as any))
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
				 .where(and(...conditions.filter(Boolean) as any));
 
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
	 private getFiltersConditions(filters: CoursesFilterSchema, publishedOnly = true) {
			 const conditions = [];
	 
			 if (filters.title) {
				 conditions.push(
					 sql`EXISTS (SELECT 1 FROM jsonb_each_text(${
						 courses.title
					 }) AS t(k, v) WHERE v ILIKE ${`%${filters.title}%`})`,
				 );
			 }
	 
			 if (filters.description) {
				 conditions.push(
					 sql`EXISTS (SELECT 1 FROM jsonb_each_text(${
						 courses.description
					 }) AS t(k, v) WHERE v ILIKE ${`%${filters.description}%`})`,
				 );
			 }
	 
			 if (filters.searchQuery) {
				 conditions.push(
					 sql`EXISTS (SELECT 1 FROM jsonb_each_text(${
						 courses.title
					 }) AS t(k, v) WHERE v ILIKE ${`%${filters.searchQuery}%`}) OR EXISTS (SELECT 1 FROM jsonb_each_text(${
						 courses.description
					 }) AS t(k, v) WHERE v ILIKE ${`%${filters.searchQuery}%`})`,
				 );
			 }
	 
			 if (filters.category) {
				 conditions.push(like(categories.title, `%${filters.category}%`));
			 }
			 if (filters.author) {
				 const authorNameConcat = sql`CONCAT(${users.firstName}, ' ' , ${users.lastName})`;
				 conditions.push(sql`${authorNameConcat} LIKE ${`%${filters.author}%`}`);
			 }
			 if (filters.creationDateRange) {
				 const [startDate, endDate] = filters.creationDateRange;
				 const start = new Date(startDate).toISOString();
				 const end = new Date(endDate).toISOString();
	 
				 conditions.push(between(courses.createdAt, start, end));
			 }
			 if (filters.status) {
				 conditions.push(eq(courses.status, filters.status));
			 }
	 
			 if (publishedOnly) {
				 conditions.push(eq(courses.status, "published"));
			 }
	 
			 return conditions ?? undefined;
		 }

		 private getColumnToSortBy(sort: CourseSortField) {
				 switch (sort) {
					 case CourseSortFields.author:
						 return sql<string>`CONCAT(${users.firstName} || ' ' || ${users.lastName})`;
					 case CourseSortFields.category:
						 return categories.title;
					 case CourseSortFields.creationDate:
						 return courses.createdAt;
					 case CourseSortFields.chapterCount:
						 return count(studentCourses.courseId);
					 case CourseSortFields.enrolledParticipantsCount:
						 return count(studentCourses.courseId);
					 default:
						 return courses.title;
				 }
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
