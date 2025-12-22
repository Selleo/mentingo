import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBody, ApiConsumes, ApiResponse } from "@nestjs/swagger";
import { SupportedLanguages } from "@repo/shared";
import { Type } from "@sinclair/typebox";
import { Response } from "express";
import { Validate } from "nestjs-typebox";

import { baseResponse, BaseResponse, UUIDSchema, type UUIDType } from "src/common";
import { Roles } from "src/common/decorators/roles.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { RolesGuard } from "src/common/guards/roles.guard";
import { CurrentUser as CurrentUserType } from "src/common/types/current-user.type";
import { supportedLanguagesSchema } from "src/courses/schemas/course.schema";
import { USER_ROLES, UserRole } from "src/user/schemas/userRoles";

import {
  AnswerQuestionBody,
  answerQuestionsForLessonBody,
  CreateAiMentorLessonBody,
  createAiMentorLessonSchema,
  CreateLessonBody,
  createLessonSchema,
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
} from "./lesson.schema";
import { AdminLessonService } from "./services/adminLesson.service";
import { LessonService } from "./services/lesson.service";

import type { EnrolledLesson, EnrolledLessonsFilters, LessonShow } from "./lesson.schema";

@Controller("lesson")
@UseGuards(RolesGuard)
export class LessonController {
  constructor(
    private readonly adminLessonsService: AdminLessonService,
    private readonly lessonService: LessonService,
  ) {}

  @Get("student-lessons")
  @Roles(USER_ROLES.STUDENT)
  @Validate({
    request: [
      { type: "query", name: "title", schema: Type.String() },
      { type: "query", name: "description", schema: Type.String() },
      { type: "query", name: "searchQuery", schema: Type.String() },
      { type: "query", name: "lessonCompleted", schema: Type.String() },
      { type: "query", name: "language", schema: supportedLanguagesSchema },
    ],
    response: baseResponse(Type.Array(enrolledLessonSchema)),
  })
  async getEnrolledLessons(
    @Query("title") title: string,
    @Query("description") description: string,
    @Query("searchQuery") searchQuery: string,
    @Query("lessonCompleted") lessonCompleted: string,
    @Query("language") language: SupportedLanguages,
    @CurrentUser("userId") userId: UUIDType,
  ): Promise<BaseResponse<EnrolledLesson[]>> {
    const filters: EnrolledLessonsFilters = {
      title,
      description,
      searchQuery,
      lessonCompleted: lessonCompleted ? lessonCompleted === "true" : undefined,
    };
    const lessons = await this.lessonService.getEnrolledLessons(userId, filters, language);
    return new BaseResponse(lessons);
  }

  @Get(":id")
  @Validate({
    request: [
      { type: "param", name: "id", schema: UUIDSchema },
      { type: "query", name: "language", schema: supportedLanguagesSchema },
    ],
    response: baseResponse(lessonShowSchema),
  })
  async getLessonById(
    @Param("id") id: UUIDType,
    @Query("language") language: SupportedLanguages,
    @Query("studentId") studentId: UUIDType,
    @CurrentUser("userId") userId: UUIDType,
    @CurrentUser("role") userRole: UserRole,
  ): Promise<BaseResponse<LessonShow>> {
    return new BaseResponse(
      await this.lessonService.getLessonById(id, studentId || userId, userRole, language),
    );
  }

  @Post("beta-create-lesson")
  @Roles(USER_ROLES.CONTENT_CREATOR, USER_ROLES.ADMIN)
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

  @Post("beta-create-lesson/ai")
  @Roles(USER_ROLES.CONTENT_CREATOR, USER_ROLES.ADMIN)
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
  @Roles(USER_ROLES.CONTENT_CREATOR, USER_ROLES.ADMIN)
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
  @Roles(USER_ROLES.CONTENT_CREATOR, USER_ROLES.ADMIN)
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
  @Roles(USER_ROLES.CONTENT_CREATOR, USER_ROLES.ADMIN)
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
  @Roles(USER_ROLES.CONTENT_CREATOR, USER_ROLES.ADMIN)
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
  @Roles(USER_ROLES.CONTENT_CREATOR, USER_ROLES.ADMIN)
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
      message: "Lesson removed from course successfully",
    });
  }

  @Post("evaluation-quiz")
  @Roles(USER_ROLES.STUDENT)
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
    @CurrentUser("userId") currentUserId: UUIDType,
    @CurrentUser("role") userRole: UserRole,
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
    const evaluationResult = await this.lessonService.evaluationQuiz(
      answers,
      currentUserId,
      userRole,
    );
    return new BaseResponse({
      message: "Evaluation quiz successfully",
      data: evaluationResult,
    });
  }

  @Post("upload-files-to-lesson")
  @Roles(USER_ROLES.ADMIN, USER_ROLES.CONTENT_CREATOR)
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
      },
      required: ["lessonId", "file"],
    },
  })
  @ApiResponse({
    status: 201,
    description: "File uploaded successfully",
    type: String,
  })
  async uploadImageToLesson(
    @Body("lessonId") lessonId: UUIDType,
    @CurrentUser("userId") userId: UUIDType,
    @CurrentUser("role") role: UserRole,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.adminLessonsService.uploadFileToLesson(lessonId, userId, role, file);
  }

  @Delete("delete-student-quiz-answers")
  @Roles(USER_ROLES.STUDENT)
  @Validate({
    request: [{ type: "query", name: "lessonId", schema: UUIDSchema, required: true }],
    response: baseResponse(Type.Object({ message: Type.String() })),
  })
  async deleteStudentQuizAnswers(
    @Query("lessonId") lessonId: UUIDType,
    @CurrentUser("userId") currentUserId: UUIDType,
  ): Promise<BaseResponse<{ message: string }>> {
    await this.lessonService.deleteStudentQuizAnswers(lessonId, currentUserId);
    return new BaseResponse({ message: "Evaluation quiz answers removed successfully" });
  }

  @Post("create-lesson/embed")
  @Roles(USER_ROLES.CONTENT_CREATOR, USER_ROLES.ADMIN)
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
  @Roles(USER_ROLES.CONTENT_CREATOR, USER_ROLES.ADMIN)
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

  //   @Delete("clear-quiz-progress")
  //   @Roles(USER_ROLES.STUDENT)
  //   @Validate({
  //     request: [
  //       { type: "query", name: "courseId", schema: UUIDSchema, required: true },
  //       { type: "query", name: "lessonId", schema: UUIDSchema, required: true },
  //     ],
  //     response: baseResponse(Type.Object({ message: Type.String() })),
  //   })
  //   async clearQuizProgress(
  //     @Query("courseId") courseId: UUIDType,
  //     @Query("lessonId") lessonId: UUIDType,
  //     @CurrentUser("userId") currentUserId: UUIDType,
  //   ): Promise<BaseResponse<{ message: string }>> {
  //     const result = await this.lessonsService.clearQuizProgress(courseId, lessonId, currentUserId);
  //     if (result)
  //       return new BaseResponse({
  //         message: "Evaluation quiz successfully",
  //       });

  //     return new BaseResponse({
  //       message: "Evaluation quiz ending in error",
  //     });
  //   }

  @Get("lesson-image/:resourceId")
  @Validate({
    request: [{ type: "param", schema: UUIDSchema, name: "resourceId" }],
  })
  async getLessonImage(
    @Param("resourceId") resourceId: UUIDType,
    @CurrentUser("userId") userId: UUIDType,
    @CurrentUser("role") role: UserRole,
    @Res() res: Response,
  ) {
    return this.lessonService.getLessonImage(res, userId, role, resourceId);
  }

  @Post("ai-mentor/avatar")
  @Roles(USER_ROLES.CONTENT_CREATOR, USER_ROLES.ADMIN)
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
    @CurrentUser("role") role: UserRole,
    @CurrentUser("userId") userId: UUIDType,
    @Body("lessonId") lessonId: UUIDType,
    @UploadedFile() uploadedFile: Express.Multer.File | null,
  ) {
    await this.adminLessonsService.uploadAvatarToAiMentorLesson(
      userId,
      role,
      lessonId,
      uploadedFile,
    );
  }

  @Patch("update-lesson-display-order")
  @Roles(USER_ROLES.CONTENT_CREATOR, USER_ROLES.ADMIN)
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
