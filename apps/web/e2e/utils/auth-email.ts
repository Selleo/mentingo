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

const normalizeProjectName = (projectName: string) => {
  return projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
};

export const getWorkerAuthEmail = (projectName: string, workerIndex: number, role: UserRole) => {
  const projectKey = normalizeProjectName(projectName);
  return `${AUTH_ACCOUNT_TEMPLATE.WORKER}-${projectKey}-${workerIndex}+${role}@example.com`;
};

export const getReadonlyAuthStatePath = (role: UserRole) => {
  return `e2e/.auth/readonly-${role}.json`;
};

export const getWorkerAuthStatePath = (
  projectName: string,
  workerIndex: number,
  role: UserRole,
) => {
  const projectKey = normalizeProjectName(projectName);
  return `e2e/.auth/worker-${projectKey}-${workerIndex}-${role}.json`;
};

export const getWorkerTenantAuthStatePath = (
  projectName: string,
  workerIndex: number,
  tenantId: string,
) => {
  const projectKey = normalizeProjectName(projectName);
  return `e2e/.auth/worker-tenant-${projectKey}-${workerIndex}-${tenantId}.json`;
};

export const getAuthEmail = (
  template: AuthAccountTemplate,
  role: UserRole,
  projectName?: string,
  workerIndex?: number,
) => {
  if (template === AUTH_ACCOUNT_TEMPLATE.READONLY) {
    return getReadonlyAuthEmail(role);
  }

  if (!projectName || typeof workerIndex !== "number") {
    throw new Error("projectName and workerIndex are required when generating worker auth emails");
  }

  return getWorkerAuthEmail(projectName, workerIndex, role);
};
