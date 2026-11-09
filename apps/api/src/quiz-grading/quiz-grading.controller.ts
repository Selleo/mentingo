import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { PERMISSIONS } from "@repo/shared";
import { Type } from "@sinclair/typebox";
import { Validate } from "nestjs-typebox";

import {
  BaseResponse,
  PaginatedResponse,
  UUIDSchema,
  baseResponse,
  paginatedResponse,
  type UUIDType,
} from "src/common";
import { RequirePermission } from "src/common/decorators/require-permission.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { CurrentUserType } from "src/common/types/current-user.type";

import {
  gradeQuizAnswerResponseSchema,
  gradeQuizAnswerSchema,
  quizGradingAnswerDetailsSchema,
  quizGradingAnswerListSchema,
  quizGradingFiltersSchema,
  quizGradingStatusSchema,
  type GradeQuizAnswerBody,
  type GradeQuizAnswerResponse,
  type QuizGradingAnswerDetailsResponse,
  type QuizGradingAnswerListResponse,
  type QuizGradingFiltersResponse,
  type QuizGradingStatus,
} from "./quiz-grading.schema";
import { QuizGradingService } from "./quiz-grading.service";

@Controller("quiz-grading")
export class QuizGradingController {
  constructor(private readonly quizGradingService: QuizGradingService) {}

  @Get("answers")
  @RequirePermission(PERMISSIONS.QUIZ_GRADING_READ)
  @Validate({
    request: [
      { type: "query", name: "page", schema: Type.Optional(Type.Number({ minimum: 1 })) },
      { type: "query", name: "perPage", schema: Type.Optional(Type.Number({ minimum: 1 })) },
      { type: "query", name: "status", schema: Type.Optional(quizGradingStatusSchema) },
      { type: "query", name: "courseId", schema: Type.Optional(UUIDSchema) },
      { type: "query", name: "lessonId", schema: Type.Optional(UUIDSchema) },
      { type: "query", name: "studentId", schema: Type.Optional(UUIDSchema) },
    ],
    response: paginatedResponse(quizGradingAnswerListSchema),
  })
  async getAnswers(
    @Query("page") page: number | undefined,
    @Query("perPage") perPage: number | undefined,
    @Query("status") status: QuizGradingStatus | undefined,
    @Query("courseId") courseId: UUIDType | undefined,
    @Query("lessonId") lessonId: UUIDType | undefined,
    @Query("studentId") studentId: UUIDType | undefined,
    @CurrentUser("userId") reviewerId: UUIDType,
  ): Promise<PaginatedResponse<QuizGradingAnswerListResponse>> {
    return new PaginatedResponse(
      await this.quizGradingService.getAnswers(
        { status, courseId, lessonId, studentId },
        reviewerId,
        page,
        perPage,
      ),
    );
  }

  @Get("filters")
  @RequirePermission(PERMISSIONS.QUIZ_GRADING_READ)
  @Validate({ response: baseResponse(quizGradingFiltersSchema) })
  async getFilterOptions(
    @CurrentUser("userId") reviewerId: UUIDType,
  ): Promise<BaseResponse<QuizGradingFiltersResponse>> {
    return new BaseResponse(await this.quizGradingService.getFilterOptions(reviewerId));
  }

  @Get("answers/:id")
  @RequirePermission(PERMISSIONS.QUIZ_GRADING_READ)
  @Validate({
    request: [{ type: "param", name: "id", schema: UUIDSchema }],
    response: baseResponse(quizGradingAnswerDetailsSchema),
  })
  async getAnswerDetails(
    @Param("id") id: UUIDType,
    @CurrentUser("userId") reviewerId: UUIDType,
  ): Promise<BaseResponse<QuizGradingAnswerDetailsResponse>> {
    return new BaseResponse(await this.quizGradingService.getAnswerDetails(id, reviewerId));
  }

  @Post("answers/:id/grade")
  @RequirePermission(PERMISSIONS.QUIZ_GRADING_GRADE)
  @Validate({
    request: [
      { type: "param", name: "id", schema: UUIDSchema },
      { type: "body", schema: gradeQuizAnswerSchema },
    ],
    response: baseResponse(gradeQuizAnswerResponseSchema),
  })
  async gradeAnswer(
    @Param("id") id: UUIDType,
    @Body() body: GradeQuizAnswerBody,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<GradeQuizAnswerResponse>> {
    return new BaseResponse(await this.quizGradingService.gradeAnswer(id, body, currentUser));
  }
}
