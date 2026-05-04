export const COURSE_STATISTICS_HANDLES = {
  COURSE_VIEW_STATISTICS_TAB: "course-view-statistics-tab",
  ROOT: "course-statistics-root",
  GROUP_FILTER: "course-statistics-group-filter",
  groupFilterOption: (groupId: string) => `course-statistics-group-filter-option-${groupId}`,
  OVERVIEW_ENROLLED_COUNT_CARD: "course-statistics-overview-enrolled-count-card",
  OVERVIEW_COMPLETION_RATE_CARD: "course-statistics-overview-completion-rate-card",
  OVERVIEW_AVERAGE_COMPLETION_CARD: "course-statistics-overview-average-completion-card",
  OVERVIEW_AVERAGE_LEARNING_TIME_CARD: "course-statistics-overview-average-learning-time-card",
  DETAILS_SEARCH_INPUT: "course-statistics-details-search-input",
  PROGRESS_TAB: "course-statistics-progress-tab",
  QUIZ_RESULTS_TAB: "course-statistics-quiz-results-tab",
  AI_MENTOR_RESULTS_TAB: "course-statistics-ai-mentor-results-tab",
  LEARNING_TIME_TAB: "course-statistics-learning-time-tab",
  PROGRESS_TABLE: "course-statistics-progress-table",
  QUIZ_RESULTS_TABLE: "course-statistics-quiz-results-table",
  AI_MENTOR_RESULTS_TABLE: "course-statistics-ai-mentor-results-table",
  LEARNING_TIME_TABLE: "course-statistics-learning-time-table",
  QUIZ_FILTER: "course-statistics-quiz-filter",
  quizFilterOption: (quizId: string) => `course-statistics-quiz-filter-option-${quizId}`,
  AI_MENTOR_LESSON_FILTER: "course-statistics-ai-mentor-lesson-filter",
  aiMentorLessonFilterOption: (lessonId: string) =>
    `course-statistics-ai-mentor-lesson-filter-option-${lessonId}`,
  progressRow: (studentId: string) => `course-statistics-progress-row-${studentId}`,
  quizResultsRow: (studentId: string, lessonId: string) =>
    `course-statistics-quiz-results-row-${studentId}-${lessonId}`,
  quizResultsPreviewButton: (studentId: string, lessonId: string) =>
    `course-statistics-quiz-results-preview-button-${studentId}-${lessonId}`,
  aiMentorResultsRow: (studentId: string, lessonId: string) =>
    `course-statistics-ai-mentor-results-row-${studentId}-${lessonId}`,
  aiMentorResultsPreviewButton: (studentId: string, lessonId: string) =>
    `course-statistics-ai-mentor-results-preview-button-${studentId}-${lessonId}`,
  learningTimeRow: (studentId: string) => `course-statistics-learning-time-row-${studentId}`,
  LESSON_PREVIEW_DIALOG: "course-statistics-lesson-preview-dialog",
} as const;

export const ADMIN_STATISTICS_HANDLES = {
  PAGE: "admin-statistics-page",
  DOWNLOAD_REPORT_BUTTON: "admin-statistics-download-report-button",
  MOST_POPULAR_COURSES_CHART: "admin-statistics-most-popular-courses-chart",
  COURSE_COMPLETION_CHART: "admin-statistics-course-completion-chart",
  FREEMIUM_CONVERSION_CHART: "admin-statistics-freemium-conversion-chart",
  ENROLLMENT_CHART: "admin-statistics-enrollment-chart",
  AVERAGE_QUIZ_SCORE_CHART: "admin-statistics-average-quiz-score-chart",
} as const;
