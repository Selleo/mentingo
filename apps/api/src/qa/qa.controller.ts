import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { SupportedLanguages } from "@repo/shared";
import { Validate } from "nestjs-typebox";

import { UUIDSchema, UUIDType } from "src/common";
import { Public } from "src/common/decorators/public.decorator";
import { Roles } from "src/common/decorators/roles.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { RolesGuard } from "src/common/guards/roles.guard";
import { supportedLanguagesSchema } from "src/courses/schemas/course.schema";
import {
  type AllQAResponseBody,
  allQAResponseSchema,
  type CreateQABody,
  createQASchema,
  type QAResponseBody,
  QAResponseSchema,
  QAUpdateBody,
  QAUpdateSchema,
} from "src/qa/schemas/qa.schema";
import { QAService } from "src/qa/services/qa.service";
import { USER_ROLES } from "src/user/schemas/userRoles";

@Controller("qa")
@UseGuards(RolesGuard)
export class QAController {
  constructor(private readonly qaService: QAService) {}

  @Public()
  @Get(":qaId")
  @Validate({
    request: [
      { type: "param", name: "qaId", schema: UUIDSchema },
      { type: "query", name: "language", schema: supportedLanguagesSchema },
    ],
    response: QAResponseSchema,
  })
  async getQA(
    @Param("qaId") qaId: UUIDType,
    @Query("language") language: SupportedLanguages,
    @CurrentUser("userId") userId?: UUIDType,
  ): Promise<QAResponseBody> {
    return this.qaService.getQA(qaId, language, userId);
  }

  @Public()
  @Get()
  @Validate({
    request: [{ type: "query", name: "language", schema: supportedLanguagesSchema }],
    response: allQAResponseSchema,
  })
  async getAllQA(
    @Query("language") language: SupportedLanguages,
    @CurrentUser("userId") userId: UUIDType,
  ): Promise<AllQAResponseBody> {
    return this.qaService.getAllQA(language, userId);
  }

  @Post()
  @Validate({
    request: [{ type: "body", schema: createQASchema }],
  })
  @Roles(USER_ROLES.ADMIN)
  async createQA(@Body() data: CreateQABody, @CurrentUser("userId") userId: UUIDType) {
    return this.qaService.createQA(data, userId);
  }

  @Post("create-language/:qaId")
  @Validate({
    request: [
      { type: "param", name: "qaId", schema: UUIDSchema },
      { type: "query", name: "language", schema: supportedLanguagesSchema },
    ],
  })
  @Roles(USER_ROLES.ADMIN)
  async createLanguage(
    @Param("qaId") qaId: UUIDType,
    @Query("language") language: SupportedLanguages,
  ) {
    return this.qaService.createLanguage(qaId, language);
  }

  @Patch(":qaId")
  @Validate({
    request: [
      { type: "param", name: "qaId", schema: UUIDSchema },
      { type: "query", name: "language", schema: supportedLanguagesSchema },
      { type: "body", schema: QAUpdateSchema },
    ],
  })
  @Roles(USER_ROLES.ADMIN)
  async updateQA(
    @Param("qaId") qaId: UUIDType,
    @Query("language") language: SupportedLanguages,
    @Body() data: QAUpdateBody,
  ) {
    return this.qaService.updateQA(data, qaId, language);
  }

  @Delete(":qaId")
  @Validate({
    request: [{ type: "param", name: "qaId", schema: UUIDSchema }],
  })
  @Roles(USER_ROLES.ADMIN)
  async deleteQA(@Param("qaId") qaId: UUIDType) {
    return this.qaService.deleteQA(qaId);
  }

  @Delete("language/:qaId")
  @Validate({
    request: [
      { type: "param", name: "qaId", schema: UUIDSchema },
      { type: "query", name: "language", schema: supportedLanguagesSchema },
    ],
  })
  @Roles(USER_ROLES.ADMIN)
  async deleteLanguage(
    @Param("qaId") qaId: UUIDType,
    @Query("language") language: SupportedLanguages,
  ) {
    return this.qaService.deleteLanguage(qaId, language);
  }
}
