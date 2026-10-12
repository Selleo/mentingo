export type ReportsAccess = {
  tenantId: string;
  userId: string;
  canReadOrganisation: boolean;
  canReadManagedGroups: boolean;
  ownedCoursesOnly: boolean;
  canManageShared: boolean;
};

export type ReportsScopeHashes = {
  managedLearnersHash?: string;
  ownedCoursesHash?: string;
  ownedEnrollmentsHash?: string;
};

export type ReportsAccessScope = {
  access: ReportsAccess;
  managedGroupIds: string[];
  authorizedGroupIds: string[];
};
