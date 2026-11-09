import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import {
  hasPermission,
  LEADERBOARD_VISIBILITY,
  PERMISSIONS,
  type SupportedLanguages,
} from "@repo/shared";

import { SettingsService } from "src/settings/settings.service";

import { LEADERBOARD_NEARBY_DISTANCE, LEADERBOARD_TOP_LIMIT } from "./gamification.constants";
import { LeaderboardRepository } from "./leaderboard.repository";
import { getLeaderboardRange } from "./leaderboard.utils";

import type { LeaderboardQuery, LeaderboardRow } from "./leaderboard.types";
import type {
  LeaderboardEntry,
  LeaderboardResponse,
  LeaderboardScopesResponse,
} from "./schemas/leaderboard.schema";
import type { UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";

const toEntry = ({
  userId,
  firstName,
  lastName,
  score,
  rank,
}: LeaderboardRow): LeaderboardEntry => ({
  userId,
  firstName,
  lastName,
  score,
  rank,
});

@Injectable()
export class LeaderboardService {
  constructor(
    private readonly leaderboardRepository: LeaderboardRepository,
    private readonly settingsService: SettingsService,
  ) {}

  async getScopes(
    currentUser: CurrentUserType,
    language: SupportedLanguages,
  ): Promise<LeaderboardScopesResponse> {
    const canReadAll = this.canReadAll(currentUser);

    return {
      tenantWide: canReadAll || (await this.isPublic()),
      groups: await this.leaderboardRepository.findGroups(
        language,
        canReadAll ? null : currentUser.userId,
      ),
    };
  }

  async getLeaderboard(
    query: LeaderboardQuery,
    currentUser: CurrentUserType,
    now = new Date(),
  ): Promise<LeaderboardResponse> {
    const groupId = query.groupId ?? null;

    await this.assertCanView(currentUser, groupId);

    const range = getLeaderboardRange(query.period, now, query.from, query.to);

    const rows = await this.leaderboardRepository.findRanking({
      ...range,
      metric: query.metric,
      groupId,
      viewerId: currentUser.userId,
      topLimit: LEADERBOARD_TOP_LIMIT,
      nearbyDistance: LEADERBOARD_NEARBY_DISTANCE,
    });

    const viewer = rows.find(({ userId }) => userId === currentUser.userId);

    return {
      metric: query.metric,
      period: query.period,
      groupId,
      startsAt: range.startsAt?.toISOString() ?? null,
      endsAt: range.endsAt?.toISOString() ?? null,
      entries: rows.filter(({ position }) => position <= LEADERBOARD_TOP_LIMIT).map(toEntry),
      currentUser: viewer ? toEntry(viewer) : null,
      // Only for viewers below the top list, without repeating users already in it.
      nearby:
        viewer && viewer.position > LEADERBOARD_TOP_LIMIT
          ? rows
              .filter(
                ({ position }) =>
                  position > LEADERBOARD_TOP_LIMIT &&
                  Math.abs(position - viewer.position) <= LEADERBOARD_NEARBY_DISTANCE,
              )
              .map(toEntry)
          : [],
    };
  }

  /** Full readers see every scope; others only their current groups, plus the tenant when public. */
  private async assertCanView(currentUser: CurrentUserType, groupId: UUIDType | null) {
    if (this.canReadAll(currentUser)) {
      if (groupId && !(await this.leaderboardRepository.groupExists(groupId))) {
        throw new NotFoundException("common.toast.notFound");
      }

      return;
    }

    const canView = groupId
      ? await this.leaderboardRepository.isGroupMember(currentUser.userId, groupId)
      : await this.isPublic();

    if (!canView) throw new ForbiddenException("common.toast.noAccess");
  }

  private canReadAll(currentUser: CurrentUserType) {
    return hasPermission(currentUser.permissions, PERMISSIONS.GAMIFICATION_LEADERBOARD_READ_ALL);
  }

  private async isPublic() {
    const { leaderboardVisibility } = await this.settingsService.getGlobalSettings();

    return leaderboardVisibility === LEADERBOARD_VISIBILITY.PUBLIC;
  }
}
