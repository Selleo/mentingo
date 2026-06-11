import { COURSE_QUERY_KEY } from "~/api/queries/admin/useBetaCourse";
import { COURSE_GENERATION_DRAFT_QUERY_KEY } from "~/api/queries/admin/useCourseGenerationDraft";
import { getCourseGenerationMessagesQueryKey } from "~/api/queries/admin/useCourseGenerationMessages";
import { queryClient } from "~/api/queryClient";

export async function invalidateCourseGenerationSyncQueries(courseId: string) {
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: getCourseGenerationMessagesQueryKey(courseId),
    }),
    queryClient.invalidateQueries({
      queryKey: [COURSE_GENERATION_DRAFT_QUERY_KEY],
    }),
    queryClient.invalidateQueries({
      queryKey: [COURSE_QUERY_KEY],
    }),
    queryClient.invalidateQueries({
      queryKey: ["course"],
    }),
  ]);
}
