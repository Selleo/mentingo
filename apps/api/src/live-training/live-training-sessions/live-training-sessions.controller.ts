import { Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { FEATURES, PERMISSIONS, SUPPORTED_LANGUAGES, type SupportedLanguages } from "@repo/shared";
import { Type } from "@sinclair/typebox";
import { Validate } from "nestjs-typebox";

import { BaseResponse, UUIDSchema, type UUIDType } from "src/common";
import { RequireFeature } from "src/common/decorators/require-feature.decorator";
import { RequirePermission } from "src/common/decorators/require-permission.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { FeaturesGuard } from "src/common/guards/features.guard";
import { PermissionsGuard } from "src/common/guards/permissions.guard";
import { CurrentUserType } from "src/common/types/current-user.type";

import { LiveTrainingSessionsService } from "./live-training-sessions.service";
import {
  liveTrainingSessionDetailsResponseSchema,
  liveTrainingSessionListResponseSchema,
  liveTrainingSessionSummaryResponseSchema,
  joinLiveTrainingSessionBaseResponseSchema,
  type JoinLiveTrainingSessionResponse,
  type LiveTrainingParticipantProfilePicture,
  type LiveTrainingSessionDetails,
  type LiveTrainingSessionSummary,
  liveTrainingParticipantProfilePictureResponseSchema,
} from "./live-training-sessions.types";

const languageQuerySchema = Type.Optional(Type.Enum(SUPPORTED_LANGUAGES));

@UseGuards(FeaturesGuard, PermissionsGuard)
@RequireFeature(FEATURES.LIVE_TRAINING)
@Controller("live-training/:liveTrainingId/sessions")
export class LiveTrainingSessionsController {
  constructor(private readonly liveTrainingSessionsService: LiveTrainingSessionsService) {}

  @Get()
  @RequirePermission(PERMISSIONS.LIVE_TRAINING_READ)
  @Validate({
    request: [
      { type: "param", name: "liveTrainingId", schema: UUIDSchema },
      { type: "query", name: "language", schema: languageQuerySchema },
    ],
    response: liveTrainingSessionListResponseSchema,
  })
  async getSessions(
    @Param("liveTrainingId") liveTrainingId: UUIDType,
    @Query("language") language: SupportedLanguages | undefined,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<LiveTrainingSessionSummary[]>> {
    const sessions = await this.liveTrainingSessionsService.getSessions(
      liveTrainingId,
      language,
      currentUser,
    );

    return new BaseResponse(sessions);
  }

  @Post("start")
  @RequirePermission(PERMISSIONS.LIVE_TRAINING_START)
  @Validate({
    request: [
      { type: "param", name: "liveTrainingId", schema: UUIDSchema },
      { type: "query", name: "language", schema: languageQuerySchema },
    ],
    response: liveTrainingSessionSummaryResponseSchema,
  })
  async startSession(
    @Param("liveTrainingId") liveTrainingId: UUIDType,
    @Query("language") language: SupportedLanguages | undefined,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<LiveTrainingSessionSummary>> {
    const session = await this.liveTrainingSessionsService.startSession(
      liveTrainingId,
      language,
      currentUser,
    );

    return new BaseResponse(session);
  }

  @Post("current/join")
  @RequirePermission(PERMISSIONS.LIVE_TRAINING_JOIN)
  @Validate({
    request: [
      { type: "param", name: "liveTrainingId", schema: UUIDSchema },
      { type: "query", name: "language", schema: languageQuerySchema },
    ],
    response: joinLiveTrainingSessionBaseResponseSchema,
  })
  async joinCurrentSession(
    @Param("liveTrainingId") liveTrainingId: UUIDType,
    @Query("language") language: SupportedLanguages | undefined,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<JoinLiveTrainingSessionResponse>> {
    const session = await this.liveTrainingSessionsService.joinCurrentSession(
      liveTrainingId,
      language,
      currentUser,
    );

    return new BaseResponse(session);
  }

  @Get("participants/profile-pictures")
  @RequirePermission(PERMISSIONS.LIVE_TRAINING_READ)
  @Validate({
    request: [
      { type: "param", name: "liveTrainingId", schema: UUIDSchema },
      { type: "query", name: "language", schema: languageQuerySchema },
    ],
    response: liveTrainingParticipantProfilePictureResponseSchema,
  })
  async getParticipantProfilePictures(
    @Param("liveTrainingId") liveTrainingId: UUIDType,
    @Query("language") language: SupportedLanguages | undefined,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<LiveTrainingParticipantProfilePicture[]>> {
    const profilePicture = await this.liveTrainingSessionsService.getParticipantProfilePictures(
      liveTrainingId,
      language,
      currentUser,
    );

    return new BaseResponse(profilePicture);
  }

  @Get(":sessionId")
  @RequirePermission(PERMISSIONS.LIVE_TRAINING_READ)
  @Validate({
    request: [
      { type: "param", name: "liveTrainingId", schema: UUIDSchema },
      { type: "param", name: "sessionId", schema: UUIDSchema },
      { type: "query", name: "language", schema: languageQuerySchema },
    ],
    response: liveTrainingSessionDetailsResponseSchema,
  })
  async getSession(
    @Param("liveTrainingId") liveTrainingId: UUIDType,
    @Param("sessionId") sessionId: UUIDType,
    @Query("language") language: SupportedLanguages | undefined,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<LiveTrainingSessionDetails>> {
    const session = await this.liveTrainingSessionsService.getSession(
      liveTrainingId,
      sessionId,
      language,
      currentUser,
    );

    return new BaseResponse(session);
  }

  @Post(":sessionId/end")
  @RequirePermission(PERMISSIONS.LIVE_TRAINING_END)
  @Validate({
    request: [
      { type: "param", name: "liveTrainingId", schema: UUIDSchema },
      { type: "param", name: "sessionId", schema: UUIDSchema },
      { type: "query", name: "language", schema: languageQuerySchema },
    ],
    response: liveTrainingSessionSummaryResponseSchema,
  })
  async endSession(
    @Param("liveTrainingId") liveTrainingId: UUIDType,
    @Param("sessionId") sessionId: UUIDType,
    @Query("language") language: SupportedLanguages | undefined,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<LiveTrainingSessionSummary>> {
    const session = await this.liveTrainingSessionsService.endSession(
      liveTrainingId,
      sessionId,
      language,
      currentUser,
    );

    return new BaseResponse(session);
  }
}
