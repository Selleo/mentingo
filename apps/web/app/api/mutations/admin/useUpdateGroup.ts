import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { COURSE_STUDENTS_PROGRESS_QUERY_KEY } from "~/api/queries/admin/useCourseStudentsProgress";
import { GROUPS_QUERY_KEY } from "~/api/queries/admin/useGroups";
import { queryClient } from "~/api/queryClient";
import { invalidateLearningPathEnrollmentData } from "~/api/utils/invalidateLearningPathEnrollmentData";
import { useToast } from "~/components/ui/use-toast";

import type { UpdateGroupBody } from "~/api/generated-api";

export function useUpdateGroup(groupId: string) {
  const { t } = useTranslation();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: UpdateGroupBody) => {
      const { data } = await ApiClient.api.groupControllerUpdateGroup(groupId, input);

      return data;
    },

    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [GROUPS_QUERY_KEY] });
      await queryClient.invalidateQueries({ queryKey: [COURSE_STUDENTS_PROGRESS_QUERY_KEY] });
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      await invalidateLearningPathEnrollmentData();

      toast({
        variant: "default",
        description: t("adminGroupsView.updateGroup.groupUpdatedSuccessfully"),
      });
    },

    onError: (error) => {
      if (error instanceof AxiosError) {
        return toast({
          variant: "destructive",
          description: error.response?.data.message,
        });
      }
      toast({
        variant: "destructive",
        description: error.message,
      });
    },
  });
}
