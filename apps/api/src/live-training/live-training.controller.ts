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
import { FEATURES, PERMISSIONS } from "@repo/shared";
import { Validate } from "nestjs-typebox";

import {
  BaseResponse,
  PaginatedResponse,
  UUIDSchema,
  baseResponse,
  type UUIDType,
} from "src/common";
import { RequireFeature } from "src/common/decorators/require-feature.decorator";
import { RequirePermission } from "src/common/decorators/require-permission.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { FeaturesGuard } from "src/common/guards/features.guard";
import { PermissionsGuard } from "src/common/guards/permissions.guard";
import { CurrentUserType } from "src/common/types/current-user.type";

import { LiveTrainingService } from "./live-training.service";
import {
  createLiveTrainingResponseSchema,
  createLiveTrainingSchema,
  type CreateLiveTrainingBody,
} from "./schemas/create-live-training.schema";
import {
  liveTrainingDeleteResponseSchema,
  type LiveTrainingDeleteResponse,
} from "./schemas/live-training-common.schema";
import {
  liveTrainingDetailsResponseSchema,
  type LiveTrainingDetails,
} from "./schemas/live-training-details.schema";
import {
  liveTrainingListQuerySchema,
  type LiveTrainingListQuery,
} from "./schemas/live-training-list-query.schema";
import {
  liveTrainingListResponseSchema,
  type LiveTrainingListItem,
} from "./schemas/live-training-list.schema";
import {
  updateLiveTrainingResponseSchema,
  updateLiveTrainingSchema,
  type UpdateLiveTrainingBody,
} from "./schemas/update-live-training.schema";

@UseGuards(FeaturesGuard, PermissionsGuard)
@RequireFeature(FEATURES.LIVE_TRAINING)
@Controller("live-training")
export class LiveTrainingController {
  constructor(private readonly liveTrainingService: LiveTrainingService) {}

  @Get()
  @RequirePermission(PERMISSIONS.LIVE_TRAINING_READ)
  @Validate({
    request: [
      { type: "query", name: "page", schema: liveTrainingListQuerySchema.properties.page },
      { type: "query", name: "perPage", schema: liveTrainingListQuerySchema.properties.perPage },
      { type: "query", name: "status", schema: liveTrainingListQuerySchema.properties.status },
      {
        type: "query",
        name: "deliveryType",
        schema: liveTrainingListQuerySchema.properties.deliveryType,
      },
      { type: "query", name: "start", schema: liveTrainingListQuerySchema.properties.start },
      { type: "query", name: "end", schema: liveTrainingListQuerySchema.properties.end },
      { type: "query", name: "courseId", schema: liveTrainingListQuerySchema.properties.courseId },
      { type: "query", name: "language", schema: liveTrainingListQuerySchema.properties.language },
    ],
    response: liveTrainingListResponseSchema,
  })
  async getLiveTrainings(
    @Query("page") page: LiveTrainingListQuery["page"],
    @Query("perPage") perPage: LiveTrainingListQuery["perPage"],
    @Query("status") status: LiveTrainingListQuery["status"],
    @Query("deliveryType") deliveryType: LiveTrainingListQuery["deliveryType"],
    @Query("start") start: LiveTrainingListQuery["start"],
    @Query("end") end: LiveTrainingListQuery["end"],
    @Query("courseId") courseId: LiveTrainingListQuery["courseId"],
    @Query("language") language: LiveTrainingListQuery["language"],
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<PaginatedResponse<LiveTrainingListItem[]>> {
    const liveTrainings = await this.liveTrainingService.getLiveTrainings(
      {
        page,
        perPage,
        status,
        deliveryType,
        start,
        end,
        courseId,
        language,
      },
      currentUser,
    );

    return new PaginatedResponse(liveTrainings);
  }

  @Get(":id")
  @RequirePermission(PERMISSIONS.LIVE_TRAINING_READ)
  @Validate({
    request: [
      { type: "param", name: "id", schema: UUIDSchema },
      { type: "query", name: "language", schema: liveTrainingListQuerySchema.properties.language },
    ],
    response: liveTrainingDetailsResponseSchema,
  })
  async getLiveTraining(
    @Param("id") id: UUIDType,
    @Query("language") language: LiveTrainingListQuery["language"],
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<LiveTrainingDetails>> {
    const liveTraining = await this.liveTrainingService.getLiveTraining(id, language, currentUser);

    return new BaseResponse(liveTraining);
  }

  @Post()
  @RequirePermission(PERMISSIONS.LIVE_TRAINING_CREATE)
  @Validate({
    request: [{ type: "body", schema: createLiveTrainingSchema }],
    response: createLiveTrainingResponseSchema,
  })
  async createLiveTraining(
    @Body() body: CreateLiveTrainingBody,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<LiveTrainingDetails>> {
    const liveTraining = await this.liveTrainingService.createLiveTraining(
      body,
      body.language,
      currentUser,
    );

    return new BaseResponse(liveTraining);
  }

  @Patch(":id")
  @RequirePermission(PERMISSIONS.LIVE_TRAINING_UPDATE, PERMISSIONS.LIVE_TRAINING_UPDATE_OWN)
  @Validate({
    request: [
      { type: "param", name: "id", schema: UUIDSchema },
      { type: "body", schema: updateLiveTrainingSchema },
    ],
    response: updateLiveTrainingResponseSchema,
  })
  async updateLiveTraining(
    @Param("id") id: UUIDType,
    @Body() body: UpdateLiveTrainingBody,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<LiveTrainingDetails>> {
    const liveTraining = await this.liveTrainingService.updateLiveTraining(
      id,
      body,
      body.language,
      currentUser,
    );

    return new BaseResponse(liveTraining);
  }

  @Delete(":id")
  @RequirePermission(PERMISSIONS.LIVE_TRAINING_DELETE)
  @Validate({
    request: [{ type: "param", name: "id", schema: UUIDSchema }],
    response: baseResponse(liveTrainingDeleteResponseSchema),
  })
  async deleteLiveTraining(
    @Param("id") id: UUIDType,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<LiveTrainingDeleteResponse>> {
    await this.liveTrainingService.deleteLiveTraining(id, currentUser);

    return new BaseResponse({ message: "Live Training deleted successfully" });
  }
}
