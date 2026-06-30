import { COURSE_QUERY_KEY } from "~/api/queries/admin/useBetaCourse";
import { queryClient } from "~/api/queryClient";

export async function invalidateCourseCurriculumData() {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: [COURSE_QUERY_KEY] }),
    queryClient.invalidateQueries({ queryKey: ["course"] }),
    queryClient.invalidateQueries({ queryKey: ["lesson"] }),
    queryClient.invalidateQueries({ queryKey: ["lessons-sequence"] }),
  ]);
}
