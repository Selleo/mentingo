import type { SupportedLanguages } from "@repo/shared";

export type IntegrationCoursesQuery = {
  keyword?: string;
  language?: SupportedLanguages;
  page: number;
  perPage: number;
};
