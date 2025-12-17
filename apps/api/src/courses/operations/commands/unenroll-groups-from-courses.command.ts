import { Injectable, NotFoundException, Inject } from "@nestjs/common";
import { COURSE_ENROLLMENT } from "@repo/shared";
import { and, eq, inArray, not } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { groupCourses, studentCourses, users, groupUsers } from "src/storage/schema";
import { USER_ROLES } from "src/user/schemas/userRoles";

import type { UUIDType } from "src/common";




@Injectable()
export class UnenrollGroupsFromCoursesService {
	constructor(@Inject("DB") private readonly db: DatabasePg,
			) {}
 async unenrollGroupsFromCourse(courseId: UUIDType, groupIds: UUIDType[]) {
		 const groupEnrollments = await this.db
			 .select({ groupId: groupCourses.groupId })
			 .from(groupCourses)
			 .where(and(eq(groupCourses.courseId, courseId), inArray(groupCourses.groupId, groupIds)));
 
		 if (!groupEnrollments.length)
			 throw new NotFoundException("No group enrollments found for the specified course and groups");
 
		 const studentsToUnenroll = await this.db
			 .select({ id: studentCourses.studentId })
			 .from(studentCourses)
			 .innerJoin(users, eq(studentCourses.studentId, users.id))
			 .where(
				 and(
					 eq(studentCourses.courseId, courseId),
					 inArray(studentCourses.enrolledByGroupId, groupIds),
					 eq(users.role, USER_ROLES.STUDENT),
				 ),
			 );
 
		 const studentIdsToUnenroll = studentsToUnenroll.map((s) => s.id);
 
		 await this.db.transaction(async (trx) => {
			 await trx
				 .delete(groupCourses)
				 .where(and(eq(groupCourses.courseId, courseId), inArray(groupCourses.groupId, groupIds)));
 
			 if (!!studentIdsToUnenroll.length) {
				 const studentsEnrolledInOtherGroups = await trx
					 .select({
						 studentId: groupUsers.userId,
						 groupId: groupCourses.groupId,
					 })
					 .from(groupUsers)
					 .innerJoin(groupCourses, eq(groupUsers.groupId, groupCourses.groupId))
					 .where(
						 and(
							 inArray(groupUsers.userId, studentIdsToUnenroll),
							 eq(groupCourses.courseId, courseId),
							 not(inArray(groupCourses.groupId, groupIds)),
						 ),
					 )
					 .orderBy(groupUsers.createdAt);
 
				 const studentsWithOtherGroups = [
					 ...new Set(studentsEnrolledInOtherGroups.map(({ studentId }) => studentId)),
				 ];
 
				 const studentsToCompletelyUnenroll = studentIdsToUnenroll.filter(
					 (studentId) => !studentsWithOtherGroups.includes(studentId),
				 );
 
				 if (studentsWithOtherGroups.length) {
					 await Promise.all(
						 studentsWithOtherGroups.map((studentId) => {
							 const newGroupId = studentsEnrolledInOtherGroups.find(
								 (student) => student.studentId === studentId,
							 )?.groupId;
 
							 return trx
								 .update(studentCourses)
								 .set({
									 enrolledByGroupId: newGroupId,
								 })
								 .where(
									 and(
										 eq(studentCourses.courseId, courseId),
										 eq(studentCourses.studentId, studentId),
									 ),
								 );
						 }),
					 );
				 }
 
				 if (studentsToCompletelyUnenroll.length) {
					 await trx
						 .update(studentCourses)
						 .set({
							 status: COURSE_ENROLLMENT.NOT_ENROLLED,
							 enrolledAt: null,
							 enrolledByGroupId: null,
						 })
						 .where(
							 and(
								 eq(studentCourses.courseId, courseId),
								 inArray(studentCourses.studentId, studentsToCompletelyUnenroll),
							 ),
						 );
				 }
			 }
		 });
	 }
}
