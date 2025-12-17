import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { EventBus } from "@nestjs/cqrs";
import { COURSE_ENROLLMENT } from "@repo/shared";
import {
  and,
  count,
  eq,
  getTableColumns,
  ilike,
  inArray,
  isNotNull,
  isNull,
  or,
  sql,
} from "drizzle-orm";
import { isEmpty, isEqual } from "lodash";

import { DatabasePg } from "src/common";
import { buildJsonbField, deleteJsonbField } from "src/common/helpers/sqlHelpers";
import { DEFAULT_PAGE_SIZE } from "src/common/pagination";
import { UpdateHasCertificateEvent } from "src/courses/events/updateHasCertificate.event";
import { EnvService } from "src/env/services/env.service";
import {
  CreateCourseEvent,
  UpdateCourseEvent, EnrollCourseEvent
} from "src/events";
import { UsersAssignedToCourseEvent } from "src/events/user/user-assigned-to-course.event";
import { LESSON_TYPES } from "src/lesson/lesson.type";
import { LessonRepository } from "src/lesson/repositories/lesson.repository";
import { AdminLessonService } from "src/lesson/services/adminLesson.service";
import { LocalizationService } from "src/localization/localization.service";
import { ENTITY_TYPE } from "src/localization/localization.types";
import { SettingsService } from "src/settings/settings.service";
import { StatisticsRepository } from "src/statistics/repositories/statistics.repository";
import { StripeService } from "src/stripe/stripe.service";
import { USER_ROLES } from "src/user/schemas/userRoles";
import { UserService } from "src/user/user.service";
import { settingsToJSONBuildObject } from "src/utils/settings-to-json-build-object";

import { getSortOptions } from "../common/helpers/getSortOptions";
import {
  aiMentorStudentLessonProgress,
  categories,
  certificates,
  chapters,
  courses,
  coursesSummaryStats,
  groupCourses,
  groups,
  groupUsers,
  lessons,
  questionAnswerOptions,
  questions,
  quizAttempts,
  studentChapterProgress,
  studentCourses,
  studentLessonProgress,
  users,
} from "../storage/schema";

import { LESSON_SEQUENCE_ENABLED } from "./constants";
import { EnrollGroupsToCourseService } from "./operations/commands/enroll-groups-to-course.command";
import { UnenrollGroupsFromCoursesService } from "./operations/commands/unenroll-groups-from-courses.command";
import { UpdateCourseService } from "./operations/commands/update-course-command";
import { GetAvailableCoursesService } from "./operations/queries/get-available-courses.service";
import { GetBetaCourseByIdService } from "./operations/queries/get-beta-course-by-id.service";
import { GetContentCreatorCoursesService } from "./operations/queries/get-content-creator-courses.service";
import { GetCourseService } from "./operations/queries/get-course.service";
import { GetCoursesForUserService } from "./operations/queries/get-courses-for-user.service";
import { GetStudentsWithEnrollmentDateService } from "./operations/queries/get-students-with-enrollment-date.service";
import { GetAllCoursesService } from "./operations/queries/index";
import {
  CourseStudentAiMentorResultsSortFields,
  CourseStudentProgressionSortFields,
  CourseStudentQuizResultsSortFields,
} from "./schemas/courseQuery";


import type {
  CourseAverageQuizScorePerQuiz,
  CourseAverageQuizScoresResponse,
  CourseStatisticsResponse,
  CourseStatusDistribution,
  LessonSequenceEnabledResponse,
} from "./schemas/course.schema";
import type {
  CourseEnrollmentScope,
  CoursesQuery,
  CourseStudentAiMentorResultsQuery,
  CourseStudentAiMentorResultsSortField,
  CourseStudentProgressionQuery,
  CourseStudentProgressionSortField,
  CourseStudentQuizResultsQuery,
  CourseStudentQuizResultsSortField,
  EnrolledStudentFilterSchema,
} from "./schemas/courseQuery";
import type { CreateCourseBody } from "./schemas/createCourse.schema";
import type { CreateCoursesEnrollment } from "./schemas/createCoursesEnrollment";
import type { StudentCourseSelect } from "./schemas/enrolledStudent.schema";
import type { UpdateCourseBody } from "./schemas/updateCourse.schema";
import type { SupportedLanguages } from "@repo/shared";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { CourseActivityLogSnapshot } from "src/activity-logs/types";
import type { UUIDType } from "src/common";
import type { CurrentUser } from "src/common/types/current-user.type";
import type * as schema from "src/storage/schema";
import type { UserRole } from "src/user/schemas/userRoles";

@Injectable()
export class CourseService {
  constructor(
    @Inject("DB") private readonly db: DatabasePg,
    private readonly lessonRepository: LessonRepository,
    private readonly statisticsRepository: StatisticsRepository,
    private readonly settingsService: SettingsService,
    private readonly stripeService: StripeService,
    private readonly envService: EnvService,
    private readonly localizationService: LocalizationService,
    private readonly eventBus: EventBus,
    private readonly adminLessonService: AdminLessonService,
    private readonly getAllCoursesService: GetAllCoursesService,
    private readonly getCourseForUserService: GetCoursesForUserService,
    private readonly getAvailableCoursesService: GetAvailableCoursesService,
    private readonly getStudentsWithEnrollmentDateService: GetStudentsWithEnrollmentDateService,
    private readonly getCourseService: GetCourseService,
    private readonly getBetaCourseByIdService: GetBetaCourseByIdService,
    private readonly getContentCreatorCoursesService: GetContentCreatorCoursesService,
    private readonly updateCourseService: UpdateCourseService,
    private readonly unenrollGroupsFromCoursesService: UnenrollGroupsFromCoursesService,
    private readonly enrollGroupsToCourseService: EnrollGroupsToCourseService,
    @Inject(forwardRef(() => UserService)) private readonly userService: UserService,
  ) {}

  getAllCourses(query: CoursesQuery) {
    return this.getAllCoursesService.getAllCourses(query)
  }

  getCoursesForUser(query: CoursesQuery, userId: UUIDType) {
    return this.getCourseForUserService.getCoursesForUser(query, userId)
  }

  getStudentsWithEnrollmentDate(courseId: UUIDType, filters: EnrolledStudentFilterSchema) {
    return this.getStudentsWithEnrollmentDateService.getStudentsWithEnrollmentDate(courseId, filters)
  }

  getAvailableCourses(query: CoursesQuery, userId?: UUIDType) {
     return this.getAvailableCoursesService.getAvailableCourses(query, userId);
   }

  async getCourseSequenceEnabled(courseId: UUIDType): Promise<LessonSequenceEnabledResponse> {
    const course = await this.db.query.courses.findFirst({
      where: (courses, { eq }) => eq(courses.id, courseId),
    });

    if (!course) {
      throw new NotFoundException("Course not found");
    }

    return {
      lessonSequenceEnabled: course?.settings.lessonSequenceEnabled,
    };
  }

  getCourse(id: UUIDType,
		 userId: UUIDType,
		 language: SupportedLanguages) {
    return this.getCourseService.getCourse(id, userId, language);
  }


  getBetaCourseById(id: UUIDType, language: SupportedLanguages, currentUserId: UUIDType, currentUserRole: UserRole) {
    return this.getBetaCourseByIdService.getBetaCourseById(id, language, currentUserId, currentUserRole);
  }

  getContentCreatorCourses({ currentUserId, authorId, scope, excludeCourseId, title, description, searchQuery, language }: { currentUserId: string, authorId: string, scope: CourseEnrollmentScope, excludeCourseId: string, title: string, description: string, searchQuery: string, language: SupportedLanguages }) {
    return this.getContentCreatorCoursesService.getContentCreatorCourses({
      currentUserId,
      authorId,
      scope,
      excludeCourseId,
      title,
      description,
      searchQuery,
      language,
    });
  }


  async updateHasCertificate(
    courseId: UUIDType,
    hasCertificate: boolean,
    currentUser: CurrentUser,
  ) {
    const [course] = await this.db.select().from(courses).where(eq(courses.id, courseId));

    if (!course) {
      throw new NotFoundException("Course not found");
    }

    const { language: resolvedLanguage } = await this.localizationService.getBaseLanguage(
      ENTITY_TYPE.COURSE,
      courseId,
    );

    const previousSnapshot = await this.buildCourseActivitySnapshot(courseId, resolvedLanguage);

    const [updatedCourse] = await this.db
      .update(courses)
      .set({ hasCertificate })
      .where(eq(courses.id, courseId))
      .returning();

    if (hasCertificate) {
      this.eventBus.publish(new UpdateHasCertificateEvent(courseId));
    }

    if (!updatedCourse) {
      throw new ConflictException("Failed to update course");
    }

    const updatedSnapshot = await this.buildCourseActivitySnapshot(courseId, resolvedLanguage);

    if (this.areCourseSnapshotsEqual(previousSnapshot, updatedSnapshot)) return updatedCourse;

    this.eventBus.publish(
      new UpdateCourseEvent({
        courseId,
        actor: currentUser,
        previousCourseData: previousSnapshot,
        updatedCourseData: updatedSnapshot,
      }),
    );

    return updatedCourse;
  }

  async updateLessonSequenceEnabled(
    courseId: UUIDType,
    lessonSequenceEnabled: boolean,
    currentUser: CurrentUser,
  ) {
    const [course] = await this.db.select().from(courses).where(eq(courses.id, courseId));

    if (!course) {
      throw new NotFoundException("Course not found");
    }

    const { language: resolvedLanguage } = await this.localizationService.getBaseLanguage(
      ENTITY_TYPE.COURSE,
      courseId,
    );

    const previousSnapshot = await this.buildCourseActivitySnapshot(courseId, resolvedLanguage);

    const [updatedCourse] = await this.db
      .update(courses)
      .set({
        settings: sql`
          jsonb_set(
            COALESCE(${courses.settings}, '{}'::jsonb),
        '{lessonSequenceEnabled}',
        to_jsonb(${lessonSequenceEnabled}::boolean),
        true
        )
      `,
      })
      .where(eq(courses.id, courseId))
      .returning();

    if (!updatedCourse) {
      throw new ConflictException("Failed to update course");
    }

    const updatedSnapshot = await this.buildCourseActivitySnapshot(courseId, resolvedLanguage);

    if (this.areCourseSnapshotsEqual(previousSnapshot, updatedSnapshot)) return updatedCourse;

    this.eventBus.publish(
      new UpdateCourseEvent({
        courseId,
        actor: currentUser,
        previousCourseData: previousSnapshot,
        updatedCourseData: updatedSnapshot,
      }),
    );

    return updatedCourse;
  }

  private areCourseSnapshotsEqual(
    previousSnapshot: CourseActivityLogSnapshot | null,
    updatedSnapshot: CourseActivityLogSnapshot | null,
  ) {
    return isEqual(previousSnapshot, updatedSnapshot);
  }

  async createCourse(
    createCourseBody: CreateCourseBody,
    currentUser: CurrentUser,
    isPlaywrightTest: boolean,
  ) {
    const newCourse = await this.db.transaction(async (trx) => {
      const [category] = await trx
        .select()
        .from(categories)
        .where(eq(categories.id, createCourseBody.categoryId));

      const { enabled: isStripeConfigured } = await this.envService.getStripeConfigured();

      if (!category) {
        throw new NotFoundException("Category not found");
      }
      const globalSettings = await this.settingsService.getGlobalSettings();

      const finalCurrency = globalSettings.defaultCourseCurrency || "usd";

      let productId: string | null = null;
      let priceId: string | null = null;

      if (!isPlaywrightTest && isStripeConfigured) {
        const stripeResult = await this.stripeService.createProduct({
          name: createCourseBody.title,
          description: createCourseBody?.description ?? "",
          currency: finalCurrency,
          amountInCents: createCourseBody?.priceInCents ?? 0,
        });

        productId = stripeResult.productId;
        priceId = stripeResult.priceId;

        if (!productId || !priceId) {
          throw new InternalServerErrorException("Failed to create product");
        }
      }

      const settings = sql`json_build_object('lessonSequenceEnabled', ${LESSON_SEQUENCE_ENABLED}::boolean)`;

      const [newCourse] = await trx
        .insert(courses)
        .values({
          title: buildJsonbField(createCourseBody.language, createCourseBody.title),
          description: buildJsonbField(createCourseBody.language, createCourseBody.description),
          baseLanguage: createCourseBody.language,
          availableLocales: [createCourseBody.language],
          thumbnailS3Key: createCourseBody.thumbnailS3Key,
          status: createCourseBody.status,
          priceInCents: createCourseBody.priceInCents,
          currency: finalCurrency,
          isScorm: createCourseBody.isScorm,
          authorId: currentUser.userId,
          categoryId: createCourseBody.categoryId,
          stripeProductId: productId,
          stripePriceId: priceId,
          settings: settingsToJSONBuildObject(settings),
        })
        .returning();

      if (!newCourse) {
        throw new ConflictException("Failed to create course");
      }

      await trx
        .insert(coursesSummaryStats)
        .values({ courseId: newCourse.id, authorId: currentUser.userId });

      return newCourse;
    });

    const createdCourseSnapshot = await this.buildCourseActivitySnapshot(
      newCourse.id,
      createCourseBody.language,
    );

    this.eventBus.publish(
      new CreateCourseEvent({
        courseId: newCourse.id,
        actor: currentUser,
        createdCourse: createdCourseSnapshot,
      }),
    );

    return newCourse;
  }
  
  updateCourse(
    id: UUIDType,
    updateCourseBody: UpdateCourseBody,
    currentUser: CurrentUser,
    isPlaywrightTest: boolean,
    image?: Express.Multer.File,
  ) {
    return this.updateCourseService.updateCourse(id, updateCourseBody, currentUser, isPlaywrightTest, image);
  }

  async enrollCourse(
    id: UUIDType,
    studentId: UUIDType,
    testKey?: string,
    paymentId?: string,
    currentUser?: CurrentUser,
  ) {
    const [course] = await this.db
      .select({
        id: courses.id,
        enrolled: sql<boolean>`CASE WHEN ${studentCourses.status} = ${COURSE_ENROLLMENT.ENROLLED} THEN TRUE ELSE FALSE END`,
        price: courses.priceInCents,
        userDeletedAt: users.deletedAt,
      })
      .from(courses)
      .leftJoin(users, eq(users.id, studentId))
      .leftJoin(
        studentCourses,
        and(eq(courses.id, studentCourses.courseId), eq(studentCourses.studentId, studentId)),
      )
      .where(and(eq(courses.id, id)));

    if (!course) throw new NotFoundException("Course not found");

    if (course.userDeletedAt) {
      throw new NotFoundException("User not found");
    }

    if (course.enrolled) throw new ConflictException("Course is already enrolled");

    await this.db.transaction(async (trx) => {
      await this.createStudentCourse(id, studentId, paymentId, null);
      await this.createCourseDependencies(id, studentId, paymentId, trx);
    });

    if (currentUser) {
      this.eventBus.publish(
        new EnrollCourseEvent({
          courseId: id,
          userId: studentId,
          actor: currentUser,
        }),
      );
    }
  }

  async enrollCourses(courseId: UUIDType, body: CreateCoursesEnrollment, currentUser: CurrentUser) {
    const { studentIds } = body;

    const courseExists = await this.db.select().from(courses).where(eq(courses.id, courseId));

    if (!courseExists.length) throw new NotFoundException(`Course ${courseId} not found`);
    if (!studentIds.length) throw new BadRequestException("Student ids not found");

    const existingStudentsEnrollments = await this.db
      .select({
        studentId: studentCourses.studentId,
        enrolledByGroupId: studentCourses.enrolledByGroupId,
      })
      .from(studentCourses)
      .where(
        and(
          eq(studentCourses.courseId, courseId),
          inArray(studentCourses.studentId, studentIds),
          eq(studentCourses.status, COURSE_ENROLLMENT.ENROLLED),
        ),
      );

    const studentsToEnroll = await this.db
      .select()
      .from(users)
      .where(and(inArray(users.id, studentIds), isNull(users.deletedAt)));

    if (studentsToEnroll.length !== studentIds.length)
      throw new BadRequestException("You can only enroll existing users");

    if (existingStudentsEnrollments.length > 0) {
      const existingStudentsEnrollmentsIds = existingStudentsEnrollments.map(
        ({ studentId }) => studentId,
      );

      throw new ConflictException(
        `Students ${existingStudentsEnrollmentsIds.join(
          ", ",
        )} are already enrolled in course ${courseId}`,
      );
    }

    await this.db.transaction(async (trx) => {
      const studentCoursesValues = studentIds.map((studentId) => {
        return {
          studentId,
          courseId,
          enrolledAt: sql`NOW()`,
          status: COURSE_ENROLLMENT.ENROLLED,
          enrolledByGroupId: null,
        };
      });

      await trx
        .insert(studentCourses)
        .values(studentCoursesValues)
        .onConflictDoUpdate({
          target: [studentCourses.studentId, studentCourses.courseId],
          set: { enrolledAt: sql`EXCLUDED.enrolled_at`, status: sql`EXCLUDED.status` },
        });

      await Promise.all(
        studentIds.map(async (studentId) => {
          await this.createCourseDependencies(courseId, studentId, null, trx);
        }),
      );
    });

    this.eventBus.publish(new UsersAssignedToCourseEvent({ studentIds, courseId }));
    studentIds.forEach((studentId) =>
      this.eventBus.publish(
        new EnrollCourseEvent({
          courseId,
          userId: studentId,
          actor: currentUser,
        }),
      ),
    );
  }

  async enrollGroupsToCourse(courseId: UUIDType, groupIds: UUIDType[], currentUser?: CurrentUser) {
    return this.enrollGroupsToCourseService.enrollGroupsToCourse(courseId, groupIds, currentUser);
  }

  unenrollGroupsFromCourse(courseId: UUIDType, groupIds: UUIDType[]) {
    return this.unenrollGroupsFromCoursesService.unenrollGroupsFromCourse(courseId, groupIds);
  }

  async createStudentCourse(
    courseId: UUIDType,
    studentId: UUIDType,
    paymentId: string | null = null,
    enrolledByGroupId: UUIDType | null = null,
  ): Promise<StudentCourseSelect> {
    const [enrolledCourse] = await this.db
      .insert(studentCourses)
      .values({
        studentId,
        courseId,
        paymentId,
        enrolledAt: sql`NOW()`,
        status: COURSE_ENROLLMENT.ENROLLED,
        enrolledByGroupId,
      })
      .onConflictDoUpdate({
        target: [studentCourses.studentId, studentCourses.courseId],
        set: { enrolledAt: sql`EXCLUDED.enrolled_at`, status: sql`EXCLUDED.status` },
      })
      .returning();

    if (!enrolledCourse) throw new ConflictException("Course not enrolled");

    return enrolledCourse;
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

  async deleteCourse(id: UUIDType, currentUserRole: UserRole) {
    const [course] = await this.db.select().from(courses).where(eq(courses.id, id));

    if (!course) {
      throw new NotFoundException("Course not found");
    }

    if (currentUserRole !== USER_ROLES.ADMIN && currentUserRole !== USER_ROLES.CONTENT_CREATOR) {
      throw new ForbiddenException("You don't have permission to delete this course");
    }

    if (course.status === "published") {
      throw new ForbiddenException("You can't delete a published course");
    }

    return this.db.transaction(async (trx) => {
      await trx.delete(quizAttempts).where(eq(quizAttempts.courseId, id));
      await trx.delete(studentCourses).where(eq(studentCourses.courseId, id));
      await trx.delete(studentChapterProgress).where(eq(studentChapterProgress.courseId, id));
      await trx.delete(coursesSummaryStats).where(eq(coursesSummaryStats.courseId, id));

      const [deletedCourse] = await trx.delete(courses).where(eq(courses.id, id)).returning();

      if (!deletedCourse) {
        throw new ConflictException("Failed to delete course");
      }

      return null;
    });
  }

  async deleteManyCourses(ids: UUIDType[], currentUserRole: UserRole) {
    if (!ids.length) {
      throw new BadRequestException("No course ids provided");
    }

    if (currentUserRole !== USER_ROLES.ADMIN && currentUserRole !== USER_ROLES.CONTENT_CREATOR) {
      throw new ForbiddenException("You don't have permission to delete these courses");
    }

    const course = await this.db.select().from(courses).where(inArray(courses.id, ids));

    if (course.some((course) => course.status === "published")) {
      throw new ForbiddenException("You can't delete a published course");
    }

    return this.db.transaction(async (trx) => {
      await trx.delete(quizAttempts).where(inArray(quizAttempts.courseId, ids));
      await trx.delete(studentCourses).where(inArray(studentCourses.courseId, ids));
      await trx.delete(studentChapterProgress).where(inArray(studentChapterProgress.courseId, ids));
      await trx.delete(coursesSummaryStats).where(inArray(coursesSummaryStats.courseId, ids));

      const deletedCourses = await trx.delete(courses).where(inArray(courses.id, ids)).returning();

      if (!deletedCourses.length) {
        throw new ConflictException("Failed to delete courses");
      }

      return null;
    });
  }

  async unenrollCourse(courseId: UUIDType, userIds: UUIDType[]) {
    const studentEnrollments = await this.db
      .select({
        studentId: studentCourses.studentId,
        status: studentCourses.status,
        enrolledByGroupId: studentCourses.enrolledByGroupId,
      })
      .from(studentCourses)
      .where(
        and(eq(studentCourses.courseId, courseId), inArray(studentCourses.studentId, userIds)),
      );

    const enrolledStudentIds = studentEnrollments.reduce<string[]>((studentIds, enrollment) => {
      if (enrollment.status === COURSE_ENROLLMENT.ENROLLED) studentIds.push(enrollment.studentId);
      return studentIds;
    }, []);

    const missingOrUnenrolledCount = userIds.length - enrolledStudentIds.length;

    if (missingOrUnenrolledCount > 0) {
      throw new BadRequestException({
        message: "adminCourseView.enrolled.toast.someStudentsUnenrolled",
        count: missingOrUnenrolledCount,
      });
    }

    const studentsEnrolledByGroup = studentEnrollments.filter(
      (enrollment) => enrollment.enrolledByGroupId,
    );

    if (studentsEnrolledByGroup.length > 0) {
      throw new BadRequestException({
        message: "adminCourseView.enrolled.toast.studentsEnrolledByGroup",
        count: studentsEnrolledByGroup.length,
      });
    }

    const studentsWithGroupEnrollment = await this.db
      .select({
        studentId: groupUsers.userId,
        groupId: groupCourses.groupId,
      })
      .from(groupUsers)
      .innerJoin(groupCourses, eq(groupUsers.groupId, groupCourses.groupId))
      .where(and(inArray(groupUsers.userId, userIds), eq(groupCourses.courseId, courseId)))
      .orderBy(groupUsers.createdAt);

    const studentGroupMap = new Map<string, string>();

    studentsWithGroupEnrollment.forEach(({ studentId, groupId }) => {
      if (!studentGroupMap.has(studentId)) {
        studentGroupMap.set(studentId, groupId);
      }
    });

    const studentsToUpdate = Array.from(studentGroupMap.keys());
    const studentsToUnenroll = userIds.filter((id) => !studentGroupMap.has(id));

    await this.db.transaction(async (trx) => {
      // Update students enrolled by groups to add group association
      if (studentsToUpdate.length > 0) {
        await Promise.all(
          Array.from(studentGroupMap.entries()).map(([studentId, groupId]) =>
            trx
              .update(studentCourses)
              .set({
                enrolledByGroupId: groupId,
              })
              .where(
                and(eq(studentCourses.studentId, studentId), eq(studentCourses.courseId, courseId)),
              ),
          ),
        );
      }

      if (studentsToUnenroll.length > 0) {
        await trx
          .update(studentCourses)
          .set({
            enrolledAt: null,
            status: COURSE_ENROLLMENT.NOT_ENROLLED,
            enrolledByGroupId: null,
          })
          .where(
            and(
              inArray(studentCourses.studentId, studentsToUnenroll),
              eq(studentCourses.courseId, courseId),
            ),
          );
      }
    });
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

  async getCourseStatistics(id: UUIDType): Promise<CourseStatisticsResponse> {
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
              WHERE sc.course_id = ${id} AND sc.status = ${COURSE_ENROLLMENT.ENROLLED}
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
            JOIN ${studentCourses} AS sc ON slp.student_id = sc.student_id AND ch.course_id = sc.course_id
            WHERE ch.course_id = ${id} AND sc.status = ${COURSE_ENROLLMENT.ENROLLED}
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
              WHERE sc.course_id = ${id} AND sc.status = ${COURSE_ENROLLMENT.ENROLLED}
              GROUP BY sc.progress
            ) AS progress_counts
          ),
          '[]'::jsonb
        )`,
      })
      .from(coursesSummaryStats)
      .leftJoin(studentCourses, eq(coursesSummaryStats.courseId, studentCourses.courseId))
      .where(
        and(
          eq(coursesSummaryStats.courseId, id),
          eq(studentCourses.status, COURSE_ENROLLMENT.ENROLLED),
        ),
      );

    return courseStats;
  }

  async getAverageQuizScoreForCourse(
    courseId: UUIDType,
    language: SupportedLanguages,
  ): Promise<CourseAverageQuizScoresResponse> {
    const [averageScorePerQuiz] = await this.db
      .select({
        averageScoresPerQuiz: sql<CourseAverageQuizScorePerQuiz[]>`COALESCE(
          (
            SELECT jsonb_agg(jsonb_build_object('quizId', subquery.quiz_id, 'name', subquery.quiz_name, 'averageScore', subquery.average_score, 'finishedCount', subquery.finished_count, 'lessonOrder', subquery.lesson_order))
            FROM (
              SELECT
                lessons.id AS quiz_id,
                ${this.localizationService.getLocalizedSqlField(
                  lessons.title,
                  language,
                  "co",
                )} AS quiz_name,
                lessons.display_order AS lesson_order,
                ROUND(AVG(slp.quiz_score), 0) AS average_score,
                COUNT(DISTINCT slp.student_id) AS finished_count
              FROM ${lessons}
              JOIN ${studentLessonProgress} slp ON lessons.id = slp.lesson_id
              JOIN ${chapters} c ON lessons.chapter_id = c.id
              JOIN ${studentCourses} sc ON slp.student_id = sc.student_id AND sc.course_id = c.course_id
              JOIN ${courses} co ON co.id = c.course_id
              WHERE c.course_id = ${courseId} AND lessons.type = 'quiz' AND slp.completed_at IS NOT NULL AND slp.quiz_score IS NOT NULL AND sc.status = ${
                COURSE_ENROLLMENT.ENROLLED
              }
              GROUP BY lessons.id, lessons.title, lessons.display_order, co.available_locales, co.base_language
            ) AS subquery
          ),
          '[]'::jsonb
        )`,
      })
      .from(studentLessonProgress)
      .leftJoin(chapters, eq(studentLessonProgress.chapterId, chapters.id))
      .leftJoin(courses, eq(chapters.courseId, courses.id))
      .where(eq(courses.id, courseId));

    return averageScorePerQuiz;
  }

  async getStudentsProgress(query: CourseStudentProgressionQuery) {
    const {
      courseId,
      sort = CourseStudentProgressionSortFields.studentName,
      perPage = DEFAULT_PAGE_SIZE,
      page = 1,
      searchQuery = "",
      language,
    } = query;

    const { sortOrder, sortedField } = getSortOptions(sort);

    const {
      studentNameExpression,
      lastActivityExpression,
      completedLessonsCountExpression,
      groupNameExpression,
    } = await this.getStudentCourseStatisticsExpressions(courseId, language);

    const conditions = [
      eq(studentCourses.courseId, courseId),
      or(
        ilike(users.firstName, `%${searchQuery}%`),
        ilike(users.lastName, `%${searchQuery}%`),
        ilike(groups.name, `%${searchQuery}%`),
      ),
      eq(studentCourses.status, COURSE_ENROLLMENT.ENROLLED),
    ];

    const studentsProgress = await this.db
      .select({
        studentId: sql<UUIDType>`${users.id}`,
        studentName: studentNameExpression,
        studentAvatarKey: users.avatarReference,
        groups: groupNameExpression,
        completedLessonsCount: completedLessonsCountExpression,
        lastActivity: lastActivityExpression,
      })
      .from(studentCourses)
      .leftJoin(users, eq(studentCourses.studentId, users.id))
      .leftJoin(groupUsers, eq(groupUsers.userId, users.id))
      .leftJoin(groups, eq(groups.id, groupUsers.groupId))
      .where(and(...conditions))
      .limit(perPage)
      .offset((page - 1) * perPage)
      .groupBy(users.id)
      .orderBy(
        sortOrder(
          await this.getCourseStatisticsColumnToSortBy(
            sortedField as CourseStudentProgressionSortField,
            courseId,
            language,
          ),
        ),
      );

    const [{ totalCount }] = await this.db
      .select({ totalCount: count() })
      .from(studentCourses)
      .leftJoin(users, eq(studentCourses.studentId, users.id))
      .leftJoin(groupUsers, eq(groupUsers.userId, users.id))
      .leftJoin(groups, eq(groups.id, groupUsers.groupId))
      .where(and(...conditions));

    const allStudentsProgress = await Promise.all(
      studentsProgress.map(async (studentProgress) => {
        const studentAvatarUrl = studentProgress.studentAvatarKey
          ? await this.userService.getUsersProfilePictureUrl(studentProgress.studentAvatarKey)
          : null;

        return {
          ...studentProgress,
          studentAvatarUrl,
        };
      }),
    );

    return {
      data: allStudentsProgress,
      pagination: { page, perPage, totalItems: totalCount },
    };
  }

  async getStudentsQuizResults(query: CourseStudentQuizResultsQuery) {
    const {
      courseId,
      page = 1,
      perPage = DEFAULT_PAGE_SIZE,
      quizId = "",
      sort = CourseStudentQuizResultsSortFields.studentName,
      language,
    } = query;

    const conditions = [
      eq(studentCourses.courseId, courseId),
      isNotNull(studentLessonProgress.completedAt),
      isNotNull(studentLessonProgress.attempts),
      eq(studentCourses.status, COURSE_ENROLLMENT.ENROLLED),
      eq(chapters.courseId, courseId),
    ];

    if (quizId) conditions.push(eq(lessons.id, quizId));

    const { sortOrder, sortedField } = getSortOptions(sort);

    const { lastAttemptExpression, studentNameExpression, quizNameExpression } =
      await this.getStudentCourseStatisticsExpressions(courseId, language);

    const order = sortOrder(
      await this.getCourseStatisticsColumnToSortBy(
        sortedField as CourseStudentQuizResultsSortField,
        courseId,
        language,
      ),
    );

    const quizResults = await this.db
      .select({
        studentId: sql<UUIDType>`${users.id}`,
        studentName: studentNameExpression,
        studentAvatarKey: users.avatarReference,
        lessonId: sql<UUIDType>`${lessons.id}`,
        quizName: quizNameExpression,
        attempts: sql<number>`${studentLessonProgress.attempts}`,
        quizScore: sql<number>`${studentLessonProgress.quizScore}`,
        lastAttempt: lastAttemptExpression,
      })
      .from(studentCourses)
      .leftJoin(users, eq(studentCourses.studentId, users.id))
      .leftJoin(studentLessonProgress, eq(studentLessonProgress.studentId, users.id))
      .leftJoin(lessons, eq(studentLessonProgress.lessonId, lessons.id))
      .leftJoin(chapters, eq(lessons.chapterId, chapters.id))
      .where(and(...conditions))
      .orderBy(order)
      .limit(perPage)
      .offset((page - 1) * perPage);

    const [{ totalCount }] = await this.db
      .select({ totalCount: count() })
      .from(studentLessonProgress)
      .leftJoin(studentCourses, eq(studentLessonProgress.studentId, studentCourses.studentId))
      .leftJoin(lessons, eq(studentLessonProgress.lessonId, lessons.id))
      .leftJoin(chapters, eq(lessons.chapterId, chapters.id))
      .where(and(...conditions));

    const allStudentsResults = await Promise.all(
      quizResults.map(async (studentProgress) => {
        const studentAvatarUrl = studentProgress.studentAvatarKey
          ? await this.userService.getUsersProfilePictureUrl(studentProgress.studentAvatarKey)
          : null;

        return {
          ...studentProgress,
          studentAvatarUrl,
        };
      }),
    );

    return {
      data: allStudentsResults,
      pagination: { page, perPage, totalItems: totalCount },
    };
  }

  async getStudentsAiMentorResults(query: CourseStudentAiMentorResultsQuery) {
    const {
      courseId,
      page = 1,
      perPage = DEFAULT_PAGE_SIZE,
      lessonId = "",
      sort = CourseStudentQuizResultsSortFields.studentName,
      language,
    } = query;

    const conditions = [
      eq(studentCourses.courseId, courseId),
      eq(lessons.type, LESSON_TYPES.AI_MENTOR),
      eq(studentLessonProgress.id, aiMentorStudentLessonProgress.studentLessonProgressId),
      eq(studentCourses.status, COURSE_ENROLLMENT.ENROLLED),
      eq(chapters.courseId, courseId),
    ];

    if (lessonId) conditions.push(eq(lessons.id, lessonId));

    const { sortOrder, sortedField } = getSortOptions(sort);

    const { studentNameExpression } = await this.getStudentCourseStatisticsExpressions(
      courseId,
      language,
    );

    const order = sortOrder(
      await this.getCourseStatisticsColumnToSortBy(
        sortedField as CourseStudentAiMentorResultsSortField,
        courseId,
        language,
      ),
    );

    const quizResults = await this.db
      .select({
        studentId: sql<UUIDType>`${users.id}`,
        studentName: studentNameExpression,
        studentAvatarKey: users.avatarReference,
        lessonId: sql<UUIDType>`${lessons.id}`,
        lessonName: this.localizationService.getLocalizedSqlField(lessons.title, language),
        score: sql<number>`${aiMentorStudentLessonProgress.percentage}`,
        lastSession: sql<string>`TO_CHAR(${aiMentorStudentLessonProgress.updatedAt}, 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`,
      })
      .from(studentCourses)
      .innerJoin(courses, eq(courses.id, studentCourses.courseId))
      .leftJoin(users, eq(studentCourses.studentId, users.id))
      .leftJoin(studentLessonProgress, eq(studentLessonProgress.studentId, users.id))
      .leftJoin(
        aiMentorStudentLessonProgress,
        eq(aiMentorStudentLessonProgress.studentLessonProgressId, studentLessonProgress.id),
      )
      .leftJoin(lessons, eq(studentLessonProgress.lessonId, lessons.id))
      .leftJoin(chapters, eq(chapters.id, lessons.chapterId))
      .orderBy(order)
      .limit(perPage)
      .offset((page - 1) * perPage)
      .where(and(...conditions));

    const [{ totalCount }] = await this.db
      .select({ totalCount: count() })
      .from(aiMentorStudentLessonProgress)
      .leftJoin(
        studentLessonProgress,
        eq(aiMentorStudentLessonProgress.studentLessonProgressId, studentLessonProgress.id),
      )
      .leftJoin(studentCourses, eq(studentLessonProgress.studentId, studentCourses.studentId))
      .leftJoin(lessons, eq(studentLessonProgress.lessonId, lessons.id))
      .leftJoin(chapters, eq(chapters.id, lessons.chapterId))
      .where(and(...conditions));

    const allStudentsResults = await Promise.all(
      quizResults.map(async (studentProgress) => {
        const studentAvatarUrl = studentProgress.studentAvatarKey
          ? await this.userService.getUsersProfilePictureUrl(studentProgress.studentAvatarKey)
          : null;

        return {
          ...studentProgress,
          studentAvatarUrl,
        };
      }),
    );

    return {
      data: allStudentsResults,
      pagination: { page, perPage, totalItems: totalCount },
    };
  }

  private async getCourseStatisticsColumnToSortBy(
    sort:
      | CourseStudentProgressionSortField
      | CourseStudentQuizResultsSortField
      | CourseStudentAiMentorResultsSortField,
    courseId: UUIDType,
    language: SupportedLanguages,
  ) {
    const {
      lastAttemptExpression,
      studentNameExpression,
      quizNameExpression,
      groupNameExpression,
      lastActivityExpression,
      completedLessonsCountExpression,
    } = await this.getStudentCourseStatisticsExpressions(courseId, language);

    switch (sort) {
      case CourseStudentProgressionSortFields.studentName:
        return studentNameExpression;
      case CourseStudentProgressionSortFields.groupName:
        return groupNameExpression;
      case CourseStudentProgressionSortFields.lastActivity:
        return lastActivityExpression;
      case CourseStudentProgressionSortFields.completedLessonsCount:
        return completedLessonsCountExpression;
      case CourseStudentQuizResultsSortFields.quizName:
        return quizNameExpression;
      case CourseStudentQuizResultsSortFields.lastAttempt:
        return lastAttemptExpression;
      case CourseStudentQuizResultsSortFields.attempts:
        return studentLessonProgress.attempts;
      case CourseStudentQuizResultsSortFields.quizScore:
        return studentLessonProgress.quizScore;
      case CourseStudentAiMentorResultsSortFields.lessonName:
        return this.localizationService.getLocalizedSqlField(lessons.title, language);
      case CourseStudentAiMentorResultsSortFields.score:
        return aiMentorStudentLessonProgress.percentage;
      case CourseStudentAiMentorResultsSortFields.lastSession:
        return aiMentorStudentLessonProgress.updatedAt;
      default:
        return studentNameExpression;
    }
  }

  private async getStudentCourseStatisticsExpressions(
    courseId: UUIDType,
    language: SupportedLanguages,
  ) {
    const studentNameExpression = sql<string>`CONCAT(${users.firstName} || ' ' || ${users.lastName})`;

    const lastActivityExpression = sql<string | null>`(
          SELECT TO_CHAR(MAX(slp.completed_at), 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
          FROM ${studentLessonProgress} slp
          JOIN ${lessons} l ON slp.lesson_id = l.id
          JOIN ${chapters} ch ON l.chapter_id = ch.id
          WHERE slp.student_id = ${users.id}
            AND ch.course_id = ${courseId}
        )`;

    const completedLessonsCountExpression = sql<number>`COALESCE((
          SELECT COUNT(*)
          FROM ${studentLessonProgress} slp
          JOIN ${lessons} l ON slp.lesson_id = l.id
          JOIN ${chapters} ch ON l.chapter_id = ch.id
          WHERE slp.student_id = ${users.id}
            AND ch.course_id = ${courseId}
            AND slp.completed_at IS NOT NULL
        ), 0)::float`;

    const groupNameExpression = sql<Array<{ id: string; name: string }>>`(
          SELECT json_agg(json_build_object('id', g.id, 'name', g.name))
          FROM ${groups} g
          JOIN ${groupUsers} gu ON gu.group_id = g.id
          WHERE gu.user_id = ${users.id}
        )`;

    const lastAttemptExpression = sql<string>`(
          SELECT TO_CHAR(MAX(slp.updated_at), 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
          FROM ${studentLessonProgress} slp
          JOIN ${lessons} l ON slp.lesson_id = l.id
          JOIN ${chapters} ch ON l.chapter_id = ch.id
          WHERE slp.student_id = ${users.id}
            AND slp.chapter_id = ch.id
            AND ch.course_id = ${courseId}
        )`;

    const quizNameExpression = sql<string>`(
          SELECT ${this.localizationService.getLocalizedSqlField(lessons.title, language, "c")}
          FROM ${lessons}
          JOIN ${chapters} ch ON ch.id = lessons.chapter_id
          JOIN ${courses} c ON c.id = ch.course_id
          WHERE lessons.id = ${studentLessonProgress.lessonId}
            AND lessons.type = 'quiz'
        )`;

    return {
      studentNameExpression,
      lastActivityExpression,
      completedLessonsCountExpression,
      groupNameExpression,
      lastAttemptExpression,
      quizNameExpression,
    };
  }

  async getCourseEmailData(courseId: UUIDType, language?: SupportedLanguages) {
    const [courseData] = await this.db
      .select({
        courseName: this.localizationService.getLocalizedSqlField(courses.title, language),
        hasCertificate: courses.hasCertificate,
      })
      .from(courses)
      .where(eq(courses.id, courseId));

    return courseData;
  }

  private async buildCourseActivitySnapshot(
    courseId: UUIDType,
    language?: SupportedLanguages,
    dbInstance: PostgresJsDatabase<typeof schema> = this.db,
  ): Promise<CourseActivityLogSnapshot> {
    const {
      language: resolvedLanguage,
      baseLanguage,
      availableLocales,
    } = await this.localizationService.getBaseLanguage(ENTITY_TYPE.COURSE, courseId, language);

    const [course] = await dbInstance
      .select({
        id: courses.id,
        title: this.localizationService.getLocalizedSqlField(courses.title, resolvedLanguage),
        description: this.localizationService.getLocalizedSqlField(
          courses.description,
          resolvedLanguage,
        ),
        status: courses.status,
        priceInCents: courses.priceInCents,
        currency: courses.currency,
        hasCertificate: courses.hasCertificate,
        isScorm: courses.isScorm,
        categoryId: courses.categoryId,
        authorId: courses.authorId,
        thumbnailS3Key: courses.thumbnailS3Key,
        settings: courses.settings,
        stripeProductId: courses.stripeProductId,
        stripePriceId: courses.stripePriceId,
      })
      .from(courses)
      .where(eq(courses.id, courseId));

    if (!course) throw new NotFoundException("Course not found");

    return {
      ...course,
      baseLanguage,
      availableLocales: Array.isArray(availableLocales) ? availableLocales : [availableLocales],
    };
  }

  async getChapterName(chapterId: UUIDType, language?: SupportedLanguages) {
    const [{ chapterName }] = await this.db
      .select({
        chapterName: this.localizationService.getLocalizedSqlField(chapters.title, language),
      })
      .from(chapters)
      .innerJoin(courses, eq(courses.id, chapters.courseId))
      .where(eq(chapters.id, chapterId));

    return chapterName;
  }

  async getStudentsWithoutCertificate(courseId: UUIDType) {
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

  async createLanguage(
    courseId: UUIDType,
    language: SupportedLanguages,
    userId: UUIDType,
    role: UserRole,
  ) {
    await this.adminLessonService.validateAccess("course", role, userId, courseId);

    const [{ availableLocales }] = await this.db
      .select()
      .from(courses)
      .where(eq(courses.id, courseId));

    if (availableLocales.includes(language)) {
      throw new BadRequestException("adminCourseView.createLanguage.alreadyExists");
    }

    const newLanguages = [...availableLocales, language];

    await this.db
      .update(courses)
      .set({ availableLocales: newLanguages })
      .where(eq(courses.id, courseId));
  }

  async deleteLanguage(
    courseId: UUIDType,
    language: SupportedLanguages,
    role: UserRole,
    userId: UUIDType,
  ) {
    const { baseLanguage, availableLocales } = await this.localizationService.getBaseLanguage(
      ENTITY_TYPE.COURSE,
      courseId,
    );

    if (!availableLocales.includes(language) || baseLanguage === language) {
      throw new BadRequestException({ message: "adminCourseView.toast.invalidLanguageToDelete" });
    }

    const data = await this.getBetaCourseById(courseId, language, userId, role);

    return this.db.transaction(async (trx) => {
      const chapterIds = data.chapters.map(({ id }) => id);
      const lessonIds: UUIDType[] = [];
      const questionIds: UUIDType[] = [];

      for (const chapter of data.chapters) {
        for (const lesson of chapter.lessons ?? []) {
          lessonIds.push(lesson.id);
          if (lesson.type === LESSON_TYPES.QUIZ && lesson.questions) {
            for (const q of lesson.questions) if (q.id) questionIds.push(q.id);
          }
        }
      }

      if (chapterIds.length) {
        await trx
          .update(chapters)
          .set({ title: deleteJsonbField(chapters.title, language) })
          .where(inArray(chapters.id, chapterIds));
      }

      if (lessonIds.length) {
        await trx
          .update(lessons)
          .set({
            title: deleteJsonbField(lessons.title, language),
            description: deleteJsonbField(lessons.description, language),
          })
          .where(inArray(lessons.id, lessonIds));
      }

      if (questionIds.length) {
        await trx
          .update(questions)
          .set({
            title: deleteJsonbField(questions.title, language),
            description: deleteJsonbField(questions.description, language),
            solutionExplanation: deleteJsonbField(questions.solutionExplanation, language),
          })
          .where(inArray(questions.id, questionIds));

        await trx
          .update(questionAnswerOptions)
          .set({
            optionText: deleteJsonbField(questionAnswerOptions.optionText, language),
            matchedWord: deleteJsonbField(questionAnswerOptions.matchedWord, language),
          })
          .where(inArray(questionAnswerOptions.questionId, questionIds));
      }

      await trx
        .update(courses)
        .set({
          title: deleteJsonbField(courses.title, language),
          description: deleteJsonbField(courses.description, language),
          availableLocales: sql`ARRAY_REMOVE(${courses.availableLocales}, ${language})`,
        })
        .where(eq(courses.id, courseId));
    });
  }
}
