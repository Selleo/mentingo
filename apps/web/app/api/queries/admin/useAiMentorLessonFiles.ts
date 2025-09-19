import { queryOptions, useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

export const aiMentorLessonFilesQueryOptions = (
  lessonId: string,
  isUploadPending?: boolean,
  isDeletePending?: boolean,
) =>
  queryOptions({
    enabled: !isUploadPending && !isDeletePending,
    queryKey: ["ai-mentor-lesson-files", { lessonId }],
    queryFn: async () => {
      const response =
        await ApiClient.api.ingestionControllerGetAllAssignedDocumentsForLesson(lessonId);

      return response.data;
    },
  });

export function useAiMentorLessonFiles(
  id: string,
  isUploadPending?: boolean,
  isDeletePending?: boolean,
) {
  return useQuery(aiMentorLessonFilesQueryOptions(id, isUploadPending, isDeletePending));
}
