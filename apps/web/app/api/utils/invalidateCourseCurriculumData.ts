import { COURSE_QUERY_KEY } from "~/api/queries/admin/useBetaCourse";
import { queryClient } from "~/api/queryClient";

export async function invalidateCourseCurriculumData() {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: [COURSE_QUERY_KEY], refetchType: "all" }),
    queryClient.invalidateQueries({ queryKey: ["course"], refetchType: "all" }),
    queryClient.invalidateQueries({ queryKey: ["lesson"], refetchType: "all" }),
    queryClient.invalidateQueries({ queryKey: ["lessons"], refetchType: "all" }),
    queryClient.invalidateQueries({ queryKey: ["lessons-sequence"], refetchType: "all" }),
  ]);
}
