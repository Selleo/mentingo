import type { DatabasePg } from "src/common";
import type { CurrentUserType, SupportModeCurrentUser } from "src/common/types/current-user.type";

export const isSupportModeSession = (
  currentUser: CurrentUserType | null | undefined,
): currentUser is SupportModeCurrentUser => {
  return Boolean(
    currentUser?.isSupportMode &&
      currentUser.supportSessionId &&
      currentUser.originalUserId &&
      currentUser.originalTenantId,
  );
};

export const getSupportModeContext = (
  currentUser: CurrentUserType,
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

export const shouldEmitUserScopedEvents = (currentUser: CurrentUserType): boolean => {
  return !isSupportModeSession(currentUser);
};
