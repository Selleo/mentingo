export const TEST_DATA = {
  category: {
    titlePrefix: "E2E Category",
  },
  course: {
    titlePrefix: "E2E Course",
    descriptionPrefix: "E2E course description",
  },
  user: {
    firstNamePrefix: "E2E User",
    lastNamePrefix: "Test",
    emailPrefix: "e2e-user",
  },
  group: {
    namePrefix: "E2E Group",
  },
  tenant: {
    namePrefix: "E2E Tenant",
    hostPrefix: "e2e-tenant",
    adminEmailPrefix: "e2e-tenant-admin",
  },
  news: {
    titlePrefix: "E2E News",
    summaryPrefix: "E2E News Summary",
  },
  article: {
    titlePrefix: "E2E Article",
    summaryPrefix: "E2E Article Summary",
    sectionTitlePrefix: "E2E Article Section",
  },
} as const;
