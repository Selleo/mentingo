export const CourseAdminStatisticsTabs = {
  progress: "progress",
  quizResults: "quizResults",
  aiMentorResults: "aiMentorResults",
  learningTime: "learningTime",
} as const;

export type CourseAdminStatisticsTab =
  (typeof CourseAdminStatisticsTabs)[keyof typeof CourseAdminStatisticsTabs];

interface GetVisibleCourseStatisticsTabsOptions {
  hasAiMentorResults: boolean;
  isAIConfigured: boolean;
}

export const getVisibleCourseStatisticsTabs = ({
  hasAiMentorResults,
  isAIConfigured,
}: GetVisibleCourseStatisticsTabsOptions): CourseAdminStatisticsTab[] => {
  const tabs = Object.values(CourseAdminStatisticsTabs);

  if (!isAIConfigured && !hasAiMentorResults) {
    return tabs.filter((tab) => tab !== CourseAdminStatisticsTabs.aiMentorResults);
  }

  return tabs;
};
