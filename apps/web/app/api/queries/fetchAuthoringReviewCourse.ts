/** Read current native anchors before projecting a structured image insertion. */
import { queryClient } from "../queryClient";

import { courseQueryOptions } from "./admin/useBetaCourse";

import type { SupportedLanguages } from "@repo/shared";

/** Bypass the normal five-minute course cache after Core prepared legacy block IDs. */
export const fetchAuthoringReviewCourse = async (
  courseId: string,
  language: SupportedLanguages,
) => {
  const response = await queryClient.fetchQuery({
    ...courseQueryOptions(courseId, language),
    staleTime: 0,
  });
  return response.data;
};
