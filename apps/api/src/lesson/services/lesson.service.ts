import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { EventBus } from "@nestjs/cqrs";
import { load as loadHtml } from "cheerio";
import { isNotNull } from "drizzle-orm";
import { isNumber } from "lodash";

import { AiService } from "src/ai/services/ai.service";
import { THREAD_STATUS } from "src/ai/utils/ai.type";
import { DatabasePg } from "src/common";
import { QuizCompletedEvent } from "src/events";
import { ENTITY_TYPES, RESOURCE_RELATIONSHIP_TYPES } from "src/file/file.constants";
import { FileService } from "src/file/file.service";
import { LocalizationService } from "src/localization/localization.service";
import { ENTITY_TYPE } from "src/localization/localization.types";
import { QuestionRepository } from "src/questions/question.repository";
import { QuestionService } from "src/questions/question.service";
import { studentLessonProgress } from "src/storage/schema";
import { StudentLessonProgressService } from "src/studentLessonProgress/studentLessonProgress.service";
import { USER_ROLES, type UserRole } from "src/user/schemas/userRoles";
import { isQuizAccessAllowed } from "src/utils/isQuizAccessAllowed";

import { LESSON_TYPES } from "../lesson.type";
import { LessonRepository } from "../repositories/lesson.repository";

import type { LessonResourceMetadata } from "../lesson-resource.types";
import type {
  AnswerQuestionBody,
  EnrolledLesson,
  EnrolledLessonsFilters,
  LessonShow,
  QuestionBody,
  QuestionDetails,
} from "../lesson.schema";
import type { SupportedLanguages } from "@repo/shared";
import type { Response } from "express";
import type { UUIDType } from "src/common";

@Injectable()
export class LessonService {
  constructor(
    @Inject("DB") private readonly db: DatabasePg,
    private readonly lessonRepository: LessonRepository,
    private readonly questionService: QuestionService,
    private readonly questionRepository: QuestionRepository,
    private readonly fileService: FileService,
    private readonly studentLessonProgressService: StudentLessonProgressService,
    private readonly aiService: AiService,
    private readonly eventBus: EventBus,
    private readonly localizationService: LocalizationService,
  ) {}

  async getLessonById(
    id: UUIDType,
    userId: UUIDType,
    userRole: UserRole,
    language?: SupportedLanguages,
  ): Promise<LessonShow> {
    const isStudent = userRole === USER_ROLES.STUDENT;

    const hasLessonAccess = await this.lessonRepository.getHasLessonAccess(id, userId, isStudent);

    if (!hasLessonAccess) throw new UnauthorizedException("You don't have access to this lesson");

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

    if (!lesson) throw new NotFoundException("Lesson not found");

    if (isStudent && !lesson.isFreemium && !lesson.isEnrolled)
      throw new UnauthorizedException("You don't have access");

    if (
      lesson.type === LESSON_TYPES.QUIZ ||
      lesson.type === LESSON_TYPES.CONTENT ||
      lesson.type === LESSON_TYPES.AI_MENTOR
    ) {
      await this.studentLessonProgressService.markLessonAsStarted(lesson.id, userId, userRole);
    }

    if (lesson.type === LESSON_TYPES.CONTENT) {
      const lessonResources = await this.fileService.getResourcesForEntity(
        id,
        ENTITY_TYPES.LESSON,
        RESOURCE_RELATIONSHIP_TYPES.ATTACHMENT,
        actualLanguage,
      );

      const mappedResources = lessonResources.map((resource) => ({
        id: resource.id,
        fileUrl: resource.fileUrl,
        contentType: resource.contentType,
        title: typeof resource.title === "string" ? resource.title : undefined,
        description: typeof resource.description === "string" ? resource.description : undefined,
        fileName: this.extractOriginalFilename(resource.metadata),
      }));

      const { html: updatedDescription, contentCount } = this.injectResourcesIntoContent(
        lesson.description,
        mappedResources,
      );

      const hasVideo = this.hasOnlyVideo(contentCount);

      return {
        ...lesson,
        description: updatedDescription ?? lesson.description,
        hasOnlyVideo: hasVideo,
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
          contentType: resource.contentType,
          title: typeof resource.title === "string" ? resource.title : undefined,
          description: typeof resource.description === "string" ? resource.description : undefined,
          fileName,
          allowFullscreen: metadata?.allowFullscreen,
        };
      });

      return { ...lesson, lessonResources: mappedResources };
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
          console.error(`Failed to get signed URL for ${question.photoS3Key}:`, error);
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
      const [quizResult] = await this.lessonRepository.getQuizResult(
        lesson.id,
        lesson.quizScore,
        userId,
      );

      const quizDetails: QuestionDetails = {
        questions: redactedQuestionList,
        questionCount: redactedQuestionList.length,
        score: quizResult?.score ?? 0,
        correctAnswerCount: quizResult?.correctAnswerCount ?? 0,
        wrongAnswerCount: quizResult?.wrongAnswerCount ?? 0,
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
    userId: UUIDType,
  ): Promise<{
    correctAnswerCount: number;
    wrongAnswerCount: number;
    questionCount: number;
    score: number;
  }> {
    const [accessCourseLessonWithDetails] = await this.lessonRepository.checkLessonAssignment(
      studentQuizAnswers.lessonId,
      userId,
    );

    if (accessCourseLessonWithDetails.lessonIsCompleted) {
      throw new ConflictException("You have already answered this quiz");
    }

    if (!accessCourseLessonWithDetails.isAssigned && !accessCourseLessonWithDetails.isFreemium)
      throw new UnauthorizedException("You don't have assignment to this lesson");

    const quizSettings = await this.lessonRepository.getLessonSettings(studentQuizAnswers.lessonId);

    const correctAnswersForQuizQuestions =
      await this.questionRepository.getQuizQuestionsToEvaluation(
        studentQuizAnswers.lessonId,
        studentQuizAnswers.language,
      );

    if (correctAnswersForQuizQuestions.length !== studentQuizAnswers.questionsAnswers.length) {
      throw new ConflictException("Quiz is not completed");
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
            quizCompleted: true,
            completedQuestionCount:
              evaluationResult.correctAnswerCount + evaluationResult.wrongAnswerCount,
            dbInstance: trx,
            isQuizPassed,
            language: studentQuizAnswers.language,
          });
        }

        this.eventBus.publish(
          new QuizCompletedEvent(
            userId,
            accessCourseLessonWithDetails.courseId,
            studentQuizAnswers.lessonId,
            evaluationResult.correctAnswerCount,
            evaluationResult.wrongAnswerCount,
            quizScore,
          ),
        );

        return {
          correctAnswerCount: evaluationResult.correctAnswerCount,
          wrongAnswerCount: evaluationResult.wrongAnswerCount,
          questionCount: evaluationResult.wrongAnswerCount + evaluationResult.correctAnswerCount,
          score: quizScore,
        };
      } catch (error) {
        throw new ConflictException(
          "Quiz evaluation failed, problem with question: " +
            error?.message +
            " problem is: " +
            error?.response?.error,
        );
      }
    });
  }

  async deleteStudentQuizAnswers(lessonId: UUIDType, userId: UUIDType): Promise<void> {
    const [accessCourseLessonWithDetails] = await this.lessonRepository.checkLessonAssignment(
      lessonId,
      userId,
    );

    if (!accessCourseLessonWithDetails.lessonIsCompleted) {
      throw new ConflictException("You have not answered this quiz yet");
    }

    if (!accessCourseLessonWithDetails.isAssigned) {
      throw new ConflictException("You are not enrolled to this course");
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
      throw new ConflictException(
        "Quiz answers cannot be deleted due to attempts limit or cooldown",
      );
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
        throw new ConflictException(`Failed to delete student quiz answers: ${error.message}`);
      }
    });
  }

  async getLessonResource(res: Response, userId: UUIDType, role: UserRole, resourceId: UUIDType) {
    const isStudent = role === USER_ROLES.STUDENT;

    const lessonResource = await this.lessonRepository.getResource(resourceId);

    if (!lessonResource || lessonResource.entityType !== ENTITY_TYPE.LESSON) {
      throw new NotFoundException("Lesson resource not found");
    }

    const [lesson] = await this.lessonRepository.checkLessonAssignment(
      lessonResource.entityId,
      userId,
    );

    if (!lesson.isAssigned && isStudent && !lesson.isFreemium) {
      throw new ForbiddenException("You are not allowed to access this lesson!");
    }

    const fileUrl = await this.fileService.getFileUrl(lessonResource.reference);

    if (!fileUrl) throw new Error("Error fetching file url");

    return res.redirect(fileUrl);
  }

  async getEnrolledLessons(
    userId: UUIDType,
    filters: EnrolledLessonsFilters,
    language: SupportedLanguages,
  ): Promise<EnrolledLesson[]> {
    return await this.lessonRepository.getEnrolledLessons(userId, filters, language);
  }

  extractOriginalFilename(metadata: unknown) {
    if (!metadata || typeof metadata !== "object") return undefined;
    if ("originalFilename" in metadata && typeof metadata.originalFilename === "string")
      return metadata.originalFilename;
    return undefined;
  }

  private buildImageTag(resource: { fileUrl: string; title?: string }) {
    return `<img src="${resource.fileUrl}" alt="${resource.title ?? ""}" />`;
  }

  private buildVideoTag(resource: { fileUrl: string; title?: string }) {
    const isExternal = this.isExternalVideoUrl(resource.fileUrl);
    const externalAttr = isExternal ? "true" : "false";

    return `<div data-type="video" data-url="${
      resource.fileUrl
    }" data-external="${externalAttr}" aria-label="${resource.title ?? ""}"></div>`;
  }

  private isPresentationResource(resource: {
    contentType: string | null;
    fileUrl: string;
    fileName?: string;
  }) {
    if (
      resource.contentType ===
      "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    )
      return true;

    if (resource.fileName && /\.(pptx|ppt)(\?|#|$)/i.test(resource.fileName)) return true;

    return /\.(pptx|ppt)(\?|#|$)/i.test(resource.fileUrl);
  }

  private isExternalPresentationUrl(fileUrl: string) {
    if (!fileUrl) return false;
    if (fileUrl.includes("/api/lesson/lesson-resource/")) return false;
    if (fileUrl.includes("/api/lesson/lesson-image/")) return false;
    return !/\.(pptx|ppt)(\?|#|$)/i.test(fileUrl);
  }

  private isExternalVideoUrl(fileUrl: string) {
    if (!fileUrl) return false;
    return !fileUrl.includes("iframe.mediadelivery.net/embed/");
  }

  private buildPresentationTag(resource: { fileUrl: string; title?: string }) {
    const isExternal = this.isExternalPresentationUrl(resource.fileUrl);
    const externalAttr = isExternal ? "true" : "false";

    return `<div data-type="presentation" data-url="${
      resource.fileUrl
    }" data-external="${externalAttr}" aria-label="${resource.title ?? ""}"></div>`;
  }

  injectResourcesIntoContent(
    content: string | null,
    resources: Array<{
      id: UUIDType;
      fileUrl: string;
      contentType: string | null;
      title?: string;
      description?: string;
      fileName?: string;
    }>,
  ): { html: string | null; contentCount: Record<string, number> } {
    const contentCount: Record<string, number> = {};

    const increment = (key: string) => (contentCount[key] = (contentCount[key] ?? 0) + 1);

    if (!content) return { html: content, contentCount };

    if (!resources.length) return { html: content, contentCount };

    const $ = loadHtml(content);
    const resourceMap = new Map(resources.map((resource) => [resource.id, resource]));

    $("a").each((_, element) => {
      const anchor = $(element);
      const href = anchor.attr("href") || "";
      const dataResourceId = anchor.attr("data-resource-id");

      const matchingResource =
        (dataResourceId && resourceMap.get(dataResourceId as UUIDType)) ||
        resources.find((resource) => href.includes(String(resource.id)));

      if (!matchingResource) return;

      const parent = anchor.parent();

      if ((matchingResource.contentType ?? "").startsWith("image/")) {
        const imgTag = this.buildImageTag(matchingResource);
        if (parent.is("p")) {
          anchor.remove();
          parent.after(imgTag);
        } else {
          anchor.replaceWith(imgTag);
        }

        increment("image");
        return;
      }

      if ((matchingResource.contentType ?? "").startsWith("video/")) {
        const iframe = this.buildVideoTag(matchingResource);
        if (parent.is("p")) {
          anchor.remove();
          parent.after(iframe);
        } else {
          anchor.replaceWith(iframe);
        }

        increment("video");
        return;
      }

      if (this.isPresentationResource(matchingResource)) {
        const presentation = this.buildPresentationTag(matchingResource);
        if (parent.is("p")) {
          anchor.remove();
          parent.after(presentation);
        } else {
          anchor.replaceWith(presentation);
        }

        increment("presentation");
        return;
      }

      increment("file");

      anchor.attr("href", matchingResource.fileUrl);
      anchor.attr("download", matchingResource.fileName ?? "");
      anchor.attr("target", "_blank");
      anchor.attr("rel", "noopener noreferrer");
      anchor.text(
        matchingResource.title || matchingResource.fileName || matchingResource.description || "",
      );
    });

    return { html: $.html($("body").children()), contentCount };
  }

  private hasOnlyVideo(contentCount: Record<string, number>) {
    return contentCount.video === 1 && Object.keys(contentCount).length === 1;
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
