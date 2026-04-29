import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBody, ApiConsumes } from "@nestjs/swagger";
import { PERMISSIONS, SUPPORTED_LANGUAGES, type SupportedLanguages } from "@repo/shared";
import { Type } from "@sinclair/typebox";
import { Validate } from "nestjs-typebox";

import { baseResponse, BaseResponse, UUIDSchema, type UUIDType } from "src/common";
import { RequirePermission } from "src/common/decorators/require-permission.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { PermissionsGuard } from "src/common/guards/permissions.guard";
import { CurrentUserType } from "src/common/types/current-user.type";

import { AchievementsService } from "./achievements.service";
import {
  achievementImageUploadResponseSchema,
  achievementSchema,
  achievementsListSchema,
  createAchievementSchema,
  type CreateAchievementBody,
  updateAchievementSchema,
  type UpdateAchievementBody,
} from "./schemas/achievement.schema";

@UseGuards(PermissionsGuard)
@Controller("achievements/admin")
export class AchievementsController {
  constructor(private readonly achievementsService: AchievementsService) {}

  @Get()
  @RequirePermission(PERMISSIONS.TENANT_MANAGE)
  @Validate({
    request: [
      { type: "query", name: "includeInactive", schema: Type.Optional(Type.String()) },
      { type: "query", name: "language", schema: Type.Optional(Type.Enum(SUPPORTED_LANGUAGES)) },
    ],
    response: baseResponse(achievementsListSchema),
  })
  async findAll(
    @Query("includeInactive") includeInactive: string | undefined,
    @Query("language") language: SupportedLanguages | undefined,
    @CurrentUser() currentUser: CurrentUserType,
  ) {
    return new BaseResponse(
      await this.achievementsService.findAll({
        tenantId: currentUser.tenantId,
        includeInactive: includeInactive === "true",
        language,
      }),
    );
  }

  @Get(":id")
  @RequirePermission(PERMISSIONS.TENANT_MANAGE)
  @Validate({
    request: [
      { type: "param", name: "id", schema: UUIDSchema },
      { type: "query", name: "language", schema: Type.Optional(Type.Enum(SUPPORTED_LANGUAGES)) },
    ],
    response: baseResponse(achievementSchema),
  })
  async findById(
    @Param("id") id: UUIDType,
    @Query("language") language: SupportedLanguages | undefined,
    @CurrentUser() currentUser: CurrentUserType,
  ) {
    return new BaseResponse(
      await this.achievementsService.findById({ id, tenantId: currentUser.tenantId, language }),
    );
  }

  @Post()
  @RequirePermission(PERMISSIONS.TENANT_MANAGE)
  @Validate({
    request: [{ type: "body", schema: createAchievementSchema }],
    response: baseResponse(achievementSchema),
  })
  async create(@Body() body: CreateAchievementBody, @CurrentUser() currentUser: CurrentUserType) {
    return new BaseResponse(await this.achievementsService.create(currentUser.tenantId, body));
  }

  @Patch(":id")
  @RequirePermission(PERMISSIONS.TENANT_MANAGE)
  @Validate({
    request: [
      { type: "param", name: "id", schema: UUIDSchema },
      { type: "body", schema: updateAchievementSchema },
    ],
    response: baseResponse(achievementSchema),
  })
  async update(
    @Param("id") id: UUIDType,
    @Body() body: UpdateAchievementBody,
    @CurrentUser() currentUser: CurrentUserType,
  ) {
    return new BaseResponse(
      await this.achievementsService.update({
        id,
        tenantId: currentUser.tenantId,
        payload: body,
      }),
    );
  }

  @Delete(":id")
  @RequirePermission(PERMISSIONS.TENANT_MANAGE)
  @Validate({
    request: [{ type: "param", name: "id", schema: UUIDSchema }],
    response: baseResponse(achievementSchema),
  })
  async softDelete(@Param("id") id: UUIDType, @CurrentUser() currentUser: CurrentUserType) {
    return new BaseResponse(await this.achievementsService.softDelete(id, currentUser.tenantId));
  }

  @Post("image")
  @RequirePermission(PERMISSIONS.TENANT_MANAGE)
  @UseInterceptors(FileInterceptor("image"))
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        image: { type: "string", format: "binary" },
      },
    },
  })
  @Validate({
    response: baseResponse(achievementImageUploadResponseSchema),
  })
  async uploadImage(@UploadedFile() image: Express.Multer.File) {
    return new BaseResponse(await this.achievementsService.uploadImage(image));
  }
}
