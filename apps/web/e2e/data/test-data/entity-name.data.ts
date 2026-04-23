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
} as const;
