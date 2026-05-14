import { COURSE_STATISTICS_HANDLES } from "../../data/statistics/handles";

import type { Page } from "@playwright/test";

type CourseStatisticsTab = "progress" | "quizResults" | "aiMentorResults" | "learningTime";

const tabHandleByValue: Record<CourseStatisticsTab, string> = {
  progress: COURSE_STATISTICS_HANDLES.PROGRESS_TAB,
  quizResults: COURSE_STATISTICS_HANDLES.QUIZ_RESULTS_TAB,
  aiMentorResults: COURSE_STATISTICS_HANDLES.AI_MENTOR_RESULTS_TAB,
  learningTime: COURSE_STATISTICS_HANDLES.LEARNING_TIME_TAB,
};

export const openCourseStatisticsTabFlow = async (page: Page, tab: CourseStatisticsTab) => {
  await page.getByTestId(tabHandleByValue[tab]).click();
};
