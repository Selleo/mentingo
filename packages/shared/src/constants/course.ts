export const COURSE_STATUSES = {
  DRAFT: "draft",
  PUBLISHED: "published",
  PRIVATE: "private",
} as const;

export type CourseStatus = (typeof COURSE_STATUSES)[keyof typeof COURSE_STATUSES];

export const COURSE_PROGRESS_STATUSES = {
  NOT_STARTED: "not_started",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  BLOCKED: "blocked",
} as const;

export type CourseProgressStatus =
  (typeof COURSE_PROGRESS_STATUSES)[keyof typeof COURSE_PROGRESS_STATUSES];

export const COURSE_TYPE = {
  DEFAULT: "default",
  SCORM: "scorm",
} as const;

export type CourseType = (typeof COURSE_TYPE)[keyof typeof COURSE_TYPE];

export const COURSE_FEATURE = {
  CURRICULUM_EDITING: "curriculum_editing",
  LESSON_SEQUENCE_SETTING: "lesson_sequence_setting",
  QUIZ_FEEDBACK_SETTING: "quiz_feedback_setting",
  VIDEO_COMPLETION_TRACKING_SETTING: "video_completion_tracking_setting",
} as const;

export type CourseFeature = (typeof COURSE_FEATURE)[keyof typeof COURSE_FEATURE];

export const COURSE_FEATURE_ERROR_TRANSLATION_KEY = {
  [COURSE_FEATURE.CURRICULUM_EDITING]: "adminCourseView.errors.featureUnavailable.curriculum",
  [COURSE_FEATURE.LESSON_SEQUENCE_SETTING]:
    "adminCourseView.errors.featureUnavailable.lessonSequence",
  [COURSE_FEATURE.QUIZ_FEEDBACK_SETTING]: "adminCourseView.errors.featureUnavailable.quizFeedback",
  [COURSE_FEATURE.VIDEO_COMPLETION_TRACKING_SETTING]:
    "adminCourseView.errors.featureUnavailable.videoCompletionTracking",
} as const satisfies Record<CourseFeature, string>;

export const COURSE_TYPE_DISABLED_FEATURES = {
  [COURSE_TYPE.DEFAULT]: [],
  [COURSE_TYPE.SCORM]: [
    COURSE_FEATURE.CURRICULUM_EDITING,
    COURSE_FEATURE.LESSON_SEQUENCE_SETTING,
    COURSE_FEATURE.QUIZ_FEEDBACK_SETTING,
    COURSE_FEATURE.VIDEO_COMPLETION_TRACKING_SETTING,
  ],
} as const satisfies Record<CourseType, readonly CourseFeature[]>;

export const isCourseFeatureEnabledForCourseType = (
  courseType: CourseType,
  feature: CourseFeature,
) => {
  const disabledFeatures: readonly CourseFeature[] = COURSE_TYPE_DISABLED_FEATURES[courseType];

  return !disabledFeatures.includes(feature);
};
