import { useCurrentUserSuspense } from "~/api/queries";
import { USER_ROLE } from "~/config/userRoles";

export const useUserRole = () => {
  const { data } = useCurrentUserSuspense();

  const role = data?.role ?? null;
  const isAdmin = data?.role === USER_ROLE.admin;
  const isTeacher = data?.role === USER_ROLE.teacher;
  const isStudent = data?.role === USER_ROLE.student;
  const isAdminLike = isAdmin || isTeacher;

  return { role, isAdmin, isTeacher, isAdminLike, isStudent };
};
