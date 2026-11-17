import type { UserRole } from "~/config/userRoles";

const normalizeProjectName = (projectName: string) => {
  return projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
};

export const getWorkerAuthEmail = (projectName: string, workerIndex: number, role: UserRole) => {
  const projectKey = normalizeProjectName(projectName);
  return `worker-${projectKey}-${workerIndex}+${role}@example.com`;
};

export const getWorkerTenantAuthEmail = (
  projectName: string,
  workerIndex: number,
  tenantId: string,
  role: UserRole,
) => {
  const projectKey = normalizeProjectName(projectName);
  const tenantKey = tenantId.slice(0, 8);

  return `worker-tenant-${projectKey}-${workerIndex}-${tenantKey}+${role}@example.com`;
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
  key = "session",
) => {
  const projectKey = normalizeProjectName(projectName);
  return `e2e/.auth/worker-tenant-${projectKey}-${workerIndex}-${tenantId}-${key}.json`;
};
