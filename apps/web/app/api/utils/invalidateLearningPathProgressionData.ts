import { GLOBAL_SEARCH_QUERY_KEY } from "~/api/queries/useGlobalSearch";
import { LEARNING_PATHS_QUERY_KEY } from "~/api/queries/useLearningPaths";
import { queryClient } from "~/api/queryClient";

const LEARNING_PATH_PROGRESS_SYNC_DELAY_MS = 1500;

async function invalidateProgressionQueries() {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["course"] }),
    queryClient.invalidateQueries({ queryKey: ["top-courses"] }),
    queryClient.invalidateQueries({ queryKey: LEARNING_PATHS_QUERY_KEY }),
    queryClient.invalidateQueries({ queryKey: GLOBAL_SEARCH_QUERY_KEY }),
  ]);
}

export async function invalidateLearningPathProgressionData() {
  await invalidateProgressionQueries();

  if (typeof window === "undefined") return;

  window.setTimeout(() => {
    void invalidateProgressionQueries();
  }, LEARNING_PATH_PROGRESS_SYNC_DELAY_MS);
}
