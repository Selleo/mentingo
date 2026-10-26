import {
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PERMISSIONS, type SupportedLanguages } from "@repo/shared";

import { DEFAULT_PAGE_SIZE } from "src/common/pagination";
import { canUpdateCourseByAuthor } from "src/common/permissions/course-permission.utils";
import { shouldApplyGroupManagerScope } from "src/common/permissions/group-manager-scope.utils";
import { LearningTimeRepository } from "src/learning-time";
import { UserService } from "src/user/user.service";

import {
  CourseStudentProgressionSortFields,
  CourseStudentQuizResultsSortFields,
} from "../schemas/courseQuery";

import { CourseStatisticsRepository } from "./course-statistics.repository";

import type { CourseStatisticsLearnerScope } from "./course-statistics.types";
import type {
  CourseAverageQuizScoresResponse,
  CourseStatisticsQueryBody,
  CourseStatisticsResponse,
} from "../schemas/course.schema";
import type {
  CourseStudentAiMentorResultsQuery,
  CourseStudentProgressionQuery,
  CourseStudentQuizResultsQuery,
} from "../schemas/courseQuery";
import type { UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";

@Injectable()
export class CourseStatisticsService {
  constructor(
    private readonly courseStatisticsRepository: CourseStatisticsRepository,
    private readonly learningTimeRepository: LearningTimeRepository,
    @Inject(forwardRef(() => UserService)) private readonly userService: UserService,
  ) {}

  async getCourseStatistics(
    courseId: UUIDType,
    query: CourseStatisticsQueryBody,
    currentUser: CurrentUserType,
  ): Promise<CourseStatisticsResponse> {
    const learnerScope = await this.getCourseStatisticsLearnerScope(query.groupId, currentUser);

    const courseStats = await this.courseStatisticsRepository.findCourseStatisticsSummary(
      courseId,
      learnerScope,
    );

    const courseLearningTime = await this.learningTimeRepository.getCourseTotalLearningTime(
      courseId,
      learnerScope.restricted ? learnerScope.userIds : undefined,
    );

    return { ...courseStats, averageSeconds: courseLearningTime.averageSeconds };
  }

  /** Allows course editors, and group managers for courses assigned to their groups. */
  async assertCanViewCourseStatistics(
    courseId: UUIDType,
    currentUser: CurrentUserType,
  ): Promise<void> {
    const course = await this.courseStatisticsRepository.findCourseAuthorWithinStatisticsScope(
      courseId,
      currentUser,
    );

    if (!course) throw new NotFoundException("adminCourseView.errors.notFound.course");

    if (
      !shouldApplyGroupManagerScope(currentUser, [PERMISSIONS.COURSE_STATISTICS]) &&
      !canUpdateCourseByAuthor(currentUser, course.authorId)
    ) {
      throw new ForbiddenException("adminCourseView.errors.statisticsAccessForbidden");
    }
  }

  async getAverageQuizScoreForCourse(
    courseId: UUIDType,
    query: CourseStatisticsQueryBody,
    language: SupportedLanguages,
    currentUser: CurrentUserType,
  ): Promise<CourseAverageQuizScoresResponse> {
    const learnerScope = await this.getCourseStatisticsLearnerScope(query.groupId, currentUser);

    if (learnerScope.restricted && learnerScope.userIds.length === 0) {
      return { averageScoresPerQuiz: [] };
    }

    const averageScorePerQuiz = await this.courseStatisticsRepository.findAverageQuizScores(
      courseId,
      language,
      learnerScope,
    );

    return averageScorePerQuiz ?? { averageScoresPerQuiz: [] };
  }

  async getStudentsProgress(query: CourseStudentProgressionQuery, currentUser: CurrentUserType) {
    const {
      courseId,
      sort = CourseStudentProgressionSortFields.studentName,
      perPage = DEFAULT_PAGE_SIZE,
      page = 1,
      searchQuery = "",
      language,
      groupId,
    } = query;

    const filters = {
      courseId,
      language,
      currentUser,
      searchQuery,
      learnerScope: await this.getCourseStatisticsLearnerScope(groupId, currentUser),
    };

    const studentsProgress = await this.courseStatisticsRepository.findStudentsProgress(filters, {
      page,
      perPage,
      sort,
    });
    const totalCount = await this.courseStatisticsRepository.countStudentsProgress(filters);

    return {
      data: await this.attachStudentAvatarUrls(studentsProgress),
      pagination: { page, perPage, totalItems: totalCount },
    };
  }

  async getStudentsQuizResults(query: CourseStudentQuizResultsQuery, currentUser: CurrentUserType) {
    const {
      courseId,
      page = 1,
      perPage = DEFAULT_PAGE_SIZE,
      quizId = "",
      sort = CourseStudentQuizResultsSortFields.studentName,
      language,
      searchQuery = "",
      groupId,
    } = query;

    const filters = {
      courseId,
      language,
      currentUser,
      searchQuery,
      quizId,
      learnerScope: await this.getCourseStatisticsLearnerScope(groupId, currentUser),
    };

    const quizResults = await this.courseStatisticsRepository.findStudentsQuizResults(filters, {
      page,
      perPage,
      sort,
    });
    const totalCount = await this.courseStatisticsRepository.countStudentsQuizResults(filters);

    return {
      data: await this.attachStudentAvatarUrls(quizResults),
      pagination: { page, perPage, totalItems: totalCount },
    };
  }

  async getStudentsAiMentorResults(
    query: CourseStudentAiMentorResultsQuery,
    currentUser: CurrentUserType,
  ) {
    const {
      courseId,
      page = 1,
      perPage = DEFAULT_PAGE_SIZE,
      lessonId = "",
      searchQuery = "",
      sort = CourseStudentQuizResultsSortFields.studentName,
      language,
      groupId,
    } = query;

    const filters = {
      courseId,
      language,
      currentUser,
      searchQuery,
      lessonId,
      learnerScope: await this.getCourseStatisticsLearnerScope(groupId, currentUser),
    };

    const aiMentorResults = await this.courseStatisticsRepository.findStudentsAiMentorResults(
      filters,
      { page, perPage, sort },
    );
    const totalCount = await this.courseStatisticsRepository.countStudentsAiMentorResults(filters);

    return {
      data: await this.attachStudentAvatarUrls(aiMentorResults),
      pagination: { page, perPage, totalItems: totalCount },
    };
  }

  /**
   * Group managers only see learners from groups they manage; everyone else is limited to the
   * requested group, if any.
   */
  private async getCourseStatisticsLearnerScope(
    groupId: UUIDType | undefined,
    currentUser: CurrentUserType,
  ): Promise<CourseStatisticsLearnerScope> {
    const isManagerScoped = shouldApplyGroupManagerScope(currentUser, [
      PERMISSIONS.COURSE_STATISTICS,
    ]);

    if (!isManagerScoped) {
      return {
        restricted: Boolean(groupId),
        userIds: await this.getUserIdsByGroup(groupId),
      };
    }

    if (groupId) {
      const managesGroup = await this.courseStatisticsRepository.hasGroupManagerAssignment(
        currentUser.userId,
        groupId,
      );

      if (!managesGroup) throw new NotFoundException("common.toast.notFound");
    }

    const userIds = await this.courseStatisticsRepository.findGroupManagerLearnerIds(
      currentUser.userId,
      groupId,
    );

    return { restricted: true, userIds };
  }

  private async getUserIdsByGroup(groupId?: UUIDType) {
    if (!groupId) return [];

    const students = await this.learningTimeRepository.getStudentsByGroup(groupId);

    return students.map(({ id }) => id);
  }

  private async attachStudentAvatarUrls<T extends { studentAvatarKey: string | null }>(rows: T[]) {
    return Promise.all(
      rows.map(async (row) => ({
        ...row,
        studentAvatarUrl: row.studentAvatarKey
          ? await this.userService.getUsersProfilePictureUrl(row.studentAvatarKey)
          : null,
      })),
    );
  }
}
