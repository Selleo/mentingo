import { ALLOWED_ARTICLES_SETTINGS, ALLOWED_NEWS_SETTINGS } from "@repo/shared";

import type { FixtureApiClient } from "./api-client";

type ContentFeatureKey =
  | "unregisteredUserNewsAccessibility"
  | "unregisteredUserArticlesAccessibility";

type ContentFeatureState = {
  unregisteredUserNewsAccessibility: boolean;
  unregisteredUserArticlesAccessibility: boolean;
};

const readContentFeatureState = async (
  apiClient: FixtureApiClient,
): Promise<ContentFeatureState> => {
  const response = await apiClient.api.settingsControllerGetPublicGlobalSettings();

  return {
    unregisteredUserNewsAccessibility: response.data.data.unregisteredUserNewsAccessibility,
    unregisteredUserArticlesAccessibility: response.data.data.unregisteredUserArticlesAccessibility,
  };
};

const readContentModuleState = async (apiClient: FixtureApiClient) => {
  const response = await apiClient.api.settingsControllerGetPublicGlobalSettings();

  return {
    newsEnabled: response.data.data.newsEnabled,
    articlesEnabled: response.data.data.articlesEnabled,
  };
};

const setContentFeature = async (
  apiClient: FixtureApiClient,
  setting: ContentFeatureKey,
  enabled: boolean,
) => {
  const state = await readContentFeatureState(apiClient);
  const current = state[setting];

  if (current === enabled) return;

  if (setting === "unregisteredUserNewsAccessibility") {
    await apiClient.api.settingsControllerUpdateNewsSetting("unregisteredUserNewsAccessibility");
    return;
  }

  await apiClient.api.settingsControllerUpdateArticlesSetting(
    "unregisteredUserArticlesAccessibility",
  );
};

const setContentModule = async (
  apiClient: FixtureApiClient,
  setting: "newsEnabled" | "articlesEnabled",
  enabled: boolean,
) => {
  const state = await readContentModuleState(apiClient);
  const current = state[setting];

  if (current === enabled) return;

  if (setting === "newsEnabled") {
    await apiClient.api.settingsControllerUpdateNewsSetting(ALLOWED_NEWS_SETTINGS.NEWS_ENABLED);
    return;
  }

  await apiClient.api.settingsControllerUpdateArticlesSetting(
    ALLOWED_ARTICLES_SETTINGS.ARTICLES_ENABLED,
  );
};

export const ensureContentModulesEnabled = async (apiClient: FixtureApiClient) => {
  await setContentModule(apiClient, "newsEnabled", true);
  await setContentModule(apiClient, "articlesEnabled", true);
};

export const ensureContentFeaturesEnabled = async (
  apiClient: FixtureApiClient,
  options: {
    publicNews?: boolean;
    publicArticles?: boolean;
  } = {},
) => {
  const desiredPublicNews = options.publicNews ?? false;
  const desiredPublicArticles = options.publicArticles ?? false;

  const initialState = await readContentFeatureState(apiClient);

  await setContentFeature(apiClient, "unregisteredUserNewsAccessibility", desiredPublicNews);
  await setContentFeature(
    apiClient,
    "unregisteredUserArticlesAccessibility",
    desiredPublicArticles,
  );

  return async () => {
    await setContentFeature(
      apiClient,
      "unregisteredUserNewsAccessibility",
      initialState.unregisteredUserNewsAccessibility,
    );
    await setContentFeature(
      apiClient,
      "unregisteredUserArticlesAccessibility",
      initialState.unregisteredUserArticlesAccessibility,
    );
  };
};
