import { forwardRef, Inject, Injectable } from "@nestjs/common";
import { eq, sql, and, countDistinct, like, between, count } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { getSortOptions } from "src/common/helpers/getSortOptions";
import { DEFAULT_PAGE_SIZE, addPagination } from "src/common/pagination";
import { FileService } from "src/file/file.service";
import { LocalizationService } from "src/localization/localization.service";
import { courses, users, categories, coursesSummaryStats, studentCourses } from "src/storage/schema";
import { USER_ROLES } from "src/user/schemas/userRoles";
import { UserService } from "src/user/user.service";

import { CourseSortFields } from "../../schemas/courseQuery";

import type { AllCoursesResponse } from "../../schemas/course.schema";
import type { CoursesQuery, CourseSortField, CoursesFilterSchema } from "../../schemas/courseQuery";
import type { Pagination } from "src/common";

@Injectable()
export class GetAllCoursesService {
	constructor(@Inject("DB") private readonly db: DatabasePg,private readonly fileService: FileService, private readonly localizationService: LocalizationService,
	@Inject(forwardRef(() => UserService)) private readonly userService: UserService,
) {}
	async getAllCourses(query: CoursesQuery): Promise<{
			data: AllCoursesResponse;
			pagination: Pagination;
		}> {
			const {
				filters = {},
				page = 1,
				perPage = DEFAULT_PAGE_SIZE,
				sort = CourseSortFields.title,
				currentUserId,
				currentUserRole,
				language,
			} = query;
	
			const { sortOrder, sortedField } = getSortOptions(sort);
	
			const conditions = this.getFiltersConditions(filters, false);
	
			if (currentUserRole === USER_ROLES.CONTENT_CREATOR && currentUserId) {
				conditions.push(eq(courses.authorId, currentUserId));
			}
	
			const queryDB = this.db
				.select({
					id: courses.id,
					title: this.localizationService.getLocalizedSqlField(courses.title, language),
					description: this.localizationService.getLocalizedSqlField(courses.description, language),
					thumbnailUrl: courses.thumbnailS3Key,
					author: sql<string>`CONCAT(${users.firstName} || ' ' || ${users.lastName})`,
					authorAvatarUrl: sql<string>`${users.avatarReference}`,
					category: sql<string>`${categories.title}`,
					enrolledParticipantCount: sql<number>`COALESCE(${coursesSummaryStats.freePurchasedCount} + ${coursesSummaryStats.paidPurchasedCount}, 0)`,
					courseChapterCount: courses.chapterCount,
					priceInCents: courses.priceInCents,
					currency: courses.currency,
					status: courses.status,
					createdAt: courses.createdAt,
					stripeProductId: courses.stripeProductId,
					stripePriceId: courses.stripePriceId,
				})
				.from(courses)
				.leftJoin(categories, eq(courses.categoryId, categories.id))
				.leftJoin(users, eq(courses.authorId, users.id))
				.leftJoin(coursesSummaryStats, eq(courses.id, coursesSummaryStats.courseId))
				.where(and(...conditions))
				.groupBy(
					courses.id,
					courses.title,
					courses.description,
					courses.thumbnailS3Key,
					users.firstName,
					users.lastName,
					users.avatarReference,
					categories.title,
					courses.priceInCents,
					courses.currency,
					courses.status,
					coursesSummaryStats.freePurchasedCount,
					coursesSummaryStats.paidPurchasedCount,
					courses.createdAt,
					courses.availableLocales,
					courses.baseLanguage,
				)
				.orderBy(sortOrder(this.getColumnToSortBy(sortedField as CourseSortField)));
	
			const dynamicQuery = queryDB.$dynamic();
			const paginatedQuery = addPagination(dynamicQuery, page, perPage);
			const data = await paginatedQuery;
	
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
	
			const [{ totalItems }] = await this.db
				.select({ totalItems: countDistinct(courses.id) })
				.from(courses)
				.leftJoin(categories, eq(courses.categoryId, categories.id))
				.leftJoin(users, eq(courses.authorId, users.id))
				.leftJoin(coursesSummaryStats, eq(courses.id, coursesSummaryStats.courseId))
				.where(and(...conditions));
	
			return {
				data: dataWithS3SignedUrls,
				pagination: {
					totalItems,
					page,
					perPage,
				},
			};
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
}
