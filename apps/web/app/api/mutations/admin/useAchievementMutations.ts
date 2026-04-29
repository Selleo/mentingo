import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import {
  ACHIEVEMENTS_QUERY_KEY,
  type Achievement,
  type UpsertAchievementPayload,
} from "~/api/queries/admin/useAchievements";
import { queryClient } from "~/api/queryClient";
import { useToast } from "~/components/ui/use-toast";

type ApiResponse<T> = {
  data: T;
};

const useAchievementErrorToast = () => {
  const { toast } = useToast();
  const { t } = useTranslation();

  return (error: Error) => {
    const description =
      error instanceof AxiosError
        ? error.response?.data?.message || t("common.toast.somethingWentWrong")
        : error.message;

    toast({ variant: "destructive", description });
  };
};

export function useCreateAchievement() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const showError = useAchievementErrorToast();

  return useMutation({
    mutationFn: async (payload: Required<UpsertAchievementPayload>) => {
      const response = await ApiClient.instance.post<ApiResponse<Achievement>>(
        "/api/achievements/admin",
        payload,
      );
      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ACHIEVEMENTS_QUERY_KEY });
      toast({ description: t("adminAchievementsView.toast.created") });
    },
    onError: showError,
  });
}

export function useUpdateAchievement() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const showError = useAchievementErrorToast();

  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpsertAchievementPayload }) => {
      const response = await ApiClient.instance.patch<ApiResponse<Achievement>>(
        `/api/achievements/admin/${id}`,
        payload,
      );
      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ACHIEVEMENTS_QUERY_KEY });
      toast({ description: t("adminAchievementsView.toast.updated") });
    },
    onError: showError,
  });
}

export function useDeleteAchievement() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const showError = useAchievementErrorToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await ApiClient.instance.delete<ApiResponse<Achievement>>(
        `/api/achievements/admin/${id}`,
      );
      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ACHIEVEMENTS_QUERY_KEY });
      toast({ description: t("adminAchievementsView.toast.deleted") });
    },
    onError: showError,
  });
}

export function useUploadAchievementImage() {
  const showError = useAchievementErrorToast();

  return useMutation({
    mutationFn: async (image: File) => {
      const formData = new FormData();
      formData.append("image", image);

      const response = await ApiClient.instance.post<
        ApiResponse<{ fileKey: string; fileUrl?: string }>
      >("/api/achievements/admin/image", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      return response.data.data;
    },
    onError: showError,
  });
}
