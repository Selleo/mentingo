{
  /* Temporarily duplicated userRoles helper util, potentially implement shared between frontend and backend*/
}
export const userRoles = ["admin", "student", "content_creator"] as const;

export const USER_ROLES = {
  ADMIN: "admin",
  STUDENT: "student",
  CONTENT_CREATOR: "content_creator",
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

export const isAdmin = (role: string) => {
  return USER_ROLES.ADMIN === role;
};
export const isContentCreator = (role: string) => {
  return USER_ROLES.CONTENT_CREATOR === role;
};
export const isStudent = (role: string) => {
  return USER_ROLES.STUDENT === role;
};
export const isAdminLike = (role: string) => {
  return isAdmin(role) || isContentCreator(role);
};
