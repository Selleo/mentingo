import { COURSE_QUERY_KEY } from "~/api/queries/admin/useBetaCourse";
import { COURSE_AVERAGE_SCORE_PER_QUIZ_QUERY_KEY } from "~/api/queries/admin/useCourseAverageScorePerQuiz";
import { COURSE_LEARNING_TIME_STATISTICS_QUERY_KEY } from "~/api/queries/admin/useCourseLearningTimeStatistics";
import { COURSE_STATISTICS_FILTER_OPTIONS_QUERY_KEY } from "~/api/queries/admin/useCourseLearningTimeStatisticsFilterOptions";
import { COURSE_OWNERSHIP_CANDIDATES_QUERY_KEY } from "~/api/queries/admin/useCourseOwnershipCandidates";
import { COURSE_STATISTICS_QUERY_KEY } from "~/api/queries/admin/useCourseStatistics";
import { COURSE_STUDENTS_AI_MENTOR_RESULTS_QUERY_KEY } from "~/api/queries/admin/useCourseStudentsAiMentorResults";
import { COURSE_STUDENTS_PROGRESS_QUERY_KEY } from "~/api/queries/admin/useCourseStudentsProgress";
import { COURSE_STUDENTS_QUIZ_RESULTS_QUERY_KEY } from "~/api/queries/admin/useCourseStudentsQuizResults";
import { GROUPS_BY_COURSE_QUERY_KEY } from "~/api/queries/admin/useGroupsByCourse";
import { COURSE_TRANSLATIONS_QUERY_KEY } from "~/api/queries/admin/useHasMissingTranslations";
import { ENROLLED_USERS_QUERY_KEY } from "~/api/queries/admin/useUsersEnrolled";
import { ALL_COURSES_QUERY_KEY } from "~/api/queries/useCourses";
import { queryClient } from "~/api/queryClient";

export async function invalidateCourseOwnershipData() {
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: [COURSE_OWNERSHIP_CANDIDATES_QUERY_KEY],
    }),
    queryClient.invalidateQueries({ queryKey: [COURSE_QUERY_KEY] }),
    queryClient.invalidateQueries({ queryKey: ["course"] }),
    queryClient.invalidateQueries({ queryKey: ["course-settings"] }),
    queryClient.invalidateQueries({ queryKey: ["lessons-sequence"] }),
    queryClient.invalidateQueries({ queryKey: [COURSE_TRANSLATIONS_QUERY_KEY] }),
    queryClient.invalidateQueries({ queryKey: [COURSE_STATISTICS_QUERY_KEY] }),
    queryClient.invalidateQueries({ queryKey: [COURSE_AVERAGE_SCORE_PER_QUIZ_QUERY_KEY] }),
    queryClient.invalidateQueries({ queryKey: [COURSE_STUDENTS_QUIZ_RESULTS_QUERY_KEY] }),
    queryClient.invalidateQueries({ queryKey: [COURSE_STUDENTS_PROGRESS_QUERY_KEY] }),
    queryClient.invalidateQueries({ queryKey: [COURSE_STUDENTS_AI_MENTOR_RESULTS_QUERY_KEY] }),
    queryClient.invalidateQueries({ queryKey: [COURSE_LEARNING_TIME_STATISTICS_QUERY_KEY] }),
    queryClient.invalidateQueries({ queryKey: [COURSE_STATISTICS_FILTER_OPTIONS_QUERY_KEY] }),
    queryClient.invalidateQueries({ queryKey: [GROUPS_BY_COURSE_QUERY_KEY] }),
    queryClient.invalidateQueries({ queryKey: [ENROLLED_USERS_QUERY_KEY] }),
    queryClient.invalidateQueries({ queryKey: ALL_COURSES_QUERY_KEY }),
    queryClient.invalidateQueries({ queryKey: ["available-courses"] }),
    queryClient.invalidateQueries({ queryKey: ["content-creator-courses"] }),
    queryClient.invalidateQueries({ queryKey: ["get-student-courses"] }),
  ]);
}
