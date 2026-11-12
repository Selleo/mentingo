import {
  ALLOWED_ARTICLES_SETTINGS,
  ALLOWED_NEWS_SETTINGS,
  ALLOWED_QA_SETTINGS,
  type LeaderboardVisibility,
} from "@repo/shared";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";

import { useChangeArticlesSetting } from "~/api/mutations/admin/useChangeArticlesSetting";
import { useChangeNewsSetting } from "~/api/mutations/admin/useChangeNewsSetting";
import { useChangeQASetting } from "~/api/mutations/admin/useChangeQASetting";
import { useToggleCourseDiscussions } from "~/api/mutations/admin/useToggleCourseDiscussions";
import { useToggleGamificationEnabled } from "~/api/mutations/admin/useToggleGamificationEnabled";
import { useToggleLearningPathsEnabled } from "~/api/mutations/admin/useToggleLearningPathsEnabled";
import { useToggleLiveTraining } from "~/api/mutations/admin/useToggleLiveTraining";
import { useTogglePublicCoursePreview } from "~/api/mutations/admin/useTogglePublicCoursePreview";
import { useUnregisteredUserCoursesAccessibility } from "~/api/mutations/admin/useUnregisteredUserCoursesAccessibility";
import { useUpdateLeaderboardSettings } from "~/api/mutations/admin/useUpdateLeaderboardSettings";
import { useConfigurationState } from "~/api/queries/admin/useConfigurationState";

import {
  PLATFORM_FEATURE_IDS,
  PLATFORM_FEATURE_STATUSES,
  PLATFORM_FEATURES,
  type PlatformFeatureDefinition,
} from "./platformFeatures.constants";

import type { PlatformFeature } from "./platformFeatures.types";
import type { GlobalSettings } from "~/modules/Dashboard/Settings/types";

type FeatureState = Omit<PlatformFeature, "definition" | "status">;

/**
 * Joins the feature catalogue with the current settings, the mutation that switches each feature,
 * and the integration status for features that need one.
 */
export function usePlatformFeatures(globalSettings: GlobalSettings, canManageEnvs: boolean) {
  const { t } = useTranslation();
  const { data: configuration } = useConfigurationState({ enabled: canManageEnvs });

  const { mutate: changeQASetting, isPending: isQAPending } = useChangeQASetting();
  const { mutate: changeNewsSetting, isPending: isNewsPending } = useChangeNewsSetting();
  const { mutate: changeArticlesSetting, isPending: isArticlesPending } =
    useChangeArticlesSetting();
  const { mutate: toggleLearningPaths, isPending: isLearningPathsPending } =
    useToggleLearningPathsEnabled();
  // The gamification endpoint flips the stored value, so the switch stays locked mid-request.
  const { mutate: toggleGamification, isPending: isGamificationPending } =
    useToggleGamificationEnabled();
  const { mutate: updateLeaderboardSettings, isPending: isLeaderboardsPending } =
    useUpdateLeaderboardSettings();
  const { mutate: toggleCourseDiscussions, isPending: isCourseDiscussionsPending } =
    useToggleCourseDiscussions();
  const { mutate: toggleLiveTraining, isPending: isLiveTrainingPending } = useToggleLiveTraining();
  const { mutate: toggleCoursesForVisitors, isPending: isCoursesForVisitorsPending } =
    useUnregisteredUserCoursesAccessibility();
  const { mutate: togglePublicCoursePreview, isPending: isPublicCoursePreviewPending } =
    useTogglePublicCoursePreview();

  const trainerRoleUserCount = globalSettings.trainerRoleUserCount ?? 0;

  const getFeatureState = (definition: PlatformFeatureDefinition): FeatureState =>
    match(definition.id)
      .with(PLATFORM_FEATURE_IDS.LEARNING_PATHS, () => ({
        isEnabled: globalSettings.learningPathsEnabled,
        isPublic: false,
        isPending: isLearningPathsPending,
        toggle: () => toggleLearningPaths(),
      }))
      .with(PLATFORM_FEATURE_IDS.GAMIFICATION, () => ({
        isEnabled: globalSettings.gamificationEnabled,
        isPublic: false,
        isPending: isGamificationPending,
        toggle: () => toggleGamification(),
      }))
      .with(PLATFORM_FEATURE_IDS.LEADERBOARDS, () => ({
        isEnabled: globalSettings.gamificationEnabled && globalSettings.leaderboardsEnabled,
        isPublic: false,
        isPending: isLeaderboardsPending,
        toggle: () =>
          updateLeaderboardSettings({ leaderboardsEnabled: !globalSettings.leaderboardsEnabled }),
        lockedReason: globalSettings.gamificationEnabled
          ? undefined
          : t("platformFeatures.requiresGamification"),
        leaderboardVisibility: globalSettings.leaderboardVisibility,
        changeLeaderboardVisibility: (leaderboardVisibility: LeaderboardVisibility) =>
          updateLeaderboardSettings({ leaderboardVisibility }),
      }))
      .with(PLATFORM_FEATURE_IDS.LIVE_TRAINING, () => ({
        isEnabled: globalSettings.liveTrainingEnabled,
        isPublic: false,
        isPending: isLiveTrainingPending,
        toggle: () => toggleLiveTraining(),
        lockedReason:
          globalSettings.liveTrainingEnabled && trainerRoleUserCount > 0
            ? t("adminPreferences.field.liveTrainingDisableBlockedTooltip", {
                count: trainerRoleUserCount,
              })
            : undefined,
      }))
      .with(PLATFORM_FEATURE_IDS.COURSE_DISCUSSIONS, () => ({
        isEnabled: globalSettings.courseDiscussionsEnabled,
        isPublic: false,
        isPending: isCourseDiscussionsPending,
        toggle: () => toggleCourseDiscussions(),
      }))
      .with(PLATFORM_FEATURE_IDS.NEWS, () => ({
        isEnabled: globalSettings.newsEnabled,
        isPublic: globalSettings.unregisteredUserNewsAccessibility,
        isPending: isNewsPending,
        toggle: () => changeNewsSetting(ALLOWED_NEWS_SETTINGS.NEWS_ENABLED),
        togglePublic: () =>
          changeNewsSetting(ALLOWED_NEWS_SETTINGS.UNREGISTERED_USER_NEWS_ACCESSIBILITY),
      }))
      .with(PLATFORM_FEATURE_IDS.ARTICLES, () => ({
        isEnabled: globalSettings.articlesEnabled,
        isPublic: globalSettings.unregisteredUserArticlesAccessibility,
        isPending: isArticlesPending,
        toggle: () => changeArticlesSetting(ALLOWED_ARTICLES_SETTINGS.ARTICLES_ENABLED),
        togglePublic: () =>
          changeArticlesSetting(ALLOWED_ARTICLES_SETTINGS.UNREGISTERED_USER_ARTICLES_ACCESSIBILITY),
      }))
      .with(PLATFORM_FEATURE_IDS.QA, () => ({
        isEnabled: globalSettings.QAEnabled,
        isPublic: globalSettings.unregisteredUserQAAccessibility,
        isPending: isQAPending,
        toggle: () => changeQASetting(ALLOWED_QA_SETTINGS.QA_ENABLED),
        togglePublic: () => changeQASetting(ALLOWED_QA_SETTINGS.UNREGISTERED_USER_QA_ACCESSIBILITY),
      }))
      .with(PLATFORM_FEATURE_IDS.COURSES_FOR_VISITORS, () => ({
        isEnabled: globalSettings.unregisteredUserCoursesAccessibility,
        isPublic: false,
        isPending: isCoursesForVisitorsPending,
        toggle: () => toggleCoursesForVisitors(),
      }))
      .with(PLATFORM_FEATURE_IDS.PUBLIC_COURSE_PREVIEW, () => ({
        isEnabled: globalSettings.publicCoursePreviewEnabled,
        isPublic: false,
        isPending: isPublicCoursePreviewPending,
        toggle: () => togglePublicCoursePreview(),
      }))
      .exhaustive();

  const isIntegrationMissing = (definition: PlatformFeatureDefinition) =>
    Boolean(
      definition.requiredIntegration &&
        configuration &&
        !configuration.fullyConfigured.includes(definition.requiredIntegration.service),
    );

  return PLATFORM_FEATURES.map((definition): PlatformFeature => {
    const featureState = getFeatureState(definition);
    const status = match({
      isEnabled: featureState.isEnabled,
      isIntegrationMissing: isIntegrationMissing(definition),
    })
      .with({ isEnabled: true }, () => PLATFORM_FEATURE_STATUSES.ON)
      .with({ isIntegrationMissing: true }, () => PLATFORM_FEATURE_STATUSES.NEEDS_SETUP)
      .otherwise(() => PLATFORM_FEATURE_STATUSES.OFF);

    return { ...featureState, definition, status };
  });
}
