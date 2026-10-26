import type { SupportedLanguages } from "@repo/shared";
import type { AxiosError, InternalAxiosRequestConfig } from "axios";
import type { SortOption } from "~/types/sorting";

export type ApiErrorResponse = {
  message: string;
  statusCode?: number;
  retryAfterSeconds?: number;
  translationParams?: Record<string, unknown>;
};

export type ApiError = AxiosError<ApiErrorResponse>;

export type RetryableApiError = ApiError & { config: InternalAxiosRequestConfig };

export type EmbedLessonResource = {
  id?: string;
  fileUrl: string;
  allowFullscreen?: boolean;
};

export type AvailableCourseCategorySearchParams = {
  userId?: string;
  title?: string;
  description?: string;
  searchQuery?: string;
  category?: string;
  author?: string;
  sort?: SortOption;
  excludeCourseId?: string;
  language?: SupportedLanguages;
};

declare module "axios" {
  interface AxiosRequestConfig {
    _retry?: boolean;
  }
}
