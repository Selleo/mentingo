import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { COURSE_ENROLLMENT, PERMISSIONS } from "@repo/shared";
import { isEmpty } from "lodash";

import { DEFAULT_PAGE_SIZE } from "src/common/pagination";
import { canUpdateCourseByAuthor } from "src/common/permissions/course-permission.utils";
import { hasPermission } from "src/common/permissions/permission.utils";
import { EnrollCourseEvent } from "src/events";
import { UsersAssignedToCourseEvent } from "src/events/user/user-assigned-to-course.event";
import { LESSON_TYPES } from "src/lesson/lesson.type";
import { LessonRepository } from "src/lesson/repositories/lesson.repository";
import { OutboxPublisher } from "src/outbox/outbox.publisher";
import { StatisticsRepository } from "src/statistics/repositories/statistics.repository";

import { GroupCourseDueDateCalendarService } from "../due-dates/group-course-due-date-calendar.service";
import { EnrolledStudentSortFields } from "../schemas/courseQuery";

import { CourseEnrollmentRepository } from "./course-enrollment.repository";

import type { GroupStudentEnrollment } from "./course-enrollment.types";
import type { EnrolledCourseGroupsPayload } from "../schemas/course.schema";
import type { EnrolledStudentsQuery } from "../schemas/courseQuery";
import type { CreateCoursesEnrollment } from "../schemas/createCoursesEnrollment";
import type { StudentCourseSelect } from "../schemas/enrolledStudent.schema";
import type { DatabasePg, UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";

@Injectable()
export class CourseEnrollmentService {
  constructor(
    private readonly courseEnrollmentRepository: CourseEnrollmentRepository,
    private readonly lessonRepository: LessonRepository,
    private readonly statisticsRepository: StatisticsRepository,
    private readonly outboxPublisher: OutboxPublisher,
    private readonly groupCourseDueDateCalendarService: GroupCourseDueDateCalendarService,
  ) {}

  /** Enrolls a single student, either self-enrollment or after a completed payment. */
  async enrollCourse(
    courseId: UUIDType,
    studentId: UUIDType,
    _testKey?: string,
    paymentId?: string,
    currentUser?: CurrentUserType,
  ) {
    const course = await this.courseEnrollmentRepository.findCourseEnrollmentCandidate(
      courseId,
      studentId,
    );

    if (!course) throw new NotFoundException("adminCourseView.errors.notFound.course");

    if (course.userDeletedAt) {
      throw new NotFoundException("adminUserView.error.userNotFound");
    }

    if (
      currentUser &&
      hasPermission(currentUser.permissions, PERMISSIONS.COURSE_UPDATE_OWN) &&
      currentUser.userId === course.authorId
    ) {
      throw new ForbiddenException("adminCourseView.errors.forbidden.enrollOwnCourse");
    }

    if (course.enrolled)
      throw new ConflictException("adminCourseView.errors.enrollment.alreadyEnrolled");
    if (course.isArchived && !paymentId) {
      throw new ForbiddenException("adminCourseView.errors.forbidden.archivedCourseEnrollment");
    }

    await this.courseEnrollmentRepository.runInTransaction(async (trx) => {
      await this.createStudentCourse(courseId, studentId, paymentId, null);
      await this.createCourseDependencies(courseId, studentId, paymentId, trx);
    });

    if (currentUser) {
      await this.outboxPublisher.publish(
        new EnrollCourseEvent({ courseId, userId: studentId, actor: currentUser }),
      );
    }
  }

  /** Directly enrolls existing, not yet enrolled students. */
  async enrollCourses(
    courseId: UUIDType,
    { studentIds }: CreateCoursesEnrollment,
    currentUser: CurrentUserType,
  ) {
    const courseExists = await this.courseEnrollmentRepository.courseExists(courseId);

    if (!courseExists) throw new NotFoundException("adminCourseView.errors.notFound.course");
    if (!studentIds.length)
      throw new BadRequestException("adminCourseView.errors.enrollment.studentsRequired");

    const alreadyEnrolledStudentIds = await this.courseEnrollmentRepository.findEnrolledStudentIds(
      courseId,
      studentIds,
    );
    const activeStudentsCount = await this.courseEnrollmentRepository.countActiveUsers(studentIds);

    if (activeStudentsCount !== studentIds.length)
      throw new BadRequestException("adminCourseView.errors.enrollment.onlyExistingUsers");

    if (alreadyEnrolledStudentIds.length > 0) {
      throw new ConflictException("adminCourseView.errors.enrollment.studentsAlreadyEnrolled");
    }

    await this.courseEnrollmentRepository.runInTransaction(async (trx) => {
      await this.courseEnrollmentRepository.upsertDirectEnrollments(courseId, studentIds, trx);

      await Promise.all(
        studentIds.map((studentId) =>
          this.createCourseDependencies(courseId, studentId, null, trx),
        ),
      );
    });

    await this.outboxPublisher.publish(new UsersAssignedToCourseEvent({ studentIds, courseId }));
    await Promise.all(
      studentIds.map((studentId) =>
        this.outboxPublisher.publish(
          new EnrollCourseEvent({ courseId, userId: studentId, actor: currentUser }),
        ),
      ),
    );
  }

  /**
   * Assigns the course to groups, keeps due-date calendar events in sync, links direct
   * enrollments to a group and enrolls the remaining group members.
   */
  async enrollGroupsToCourse(
    courseId: UUIDType,
    groupsToEnroll: EnrolledCourseGroupsPayload["groups"],
    currentUser?: CurrentUserType,
  ) {
    const groupIds = groupsToEnroll.map((group) => group.id);
    const groupInfoById = new Map(groupsToEnroll.map((group) => [group.id, group]));

    const course = await this.courseEnrollmentRepository.findCourseForGroupEnrollment(courseId);

    if (!course) throw new NotFoundException("adminCourseView.errors.notFound.course");

    const existingGroupIds = await this.courseEnrollmentRepository.findExistingGroupIds(groupIds);
    if (!existingGroupIds.length)
      throw new NotFoundException("adminCourseView.errors.enrollment.groupsNotFound");

    if (
      currentUser &&
      !hasPermission(currentUser.permissions, PERMISSIONS.COURSE_ENROLLMENT) &&
      !canUpdateCourseByAuthor(currentUser, course.authorId)
    ) {
      throw new ForbiddenException("adminCourseView.errors.forbidden.enrollGroups");
    }

    const existingDueDateCalendarEvents =
      await this.courseEnrollmentRepository.findGroupCourseCalendarEvents(courseId, groupIds);

    const eligibleDueDateGroupIds = new Set(
      groupsToEnroll.filter((group) => group.isMandatory && group.dueDate).map((group) => group.id),
    );

    const dueDateCalendarEventIdsToRemove = existingDueDateCalendarEvents
      .filter((groupCourse) => !eligibleDueDateGroupIds.has(groupCourse.groupId))
      .map((groupCourse) => groupCourse.calendarEventId)
      .filter((calendarEventId): calendarEventId is UUIDType => Boolean(calendarEventId));

    const dueDateCalendarEventUidsToRemove = groupsToEnroll
      .filter((group) => !eligibleDueDateGroupIds.has(group.id))
      .map((group) => this.groupCourseDueDateCalendarService.getUid(courseId, group.id));

    const newStudentIds = await this.courseEnrollmentRepository.runInTransaction(async (trx) => {
      const groupCourseBaseValues = groupIds.map((groupId) => {
        const { isMandatory, dueDate } = groupInfoById.get(groupId) || {};

        return {
          groupId,
          courseId,
          enrolledBy: currentUser?.userId || null,
          isMandatory: isMandatory ?? false,
          dueDate: dueDate ? new Date(dueDate) : null,
        };
      });

      const calendarEventIdsByGroupId =
        await this.groupCourseDueDateCalendarService.upsertDueDateCalendarEvents(
          trx,
          groupCourseBaseValues.map(({ groupId, isMandatory, dueDate }) => ({
            course,
            courseId,
            groupId,
            dueDate,
            isMandatory,
          })),
        );

      await this.courseEnrollmentRepository.upsertGroupCourses(
        groupCourseBaseValues.map((groupCourseBaseValue) => ({
          ...groupCourseBaseValue,
          calendarEventId: calendarEventIdsByGroupId.get(groupCourseBaseValue.groupId) ?? null,
        })),
        trx,
      );

      await this.groupCourseDueDateCalendarService.cancelDueDateCalendarEvents(trx, {
        calendarEventIds: dueDateCalendarEventIdsToRemove,
        calendarEventUids: dueDateCalendarEventUidsToRemove,
      });

      await this.attachGroupsToDirectEnrollments(courseId, groupIds, course.authorId, trx);

      return this.enrollRemainingGroupMembers(courseId, groupIds, course.authorId, trx);
    });

    await this.outboxPublisher.publish(
      new UsersAssignedToCourseEvent({ studentIds: newStudentIds, courseId }),
    );
  }

  /**
   * Removes group assignments. Learners keep the course through another assigned group when they
   * have one; otherwise they are unenrolled.
   */
  async unenrollGroupsFromCourse(courseId: UUIDType, groupIds: UUIDType[]) {
    const groupEnrollments = await this.courseEnrollmentRepository.findGroupCourseCalendarEvents(
      courseId,
      groupIds,
    );

    if (!groupEnrollments.length)
      throw new NotFoundException("adminCourseView.errors.enrollment.groupEnrollmentsNotFound");

    const studentIdsToUnenroll = await this.courseEnrollmentRepository.findGroupEnrolledLearnerIds(
      courseId,
      groupIds,
    );

    const dueDateCalendarEventIdsToRemove = groupEnrollments
      .map((groupEnrollment) => groupEnrollment.calendarEventId)
      .filter((calendarEventId): calendarEventId is UUIDType => Boolean(calendarEventId));

    const dueDateCalendarEventUidsToRemove = groupEnrollments.map((groupEnrollment) =>
      this.groupCourseDueDateCalendarService.getUid(courseId, groupEnrollment.groupId),
    );

    await this.courseEnrollmentRepository.runInTransaction(async (trx) => {
      await this.groupCourseDueDateCalendarService.cancelDueDateCalendarEvents(trx, {
        calendarEventIds: dueDateCalendarEventIdsToRemove,
        calendarEventUids: dueDateCalendarEventUidsToRemove,
      });

      await this.courseEnrollmentRepository.deleteGroupCourses(courseId, groupIds, trx);

      if (!studentIdsToUnenroll.length) return;

      const otherGroupMemberships =
        await this.courseEnrollmentRepository.findStudentCourseGroupMemberships(
          courseId,
          studentIdsToUnenroll,
          groupIds,
          trx,
        );
      const fallbackGroupByStudent = this.mapStudentsToFirstGroup(otherGroupMemberships);

      await Promise.all(
        Array.from(fallbackGroupByStudent.entries()).map(([studentId, groupId]) =>
          this.courseEnrollmentRepository.updateStudentEnrolledByGroup(
            courseId,
            studentId,
            groupId,
            trx,
          ),
        ),
      );

      await this.courseEnrollmentRepository.markStudentsNotEnrolled(
        courseId,
        studentIdsToUnenroll.filter((studentId) => !fallbackGroupByStudent.has(studentId)),
        trx,
      );
    });
  }

  /**
   * Removes direct enrollments. Learners who belong to a group assigned to the course stay
   * enrolled through that group.
   */
  async unenrollCourse(courseId: UUIDType, userIds: UUIDType[]) {
    const studentEnrollments = await this.courseEnrollmentRepository.findStudentCourseEnrollments(
      courseId,
      userIds,
    );

    const enrolledStudentsCount = studentEnrollments.filter(
      (enrollment) => enrollment.status === COURSE_ENROLLMENT.ENROLLED,
    ).length;

    const missingOrUnenrolledCount = userIds.length - enrolledStudentsCount;

    if (missingOrUnenrolledCount > 0) {
      throw new BadRequestException({
        message: "adminCourseView.enrolled.toast.someStudentsUnenrolled",
        count: missingOrUnenrolledCount,
      });
    }

    const studentsEnrolledByGroupCount = studentEnrollments.filter(
      (enrollment) => enrollment.enrolledByGroupId,
    ).length;

    if (studentsEnrolledByGroupCount > 0) {
      throw new BadRequestException({
        message: "adminCourseView.enrolled.toast.studentsEnrolledByGroup",
        count: studentsEnrolledByGroupCount,
      });
    }

    const groupMemberships =
      await this.courseEnrollmentRepository.findStudentCourseGroupMemberships(courseId, userIds);
    const groupByStudent = this.mapStudentsToFirstGroup(groupMemberships);

    await this.courseEnrollmentRepository.runInTransaction(async (trx) => {
      await Promise.all(
        Array.from(groupByStudent.entries()).map(([studentId, groupId]) =>
          this.courseEnrollmentRepository.updateStudentEnrolledByGroup(
            courseId,
            studentId,
            groupId,
            trx,
          ),
        ),
      );

      await this.courseEnrollmentRepository.markStudentsNotEnrolled(
        courseId,
        userIds.filter((userId) => !groupByStudent.has(userId)),
        trx,
      );
    });
  }

  async getStudentCourseEnrollments(studentId: UUIDType, courseIds: UUIDType[], db?: DatabasePg) {
    return this.courseEnrollmentRepository.findStudentCourseEnrollmentsAcrossCourses(
      studentId,
      courseIds,
      db,
    );
  }

  async activateStudentCourseEnrollment(courseId: UUIDType, studentId: UUIDType, db?: DatabasePg) {
    return this.courseEnrollmentRepository.activateStudentCourseEnrollment(courseId, studentId, db);
  }

  async markStudentCoursesNotEnrolled(studentId: UUIDType, courseIds: UUIDType[], db?: DatabasePg) {
    return this.courseEnrollmentRepository.upsertNotEnrolledStudentCourses(
      studentId,
      courseIds,
      db,
    );
  }

  async createStudentCourse(
    courseId: UUIDType,
    studentId: UUIDType,
    paymentId: string | null = null,
    enrolledByGroupId: UUIDType | null = null,
    db?: DatabasePg,
  ): Promise<StudentCourseSelect> {
    const enrolledCourse = await this.courseEnrollmentRepository.upsertStudentCourse(
      { courseId, studentId, paymentId, enrolledByGroupId },
      db,
    );

    if (!enrolledCourse)
      throw new ConflictException("adminCourseView.errors.enrollment.enrollmentFailed");

    return enrolledCourse;
  }

  /** Creates the chapter and lesson progress rows a newly enrolled student starts from. */
  async createCourseDependencies(
    courseId: UUIDType,
    studentId: UUIDType,
    paymentId: string | null = null,
    trx?: DatabasePg,
  ) {
    const alreadyHasEnrollmentRecord = await this.courseEnrollmentRepository.hasStudentCourseRecord(
      courseId,
      studentId,
      trx,
    );

    const chapterIds = await this.courseEnrollmentRepository.findCourseChapterIds(courseId, trx);

    const existingLessonProgress = await this.lessonRepository.getLessonsProgressByCourseId(
      courseId,
      studentId,
      trx,
    );

    if (!alreadyHasEnrollmentRecord) {
      await this.recordCoursePurchaseStatistics(
        courseId,
        paymentId,
        isEmpty(existingLessonProgress),
        trx,
      );
    }

    const learningStateId = await this.courseEnrollmentRepository.findActiveLearningStateId(
      studentId,
      courseId,
      trx,
    );

    await this.courseEnrollmentRepository.insertStudentChapterProgress(
      chapterIds.map((chapterId) => ({
        studentId,
        learningStateId,
        chapterId,
        courseId,
        completedLessonItemCount: 0,
      })),
      trx,
    );

    await Promise.all(
      chapterIds.map(async (chapterId) => {
        const chapterLessons = await this.courseEnrollmentRepository.findChapterLessons(
          chapterId,
          trx,
        );

        await this.courseEnrollmentRepository.insertStudentLessonProgress(
          chapterLessons.map((lesson) => ({
            studentId,
            learningStateId,
            lessonId: lesson.id,
            chapterId,
            completedQuestionCount: 0,
            quizScore: lesson.type === LESSON_TYPES.QUIZ ? 0 : null,
            completedAt: null,
          })),
          trx,
        );
      }),
    );
  }

  /** Every active non-author user with their enrollment state for the course. */
  async getStudentsWithEnrollmentDate(query: EnrolledStudentsQuery) {
    const { courseId, filters = {}, language, page = 1, perPage = DEFAULT_PAGE_SIZE } = query;
    const { keyword, sort = EnrolledStudentSortFields.enrolledAt } = filters;

    const enrolledStudentsFilters = { courseId, keyword, groupIds: filters.groups, language };

    const data = await this.courseEnrollmentRepository.findEnrolledStudents(
      enrolledStudentsFilters,
      { page, perPage, sort },
    );
    const totalItems =
      await this.courseEnrollmentRepository.countEnrolledStudents(enrolledStudentsFilters);

    return {
      data: data ?? [],
      pagination: { totalItems: totalItems || 0, page, perPage },
    };
  }

  async getStudentsWithoutCertificate(courseId: UUIDType) {
    return this.courseEnrollmentRepository.findCompletedEnrollmentsWithoutCertificate(courseId);
  }

  private async attachGroupsToDirectEnrollments(
    courseId: UUIDType,
    groupIds: UUIDType[],
    courseAuthorId: UUIDType,
    trx: DatabasePg,
  ) {
    const directlyEnrolledStudents =
      await this.courseEnrollmentRepository.findDirectlyEnrolledGroupStudents(
        courseId,
        groupIds,
        courseAuthorId,
        trx,
      );

    await Promise.all(
      directlyEnrolledStudents.map((enrollment) =>
        this.courseEnrollmentRepository.attachGroupToDirectEnrollment(courseId, enrollment, trx),
      ),
    );
  }

  private async enrollRemainingGroupMembers(
    courseId: UUIDType,
    groupIds: UUIDType[],
    courseAuthorId: UUIDType,
    trx: DatabasePg,
  ) {
    const notEnrolledStudents = await this.courseEnrollmentRepository.findNotEnrolledGroupStudents(
      courseId,
      groupIds,
      courseAuthorId,
      trx,
    );

    const newStudentIds = await this.courseEnrollmentRepository.insertGroupEnrollments(
      courseId,
      notEnrolledStudents,
      trx,
    );

    await Promise.all(
      newStudentIds.map((studentId) =>
        this.createCourseDependencies(courseId, studentId, null, trx),
      ),
    );

    return newStudentIds;
  }

  private mapStudentsToFirstGroup(memberships: GroupStudentEnrollment[]) {
    const groupByStudent = new Map<UUIDType, UUIDType>();

    memberships.forEach(({ studentId, groupId }) => {
      if (!groupByStudent.has(studentId)) groupByStudent.set(studentId, groupId);
    });

    return groupByStudent;
  }

  private async recordCoursePurchaseStatistics(
    courseId: UUIDType,
    paymentId: string | null,
    existingFreemiumLessonProgress: boolean,
    db?: DatabasePg,
  ) {
    if (!paymentId) {
      return this.statisticsRepository.updateFreePurchasedCoursesStats(courseId, db);
    }

    if (existingFreemiumLessonProgress) {
      return this.statisticsRepository.updatePaidPurchasedCoursesStats(courseId, db);
    }

    return this.statisticsRepository.updatePaidPurchasedAfterFreemiumCoursesStats(courseId, db);
  }
}
