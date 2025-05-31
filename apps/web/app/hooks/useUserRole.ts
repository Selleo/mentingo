import { useCurrentUser } from "~/api/queries";
import { USER_ROLE } from "~/config/userRoles";

export const useUserRole = () => {
  const {
    data: { role },
  } = useCurrentUser();

  const isVisitor = role === USER_ROLE.visitor;
  const isAdmin = role === USER_ROLE.admin;
  const isTeacher = role === USER_ROLE.teacher;
  const isStudent = role === USER_ROLE.student;
  const isAdminLike = isAdmin || isTeacher;

  return { role, isAdmin, isTeacher, isAdminLike, isVisitor, isStudent };
};
