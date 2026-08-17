import { Injectable } from "@nestjs/common";
import { PERMISSIONS } from "@repo/shared";
import {
  differenceInDays,
  eachDayOfInterval,
  endOfMonth,
  format,
  startOfDay,
  startOfMonth,
  subDays,
} from "date-fns";

import { hasPermission } from "src/common/permissions/permission.utils";
import { UserFirstLoginEvent } from "src/events/user/user-first-login.event";
import { FileService } from "src/file/file.service";
import { IMAGE_QUALITY } from "src/file/image-variants/image-variant.constants";
import { OutboxPublisher } from "src/outbox/outbox.publisher";
import { StatisticsRepository } from "src/statistics/repositories/statistics.repository";

import type {
  CourseStudentsStatsByMonth,
  DashboardDeadlineRiskCourse,
  DashboardDeadlineRiskCourseSummary,
  DashboardDeadlineRiskGroup,
  DashboardDeadlineRiskSummary,
  DashboardDeadlineRiskType,
  DashboardIncompleteCourses,
  DashboardTrainingCompletion,
  StatsByMonth,
  UserStats,
} from "./schemas/userStats.schema";
import type {
  DashboardDeadlineRiskType as SharedDashboardDeadlineRiskType,
  DashboardDeadlineRiskGroupSortField,
  DashboardDeadlineRiskSortDirection,
  DashboardDeadlineRiskUrgencyOrder,
  SupportedLanguages,
} from "@repo/shared";
import type { UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";

@Injectable()
export class StatisticsService {
  constructor(
    private readonly statisticsRepository: StatisticsRepository,
    private readonly fileService: FileService,
    private readonly outboxPublisher: OutboxPublisher,
  ) {}

  async getUserStats(userId: UUIDType, language: SupportedLanguages): Promise<UserStats> {
    const coursesStatsByMonth: StatsByMonth[] =
      await this.statisticsRepository.getCoursesStatsByMonth(userId);
    const coursesTotalStats = this.calculateTotalStats(coursesStatsByMonth);

    const lessonsStatsByMonth: StatsByMonth[] =
      await this.statisticsRepository.getLessonsStatsByMonth(userId);
    const lessonsTotalStats = this.calculateTotalStats(lessonsStatsByMonth);

    const quizStats = await this.statisticsRepository.getQuizStats(userId);
    const nextLesson = await this.getLastLesson(userId, language);

    const activityStats = (await this.statisticsRepository.getActivityStats(userId)) ?? {};

    return {
      courses: this.formatStats(coursesStatsByMonth),
      lessons: this.formatStats(lessonsStatsByMonth),
      quizzes: {
        totalAttempts: quizStats.totalAttempts,
        totalCorrectAnswers: quizStats.totalCorrectAnswers,
        totalWrongAnswers: quizStats.totalWrongAnswers,
        totalQuestions: quizStats.totalQuestions,
        averageScore: quizStats.averageScore,
        uniqueQuizzesTaken: quizStats.uniqueQuizzesTaken,
      },
      averageStats: {
        lessonStats: lessonsTotalStats,
        courseStats: coursesTotalStats,
      },
      nextLesson,
      streak: {
        current: activityStats.currentStreak ?? 0,
        longest: activityStats.longestStreak ?? 0,
        activityHistory: activityStats.activityHistory || {},
      },
    };
  }

  async getStats(currentUser: CurrentUserType, language: SupportedLanguages) {
    const canReadAll = hasPermission(currentUser.permissions, PERMISSIONS.COURSE_UPDATE);
    const ownerUserId = canReadAll ? undefined : currentUser.userId;

    const fiveMostPopularCourses = await this.statisticsRepository.getFiveMostPopularCourses(
      ownerUserId,
      language,
    );
    const [totalCoursesCompletionStats] =
      await this.statisticsRepository.getTotalCoursesCompletion(ownerUserId);
    const [conversionAfterFreemiumLesson] =
      await this.statisticsRepository.getConversionAfterFreemiumLesson(ownerUserId);
    const courseStudentsStats = await this.statisticsRepository.getCourseStudentsStats(ownerUserId);
    const [avgQuizScore] = await this.statisticsRepository.getAvgQuizScore(ownerUserId);

    return {
      fiveMostPopularCourses,
      totalCoursesCompletionStats,
      conversionAfterFreemiumLesson,
      courseStudentsStats: this.formatCourseStudentStats(courseStudentsStats),
      avgQuizScore: {
        correctAnswerCount: avgQuizScore.correctAnswersCount,
        wrongAnswerCount: avgQuizScore.wrongAnswersCount,
        answerCount: avgQuizScore.correctAnswersCount + avgQuizScore.wrongAnswersCount,
      },
    };
  }

  async getDashboardTrainingCompletion(
    currentUser: CurrentUserType,
  ): Promise<DashboardTrainingCompletion> {
    const ownerUserId = this.getDashboardOwnerUserId(currentUser);
    const trainingCompletion =
      await this.statisticsRepository.getDashboardTrainingCompletion(ownerUserId);
    const total = trainingCompletion?.total ?? 0;
    const completed = trainingCompletion?.completed ?? 0;

    return {
      completed,
      inProgress: trainingCompletion?.inProgress ?? 0,
      notStarted: trainingCompletion?.notStarted ?? 0,
      total,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  }

  async getDashboardDeadlineRiskSummary(
    currentUser: CurrentUserType,
  ): Promise<DashboardDeadlineRiskSummary> {
    const ownerUserId = this.getDashboardOwnerUserId(currentUser);
    const deadlineRisks =
      await this.statisticsRepository.getDashboardDeadlineRiskCounts(ownerUserId);

    return {
      overdueCount: deadlineRisks?.overdueCount ?? 0,
      dueSoonCount: deadlineRisks?.dueSoonCount ?? 0,
    };
  }

  async getDashboardIncompleteCourses(
    currentUser: CurrentUserType,
    language: SupportedLanguages,
  ): Promise<DashboardIncompleteCourses> {
    const ownerUserId = this.getDashboardOwnerUserId(currentUser);
    const [courses, trainingCompletion] = await Promise.all([
      this.statisticsRepository.getDashboardIncompleteCourses(ownerUserId, language),
      this.statisticsRepository.getDashboardTrainingCompletion(ownerUserId),
    ]);

    return {
      hasEnrollments: (trainingCompletion?.total ?? 0) > 0,
      courses,
    };
  }

  async getDashboardDeadlineRisks(
    currentUser: CurrentUserType,
    language: SupportedLanguages,
    riskType: DashboardDeadlineRiskType,
    page: number,
    perPage: number,
  ) {
    const ownerUserId = this.getDashboardOwnerUserId(currentUser);
    const { rows, totalItems } = await this.statisticsRepository.getDashboardDeadlineRisks(
      ownerUserId,
      language,
      riskType,
      page,
      perPage,
    );
    const courses = new Map<string, DashboardDeadlineRiskCourse>();

    for (const row of rows) {
      const course = courses.get(row.courseId) ?? {
        id: row.courseId,
        title: row.courseTitle,
        students: [],
      };
      course.students.push({
        id: row.studentId,
        name: row.studentName,
        dueDate: row.dueDate,
      });
      courses.set(row.courseId, course);
    }

    return {
      data: [...courses.values()],
      pagination: { totalItems, page, perPage },
    };
  }

  async getDashboardDeadlineRiskCourseSummaries(
    currentUser: CurrentUserType,
    language: SupportedLanguages,
    urgencyOrder: DashboardDeadlineRiskUrgencyOrder,
    page: number,
    perPage: number,
  ): Promise<{
    data: DashboardDeadlineRiskCourseSummary[];
    pagination: { totalItems: number; page: number; perPage: number };
  }> {
    const ownerUserId = this.getDashboardOwnerUserId(currentUser);
    const { data, totalItems } =
      await this.statisticsRepository.getDashboardDeadlineRiskCourseSummaries(
        ownerUserId,
        language,
        urgencyOrder,
        page,
        perPage,
      );
    const coursesWithThumbnails = await Promise.all(
      data.map(async ({ thumbnailUrl, ...course }) => ({
        ...course,
        thumbnailUrl: thumbnailUrl
          ? await this.fileService.getFileUrl(thumbnailUrl, { quality: IMAGE_QUALITY.SM })
          : null,
      })),
    );

    return { data: coursesWithThumbnails, pagination: { totalItems, page, perPage } };
  }

  async getDashboardDeadlineRiskGroups(
    currentUser: CurrentUserType,
    courseId: UUIDType,
    language: SupportedLanguages,
    urgency: SharedDashboardDeadlineRiskType | undefined,
    search: string | undefined,
    sortBy: DashboardDeadlineRiskGroupSortField,
    sortDirection: DashboardDeadlineRiskSortDirection,
    page: number,
    perPage: number,
  ): Promise<{
    data: DashboardDeadlineRiskGroup[];
    pagination: { totalItems: number; page: number; perPage: number };
  }> {
    const ownerUserId = this.getDashboardOwnerUserId(currentUser);
    const { data, totalItems } = await this.statisticsRepository.getDashboardDeadlineRiskGroups(
      ownerUserId,
      courseId,
      language,
      urgency,
      search?.trim() || undefined,
      sortBy,
      sortDirection,
      page,
      perPage,
    );
    return { data, pagination: { totalItems, page, perPage } };
  }

  private getDashboardOwnerUserId(currentUser: CurrentUserType): UUIDType | undefined {
    return hasPermission(currentUser.permissions, PERMISSIONS.COURSE_UPDATE)
      ? undefined
      : currentUser.userId;
  }

  async getAdminStats() {
    const fiveMostPopularCourses = await this.statisticsRepository.getFiveMostPopularCourses();
    const [totalCoursesCompletionStats] =
      await this.statisticsRepository.getTotalCoursesCompletion();
    const [conversionAfterFreemiumLesson] =
      await this.statisticsRepository.getConversionAfterFreemiumLesson();
    const courseStudentsStats = await this.statisticsRepository.getCourseStudentsStats();
    const [avgQuizScore] = await this.statisticsRepository.getAvgQuizScore();

    return {
      fiveMostPopularCourses,
      totalCoursesCompletionStats,
      conversionAfterFreemiumLesson,
      courseStudentsStats: this.formatCourseStudentStats(courseStudentsStats),
      avgQuizScore: {
        correctAnswerCount: avgQuizScore.correctAnswersCount,
        wrongAnswerCount: avgQuizScore.wrongAnswersCount,
        answerCount: avgQuizScore.correctAnswersCount + avgQuizScore.wrongAnswersCount,
      },
    };
  }

  async createQuizAttempt(data: {
    userId: UUIDType;
    courseId: UUIDType;
    lessonId: UUIDType;
    correctAnswers: number;
    wrongAnswers: number;
    score: number;
  }) {
    await this.statisticsRepository.createQuizAttempt(data);
  }

  async updateUserActivity(userId: UUIDType) {
    const today = startOfDay(new Date());
    const formattedTodayDate = format(today, "yyyy-MM-dd");

    const currentStats = await this.statisticsRepository.getActivityStats(userId);

    if (!currentStats) await this.outboxPublisher.publish(new UserFirstLoginEvent({ userId }));

    const lastActivityDate = currentStats?.lastActivityDate
      ? startOfDay(new Date(currentStats.lastActivityDate))
      : null;

    const newCurrentStreak = (() => {
      if (!lastActivityDate) return 1;

      const daysDiff = differenceInDays(today, lastActivityDate);

      switch (daysDiff) {
        case 0:
          return currentStats?.currentStreak ?? 1;
        case 1:
          return (currentStats?.currentStreak ?? 0) + 1;
        default:
          return 1;
      }
    })();

    const newLongestStreak = Math.max(newCurrentStreak, currentStats?.longestStreak ?? 0);

    const isUserLoggedInToday = currentStats?.activityHistory?.[formattedTodayDate] ?? false;
    if (isUserLoggedInToday) {
      return;
    }

    const dateRange = lastActivityDate
      ? eachDayOfInterval({ start: lastActivityDate, end: today })
      : [today];

    const newActivityHistory = dateRange.reduce(
      (acc, date) => {
        const dateStr = format(date, "yyyy-MM-dd");
        if (!acc[dateStr]) {
          acc[dateStr] = dateStr === formattedTodayDate;
        }
        return acc;
      },
      { ...(currentStats?.activityHistory ?? {}) },
    );

    await this.statisticsRepository.upsertUserStatistic(userId, {
      currentStreak: newCurrentStreak,
      longestStreak: newLongestStreak,
      lastActivityDate: today,
      activityHistory: newActivityHistory,
    });
  }

  async refreshCourseStudentsStats() {
    const yesterday = subDays(new Date(), 1);
    const startDate = startOfMonth(yesterday).toISOString();
    const endDate = endOfMonth(yesterday).toISOString();

    await this.statisticsRepository.calculateCoursesStudentsStats(startDate, endDate);
  }

  private calculateTotalStats(coursesStatsByMonth: StatsByMonth[]) {
    const totalStats = coursesStatsByMonth.reduce(
      (acc, curr) => {
        acc.started += curr.started;
        acc.completed += curr.completed;
        return acc;
      },
      { started: 0, completed: 0, completionRate: 0 },
    );

    totalStats.completionRate =
      totalStats.started > 0 ? Math.round((totalStats.completed / totalStats.started) * 100) : 0;

    return totalStats;
  }

  private formatStats = (stats: StatsByMonth[]) => {
    const monthlyStats: { [key: string]: Omit<StatsByMonth, "month"> } = {};

    const currentDate = new Date();
    for (let index = 11; index >= 0; index--) {
      const month = format(
        new Date(currentDate.getFullYear(), currentDate.getMonth() - index, 1),
        "MMMM",
      );
      monthlyStats[month] = {
        started: 0,
        completed: 0,
        completionRate: 0,
      };
    }

    for (const stat of stats) {
      const month = format(new Date(stat.month), "MMMM");
      monthlyStats[month] = {
        started: stat.started,
        completed: stat.completed,
        completionRate: stat.completionRate,
      };
    }

    return monthlyStats;
  };

  private formatCourseStudentStats(stats: CourseStudentsStatsByMonth[]) {
    const monthlyStats: { [key: string]: Omit<CourseStudentsStatsByMonth, "month"> } = {};

    const currentDate = new Date();
    for (let index = 11; index >= 0; index--) {
      const month = format(
        new Date(currentDate.getFullYear(), currentDate.getMonth() - index, 1),
        "MMMM",
      );
      monthlyStats[month] = {
        newStudentsCount: 0,
      };
    }

    for (const stat of stats) {
      const month = format(new Date(stat.month), "MMMM");
      monthlyStats[month] = {
        newStudentsCount: stat.newStudentsCount,
      };
    }

    return monthlyStats;
  }

  private async getLastLesson(userId: UUIDType, language: SupportedLanguages) {
    const nextLesson = await this.statisticsRepository.getNextLessonForStudent(userId, language);

    if (!nextLesson) return null;

    const courseThumbnail = await this.fileService.getFileUrl(nextLesson.courseThumbnail, {
      quality: IMAGE_QUALITY.SM,
    });

    return { ...nextLesson, courseThumbnail };
  }

  async getInactiveStudents(inactivityDays: number) {
    return this.statisticsRepository.getInactiveStudents(inactivityDays);
  }

  async getRecentCoursesForStudents(studentIds: UUIDType[]) {
    return this.statisticsRepository.getMostRecentCourseForStudents(studentIds);
  }
}
