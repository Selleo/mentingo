import type { SupportedLanguages } from "@repo/shared";

export type ContentMarketplaceConnection = {
  baseUrl: string;
  apiKey: string;
  tenantId: string;
};

export type ContentMarketplaceCourseLineage = {
  listingId: string;
  versionId: string;
  acquisitionId: string;
};

export type ContentMarketplaceTrackedCourse = {
  courseId: string;
  listingId: string;
  versionId: string;
  notifiedUpdateVersionId: string | null;
};

export type ContentMarketplaceCourseUpdateRecipient = {
  id: string;
  email: string;
};

export type ContentMarketplaceCourseUpdateTexts = {
  title: string;
  message: string;
  coursesWithNewVersion: string;
  allCoursesWithNewVersion: string;
};

export type ContentMarketplaceUpdatedCourseTitles = {
  courseId: string;
} & Record<SupportedLanguages, string>;

export type ContentMarketplaceImportedCourse = {
  courseId: string;
  listingId: string;
  versionId: string;
};
