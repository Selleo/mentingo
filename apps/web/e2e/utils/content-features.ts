import {
  ALLOWED_ARTICLES_SETTINGS,
  ALLOWED_NEWS_SETTINGS,
  ALLOWED_QA_SETTINGS,
} from "@repo/shared";

import type { FixtureApiClient } from "./api-client";

export type ContentModule = "news" | "articles" | "qa";

export type ContentModuleState = {
  enabled: boolean;
  public: boolean;
};

type ContentModuleField = keyof ContentModuleState;

const readContentModuleState = async (
  apiClient: FixtureApiClient,
  module: ContentModule,
): Promise<ContentModuleState> => {
  const settings = (await apiClient.api.settingsControllerGetPublicGlobalSettings()).data.data;
  const stateByModule: Record<ContentModule, ContentModuleState> = {
    news: { enabled: settings.newsEnabled, public: settings.unregisteredUserNewsAccessibility },
    articles: {
      enabled: settings.articlesEnabled,
      public: settings.unregisteredUserArticlesAccessibility,
    },
    qa: { enabled: settings.QAEnabled, public: settings.unregisteredUserQAAccessibility },
  };

  return stateByModule[module];
};

const toggleContentModuleField = async (
  apiClient: FixtureApiClient,
  module: ContentModule,
  field: ContentModuleField,
) => {
  const isEnabledField = field === "enabled";

  if (module === "news") {
    await apiClient.api.settingsControllerUpdateNewsSetting(
      isEnabledField
        ? ALLOWED_NEWS_SETTINGS.NEWS_ENABLED
        : ALLOWED_NEWS_SETTINGS.UNREGISTERED_USER_NEWS_ACCESSIBILITY,
    );
    return;
  }

  if (module === "articles") {
    await apiClient.api.settingsControllerUpdateArticlesSetting(
      isEnabledField
        ? ALLOWED_ARTICLES_SETTINGS.ARTICLES_ENABLED
        : ALLOWED_ARTICLES_SETTINGS.UNREGISTERED_USER_ARTICLES_ACCESSIBILITY,
    );
    return;
  }

  await apiClient.api.settingsControllerUpdateQaSetting(
    isEnabledField
      ? ALLOWED_QA_SETTINGS.QA_ENABLED
      : ALLOWED_QA_SETTINGS.UNREGISTERED_USER_QA_ACCESSIBILITY,
  );
};

/** Public access can only change while the module is enabled, so enable first and disable last. */
export const setContentModuleState = async (
  apiClient: FixtureApiClient,
  module: ContentModule,
  desired: Partial<ContentModuleState>,
  current?: ContentModuleState,
) => {
  // Settings endpoints only toggle, so track the state locally instead of re-reading it per field.
  const state = { ...(current ?? (await readContentModuleState(apiClient, module))) };

  const setField = async (field: ContentModuleField, value: boolean) => {
    if (state[field] === value) return;

    await toggleContentModuleField(apiClient, module, field);
    state[field] = value;
  };

  if (desired.enabled === true || desired.public !== undefined) await setField("enabled", true);
  if (desired.public !== undefined) await setField("public", desired.public);
  if (desired.enabled === false) await setField("enabled", false);

  return state;
};

/** Applies the state and returns a cleanup that restores the original module and public access. */
export const overrideContentModuleState = async (
  apiClient: FixtureApiClient,
  module: ContentModule,
  desired: Partial<ContentModuleState>,
) => {
  const original = await readContentModuleState(apiClient, module);
  await setContentModuleState(apiClient, module, desired, original);

  // Re-read on restore: the test may have changed the state in between.
  return async () => {
    await setContentModuleState(apiClient, module, original);
  };
};
