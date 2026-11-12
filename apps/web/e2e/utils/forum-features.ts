import type { FixtureApiClient } from "./api-client";

type ForumFeatureState = {
  forumEnabled: boolean;
  courseDiscussionsEnabled: boolean;
};

export const setForumFeatureState = async (
  apiClient: FixtureApiClient,
  desiredState: Partial<ForumFeatureState>,
) => {
  const response = await apiClient.api.settingsControllerGetPublicGlobalSettings();
  const { forumEnabled, courseDiscussionsEnabled } = response.data.data;

  if (desiredState.forumEnabled !== undefined && desiredState.forumEnabled !== forumEnabled) {
    await apiClient.api.settingsControllerUpdateForumEnabled();
  }

  if (
    desiredState.courseDiscussionsEnabled !== undefined &&
    desiredState.courseDiscussionsEnabled !== courseDiscussionsEnabled
  ) {
    await apiClient.api.settingsControllerUpdateCourseDiscussionsEnabled();
  }
};
