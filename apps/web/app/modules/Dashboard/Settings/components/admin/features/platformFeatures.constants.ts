import {
  GAMIFICATION_SETTINGS_HANDLES,
  LEADERBOARD_HANDLES,
} from "../../../../../../../e2e/data/gamification/handles";
import { QA_SETTINGS_HANDLES } from "../../../../../../../e2e/data/qa/handles";
import { SETTINGS_PAGE_HANDLES } from "../../../../../../../e2e/data/settings/handles";

import type { IconName } from "~/types/shared";

export const PLATFORM_FEATURE_IDS = {
  LEARNING_PATHS: "learningPaths",
  GAMIFICATION: "gamification",
  LEADERBOARDS: "leaderboards",
  LIVE_TRAINING: "liveTraining",
  COURSE_DISCUSSIONS: "courseDiscussions",
  NEWS: "news",
  ARTICLES: "articles",
  QA: "qa",
  COURSES_FOR_VISITORS: "coursesForVisitors",
  PUBLIC_COURSE_PREVIEW: "publicCoursePreview",
} as const;

export type PlatformFeatureId = (typeof PLATFORM_FEATURE_IDS)[keyof typeof PLATFORM_FEATURE_IDS];

export const PLATFORM_FEATURE_STATUSES = {
  ON: "on",
  OFF: "off",
  NEEDS_SETUP: "needsSetup",
} as const;

export type PlatformFeatureStatus =
  (typeof PLATFORM_FEATURE_STATUSES)[keyof typeof PLATFORM_FEATURE_STATUSES];

/** Extra settings a tile reveals once its feature is on. */
export const PLATFORM_FEATURE_OPTIONS = {
  PUBLIC_ACCESS: "publicAccess",
  LEADERBOARD_VISIBILITY: "leaderboardVisibility",
} as const;

export type PlatformFeatureOption =
  (typeof PLATFORM_FEATURE_OPTIONS)[keyof typeof PLATFORM_FEATURE_OPTIONS];

export type PlatformFeatureDefinition = {
  id: PlatformFeatureId;
  labelKey: string;
  descriptionKey: string;
  /** Extra guidance shown in an info tooltip next to the label. */
  tooltipKey?: string;
  /** The same icon the feature's page uses in the sidebar, so admins recognise it. */
  iconName: IconName;
  /** Integration that must be configured on the integrations page before the feature works. */
  requiredIntegration?: { envGroupId: string; service: string };
  option?: PlatformFeatureOption;
  switchTestId?: string;
  optionTestId?: string;
};

/** Every platform feature an admin can switch on or off, in display order. */
export const PLATFORM_FEATURES: PlatformFeatureDefinition[] = [
  {
    id: PLATFORM_FEATURE_IDS.LEARNING_PATHS,
    labelKey: "learningPathsPreferences.settings.learningPathsEnabled.label",
    descriptionKey: "learningPathsPreferences.settings.learningPathsEnabled.description",
    iconName: "Route",
  },
  {
    id: PLATFORM_FEATURE_IDS.LIVE_TRAINING,
    labelKey: "adminPreferences.field.liveTraining",
    descriptionKey: "adminPreferences.field.liveTrainingDescription",
    tooltipKey: "adminPreferences.field.liveTrainingTooltip",
    iconName: "Calendar",
    requiredIntegration: { envGroupId: "liveTraining", service: "livekit" },
    switchTestId: SETTINGS_PAGE_HANDLES.LIVE_TRAINING_SWITCH,
  },
  {
    id: PLATFORM_FEATURE_IDS.COURSE_DISCUSSIONS,
    labelKey: "adminPreferences.field.courseDiscussions",
    descriptionKey: "adminPreferences.field.courseDiscussionsDescription",
    iconName: "MessagesSquare",
    switchTestId: SETTINGS_PAGE_HANDLES.COURSE_DISCUSSIONS_SWITCH,
  },
  {
    id: PLATFORM_FEATURE_IDS.GAMIFICATION,
    labelKey: "gamification.admin.enabled.label",
    descriptionKey: "gamification.admin.enabled.description",
    iconName: "Trophy",
    switchTestId: GAMIFICATION_SETTINGS_HANDLES.ENABLED_SWITCH,
  },
  {
    id: PLATFORM_FEATURE_IDS.LEADERBOARDS,
    labelKey: "gamification.leaderboard.settings.enabled.label",
    descriptionKey: "gamification.leaderboard.settings.enabled.description",
    iconName: "Medal",
    option: PLATFORM_FEATURE_OPTIONS.LEADERBOARD_VISIBILITY,
    switchTestId: LEADERBOARD_HANDLES.SETTINGS_ENABLED_SWITCH,
    optionTestId: LEADERBOARD_HANDLES.SETTINGS_VISIBILITY,
  },
  {
    id: PLATFORM_FEATURE_IDS.NEWS,
    labelKey: "newsPreferences.settings.newsEnabled.label",
    descriptionKey: "newsPreferences.settings.newsEnabled.description",
    iconName: "News",
    option: PLATFORM_FEATURE_OPTIONS.PUBLIC_ACCESS,
    switchTestId: SETTINGS_PAGE_HANDLES.NEWS_ENABLED_SWITCH,
    optionTestId: SETTINGS_PAGE_HANDLES.NEWS_PUBLIC_SWITCH,
  },
  {
    id: PLATFORM_FEATURE_IDS.ARTICLES,
    labelKey: "articlesPreferences.settings.articlesEnabled.label",
    descriptionKey: "articlesPreferences.settings.articlesEnabled.description",
    iconName: "Articles",
    option: PLATFORM_FEATURE_OPTIONS.PUBLIC_ACCESS,
    switchTestId: SETTINGS_PAGE_HANDLES.ARTICLES_ENABLED_SWITCH,
    optionTestId: SETTINGS_PAGE_HANDLES.ARTICLES_PUBLIC_SWITCH,
  },
  {
    id: PLATFORM_FEATURE_IDS.QA,
    labelKey: "qaPreferences.settings.qaEnabled.label",
    descriptionKey: "qaPreferences.settings.qaEnabled.description",
    iconName: "Quiz",
    option: PLATFORM_FEATURE_OPTIONS.PUBLIC_ACCESS,
    switchTestId: QA_SETTINGS_HANDLES.ENABLED_SWITCH,
    optionTestId: QA_SETTINGS_HANDLES.PUBLIC_SWITCH,
  },
  {
    id: PLATFORM_FEATURE_IDS.COURSES_FOR_VISITORS,
    labelKey: "adminPreferences.field.coursesVisibility",
    descriptionKey: "adminPreferences.field.coursesVisibilityDescription",
    iconName: "Course",
    switchTestId: SETTINGS_PAGE_HANDLES.COURSES_VISIBILITY_SWITCH,
  },
  {
    id: PLATFORM_FEATURE_IDS.PUBLIC_COURSE_PREVIEW,
    labelKey: "adminPreferences.field.publicCoursePreview",
    descriptionKey: "adminPreferences.field.publicCoursePreviewDescription",
    iconName: "Eye",
    switchTestId: SETTINGS_PAGE_HANDLES.PUBLIC_COURSE_PREVIEW_SWITCH,
  },
];

export type PlatformFeatureSection = {
  id: string;
  titleKey: string;
  descriptionKey: string;
  featureIds: PlatformFeatureId[];
  testId?: string;
};

/** The cards the Features tab shows, in the order Platform customization used to list them. */
export const PLATFORM_FEATURE_SECTIONS: PlatformFeatureSection[] = [
  {
    id: "courses",
    titleKey: "adminPreferences.courseSettings",
    descriptionKey: "adminPreferences.subHeader",
    featureIds: [
      PLATFORM_FEATURE_IDS.COURSES_FOR_VISITORS,
      PLATFORM_FEATURE_IDS.PUBLIC_COURSE_PREVIEW,
      PLATFORM_FEATURE_IDS.COURSE_DISCUSSIONS,
      PLATFORM_FEATURE_IDS.LIVE_TRAINING,
    ],
  },
  {
    id: "qa",
    testId: QA_SETTINGS_HANDLES.PREFERENCES_CARD,
    titleKey: "qaPreferences.header",
    descriptionKey: "qaPreferences.subHeader",
    featureIds: [PLATFORM_FEATURE_IDS.QA],
  },
  {
    id: "news",
    testId: SETTINGS_PAGE_HANDLES.NEWS_PREFERENCES_CARD,
    titleKey: "newsPreferences.header",
    descriptionKey: "newsPreferences.subHeader",
    featureIds: [PLATFORM_FEATURE_IDS.NEWS],
  },
  {
    id: "articles",
    testId: SETTINGS_PAGE_HANDLES.ARTICLES_PREFERENCES_CARD,
    titleKey: "articlesPreferences.header",
    descriptionKey: "articlesPreferences.subHeader",
    featureIds: [PLATFORM_FEATURE_IDS.ARTICLES],
  },
  {
    id: "learningPaths",
    titleKey: "learningPathsPreferences.header",
    descriptionKey: "learningPathsPreferences.subHeader",
    featureIds: [PLATFORM_FEATURE_IDS.LEARNING_PATHS],
  },
  {
    id: "gamification",
    titleKey: "gamification.admin.title",
    descriptionKey: "gamification.admin.description",
    featureIds: [PLATFORM_FEATURE_IDS.GAMIFICATION],
  },
  {
    id: "leaderboards",
    testId: LEADERBOARD_HANDLES.SETTINGS_CARD,
    titleKey: "gamification.leaderboard.settings.header",
    descriptionKey: "gamification.leaderboard.settings.subHeader",
    featureIds: [PLATFORM_FEATURE_IDS.LEADERBOARDS],
  },
];

export const INTEGRATIONS_PAGE_PATH = "/admin/envs";
