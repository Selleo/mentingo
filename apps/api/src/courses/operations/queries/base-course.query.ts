import { between, count, eq, like, sql } from "drizzle-orm";

import { categories, courses, studentCourses, users } from "src/storage/schema";

import { CourseSortFields } from "../../schemas/courseQuery";

import type { CourseSortField, CoursesFilterSchema } from "../../schemas/courseQuery";
import type { SQL } from "drizzle-orm";

export abstract class BaseCourseQuery {
	protected getFiltersConditions(filters: CoursesFilterSchema, publishedOnly = true): SQL<unknown>[] {
		const conditions: SQL<unknown>[] = [];

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

		return conditions;
	}

	protected getColumnToSortBy(sort: CourseSortField) {
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
