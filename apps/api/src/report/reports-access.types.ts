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

/** Everything that bounds what a viewer may report on, resolved once per request. */
export type ReportsAccessScope = {
  access: ReportsAccess;
  managedGroupIds: string[];
  authorizedGroupIds: string[];
};
