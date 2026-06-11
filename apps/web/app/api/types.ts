import type { SupportedLanguages } from "@repo/shared";
import type { SortOption } from "~/types/sorting";

export type ApiErrorResponse = {
  message: string;
  statusCode?: number;
  retryAfterSeconds?: number;
  translationParams?: Record<string, unknown>;
};

export type EmbedLessonResource = {
  id?: string;
  fileUrl: string;
  allowFullscreen?: boolean;
};

export type AvailableCourseCategorySearchParams = {
  title?: string;
  description?: string;
  searchQuery?: string;
  category?: string;
  author?: string;
  sort?: SortOption;
  excludeCourseId?: string;
  language?: SupportedLanguages;
};
