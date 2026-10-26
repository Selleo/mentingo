import { Inject, Injectable } from "@nestjs/common";
import {
  COURSE_ENROLLMENT,
  COURSE_LEARNING_STATE_KINDS,
  PERMISSIONS,
  type SupportedLanguages,
} from "@repo/shared";
import {
  and,
  count,
  countDistinct,
  eq,
  exists,
  isNotNull,
  isNull,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { match } from "ts-pattern";

import { DatabasePg, type UUIDType } from "src/common";
import { getSortOptions } from "src/common/helpers/getSortOptions";
import { getUserNameSearchCondition } from "src/common/helpers/getUserNameSearchCondition";
import {
  getGroupManagerCourseScopeCondition,
  getGroupManagerGroupScopeCondition,
} from "src/common/permissions/group-manager-scope.utils";
import {
  getRestrictedIdsCondition,
  getRestrictedIdsSqlFragment,
} from "src/common/utils/restrictedIds";
import { currentLearningState } from "src/course-repetition/course-learning-state.sql";
import { LESSON_TYPES } from "src/lesson/lesson.type";
import { LocalizationService } from "src/localization/localization.service";
import { DB } from "src/storage/db/db.providers";
import {
  aiMentorStudentLessonProgress,
  chapters,
  courseLearningStates,
  courses,
  coursesSummaryStats,
  groupManagerGroups,
  groups,
  groupUsers,
  lessons,
  studentCourses,
  studentLessonProgress,
  users,
} from "src/storage/schema";

import {
  CourseStudentAiMentorResultsSortFields,
  CourseStudentProgressionSortFields,
  CourseStudentQuizResultsSortFields,
} from "../schemas/courseQuery";

import type {
  CourseStatisticsLearnerScope,
  CourseStatisticsListFilters,
  CourseStatisticsPageOptions,
  CourseStatisticsSortField,
  CourseStudentAiMentorResultsFilters,
  CourseStudentQuizResultsFilters,
} from "./course-statistics.types";
import type { CourseStatisticsExpressionsParams } from "../course.types";
import type {
  CourseAverageQuizScorePerQuiz,
  CourseStatusDistribution,
} from "../schemas/course.schema";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import type { CurrentUserType } from "src/common/types/current-user.type";
import type { LocalizedGroup } from "src/group/group.types";

@Injectable()
export class CourseStatisticsRepository {
  constructor(
    @Inject(DB) private readonly db: DatabasePg,
    private readonly localizationService: LocalizationService,
  ) {}

  async findCourseStatisticsSummary(
    courseId: UUIDType,
    learnerScope: CourseStatisticsLearnerScope,
  ) {
    const scopedStudentCondition = getRestrictedIdsCondition(
      learnerScope.restricted,
      learnerScope.userIds,
      studentCourses.studentId,
    );

    const scopedAliasCondition = getRestrictedIdsSqlFragment(
      learnerScope.restricted,
      learnerScope.userIds,
      sql.raw("sc.student_id"),
    );

    const [courseStats] = await this.db
      .select({
        enrolledCount: sql<number>`COUNT(DISTINCT ${studentCourses.studentId})::int`,
        completionPercentage: sql<number>`COALESCE(
          (
            SELECT
              ROUND(
                (CAST(completed_count AS DECIMAL) /
                 NULLIF(total_count, 0)) * 100, 2)
            FROM (
              SELECT
                COUNT(DISTINCT CASE WHEN sc.progress = 'completed' THEN sc.student_id END) AS completed_count,
                COUNT(DISTINCT sc.student_id) AS total_count
              FROM ${studentCourses} AS sc
              JOIN ${users} AS active_users ON active_users.id = sc.student_id AND active_users.deleted_at IS NULL
              WHERE sc.course_id = ${courseId} AND sc.status = ${COURSE_ENROLLMENT.ENROLLED}
              ${scopedAliasCondition}
            ) AS stats
          ),
          0
        )::float`,
        averageCompletionPercentage: sql<number>`COALESCE(
        (
          SELECT
            ROUND((CAST(total_completed AS DECIMAL) / NULLIF(total_rows, 0)) * 100, 2)
          FROM (
            SELECT
              COUNT(*) FILTER (WHERE slp.completed_at IS NOT NULL) AS total_completed,
              COUNT(*) AS total_rows
            FROM ${studentLessonProgress} AS slp
            JOIN ${lessons} AS l ON slp.lesson_id = l.id
            JOIN ${chapters} AS ch ON l.chapter_id = ch.id
            JOIN ${studentCourses} AS sc ON ${currentLearningState(
              sql.raw("slp.learning_state_id"),
            )} AND slp.student_id = sc.student_id AND ch.course_id = sc.course_id
            JOIN ${users} AS active_users ON active_users.id = sc.student_id AND active_users.deleted_at IS NULL
            WHERE ch.course_id = ${courseId} AND sc.status = ${COURSE_ENROLLMENT.ENROLLED}
            ${scopedAliasCondition}
          ) AS stats
        ),
        0
        )::float`,
        courseStatusDistribution: sql<CourseStatusDistribution>`COALESCE(
          (
            SELECT jsonb_agg(jsonb_build_object('status', progress, 'count', count)) FROM (
              SELECT
                sc.progress AS progress,
                COUNT(*) AS count
              FROM ${studentCourses} AS sc
              JOIN ${users} AS active_users ON active_users.id = sc.student_id AND active_users.deleted_at IS NULL
              WHERE sc.course_id = ${courseId} AND sc.status = ${COURSE_ENROLLMENT.ENROLLED}
              ${scopedAliasCondition}
              GROUP BY sc.progress
            ) AS progress_counts
          ),
          '[]'::jsonb
        )`,
      })
      .from(coursesSummaryStats)
      .leftJoin(studentCourses, eq(coursesSummaryStats.courseId, studentCourses.courseId))
      .leftJoin(users, eq(studentCourses.studentId, users.id))
      .where(
        and(
          eq(coursesSummaryStats.courseId, courseId),
          eq(studentCourses.status, COURSE_ENROLLMENT.ENROLLED),
          isNull(users.deletedAt),
          scopedStudentCondition,
        ),
      );

    return courseStats;
  }

  async findCourseAuthorWithinStatisticsScope(courseId: UUIDType, currentUser: CurrentUserType) {
    const [course] = await this.db
      .select({ authorId: courses.authorId })
      .from(courses)
      .where(
        and(
          eq(courses.id, courseId),
          getGroupManagerCourseScopeCondition(currentUser, courses.id, [
            PERMISSIONS.COURSE_STATISTICS,
          ]),
        ),
      );

    return course;
  }

  async findAverageQuizScores(
    courseId: UUIDType,
    language: SupportedLanguages,
    learnerScope: CourseStatisticsLearnerScope,
  ) {
    const activeEnrollment = this.db
      .select({ studentId: studentCourses.studentId })
      .from(studentCourses)
      .innerJoin(users, eq(users.id, studentCourses.studentId))
      .where(
        and(
          eq(studentCourses.studentId, studentLessonProgress.studentId),
          eq(studentCourses.courseId, chapters.courseId),
          eq(studentCourses.status, COURSE_ENROLLMENT.ENROLLED),
          isNull(users.deletedAt),
        ),
      );

    const quizAverages = this.db
      .select({
        quizId: sql<UUIDType>`${lessons.id}`.as("quiz_id"),
        quizName: this.localizationService
          .getLocalizedSqlField(lessons.title, language, courses)
          .as("quiz_name"),
        lessonOrder: sql<number>`${lessons.displayOrder}`.as("lesson_order"),
        averageScore: sql<number>`ROUND(AVG(${studentLessonProgress.quizScore}), 0)`.as(
          "average_score",
        ),
        finishedCount: countDistinct(studentLessonProgress.studentId).as("finished_count"),
      })
      .from(chapters)
      .innerJoin(courses, eq(courses.id, chapters.courseId))
      .innerJoin(lessons, eq(lessons.chapterId, chapters.id))
      .innerJoin(studentLessonProgress, eq(studentLessonProgress.lessonId, lessons.id))
      .where(
        and(
          eq(chapters.courseId, courseId),
          eq(lessons.type, LESSON_TYPES.QUIZ),
          isNotNull(studentLessonProgress.completedAt),
          isNotNull(studentLessonProgress.quizScore),
          exists(activeEnrollment),
          getRestrictedIdsCondition(
            learnerScope.restricted,
            learnerScope.userIds,
            studentLessonProgress.studentId,
          ),
        ),
      )
      .groupBy(
        lessons.id,
        lessons.title,
        lessons.displayOrder,
        courses.availableLocales,
        courses.baseLanguage,
      )
      .as("quiz_averages");

    const [averageScorePerQuiz] = await this.db
      .select({
        averageScoresPerQuiz: sql<CourseAverageQuizScorePerQuiz[]>`COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'quizId', ${quizAverages.quizId},
              'name', ${quizAverages.quizName},
              'averageScore', ${quizAverages.averageScore},
              'finishedCount', ${quizAverages.finishedCount},
              'lessonOrder', ${quizAverages.lessonOrder}
            )
            ORDER BY ${quizAverages.lessonOrder}
          ),
          '[]'::jsonb
        )`,
      })
      .from(quizAverages);

    return averageScorePerQuiz;
  }

  async hasGroupManagerAssignment(managerUserId: UUIDType, groupId: UUIDType) {
    const [assignment] = await this.db
      .select({ id: groupManagerGroups.id })
      .from(groupManagerGroups)
      .where(
        and(
          eq(groupManagerGroups.managerUserId, managerUserId),
          eq(groupManagerGroups.groupId, groupId),
        ),
      );

    return Boolean(assignment);
  }

  async findGroupManagerLearnerIds(managerUserId: UUIDType, groupId?: UUIDType) {
    const learners = await this.db
      .selectDistinct({ userId: groupUsers.userId })
      .from(groupManagerGroups)
      .innerJoin(groupUsers, eq(groupUsers.groupId, groupManagerGroups.groupId))
      .where(
        and(
          eq(groupManagerGroups.managerUserId, managerUserId),
          groupId ? eq(groupUsers.groupId, groupId) : undefined,
        ),
      );

    return learners.map(({ userId }) => userId);
  }

  async findStudentsProgress(
    filters: CourseStatisticsListFilters,
    { page, perPage, sort }: CourseStatisticsPageOptions,
  ) {
    const { courseId } = filters;
    const {
      studentNameExpression,
      lastActivityExpression,
      completedLessonsCountExpression,
      groupNameExpression,
      lastCompletedLessonName,
    } = this.buildStudentCourseStatisticsExpressions(filters);

    return this.db
      .select({
        studentId: sql<UUIDType>`${users.id}`,
        studentName: studentNameExpression,
        studentEmail: users.email,
        studentAvatarKey: users.avatarReference,
        groups: groupNameExpression,
        completedLessonsCount: completedLessonsCountExpression,
        completedAt: sql<string | null>`MAX(${studentCourses.completedAt})`,
        repetitionCompletedLessonsCount: sql<number | null>`${this.db
          .select({ count: sql<number>`${count(studentLessonProgress.id)}::int` })
          .from(courseLearningStates)
          .leftJoin(
            studentLessonProgress,
            and(
              eq(studentLessonProgress.learningStateId, courseLearningStates.id),
              eq(studentLessonProgress.studentId, courseLearningStates.studentId),
              isNotNull(studentLessonProgress.completedAt),
            ),
          )
          .where(
            and(
              eq(courseLearningStates.courseId, courseId),
              eq(courseLearningStates.studentId, users.id),
              eq(courseLearningStates.kind, COURSE_LEARNING_STATE_KINDS.REPETITION),
            ),
          )
          .groupBy(courseLearningStates.id)}`,
        lastActivity: lastActivityExpression,
        lastCompletedLessonName: lastCompletedLessonName,
      })
      .from(studentCourses)
      .leftJoin(users, eq(studentCourses.studentId, users.id))
      .leftJoin(groupUsers, eq(groupUsers.userId, users.id))
      .leftJoin(groups, eq(groups.id, groupUsers.groupId))
      .where(and(...this.buildStudentsProgressConditions(filters)))
      .limit(perPage)
      .offset((page - 1) * perPage)
      .groupBy(users.id)
      .orderBy(this.buildStatisticsOrder(sort, filters));
  }

  async countStudentsProgress(filters: CourseStatisticsListFilters) {
    const [{ totalCount }] = await this.db
      .select({ totalCount: count() })
      .from(studentCourses)
      .leftJoin(users, eq(studentCourses.studentId, users.id))
      .leftJoin(groupUsers, eq(groupUsers.userId, users.id))
      .leftJoin(groups, eq(groups.id, groupUsers.groupId))
      .where(and(...this.buildStudentsProgressConditions(filters)));

    return totalCount;
  }

  async findStudentsQuizResults(
    filters: CourseStudentQuizResultsFilters,
    { page, perPage, sort }: CourseStatisticsPageOptions,
  ) {
    const { lastAttemptExpression, studentNameExpression, quizNameExpression } =
      this.buildStudentCourseStatisticsExpressions(filters);

    return this.db
      .selectDistinct({
        studentId: sql<UUIDType>`${users.id}`,
        studentName: studentNameExpression,
        studentEmail: users.email,
        studentAvatarKey: users.avatarReference,
        lessonId: sql<UUIDType>`${lessons.id}`,
        quizName: quizNameExpression,
        attempts: sql<number>`${studentLessonProgress.attempts}`,
        quizScore: sql<number>`${studentLessonProgress.quizScore}`,
        lastAttempt: lastAttemptExpression,
      })
      .from(studentCourses)
      .leftJoin(users, eq(studentCourses.studentId, users.id))
      .leftJoin(
        studentLessonProgress,
        and(
          eq(studentLessonProgress.studentId, users.id),
          currentLearningState(studentLessonProgress.learningStateId),
        ),
      )
      .leftJoin(lessons, eq(studentLessonProgress.lessonId, lessons.id))
      .leftJoin(chapters, eq(lessons.chapterId, chapters.id))
      .leftJoin(groupUsers, eq(groupUsers.userId, studentLessonProgress.studentId))
      .leftJoin(groups, eq(groupUsers.groupId, groups.id))
      .where(and(...this.buildStudentsQuizResultsConditions(filters)))
      .orderBy(this.buildStatisticsOrder(sort, filters))
      .limit(perPage)
      .offset((page - 1) * perPage);
  }

  async countStudentsQuizResults(filters: CourseStudentQuizResultsFilters) {
    const [{ totalCount }] = await this.db
      .select({
        totalCount: sql<number>`COUNT(DISTINCT (${studentLessonProgress.studentId}, ${studentLessonProgress.lessonId}))::INTEGER`,
      })
      .from(studentLessonProgress)
      .leftJoin(
        studentCourses,
        and(
          eq(studentLessonProgress.studentId, studentCourses.studentId),
          currentLearningState(studentLessonProgress.learningStateId),
        ),
      )
      .leftJoin(lessons, eq(studentLessonProgress.lessonId, lessons.id))
      .leftJoin(chapters, eq(lessons.chapterId, chapters.id))
      .leftJoin(users, eq(studentCourses.studentId, users.id))
      .leftJoin(groupUsers, eq(groupUsers.userId, studentLessonProgress.studentId))
      .leftJoin(groups, eq(groupUsers.groupId, groups.id))
      .where(and(...this.buildStudentsQuizResultsConditions(filters)));

    return totalCount;
  }

  async findStudentsAiMentorResults(
    filters: CourseStudentAiMentorResultsFilters,
    { page, perPage, sort }: CourseStatisticsPageOptions,
  ) {
    const { studentNameExpression } = this.buildStudentCourseStatisticsExpressions(filters);

    return this.db
      .selectDistinct({
        studentId: sql<UUIDType>`${users.id}`,
        studentName: studentNameExpression,
        studentEmail: users.email,
        studentAvatarKey: users.avatarReference,
        lessonId: sql<UUIDType>`${lessons.id}`,
        lessonName: this.buildLessonNameExpression(filters.language),
        score: sql<number>`${aiMentorStudentLessonProgress.percentage}`,
        lastSession: sql<string>`TO_CHAR(${aiMentorStudentLessonProgress.updatedAt}, 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`,
      })
      .from(studentCourses)
      .innerJoin(courses, eq(courses.id, studentCourses.courseId))
      .leftJoin(users, eq(studentCourses.studentId, users.id))
      .leftJoin(groupUsers, eq(groupUsers.userId, users.id))
      .leftJoin(groups, eq(groupUsers.groupId, groups.id))
      .leftJoin(
        studentLessonProgress,
        and(
          eq(studentLessonProgress.studentId, users.id),
          currentLearningState(studentLessonProgress.learningStateId),
        ),
      )
      .leftJoin(
        aiMentorStudentLessonProgress,
        eq(aiMentorStudentLessonProgress.studentLessonProgressId, studentLessonProgress.id),
      )
      .leftJoin(lessons, eq(studentLessonProgress.lessonId, lessons.id))
      .leftJoin(chapters, eq(chapters.id, lessons.chapterId))
      .orderBy(this.buildStatisticsOrder(sort, filters))
      .limit(perPage)
      .offset((page - 1) * perPage)
      .where(and(...this.buildStudentsAiMentorResultsConditions(filters)));
  }

  async countStudentsAiMentorResults(filters: CourseStudentAiMentorResultsFilters) {
    const [{ totalCount }] = await this.db
      .select({
        totalCount: sql<number>`COUNT(DISTINCT (${studentLessonProgress.studentId}, ${studentLessonProgress.lessonId}))::INTEGER`,
      })
      .from(aiMentorStudentLessonProgress)
      .leftJoin(
        studentLessonProgress,
        eq(aiMentorStudentLessonProgress.studentLessonProgressId, studentLessonProgress.id),
      )
      .leftJoin(
        studentCourses,
        and(
          eq(studentLessonProgress.studentId, studentCourses.studentId),
          currentLearningState(studentLessonProgress.learningStateId),
        ),
      )
      .leftJoin(users, eq(studentCourses.studentId, users.id))
      .leftJoin(groupUsers, eq(groupUsers.userId, users.id))
      .leftJoin(groups, eq(groupUsers.groupId, groups.id))
      .leftJoin(lessons, eq(studentLessonProgress.lessonId, lessons.id))
      .leftJoin(chapters, eq(chapters.id, lessons.chapterId))
      .leftJoin(courses, eq(chapters.courseId, courses.id))
      .where(and(...this.buildStudentsAiMentorResultsConditions(filters)));

    return totalCount;
  }

  private buildStudentsProgressConditions({
    courseId,
    searchQuery,
    language,
    learnerScope,
  }: CourseStatisticsListFilters) {
    return [
      eq(studentCourses.courseId, courseId),
      this.buildSearchQueryCondition(searchQuery, language),
      eq(studentCourses.status, COURSE_ENROLLMENT.ENROLLED),
      isNull(users.deletedAt),
      this.buildLearnerScopeCondition(learnerScope),
    ];
  }

  private buildStudentsQuizResultsConditions(filters: CourseStudentQuizResultsFilters) {
    const { courseId, searchQuery, language, learnerScope, quizId } = filters;
    const { quizNameExpression } = this.buildStudentCourseStatisticsExpressions(filters);

    return [
      eq(studentCourses.courseId, courseId),
      isNotNull(studentLessonProgress.completedAt),
      isNotNull(studentLessonProgress.attempts),
      eq(studentCourses.status, COURSE_ENROLLMENT.ENROLLED),
      eq(chapters.courseId, courseId),
      isNull(users.deletedAt),
      or(
        sql`${quizNameExpression} ILIKE ${`%${searchQuery}%`}`,
        this.buildSearchQueryCondition(searchQuery, language),
      ),
      quizId ? eq(lessons.id, quizId) : undefined,
      this.buildLearnerScopeCondition(learnerScope),
    ];
  }

  private buildStudentsAiMentorResultsConditions({
    courseId,
    searchQuery,
    language,
    learnerScope,
    lessonId,
  }: CourseStudentAiMentorResultsFilters) {
    return [
      eq(studentCourses.courseId, courseId),
      eq(lessons.type, LESSON_TYPES.AI_MENTOR),
      eq(studentLessonProgress.id, aiMentorStudentLessonProgress.studentLessonProgressId),
      eq(studentCourses.status, COURSE_ENROLLMENT.ENROLLED),
      eq(chapters.courseId, courseId),
      isNull(users.deletedAt),
      or(
        this.buildSearchQueryCondition(searchQuery, language),
        sql`${this.buildLessonNameExpression(language)} ILIKE ${`%${searchQuery}%`}`,
      ),
      lessonId ? eq(lessons.id, lessonId) : undefined,
      this.buildLearnerScopeCondition(learnerScope),
    ];
  }

  private buildLearnerScopeCondition({ restricted, userIds }: CourseStatisticsLearnerScope) {
    return getRestrictedIdsCondition(restricted, userIds, studentCourses.studentId);
  }

  private buildSearchQueryCondition(searchQuery: string, language?: SupportedLanguages) {
    return or(
      getUserNameSearchCondition(searchQuery),
      this.localizationService.getLocalizedFieldSearchCondition(
        groups.name,
        `%${searchQuery}%`,
        language,
      ),
    );
  }

  private buildLessonNameExpression(language: SupportedLanguages) {
    return this.localizationService.getLocalizedSqlField(lessons.title, language);
  }

  private buildStatisticsOrder(sort: string, expressionsParams: CourseStatisticsExpressionsParams) {
    const { sortOrder, sortedField } = getSortOptions(sort);

    return sortOrder(
      this.buildStatisticsSortColumn(sortedField as CourseStatisticsSortField, expressionsParams),
    );
  }

  private buildStatisticsSortColumn(
    sort: CourseStatisticsSortField,
    expressionsParams: CourseStatisticsExpressionsParams,
  ) {
    const {
      lastAttemptExpression,
      studentNameExpression,
      quizNameExpression,
      groupNameExpression,
      lastActivityExpression,
      completedLessonsCountExpression,
      lastCompletedLessonName,
    } = this.buildStudentCourseStatisticsExpressions(expressionsParams);

    return match<string, SQL | AnyPgColumn>(sort)
      .with(CourseStudentProgressionSortFields.studentName, () => studentNameExpression)
      .with(CourseStudentProgressionSortFields.groupName, () => groupNameExpression)
      .with(CourseStudentProgressionSortFields.lastActivity, () => lastActivityExpression)
      .with(
        CourseStudentProgressionSortFields.completedLessonsCount,
        () => completedLessonsCountExpression,
      )
      .with(CourseStudentQuizResultsSortFields.quizName, () => quizNameExpression)
      .with(CourseStudentQuizResultsSortFields.lastAttempt, () => lastAttemptExpression)
      .with(CourseStudentQuizResultsSortFields.attempts, () => studentLessonProgress.attempts)
      .with(CourseStudentQuizResultsSortFields.quizScore, () => studentLessonProgress.quizScore)
      .with(CourseStudentAiMentorResultsSortFields.lessonName, () =>
        this.buildLessonNameExpression(expressionsParams.language),
      )
      .with(
        CourseStudentAiMentorResultsSortFields.score,
        () => aiMentorStudentLessonProgress.percentage,
      )
      .with(
        CourseStudentAiMentorResultsSortFields.lastSession,
        () => aiMentorStudentLessonProgress.updatedAt,
      )
      .with(
        CourseStudentAiMentorResultsSortFields.lastCompletedLessonName,
        () => lastCompletedLessonName,
      )
      .otherwise(() => studentNameExpression);
  }

  private buildStudentCourseStatisticsExpressions({
    courseId,
    language,
    currentUser,
  }: CourseStatisticsExpressionsParams) {
    const studentNameExpression = sql<string>`CONCAT(${users.firstName} || ' ' || ${users.lastName})`;

    const lastActivityExpression = sql<string | null>`(
          SELECT TO_CHAR(MAX(slp.completed_at), 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
          FROM ${studentLessonProgress} slp
          JOIN ${lessons} l ON slp.lesson_id = l.id
          JOIN ${chapters} ch ON l.chapter_id = ch.id
          WHERE ${currentLearningState(sql.raw("slp.learning_state_id"))} AND slp.student_id = ${
            users.id
          }
            AND ch.course_id = ${courseId}
        )`;

    const completedLessonsCountExpression = sql<number>`COALESCE((
          SELECT COUNT(*)
          FROM ${studentLessonProgress} slp
          JOIN ${lessons} l ON slp.lesson_id = l.id
          JOIN ${chapters} ch ON l.chapter_id = ch.id
          WHERE ${currentLearningState(sql.raw("slp.learning_state_id"))} AND slp.student_id = ${
            users.id
          }
            AND ch.course_id = ${courseId}
            AND slp.completed_at IS NOT NULL
        ), 0)::float`;

    const managedGroupCondition = currentUser
      ? getGroupManagerGroupScopeCondition(currentUser, groups.id, [PERMISSIONS.COURSE_STATISTICS])
      : undefined;

    const localizedGroupName = this.localizationService.getLocalizedSqlField(
      groups.name,
      language,
      groups,
    );

    const groupNamesQuery = this.db
      .select({
        groups: sql<LocalizedGroup[]>`json_agg(
          json_build_object(
            'id', ${groups.id},
            'name', ${localizedGroupName}
          )
        )`,
      })
      .from(groups)
      .innerJoin(groupUsers, eq(groupUsers.groupId, groups.id))
      .where(and(eq(groupUsers.userId, users.id), managedGroupCondition));
    const groupNameExpression = sql<LocalizedGroup[]>`(${groupNamesQuery})`;

    const lastAttemptExpression = sql<string>`(
          SELECT TO_CHAR(MAX(slp.updated_at), 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
          FROM ${studentLessonProgress} slp
          JOIN ${lessons} l ON slp.lesson_id = l.id
          JOIN ${chapters} ch ON l.chapter_id = ch.id
          WHERE ${currentLearningState(sql.raw("slp.learning_state_id"))} AND slp.student_id = ${
            users.id
          }
            AND slp.chapter_id = ch.id
            AND ch.course_id = ${courseId}
        )`;

    const quizNameExpression = sql<string>`(
          SELECT ${this.localizationService.getLocalizedSqlField(
            lessons.title,
            language,
            courses,
            "c",
          )}
          FROM ${lessons}
          JOIN ${chapters} ch ON ch.id = lessons.chapter_id
          JOIN ${courses} c ON c.id = ch.course_id
          WHERE lessons.id = ${studentLessonProgress.lessonId}
            AND lessons.type = 'quiz'
        )`;

    const lastCompletedLessonName = sql<string>`(
          SELECT ${this.localizationService.getLocalizedSqlField(
            lessons.title,
            language,
            courses,
            "c",
          )}
          FROM ${studentLessonProgress} slp
          JOIN ${lessons} ON slp.lesson_id = lessons.id
          JOIN ${chapters} ch ON lessons.chapter_id = ch.id
          JOIN ${courses} c ON c.id = ch.course_id
          WHERE ${currentLearningState(sql.raw("slp.learning_state_id"))} AND slp.student_id = ${
            users.id
          }
            AND ch.course_id = ${courseId}
            AND slp.completed_at IS NOT NULL
          ORDER BY slp.completed_at DESC
          LIMIT 1
        )`;

    return {
      studentNameExpression,
      lastActivityExpression,
      completedLessonsCountExpression,
      groupNameExpression,
      lastAttemptExpression,
      quizNameExpression,
      lastCompletedLessonName,
    };
  }
}
