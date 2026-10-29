import { Inject, Injectable } from "@nestjs/common";
import { COURSE_ENROLLMENT, PERMISSIONS } from "@repo/shared";
import {
  and,
  countDistinct,
  desc,
  eq,
  getTableColumns,
  ilike,
  inArray,
  isNotNull,
  isNull,
  ne,
  not,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { match } from "ts-pattern";

import { DatabasePg, type UUIDType } from "src/common";
import { getGroupFilterConditions } from "src/common/helpers/getGroupFilterConditions";
import { getSortOptions } from "src/common/helpers/getSortOptions";
import { userHasAnyPermissionsCondition } from "src/common/permissions/permission-sql.utils";
import { activeCourseLearningStateId } from "src/course-repetition/course-repetition.service";
import { LocalizationService } from "src/localization/localization.service";
import { DB } from "src/storage/db/db.providers";
import {
  certificates,
  chapters,
  courses,
  groupCourses,
  groups,
  groupUsers,
  lessons,
  studentChapterProgress,
  studentCourses,
  studentLessonProgress,
  users,
} from "src/storage/schema";

import { EnrolledStudentSortFields } from "../schemas/courseQuery";

import type {
  EnrolledStudentsFilters,
  GroupCourseEnrollmentValues,
  GroupStudentEnrollment,
  StudentChapterProgressValues,
  StudentLessonProgressValues,
} from "./course-enrollment.types";
import type { EnrolledStudentSortField } from "../schemas/courseQuery";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import type { StudentCourseSelect } from "src/courses/schemas/enrolledStudent.schema";
import type { LocalizedGroup } from "src/group/group.types";

@Injectable()
export class CourseEnrollmentRepository {
  constructor(
    @Inject(DB) private readonly db: DatabasePg,
    private readonly localizationService: LocalizationService,
  ) {}

  async runInTransaction<T>(callback: (trx: DatabasePg) => Promise<T>) {
    return this.db.transaction(callback);
  }

  async findCourseEnrollmentCandidate(courseId: UUIDType, studentId: UUIDType) {
    const [course] = await this.db
      .select({
        id: courses.id,
        authorId: courses.authorId,
        enrolled: sql<boolean>`CASE WHEN ${studentCourses.status} = ${COURSE_ENROLLMENT.ENROLLED} THEN TRUE ELSE FALSE END`,
        isArchived: courses.isArchived,
        price: courses.priceInCents,
        userDeletedAt: users.deletedAt,
      })
      .from(courses)
      .leftJoin(users, eq(users.id, studentId))
      .leftJoin(
        studentCourses,
        and(eq(courses.id, studentCourses.courseId), eq(studentCourses.studentId, studentId)),
      )
      .where(and(eq(courses.id, courseId)));

    return course;
  }

  async courseExists(courseId: UUIDType) {
    const [course] = await this.db
      .select({ id: courses.id })
      .from(courses)
      .where(eq(courses.id, courseId));

    return Boolean(course);
  }

  async findCourseForGroupEnrollment(courseId: UUIDType) {
    const [course] = await this.db
      .select({
        authorId: courses.authorId,
        title: courses.title,
        baseLanguage: courses.baseLanguage,
        availableLocales: courses.availableLocales,
      })
      .from(courses)
      .where(eq(courses.id, courseId));

    return course;
  }

  async findExistingGroupIds(groupIds: UUIDType[]) {
    const rows = await this.db
      .select({ id: groups.id })
      .from(groups)
      .where(inArray(groups.id, groupIds));

    return rows.map(({ id }) => id);
  }

  async findEnrolledStudentIds(courseId: UUIDType, studentIds: UUIDType[]) {
    const rows = await this.db
      .select({ studentId: studentCourses.studentId })
      .from(studentCourses)
      .where(
        and(
          eq(studentCourses.courseId, courseId),
          inArray(studentCourses.studentId, studentIds),
          eq(studentCourses.status, COURSE_ENROLLMENT.ENROLLED),
        ),
      );

    return rows.map(({ studentId }) => studentId);
  }

  async countActiveUsers(userIds: UUIDType[]) {
    const rows = await this.db
      .select({ id: users.id })
      .from(users)
      .where(and(inArray(users.id, userIds), isNull(users.deletedAt)));

    return rows.length;
  }

  async findStudentCourseEnrollments(courseId: UUIDType, studentIds: UUIDType[]) {
    return this.db
      .select({
        studentId: studentCourses.studentId,
        status: studentCourses.status,
        enrolledByGroupId: studentCourses.enrolledByGroupId,
      })
      .from(studentCourses)
      .where(
        and(eq(studentCourses.courseId, courseId), inArray(studentCourses.studentId, studentIds)),
      );
  }

  async findStudentCourseEnrollmentsAcrossCourses(
    studentId: UUIDType,
    courseIds: UUIDType[],
    db: DatabasePg = this.db,
  ) {
    if (courseIds.length === 0) return [];

    return db
      .select({
        courseId: studentCourses.courseId,
        enrolledAt: studentCourses.enrolledAt,
        enrolledByGroupId: studentCourses.enrolledByGroupId,
        status: studentCourses.status,
      })
      .from(studentCourses)
      .where(
        and(eq(studentCourses.studentId, studentId), inArray(studentCourses.courseId, courseIds)),
      );
  }

  async hasStudentCourseRecord(courseId: UUIDType, studentId: UUIDType, db: DatabasePg = this.db) {
    const [record] = await db
      .select({ id: studentCourses.id })
      .from(studentCourses)
      .where(and(eq(studentCourses.studentId, studentId), eq(studentCourses.courseId, courseId)));

    return Boolean(record);
  }

  async upsertStudentCourse(
    values: {
      courseId: UUIDType;
      studentId: UUIDType;
      paymentId: string | null;
      enrolledByGroupId: UUIDType | null;
    },
    db: DatabasePg = this.db,
  ): Promise<StudentCourseSelect | undefined> {
    const [enrolledCourse] = await db
      .insert(studentCourses)
      .values({
        ...values,
        enrolledAt: sql`NOW()`,
        status: COURSE_ENROLLMENT.ENROLLED,
      })
      .onConflictDoUpdate({
        target: [studentCourses.studentId, studentCourses.courseId],
        set: {
          enrolledAt: sql`
            CASE
              WHEN ${studentCourses.status} = ${COURSE_ENROLLMENT.ENROLLED} THEN ${studentCourses.enrolledAt}
              ELSE EXCLUDED.enrolled_at
            END
          `,
          status: sql`EXCLUDED.status`,
          enrolledByGroupId: sql`EXCLUDED.enrolled_by_group_id`,
        },
      })
      .returning();

    return enrolledCourse;
  }

  async upsertDirectEnrollments(courseId: UUIDType, studentIds: UUIDType[], db: DatabasePg) {
    await db
      .insert(studentCourses)
      .values(
        studentIds.map((studentId) => ({
          studentId,
          courseId,
          enrolledAt: sql`NOW()`,
          status: COURSE_ENROLLMENT.ENROLLED,
          enrolledByGroupId: null,
        })),
      )
      .onConflictDoUpdate({
        target: [studentCourses.studentId, studentCourses.courseId],
        set: { enrolledAt: sql`EXCLUDED.enrolled_at`, status: sql`EXCLUDED.status` },
      });
  }

  async activateStudentCourseEnrollment(
    courseId: UUIDType,
    studentId: UUIDType,
    db: DatabasePg = this.db,
  ) {
    return db
      .update(studentCourses)
      .set({
        enrolledAt: sql`NOW()`,
        status: COURSE_ENROLLMENT.ENROLLED,
      })
      .where(and(eq(studentCourses.studentId, studentId), eq(studentCourses.courseId, courseId)));
  }

  async upsertNotEnrolledStudentCourses(
    studentId: UUIDType,
    courseIds: UUIDType[],
    db: DatabasePg = this.db,
  ) {
    if (courseIds.length === 0) return [];

    return db
      .insert(studentCourses)
      .values(
        courseIds.map((courseId) => ({
          studentId,
          courseId,
          enrolledAt: null,
          status: COURSE_ENROLLMENT.NOT_ENROLLED,
          enrolledByGroupId: null,
        })),
      )
      .onConflictDoUpdate({
        target: [studentCourses.studentId, studentCourses.courseId],
        set: {
          enrolledAt: null,
          status: COURSE_ENROLLMENT.NOT_ENROLLED,
          enrolledByGroupId: null,
        },
      })
      .returning({ courseId: studentCourses.courseId });
  }

  async markStudentsNotEnrolled(courseId: UUIDType, studentIds: UUIDType[], db: DatabasePg) {
    if (!studentIds.length) return;

    await db
      .update(studentCourses)
      .set({
        status: COURSE_ENROLLMENT.NOT_ENROLLED,
        enrolledAt: null,
        enrolledByGroupId: null,
      })
      .where(
        and(eq(studentCourses.courseId, courseId), inArray(studentCourses.studentId, studentIds)),
      );
  }

  async updateStudentEnrolledByGroup(
    courseId: UUIDType,
    studentId: UUIDType,
    groupId: UUIDType,
    db: DatabasePg,
  ) {
    await db
      .update(studentCourses)
      .set({ enrolledByGroupId: groupId })
      .where(and(eq(studentCourses.courseId, courseId), eq(studentCourses.studentId, studentId)));
  }

  async attachGroupToDirectEnrollment(
    courseId: UUIDType,
    { studentId, groupId }: GroupStudentEnrollment,
    db: DatabasePg,
  ) {
    await db
      .update(studentCourses)
      .set({ enrolledByGroupId: groupId })
      .where(
        and(
          eq(studentCourses.studentId, studentId),
          eq(studentCourses.courseId, courseId),
          eq(studentCourses.status, COURSE_ENROLLMENT.ENROLLED),
          isNull(studentCourses.enrolledByGroupId),
        ),
      );
  }

  async findGroupCourseCalendarEvents(courseId: UUIDType, groupIds: UUIDType[]) {
    return this.db
      .select({
        groupId: groupCourses.groupId,
        calendarEventId: groupCourses.calendarEventId,
      })
      .from(groupCourses)
      .where(and(eq(groupCourses.courseId, courseId), inArray(groupCourses.groupId, groupIds)));
  }

  async upsertGroupCourses(values: GroupCourseEnrollmentValues[], db: DatabasePg) {
    await db
      .insert(groupCourses)
      .values(values)
      .onConflictDoUpdate({
        target: [groupCourses.groupId, groupCourses.courseId],
        set: {
          isMandatory: sql`EXCLUDED.is_mandatory`,
          enrolledBy: sql`EXCLUDED.enrolled_by`,
          dueDate: sql`EXCLUDED.due_date`,
          calendarEventId: sql`EXCLUDED.calendar_event_id`,
        },
      });
  }

  async deleteGroupCourses(courseId: UUIDType, groupIds: UUIDType[], db: DatabasePg) {
    await db
      .delete(groupCourses)
      .where(and(eq(groupCourses.courseId, courseId), inArray(groupCourses.groupId, groupIds)));
  }

  /** Each student is matched to the last of `groupIds` they belong to. */
  async findDirectlyEnrolledGroupStudents(
    courseId: UUIDType,
    groupIds: UUIDType[],
    courseAuthorId: UUIDType,
    db: DatabasePg,
  ): Promise<GroupStudentEnrollment[]> {
    return db
      .selectDistinctOn([groupUsers.userId], {
        studentId: groupUsers.userId,
        groupId: groupUsers.groupId,
      })
      .from(groupUsers)
      .innerJoin(users, eq(users.id, groupUsers.userId))
      .innerJoin(
        studentCourses,
        and(
          eq(studentCourses.studentId, groupUsers.userId),
          eq(studentCourses.courseId, courseId),
          eq(studentCourses.status, COURSE_ENROLLMENT.ENROLLED),
        ),
      )
      .where(
        and(
          inArray(groupUsers.groupId, groupIds),
          ne(users.id, courseAuthorId),
          isNull(studentCourses.enrolledByGroupId),
        ),
      )
      .orderBy(groupUsers.userId, desc(this.buildGroupOrder(groupIds)));
  }

  /** Each student is matched to the last of `groupIds` they belong to. */
  async findNotEnrolledGroupStudents(
    courseId: UUIDType,
    groupIds: UUIDType[],
    courseAuthorId: UUIDType,
    db: DatabasePg,
  ): Promise<GroupStudentEnrollment[]> {
    return db
      .selectDistinctOn([groupUsers.userId], {
        studentId: groupUsers.userId,
        groupId: groupUsers.groupId,
      })
      .from(groupUsers)
      .innerJoin(users, eq(users.id, groupUsers.userId))
      .leftJoin(
        studentCourses,
        and(
          eq(studentCourses.studentId, groupUsers.userId),
          eq(studentCourses.courseId, courseId),
          eq(studentCourses.status, COURSE_ENROLLMENT.ENROLLED),
        ),
      )
      .where(
        and(
          inArray(groupUsers.groupId, groupIds),
          ne(users.id, courseAuthorId),
          isNull(studentCourses.id),
        ),
      )
      .orderBy(groupUsers.userId, desc(this.buildGroupOrder(groupIds)));
  }

  async insertGroupEnrollments(
    courseId: UUIDType,
    enrollments: GroupStudentEnrollment[],
    db: DatabasePg,
  ) {
    if (!enrollments.length) return [];

    const insertedStudents = await db
      .insert(studentCourses)
      .values(
        enrollments.map(({ studentId, groupId }) => ({
          studentId,
          courseId,
          enrolledByGroupId: groupId,
          status: COURSE_ENROLLMENT.ENROLLED,
        })),
      )
      .onConflictDoUpdate({
        target: [studentCourses.courseId, studentCourses.studentId],
        set: {
          enrolledAt: sql`EXCLUDED.enrolled_at`,
          status: sql`EXCLUDED.status`,
          enrolledByGroupId: sql`EXCLUDED.enrolled_by_group_id`,
        },
      })
      .returning({ studentId: studentCourses.studentId });

    return insertedStudents.map(({ studentId }) => studentId);
  }

  async findGroupEnrolledLearnerIds(courseId: UUIDType, groupIds: UUIDType[]) {
    const rows = await this.db
      .select({ id: studentCourses.studentId })
      .from(studentCourses)
      .innerJoin(users, eq(studentCourses.studentId, users.id))
      .where(
        and(
          eq(studentCourses.courseId, courseId),
          inArray(studentCourses.enrolledByGroupId, groupIds),
          not(
            userHasAnyPermissionsCondition(this.db, users.id, users.tenantId, [
              PERMISSIONS.COURSE_UPDATE,
              PERMISSIONS.COURSE_UPDATE_OWN,
            ]),
          ),
        ),
      );

    return rows.map(({ id }) => id);
  }

  /** Group memberships of the students in groups assigned to the course, oldest first. */
  async findStudentCourseGroupMemberships(
    courseId: UUIDType,
    studentIds: UUIDType[],
    excludedGroupIds: UUIDType[] = [],
    db: DatabasePg = this.db,
  ) {
    return db
      .select({
        studentId: groupUsers.userId,
        groupId: groupCourses.groupId,
      })
      .from(groupUsers)
      .innerJoin(groupCourses, eq(groupUsers.groupId, groupCourses.groupId))
      .where(
        and(
          inArray(groupUsers.userId, studentIds),
          eq(groupCourses.courseId, courseId),
          excludedGroupIds.length
            ? not(inArray(groupCourses.groupId, excludedGroupIds))
            : undefined,
        ),
      )
      .orderBy(groupUsers.createdAt);
  }

  async findCourseChapterIds(courseId: UUIDType, db: DatabasePg = this.db) {
    const rows = await db
      .select({ id: chapters.id })
      .from(chapters)
      .leftJoin(lessons, eq(lessons.chapterId, chapters.id))
      .where(eq(chapters.courseId, courseId))
      .groupBy(chapters.id);

    return rows.map(({ id }) => id);
  }

  async findChapterLessons(chapterId: UUIDType, db: DatabasePg = this.db) {
    return db
      .select({ id: lessons.id, type: lessons.type })
      .from(lessons)
      .where(eq(lessons.chapterId, chapterId));
  }

  async insertStudentChapterProgress(
    values: StudentChapterProgressValues[],
    db: DatabasePg = this.db,
  ) {
    if (!values.length) return;

    await db.insert(studentChapterProgress).values(values).onConflictDoNothing();
  }

  async insertStudentLessonProgress(
    values: StudentLessonProgressValues[],
    db: DatabasePg = this.db,
  ) {
    if (!values.length) return;

    await db.insert(studentLessonProgress).values(values).onConflictDoNothing();
  }

  async findActiveLearningStateId(
    studentId: UUIDType,
    courseId: UUIDType,
    db: DatabasePg = this.db,
  ) {
    return activeCourseLearningStateId(db, studentId, courseId);
  }

  async findEnrolledStudents(
    { courseId, keyword, groupIds, language }: EnrolledStudentsFilters,
    { page, perPage, sort }: { page: number; perPage: number; sort: string },
  ) {
    const { sortOrder, sortedField } = getSortOptions(sort);

    return this.db
      .select({
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        id: users.id,
        enrolledAt: sql<
          string | null
        >`CASE WHEN ${studentCourses.status} = ${COURSE_ENROLLMENT.ENROLLED} THEN ${studentCourses.enrolledAt} ELSE NULL END`,
        groups: sql<LocalizedGroup[]>`COALESCE(json_agg(DISTINCT jsonb_build_object('id', ${
          groups.id
        }, 'name', ${this.localizationService.getLocalizedSqlField(
          groups.name,
          language,
          groups,
        )})) FILTER (WHERE ${groups.id} IS NOT NULL), '[]')`.as("groups"),
        isEnrolledByGroup: sql<boolean>`${studentCourses.enrolledByGroupId} IS NOT NULL`,
      })
      .from(users)
      .innerJoin(courses, eq(courses.id, courseId))
      .leftJoin(
        studentCourses,
        and(eq(studentCourses.studentId, users.id), eq(studentCourses.courseId, courseId)),
      )
      .leftJoin(groupUsers, eq(users.id, groupUsers.userId))
      .leftJoin(groups, eq(groupUsers.groupId, groups.id))
      .where(and(...this.buildEnrolledStudentsConditions(keyword, groupIds)))
      .groupBy(
        users.id,
        studentCourses.enrolledAt,
        studentCourses.status,
        studentCourses.enrolledByGroupId,
      )
      .orderBy(
        sortOrder(this.buildEnrolledStudentsSortColumn(sortedField as EnrolledStudentSortField)),
      )
      .limit(perPage)
      .offset((page - 1) * perPage);
  }

  async countEnrolledStudents({ courseId, keyword, groupIds }: EnrolledStudentsFilters) {
    const [{ totalItems }] = await this.db
      .select({ totalItems: countDistinct(users.id) })
      .from(users)
      .innerJoin(courses, eq(courses.id, courseId))
      .leftJoin(
        studentCourses,
        and(eq(studentCourses.studentId, users.id), eq(studentCourses.courseId, courseId)),
      )
      .leftJoin(groupUsers, eq(users.id, groupUsers.userId))
      .leftJoin(groups, eq(groupUsers.groupId, groups.id))
      .where(and(...this.buildEnrolledStudentsConditions(keyword, groupIds)));

    return totalItems;
  }

  /** Completed enrollments that have no certificate yet. */
  async findCompletedEnrollmentsWithoutCertificate(courseId: UUIDType) {
    return this.db
      .select({ ...getTableColumns(studentCourses) })
      .from(studentCourses)
      .leftJoin(
        certificates,
        and(
          eq(certificates.courseId, studentCourses.courseId),
          eq(certificates.userId, studentCourses.studentId),
        ),
      )
      .where(
        and(
          isNotNull(studentCourses.completedAt),
          isNull(certificates.userId),
          eq(studentCourses.courseId, courseId),
        ),
      );
  }

  private buildEnrolledStudentsConditions(keyword?: string, groupIds?: UUIDType[]) {
    const searchKeyword = keyword?.toLowerCase();

    return [
      eq(users.archived, false),
      isNull(users.deletedAt),
      ne(users.id, courses.authorId),
      searchKeyword
        ? or(
            ilike(users.firstName, `%${searchKeyword}%`),
            ilike(users.lastName, `%${searchKeyword}%`),
            ilike(users.email, `%${searchKeyword}%`),
          )
        : undefined,
      groupIds?.length ? getGroupFilterConditions(groupIds) : undefined,
    ];
  }

  private buildEnrolledStudentsSortColumn(field: EnrolledStudentSortField) {
    return match<string, SQL | AnyPgColumn>(field)
      .with(EnrolledStudentSortFields.firstName, () => users.firstName)
      .with(EnrolledStudentSortFields.lastName, () => users.lastName)
      .with(EnrolledStudentSortFields.email, () => users.email)
      .with(
        EnrolledStudentSortFields.isEnrolledByGroup,
        () => sql`
          CASE
            WHEN ${studentCourses.enrolledByGroupId} IS NOT NULL THEN 2
            WHEN ${studentCourses.status} = ${COURSE_ENROLLMENT.ENROLLED} THEN 1
            ELSE 0
          END
        `,
      )
      .otherwise(() => studentCourses.enrolledAt);
  }

  private buildGroupOrder(groupIds: UUIDType[]) {
    const groupIdsArray = sql`ARRAY[${sql.join(
      groupIds.map((groupId) => sql`${groupId}::uuid`),
      sql`, `,
    )}]`;

    return sql<number>`array_position(${groupIdsArray}, ${groupUsers.groupId})`;
  }
}
