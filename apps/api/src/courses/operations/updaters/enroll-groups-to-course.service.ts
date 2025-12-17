import { Injectable, NotFoundException, Inject } from "@nestjs/common";
import { EventBus } from "@nestjs/cqrs";
import { COURSE_ENROLLMENT } from "@repo/shared";
import { and, eq, getTableColumns, inArray, sql } from "drizzle-orm";
import { isEmpty } from "lodash";


import { DatabasePg } from "src/common";
import { EnrollGroupToCourseEvent } from "src/events";
import { LESSON_TYPES } from "src/lesson/lesson.type";
import { LessonRepository } from "src/lesson/repositories/lesson.repository";
import { StatisticsRepository } from "src/statistics/repositories/statistics.repository";
import { groupCourses, studentCourses, users, groupUsers, courses, groups, chapters, lessons, studentChapterProgress, studentLessonProgress } from "src/storage/schema";
import { USER_ROLES } from "src/user/schemas/userRoles";

import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { UUIDType } from "src/common";
import type { CurrentUser } from "src/common/types/current-user.type";
import type * as schema from "src/storage/schema";





@Injectable()
export class EnrollGroupsToCourseService {
	constructor(@Inject("DB") private readonly db: DatabasePg,
	private readonly lessonRepository: LessonRepository,
	private readonly eventBus: EventBus,
	private readonly statisticsRepository: StatisticsRepository,
			) {}
 async enrollGroupsToCourse(courseId: UUIDType, groupIds: UUIDType[], currentUser?: CurrentUser) {
		 const courseExists = await this.db.select().from(courses).where(eq(courses.id, courseId));
		 if (!courseExists.length) throw new NotFoundException(`Course ${courseId} not found`);
 
		 const groupExists = await this.db.select().from(groups).where(inArray(groups.id, groupIds));
		 if (!groupExists.length) throw new NotFoundException("Groups not found");
 
		 const groupUsersList = await this.db
			 .select({ ...getTableColumns(groupUsers), role: users.role })
			 .from(groupUsers)
			 .innerJoin(users, eq(groupUsers.userId, users.id))
			 .where(inArray(groupUsers.groupId, groupIds));
 
		 const existingGroupEnrollments = await this.db
			 .select({ groupId: groupCourses.groupId })
			 .from(groupCourses)
			 .where(and(eq(groupCourses.courseId, courseId), inArray(groupCourses.groupId, groupIds)));
 
		 const existingGroupIds = existingGroupEnrollments.map((e) => e.groupId);
		 const newGroupIds = groupIds.filter((groupId) => !existingGroupIds.includes(groupId));
 
		 let existingStudentIds: string[] = [];
		 let newStudentIds: string[] = [];
 
		 if (groupUsersList.length > 0) {
			 const existingEnrollments = await this.db
				 .select({
					 studentId: studentCourses.studentId,
				 })
				 .from(studentCourses)
				 .where(
					 and(
						 eq(studentCourses.courseId, courseId),
						 eq(studentCourses.status, COURSE_ENROLLMENT.ENROLLED),
						 inArray(
							 studentCourses.studentId,
							 groupUsersList.map((gu) => gu.userId),
						 ),
					 ),
				 );
 
			 existingStudentIds = existingEnrollments.map((e) => e.studentId);
			 newStudentIds = groupUsersList
				 .filter(
					 ({ role, userId }) => !existingStudentIds.includes(userId) && role === USER_ROLES.STUDENT,
				 )
				 .map((gu) => gu.userId);
		 }
 
		 await this.db.transaction(async (trx) => {
			 if (newGroupIds.length > 0) {
				 const groupCoursesValues = newGroupIds.map((groupId) => ({
					 groupId,
					 courseId,
					 enrolledBy: currentUser?.userId || null,
				 }));
 
				 await trx.insert(groupCourses).values(groupCoursesValues);
			 }
 
			 if (newStudentIds.length > 0 && newGroupIds.length > 0) {
				 const userIdToGroupId = new Map<string, string>();
 
				 for (const groupId of newGroupIds) {
					 const usersInGroup = groupUsersList.filter((gu) => gu.groupId === groupId);
 
					 usersInGroup.forEach((gu) => {
						 if (newStudentIds.includes(gu.userId)) {
							 userIdToGroupId.set(gu.userId, groupId);
						 }
					 });
				 }
 
				 const studentCoursesValues = newStudentIds.map((studentId) => ({
					 studentId,
					 courseId,
					 enrolledByGroupId: userIdToGroupId.get(studentId) || null,
					 status: COURSE_ENROLLMENT.ENROLLED,
				 }));
 
				 await trx
					 .insert(studentCourses)
					 .values(studentCoursesValues)
					 .onConflictDoUpdate({
						 target: [studentCourses.courseId, studentCourses.studentId],
						 set: {
							 enrolledAt: sql`EXCLUDED.enrolled_at`,
							 status: sql`EXCLUDED.status`,
							 enrolledByGroupId: sql`EXCLUDED.enrolled_by_group_id`,
						 },
					 });
 
				 await Promise.all(
					 newStudentIds.map(async (studentId) => {
						 await this.createCourseDependencies(courseId, studentId, null, trx);
					 }),
				 );
			 }
		 });
 
		 if (currentUser && newGroupIds.length > 0) {
			 newGroupIds.forEach((groupId) =>
				 this.eventBus.publish(
					 new EnrollGroupToCourseEvent({
						 courseId,
						 groupId,
						 actor: currentUser,
					 }),
				 ),
			 );
		 }
 
		 return null;
	 }

	 async createCourseDependencies(
			 courseId: UUIDType,
			 studentId: UUIDType,
			 paymentId: string | null = null,
			 trx: PostgresJsDatabase<typeof schema>,
		 ) {
			 const alreadyHasEnrollmentRecord = Boolean(
				 (
					 await trx
						 .select({ id: studentCourses.id })
						 .from(studentCourses)
						 .where(
							 and(eq(studentCourses.studentId, studentId), eq(studentCourses.courseId, courseId)),
						 )
				 ).length,
			 );
	 
			 const courseChapterList = await trx
				 .select({
					 id: chapters.id,
					 itemCount: chapters.lessonCount,
				 })
				 .from(chapters)
				 .leftJoin(lessons, eq(lessons.chapterId, chapters.id))
				 .where(eq(chapters.courseId, courseId))
				 .groupBy(chapters.id);
	 
			 const existingLessonProgress = await this.lessonRepository.getLessonsProgressByCourseId(
				 courseId,
				 studentId,
				 trx,
			 );
	 
			 if (!alreadyHasEnrollmentRecord) {
				 await this.createStatisicRecordForCourse(
					 courseId,
					 paymentId,
					 isEmpty(existingLessonProgress),
					 trx,
				 );
			 }
	 
			 if (courseChapterList.length > 0) {
				 await trx
					 .insert(studentChapterProgress)
					 .values(
						 courseChapterList.map((chapter) => ({
							 studentId,
							 chapterId: chapter.id,
							 courseId,
							 completedLessonItemCount: 0,
						 })),
					 )
					 .onConflictDoNothing();
	 
				 await Promise.all(
					 courseChapterList.map(async (chapter) => {
						 const chapterLessons = await trx
							 .select({ id: lessons.id, type: lessons.type })
							 .from(lessons)
							 .where(eq(lessons.chapterId, chapter.id));
	 
						 await trx
							 .insert(studentLessonProgress)
							 .values(
								 chapterLessons.map((lesson) => ({
									 studentId,
									 lessonId: lesson.id,
									 chapterId: chapter.id,
									 completedQuestionCount: 0,
									 quizScore: lesson.type === LESSON_TYPES.QUIZ ? 0 : null,
									 completedAt: null,
								 })),
							 )
							 .onConflictDoNothing();
					 }),
				 );
			 }
		 }
		 private async createStatisicRecordForCourse(
				 courseId: UUIDType,
				 paymentId: string | null,
				 existingFreemiumLessonProgress: boolean,
				 dbInstance: PostgresJsDatabase<typeof schema> = this.db,
			 ) {
				 if (!paymentId) {
					 return this.statisticsRepository.updateFreePurchasedCoursesStats(courseId, dbInstance);
				 }
		 
				 if (existingFreemiumLessonProgress) {
					 return this.statisticsRepository.updatePaidPurchasedCoursesStats(courseId, dbInstance);
				 }
		 
				 return this.statisticsRepository.updatePaidPurchasedAfterFreemiumCoursesStats(
					 courseId,
					 dbInstance,
				 );
			 }
}
