import type { FixtureApiClient } from "./api-client";
import type { LeaderboardVisibility } from "@repo/shared";

type LeaderboardFeatureState = {
  gamificationEnabled: boolean;
  leaderboardsEnabled: boolean;
  leaderboardVisibility: LeaderboardVisibility;
};

const readLeaderboardFeatureState = async (
  apiClient: FixtureApiClient,
): Promise<LeaderboardFeatureState> => {
  const response = await apiClient.api.settingsControllerGetPublicGlobalSettings();
  const { gamificationEnabled, leaderboardsEnabled, leaderboardVisibility } = response.data.data;

  return { gamificationEnabled, leaderboardsEnabled, leaderboardVisibility };
};

export const setLeaderboardFeatureState = async (
  apiClient: FixtureApiClient,
  { gamificationEnabled, ...leaderboardSettings }: Partial<LeaderboardFeatureState>,
) => {
  const current = await readLeaderboardFeatureState(apiClient);

  // The gamification endpoint is a toggle, so only call it when the state differs.
  if (gamificationEnabled !== undefined && gamificationEnabled !== current.gamificationEnabled) {
    await apiClient.api.settingsControllerUpdateGamificationEnabled();
  }

  if (Object.keys(leaderboardSettings).length > 0) {
    await apiClient.api.settingsControllerUpdateLeaderboardSettings(leaderboardSettings);
  }
};

/** Applies the desired state and returns a cleanup that restores the original one. */
export const ensureLeaderboardFeatures = async (
  apiClient: FixtureApiClient,
  desiredState: Partial<LeaderboardFeatureState>,
) => {
  const initialState = await readLeaderboardFeatureState(apiClient);

  await setLeaderboardFeatureState(apiClient, desiredState);

  return async () => {
    await setLeaderboardFeatureState(apiClient, initialState);
  };
};
