import type { DatabasePg } from "src/common";
import type { CurrentUser, SupportModeCurrentUser } from "src/common/types/current-user.type";

export const isSupportModeSession = (
  currentUser: CurrentUser | null | undefined,
): currentUser is SupportModeCurrentUser => {
  return Boolean(
    currentUser?.isSupportMode &&
      currentUser.supportSessionId &&
      currentUser.originalUserId &&
      currentUser.originalTenantId,
  );
};

export const getSupportModeContext = (
  currentUser: CurrentUser,
  db: DatabasePg,
  dbAdmin: DatabasePg,
): {
  isSupportMode: boolean;
  dbInstance: DatabasePg;
  sourceUserId: string;
  sourceTenantId: string;
} => {
  if (isSupportModeSession(currentUser)) {
    return {
      isSupportMode: true,
      dbInstance: dbAdmin,
      sourceUserId: currentUser.originalUserId,
      sourceTenantId: currentUser.originalTenantId,
    };
  }

  return {
    isSupportMode: false,
    dbInstance: db,
    sourceUserId: currentUser.userId,
    sourceTenantId: currentUser.tenantId,
  };
};

export const shouldEmitUserScopedEvents = (currentUser: CurrentUser): boolean => {
  return !isSupportModeSession(currentUser);
};
