import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { Validate } from "nestjs-typebox";

import { UUIDSchema, UUIDType } from "src/common";
import { Roles } from "src/common/decorators/roles.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { RolesGuard } from "src/common/guards/roles.guard";
import { CreateQABody, createQASchema } from "src/qa/schemas/qa.schema";
import { QAService } from "src/qa/services/qa.service";
import { USER_ROLES } from "src/user/schemas/userRoles";
import { Public } from "src/common/decorators/public.decorator";
import { supportedLanguagesSchema } from "src/courses/schemas/course.schema";
import { SupportedLanguages } from "@repo/shared";

@Controller("qa")
@UseGuards(RolesGuard)
export class QAController {
  constructor(private readonly qaService: QAService) {}

  @Post()
  @Validate({
    request: [{ type: "body", schema: createQASchema }],
  })
  @Roles(USER_ROLES.ADMIN)
  async createQA(@Body() data: CreateQABody, @CurrentUser("userId") userId: UUIDType) {
    return this.qaService.createQA(data, userId);
  }

  @Public()
  @Get(":qaId")
  @Validate({
    request: [
      { type: "param", name: "qaId", schema: UUIDSchema },
      { type: "query", name: "language", schema: supportedLanguagesSchema },
    ],
  })
  async getQA(
    @Param("qaId") qaId: UUIDType,
    @Query("language") language: SupportedLanguages,
    @CurrentUser("userId") userId?: UUIDType,
  ) {
    return this.qaService.getQA(qaId, language, userId);
  }
}
