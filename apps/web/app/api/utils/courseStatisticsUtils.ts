import { COURSE_AVERAGE_SCORE_PER_QUIZ_QUERY_KEY } from "~/api/queries/admin/useCourseAverageScorePerQuiz";
import { COURSE_LEARNING_TIME_STATISTICS_QUERY_KEY } from "~/api/queries/admin/useCourseLearningTimeStatistics";
import { COURSE_STATISTICS_FILTER_OPTIONS_QUERY_KEY } from "~/api/queries/admin/useCourseLearningTimeStatisticsFilterOptions";
import { COURSE_STATISTICS_QUERY_KEY } from "~/api/queries/admin/useCourseStatistics";
import { COURSE_STUDENTS_AI_MENTOR_RESULTS_QUERY_KEY } from "~/api/queries/admin/useCourseStudentsAiMentorResults";
import { COURSE_STUDENTS_PROGRESS_QUERY_KEY } from "~/api/queries/admin/useCourseStudentsProgress";
import { COURSE_STUDENTS_QUIZ_RESULTS_QUERY_KEY } from "~/api/queries/admin/useCourseStudentsQuizResults";
import { queryClient } from "~/api/queryClient";

export async function invalidateCourseStatisticsQueries() {
  await queryClient.invalidateQueries({
    queryKey: [COURSE_STUDENTS_QUIZ_RESULTS_QUERY_KEY],
  });

  await queryClient.invalidateQueries({
    queryKey: [COURSE_STUDENTS_PROGRESS_QUERY_KEY],
  });

  await queryClient.invalidateQueries({
    queryKey: [COURSE_STUDENTS_AI_MENTOR_RESULTS_QUERY_KEY],
  });

  await queryClient.invalidateQueries({ queryKey: [COURSE_AVERAGE_SCORE_PER_QUIZ_QUERY_KEY] });

  await queryClient.invalidateQueries({ queryKey: [COURSE_LEARNING_TIME_STATISTICS_QUERY_KEY] });

  await queryClient.invalidateQueries({
    queryKey: [COURSE_STATISTICS_FILTER_OPTIONS_QUERY_KEY],
  });

  await queryClient.invalidateQueries({ queryKey: [COURSE_STATISTICS_QUERY_KEY] });
}
