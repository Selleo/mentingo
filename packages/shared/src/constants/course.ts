export const COURSE_STATUSES = {
  DRAFT: "draft",
  PUBLISHED: "published",
  PRIVATE: "private",
} as const;

export type CourseStatus = (typeof COURSE_STATUSES)[keyof typeof COURSE_STATUSES];

export const COURSE_TYPE = {
  DEFAULT: "default",
  SCORM: "scorm",
} as const;

export type CourseType = (typeof COURSE_TYPE)[keyof typeof COURSE_TYPE];

export const COURSE_FEATURE = {
  CURRICULUM_EDITING: "curriculum_editing",
  LESSON_SEQUENCE_SETTING: "lesson_sequence_setting",
  QUIZ_FEEDBACK_SETTING: "quiz_feedback_setting",
} as const;

export type CourseFeature = (typeof COURSE_FEATURE)[keyof typeof COURSE_FEATURE];

export const COURSE_FEATURE_ERROR_TRANSLATION_KEY = {
  [COURSE_FEATURE.CURRICULUM_EDITING]: "adminCourseView.errors.featureUnavailable.curriculum",
  [COURSE_FEATURE.LESSON_SEQUENCE_SETTING]:
    "adminCourseView.errors.featureUnavailable.lessonSequence",
  [COURSE_FEATURE.QUIZ_FEEDBACK_SETTING]: "adminCourseView.errors.featureUnavailable.quizFeedback",
} as const satisfies Record<CourseFeature, string>;

export const COURSE_TYPE_DISABLED_FEATURES = {
  [COURSE_TYPE.DEFAULT]: [],
  [COURSE_TYPE.SCORM]: [
    COURSE_FEATURE.CURRICULUM_EDITING,
    COURSE_FEATURE.LESSON_SEQUENCE_SETTING,
    COURSE_FEATURE.QUIZ_FEEDBACK_SETTING,
  ],
} as const satisfies Record<CourseType, readonly CourseFeature[]>;

export const isCourseFeatureEnabledForCourseType = (
  courseType: CourseType,
  feature: CourseFeature,
) => {
  const disabledFeatures: readonly CourseFeature[] = COURSE_TYPE_DISABLED_FEATURES[courseType];

  return !disabledFeatures.includes(feature);
};
