export const userRoles = ["admin", "student", "content_creator"] as const;

export const USER_ROLES = {
  ADMIN: "admin",
  STUDENT: "student",
  CONTENT_CREATOR: "content_creator",
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];
