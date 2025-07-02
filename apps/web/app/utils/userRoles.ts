{
  /* Temporarily duplicated userRoles helper util, potentially implement shared between frontend and backend*/
}
export const userRoles = ["admin", "student", "teacher"] as const;

export const USER_ROLES = {
  ADMIN: "admin",
  STUDENT: "student",
  TEACHER: "teacher",
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

export const isAdmin = (role: string) => {
  return USER_ROLES.ADMIN === role;
};
export const isTeacher = (role: string) => {
  return USER_ROLES.TEACHER === role;
};
export const isStudent = (role: string) => {
  return USER_ROLES.STUDENT === role;
};
export const isAdminLike = (role: string) => {
  return isAdmin(role) || isTeacher(role);
};
