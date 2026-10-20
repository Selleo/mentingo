import {
  forwardRef,
  ForbiddenException,
  NotFoundException,
  Inject,
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBody, ApiConsumes, ApiResponse } from "@nestjs/swagger";
import {
  COURSE_LEARNING_STATE_KINDS,
  AI_THREAD_STATUSES,
  ALLOWED_AVATAR_IMAGE_TYPES,
  ALLOWED_EXCEL_FILE_TYPES,
  ALLOWED_LESSON_IMAGE_FILE_TYPES,
  ALLOWED_PDF_FILE_TYPES,
  ALLOWED_PRESENTATION_FILE_TYPES,
  ALLOWED_VIDEO_FILE_TYPES,
  ALLOWED_WORD_FILE_TYPES,
  FEATURES,
  PERMISSIONS,
  RESOURCE_VISIBILITY,
  SUPPORTED_LANGUAGES,
  SupportedLanguages,
  type EditableResourceVisibility,
} from "@repo/shared";
import { Type } from "@sinclair/typebox";
import { and, eq } from "drizzle-orm";
import { Request, Response } from "express";
import { Validate } from "nestjs-typebox";

import { AiService } from "src/ai/services/ai.service";
import { DatabasePg } from "src/common";
import { baseResponse, BaseResponse, UUIDSchema, type UUIDType } from "src/common";
import { Public } from "src/common/decorators/public.decorator";
import { RequireFeature } from "src/common/decorators/require-feature.decorator";
import { RequirePermission } from "src/common/decorators/require-permission.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { FeaturesGuard } from "src/common/guards/features.guard";
import { getGroupManagerLearnerScopeCondition } from "src/common/permissions/group-manager-scope.utils";
import { hasAnyPermission } from "src/common/permissions/permission.utils";
import { CurrentUserType } from "src/common/types/current-user.type";
import { courseLearningContext } from "src/course-repetition/course-learning-context";
import {
  COURSE_LEARNING_TARGET_FIELDS,
  COURSE_LEARNING_TARGET_SOURCES,
} from "src/course-repetition/course-learning-write.constants";
import { CourseLearningWrite } from "src/course-repetition/course-learning-write.interceptor";
import {
  CourseRepetitionService,
  activeLearningStateId,
} from "src/course-repetition/course-repetition.service";
import { CourseService } from "src/courses/course.service";
import { supportedLanguagesSchema } from "src/courses/schemas/course.schema";
import { MAX_VIDEO_SIZE } from "src/file/file.constants";
import { filePreviewQuerySchema, FilePreviewQuery } from "src/file/types/file-preview.type";
import { getBaseFileTypePipe } from "src/file/utils/baseFileTypePipe";
import { buildFileTypeRegex } from "src/file/utils/fileTypeRegex";
import {
  assertAvatarUploadGrant,
  assertLessonUploadGrant,
} from "src/mcp/mcp-upload-grant.assertions";
import { McpRequest } from "src/mcp/mcp.types";
import { DB } from "src/storage/db/db.providers";
import { chapters, courseLearningStates, lessons, studentCourses } from "src/storage/schema";

import {
  AnswerQuestionBody,
  AttachLiveTrainingLessonBody,
  attachLiveTrainingLessonSchema,
  answerQuestionsForLessonBody,
  CreateAiMentorLessonBody,
  createAiMentorLessonSchema,
  CreateLessonBody,
  createLessonSchema,
  CreateLiveTrainingLessonBody,
  createLiveTrainingLessonResponseDataSchema,
  createLiveTrainingLessonSchema,
  CreateQuizLessonBody,
  createQuizLessonSchema,
  lessonShowSchema,
  UpdateAiMentorLessonBody,
  updateAiMentorLessonSchema,
  UpdateLessonBody,
  updateLessonSchema,
  UpdateQuizLessonBody,
  updateQuizLessonSchema,
  createEmbedLessonSchema,
  updateEmbedLessonSchema,
  CreateEmbedLessonBody,
  UpdateEmbedLessonBody,
  enrolledLessonSchema,
  initializeLessonContextSchema,
} from "./lesson.schema";
import { AdminLessonService } from "./services/adminLesson.service";
import { LessonService } from "./services/lesson.service";

import type {
  CreateLiveTrainingLessonResponseData,
  EnrolledLesson,
  LessonsFilters,
  LessonShow,
} from "./lesson.schema";
@Controller("lesson")
export class LessonController {
  constructor(
    private readonly adminLessonsService: AdminLessonService,
    private readonly lessonService: LessonService,
    private readonly aiService: AiService,
    @Inject(DB) private readonly db: DatabasePg,
    private readonly courseRepetitionService: CourseRepetitionService,
    @Inject(forwardRef(() => CourseService)) private readonly courseService: CourseService,
  ) {}

  @Get("all")
  @RequirePermission(PERMISSIONS.COURSE_READ)
  @Validate({
    request: [
      { type: "query", name: "title", schema: Type.String() },
      { type: "query", name: "description", schema: Type.String() },
      { type: "query", name: "lessonCompleted", schema: Type.String() },
      { type: "query", name: "language", schema: supportedLanguagesSchema },
    ],
    response: baseResponse(Type.Array(enrolledLessonSchema)),
  })
  async getLessons(
    @Query("title") title: string,
    @Query("description") description: string,
    @Query("lessonCompleted") lessonCompleted: string,
    @Query("language") language: SupportedLanguages,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<EnrolledLesson[]>> {
    const filters: LessonsFilters = {
      title,
      description,
      lessonCompleted: lessonCompleted ? lessonCompleted === "true" : undefined,
    };
    const lessons = await this.lessonService.getLessons(currentUser, filters, language);
    return new BaseResponse(lessons);
  }

  @Get(":id")
  @Public()
  @Validate({
    request: [
      { type: "param", name: "id", schema: UUIDSchema },
      { type: "query", name: "language", schema: supportedLanguagesSchema },
      { type: "query", name: "studentId", schema: Type.Optional(UUIDSchema) },
    ],
    response: baseResponse(lessonShowSchema),
  })
  async getLessonById(
    @Param("id") id: UUIDType,
    @Query("language") language: SupportedLanguages,
    @Query("studentId") studentId: UUIDType,
    @CurrentUser() currentUser: CurrentUserType | null,
  ): Promise<BaseResponse<LessonShow>> {
    if (!currentUser)
      return new BaseResponse(
        await this.lessonService.getLessonById(id, undefined, null, language),
      );
    const learnerId = studentId || currentUser.userId;
    const result = await this.db.transaction(async (db) => {
      const [course] = await db
        .select({ courseId: chapters.courseId })
        .from(chapters)
        .innerJoin(lessons, eq(lessons.chapterId, chapters.id))
        .where(eq(lessons.id, id));
      if (course) await this.courseRepetitionService.lock(course.courseId, learnerId, db);
      let learningStateId = await activeLearningStateId(db, learnerId, id);
      const readOnly = learnerId !== currentUser.userId;
      if (readOnly) {
        if (
          !course ||
          !hasAnyPermission(currentUser.permissions, [
            PERMISSIONS.COURSE_STATISTICS,
            PERMISSIONS.MANAGED_GROUP_RESULTS_READ,
          ])
        )
          throw new ForbiddenException("common.toast.noAccess");
        await this.courseService.assertCanViewCourseStatistics(course.courseId, currentUser);
        const [enrollment] = await db
          .select({ id: studentCourses.id })
          .from(studentCourses)
          .where(
            and(
              eq(studentCourses.courseId, course.courseId),
              eq(studentCourses.studentId, learnerId),
              getGroupManagerLearnerScopeCondition(currentUser, studentCourses.studentId, [
                PERMISSIONS.COURSE_STATISTICS,
              ]),
            ),
          );
        if (!enrollment) throw new NotFoundException("common.toast.notFound");
        const [current] = await db
          .select({ id: courseLearningStates.id })
          .from(courseLearningStates)
          .where(
            and(
              eq(courseLearningStates.courseId, course.courseId),
              eq(courseLearningStates.studentId, learnerId),
              eq(courseLearningStates.kind, COURSE_LEARNING_STATE_KINDS.CURRENT),
            ),
          );
        learningStateId = current?.id ?? null;
      }
      const learningContext = { learningStateId, readOnly };
      return courseLearningContext.run(learningContext, async () => {
        const lesson = await this.lessonService.getLessonById(id, learnerId, currentUser, language);
        return {
          response: new BaseResponse({ ...lesson, learningStateId }),
          readOnly: learningContext.readOnly,
        };
      });
    });
    const { response, readOnly } = result;
    if (!readOnly && response.data.threadId && response.data.status === AI_THREAD_STATUSES.ACTIVE) {
      await this.aiService.initializeLessonWelcome(response.data.threadId, learnerId);
    }
    return response;
  }

  @Post("beta-create-lesson")
  @RequirePermission(PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN)
  @Validate({
    request: [
      {
        type: "body",
        schema: createLessonSchema,
      },
    ],
    response: baseResponse(Type.Object({ id: UUIDSchema, message: Type.String() })),
  })
  async betaCreateLesson(
    @Body() createLessonBody: CreateLessonBody,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<{ id: UUIDType; message: string }>> {
    const id = await this.adminLessonsService.createLessonForChapter(createLessonBody, currentUser);

    return new BaseResponse({ id, message: "Lesson created successfully" });
  }

  @Post("beta-create-lesson/live")
  @UseGuards(FeaturesGuard)
  @RequireFeature({ features: [FEATURES.LIVE_TRAINING] })
  @RequirePermission(PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN)
  @Validate({
    request: [
      {
        type: "body",
        schema: createLiveTrainingLessonSchema,
      },
    ],
    response: baseResponse(createLiveTrainingLessonResponseDataSchema),
  })
  async betaCreateLiveTrainingLesson(
    @Body() createLiveTrainingLessonBody: CreateLiveTrainingLessonBody,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<CreateLiveTrainingLessonResponseData>> {
    const { lessonId, liveTrainingId } = await this.adminLessonsService.createLiveTrainingLesson(
      createLiveTrainingLessonBody,
      currentUser,
    );

    return new BaseResponse({
      id: lessonId,
      liveTrainingId,
      message: "adminCourseView.curriculum.lesson.toast.liveTrainingLessonCreated",
    });
  }

  @Patch(":lessonId/live-training")
  @UseGuards(FeaturesGuard)
  @RequireFeature({ features: [FEATURES.LIVE_TRAINING] })
  @RequirePermission(PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN)
  @Validate({
    request: [
      {
        type: "param",
        name: "lessonId",
        schema: UUIDSchema,
      },
      {
        type: "body",
        schema: attachLiveTrainingLessonSchema,
      },
    ],
    response: baseResponse(createLiveTrainingLessonResponseDataSchema),
  })
  async attachLiveTrainingLesson(
    @Param("lessonId") lessonId: UUIDType,
    @Body() attachLiveTrainingLessonBody: AttachLiveTrainingLessonBody,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<CreateLiveTrainingLessonResponseData>> {
    const { liveTrainingId } = await this.adminLessonsService.attachLiveTrainingLesson(
      lessonId,
      attachLiveTrainingLessonBody,
      currentUser,
    );

    return new BaseResponse({
      id: lessonId,
      liveTrainingId,
      message: "adminCourseView.curriculum.lesson.toast.liveTrainingLessonAttached",
    });
  }

  @Post("initialize-lesson-context")
  @RequirePermission(PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN)
  @Validate({
    response: baseResponse(initializeLessonContextSchema),
  })
  async initializeLessonContext() {
    return new BaseResponse(await this.adminLessonsService.initializeLessonContext());
  }

  @Post("beta-create-lesson/ai")
  @RequirePermission(PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN)
  @Validate({
    request: [
      {
        type: "body",
        schema: createAiMentorLessonSchema,
        required: true,
      },
    ],
    response: baseResponse(Type.Object({ id: UUIDSchema, message: Type.String() })),
  })
  async betaCreateAiMentorLesson(
    @Body() createAiMentorLessonBody: CreateAiMentorLessonBody,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<{ id: UUIDType; message: string }>> {
    const id = await this.adminLessonsService.createAiMentorLesson(
      createAiMentorLessonBody,
      currentUser,
    );

    return new BaseResponse({ id, message: "AI Mentor lesson created successfully" });
  }

  @Patch("beta-update-lesson/ai")
  @RequirePermission(PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN)
  @Validate({
    request: [
      {
        type: "query",
        name: "id",
        schema: UUIDSchema,
      },
      {
        type: "body",
        schema: updateAiMentorLessonSchema,
        required: true,
      },
    ],
    response: baseResponse(Type.Object({ message: Type.String() })),
  })
  async betaUpdateAiMentorLesson(
    @Query("id") id: UUIDType,
    @Body() data: UpdateAiMentorLessonBody,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<{ message: string }>> {
    await this.adminLessonsService.updateAiMentorLesson(id, data, currentUser);

    return new BaseResponse({ message: "AI Mentor lesson updated successfully" });
  }

  @Post("beta-create-lesson/quiz")
  @RequirePermission(PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN)
  @Validate({
    request: [
      {
        type: "body",
        schema: createQuizLessonSchema,
        required: true,
      },
    ],
    response: baseResponse(Type.Object({ id: UUIDSchema, message: Type.String() })),
  })
  async betaCreateQuizLesson(
    @Body() createQuizLessonBody: CreateQuizLessonBody,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<{ id: UUIDType; message: string }>> {
    const id = await this.adminLessonsService.createQuizLesson(createQuizLessonBody, currentUser);

    return new BaseResponse({ id, message: "Quiz created successfully" }) as any;
  }

  @Patch("beta-update-lesson/quiz")
  @RequirePermission(PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN)
  @Validate({
    request: [
      {
        type: "query",
        name: "id",
        schema: UUIDSchema,
      },
      {
        type: "body",
        schema: updateQuizLessonSchema,
        required: true,
      },
    ],
    response: baseResponse(Type.Object({ message: Type.String() })),
  })
  async betaUpdateQuizLesson(
    @Query("id") id: UUIDType,
    @Body() data: UpdateQuizLessonBody,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<{ message: string }>> {
    await this.adminLessonsService.updateQuizLesson(id, data, currentUser);
    return new BaseResponse({ message: "Quiz updated successfully" });
  }

  @Patch("beta-update-lesson")
  @RequirePermission(PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN)
  @Validate({
    request: [
      {
        type: "query",
        name: "id",
        schema: UUIDSchema,
      },
      {
        type: "body",
        schema: updateLessonSchema,
      },
    ],
    response: baseResponse(Type.Object({ message: Type.String() })),
  })
  async betaUpdateLesson(
    @Query("id") id: UUIDType,
    @Body() data: UpdateLessonBody,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<{ message: string }>> {
    await this.adminLessonsService.updateLesson(id, data, currentUser);
    return new BaseResponse({ message: "Text block updated successfully" });
  }

  @Delete()
  @RequirePermission(PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN)
  @Validate({
    request: [{ type: "query", name: "lessonId", schema: UUIDSchema, required: true }],
    response: baseResponse(Type.Object({ message: Type.String() })),
  })
  async removeLesson(
    @Query("lessonId") lessonId: UUIDType,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<{ message: string }>> {
    await this.adminLessonsService.removeLesson(lessonId, currentUser);

    return new BaseResponse({
      message: "adminCourseView.curriculum.lesson.toast.lessonDeletedSuccessfully",
    });
  }

  @CourseLearningWrite({
    source: COURSE_LEARNING_TARGET_SOURCES.BODY,
    field: COURSE_LEARNING_TARGET_FIELDS.LESSON_ID,
  })
  @Post("evaluation-quiz")
  @RequirePermission(PERMISSIONS.LEARNING_PROGRESS_UPDATE, PERMISSIONS.LEARNING_MODE_USE)
  @Validate({
    request: [{ type: "body", schema: answerQuestionsForLessonBody, required: true }],
    response: baseResponse(
      Type.Object({
        message: Type.String(),
        data: Type.Object({
          correctAnswerCount: Type.Number(),
          wrongAnswerCount: Type.Number(),
          questionCount: Type.Number(),
          score: Type.Number(),
        }),
      }),
    ),
  })
  async evaluationQuiz(
    @Body() answers: AnswerQuestionBody,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<
    BaseResponse<{
      message: string;
      data: {
        correctAnswerCount: number;
        wrongAnswerCount: number;
        questionCount: number;
        score: number;
      };
    }>
  > {
    const evaluationResult = await this.lessonService.evaluationQuiz(answers, currentUser);
    return new BaseResponse({
      message: "Evaluation quiz successfully",
      data: evaluationResult,
    });
  }

  @Post("upload-files-to-lesson")
  @RequirePermission(PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN)
  @UseInterceptors(FileInterceptor("file"))
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        lessonId: { type: "string", format: "uuid" },
        file: {
          type: "string",
          format: "binary",
        },
        language: {
          type: "string",
          enum: Object.values(SUPPORTED_LANGUAGES),
        },
        title: {
          type: "string",
        },
        description: {
          type: "string",
        },
        contextId: {
          type: "string",
        },
        visibility: {
          type: "string",
          enum: [RESOURCE_VISIBILITY.PUBLIC, RESOURCE_VISIBILITY.PRIVATE],
        },
      },
      required: ["file", "language", "title", "description"],
    },
  })
  @ApiResponse({
    status: 201,
    description: "File uploaded successfully",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean" },
        data: {
          type: "object",
          properties: {
            resourceId: { type: "string" },
          },
          required: ["resourceId"],
        },
        message: { type: "string" },
      },
      required: ["success", "data", "message"],
    },
  })
  async uploadFileToLesson(
    @Req() request: McpRequest,
    @CurrentUser() currentUser: CurrentUserType,
    @UploadedFile(
      getBaseFileTypePipe(
        buildFileTypeRegex([
          ...ALLOWED_PDF_FILE_TYPES,
          ...ALLOWED_EXCEL_FILE_TYPES,
          ...ALLOWED_WORD_FILE_TYPES,
          ...ALLOWED_VIDEO_FILE_TYPES,
          ...ALLOWED_LESSON_IMAGE_FILE_TYPES,
          ...ALLOWED_PRESENTATION_FILE_TYPES,
        ]),
        MAX_VIDEO_SIZE,
      ).build({ errorHttpStatusCode: HttpStatus.BAD_REQUEST }),
    )
    file: Express.Multer.File,
    @Body("language") language: SupportedLanguages,
    @Body("title") title: string,
    @Body("description") description: string,
    @Body("lessonId") lessonId?: UUIDType,
    @Body("contextId") contextId?: string,
    @Body("visibility") visibility: EditableResourceVisibility = RESOURCE_VISIBILITY.PUBLIC,
  ) {
    if (request.mcpUploadGrant) {
      assertLessonUploadGrant(
        request.mcpUploadGrant,
        file,
        lessonId,
        language,
        title,
        description,
        contextId,
        visibility,
      );
    }

    const fileData = await this.adminLessonsService.uploadFileToLesson(
      currentUser,
      file,
      language,
      title,
      description,
      lessonId,
      contextId,
      visibility,
    );

    return new BaseResponse(fileData);
  }

  @CourseLearningWrite({
    source: COURSE_LEARNING_TARGET_SOURCES.QUERY,
    field: COURSE_LEARNING_TARGET_FIELDS.LESSON_ID,
  })
  @Delete("delete-student-quiz-answers")
  @RequirePermission(PERMISSIONS.LEARNING_PROGRESS_UPDATE, PERMISSIONS.LEARNING_MODE_USE)
  @Validate({
    request: [{ type: "query", name: "lessonId", schema: UUIDSchema, required: true }],
    response: baseResponse(Type.Object({ message: Type.String() })),
  })
  async deleteStudentQuizAnswers(
    @Query("lessonId") lessonId: UUIDType,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<{ message: string }>> {
    await this.lessonService.deleteStudentQuizAnswers(lessonId, currentUser);
    return new BaseResponse({ message: "Evaluation quiz answers removed successfully" });
  }

  @Post("create-lesson/embed")
  @RequirePermission(PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN)
  @Validate({
    request: [{ type: "body", schema: createEmbedLessonSchema, required: true }],
    response: baseResponse(Type.Object({ message: Type.String() })),
  })
  async createEmbedLesson(
    @Body() data: CreateEmbedLessonBody,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<{ message: string }>> {
    await this.adminLessonsService.createEmbedLesson(data, currentUser);
    return new BaseResponse({ message: "Embed lesson created successfully" });
  }

  @Patch("update-lesson/embed/:id")
  @RequirePermission(PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN)
  @Validate({
    request: [
      { type: "param", name: "id", schema: UUIDSchema, required: true },
      { type: "body", schema: updateEmbedLessonSchema, required: true },
    ],
    response: baseResponse(Type.Object({ message: Type.String() })),
  })
  async updateEmbedLesson(
    @Param("id") id: UUIDType,
    @Body() data: UpdateEmbedLessonBody,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<{ message: string }>> {
    await this.adminLessonsService.updateEmbedLesson(id, currentUser, data);
    return new BaseResponse({ message: "Embed lesson updated successfully" });
  }

  @Get("lesson-image/:resourceId")
  @Public()
  @Validate({
    request: [
      { type: "param", schema: UUIDSchema, name: "resourceId" },
      { type: "query", name: "preview", schema: filePreviewQuerySchema },
    ],
  })
  async getLessonImage(
    @Param("resourceId") resourceId: UUIDType,
    @Query("preview") preview: FilePreviewQuery,
    @CurrentUser() currentUser: CurrentUserType | null,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    return this.lessonService.getLessonResource(req, res, currentUser, resourceId, preview);
  }

  @Get("lesson-resource/:resourceId")
  @Public()
  @Validate({
    request: [
      { type: "param", schema: UUIDSchema, name: "resourceId" },
      { type: "query", name: "preview", schema: filePreviewQuerySchema },
    ],
  })
  async getLessonResource(
    @Param("resourceId") resourceId: UUIDType,
    @Query("preview") preview: FilePreviewQuery,
    @CurrentUser() currentUser: CurrentUserType | null,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    return this.lessonService.getLessonResource(req, res, currentUser, resourceId, preview);
  }

  @Post("ai-mentor/avatar")
  @RequirePermission(PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN)
  @UseInterceptors(FileInterceptor("file"))
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        lessonId: { type: "string", format: "uuid" },
        file: {
          type: "string",
          format: "binary",
          nullable: true,
        },
      },
      required: ["lessonId", "file"],
    },
  })
  @ApiResponse({
    status: 201,
    description: "File uploaded successfully",
    type: String,
  })
  async uploadAiMentorAvatar(
    @CurrentUser() currentUser: CurrentUserType,
    @Body("lessonId") lessonId: UUIDType,
    @UploadedFile(
      getBaseFileTypePipe(buildFileTypeRegex(ALLOWED_AVATAR_IMAGE_TYPES)).build({
        fileIsRequired: false,
        errorHttpStatusCode: HttpStatus.BAD_REQUEST,
      }),
    )
    uploadedFile: Express.Multer.File | null,
    @Req() request: McpRequest,
  ) {
    if (request.mcpUploadGrant)
      assertAvatarUploadGrant(request.mcpUploadGrant, lessonId, uploadedFile);
    await this.adminLessonsService.uploadAvatarToAiMentorLesson(
      currentUser,
      lessonId,
      uploadedFile,
    );
  }

  @Patch("update-lesson-display-order")
  @RequirePermission(PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN)
  @Validate({
    request: [
      {
        type: "body",
        schema: Type.Object({
          lessonId: UUIDSchema,
          displayOrder: Type.Number(),
        }),
        required: true,
      },
    ],
    response: baseResponse(Type.Object({ message: Type.String() })),
  })
  async updateLessonDisplayOrder(
    @Body()
    body: {
      lessonId: UUIDType;
      displayOrder: number;
    },
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<{ message: string }>> {
    await this.adminLessonsService.updateLessonDisplayOrder({
      ...body,
      currentUser,
    });

    return new BaseResponse({
      message: "Lesson display order updated successfully",
    });
  }
}
