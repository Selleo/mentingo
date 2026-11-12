import type {
  PlatformFeatureDefinition,
  PlatformFeatureStatus,
} from "./platformFeatures.constants";
import type { LeaderboardVisibility } from "@repo/shared";

export type PlatformFeature = {
  definition: PlatformFeatureDefinition;
  isEnabled: boolean;
  isPublic: boolean;
  status: PlatformFeatureStatus;
  /** Explains why the switch cannot be changed right now. */
  lockedReason?: string;
  isPending: boolean;
  toggle: () => void;
  togglePublic?: () => void;
  leaderboardVisibility?: LeaderboardVisibility;
  changeLeaderboardVisibility?: (visibility: LeaderboardVisibility) => void;
};
