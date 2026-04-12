import type { UserRole } from "~/config/userRoles";

export const AUTH_ACCOUNT_TEMPLATE = {
  READONLY: "readonly",
  WORKER: "worker",
} as const;

export type AuthAccountTemplate =
  (typeof AUTH_ACCOUNT_TEMPLATE)[keyof typeof AUTH_ACCOUNT_TEMPLATE];

export const getReadonlyAuthEmail = (role: UserRole) => {
  return `${AUTH_ACCOUNT_TEMPLATE.READONLY}+${role}@example.com`;
};

export const getWorkerAuthEmail = (workerIndex: number, role: UserRole) => {
  return `${AUTH_ACCOUNT_TEMPLATE.WORKER}-${workerIndex}+${role}@example.com`;
};

export const getReadonlyAuthStatePath = (role: UserRole) => {
  return `e2e/.auth/readonly-${role}.json`;
};

export const getWorkerAuthStatePath = (workerIndex: number, role: UserRole) => {
  return `e2e/.auth/worker-${workerIndex}-${role}.json`;
};

export const getAuthEmail = (
  template: AuthAccountTemplate,
  role: UserRole,
  workerIndex?: number,
) => {
  if (template === AUTH_ACCOUNT_TEMPLATE.READONLY) {
    return getReadonlyAuthEmail(role);
  }

  if (typeof workerIndex !== "number") {
    throw new Error("workerIndex is required when generating worker auth emails");
  }

  return getWorkerAuthEmail(workerIndex, role);
};
