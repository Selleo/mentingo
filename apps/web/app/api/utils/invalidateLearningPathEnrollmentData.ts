import { LEARNING_PATH_ENROLLED_USERS_QUERY_KEY } from "~/api/queries/useLearningPathEnrolledUsers";
import { LEARNING_PATHS_QUERY_KEY } from "~/api/queries/useLearningPaths";
import { queryClient } from "~/api/queryClient";

export async function invalidateLearningPathEnrollmentData() {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: [LEARNING_PATH_ENROLLED_USERS_QUERY_KEY] }),
    queryClient.invalidateQueries({ queryKey: LEARNING_PATHS_QUERY_KEY }),
  ]);
}
