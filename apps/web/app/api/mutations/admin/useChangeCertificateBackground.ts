import { useMutation, useQueryClient } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";
import { ALL_COURSES_QUERY_KEY } from "~/api/queries/useCourses";

type ChangeCertificateBackgroundParams = {
  id: string;
  image: File;
};

export const useChangeCertificateBackground = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, image }: ChangeCertificateBackgroundParams) => {
      const formData: {
        id?: string;
        image?: File;
      } = {};
      if (id) formData.id = id;
      if (image) formData.image = image;
      await ApiClient.api.courseControllerUpdateCertificateBackground(formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ALL_COURSES_QUERY_KEY });
    },
    onError: (error) => {
      if (error instanceof Error) {
        console.error("Error changing certificate background:", error.message);
      } else {
        console.error("An unexpected error occurred while changing the certificate background.");
      }
    },
  });
};
