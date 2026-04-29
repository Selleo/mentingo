import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";

export const ACHIEVEMENTS_QUERY_KEY = ["achievements"];

export type SupportedLocale = "en" | "pl" | "de" | "lt" | "cs";

export type AchievementTranslation = {
  locale: SupportedLocale;
  name: string;
  description: string;
};

export type Achievement = {
  id: string;
  tenantId: string;
  imageReference: string;
  imageUrl?: string;
  pointThreshold: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  localizedName: string;
  localizedDescription: string;
  translations: AchievementTranslation[];
};

export type AchievementTranslationsInput = Record<
  SupportedLocale,
  {
    name: string;
    description: string;
  }
>;

export type UpsertAchievementPayload = {
  imageReference?: string;
  pointThreshold?: number;
  isActive?: boolean;
  translations?: AchievementTranslationsInput;
};

type AchievementListOptions = {
  includeInactive?: boolean;
};

type ApiResponse<T> = {
  data: T;
};

export const achievementsQueryOptions = (
  language: string,
  options: AchievementListOptions = {},
) => ({
  queryKey: [...ACHIEVEMENTS_QUERY_KEY, { language, includeInactive: options.includeInactive }],
  queryFn: async () => {
    const response = await ApiClient.instance.get<ApiResponse<Achievement[]>>(
      "/api/achievements/admin",
      {
        params: {
          language,
          includeInactive: String(options.includeInactive ?? false),
        },
      },
    );

    return response.data.data;
  },
});

export const achievementQueryOptions = (id: string, language: string) => ({
  queryKey: [...ACHIEVEMENTS_QUERY_KEY, id, language],
  queryFn: async () => {
    const response = await ApiClient.instance.get<ApiResponse<Achievement>>(
      `/api/achievements/admin/${id}`,
      { params: { language } },
    );

    return response.data.data;
  },
  enabled: !!id,
});

export function useAchievements(options?: AchievementListOptions) {
  const { i18n } = useTranslation();
  return useQuery(achievementsQueryOptions(i18n.language, options));
}

export function useAchievementsSuspense(options?: AchievementListOptions) {
  const { i18n } = useTranslation();
  return useSuspenseQuery(achievementsQueryOptions(i18n.language, options));
}

export function useAchievement(id: string) {
  const { i18n } = useTranslation();
  return useQuery(achievementQueryOptions(id, i18n.language));
}
