import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import {
  ENTITY_TYPES,
  PERMISSIONS,
  type PermissionKey,
  type SupportedLanguages,
} from "@repo/shared";
import { and, eq, isNotNull } from "drizzle-orm";
import { isNumber } from "lodash";

import { AiService } from "src/ai/services/ai.service";
import { THREAD_STATUS } from "src/ai/utils/ai.type";
import { DatabasePg } from "src/common";
import { hasAnyPermission } from "src/common/permissions/permission.utils";
import { injectResourcesIntoContent } from "src/common/utils/injectResourcesIntoContent";
import {
  canTrackLessonProgress,
  LEARNING_MODE_REQUIRED_ERROR_KEY,
  shouldRequireLearningModeForProgress,
} from "src/common/utils/lessonLearningAccess";
import { QuizCompletedEvent } from "src/events";
import { RESOURCE_RELATIONSHIP_TYPES } from "src/file/file.constants";
import { FileService } from "src/file/file.service";
import { FILE_DELIVERY_TYPE } from "src/file/types/file-delivery.type";
import { streamFileToResponse } from "src/file/utils/streamFileToResponse";
import { LessonVideoProgressService } from "src/lesson-video-progress/lesson-video-progress.service";
import { LiveTrainingService } from "src/live-training/live-training.service";
import { LocalizationService } from "src/localization/localization.service";
import { ENTITY_TYPE } from "src/localization/localization.types";
import { OutboxPublisher } from "src/outbox/outbox.publisher";
import { PermissionsService } from "src/permissions/permissions.service";
import { QuestionRepository } from "src/questions/question.repository";
import { QuestionService } from "src/questions/question.service";
import {
  chapters,
  courses,
  courseStudentMode,
  lessons,
  studentCourses,
  studentLessonProgress,
} from "src/storage/schema";
import { StudentLessonProgressService } from "src/studentLessonProgress/studentLessonProgress.service";
import { isQuizAccessAllowed } from "src/utils/isQuizAccessAllowed";

import { createLessonResourceIdRegex } from "../lesson-resource-references";
import { LESSON_TYPES } from "../lesson.type";
import { LessonRepository } from "../repositories/lesson.repository";

import type { LessonResourceMetadata, ResourceWithUrlError } from "../lesson-resource.types";
import type {
  AnswerQuestionBody,
  LessonsFilters,
  LessonShow,
  QuestionBody,
  QuestionDetails,
} from "../lesson.schema";
import type { EnrolledLessonWithSearch } from "../repositories/lesson.repository";
import type { Request, Response } from "express";
import type { UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";
import type { FilePreviewFormat, FilePreviewOptions } from "src/file/types/file-preview.type";

@Injectable()
export class LessonService {
  private readonly logger = new Logger(LessonService.name);

  constructor(
    @Inject("DB") private readonly db: DatabasePg,
    private readonly lessonRepository: LessonRepository,
    private readonly questionService: QuestionService,
    private readonly questionRepository: QuestionRepository,
    private readonly fileService: FileService,
    private readonly studentLessonProgressService: StudentLessonProgressService,
    private readonly aiService: AiService,
    private readonly outboxPublisher: OutboxPublisher,
    private readonly localizationService: LocalizationService,
    private readonly permissionsService: PermissionsService,
    private readonly liveTrainingService: LiveTrainingService,
    private readonly lessonVideoProgressService: LessonVideoProgressService,
  ) {}

  async getLessonById(
    id: UUIDType,
    userId: UUIDType,
    currentUser: CurrentUserType,
    language?: SupportedLanguages,
  ): Promise<LessonShow> {
    const isStudent = this.isLearnerOnly(currentUser.permissions);

    const hasLessonAccess = await this.lessonRepository.getHasLessonAccess(id, userId, isStudent);

    if (!hasLessonAccess) throw new UnauthorizedException("common.toast.lessonAccessDenied");

    const { language: actualLanguage } = await this.localizationService.getBaseLanguage(
      ENTITY_TYPE.LESSON,
      id,
      language,
    );

    const basicInfo = await this.lessonRepository.getLessonProgress(id, userId, [
      isNotNull(studentLessonProgress.isQuizPassed),
      isNotNull(studentLessonProgress.completedAt),
    ]);

    const lesson = await this.lessonRepository.getLessonDetails(id, userId, actualLanguage);

    if (!lesson) throw new NotFoundException("common.toast.notFound");

    if (isStudent && !lesson.isFreemium && !lesson.isEnrolled)
      throw new UnauthorizedException("common.toast.lessonAccessDenied");

    if (
      lesson.type === LESSON_TYPES.QUIZ ||
      lesson.type === LESSON_TYPES.CONTENT ||
      lesson.type === LESSON_TYPES.AI_MENTOR
    ) {
      await this.studentLessonProgressService.markLessonAsStarted(
        lesson.id,
        userId,
        currentUser.permissions,
      );
    }

    if (lesson.type === LESSON_TYPES.CONTENT) {
      const lessonResources = await this.fileService.getResourcesForEntity(
        id,
        ENTITY_TYPES.LESSON,
        RESOURCE_RELATIONSHIP_TYPES.ATTACHMENT,
        actualLanguage,
      );
      const videoResourceEntityIds = lessonResources
        .filter(
          (resource) => resource.contentType?.startsWith("video/") && resource.resourceEntityId,
        )
        .map((resource) => resource.resourceEntityId);
      const videoProgressRows = await this.lessonVideoProgressService.getProgressForResources({
        lessonId: id,
        studentId: userId,
        resourceEntityIds: videoResourceEntityIds,
      });
      const videoProgressByResourceEntityId = new Map(
        videoProgressRows.map((progress) => [progress.resourceEntityId, progress]),
      );

      const mappedResources = lessonResources.map((resource) => ({
        id: resource.id,
        resourceEntityId: resource.resourceEntityId,
        fileUrl: resource.fileUrl,
        fileUrlError: Boolean((resource as ResourceWithUrlError).fileUrlError),
        contentType: resource.contentType,
        title: typeof resource.title === "string" ? resource.title : undefined,
        description: typeof resource.description === "string" ? resource.description : undefined,
        videoProgress: resource.resourceEntityId
          ? videoProgressByResourceEntityId.get(resource.resourceEntityId)
          : undefined,
      }));

      const {
        html: updatedDescription,
        contentCount,
        hasAutoplayTrigger,
        videos,
      } = injectResourcesIntoContent(lesson.description, mappedResources, {
        resourceIdRegex: createLessonResourceIdRegex(),
        trackNodeTypes: ["video", "image", "presentation", "downloadable-file"],
        convertImageAnchors: false,
      });

      const hasVideo = this.hasOnlyVideo(contentCount);

      return {
        ...lesson,
        description: updatedDescription ?? lesson.description,
        hasOnlyVideo: hasVideo,
        hasVideo: contentCount.video > 0,
        hasTrackedVideo:
          Boolean(lesson.videoCompletionTrackingEnabled) && videoResourceEntityIds.length > 0,
        hasAutoplayTrigger,
        videos,
      };
    }

    if (lesson.type === LESSON_TYPES.AI_MENTOR) {
      const { data: thread } = await this.aiService.getThreadWithSetup({
        lessonId: id,
        status: THREAD_STATUS.ACTIVE,
        userLanguage: actualLanguage,
        userId,
      });

      let avatarUrl = undefined;

      if (lesson.aiMentor?.avatarReferenceUrl) {
        avatarUrl = await this.fileService.getFileUrl(lesson.aiMentor.avatarReferenceUrl);
      }

      return {
        ...lesson,
        aiMentor: {
          name: lesson.aiMentor?.name ?? "AI Mentor",
          avatarReferenceUrl: avatarUrl,
        },
        threadId: thread.id,
        userLanguage: thread.userLanguage,
        status: thread.status,
      };
    }

    if (lesson.type === LESSON_TYPES.EMBED) {
      const lessonResources = await this.fileService.getResourcesForEntity(
        lesson.id,
        ENTITY_TYPES.LESSON,
        RESOURCE_RELATIONSHIP_TYPES.ATTACHMENT,
        actualLanguage,
      );

      const mappedResources = lessonResources.map((resource) => {
        const metadata = resource.metadata as LessonResourceMetadata | undefined;
        const fileName = metadata?.originalFilename;

        return {
          id: resource.id,
          fileUrl: resource.fileUrl,
          fileUrlError: Boolean((resource as ResourceWithUrlError).fileUrlError),
          contentType: resource.contentType,
          title: typeof resource.title === "string" ? resource.title : undefined,
          description: typeof resource.description === "string" ? resource.description : undefined,
          fileName,
          allowFullscreen: metadata?.allowFullscreen,
        };
      });

      return { ...lesson, lessonResources: mappedResources };
    }

    if (lesson.type === LESSON_TYPES.LIVE_TRAINING) {
      const liveTraining = lesson.liveTrainingId
        ? await this.liveTrainingService.getLiveTraining(
            lesson.liveTrainingId,
            actualLanguage,
            currentUser,
          )
        : null;

      return { ...lesson, liveTraining };
    }

    const questionList = await this.questionRepository.getQuestionsForLesson(
      lesson.id,
      lesson.lessonCompleted,
      userId,
      basicInfo?.languageAnswered ?? actualLanguage,
    );

    const isQuizFeedbackRedacted = isStudent && !lesson.quizFeedbackEnabled;

    const questionListWithUrls: QuestionBody[] = await Promise.all(
      questionList.map(async (question) => {
        if (!question.photoS3Key) return question;

        try {
          const signedUrl = await this.fileService.getFileUrl(question.photoS3Key);
          const questionResult = { ...question, photoS3Key: signedUrl };

          return questionResult;
        } catch (error) {
          this.logger.error(`Failed to get signed URL for ${question.photoS3Key}:`, error);
          return question;
        }
      }),
    );

    const redactedQuestionList = isQuizFeedbackRedacted
      ? questionListWithUrls.map((question) => ({
          ...question,
          passQuestion: typeof question.passQuestion === "boolean" ? false : question.passQuestion,
          options: question.options?.map((option) => ({
            ...option,
            isCorrect: typeof option.isCorrect === "boolean" ? false : option.isCorrect,
          })),
        }))
      : questionListWithUrls;

    if (lesson.lessonCompleted && isNumber(lesson.quizScore)) {
      const correctAnswerCount = questionListWithUrls.filter(
        (question) => question.passQuestion === true,
      ).length;

      const wrongAnswerCount = questionListWithUrls.length - correctAnswerCount;
      const quizDetails: QuestionDetails = {
        questions: redactedQuestionList,
        questionCount: redactedQuestionList.length,
        score: lesson.quizScore,
        correctAnswerCount,
        wrongAnswerCount,
      };

      return { ...lesson, quizDetails, isQuizFeedbackRedacted };
    }

    const quizDetails = {
      questions: redactedQuestionList,
      questionCount: redactedQuestionList.length,
      score: null,
      correctAnswerCount: null,
      wrongAnswerCount: null,
    };

    return { ...lesson, quizDetails, isQuizFeedbackRedacted };
  }

  async evaluationQuiz(
    studentQuizAnswers: AnswerQuestionBody,
    currentUser: CurrentUserType,
  ): Promise<{
    correctAnswerCount: number;
    wrongAnswerCount: number;
    questionCount: number;
    score: number;
  }> {
    const { userId } = currentUser;

    await this.assertStudentProgressMutationAllowed(studentQuizAnswers.lessonId, currentUser);

    const [accessCourseLessonWithDetails] = await this.lessonRepository.checkLessonAssignment(
      studentQuizAnswers.lessonId,
      userId,
    );

    if (!accessCourseLessonWithDetails) {
      throw new NotFoundException("common.toast.notFound");
    }

    if (accessCourseLessonWithDetails.lessonIsCompleted) {
      throw new ConflictException("studentLessonView.validation.quizAlreadyAnswered");
    }

    if (!accessCourseLessonWithDetails.isAssigned && !accessCourseLessonWithDetails.isFreemium)
      throw new UnauthorizedException("studentLessonView.validation.lessonAssignmentRequired");

    const quizSettings = await this.lessonRepository.getLessonSettings(studentQuizAnswers.lessonId);

    const correctAnswersForQuizQuestions =
      await this.questionRepository.getQuizQuestionsToEvaluation(
        studentQuizAnswers.lessonId,
        studentQuizAnswers.language,
      );

    const expectedQuestionIds = new Set(
      correctAnswersForQuizQuestions.map((question) => question.id),
    );

    const submittedQuestionIds = new Set(
      studentQuizAnswers.questionsAnswers.map((questionAnswer) => questionAnswer.questionId),
    );

    const missingQuestionIds = [...expectedQuestionIds].filter(
      (questionId) => !submittedQuestionIds.has(questionId),
    );

    if (missingQuestionIds.length > 0) {
      const missingQuestionNames = correctAnswersForQuizQuestions
        .filter((question) => missingQuestionIds.includes(question.id))
        .map((question) => `"${question.title}"`)
        .slice(0, 2);

      const hasMoreMissingQuestions = missingQuestionIds.length > missingQuestionNames.length;

      const formattedQuestionNames = [
        ...missingQuestionNames,
        ...(hasMoreMissingQuestions ? ["..."] : []),
      ].join(", ");

      throw new ConflictException({
        message: "studentLessonView.validation.unansweredQuestionsWithNames",
        translationParams: {
          questionNames: formattedQuestionNames,
        },
      });
    }

    return await this.db.transaction(async (trx) => {
      try {
        const evaluationResult = await this.questionService.evaluationsQuestions(
          correctAnswersForQuizQuestions,
          studentQuizAnswers,
          userId,
          trx,
        );

        const requiredCorrect = Math.ceil(
          ((quizSettings?.thresholdScore ?? 0) *
            (evaluationResult.correctAnswerCount + evaluationResult.wrongAnswerCount)) /
            100,
        );

        const quizScore = Math.floor(
          (evaluationResult.correctAnswerCount /
            (evaluationResult.correctAnswerCount + evaluationResult.wrongAnswerCount)) *
            100,
        );

        const isQuizPassed = quizSettings?.thresholdScore
          ? requiredCorrect <= evaluationResult.correctAnswerCount
          : true;

        await this.studentLessonProgressService.updateQuizProgress(
          accessCourseLessonWithDetails.chapterId,
          studentQuizAnswers.lessonId,
          userId,
          evaluationResult.correctAnswerCount + evaluationResult.wrongAnswerCount,
          quizScore,
          accessCourseLessonWithDetails.attempts ?? 1,
          isQuizPassed,
          true,
          trx,
          studentQuizAnswers.language,
        );

        if (isQuizPassed) {
          await this.studentLessonProgressService.markLessonAsCompleted({
            id: studentQuizAnswers.lessonId,
            studentId: userId,
            userPermissions: currentUser.permissions,
            actor: currentUser,
            quizCompleted: true,
            completedQuestionCount:
              evaluationResult.correctAnswerCount + evaluationResult.wrongAnswerCount,
            dbInstance: trx,
            isQuizPassed,
            language: studentQuizAnswers.language,
          });
        }

        await this.outboxPublisher.publish(
          new QuizCompletedEvent({
            userId,
            courseId: accessCourseLessonWithDetails.courseId,
            lessonId: studentQuizAnswers.lessonId,
            correctAnswers: evaluationResult.correctAnswerCount,
            wrongAnswers: evaluationResult.wrongAnswerCount,
            score: quizScore,
          }),
          trx,
        );

        return {
          correctAnswerCount: evaluationResult.correctAnswerCount,
          wrongAnswerCount: evaluationResult.wrongAnswerCount,
          questionCount: evaluationResult.wrongAnswerCount + evaluationResult.correctAnswerCount,
          score: quizScore,
        };
      } catch (error) {
        throw new ConflictException("studentLessonView.validation.quizEvaluationFailed");
      }
    });
  }

  async deleteStudentQuizAnswers(lessonId: UUIDType, currentUser: CurrentUserType): Promise<void> {
    const { userId } = currentUser;

    await this.assertStudentProgressMutationAllowed(lessonId, currentUser);

    const [accessCourseLessonWithDetails] = await this.lessonRepository.checkLessonAssignment(
      lessonId,
      userId,
    );

    if (!accessCourseLessonWithDetails) {
      throw new NotFoundException("common.toast.notFound");
    }

    if (!accessCourseLessonWithDetails.lessonIsCompleted) {
      throw new ConflictException("studentLessonView.validation.quizNotAnsweredYet");
    }

    if (!accessCourseLessonWithDetails.isAssigned) {
      throw new ConflictException("studentLessonView.validation.courseEnrollmentRequired");
    }

    const quizSettings = await this.lessonRepository.getLessonSettings(lessonId);

    let attempts = accessCourseLessonWithDetails.attempts ?? 1;

    if (
      !isQuizAccessAllowed(
        attempts,
        quizSettings?.attemptsLimit,
        accessCourseLessonWithDetails.updatedAt,
        quizSettings?.quizCooldownInHours,
      )
    ) {
      throw new ConflictException("studentLessonView.validation.quizRetakeUnavailable");
    }

    attempts += 1;

    const questions = await this.questionRepository.getQuestionsIdsByLessonId(lessonId);

    if (questions.length === 0) {
      return;
    }

    return await this.db.transaction(async (trx) => {
      try {
        await this.questionRepository.deleteStudentQuizAnswers(questions, userId, trx);

        await this.studentLessonProgressService.updateQuizProgress(
          accessCourseLessonWithDetails.chapterId,
          lessonId,
          userId,
          0,
          0,
          attempts,
          false,
          false,
          trx,
          null,
        );
      } catch (error) {
        throw new ConflictException("studentLessonView.validation.quizResetFailed");
      }
    });
  }

  private async assertStudentProgressMutationAllowed(
    lessonId: UUIDType,
    currentUser: CurrentUserType,
  ) {
    const { permissions } = await this.permissionsService.getUserAccess(currentUser.userId);

    const [access] = await this.db
      .select({
        isAssigned: studentCourses.id,
        isCourseAuthor: eq(courses.authorId, currentUser.userId),
        isStudentMode: courseStudentMode.id,
      })
      .from(lessons)
      .innerJoin(chapters, eq(lessons.chapterId, chapters.id))
      .innerJoin(courses, eq(courses.id, chapters.courseId))
      .leftJoin(
        studentCourses,
        and(
          eq(studentCourses.courseId, chapters.courseId),
          eq(studentCourses.studentId, currentUser.userId),
        ),
      )
      .leftJoin(
        courseStudentMode,
        and(
          eq(courseStudentMode.courseId, chapters.courseId),
          eq(courseStudentMode.userId, currentUser.userId),
        ),
      )
      .where(eq(lessons.id, lessonId));

    const hasLearnerAccess = this.canUseLearnerProgress(permissions, {
      hasEnrollment: !!access?.isAssigned,
      isCourseAuthor: !!access?.isCourseAuthor,
      isLearningModeActive: !!access?.isStudentMode,
    });

    if (!hasLearnerAccess) {
      const shouldRequireLearningMode = shouldRequireLearningModeForProgress(permissions, {
        isCourseAuthor: !!access?.isCourseAuthor,
      });

      if (!shouldRequireLearningMode) return;

      throw new ForbiddenException(LEARNING_MODE_REQUIRED_ERROR_KEY);
    }
  }

  async getLessonResource(
    req: Request,
    res: Response,
    currentUser: CurrentUserType,
    resourceId: UUIDType,
    preview?: FilePreviewFormat,
  ) {
    const isStudent = this.isLearnerOnly(currentUser.permissions);

    const lessonResource = await this.lessonRepository.getResource(resourceId);

    if (!lessonResource) {
      throw new NotFoundException("common.toast.notFound");
    }

    if (!lessonResource.entityId || lessonResource.entityType !== ENTITY_TYPE.LESSON) {
      if (
        hasAnyPermission(currentUser.permissions, [
          PERMISSIONS.COURSE_UPDATE,
          PERMISSIONS.COURSE_UPDATE_OWN,
        ])
      ) {
        return this.streamResource(req, res, lessonResource.reference, {
          contentType: lessonResource.contentType,
          preview,
        });
      }

      throw new NotFoundException("common.toast.notFound");
    }

    const [lesson] = await this.lessonRepository.checkLessonAssignment(
      lessonResource.entityId,
      currentUser.userId,
    );

    if (!lesson) {
      if (isStudent) {
        throw new ForbiddenException("common.toast.lessonAccessDenied");
      }

      throw new NotFoundException("common.toast.notFound");
    }

    if (!lesson.isAssigned && isStudent && !lesson.isFreemium) {
      throw new ForbiddenException("common.toast.lessonAccessDenied");
    }

    return this.streamResource(req, res, lessonResource.reference, {
      contentType: lessonResource.contentType,
      preview,
    });
  }

  private async streamResource(
    req: Request,
    res: Response,
    reference: string,
    options?: FilePreviewOptions,
  ) {
    const file = await this.fileService.getFileDeliveryWithPreview(reference, {
      ...options,
      range: req.headers.range,
    });

    if (file.type === FILE_DELIVERY_TYPE.REDIRECT) {
      return res.redirect(file.url);
    }

    if (!file || !file.stream) throw new Error("Error fetching file stream");
    streamFileToResponse(res, file);
  }

  async getLessons(
    currentUser: CurrentUserType,
    filters: LessonsFilters,
    language: SupportedLanguages,
  ): Promise<EnrolledLessonWithSearch[]> {
    return this.lessonRepository.getLessonsByRole(currentUser, filters, language);
  }

  private hasOnlyVideo(contentCount: Record<string, number>) {
    return contentCount.video === 1 && Object.keys(contentCount).length === 1;
  }

  private isLearnerOnly(permissions: PermissionKey[]) {
    return !permissions.includes(PERMISSIONS.LEARNING_MODE_USE);
  }

  private canUseLearnerProgress(
    permissions: PermissionKey[],
    access: { hasEnrollment: boolean; isCourseAuthor: boolean; isLearningModeActive: boolean },
  ) {
    return canTrackLessonProgress(permissions, access);
  }

  // async studentAnswerOnQuestion(
  //   questionId: UUIDType,
  //   studentId: UUIDType,
  //   isCorrect: boolean,
  //   trx?: PostgresJsDatabase<typeof schema>,
  // ) {
  //   await this.db.insert(studentQuestionAnswers).values({
  //     questionId,
  //     studentId,
  //     answer: isCorrect,
  //   });
  // }

  // async clearQuizProgress(courseId: UUIDType, lessonId: UUIDType, userId: UUIDType) {
  //   const [accessCourseLessons] = await this.chapterRepository.checkLessonAssignment(
  //     courseId,
  //     lessonId,
  //     userId,
  //   );

  //   if (!accessCourseLessons)
  //     throw new UnauthorizedException("You don't have assignment to this lesson");

  //   const quizProgress = await this.chapterRepository.lessonProgress(
  //     courseId,
  //     lessonId,
  //     userId,
  //     true,
  //   );

  //   if (!quizProgress) throw new NotFoundException("Lesson progress not found");

  //   try {
  //     return await this.db.transaction(async (trx) => {
  //       const questionIds = await this.chapterRepository.getQuestionsIdsByLessonId(lessonId);

  //       await this.chapterRepository.retireQuizProgress(courseId, lessonId, userId, trx);

  //       await this.chapterRepository.removeQuestionsAnswer(
  //         courseId,
  //         lessonId,
  //         questionIds,
  //         userId,
  //         trx,
  //       );

  //       await this.chapterRepository.removeStudentCompletedLessonItems(
  //         courseId,
  //         lessonId,
  //         userId,
  //         trx,
  //       );

  //       return true;
  //     });
  //   } catch (error) {
  //     return false;
  //   }
  // }
}
