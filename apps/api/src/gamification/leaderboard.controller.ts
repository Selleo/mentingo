import { Controller, ForbiddenException, Get, Query, UseGuards } from "@nestjs/common";
import { SYSTEM_ROLE_SLUGS } from "@repo/shared";
import { Type } from "@sinclair/typebox";
import { Validate } from "nestjs-typebox";

import { baseResponse, BaseResponse } from "src/common";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { PermissionsGuard } from "src/common/guards/permissions.guard";
import { CurrentUserType } from "src/common/types/current-user.type";

import { LeaderboardQueryService } from "./leaderboard-query.service";
import { leaderboardSchema, leaderboardScopeSchema } from "./schemas/leaderboard.schema";

@UseGuards(PermissionsGuard)
@Controller("leaderboard")
export class LeaderboardController {
  constructor(private readonly leaderboardQueryService: LeaderboardQueryService) {}

  @Get()
  @Validate({
    request: [{ type: "query", name: "scope", schema: Type.Optional(leaderboardScopeSchema) }],
    response: baseResponse(leaderboardSchema),
  })
  async query(
    @Query("scope") scope: "all-time" | undefined,
    @CurrentUser() currentUser: CurrentUserType,
  ) {
    if (!currentUser.roleSlugs.includes(SYSTEM_ROLE_SLUGS.STUDENT)) {
      throw new ForbiddenException("auth.error.studentRoleRequired");
    }

    return new BaseResponse(
      await this.leaderboardQueryService.query({
        tenantId: currentUser.tenantId,
        viewerId: currentUser.userId,
        scope: scope ?? "all-time",
      }),
    );
  }
}
