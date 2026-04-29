import { Controller, ForbiddenException, Get, Query, UseGuards } from "@nestjs/common";
import { SYSTEM_ROLE_SLUGS } from "@repo/shared";
import { Type } from "@sinclair/typebox";
import { Validate } from "nestjs-typebox";

import { baseResponse, BaseResponse, UUIDSchema, type UUIDType } from "src/common";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { PermissionsGuard } from "src/common/guards/permissions.guard";
import { CurrentUserType } from "src/common/types/current-user.type";

import { LeaderboardQueryService } from "./leaderboard-query.service";
import {
  leaderboardGroupSchema,
  leaderboardSchema,
  leaderboardScopeSchema,
  type LeaderboardScope,
} from "./schemas/leaderboard.schema";

@UseGuards(PermissionsGuard)
@Controller("leaderboard")
export class LeaderboardController {
  constructor(private readonly leaderboardQueryService: LeaderboardQueryService) {}

  @Get("groups")
  @Validate({
    response: baseResponse(Type.Array(leaderboardGroupSchema)),
  })
  async listGroups(@CurrentUser() currentUser: CurrentUserType) {
    this.assertStudent(currentUser);

    return new BaseResponse(await this.leaderboardQueryService.listGroups(currentUser.tenantId));
  }

  @Get()
  @Validate({
    request: [
      { type: "query", name: "scope", schema: Type.Optional(leaderboardScopeSchema) },
      { type: "query", name: "groupId", schema: Type.Optional(UUIDSchema) },
    ],
    response: baseResponse(leaderboardSchema),
  })
  async query(
    @Query("scope") scope: LeaderboardScope | undefined,
    @Query("groupId") groupId: UUIDType | undefined,
    @CurrentUser() currentUser: CurrentUserType,
  ) {
    this.assertStudent(currentUser);

    return new BaseResponse(
      await this.leaderboardQueryService.query({
        tenantId: currentUser.tenantId,
        viewerId: currentUser.userId,
        scope: scope ?? "all-time",
        groupId,
      }),
    );
  }

  private assertStudent(currentUser: CurrentUserType) {
    if (!currentUser.roleSlugs.includes(SYSTEM_ROLE_SLUGS.STUDENT)) {
      throw new ForbiddenException("auth.error.studentRoleRequired");
    }
  }
}
