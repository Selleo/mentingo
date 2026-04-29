import type { RewardActionType } from "@repo/shared";

export type LocalizedText = Partial<Record<string, string>>;

export type RewardRule = {
  id: string;
  actionType: RewardActionType;
  points: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type RewardAchievement = {
  id: string;
  title: LocalizedText;
  description: LocalizedText;
  pointThreshold: number;
  sortOrder: number;
  archived: boolean;
  iconResourceId: string | null;
  iconUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProfileRewardAchievement = {
  id: string;
  title: LocalizedText;
  description: LocalizedText;
  pointThreshold: number;
  pointsRequired: number;
  earnedAt: string | null;
  iconResourceId: string | null;
  iconUrl: string | null;
};

export type RewardsProfile = {
  userId: string;
  totalPoints: number;
  achievements: ProfileRewardAchievement[];
};

export type LeaderboardEntry = {
  userId: string;
  firstName: string;
  lastName: string;
  profilePictureUrl: string | null;
  totalPoints: number;
  rank: number;
};

export type RewardsLeaderboard = {
  groupId: string | null;
  entries: LeaderboardEntry[];
  currentUserRank: LeaderboardEntry | null;
};

export type RewardGroup = {
  id: string;
  name: string;
};

export type ApiData<T> = {
  data: T;
};
