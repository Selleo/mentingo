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

export type ContentMarketplaceImportedCourse = {
  courseId: string;
  listingId: string;
  versionId: string;
};
