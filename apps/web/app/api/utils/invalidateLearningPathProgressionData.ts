import { LEARNING_PATHS_QUERY_KEY } from "~/api/queries/useLearningPaths";
import { queryClient } from "~/api/queryClient";

const LEARNING_PATH_PROGRESS_SYNC_DELAY_MS = 1500;
const GLOBAL_SEARCH_QUERY_KEYS = [
  ["courses"],
  ["users"],
  ["categories"],
  ["groups"],
  ["content-creator-courses"],
  ["get-student-courses"],
  ["available-courses"],
  ["announcements-for-user"],
  ["lessons"],
  ["news-search"],
  ["articles-search"],
  ["qa-search"],
  ["learning-path-certificate"],
];

async function invalidateProgressionQueries() {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["course"] }),
    queryClient.invalidateQueries({ queryKey: ["top-courses"] }),
    queryClient.invalidateQueries({ queryKey: LEARNING_PATHS_QUERY_KEY }),
    ...GLOBAL_SEARCH_QUERY_KEYS.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
  ]);
}

export async function invalidateLearningPathProgressionData() {
  await invalidateProgressionQueries();

  if (typeof window === "undefined") return;

  window.setTimeout(() => {
    void invalidateProgressionQueries();
  }, LEARNING_PATH_PROGRESS_SYNC_DELAY_MS);
}
