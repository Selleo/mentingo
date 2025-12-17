import { isNull } from "util";

import { Inject, Injectable } from "@nestjs/common";
import { COURSE_ENROLLMENT } from "@repo/shared";
import { or, ilike, sql, and, eq } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { getGroupFilterConditions } from "src/common/helpers/getGroupFilterConditions";
import { getSortOptions } from "src/common/helpers/getSortOptions";
import { EnrolledStudentSortFields } from "src/courses/schemas/courseQuery";
import { users, studentCourses, groups, groupUsers } from "src/storage/schema";
import { USER_ROLES } from "src/user/schemas/userRoles";

import type { SQLWrapper } from "drizzle-orm";
import type { UUIDType, BaseResponse } from "src/common";
import type { EnrolledStudentFilterSchema } from "src/courses/schemas/courseQuery";
import type { EnrolledStudent } from "src/courses/schemas/enrolledStudent.schema";


@Injectable()
export class GetStudentsWithEnrollmentDateService {
	constructor(@Inject("DB") private readonly db: DatabasePg,
	) {}
	async getStudentsWithEnrollmentDate(
			courseId: UUIDType,
			filters: EnrolledStudentFilterSchema,
		): Promise<BaseResponse<EnrolledStudent[]>> {
			const { keyword, sort = EnrolledStudentSortFields.enrolledAt } = filters;
	
			const { sortOrder } = getSortOptions(sort);
	
			const conditions = [];
	
			if (keyword) {
				const searchKeyword = keyword.toLowerCase();
	
				conditions.push(
					or(
						ilike(users.firstName, `%${searchKeyword}%`),
						ilike(users.lastName, `%${searchKeyword}%`),
						ilike(users.email, `%${searchKeyword}%`),
					),
				);
			}
	
			if (filters.groups?.length) {
				conditions.push(getGroupFilterConditions(filters.groups));
			}
	
			conditions.push(isNull(users.deletedAt));
	
			const data = await this.db
				.select({
					firstName: users.firstName,
					lastName: users.lastName,
					email: users.email,
					id: users.id,
					enrolledAt: sql<
						string | null
					>`CASE WHEN ${studentCourses.status} = ${COURSE_ENROLLMENT.ENROLLED} THEN ${studentCourses.enrolledAt} ELSE NULL END`,
					groups: sql<
						Array<{ id: string; name: string }>
					>`COALESCE(json_agg(DISTINCT jsonb_build_object('id', ${groups.id}, 'name', ${groups.name})) FILTER (WHERE ${groups.id} IS NOT NULL), '[]')`.as(
						"groups",
					),
					isEnrolledByGroup: sql<boolean>`${studentCourses.enrolledByGroupId} IS NOT NULL`,
				})
				.from(users)
				.leftJoin(
					studentCourses,
					and(eq(studentCourses.studentId, users.id), eq(studentCourses.courseId, courseId)),
				)
				.leftJoin(groupUsers, eq(users.id, groupUsers.userId))
				.leftJoin(groups, eq(groupUsers.groupId, groups.id))
				.where(and(...(conditions as SQLWrapper[]), eq(users.role, USER_ROLES.STUDENT), eq(users.archived, false)))
				.groupBy(
					users.id,
					studentCourses.enrolledAt,
					studentCourses.status,
					studentCourses.enrolledByGroupId,
				)
				.orderBy(sortOrder(studentCourses.enrolledAt));
	
			return {
				data: data ?? [],
			};
		}
}
