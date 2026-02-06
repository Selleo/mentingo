import { useCurrentUserSuspense } from "~/api/queries";
import { USER_ROLE } from "~/config/userRoles";

export const useUserRole = () => {
  const { data } = useCurrentUserSuspense();

  const role = data?.role ?? null;
  const isAdmin = data?.role === USER_ROLE.admin;
  const isContentCreator = data?.role === USER_ROLE.contentCreator;
  const isStudent = data?.role === USER_ROLE.student;
  const isAdminLike = isAdmin || isContentCreator;
  const isManagingTenantAdmin = Boolean(data?.isManagingTenantAdmin);

  return { role, isAdmin, isContentCreator, isAdminLike, isStudent, isManagingTenantAdmin };
};
